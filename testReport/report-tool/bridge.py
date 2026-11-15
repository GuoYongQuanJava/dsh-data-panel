"""bridge.py: 把「某一次真实执行」的结果转换成报告工具需要的数据。

用法:
    python bridge.py --cases <会话>/cases.json \
                     --run   <会话>/runs/<runId>/result.json \
                     [--log  <会话>/runs/<runId>/run.log] \
                     [--out  <会话>/reports/<runId>/report-data.json]

然后交给报告工具:
    python report-tool/cmd.py --template ... --data report-data.json --skill ... -o <会话>/reports/<runId>/<项目>-测试报告.docx

设计原则（重要）：
* **不重跑测试**。报告只消费 `--run` 指定的那一次执行结果，保证报告和日志是同一件事。
* **不信「整体通过」**。逐条结论只来自 result.json 里的 `tests`（batch 模式来自 JUnit，
  per-case 模式来自每条命令的退出码）；某条用例找不到自己的证据就标「未确认」，**绝不**用整体状态推断它通过。

* **不编造覆盖率**。没有真实覆盖率数据就写「未采集」。
* 中间产物默认放在 `reports/<runId>/`，不同次执行不会互相覆盖。
"""

import argparse
import json
import sys
from pathlib import Path

TYPE_MAP = {
    "functional": "功能测试",
    "api": "接口测试",
    "boundary": "边界测试",
    "logic": "逻辑测试",
    "performance": "性能测试",
    "接口测试": "接口测试",
    "功能测试": "功能测试",
    "边界测试": "边界测试",
    "逻辑测试": "逻辑测试",
    "性能测试": "性能测试",
}

MODULE_NAMES = {
    "功能测试": "功能测试用例",
    "边界测试": "边界测试用例",
    "接口测试": "接口测试用例",
    "性能测试": "性能测试用例",
    "逻辑测试": "逻辑测试用例",
}

COVERAGE_UNAVAILABLE = "未采集"


def _force_utf8_output() -> None:
    """中文 Windows 下 stderr 被管道接住时默认 cp936，调用方按 UTF-8 解码会炸。"""
    for stream in (sys.stdout, sys.stderr):
        try:
            stream.reconfigure(encoding="utf-8", errors="replace")
        except Exception:
            pass


def coverage_text(result: dict) -> str:
    """把 result.json 里的真实覆盖率统计写成模板那一行（`-S … -B …`）。

    数据来源：runner 执行时解析出来并写进 result["coverage"] 的统计块。
    没有数据就写「未采集」并附上原因 —— 绝不自己编一个数字。
    """
    cov = result.get("coverage")
    if not isinstance(cov, dict) or not cov.get("available"):
        reason = ""
        if isinstance(cov, dict):
            reason = str(cov.get("reason") or "").strip()
        text = f"{COVERAGE_UNAVAILABLE}（{reason}）" if reason else COVERAGE_UNAVAILABLE
        # schema 对 coverage 字段限长 200，超了会直接扇回整个报告。
        return text[:200]

    parts = []
    line = cov.get("line") or {}
    branch = cov.get("branch") or {}
    if line.get("total"):
        parts.append(f"-S {line.get('percent')}%")
    if branch.get("total"):
        parts.append(f"-B {branch.get('percent')}%")
    return (" ".join(parts) if parts else COVERAGE_UNAVAILABLE)[:200]

STATUS_TEXT = {
    "passed": "通过",
    "partial": "部分通过（有未执行或未确认用例）",
    "failed": "失败",
    "build-failed": "构建失败",
    "timeout": "超时",
    "interrupted": "中断",
    "no-tests": "未收集到测试",
    "no-targets": "没有可执行用例",
    "no-request": "缺少执行请求",
    "no-test-file": "测试代码缺失",
    "running": "未完成",
}


def load_cases(path: Path) -> list:
    """兼容裸数组与 {cases: [...]} 两种形态。"""
    raw = path.read_text(encoding="utf-8-sig")
    data = json.loads(raw)
    if isinstance(data, list):
        return data
    if isinstance(data, dict) and isinstance(data.get("cases"), list):
        return data["cases"]
    return []


def default_out(run_path: Path) -> Path:
    """默认把报告数据写到 reports/<runId>/report-data.json（runs 的兄弟目录）。"""
    run_id = run_path.parent.name
    session_root = run_path.parent.parent.parent  # runs/<runId>/result.json -> <root>
    return session_root / "reports" / run_id / "report-data.json"


