"""bridge.py: 把「某一次真实执行」的执行结果转换成报告工具需要的数据 (v2 格式)。

v2 变化：
- 按阶段（phase）→ 函数（function）→ 用例（case）组织，替代旧的 modules（按测试类型）
- 新增 provenance、scope、coverage、reviews、issues、consistency、regressions 顶层字段
- 覆盖率标签修正：行 -L（旧版错误地用了 -S），语句 -S，分支 -B，块 -BK
- 阶段划分：按被测函数随机分配到 3-4 个阶段，用例数尽量平衡（贪心）

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
import hashlib
import json
import random
import sys
from datetime import datetime, timezone
from pathlib import Path

# ── 常量 ────────────────────────────────────────────────────────

TYPE_MAP = {
    "functional": "功能测试",
    "api": "接口测试",
    "boundary": "边界测试",
    "logic": "逻辑测试",
    "performance": "性能测试",
    "功能测试": "功能测试",
    "接口测试": "接口测试",
    "边界测试": "边界测试",
    "逻辑测试": "逻辑测试",
    "性能测试": "性能测试",
}

BRIDGE_VERSION = "2.0.0"
COVERAGE_UNAVAILABLE = "未采集"

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


# ── 通用工具函数（保留自 v1）───────────────────────────────────

def _force_utf8_output() -> None:
    """中文 Windows 下 stderr 被管道接住时默认 cp936，调用方按 UTF-8 解码会炸。"""
    for stream in (sys.stdout, sys.stderr):
        try:
            stream.reconfigure(encoding="utf-8", errors="replace")
        except Exception:
            pass


def coverage_text(result: dict) -> str:
    """把 result.json 里的真实覆盖率统计写成模板那一行。

    v2 修正：
    - -L 用于行覆盖率（旧版错误地用了 -S）
    - -S 用于语句覆盖率
    - -B 用于分支覆盖率
    - -BK 用于块覆盖率

    数据来源：runner 执行时解析出来并写进 result["coverage"] 的统计块。
    没有数据就写「未采集」并附上原因 —— 绝不自己编一个数字。
    """
    cov = result.get("coverage")
    if not isinstance(cov, dict) or not cov.get("available"):
        reason = ""
        if isinstance(cov, dict):
            reason = str(cov.get("reason") or "").strip()
        text = f"{COVERAGE_UNAVAILABLE}（{reason}）" if reason else COVERAGE_UNAVAILABLE
        return text[:200]

    parts = []
    line = cov.get("line") or {}
    statement = cov.get("statement") or {}
    branch = cov.get("branch") or {}
    block = cov.get("block") or {}

    if line.get("total"):
        parts.append(f"-L {line.get('percent')}%")
    if statement.get("total"):
        parts.append(f"-S {statement.get('percent')}%")
    if branch.get("total"):
        parts.append(f"-B {branch.get('percent')}%")
    if block.get("total"):
        parts.append(f"-BK {block.get('percent')}%")

    return (" ".join(parts) if parts else COVERAGE_UNAVAILABLE)[:200]


def load_cases(path: Path) -> list:
    """兼容裸数组与 {cases: [...]} 两种形态。"""
    raw = path.read_text(encoding="utf-8-sig")
    data = json.loads(raw)
    if isinstance(data, list):
        return data
    if isinstance(data, dict) and isinstance(data.get("cases"), list):
        return data["cases"]
    return []


# 项目配置文件解析统一在 config_file.py（bridge / cmd 共用一份实现）。
from config_file import load_key_values as load_config  # noqa: E402


# 圈复杂度：优先用本机 lizard，没有就用 testReport 自带的 vendor 副本。
# 实现集中在 complexity.py（CLI 与 bridge 共用一份）。
from complexity import analyze as analyze_complexity
from complexity import load_lizard



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
    """从 result.project 提取项目名。"""
    project = result.get("project")
    if isinstance(project, str) and project:
        return Path(project).name
    return "未记录项目"


def build_test_index(result: dict) -> tuple:
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
    """构建 [[name, expected, actual], ...] 输出变量列表。"""
    expected = named_values(case.get("expectedOutputs"))
    values = evidence.get("actualOutputs") if isinstance(evidence, dict) else None
    if not isinstance(values, dict):
        values = {}
    # 旧 ACTUAL 标记只是一条未命名原始值；仅当用例明确只有一个输出变量时才能对应。
    if len(expected) == 1 and expected[0][0] not in values and evidence and isinstance(evidence.get("actual"), str):
        values = {**values, expected[0][0]: evidence["actual"]}
    return [[name, wanted, values[name] if isinstance(values.get(name), str) else "未采集"]
            for name, wanted in expected]


# ── v2 新增函数 ─────────────────────────────────────────────────

def extract_function_id(case_id: str) -> str:
    """从 caseId 提取 functionId。

    例: BJ-ZZKZ-RINGBUFFER-T002.CTD → RINGBUFFER
    取第三段（按 '-' 分割后 index 2）。
    """
    if not case_id:
        return ""
    parts = case_id.split("-")
    if len(parts) >= 3:
        return parts[2]
    return ""


def derive_subject_function(case: dict) -> str:
    """推导被测函数名。

    优先级:
    1. case.subjectFunction 字段（如已提供）
    2. 从 caseId 提取第三段
    3. 用 testFunc 作为兜底
    """
    sf = str(case.get("subjectFunction") or "").strip()
    if sf:
        return sf
    fid = extract_function_id(str(case.get("caseId") or ""))
    if fid:
        return fid
    return str(case.get("testFunc") or "未提供")


def group_cases_by_function(cases: list) -> dict:
    """将用例按被测函数分组。

    返回 {functionName: [case, ...], ...}。
    """
    groups: dict[str, list] = {}
    for case in cases:
        func = derive_subject_function(case)
        groups.setdefault(func, []).append(case)
    return groups


def generate_phase_plan(function_groups: dict, phase_count: int, seed: int) -> dict:
    """贪心算法：把函数（按用例数降序）轮流分到用例数最少的阶段。

    function_groups: {functionName: [case, ...], ...}
    phase_count: 目标阶段数
    seed: 随机种子（用于确定 phase_count 和函数排序内的平局）
    """
    rng = random.Random(seed)

    # 按用例数降序排列；用例数相同时按函数名字典序（稳定）
    sorted_funcs = sorted(
        function_groups.items(),
        key=lambda kv: (-len(kv[1]), kv[0])
    )

    # 初始化阶段
    phases = [
        {"case_count": 0, "functions": []}
        for _ in range(phase_count)
    ]

    for func_name, func_cases in sorted_funcs:
        # 找到当前用例数最少的阶段；平局时随机打破
        min_count = min(p["case_count"] for p in phases)
        candidates = [i for i, p in enumerate(phases) if p["case_count"] == min_count]
        chosen = candidates[0] if len(candidates) == 1 else rng.choice(candidates)
        phases[chosen]["case_count"] += len(func_cases)
        phases[chosen]["functions"].append(func_name)

    return {
        "schemaVersion": "2.0",
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "seed": seed,
        "phaseCount": phase_count,
        "phases": [
            {
                "phaseId": f"phase-{i + 1}",
                "name": f"第{i + 1}阶段",
                "order": i + 1,
                "functionIds": phases[i]["functions"],
            }
            for i in range(phase_count)
            if phases[i]["functions"]  # 跳过空阶段
        ],
    }


def load_or_create_phase_plan(
    function_groups: dict, run_path: Path, session_root: Path
) -> tuple:
    """加载已有的 report-plan.json，不存在则生成新的。

    返回 (plan_dict, plan_path, seed)。
    保存到 reports/<runId>/report-plan.json。
    """
    run_id = run_path.parent.name
    plan_dir = session_root / "reports" / run_id
    plan_path = plan_dir / "report-plan.json"

    if plan_path.is_file():
        try:
            plan = json.loads(plan_path.read_text(encoding="utf-8"))
            seed = plan.get("seed", 0)
            return plan, plan_path, seed
        except Exception:
            pass  # 损坏了就重新生成

    # 生成新的
    func_count = len(function_groups)
    if func_count <= 1:
        phase_count = 1
    elif func_count == 2:
        phase_count = 2
    else:
        rng = random.Random()
        phase_count = rng.randint(3, min(4, func_count))

    seed = random.randint(0, 2**31 - 1)
    plan = generate_phase_plan(function_groups, phase_count, seed)

    plan_dir.mkdir(parents=True, exist_ok=True)
    plan_path.write_text(json.dumps(plan, ensure_ascii=False, indent=2), encoding="utf-8")

    return plan, plan_path, seed


def build_coverage_object(result: dict) -> dict:
    """从 result.json.coverage 构建 v2 格式的 structured coverage 对象。"""
    cov = result.get("coverage")
    if not isinstance(cov, dict) or not cov.get("available"):
        reason = ""
        if isinstance(cov, dict):
            reason = str(cov.get("reason") or "").strip()
        return {
            "available": False,
            "reason": reason or "未采集",
            "sourceFile": "未提供",
        }

    def _extract(metric: dict | None) -> dict:
        if not isinstance(metric, dict):
            return {}
        return {
            "total": metric.get("total", 0),
            "covered": metric.get("covered", 0),
            "percent": metric.get("percent", 0),
        }

    out = {"available": True}
    for key in ("line", "block", "statement", "branch", "mcdc"):
        block_cov = _extract(cov.get(key))
        if block_cov:  # 无数据的指标不输出，避免下游把空对象当成 0
            out[key] = block_cov
    out["sourceFile"] = str(cov.get("sourceFile") or cov.get("source") or "未提供")
    return out


def compute_sha256(file_path: Path) -> str:
    """计算文件的 SHA-256 哈希。"""
    try:
        return hashlib.sha256(file_path.read_bytes()).hexdigest()
    except Exception:
        return "不可用"


# ── 主逻辑 ──────────────────────────────────────────────────────

def main() -> int:
    _force_utf8_output()
    parser = argparse.ArgumentParser(description="把一次真实执行的结果桥接成报告数据 (v2)")
    parser.add_argument("--cases", default="", help="用例文件；默认用 runs/<runId>/snapshot/cases.json")
    parser.add_argument("--run", required=True, help="该次执行的 runs/<runId>/result.json")
    parser.add_argument("--log", default="", help="该次执行的 runs/<runId>/run.log（可选，仅记录路径）")
    parser.add_argument("--out", default="", help="输出路径，默认 reports/<runId>/report-data.json")
    parser.add_argument("--config", default="", help="项目配置文件（testReport/skills/<工作区>.md），用于填充软件信息与人员")
    args = parser.parse_args()
    config_path = Path(args.config) if args.config else None
    cfg = load_config(config_path)
    if cfg:
        print(f"配置：{config_path}（{len(cfg)} 项）")
    elif args.config:
        print(f"警告：项目配置文件不存在或为空：{args.config}", file=sys.stderr)

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
    session_root = run_path.parent.parent.parent  # runs/<runId>/result.json -> <root>
    overall_status = str(result.get("status") or "")
    executed = set(result.get("cases") or [])
    by_id, by_func = build_test_index(result)
    not_run_reasons = {
        str(item.get("caseId") or ""): str(item.get("reason") or "未执行")
        for item in (result.get("notRun") or [])
    }

    # ── 加载原始用例 JSON 文件（用于校验）──
    cases_raw = None
    if cases_path.is_file():
        try:
            cases_raw = cases_path.read_text(encoding="utf-8-sig")
        except Exception:
            pass

    # ── 按函数分组 ──
    function_groups = group_cases_by_function(cases)

    # ── 加载或生成阶段计划 ──
    phase_plan, plan_path, plan_seed = load_or_create_phase_plan(
        function_groups, run_path, session_root
    )

    # ── 构建 functionId → 阶段 映射 ──
    func_to_phase: dict[str, int] = {}
    for p in phase_plan.get("phases", []):
        for fid in p.get("functionIds", []):
            func_to_phase[fid] = p.get("order", 0)

    # 没在计划里的函数归入最后一个阶段
    last_order = max((p.get("order", 0) for p in phase_plan.get("phases", [])), default=1)

    # ── 按阶段组织函数和用例 ──
    # 初始化阶段结构
    phase_map: dict[int, dict] = {}
    for p in phase_plan.get("phases", []):
        order = p.get("order", 0)
        phase_map[order] = {
            "phaseId": p.get("phaseId", f"phase-{order}"),
            "name": p.get("name", f"第{order}阶段"),
            "order": order,
            "functions": [],
        }

    # 收集所有 sourceFile
    source_files: list[str] = []

    for func_name, func_cases in function_groups.items():
        phase_order = func_to_phase.get(func_name, last_order)
        if phase_order not in phase_map:
            phase_map[phase_order] = {
                "phaseId": f"phase-{phase_order}",
                "name": f"第{phase_order}阶段",
                "order": phase_order,
                "functions": [],
            }

        # ── 构建该函数的用例列表 ──
        cases_out = []
        func_total = func_passed = func_failed = func_not_run = func_unconfirmed = 0

        for case in func_cases:
            case_id = str(case.get("caseId") or "")
            test_func = str(case.get("testFunc") or "")
            func_total += 1
            evidence = None

            if case_id in not_run_reasons:
                status = "notRun"
                reason = not_run_reasons[case_id]
            elif case_id not in executed:
                status = "notRun"
                reason = "本次执行未包含该用例"
            else:
                evidence = by_id.get(case_id)
                if evidence is None and test_func and len(by_func.get(test_func, [])) == 1 and not by_func[test_func][0].get("caseId"):
                    evidence = by_func[test_func][0]
                if evidence is None:
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
                func_passed += 1
            elif status == "failed":
                func_failed += 1
            elif status == "unconfirmed":
                func_unconfirmed += 1
            else:
                func_not_run += 1

            # 构建输入/输出
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

            # 测试类型
            raw_type = case.get("testType", "")
            ctype = TYPE_MAP.get(raw_type, TYPE_MAP.get("functional", "功能测试"))

            cases_out.append({
                "id": case_id,
                "name": case.get("title", case_id),
                "type": ctype,
                "description": "\n".join(part for part in notes if part) or "未提供测试说明",
                "funcDesc": case.get("title") or case_id,
                "testFunc": test_func,
                "subjectFunction": derive_subject_function(case),
                "stub": "未记录",
                "inserted": "未记录",
                "inputs": inputs,
                "outputs": outputs,
                "passed": status == "passed",
                "status": status,
                "notRunReason": reason if status == "notRun" else "",
                "issue": reason or "未记录异常",
                "bugId": "未记录",
                "designer": str(case.get("designer") or cfg.get('designer') or "未提供"),
                "reviewer": str(case.get("reviewer") or cfg.get('reviewer') or "未提供"),
                "tester": str(case.get("tester") or cfg.get('tester') or "未提供"),
                "executedAt": evidence.get("startedAt", "") if evidence and status != "notRun" else "",
            })

        # ── 该函数汇总 ──
        func_all_passed = all(c["status"] == "passed" for c in cases_out)

        func_obj = {
            "functionId": func_name,
            "name": func_name,
            "sourceFile": "未提供",
            "summary": {
                "total": func_total,
                "passed": func_passed,
                "failed": func_failed,
                "notRun": func_not_run,
                "unconfirmed": func_unconfirmed,
            },
            "unitId": func_name,
            "trace": "未提供设计追溯",
            "driver": "未记录驱动模块",
            "coverage": coverage_text(result),
            "cases": cases_out,
        }

        phase_map[phase_order]["functions"].append(func_obj)

    # ── 按 phase order 排序，计算阶段级别的汇总 ──
    phase_list = sorted(phase_map.values(), key=lambda p: p["order"])

    total = passed = failed = not_run_count = unconfirmed = 0
    for phase in phase_list:
        phase_total = phase_passed = phase_failed = phase_not_run = phase_unconfirmed = 0
        for func in phase["functions"]:
            s = func["summary"]
            phase_total += s["total"]
            phase_passed += s["passed"]
            phase_failed += s["failed"]
            phase_not_run += s["notRun"]
            phase_unconfirmed += s["unconfirmed"]
        total += phase_total
        passed += phase_passed
        failed += phase_failed
        not_run_count += phase_not_run
        unconfirmed += phase_unconfirmed

        all_in_phase_passed = phase_passed == phase_total
        phase["phaseIssues"] = (
            f"本阶段共 {len(phase['functions'])} 个函数，{phase_total} 条用例，全部通过。"
            if all_in_phase_passed
            else f"存在未通过、未执行或未确认用例，详见逐条结果。"
        )
        phase["phaseInconsistent"] = "未核查与测试用例或规程的一致性。"

    # ── 排除原因 ──
    excluded_reasons = [
        {"caseId": cid, "reason": reason}
        for cid, reason in not_run_reasons.items()
    ]
    executed_count = passed + failed + unconfirmed

    # ── 构建 v2 报告 ──
    out_path = Path(args.out) if args.out else default_out(run_path)
    log_file = Path(args.log) if args.log else (run_path.parent / "run.log")

    # 圈复杂度：纯静态分析，不需要编译。有 lizard 就跑，没有就如实写“未开展”。
    project_dir = Path(str(result.get("project") or "")) if result.get("project") else run_path.parent.parent.parent.parent
    static_items = analyze_complexity(project_dir) if project_dir and project_dir.is_dir() else []
    _lizard_kind = load_lizard()[1] if static_items else ""
    if _lizard_kind:
        print(f"   圈复杂度：{len(static_items)} 个函数（lizard={_lizard_kind}）")

    report = {
        "schemaVersion": "2.0",
        "meta": {
            "project": (cfg.get('projectName') or case_project_name(result, run_path)) + ' 单元测试',
            "projectPackage": cfg.get('projectPackage') or '未配置',
            "softwareVersion": cfg.get('softwareVersion') or '未配置',
            "devUnit": cfg.get('devUnit') or '未配置',
            "importance": cfg.get('importance') or '未配置',
            "language": cfg.get('language') or str((result.get("runner") or {}).get("language") or '未配置'),
            "references": [
                {'type': '需求文档', 'name': cfg.get('reqDocName') or '', 'version': cfg.get('reqDocVersion') or ''},
                {'type': '设计文档', 'name': cfg.get('designDocName') or '', 'version': cfg.get('designDocVersion') or ''},
            ],
            "people": {
                'designer': cfg.get('designer') or '',
                'reviewer': cfg.get('reviewer') or '',
                'tester': cfg.get('tester') or '',
            },
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
        "provenance": {
            "sessionId": str(session_root.name),
            "runId": run_id,
            "casesSnapshot": compute_sha256(cases_path) if cases_path.is_file() else "不可用",
            "resultSource": str(run_path.resolve()),
            "phasePlanGenerated": phase_plan.get("generatedAt", ""),
            "phasePlanSeed": plan_seed,
            "bridgeVersion": BRIDGE_VERSION,
        },
        "scope": {
            "included": total,
            "excluded": not_run_count,
            "deferred": 0,
            "excludeReasons": excluded_reasons,
            "sourceFiles": source_files,
            "functionCount": len(function_groups),
        },
        "summary": {
            "total": total,
            "passed": passed,
            "failed": failed,
            "notRun": not_run_count,
            "unconfirmed": unconfirmed,
            "executed": executed_count,
            "executionRate": round(executed_count / total * 100, 1) if total > 0 else 0.0,
            "passRate": round(passed / executed_count * 100, 1) if executed_count > 0 else 0.0,
            "skipRate": round(not_run_count / total * 100, 1) if total > 0 else 0.0,
            "totalDurationMs": result.get("durationMs", 0),
        },
        "phases": phase_list,
        "coverage": build_coverage_object(result),
        "reviews": {
            "docReviewDone": False,
            "staticAnalysisDone": bool(static_items),
            "codeReviewDone": False,
            "dynamicTestDone": bool(executed_count > 0),
        },
        "issues": {
            "docIssues": [],
            "staticIssues": [],
            "codeIssues": [],
            "dynamicIssues": [
                {"id": c["id"], "title": c["name"], "severity": "未记录", "status": c["status"]}
                for phase in phase_list
                for func in phase["functions"]
                for c in func["cases"]
                if c["status"] in ("failed", "unconfirmed")
            ],
            "resolvedIssues": [],
        },
        "consistency": {
            "checked": False,
            "discrepancies": [],
        },
        "regressions": {
            "conducted": False,
            "previousRunId": "",
            "notes": "未开展回归测试",
        },
        "staticItems": static_items,
    }

    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")

    print(f"OK {out_path}")
    print(f"   bridgeVersion={BRIDGE_VERSION}")
    print(f"   runId={run_id} status={STATUS_TEXT.get(overall_status, overall_status)}")
    print(f"   phases={len(phase_list)}  functions={len(function_groups)}  cases={total}  "
          f"passed={passed}  failed={failed}  notRun={not_run_count}  unconfirmed={unconfirmed}")
    if result.get("note"):
        print(f"   注意：{result['note']}")
    for phase in phase_list:
        func_names = [f["functionId"] for f in phase["functions"]]
        case_total = sum(f["summary"]["total"] for f in phase["functions"])
        print(f"   [{phase['name']}] {len(phase['functions'])} functions ({', '.join(func_names)}), {case_total} cases")
    return 0


if __name__ == "__main__":
    sys.exit(main())