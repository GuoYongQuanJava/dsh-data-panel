#!/usr/bin/env python3
"""会话级测试执行器（通用版，由 dsh-data-panel 在会话资产目录里生成）。

这个脚本本身不绑定任何语言/框架：它只读 `runs/<runId>/request.json` 里的
`runner` 描述，然后照描述执行命令、边跑边写日志、结束时写结构化结果。

为什么不让模型自己跑测试再把输出发回来：
* 输出必须**边跑边显示**，同时**边跑边落盘**。攒在内存里等结束再写，
  一旦进程被杀、超时、Ctrl+C，日志就整段丢了。
* 每次执行要有一个 **runId**，把 run.log / result.json / 报告绑在一起。
* 通过/失败要**逐条结构化**，不能靠“整体通过”去推断某条通过。
* 退出码、超时、中断由执行过程自己记录，不靠模型总结。

输入是冻结的：`runs/<runId>/request.json`（准备接口写的），
里面已经有本次要跑的目标用例与测试函数，所以执行期间改面板不影响这次执行。

用法（由面板生成的命令直接调用，一般不用手写）:
    python run_tests.py --project <项目根> --root <会话资产根> --run-id <runId>

退出码：0 全部通过；1 有失败；2 输入缺失；3 超时；130 被中断。
无论哪种情况，都会写下 runs/<runId>/run.log 与 runs/<runId>/result.json。
"""

import json
import os
import re
import shlex
import subprocess
import sys
import threading
import time
import xml.etree.ElementTree as ET
from datetime import datetime
from pathlib import Path

DEFAULT_TIMEOUT = 1800
POLL_INTERVAL = 0.25
CAPTURE_LIMIT = 4000


def now_iso() -> str:
    return datetime.now().astimezone().isoformat(timespec="seconds")


def sha256_of(path: Path) -> str:
    """文件内容的 SHA256（用于校验测试文件没被改过）。"""
    import hashlib

    digest = hashlib.sha256()
    with open(path, "rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def read_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8-sig"))


def parse_junit(path: Path) -> list:
    """读 junit.xml **或 GoogleTest 的 xml**，得到逐条测试的真实结果。

    返回 [{name, classname, outcome, message, detail, timeMs}]，
    outcome ∈ passed/failed/error/skipped。
    这是 batch 模式唯一的逐条证据来源；解析不出就返回空，调用方据此标“未确认”。

    为什么能一把吃两种：
    * 两者都是 `<testcase>` 元素，失败都写 `<failure>`，异常都写 `<error>`；
    * gtest 额外用 `status="notrun"` / `result="suppressed"` 表示被禁用或没跑，
      这两个属性在 JUnit 里不存在，所以按属性判断只影响 gtest 分支；
    * gtest 1.10+ 会写 `classname="套件名"`，正好能还原成 `套件.用例`。
    """
    if not path.is_file():
        return []
    try:
        tree = ET.parse(path)
    except Exception:
        return []
    results = []
    for case in tree.iter("testcase"):
        name = case.get("name") or ""
        classname = case.get("classname") or ""
        outcome = "passed"
        message = ""
        detail = ""
        # gtest：禁用的用例(result="suppressed")和没跑的用例(status="notrun")
        # 都不写子元素，只在属性里表态 —— 不认这两个属性就会把它们算成“通过”。
        status_attr = (case.get("status") or "").strip().lower()
        result_attr = (case.get("result") or "").strip().lower()
        if status_attr == "notrun" or result_attr in ("suppressed", "skipped", "notrun"):
            outcome = "skipped"
            message = status_attr or result_attr
        time_text = case.get("time") or ""
        time_ms = None
        try:
            if time_text:
                time_ms = int(float(time_text) * 1000)
        except (TypeError, ValueError):
            time_ms = None
        for child in case:
            tag = child.tag.split("}")[-1]
            if tag in ("failure", "error"):
                outcome = "failed" if tag == "failure" else "error"
                message = (child.get("message") or (child.text or "")).strip()
                # gtest 把断言细节放在 CDATA 正文里，message 属性只有一行摘要；
                # 面板要展示「Expected/Actual」就得把正文也留下。
                detail = (child.text or "").strip()
                break
            if tag == "skipped":
                outcome = "skipped"
                message = (child.get("message") or "").strip()
                break
        results.append({
            "name": name,
            "classname": classname,
            "outcome": outcome,
            "message": message[:CAPTURE_LIMIT],
            "detail": detail[:CAPTURE_LIMIT],
            "timeMs": time_ms,
        })
    return results

ACTUAL_LINE = re.compile(r'ACTUAL(?:\[([^\]]+)\])?\s*:\s*(.*)$')
ACTUAL_JSON_MARKER = re.compile(r'ACTUAL_JSON\[([^\]]+)\]\s*:\s*(.*)$')


def _strict_json_object(payload):
    def unique_pairs(pairs):
        result = {}
        for key, value in pairs:
            if key in result:
                raise ValueError(f"重复输出字段：{key}")
            result[key] = value
        return result
    def invalid_constant(value):
        raise ValueError(f"JSON 不支持 {value}")
    value = json.loads(payload, object_pairs_hook=unique_pairs, parse_constant=invalid_constant)
    if not isinstance(value, dict):
        raise ValueError("实际输出必须是 JSON 对象")
    json.dumps(value, allow_nan=False)
    return value