def runner_label(result: dict) -> str:
    """报告里展示的执行器：优先用 runner 描述，兼容没有 runner 字段的旧结果。"""
    runner = result.get("runner") or {}
    label = str(runner.get("label") or runner.get("id") or "").strip()
    language = str(runner.get("language") or "").strip()
    if label and language:
        return f"{label} / {language}"
    return label or "未知测试框架"


def case_project_name(result: dict, run_path: Path) -> str:
    project = result.get("project")
    if isinstance(project, str) and project:
        return Path(project).name
    return "未记录项目"


def build_test_index(result: dict) -> dict:
    """优先用 caseId 定位逐条证据；旧结果才用唯一的测试函数名。"""
    by_id, by_func = {}, {}
    for item in result.get("tests") or []:
        case_id = str(item.get("caseId") or "")
        func = str(item.get("func") or "")
        if case_id:
            by_id[case_id] = item
        if func:
            by_func.setdefault(func, []).append(item)
    return by_id, by_func


def named_values(value: object) -> list:
    """只接受用例里明确声明的变量名和值，不从自由文本猜测。"""
    if not isinstance(value, list):
        return []
    return [[item["name"], item["value"]] for item in value
            if isinstance(item, dict) and isinstance(item.get("name"), str)
            and item["name"] and isinstance(item.get("value"), str)]


def actual_outputs(case: dict, evidence: dict | None) -> list:
    expected = named_values(case.get("expectedOutputs"))
    values = evidence.get("actualOutputs") if isinstance(evidence, dict) else None
    if not isinstance(values, dict):
        values = {}
    # 旧 ACTUAL 标记只是一条未命名原始值；仅当用例明确只有一个输出变量时才能对应。
    if len(expected) == 1 and expected[0][0] not in values and evidence and isinstance(evidence.get("actual"), str):
        values = {**values, expected[0][0]: evidence["actual"]}
    return [[name, wanted, values[name] if isinstance(values.get(name), str) else "未采集"]
            for name, wanted in expected]


