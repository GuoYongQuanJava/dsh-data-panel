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
* **不信「整体通过」**。逐条结论只来自 result.json 里的 `tests`（runner 从 junit.xml 解析出的
  逐条结果）；某条用例找不到自己的证据就标「未确认」，**绝不**用整体状态推断它通过。
* **不编造覆盖率**。没有真实覆盖率数据就写「未采集」。
* 中间产物默认放在 `reports/<runId>/`，不同次执行不会互相覆盖。
"""

import argparse
import json
import sys
from pathlib import Path

TYPE_MAP = {
    "functional": "功能测试",
    "boundary": "边界测试",
    "exception": "接口测试",
    "performance": "性能测试",
    "compat": "接口测试",
    "接口测试": "接口测试",
    "功能测试": "功能测试",
    "边界测试": "边界测试",
    "逻辑测试": "逻辑测试",
    "性能测试": "性能测试",
}

MODULE_NAMES = {
    "功能测试": "功能测试用例",
    "边界测试": "边界测试用例",
    "接口测试": "接口与异常测试用例",
    "性能测试": "性能测试用例",
    "逻辑测试": "逻辑测试用例",
}

COVERAGE_UNAVAILABLE = "未采集"

STATUS_TEXT = {
    "passed": "通过",
    "partial": "部分通过（有未执行用例）",
    "failed": "失败",
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


def case_project_name(result: dict, run_path: Path) -> str:
    project = result.get("project")
    if isinstance(project, str) and project:
        return Path(project).name
    return "项目"


def build_test_index(result: dict) -> dict:
    """func -> outcome，只来自 runner 从 junit 解析的逐条结果。"""
    index = {}
    for item in result.get("tests") or []:
        func = str(item.get("func") or "")
        if func:
            index[func] = item
    return index


def main() -> int:
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
    test_index = build_test_index(result)
    not_run_reasons = {
        str(item.get("caseId") or ""): str(item.get("reason") or "未执行")
        for item in (result.get("notRun") or [])
    }

    out_path = Path(args.out) if args.out else default_out(run_path)
    log_file = Path(args.log) if args.log else (run_path.parent / "run.log")

    # ── 按类型分组 ──
    modules: dict[str, list] = {}
    for case in cases:
        ctype = TYPE_MAP.get(case.get("testType", ""), "功能测试")
        modules.setdefault(ctype, []).append(case)

    module_list = []
    total = passed = failed = not_run_count = unconfirmed = 0

    for ctype, case_list in modules.items():
        cases_out = []
        for case in case_list:
            case_id = str(case.get("caseId") or "")
            func = str(case.get("testFunc") or "")
            total += 1

            if case_id in not_run_reasons:
                status = "notRun"
                reason = not_run_reasons[case_id]
            elif case_id not in executed:
                status = "notRun"
                reason = "本次执行未包含该用例"
            else:
                evidence = test_index.get(func) if func else None
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
                        reason = str(evidence.get("message") or "") or f"pytest 判定 {outcome}"
                    else:
                        status = "unconfirmed"
                        reason = f"pytest 判定 {outcome}"

            if status == "passed":
                passed += 1
            elif status == "failed":
                failed += 1
            elif status == "unconfirmed":
                unconfirmed += 1
            else:
                not_run_count += 1

            cases_out.append({
                "id": case_id,
                "name": case.get("title", case_id),
                "type": TYPE_MAP.get(case.get("testType", ""), "功能测试"),
                "description": case.get("description", ""),
                "funcDesc": (case.get("codeRef", "").split("#")[0].split("/")[-1] if case.get("codeRef") else case_id),
                "testFunc": func,
                "stub": "无",
                "inserted": "无",
                "inputs": [["输入", case.get("input", "见用例描述")]],
                "outputs": [["预期输出", case.get("expected", ""), case.get("expected", "")]],
                "passed": status == "passed",
                "status": status,
                "issue": reason or "无",
                "bugId": "无",
                "executedAt": result.get("startedAt", ""),
            })

        module_list.append({
            "name": MODULE_NAMES.get(ctype, f"{ctype}用例"),
            "trace": f"runs/{run_id}/run.log",
            "driver": "pytest",
            "coverage": COVERAGE_UNAVAILABLE,
            "issues": "无。" if all(c["status"] == "passed" for c in cases_out) else "存在未通过 / 未执行 / 未确认用例。",
            "inconsistent": "无。",
            "cases": cases_out,
        })

    report = {
        "meta": {
            "project": f"{case_project_name(result, run_path)} 单元测试",
            "executedAt": result.get("startedAt", ""),
            "executor": "pytest / Python",
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