def parse_actuals(text: str) -> dict:
    """从测试输出里取“实际值”。

    约定：被测用例打印 `ACTUAL[<caseId>]: <值>`（单条执行也可只写 `ACTUAL: <值>`）。
    通过和失败都要打印；没有标记时返回空，前端显示“未记录实际值”。
    """
    tagged = {}
    untagged = []
    named = {}
    invalid = []
    for line_number, line in enumerate((text or "").splitlines(), 1):
        structured = ACTUAL_JSON_MARKER.search(line)
        if "ACTUAL_JSON[" in line:
            try:
                if not structured or not structured.group(1).strip():
                    raise ValueError("ACTUAL_JSON 标记缺少有效 caseId、右方括号或冒号")
                values = _strict_json_object(structured.group(2))
            except (ValueError, TypeError) as error:
                invalid.append({"caseId": structured.group(1).strip() if structured else "", "line": line_number, "reason": str(error)})
                values = None
            if isinstance(values, dict) and all(isinstance(key, str) for key in values):
                # 统一成与 expectedOutputs 相同的 [{name, value}] 列表，
                # 避免「期望是列表、实际是字典」两边结构不一致。
                named[structured.group(1).strip()] = [
                    {"name": key,
                     "value": value if isinstance(value, str) else json.dumps(value, ensure_ascii=False)}
                    for key, value in values.items()
                ]
            continue
        match = ACTUAL_LINE.search(line)
        if not match:
            continue
        key = (match.group(1) or "").strip()
        value = (match.group(2) or "").strip()
        if key:
            tagged[key] = value
        else:
            untagged.append(value)
    return {"tagged": tagged, "untagged": untagged, "named": named, "invalid": invalid}


def validate_actual_json(text: str, cases=None) -> dict:
    parsed = parse_actuals(text)
    issues = list(parsed["invalid"])
    case_list = cases or []
    known = {str(case.get("caseId") or ""): case for case in case_list}
    for case_id in parsed["named"]:
        if known and case_id not in known:
            issues.append({"caseId": case_id, "reason": "实际输出编号不在本次用例清单中"})
    for case_id, case in known.items():
        outputs = case.get("expectedOutputs") or []
        expected = {item.get("name") for item in outputs if isinstance(item, dict) and item.get("name")}
        if not expected:
            continue
        # named[caseId] 现为 [{name, value}] 列表（旧数据可能是字典），两种都能取字段名
        entry = parsed["named"].get(case_id)
        if isinstance(entry, list):
            actual_names = {item.get("name") for item in entry if isinstance(item, dict)}
        elif isinstance(entry, dict):
            actual_names = set(entry)
        else:
            actual_names = set()
        missing = sorted(expected - actual_names)
        if missing:
            issues.append({"caseId": case_id, "reason": "缺少实际输出字段：" + ", ".join(missing)})
    if not parsed["named"] and not case_list and not issues:
        issues.append({"caseId": "", "reason": "未发现合法 ACTUAL_JSON 输出，不能完成序列化自检"})
    return {"valid": not issues, "caseIds": list(parsed["named"]), "issues": issues}


def match_test(entries: list, func: str):
    """把用例的测试函数/测试名对应到 junit / gtest 里的一条记录。

    命名差异是 C++ 接不进来的真正原因：Python 的 `pytest` 节点是
    `test_generated.py::test_xxx`，而 gtest 的用例名天然是两段
    `TEST(套件, 用例)` —— 面板里 `testFunc` 写哪一种都可能：
    `CouponNeverNegative` 或 `OrderTotal.CouponNeverNegative`。
    两种写法都要认得，否则每条用例都会落到「未确认」。
    """
    target = (func or "").strip()
    if not target:
        return None
    for entry in entries:
        name = entry.get("name") or ""
        classname = entry.get("classname") or ""
        qualified = f"{classname}.{name}" if (classname and name) else name
        if name == target or qualified == target:
            return entry
        if classname and classname.endswith("." + target):
            return entry
        if name.split("[")[0] == target:
            return entry
        if name.endswith("." + target):
            return entry
        # 老版本 gtest 不写 classname：只有拿不到套件名时才退到「套件.用例」的末段，
        # 避免两个套件同名用例之间串证据。
        if not classname and "." in target and name == target.rsplit(".", 1)[-1]:
            return entry
    return None


def render_target_arg(template: str, target: str, test_file: str) -> str:
    return template.replace("{target}", target).replace("{file}", test_file)


def prepare_argv(spec: dict, targets: list, target: str) -> list:
    """把 request.runner.command 展开成可执行的 argv。

    `targetsSeparator`（默认空格）决定多个目标拼进同一个参数时用什么分隔：
    * pytest 走 `{targets}` 独占一个参数 → 每个目标一个 argv，用不到它；
    * gtest 必须写成 `--gtest_filter=A:B`，重复给 `--gtest_filter` 只有最后一个生效，
      所以配置 `"targetsSeparator": ":"` 把多个用例拼成一条过滤表达式。
    """
    argv = []
    mode = spec.get("mode") or "per-case"
    target_arg = str(spec.get("targetArg") or "{target}")
    test_file = str(spec.get("testFile") or "")
    targets_sep = str(spec.get("targetsSeparator") or " ")
    escaped = re.escape(target) if spec.get("targetEscape") else target
    for token in spec.get("command") or []:
        token = str(token)
        if token == "{targets}" and mode == "batch":
            for item in targets:
                argv.append(render_target_arg(target_arg, item.get("func") or "", test_file))
            continue
        if "{targets}" in token and mode == "batch":
            rendered = targets_sep.join(
                render_target_arg(target_arg, t.get("func") or "", test_file) for t in targets
            )
            argv.append(token.replace("{targets}", rendered))
            continue
        if "{target}" in token:
            token = token.replace("{target}", escaped)
        argv.append(token)
    return argv


def spawn_argv(argv: list, use_shell: bool):
    """Windows 上 .cmd/.bat 需要 shell；POSIX 上 shell 模式必须拼成一行。"""
    if not use_shell:
        return argv
    if os.name == "nt":
        return argv
    return shlex.join(argv)


def child_env(spec: dict) -> dict:
    env = dict(os.environ)
    for key, value in (spec.get("env") or {}).items():
        key = str(key)
        value = str(value)
        # PYTHONPATH 是叠加而不是覆盖：项目原有的导入路径不应该被 runner 抹掉。
        if key == "PYTHONPATH" and value and env.get("PYTHONPATH"):
            env[key] = value + os.pathsep + env["PYTHONPATH"]
        else:
            env[key] = value
    env.setdefault("NO_COLOR", "1")
    return env


