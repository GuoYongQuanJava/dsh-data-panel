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
    """读 junit.xml，得到逐条测试的真实结果。

    返回 [{name, classname, outcome, message}]，outcome ∈ passed/failed/error/skipped。
    这是 batch 模式唯一的逐条证据来源；解析不出就返回空，调用方据此标“未确认”。
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
        for child in case:
            tag = child.tag.split("}")[-1]
            if tag in ("failure", "error"):
                outcome = "failed" if tag == "failure" else "error"
                message = (child.get("message") or (child.text or "")).strip()
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
        })
    return results

ACTUAL_LINE = re.compile(r'ACTUAL(?:\[([^\]]+)\])?\s*:\s*(.*)$')


def parse_actuals(text: str) -> dict:
    """从测试输出里取“实际值”。

    约定：被测用例打印 `ACTUAL[<caseId>]: <值>`（单条执行也可只写 `ACTUAL: <值>`）。
    通过和失败都要打印；没有标记时返回空，前端显示“未记录实际值”。
    """
    tagged = {}
    untagged = []
    for line in (text or "").splitlines():
        match = ACTUAL_LINE.search(line)
        if not match:
            continue
        key = (match.group(1) or "").strip()
        value = (match.group(2) or "").strip()
        if key:
            tagged[key] = value
        else:
            untagged.append(value)
    return {"tagged": tagged, "untagged": untagged}


def match_test(entries: list, func: str):
    """把用例的测试函数/测试名对应到 junit 里的一条记录。"""
    for entry in entries:
        name = entry.get("name") or ""
        classname = entry.get("classname") or ""
        if name == func or classname.endswith("." + func):
            return entry
        if name.split("[")[0] == func:
            return entry
        if name.endswith("." + func):
            return entry
    return None


def render_target_arg(template: str, target: str, test_file: str) -> str:
    return template.replace("{target}", target).replace("{file}", test_file)


def prepare_argv(spec: dict, targets: list, target: str) -> list:
    """把 request.runner.command 展开成可执行的 argv。"""
    argv = []
    mode = spec.get("mode") or "per-case"
    target_arg = str(spec.get("targetArg") or "{target}")
    test_file = str(spec.get("testFile") or "")
    escaped = re.escape(target) if spec.get("targetEscape") else target
    for token in spec.get("command") or []:
        token = str(token)
        if token == "{targets}" and mode == "batch":
            for item in targets:
                argv.append(render_target_arg(target_arg, item.get("func") or "", test_file))
            continue
        if "{targets}" in token and mode == "batch":
            rendered = " ".join(render_target_arg(target_arg, t.get("func") or "", test_file) for t in targets)
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
    try:
        for line in iter(stream.readline, ""):
            if line == "":
                break
            sys.stdout.write(line)
            sys.stdout.flush()
            log_file.write(line)
            log_file.flush()
            if capture is not None and len("".join(capture)) < CAPTURE_LIMIT:
                capture.append(line)
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


def main() -> int:
    import argparse

    parser = argparse.ArgumentParser(description="会话级测试执行器（通用）")
    parser.add_argument("--project", required=True, help="项目根目录")
    parser.add_argument("--root", required=True, help="会话资产目录")
    parser.add_argument("--run-id", required=True, help="本次执行编号")
    parser.add_argument("--timeout", type=int, default=None, help="覆盖 runner.json 的超时秒数")
    args = parser.parse_args()

    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

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
    scope_text = "全部用例" if result["scope"] == "all" else str(result["caseId"])
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
            actuals = {"tagged": {}, "untagged": []}
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
                    "actual": actual,
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