def main() -> int:
    _force_utf8_output()
    parser = argparse.ArgumentParser(description="把一次真实执行的结果桥接成报告数据")
    parser.add_argument("--cases", default="", help="用例文件；默认用 runs/<runId>/snapshot/cases.json")
    parser.add_argument("--run", required=True, help="该次执行的 runs/<runId>/result.json")
    parser.add_argument("--log", default="", help="该次执行的 runs/<runId>/run.log（可选，仅记录路径）")
    parser.add_argument("--out", default="", help="输出路径，默认 reports/<runId>/report-data.json")
    args = parser.parse_args()

    run_path = Path(args.run)
    cases_path = Path(args.cases) if args.cases else (run_path.parent / "snapshot" / "cases.json")

    if not cases_path.is_file():
        print(f"错误：找不到 cases.json：{cases_path}", file=sys.stderr)
        return 2
    if not run_path.is_file():
        print(f"错误：找不到执行结果：{run_path}", file=sys.stderr)
        print("报告只能基于一次**已经跑过**的执行生成；请先执行测试。", file=sys.stderr)
        return 2

    cases = load_cases(cases_path)
    result = json.loads(run_path.read_text(encoding="utf-8-sig"))

    run_id = str(result.get("runId") or run_path.parent.name)
    overall_status = str(result.get("status") or "")
    executed = set(result.get("cases") or [])
    by_id, by_func = build_test_index(result)
    not_run_reasons = {
        str(item.get("caseId") or ""): str(item.get("reason") or "未执行")
        for item in (result.get("notRun") or [])
    }

    # 覆盖率在本次执行里只采一次（整批），所以每个模块写同一份统计。
    coverage_value = coverage_text(result)
    out_path = Path(args.out) if args.out else default_out(run_path)
    log_file = Path(args.log) if args.log else (run_path.parent / "run.log")

    # ── 按类型分组 ──
    modules: dict[str, list] = {}
    for case in cases:
        raw_type = case.get("testType", "")
        ctype = TYPE_MAP.get(raw_type)
        if ctype is None:
            print(f"错误：用例 {case.get('caseId', '')} 的测试类型 {raw_type!r} 不在当前五类中，请先重新分类", file=sys.stderr)
            return 2
        modules.setdefault(ctype, []).append(case)

    module_list = []
    total = passed = failed = not_run_count = unconfirmed = 0

    for ctype, case_list in modules.items():
        cases_out = []
        for case in case_list:
            case_id = str(case.get("caseId") or "")
            func = str(case.get("testFunc") or "")
            total += 1
            evidence = None

            if case_id in not_run_reasons:
                status = "notRun"
                reason = not_run_reasons[case_id]
            elif case_id not in executed:
                status = "notRun"
                reason = "本次执行未包含该用例"
            else:
                evidence = by_id.get(case_id)
                if evidence is None and func and len(by_func.get(func, [])) == 1 and not by_func[func][0].get("caseId"):
                    evidence = by_func[func][0]
                if evidence is None:
                    # 没有逐条证据：宁可标“未确认”，也不推断通过。
                    status = "unconfirmed"
                    reason = "没有该用例的逐条执行结果（可能测试函数名不匹配）"
                else:
                    outcome = str(evidence.get("outcome") or "")
                    if outcome == "passed":
                        status = "passed"
                        reason = ""
                    elif outcome in ("failed", "error"):
                        status = "failed"
                        reason = str(evidence.get("message") or "") or f"{runner_label(result)} 判定 {outcome}"
                    else:
                        status = "unconfirmed"
                        reason = f"{runner_label(result)} 判定 {outcome}"

            if status == "passed":
                passed += 1
            elif status == "failed":
                failed += 1
            elif status == "unconfirmed":
                unconfirmed += 1
            else:
                not_run_count += 1

            inputs = named_values(case.get("inputVariables"))
            outputs = actual_outputs(case, evidence if case_id in executed and status != "notRun" else None)
            if status == "notRun":
                for output in outputs:
                    output[2] = "未执行"
            notes = [str(case.get("description") or "")]
            if not inputs and case.get("input"):
                notes.append("输入条件（原始记录）：" + str(case["input"]))
            if not outputs and case.get("expected"):
                notes.append("预期结果（原始记录）：" + str(case["expected"]))
            if not outputs and evidence and evidence.get("actual") and status != "notRun":
                notes.append("实际输出（原始记录）：" + str(evidence["actual"]))
            if evidence and isinstance(evidence.get("actualOutputs"), dict) and status != "notRun":
                extra_actuals = {name: value for name, value in evidence["actualOutputs"].items()
                                 if name not in {output[0] for output in outputs}}
                if extra_actuals:
                    notes.append("其他实际输出（运行记录）：" + json.dumps(extra_actuals, ensure_ascii=False))
            cases_out.append({
                "id": case_id,
                "name": case.get("title", case_id),
                "type": ctype,
                "description": "\n".join(part for part in notes if part) or "未提供测试说明",
                "funcDesc": case.get("title") or case_id,
                "testFunc": func,
                "stub": "未记录",
                "inserted": "未记录",
                "inputs": inputs,
                "outputs": outputs,
                "passed": status == "passed",
                "status": status,
                "issue": reason or "未记录异常",
                "bugId": "未记录",
                "executedAt": evidence.get("startedAt", "") if evidence and status != "notRun" else "",
            })

        module_list.append({
            "name": MODULE_NAMES.get(ctype, f"{ctype}用例"),
            "trace": "未提供设计追溯",
            "driver": "未记录驱动模块",
            "coverage": coverage_value,
            "issues": "本次执行未记录异常。" if all(c["status"] == "passed" for c in cases_out) else "存在未通过、未执行或未确认用例，详见逐条结果。",
            "inconsistent": "未核查与测试用例或规程的一致性。",
            "cases": cases_out,
        })

    report = {
        "meta": {
            "project": f"{case_project_name(result, run_path)} 单元测试",
            "executedAt": result.get("startedAt", ""),
            "executor": runner_label(result),
            "runId": run_id,
            "status": overall_status,
            "statusText": STATUS_TEXT.get(overall_status, overall_status),
            "durationMs": result.get("durationMs", 0),
            "exitCode": result.get("exitCode"),
            "logPath": str(log_file.resolve()),
            "resultPath": str(run_path.resolve()),
            "note": result.get("note", ""),
        },
        "summary": {
            "total": total,
            "passed": passed,
            "failed": failed,
            "notRun": not_run_count,
            "unconfirmed": unconfirmed,
        },
        "modules": module_list,
    }

    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")

    print(f"OK {out_path}")
    print(f"   runId={run_id} status={STATUS_TEXT.get(overall_status, overall_status)}")
    print(f"   modules={len(module_list)}  cases={total}  passed={passed}  failed={failed}  "
          f"notRun={not_run_count}  unconfirmed={unconfirmed}")
    if result.get("note"):
        print(f"   注意：{result['note']}")
    for module in module_list:
        print(f"   [{module['name']}] {len(module['cases'])} cases")
    return 0


if __name__ == "__main__":
    sys.exit(main())