def kill_tree(process) -> None:
    """连子进程树一起结束（Windows 上测试进程可能有子进程）。"""
    if process.poll() is not None:
        return
    try:
        if os.name == "nt":
            subprocess.run(
                ["taskkill", "/F", "/T", "/PID", str(process.pid)],
                capture_output=True, timeout=10,
            )
        else:
            process.terminate()
    except Exception:
        pass
    try:
        process.wait(timeout=5)
    except Exception:
        try:
            process.kill()
        except Exception:
            pass


def pump(stream, log_file, capture):
    """把子进程输出同时送到终端和日志文件，逐行 flush。"""
    captured_size = 0
    try:
        for line in iter(stream.readline, ""):
            if line == "":
                break
            sys.stdout.write(line)
            sys.stdout.flush()
            log_file.write(line)
            log_file.flush()
            if capture is not None and (captured_size < CAPTURE_LIMIT or "ACTUAL[" in line or "ACTUAL_JSON[" in line):
                capture.append(line)
                captured_size += len(line)
    finally:
        try:
            stream.close()
        except Exception:
            pass


def run_command(argv, cwd, env, use_shell, deadline, log_file, capture: bool):
    """跑一条命令并等它结束；返回退出码、超时/中断标记和捕获的输出。"""
    started = time.time()
    buffer = [] if capture else None
    if not argv:
        return {"code": 2, "timedOut": False, "interrupted": False, "captured": "", "durationMs": 0, "error": "命令为空"}
    try:
        process = subprocess.Popen(
            spawn_argv(argv, use_shell),
            cwd=cwd,
            env=env,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            encoding="utf-8",
            errors="replace",
            bufsize=1,
        )
    except Exception as error:
        return {"code": 2, "timedOut": False, "interrupted": False, "captured": "", "durationMs": 0,
                "error": f"启动命令失败：{error}"}

    reader = threading.Thread(target=pump, args=(process.stdout, log_file, buffer), daemon=True)
    reader.start()

    timed_out = False
    interrupted = False
    try:
        while True:
            if process.poll() is not None:
                break
            if time.time() > deadline:
                timed_out = True
                kill_tree(process)
                break
            time.sleep(POLL_INTERVAL)
    except KeyboardInterrupt:
        interrupted = True
        kill_tree(process)

    # 等读取线程把残余输出写完（最多 5 秒），确保日志完整。
    reader.join(timeout=5)
    if reader.is_alive():
        kill_tree(process)

    code = process.returncode if process.returncode is not None else 1
    return {
        "code": code,
        "timedOut": timed_out,
        "interrupted": interrupted,
        "captured": "".join(buffer or []),
        "durationMs": int((time.time() - started) * 1000),
        "error": "",
    }


def tail(text: str, limit: int = CAPTURE_LIMIT) -> str:
    text = (text or "").strip()
    if len(text) <= limit:
        return text
    return "…(仅保留失败输出末尾)\n" + text[-limit:]


# ══════════════════════════════════════════════════════════════
# 覆盖率：解析各种主流报告格式 → 统一的 {line, branch} 统计
# ══════════════════════════════════════════════════════════════
#
# 面板不偏向任何语言：format 是字符串，新增框架只要加一个分支即可。
# 解析失败不抛到调用方之外，由 collect_coverage 统一变成“未采集 + 原因”。

def _pct(covered: int, total: int) -> float:
    if total <= 0:
        return 0.0
    return round(covered / total * 100, 1)


def _stat(covered, total):
    """统一的行/分支统计块；无法得到总数时返回 None（而不是 0%）。"""
    try:
        covered_i = int(covered or 0)
        total_i = int(total or 0)
    except (TypeError, ValueError):
        return None
    if total_i <= 0:
        return None
    return {"covered": covered_i, "total": total_i, "percent": _pct(covered_i, total_i)}


def _read_text(path: Path) -> str:
    return path.read_text(encoding="utf-8-sig", errors="replace")


