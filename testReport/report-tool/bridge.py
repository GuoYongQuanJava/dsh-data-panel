"""bridge.py: 把「某一次真实执行」的执行结果转换成报告工具需要的数据 (v2 格式)。

v2 变化：
- 按阶段（phase）→ 函数（function）→ 用例（case）组织，替代旧的 modules（按测试类型）
- 新增 provenance、scope、coverage、reviews、issues、consistency、regressions 顶层字段
- 覆盖率标签修正：行 -L（旧版错误地用了 -S），语句 -S，分支 -B，块 -BK
- 阶段划分：函数按**冻结用例里的首次出现顺序**连续分段（确定性）；旧版随机计划（planVersion<2）丢弃重建
- 报告顺序：functionOrder → sequenceNumber（数字比较）→ caseId；同一函数连续、函数内 T001→T002→T003

用法:
    python bridge.py --cases <会话>/cases.json \
                     --run   <会话>/runs/<runId>/result.json \
                     [--log  <会话>/runs/<runId>/run.log] \
                     [--out  <会话>/reports/<runId>/report-data.json]

然后交给报告工具:
    python report-tool/cmd.py --template ... --data report-data.json -o <会话>/reports/<runId>/<项目>-测试报告.docx

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
import re
import sys
import xml.etree.ElementTree as ET
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

# 2.1.0：确定性阶段计划（planVersion 2）+ 全类型变量取值 + 输入输出分栅 + 字段完整性统计。
BRIDGE_VERSION = "2.1.0"
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


# 注：v1 时代用 coverage_text() 把运行整体覆盖率拼成 -L/-BK 字符串写进每个函数，
# 那是把项目级数字复制到函数，v2 已取消。运行整体数据在顶层 coverage 对象里，
# 由 builder 直接渲染到表 3；函数级只写「本次未按函数拆分采集」。



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
from complexity import comment_ratio
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


def display_value(value: object) -> str:
    """把任意 JSON 值转成报告里的显示文本。

    规则（与 Skill 约定一致）：字符串用原值；数字转十进制文本；布尔 true/false；
    null 写 null；数组/对象用 JSON 文本。

    为什么必须在这里统一做：以前只接受字符串，输入值 0、false、null 和数组/对象会被
    静默丢掉，报告里就变成了「未提供」—— 那是最容易失真的地方。
    """
    if isinstance(value, str):
        return value
    if value is None:
        return "null"
    if isinstance(value, bool):
        return "true" if value else "false"
    if isinstance(value, (int, float)):
        return str(value)
    if isinstance(value, (list, dict)):
        try:
            return json.dumps(value, ensure_ascii=False)
        except (TypeError, ValueError):
            return str(value)
    return str(value)


def named_values(value: object) -> list:
    """只接受用例里明确声明的变量名和值（不从自由文本猜测），值统一转成显示文本。"""
    if not isinstance(value, list):
        return []
    out: list = []
    for item in value:
        if not isinstance(item, dict):
            continue
        name = item.get("name")
        if not isinstance(name, str) or not name:
            continue
        if "value" not in item:
            continue
        out.append([name, display_value(item.get("value"))])
    return out


def actual_outputs(case: dict, evidence: dict | None) -> list:


    """构建 [[name, expected, actual], ...] 输出变量列表。"""
    expected = named_values(case.get("expectedOutputs"))
    values = evidence.get("actualOutputs") if isinstance(evidence, dict) else None
    # 实际输出与 expectedOutputs 同为 [{name, value}] 列表；同时兼容旧版字典写法
    actual_map: dict = {}
    if isinstance(values, list):
        actual_map = {name: value for name, value in named_values(values)}
    elif isinstance(values, dict):
        actual_map = {name: display_value(value) for name, value in values.items()
                      if isinstance(name, str)}
    # 旧 ACTUAL 标记只是一条未命名原始值；仅当用例明确只有一个输出变量时才能对应。
    if len(expected) == 1 and expected[0][0] not in actual_map and evidence and isinstance(evidence.get("actual"), str):
        actual_map = {**actual_map, expected[0][0]: evidence["actual"]}
    # 实际输出缺失就写「未采集」：那是缺失项，不能用手填值或预期值冒充。
    return [[name, wanted, actual_map.get(name, "未采集")]
            for name, wanted in expected]


EXC_LABELS = {
    "AssertionError": "断言失败",
    "ZeroDivisionError": "除零错误",
    "TypeError": "类型错误",
    "ValueError": "取值错误",
    "KeyError": "缺少键",
    "IndexError": "下标越界",
    "AttributeError": "属性不存在",
    "FileNotFoundError": "文件不存在",
    "ImportError": "导入失败",
    "RuntimeError": "运行时错误",
    "OverflowError": "数值溢出",
    "TimeoutError": "执行超时",
}

_EXC_RE = re.compile(r"\b([A-Z][A-Za-z]*(?:Error|Exception))\b")
_FILE_LINE_RE = re.compile(
    r"((?:[A-Za-z]:)?[\w./\\-]+\.(?:cpp|cc|cxx|c|hpp|h|py|js|ts|tsx|go|rs|java|cs|rb|php)):(\d+)")


def failure_location(text: str) -> str:
    """从异常文本里取出「文件:行号」，取不到返回空串。"""
    match = _FILE_LINE_RE.search(text or "")
    return f"{match.group(1)}:{match.group(2)}" if match else ""


def cn_time(value: object) -> str:
    """ISO 时间 → 报告用的 `YYYY/MM/DD HH:MM`；解析不了原样返回。"""
    text = str(value or "").strip()
    if not text:
        return ""
    try:
        moment = datetime.fromisoformat(text.replace("Z", "+00:00"))
    except ValueError:
        return text
    if moment.tzinfo is not None:
        moment = moment.astimezone()
    return moment.strftime("%Y/%m/%d %H:%M")


def summarize_failure(evidence: dict | None, fallback: str = "") -> str:
    """把英文断言/异常原文压成一句中文，并带上证据位置。

    认得 GoogleTest 的 Expected equality / Value of 块和常见异常类型；认不出来
    时保留原文首行——只改写表述，不推测原因。
    """
    if not isinstance(evidence, dict):
        return fallback or "未记录异常"
    text = str(evidence.get("detail") or evidence.get("message") or "")
    if not text:
        return fallback or "未记录异常"
    location = failure_location(text)
    suffix = f"（证据：{location}）" if location else ""
    lines = [line.strip() for line in text.splitlines() if line.strip()]

    # GoogleTest: Expected equality of these values: / 0.00 / Which is: 0 / pay / Which is: -180
    if any("Expected equality of these values" in line for line in lines):
        names, values = [], []
        for line in lines:
            if line.startswith("Which is:"):
                if names:
                    values.append(line.split(":", 1)[1].strip())
                continue
            if "Expected equality" in line or line.startswith(("Failure", "error")):
                continue
            if _FILE_LINE_RE.search(line):
                continue
            names.append(line)
        if len(names) >= 2 and len(values) >= 2:
            return f"断言失败：{names[1]} 期望 {names[0]}，实际 {values[1]}{suffix}"

    # GoogleTest: Value of: x / Actual: 1 / Expected: 2
    value_of = next((l for l in lines if l.startswith("Value of:")), "")
    expected = next((l for l in lines if l.startswith("Expected:")), "")
    actual = next((l for l in lines if l.startswith("Actual:")), "")
    if expected and actual:
        target = value_of.split(":", 1)[1].strip() if value_of else "结果"
        return (f"断言失败：{target} 期望 {expected.split(':', 1)[1].strip()}，"
                f"实际 {actual.split(':', 1)[1].strip()}{suffix}")

    # 常见异常类型
    match = _EXC_RE.search(text)
    if match:
        label = EXC_LABELS.get(match.group(1), "异常")
        rest = text.replace(match.group(0), "", 1).strip().splitlines()
        brief = rest[0].strip(" :：") if rest else ""
        return f"{label}：{brief or match.group(1)}{suffix}"

    # pytest 的裸 assert
    first = lines[0] if lines else ""
    if first.startswith("assert ") or " assert " in first:
        return f"断言失败：{first}{suffix}"
    return f"测试判定失败：{first or '未记录'}{suffix}"


def short_function_name(name: object) -> str:
    """从 subjectFunction 取函数短名：`src/order.cpp::Order::payable` → `payable`。"""
    text = str(name or "").strip()
    if "::" in text:
        text = text.rsplit("::", 1)[-1].strip()
    if "/" in text or "\\" in text:
        text = re.split(r"[/\\]", text)[-1].strip()
    return text


def _unit_label(name: object) -> str:
    """单元标识：函数短名 + 「单元测试」，如 `pickPWL单元测试`。"""
    short = short_function_name(name) or "未记录单元标识"
    return short if short.endswith("单元测试") else f"{short}单元测试"


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


# 阶段计划版本：1 = 旧版（随机阶段），2 = 确定性排序。旧版本一律丢弃重建。
PHASE_PLAN_VERSION = 2

_SEQUENCE_RE = re.compile(r"-T(\d+)", re.IGNORECASE)


def case_sequence_number(case: dict) -> int:
    """用例在函数内的数字序号：优先 `sequence` 字段（T003），其次 caseId 里的 `-T003`。

    必须按**数字**比较：字符串排序会把 T010 排到 T002 前面。
    解不出来返回 0（排在可解析的后面，最终仍用 caseId 兜底）。
    """
    raw = str(case.get("sequence") or "").strip()
    match = re.fullmatch(r"[Tt]?(\d+)", raw) if raw else None
    if match is None:
        match = _SEQUENCE_RE.search(str(case.get("caseId") or ""))
    if match is None:
        return 0
    try:
        return int(match.group(1))
    except (TypeError, ValueError):
        return 0


def sort_function_cases(cases: list) -> list:
    """函数内排序：sequenceNumber（数字）→ caseId。"""
    return sorted(cases, key=lambda case: (case_sequence_number(case), str(case.get("caseId") or "")))


def ordered_functions(function_groups: dict) -> list:
    """函数顺序：显式 functionOrder → 冻结用例里的首次出现顺序。"""
    entries = list(function_groups.items())
    explicit_any = any(
        isinstance(case.get("functionOrder"), int)
        for cases in function_groups.values()
        for case in cases
    )
    if not explicit_any:
        # dict 保留插入顺序 = 用例在快照里第一次出现的顺序，直接用它。
        return [name for name, _ in entries]

    def key(pair):
        _name, cases = pair
        explicit = min(
            (case["functionOrder"] for case in cases if isinstance(case.get("functionOrder"), int)),
            default=None,
        )
        # 没有显式顺序的排后面，但仍按首次出现顺序（sorted 稳定）。
        return (0, explicit) if explicit is not None else (1, 0)

    return [name for name, _ in sorted(entries, key=key)]


def build_phase_plan(function_groups: dict) -> dict:
    """确定性阶段计划：函数连续分段，绝不把同一个函数拆到多个 Sprint。

    旧实现按用例数贪心装桶 + 随机 seed，导致同一份快照两次生成报告顺序不同。
    现在只依赖冻结用例的首次出现顺序，结果完全可复现。
    """
    names = ordered_functions(function_groups)
    count = len(names)
    if count <= 4:
        phase_count = 1
    else:
        # 与模板“Sprint1..3”一致，且完全确定。
        phase_count = min(3, count)
    chunks: list[list[str]] = [[] for _ in range(phase_count)]
    for index, name in enumerate(names):
        chunk = min(index * phase_count // max(count, 1), phase_count - 1)
        chunks[chunk].append(name)
    phases = [
        {
            "phaseId": f"phase-{i + 1}",
            "name": f"Sprint{i + 1}",
            "order": i + 1,
            "functionIds": chunk,
        }
        for i, chunk in enumerate(chunks)
        if chunk
    ]
    return {
        "schemaVersion": "2.0",
        "planVersion": PHASE_PLAN_VERSION,
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "phaseCount": len(phases),
        # 冻结函数顺序：下次只有它没变时才复用这份计划。
        "functionOrder": names,
        "phases": phases,
    }


def load_or_create_phase_plan(
    function_groups: dict, run_path: Path, session_root: Path
) -> tuple:
    """加载或生成阶段计划（确定性）。

    复用条件：planVersion 匹配且冻结的函数顺序没变。旧版随机计划（planVersion<2）、
    函数集合变化的计划，一律丢弃重建 —— 旧随机结果不得继续控制新报告。
    返回 (plan_dict, plan_path, plan_version)。
    """
    run_id = run_path.parent.name
    plan_dir = session_root / "reports" / run_id
    plan_path = plan_dir / "report-plan.json"
    names = ordered_functions(function_groups)

    if plan_path.is_file():
        try:
            plan = json.loads(plan_path.read_text(encoding="utf-8"))
            if plan.get("planVersion") == PHASE_PLAN_VERSION and plan.get("functionOrder") == names:
                return plan, plan_path, PHASE_PLAN_VERSION
        except Exception:
            pass  # 损坏了就重建

    plan = build_phase_plan(function_groups)
    plan_dir.mkdir(parents=True, exist_ok=True)
    plan_path.write_text(json.dumps(plan, ensure_ascii=False, indent=2), encoding="utf-8")
    return plan, plan_path, PHASE_PLAN_VERSION




STATUS_TEXT_SCOPE = {
    'tested': '已纳入测试',
    'excluded': '已排除',
    'declaration': '仅声明',
    'deferred': '尚未处理',
}


def build_source_scope(result: dict) -> dict:
    """把 prepare 冻结的 testScope 整理成报告能直接渲染的源码范围。

    只搬运本次 run 的真实记录，不重新扫描、不猜结论。
    """
    ts = result.get('testScope') if isinstance(result, dict) else None
    if not isinstance(ts, dict) or not ts:
        return {'available': False, 'reason': '本次执行没有范围清单（scope.json）'}
    ts_status = str(ts.get('status') or '')
    if ts_status in ('missing', 'invalid'):
        return {'available': False, 'reason': f'范围清单状态为 {ts_status}，不可用'}
    inventory = ts.get('inventory') if isinstance(ts.get('inventory'), dict) else {}
    if not inventory.get('files'):
        return {'available': False, 'reason': '范围清单没有有效文件记录'}
    files = []
    for item in inventory.get('files') or []:
        if not isinstance(item, dict):
            continue
        proof = item.get('proof') if isinstance(item.get('proof'), dict) else {}
        status = str(item.get('status') or 'deferred')
        files.append({
            'path': str(item.get('path') or ''),
            'status': status,
            'statusText': STATUS_TEXT_SCOPE.get(status, status),
            'reason': str(item.get('reason') or ''),
            'functionCount': len(item.get('functions') or []),
            'exitCode': proof.get('exitCode'),
            'logFile': str(proof.get('logFile') or ''),
        })
    return {
        'available': True,
        'sourceRoots': [str(x) for x in (inventory.get('sourceRoots') or [])],
        'summary': ts.get('summary') if isinstance(ts.get('summary'), dict) else {},
        'status': str(ts.get('status') or ''),
        'files': files,
        'warnings': [str(x) for x in (ts.get('warnings') or [])],
        'rawWarnings': [str(x) for x in (ts.get('rawWarnings') or ts.get('warnings') or [])],
    }


FUNCTION_COVERAGE_UNAVAILABLE = '本次未按函数拆分采集'


def load_function_coverage(result: dict) -> dict:
    """从本次 coverage.xml 读**函数级**行/块覆盖率，返回 {别名: '-L 80.0% (4/5) -BK 60.0% (3/5)'}。

    VS 的 coverage.xml 里 <function> 节点自带 line_coverage / block_coverage，
    这是函数自己的真实数字（不是把项目级抄下来）。没有报告、解析失败或没有可用
    数字时返回空 dict，调用方继续写占位说明——不推测、不造假。
    """
    cov = result.get('coverage')
    if not isinstance(cov, dict) or not cov.get('available'):
        return {}
    xml_path = str(cov.get('sourceFile') or cov.get('source') or '').strip()
    if not xml_path or not Path(xml_path).is_file():
        return {}
    try:
        root = ET.parse(xml_path).getroot()
    except Exception as exc:  # 解析失败不能让报告生成失败
        print(f'   函数级覆盖率：解析 {Path(xml_path).name} 失败（{exc}），保持未拆分说明')
        return {}

    table: dict = {}
    ambiguous: set = set()

    def _put(alias: str, text: str) -> None:
        alias = alias.strip()
        if not alias:
            return
        if alias in table and table[alias] != text:
            ambiguous.add(alias)   # 同名函数口径不一致，不猜
        else:
            table[alias] = text

    def _span(covered, not_covered) -> str:
        if str(covered).isdigit() and str(not_covered).isdigit():
            total = int(covered) + int(not_covered)
            return f'({covered}/{total})'
        return ''

    for func in root.iter('function'):
        # VS 的 name 可能带参数，如 round2(double) → round2
        raw_name = (func.get('name') or '').split('(', 1)[0].strip()
        if not raw_name:
            continue
        try:
            line_pct = float(func.get('line_coverage')) if func.get('line_coverage') is not None else None
            block_pct = float(func.get('block_coverage')) if func.get('block_coverage') is not None else None
        except (TypeError, ValueError):
            continue

        parts = []
        if line_pct is not None:
            parts.append(f"-L {line_pct:.1f}% {_span(func.get('lines_covered'), func.get('lines_not_covered'))}".strip())
        if block_pct is not None:
            parts.append(f"-BK {block_pct:.1f}% {_span(func.get('blocks_covered'), func.get('blocks_not_covered'))}".strip())
        text = ' '.join(p for p in parts if p)
        if not text:
            continue

        type_name = (func.get('type_name') or '').strip()
        _put(raw_name, text)                       # addLine
        if type_name:
            _put(f'{type_name}::{raw_name}', text)   # Order::addLine（VS 原生）
            _put(f'{type_name}.{raw_name}', text)    # Order.addLine（subjectFunction 常见写法）

    for alias in ambiguous:
        table.pop(alias, None)
    return table


def lookup_function_coverage(table: dict, subject: str) -> str:
    """按 subjectFunction 查函数级覆盖率；匹配不到返回空串。

    subjectFunction 常见三种写法：
      src/order.cpp::Order::addLine
      src/order.cpp::Order.addLine
      addLine
    """
    text = str(subject or '').strip()
    if not table or not text:
        return ''
    parts = [p for p in text.split('::') if p]
    candidates = []
    if len(parts) >= 2:
        candidates.append('::'.join(parts[-2:]))        # Order::addLine
        candidates.append('.'.join(parts[-2:]))         # Order.addLine
    if parts:
        candidates.append(parts[-1])                   # addLine
        bare = parts[-1].split('.')[-1]
        candidates.append(bare)                        # addLine（再去一层类名）
    for key in candidates:
        if key in table:
            return table[key]
    return ''

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

    # 函数级覆盖率：从本次 coverage.xml 的 <function> 节点读，供每个函数行使用
    function_coverage = load_function_coverage(result)
    if function_coverage:
        print(f"   函数级覆盖率：读到 {len(function_coverage)} 个函数别名")

    # ── 加载或生成阶段计划 ──
    phase_plan, plan_path, plan_version = load_or_create_phase_plan(
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
            "name": p.get("name", f"Sprint{order}"),
            "order": order,
            "functions": [],
        }

    # 收集所有 sourceFile
    source_files: list[str] = []
    # 字段完整性统计：缺结构化输入/预期/实际各多少条，多少条被误写进测试说明。
    # 报告可以出，但必须把这些缺失项明明白白列出来，不能静默错位。
    completeness = {
        "total": 0,
        "missingInputs": 0,
        "missingOutputs": 0,
        "missingActual": 0,
        "leakedIntoDescription": 0,
    }

    for func_name, func_cases in function_groups.items():
        phase_order = func_to_phase.get(func_name, last_order)
        if phase_order not in phase_map:
            phase_map[phase_order] = {
                "phaseId": f"phase-{phase_order}",
                "name": f"Sprint{phase_order}",
                "order": phase_order,
                "functions": [],
            }

        # ── 构建该函数的用例列表 ──
        cases_out = []
        func_total = func_passed = func_failed = func_not_run = func_unconfirmed = 0

        # 函数内按 sequenceNumber（数字）→ caseId 排序：T001 → T002 → T003，不能按字符串排。
        for case in sort_function_cases(func_cases):
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

            # ── 输入 / 预期 / 实际：各放各自的表格列，绝不塞进测试说明 ──
            structured_inputs = named_values(case.get("inputVariables"))
            structured_outputs = named_values(case.get("expectedOutputs"))
            inputs = list(structured_inputs)
            outputs = actual_outputs(case, evidence if case_id in executed and status != "notRun" else None)
            if status == "notRun":
                for output in outputs:
                    output[2] = "未执行"

            raw_input = str(case.get("input") or "").strip()
            raw_expected = str(case.get("expected") or "").strip()
            if not inputs and raw_input:
                # 缺结构化输入：原始输入进「输入」栅，不追加到测试说明。
                inputs = [["原始输入", raw_input]]
            if not outputs and raw_expected:
                outputs = [["预期结果", raw_expected, "未执行" if status == "notRun" else "未采集"]]
            elif not outputs and evidence and evidence.get("actual") and status != "notRun":
                outputs = [["实际输出", "", display_value(evidence["actual"])]]
            # 有原始实际输出但没有结构化变量：填进同一行的「实际输出」列，而不是写进说明。
            if status != "notRun" and isinstance(evidence, dict) and evidence.get("actual"):
                if len(outputs) == 1 and outputs[0][0] == "预期结果" and outputs[0][2] == "未采集":
                    outputs[0][2] = display_value(evidence["actual"])

            # 额外实际输出：新格式为 [{name,value}] 列表，旧格式为字典，两种都兼容
            actual_extra = evidence.get("actualOutputs") if isinstance(evidence, dict) else None
            if status != "notRun" and actual_extra:
                if isinstance(actual_extra, list):
                    extra_pairs = named_values(actual_extra)
                elif isinstance(actual_extra, dict):
                    extra_pairs = [[name, display_value(value)] for name, value in actual_extra.items()
                                   if isinstance(name, str)]
                else:
                    extra_pairs = []
                known_names = {output[0] for output in outputs}
                for name, value in extra_pairs:
                    if name not in known_names:
                        outputs.append([name, "", value])

            # 测试说明只放场景说明：输入 / 预期 / 实际一律不进这里。
            notes = [str(case.get("description") or "")]

            # ── 字段完整性统计：报告要能明确列出缺失项，而不是静默错位 ──
            completeness["total"] += 1
            if not structured_inputs:
                completeness["missingInputs"] += 1
            if not structured_outputs:
                completeness["missingOutputs"] += 1
            if any(len(output) >= 3 and output[2] in ("未采集", "未执行") for output in outputs):
                completeness["missingActual"] += 1
            if any(token in "\n".join(notes) for token in (
                "输入条件（原始记录）", "预期结果（原始记录）", "其他实际输出（运行记录）",
            )):
                completeness["leakedIntoDescription"] += 1

            # 测试类型
            raw_type = case.get("testType", "")
            ctype = TYPE_MAP.get(raw_type, TYPE_MAP.get("functional", "功能测试"))

            # 异常现象描述用中文摘要（问题 2），原始英文/断言细节仍可作为证据位置保留。
            if status == "passed":
                issue_text = "无"
                issue_evidence = ""
            elif status == "notRun":
                issue_text = f"未执行：{reason}" if reason else "未执行"
                issue_evidence = ""
            elif status == "unconfirmed":
                issue_text = f"未能确认：{reason or '没有该用例的逐条执行结果'}"
                issue_evidence = failure_location(str((evidence or {}).get("detail") or "")) if evidence else ""
            else:
                issue_text = summarize_failure(evidence, reason)
                raw_detail = str((evidence or {}).get("detail") or (evidence or {}).get("message") or "")
                issue_evidence = failure_location(raw_detail)

            # 执行时间：先用例级 startedAt，没有就用本次 run 的开始时间（问题 6）。
            raw_started = ""
            if status != "notRun":
                raw_started = str((evidence or {}).get("startedAt") or result.get("startedAt") or "")
            case_executed_at = cn_time(raw_started)

            cases_out.append({
                "id": case_id,
                # 函数内编号（T001）：Word 里与名称分开显示，排序也靠它。
                "sequence": str(case.get("sequence") or ""),
                "sequenceNumber": case_sequence_number(case),
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

                "issue": issue_text,
                "issueEvidence": issue_evidence,
                "bugId": "未记录",
                "designer": str(case.get("designer") or cfg.get('designer') or "未提供"),
                "reviewer": str(case.get("reviewer") or cfg.get('reviewer') or "未提供"),
                "tester": str(case.get("tester") or cfg.get('tester') or "未提供"),
                "executedAt": case_executed_at,
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
            "unitId": _unit_label(func_name),
            "trace": "未提供设计追溯",
            "driver": "未记录驱动模块",
            # 函数级覆盖率：优先用本次 coverage.xml 里**该函数自己**的数字；
            # 匹配不到才写占位说明，绝不把项目级数字抄到函数上。
            # 运行整体覆盖率仍在顶层 coverage 里给。
            "coverage": (lookup_function_coverage(function_coverage, func_name)
                         or FUNCTION_COVERAGE_UNAVAILABLE),
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
    # 用 subjectFunction 里的相对路径当提示，把「工作区根」收敛到真正被測的工程目录
    source_hints = []
    for case in cases:
        subject = str(case.get('subjectFunction') or '').strip()
        rel = subject.split('::')[0].strip() if '::' in subject else ''
        if rel and ('/' in rel or '\\' in rel) and rel not in source_hints:
            source_hints.append(rel)
    static_items = analyze_complexity(project_dir, source_hints) if project_dir and project_dir.is_dir() else []
    _lizard_kind = load_lizard()[1] if static_items else ""
    if _lizard_kind:
        print(f"   圈复杂度：{len(static_items)} 个函数（lizard={_lizard_kind}）")
    # 注释率：3.1 总体评估的固定话术要用到，读源码算真实值。
    comment_rate = comment_ratio(project_dir, source_hints) if project_dir and project_dir.is_dir() else None
    if comment_rate is not None:
        print(f"   代码注释率：{comment_rate}%")

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
            # 3.1 总体评估需要「起止日期」，所以两个都带上（单次运行它们通常同一天）
            "finishedAt": result.get("finishedAt", ""),
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
            "phasePlanVersion": plan_version,
            "bridgeVersion": BRIDGE_VERSION,
        },
        "scope": {
            "included": total,
            "excluded": not_run_count,
            "deferred": 0,
            "excludeReasons": excluded_reasons,
            "sourceFiles": source_files,
            "functionCount": len(function_groups),
            # 源码范围（来自 prepare 冻结的 testScope）：哪些文件纳入/排除及证据
            "sourceScope": build_source_scope(result),
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
        # 字段完整性统计：缺结构化输入/预期/实际多少条、被误写进说明多少条。
        # 报告可以出，但必须把这些缺失项列出来（不能静默错位）。
        "completeness": completeness,
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
                {
                    "id": c["id"],
                    "title": c["name"],
                    "severity": "一般",
                    "status": c["status"],
                    # 中文摘要 + 证据位置：附录问题单直接拿这两项填。
                    "description": c.get("issue") or "",
                    "evidence": c.get("issueEvidence") or "",
                    "suggestion": "请排查定位并修复后回归验证。",
                }
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
        "staticMetrics": {"commentRate": comment_rate},
    }

    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")

    print(f"OK {out_path}")
    print(f"   bridgeVersion={BRIDGE_VERSION}")
    print(f"   runId={run_id} status={STATUS_TEXT.get(overall_status, overall_status)}")
    print(f"   phases={len(phase_list)}  functions={len(function_groups)}  cases={total}  "
          f"passed={passed}  failed={failed}  notRun={not_run_count}  unconfirmed={unconfirmed}")
    if completeness["missingInputs"] or completeness["missingOutputs"] or completeness["missingActual"]:
        print(f"   字段完整性：用例 {completeness['total']} 条；缺结构化输入 {completeness['missingInputs']}；"
              f"缺结构化预期输出 {completeness['missingOutputs']}；"
              f"缺实际输出 {completeness['missingActual']}；"
              f"被错误写入测试说明 {completeness['leakedIntoDescription']}")
    if result.get("note"):
        print(f"   注意：{result['note']}")
    for phase in phase_list:
        func_names = [f["functionId"] for f in phase["functions"]]
        case_total = sum(f["summary"]["total"] for f in phase["functions"])
        print(f"   [{phase['name']}] {len(phase['functions'])} functions ({', '.join(func_names)}), {case_total} cases")
    return 0


if __name__ == "__main__":
    sys.exit(main())