def parse_coverage_report(path: Path, fmt: str) -> dict:
    """解析覆盖率报告，返回 {"line": stat|None, "branch": stat|None, "block": stat|None}。"""
    fmt = (fmt or "").strip().lower()
    line = branch = block = None

    if fmt == "coveragepy-json":
        data = json.loads(_read_text(path))
        totals = data.get("totals") or {}
        line = _stat(totals.get("covered_lines"), totals.get("num_statements"))
        branch = _stat(totals.get("covered_branches"), totals.get("num_branches"))

    elif fmt == "istanbul-summary":
        data = json.loads(_read_text(path))
        totals = data.get("total") or data
        lines = totals.get("lines") or {}
        branches = totals.get("branches") or {}
        line = _stat(lines.get("covered"), lines.get("total"))
        branch = _stat(branches.get("covered"), branches.get("total"))

    elif fmt == "go-cover":
        covered = total = 0
        for raw in _read_text(path).splitlines():
            text = raw.strip()
            if not text or text.startswith("mode:"):
                continue
            match = re.match(r"^.+:\d+\.\d+,\d+\.\d+\s+(\d+)\s+(\d+)$", text)
            if not match:
                continue
            statements = int(match.group(1))
            hits = int(match.group(2))
            total += statements
            if hits > 0:
                covered += statements
        line = _stat(covered, total)

    elif fmt == "lcov":
        lf = lh = brf = brh = 0
        for raw in _read_text(path).splitlines():
            text = raw.strip()
            try:
                if text.startswith("LF:"):
                    lf += int(text[3:])
                elif text.startswith("LH:"):
                    lh += int(text[3:])
                elif text.startswith("BRF:"):
                    brf += int(text[4:])
                elif text.startswith("BRH:"):
                    brh += int(text[4:])
            except ValueError:
                continue
        line = _stat(lh, lf)
        branch = _stat(brh, brf)

    elif fmt in ("cobertura", "jacoco"):
        root = ET.parse(str(path)).getroot()
        if fmt == "cobertura":
            # cobertura 通常在根节点给出 lines-valid / lines-covered（新版本还会有 branch 属性）
            valid = root.get("lines-valid") or root.get("lines-valid".upper())
            covered = root.get("lines-covered")
            if valid is not None and covered is not None:
                line = _stat(covered, valid)
                branch = _stat(root.get("branches-covered"), root.get("branches-valid"))
            else:
                # 退而求其次：统计所有 <line> 元素（按 class 的文件名 + 行号去重）
                seen = {}
                for cls in root.iter("class"):
                    filename = cls.get("filename") or ""
                    # cobertura 的 <line> 在 <lines> 里，不一定是 class 的直接子节点。
                    for item in cls.iter("line"):
                        try:
                            number = int(item.get("number") or 0)
                            hits = int(float(item.get("hits") or 0))
                        except (TypeError, ValueError):
                            continue
                        key = (filename, number)
                        seen[key] = max(seen.get(key, 0), hits)
                line = _stat(sum(1 for hits in seen.values() if hits > 0), len(seen))
        else:
            counters = {item.get("type"): item for item in root.findall("counter")}
            line_counter = counters.get("LINE")
            branch_counter = counters.get("BRANCH")
            if line_counter is not None:
                covered = int(line_counter.get("covered") or 0)
                missed = int(line_counter.get("missed") or 0)
                line = _stat(covered, covered + missed)
            if branch_counter is not None:
                covered = int(branch_counter.get("covered") or 0)
                missed = int(branch_counter.get("missed") or 0)
                branch = _stat(covered, covered + missed)

    elif fmt in ("vs-codecoverage-xml", "vs-xml"):
        # 旧版 VS 动态采集（CodeCoverage.exe analyze）导出的 XML：
        #   <module blocks_covered blocks_not_covered lines_covered lines_partially_covered lines_not_covered …>
        # 只有块与行两种口径，没有独立的语句/分支/MC-DC 字段，不得推导或改名。
        root = ET.parse(str(path)).getroot()
        b_cov = b_total = l_cov = l_total = 0
        modules = 0
        for module in root.iter("module"):
            try:
                bc = int(module.get("blocks_covered") or 0)
                bm = int(module.get("blocks_not_covered") or 0)
                lc = int(module.get("lines_covered") or 0)
                lp = int(module.get("lines_partially_covered") or 0)
                lm = int(module.get("lines_not_covered") or 0)
            except (TypeError, ValueError):
                continue
            if bc + bm + lc + lp + lm == 0:
                continue
            modules += 1
            b_cov += bc
            b_total += bc + bm
            l_cov += lc
            l_total += lc + lp + lm
        if modules == 0:
            raise ValueError(
                "旧版 VS 覆盖率 XML 里没有块/行数据（通常是空报告："
                "检查 AllowLowIntegrityProcesses 是否为 true、PDB 是否同次构建、业务模块是否被过滤掉）"
            )
        line = _stat(l_cov, l_total)
        block = _stat(b_cov, b_total)

    else:
        raise ValueError(f"不认识的覆盖率格式「{fmt}」（可用：coveragepy-json / istanbul-summary / go-cover / lcov / cobertura / jacoco / vs-codecoverage-xml）")

    if line is None and branch is None and block is None:
        raise ValueError("报告里没有任何可用的行/分支/块统计")
    return {"line": line, "branch": branch, "block": block}


def locate_coverage_file(spec_file: str, project: Path) -> Path | None:
    """找到覆盖率报告；支持 `*` 通配（取最新的一份）。"""
    import glob

    target = (spec_file or "").strip()
    if not target:
        return None
    pattern = target if os.path.isabs(target) else str((project / target).resolve())
    matches = glob.glob(pattern, recursive=True) if "*" in pattern else ([pattern] if os.path.isfile(pattern) else [])
    files = [Path(item) for item in matches if os.path.isfile(item)] if matches else []
    if not files:
        return None
    return max(files, key=lambda item: item.stat().st_mtime)

def collect_coverage(cfg, *, spec: dict, targets: list, run_dir: Path, project: Path, cwd, env, use_shell: bool, log_file, say) -> dict:
    """按 request.runner.coverage 跑一次覆盖率采集，返回统一结构。

    无论成功与否都返回一个 dict（available=False 时带 reason），
    调用方只把它写进 result.json，不影响本次执行的通过/失败结论。
    """
    if not isinstance(cfg, dict) or not cfg.get("command"):
        return {"available": False, "reason": "本次未配置覆盖率采集"}

    raw_command = cfg.get("command") or []
    # 每个元素必须是一段参数；出现 list 说明配置写错了（曾经把它 str() 成 "['…']" 然后静默失败）。
    bad = [part for part in raw_command if not isinstance(part, str)]
    if bad:
        return {"available": False, "reason": "coverage.command 里有非字符串项（应为一维 argv 字符串数组）"}
    # 覆盖率命令和正式执行共用目标展开规则，避免把 {targets} 原样传给 pytest。
    argv = prepare_argv({**spec, "command": raw_command}, targets, "")
    fmt = str(cfg.get("format") or "")
    report = str(cfg.get("file") or "")
    timeout = cfg.get("timeoutSec")
    hint = str(cfg.get("hint") or "").strip()
    if not isinstance(timeout, int) or timeout <= 0:
        timeout = 900


    # 采集器不会自己建目录：报告/原始容器的父目录必须先存在，否则 collect 直接报
    # 「目录不存在」并退出（-1），看起来像采集失败。
    for target_path in (report,):
        if target_path:
            try:
                Path(target_path).expanduser().parent.mkdir(parents=True, exist_ok=True)
            except OSError as error:
                reason = f"无法创建覆盖率输出目录：{error}"
                if hint:
                    reason += f"；{hint}"
                say(f"[覆盖率未采集] {reason}")
                return {"available": False, "reason": reason[:300]}
    say("")
    say("── 覆盖率采集 ──")
    say("$ " + " ".join(shlex.quote(part) for part in argv))
    started = time.time()
    deadline = started + timeout
    run = run_command(argv, cwd, env, use_shell, deadline, log_file, capture=True)

    if run["error"]:
        reason = run["error"] if not hint else f"{run['error']}；{hint}"
        say(f"[覆盖率未采集] {reason}")
        return {"available": False, "reason": reason[:300]}
    if run["timedOut"]:
        reason = f"覆盖率采集超时（{timeout} 秒）"
        say(f"[覆盖率未采集] {reason}")
        return {"available": False, "reason": reason}
    if run["code"] != 0:
        # 很多框架在用例失败时仍会写出覆盖率；不能因为退出码不是 0 就放弃读数。
        say(f"[覆盖率命令退出码 {run['code']}，继续尝试读取报告]")

    # ── 两步采集：主命令跑完后，先执行 postCommand（如 analyze 导 XML），再去找报告 ──
    post_raw = cfg.get("postCommand") or []
    if post_raw:
        bad_post = [part for part in post_raw if not isinstance(part, str)]
        if bad_post:
            reason = "coverage.postCommand 里有非字符串项（应为一维 argv 字符串数组）"
            say(f"[覆盖率未采集] {reason}")
            return {"available": False, "reason": reason}
        post_argv = prepare_argv({**spec, "command": post_raw}, targets, "")
        say("$ " + " ".join(shlex.quote(part) for part in post_argv))
        post = run_command(post_argv, cwd, env, use_shell, started + timeout, log_file, capture=True)
        if post["error"]:
            reason = f"覆盖率后处理失败：{post['error']}"
            if hint:
                reason += f"；{hint}"
            say(f"[覆盖率未采集] {reason}")
            return {"available": False, "reason": reason[:300]}
        if post["timedOut"]:
            reason = f"覆盖率后处理超时（{timeout} 秒）"
            say(f"[覆盖率未采集] {reason}")
            return {"available": False, "reason": reason}
        if post["code"] != 0:
            say(f"[覆盖率后处理退出码 {post['code']}，继续尝试读取报告]")

    path = locate_coverage_file(report, project)
    if path is None:
        reason = f"没生成覆盖率报告（{os.path.basename(report) or report}）"
        if hint:
            reason += f"；{hint}"
        else:
            reason += "；可能没装覆盖率插件，或没命中测试"
        say(f"[覆盖率未采集] {reason}")
        return {"available": False, "reason": reason[:300]}

    try:
        stats = parse_coverage_report(path, fmt)
    except Exception as error:
        reason = f"覆盖率报告解析失败（{fmt}）：{error}"
        say(f"[覆盖率未采集] {reason}")
        return {"available": False, "reason": reason[:300]}

    line = stats.get("line") or {}
    branch = stats.get("branch") or {}
    block_stat = stats.get("block") or {}
    summary = []
    if line:
        summary.append(f"行 {line['covered']}/{line['total']} = {line['percent']}%")
    if branch:
        summary.append(f"分支 {branch['covered']}/{branch['total']} = {branch['percent']}%")
    if block_stat:
        summary.append(f"块 {block_stat['covered']}/{block_stat['total']} = {block_stat['percent']}%")
    say(f"[覆盖率] {'；'.join(summary)}（{path.name}）")
    say(f"[覆盖率] 采集耗时 {int((time.time() - started) * 1000)}ms")

    return {
        "available": True,
        "format": fmt,
        "source": str(path),
        "line": stats.get("line"),
        "branch": stats.get("branch"),
        "block": stats.get("block"),
        "durationMs": int((time.time() - started) * 1000),
    }

def collect_coverage_safely(cfg, *, spec: dict, targets: list, run_dir: Path, project: Path,
                             cwd, env, use_shell: bool, log_file, say) -> dict:
    """跑一次覆盖率采集并吞掉异常：覆盖率永远不能把一次执行搞崩。"""
    try:
        return collect_coverage(cfg, spec=spec, targets=targets, run_dir=run_dir, project=project,
                                cwd=cwd, env=env, use_shell=use_shell, log_file=log_file, say=say)
    except Exception as error:  # noqa: BLE001 —— 这里就是要接住所有异常
        return {"available": False, "reason": f"覆盖率采集异常：{error}"}


def coverage_status_of(coverage, required: bool) -> str:
    """覆盖率状态：collected / failed / skipped。

    注意：它不回写 result.status。测试本身跑完了就是 passed，覆盖率没采到是
    “测试完成、覆盖率未完成”，两件事分开记，避免把覆盖率问题误报成用例失败。
    """
    if isinstance(coverage, dict) and coverage.get("available"):
        return "collected"
    return "failed" if required else "skipped"


def write_coverage_attempt(run_dir: Path, coverage: dict, extra: dict) -> str:
    """把一次采集过程写进 `coverage-attempts/attempt-NN.json`，保留原始证据链。"""
    attempts = run_dir / "coverage-attempts"
    attempts.mkdir(parents=True, exist_ok=True)
    index = len(list(attempts.glob("attempt-*.json"))) + 1
    path = attempts / f"attempt-{index:02d}.json"
    payload = {"attempt": index, "at": now_iso(), **extra, "coverage": coverage}
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    return str(path)

def main() -> int:
    import argparse

    parser = argparse.ArgumentParser(description="会话级测试执行器（通用）")
    parser.add_argument("--project", help="项目根目录")
    parser.add_argument("--root", help="会话资产目录")
    parser.add_argument("--run-id", help="本次执行编号")
    parser.add_argument("--check-actual-json", help="只检查生成后序列化自测的输出日志，不运行测试或写结果")
    parser.add_argument("--coverage-only", action="store_true",
                        help="只重采覆盖率：沿用本次 run 冻结的快照与目标，不重新跑用例")
    parser.add_argument("--cases", help="JSON 自检的用例清单（可选）")
    parser.add_argument("--timeout", type=int, default=None, help="覆盖 runner.json 的超时秒数")
    args = parser.parse_args()

    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

    if args.check_actual_json:
        try:
            data = read_json(Path(args.cases)) if args.cases else []
            cases = data.get("cases", []) if isinstance(data, dict) else data
            validation = validate_actual_json(_read_text(Path(args.check_actual_json)), cases)
            print(json.dumps(validation, ensure_ascii=False, indent=2))
            return 0 if validation["valid"] else 2
        except Exception as error:
            print(json.dumps({"valid": False, "error": str(error)}, ensure_ascii=False))
            return 2
    if not args.project or not args.root or not args.run_id:
        parser.error("执行需要 --project、--root、--run-id")

    project = Path(args.project).resolve()
    root = Path(args.root).resolve()
    run_dir = root / "runs" / args.run_id
    run_dir.mkdir(parents=True, exist_ok=True)
    log_path = run_dir / "run.log"
    result_path = run_dir / "result.json"
    request_path = run_dir / "request.json"

    started = time.time()
    result = {
        "runId": args.run_id,
        "sessionRoot": str(root),
        "project": str(project),
        "scope": "all",
        "caseId": "",
        "startedAt": now_iso(),
        "finishedAt": "",
        "exitCode": None,
        "status": "running",
        "passed": 0,
        "failed": 0,
        "errors": 0,
        "skipped": 0,
        "unconfirmed": 0,
        "notRun": [],
        "tests": [],
        "durationMs": 0,
        "command": [],
        "commands": [],
        "runner": {},
        "note": "",
    }

    log_file = open(log_path, "w", encoding="utf-8", errors="replace")
    # 早退路径（缺 request.json 等）也会走到 finish()，覆盖率代码需要这些值存在。
    cwd = str(project)
    env = dict(os.environ)
    use_shell = False
    # finish() 里的覆盖率逻辑会读 request；缺 request.json 时它必须已存在且为空对象，
    # 否则早退路径会抛 NameError。
    request = {}

    def say(line: str = "") -> None:
        print(line)
        sys.stdout.flush()
        log_file.write(line + "\n")
        log_file.flush()

    def finish(code: int, status: str, note: str = "") -> int:
        result["finishedAt"] = now_iso()
        result["exitCode"] = code
        result["status"] = status
        result["durationMs"] = int((time.time() - started) * 1000)
        if note:
            result["note"] = note
        result["passed"] = sum(1 for item in result["tests"] if item["outcome"] == "passed")
        result["failed"] = sum(1 for item in result["tests"] if item["outcome"] in ("failed", "error"))
        result["errors"] = sum(1 for item in result["tests"] if item["outcome"] == "error")
        result["skipped"] = sum(1 for item in result["tests"] if item["outcome"] == "skipped")
        result["unconfirmed"] = sum(1 for item in result["tests"] if item["outcome"] == "unknown")
        if result["tests"]:
            try:
                frozen = read_json(Path(request["casesFile"]))
                case_ids = set(result.get("cases") or [])
                cases = [case for case in frozen.get("cases", []) if case.get("caseId") in case_ids]
                validation = validate_actual_json(log_path.read_text(encoding="utf-8", errors="replace"), cases)
                result["actualOutputValidation"] = validation
                for issue in validation["issues"]:
                    say(f"[实际输出 JSON 告警] {issue.get('caseId') or '未关联用例'}：{issue['reason']}")
            except Exception as error:
                result["actualOutputValidation"] = {"valid": False, "issues": [{"reason": f"无法完成实际输出核验：{error}"}]}
        # ── 覆盖率：作为额外证据采集 ──
        # coverageRequired=true 时，“采不到”是必须报出来的事实，但不改测试结论（status）：
        # 结果是「测试完成、覆盖率未完成」，用 coverageStatus 单独表达。
        coverage_required = bool((request.get("runner") or {}).get("coverageRequired"))
        result["coverageRequired"] = coverage_required
        if "coverage" not in result:
            coverage_cfg = None
            try:
                coverage_cfg = (request.get("runner") or {}).get("coverage")
            except Exception:
                coverage_cfg = None
            if status in ("passed", "partial", "failed"):
                result["coverage"] = collect_coverage_safely(
                    coverage_cfg,
                    spec=spec,
                    targets=targets,
                    run_dir=run_dir,
                    project=project,
                    cwd=cwd,
                    env=env,
                    use_shell=use_shell,
                    log_file=log_file,
                    say=say,
                )
            else:
                result["coverage"] = {
                    "available": False,
                    "reason": f"执行状态为 {status}，未采集覆盖率",
                }
        result["coverageStatus"] = coverage_status_of(result["coverage"], coverage_required)
        if coverage_required and result["coverageStatus"] != "collected":
            reason = str((result.get("coverage") or {}).get("reason") or "未知原因")
            say(f"[覆盖率] 本次要求采集覆盖率，但未完成：{reason}")
            result["note"] = (result.get("note", "") + ("；" if result.get("note") else "")) \
                + f"测试完成、覆盖率未完成：{reason}"
            # 失败也留证据，供后续用 --coverage-only 沿用同一快照补采。
            result["coverageAttempt"] = write_coverage_attempt(run_dir, result["coverage"], {
                "runId": args.run_id,
                "mode": "run",
                "targets": [t.get("caseId", "") for t in targets],
                "coveragePlan": request.get("coveragePlan"),
            })
        result_path.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
        try:
            log_file.close()
        except Exception:
            pass
        print("")
        print(f"[{status}] runId={args.run_id} exit={code} "
              f"passed={result['passed']} failed={result['failed']} "
              f"errors={result['errors']} skipped={result['skipped']} "
              f"unconfirmed={result['unconfirmed']} "
              f"notRun={len(result['notRun'])} ({result['durationMs']}ms)")
        print(f"日志: {log_path}")
        print(f"结果: {result_path}")
        return code

    # ── 读冻结的请求 ──
    if not request_path.is_file():
        say("缺少 request.json：请从面板重新点一次执行。")
        return finish(2, "no-request", "缺少 request.json")
    try:
        request = read_json(request_path)
    except Exception as error:
        say(f"request.json 解析失败：{error}")
        return finish(2, "no-request", "request.json 解析失败")

    spec = request.get("runner") or {}
    if not spec:
        # 兼容旧版本 prepare 生成的 request.json（当时只有 pytest 一条链路）。
        legacy_junit = run_dir / "junit.xml"
        spec = {
            "id": "pytest", "label": "pytest", "language": "python", "mode": "batch",
            "testFile": str(request.get("testFile") or (root / "tests" / "test_generated.py")),
            "command": [sys.executable, "-m", "pytest", "-v", "--tb=short", "--no-header",
                        "-p", "no:warnings", f"--junitxml={legacy_junit}", "{targets}"],
            "targetArg": "{file}::{target}",
            "junit": str(legacy_junit),
            "env": {"PYTHONPATH": str(project), "PYTHONIOENCODING": "utf-8",
                    "PYTHONUNBUFFERED": "1"},
        }
        result["note"] = "旧格式 request.json：按 pytest 兼容执行"
    if not spec.get("command"):
        say("request.json 里没有可用的 runner 描述：请重新点一次执行。")
        return finish(2, "no-runner", "缺少 runner 描述")
    timeout_sec = args.timeout if args.timeout is not None else spec.get("timeoutSec", DEFAULT_TIMEOUT)
    if not isinstance(timeout_sec, int) or timeout_sec <= 0:
        timeout_sec = DEFAULT_TIMEOUT
    deadline = started + timeout_sec
    result["scope"] = request.get("scope", "all")
    result["testScope"] = request.get("testScope") or {"status": "missing", "warnings": ["旧执行请求未包含测试范围清单"]}
    for warning in result["testScope"].get("warnings", []):
        say(f"[测试范围告警] {warning}")
    result["caseId"] = request.get("caseId", "")
    targets = request.get("targets") or []
    not_run = request.get("notRun") or []
    result["notRun"] = not_run
    result["cases"] = [t.get("caseId", "") for t in targets]
    result["runner"] = {
        "id": spec.get("id", ""),
        "label": spec.get("label", ""),
        "language": spec.get("language", ""),
        "mode": spec.get("mode", ""),
        "source": spec.get("source", ""),
    }

    # ── 补采模式：只重采覆盖率 ──
    # 沿用本次 run 的冻结快照与目标，不重新生成用例/测试代码，也不重跑用例；
    # 每次采集都写 coverage-attempts/，报告引用最终有效的那一次。
    if args.coverage_only:
        coverage_required = bool(spec.get("coverageRequired"))
        say("补采模式：沿用本次 run 的冻结快照与目标，只重新采集覆盖率，不重新跑用例。")
        coverage = collect_coverage_safely(
            spec.get("coverage"), spec=spec, targets=targets, run_dir=run_dir, project=project,
            cwd=cwd, env=env, use_shell=use_shell, log_file=log_file, say=say,
        )
        attempt = write_coverage_attempt(run_dir, coverage, {
            "runId": args.run_id,
            "mode": "coverage-only",
            "targets": [t.get("caseId", "") for t in targets],
            "coveragePlan": request.get("coveragePlan"),
        })
        status = coverage_status_of(coverage, coverage_required)
        previous = {}
        if result_path.is_file():
            try:
                previous = read_json(result_path)
            except Exception:
                previous = {}
        previous.update({
            "coverage": coverage,
            "coverageRequired": coverage_required,
            "coverageStatus": status,
            "coverageAttempt": attempt,
        })
        attempts_dir = run_dir / "coverage-attempts"
        previous["coverageAttempts"] = sorted(p.name for p in attempts_dir.glob("attempt-*.json"))
        result_path.write_text(json.dumps(previous, ensure_ascii=False, indent=2), encoding="utf-8")
        say(f"[覆盖率] 补采结果：{coverage.get('reason') or coverage.get('source') or status}")
        say(f"[覆盖率] 证据：{attempt}")
        log_file.close()
        return 0 if coverage.get("available") else 2

    test_file = Path(request.get("testFile") or (root / "tests" / "test_generated.py"))
    # 执行仍在原位置：不把测试文件换地方（那样会改变 conftest / import 路径等行为）。
    # 改为内容校验：准备时记了 SHA256，这里重算；不一致就拒绝执行，
    # 而不是默默跑成另一个版本。
    if not test_file.is_file():
        say(f"找不到测试文件 {test_file}。")
        return finish(2, "no-test-file", f"找不到 {test_file.name}")

    expected_sha = str(request.get("testFileSha256") or "")
    if expected_sha:
        actual_sha = sha256_of(test_file)
        if actual_sha != expected_sha:
            say("测试文件在准备执行之后被修改过。")
            say("本次执行已作废，避免跑到和面板里不一致的内容；请重新点一次执行。")
            say(f"文件：{test_file}")
            say(f"准备时：{expected_sha}")
            say(f"现在：  {actual_sha}")
            return finish(2, "test-file-changed", "测试文件在准备后被修改，请重新点执行")

    if not targets:
        note = "本次没有可执行的用例"
        if not_run:
            note += "（" + "、".join(n.get("caseId", "?") for n in not_run) + " 没有关联测试目标）"
        say(note)
        return finish(2, "no-targets", note)


    mode = spec.get("mode") or "per-case"
    cwd = spec.get("cwd") or str(project)
    env = child_env(spec)
    use_shell = bool(spec.get("shell"))
    label = spec.get("label") or spec.get("id") or "测试框架"
    not_run_pattern = None
    if spec.get("notRunPattern"):
        try:
            not_run_pattern = re.compile(str(spec["notRunPattern"]))
        except Exception:
            not_run_pattern = None

    say(f"runId: {args.run_id}")
    say(f"项目: {project}")
    say(f"框架: {label}（{spec.get('language') or 'unknown'} / {mode}）")
    if result["scope"] == "all":
        scope_text = "全部用例"
    elif result["scope"] == "cases":
        scope_text = "选中用例"
    else:
        scope_text = str(result["caseId"])
    say(f"范围: {scope_text}（{len(targets)} 条）")
    if not_run:
        say("注意：以下用例没有关联测试目标，未执行 -> " + "、".join(n.get("caseId", "?") for n in not_run))
    say("-" * 60)

    # ══ 预执行：构建/准备命令（可选，例如 cmake --build）══
    pre_command = spec.get("preCommand") or []
    if pre_command:
        say("── 预执行（构建/准备）──")
        say("$ " + " ".join(shlex.quote(part) for part in pre_command))
        pre = run_command(pre_command, cwd, env, use_shell, deadline, log_file, capture=False)
        if pre["error"]:
            say(pre["error"])
        if pre["timedOut"]:
            say(f"[预执行超时，已终止（{timeout_sec} 秒）]")
            return finish(3, "timeout", "预执行超时")
        if pre["interrupted"]:
            say("[预执行被中断]")
            return finish(130, "interrupted", "预执行被中断")
        if pre["code"] != 0:
            return finish(pre["code"] or 1, "build-failed", f"预执行命令退出码 {pre['code']}")

    # ══ batch 模式：一次进程跑完，逐条结果来自 junit ══
    if mode == "batch":
        argv = prepare_argv(spec, targets, "")
        result["command"] = argv
        result["commands"] = [argv]
        say("$ " + " ".join(shlex.quote(part) for part in argv))
        run = run_command(argv, cwd, env, use_shell, deadline, log_file, capture=False)
        if run["error"]:
            say(run["error"])
        if run["timedOut"]:
            say(f"[执行超时，已终止（{timeout_sec} 秒）]")
        if run["interrupted"]:
            say("[执行被中断]")

        junit_path = Path(spec.get("junit") or (run_dir / "junit.xml"))
        entries = parse_junit(junit_path)
        try:
            actuals = parse_actuals(log_path.read_text(encoding="utf-8", errors="replace"))
        except Exception:
            actuals = {"tagged": {}, "untagged": [], "named": {}}
        for item in targets:
            func = item.get("func") or ""
            case_id = item.get("caseId", "")
            actual = actuals["tagged"].get(case_id) or actuals["tagged"].get(func) or ""
            if actual == "" and len(targets) == 1 and actuals["untagged"]:
                actual = actuals["untagged"][-1]
            hit = match_test(entries, func)
            if hit is None:
                result["tests"].append({
                    "caseId": item.get("caseId", ""),
                    "func": func,
                    "outcome": "unknown",
                    "message": "执行结果里没有该用例的逐条记录（junit 为空或没有匹配到测试名）",
                    "actual": "",
                })
            else:
                result["tests"].append({
                    "caseId": item.get("caseId", ""),
                    "func": func,
                    "outcome": hit["outcome"],
                    "message": hit.get("message") or "",
                    "detail": hit.get("detail") or "",
                    "actual": actual,
                     "actualOutputs": actuals["named"].get(case_id, []),
                    "durationMs": hit.get("timeMs"),
                })

        if run["timedOut"]:
            return finish(3, "timeout", f"超过 {timeout_sec} 秒")
        if run["interrupted"]:
            return finish(130, "interrupted", "执行被中断")
        code = run["code"]
        result["command"] = argv
        if code == 0:
            unconfirmed = any(item["outcome"] == "unknown" for item in result["tests"])
            status = "partial" if (not_run or unconfirmed) else "passed"
        elif code == 5 and (spec.get("id") == "pytest"):
            status = "no-tests"
        else:
            status = "failed"
        return finish(code, status)

    # ══ per-case 模式：一条用例一条命令，退出码就是该条的证据 ══
    failed = 0
    unconfirmed = 0
    for item in targets:
        func = item.get("func") or ""
        argv = prepare_argv(spec, targets, func)
        result["commands"].append(argv)
        if not result["command"]:
            result["command"] = argv
        say("")
        say(f"── {item.get('caseId', '?')} :: {func} ──")
        say("$ " + " ".join(shlex.quote(part) for part in argv))
        run = run_command(argv, cwd, env, use_shell, deadline, log_file, capture=True)
        if run["error"]:
            say(run["error"])
        if run["timedOut"]:
            say(f"[执行超时，已终止（{timeout_sec} 秒）]")
            result["tests"].append({
                "caseId": item.get("caseId", ""),
                "func": func,
                "outcome": "error",
                "message": "执行超时",
                "durationMs": run["durationMs"],
            })
            return finish(3, "timeout", f"超过 {timeout_sec} 秒")
        if run["interrupted"]:
            say("[执行被中断]")
            result["tests"].append({
                "caseId": item.get("caseId", ""),
                "func": func,
                "outcome": "error",
                "message": "执行被中断",
                "durationMs": run["durationMs"],
            })
            return finish(130, "interrupted", "执行被中断")

        outcome = "passed" if run["code"] == 0 else "failed"
        actuals = parse_actuals(run["captured"])
        actual = actuals["tagged"].get(item.get("caseId", "")) or (actuals["untagged"][-1] if actuals["untagged"] else "")
        message = ""
        if outcome == "passed" and not_run_pattern is not None and not_run_pattern.search(run["captured"]):
            outcome = "unknown"
            message = "命令退出码为 0，但输出显示没有匹配到该用例的测试项"
            unconfirmed += 1
        elif outcome == "failed":
            message = tail(run["captured"]) or f"命令退出码 {run['code']}"
            failed += 1
        result["tests"].append({
            "caseId": item.get("caseId", ""),
            "func": func,
            "outcome": outcome,
            "actual": actual,
             "actualOutputs": actuals["named"].get(item.get("caseId", ""), []),
            "message": message,
            "exitCode": run["code"],
            "durationMs": run["durationMs"],
        })
        verdict = "通过" if outcome == "passed" else ("未确认" if outcome == "unknown" else "失败")
        say(f"[{verdict}] exit={run['code']} ({run['durationMs']}ms)")

    status = "passed"
    if failed > 0:
        status = "failed"
    elif unconfirmed > 0 or not_run:
        status = "partial"
    return finish(0 if failed == 0 and unconfirmed == 0 else 1, status)


if __name__ == "__main__":
    sys.exit(main())
