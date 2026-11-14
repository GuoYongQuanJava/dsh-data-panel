#!/usr/bin/env python3
"""会话级测试执行器（由 dsh-data-panel 在会话资产目录里生成）。

为什么要有这个脚本，而不是让模型自己跑 pytest 再把输出发回来：

* 输出必须**边跑边显示**，同时**边跑边落盘**。攒在内存里等结束再写，
  一旦进程被杀、超时、Ctrl+C，日志就整段丢了。
* 每次执行要有一个 **runId**，把 run.log / result.json / junit.xml / 报告绑在一起。
* 通过/失败要**逐条结构化**（junit.xml），不能靠“整体通过”去推断某条通过。
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
import sys
import threading
import time
import xml.etree.ElementTree as ET
from datetime import datetime
from pathlib import Path

DEFAULT_TIMEOUT = 1800
POLL_INTERVAL = 0.25


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


def parse_counts(output: str) -> dict:
    """从 pytest 汇总行里取 passed/failed/errors/skipped（仅作展示用）。"""
    import re

    counts = {"passed": 0, "failed": 0, "errors": 0, "skipped": 0}
    for key, pattern in (
        ("passed", r"(\d+)\s+passed"),
        ("failed", r"(\d+)\s+failed"),
        ("errors", r"(\d+)\s+error"),
        ("skipped", r"(\d+)\s+skipped"),
    ):
        found = re.findall(pattern, output)
        if found:
            counts[key] = sum(int(n) for n in found)
    return counts


def parse_junit(path: Path) -> list:
    """读 junit.xml，得到逐条测试的真实结果。

    返回 [{func, outcome, message}]，outcome ∈ passed/failed/error/skipped。
    这是报告唯一的逐条证据来源；解析不出就返回空，调用方据此标“未确认”。
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
        outcome = "passed"
        message = ""
        for child in case:
            tag = child.tag
            if tag in ("failure", "error"):
                outcome = "failed" if tag == "failure" else "error"
                message = (child.get("message") or "").strip()
                break
            if tag == "skipped":
                outcome = "skipped"
                break
        results.append({"func": name, "outcome": outcome, "message": message})
    return results


def main() -> int:
    import argparse

    parser = argparse.ArgumentParser(description="会话级测试执行器")
    parser.add_argument("--project", required=True, help="项目根目录")
    parser.add_argument("--root", required=True, help="会话资产目录")
    parser.add_argument("--run-id", required=True, help="本次执行编号")
    parser.add_argument("--timeout", type=int, default=DEFAULT_TIMEOUT, help="超时秒数")
    args = parser.parse_args()

    project = Path(args.project).resolve()
    root = Path(args.root).resolve()
    run_dir = root / "runs" / args.run_id
    run_dir.mkdir(parents=True, exist_ok=True)
    log_path = run_dir / "run.log"
    result_path = run_dir / "result.json"
    junit_path = run_dir / "junit.xml"
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
        "notRun": [],
        "tests": [],
        "durationMs": 0,
        "command": [],
        "note": "",
    }

    def finish(code: int, status: str, note: str = "") -> int:
        result["finishedAt"] = now_iso()
        result["exitCode"] = code
        result["status"] = status
        result["durationMs"] = int((time.time() - started) * 1000)
        if note:
            result["note"] = note
        result_path.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
        print("")
        print(f"[{status}] runId={args.run_id} exit={code} "
              f"passed={result['passed']} failed={result['failed']} "
              f"errors={result['errors']} skipped={result['skipped']} "
              f"notRun={len(result['notRun'])} ({result['durationMs']}ms)")
        print(f"日志: {log_path}")
        print(f"结果: {result_path}")
        return code

    # ── 读冻结的请求 ──
    if not request_path.is_file():
        log_path.write_text("缺少 request.json：请从面板重新点一次执行。\n", encoding="utf-8")
        return finish(2, "no-request", "缺少 request.json")
    try:
        request = json.loads(request_path.read_text(encoding="utf-8-sig"))
    except Exception as error:
        log_path.write_text(f"request.json 解析失败：{error}\n", encoding="utf-8")
        return finish(2, "no-request", "request.json 解析失败")

    result["scope"] = request.get("scope", "all")
    result["caseId"] = request.get("caseId", "")
    targets = request.get("targets") or []
    not_run = request.get("notRun") or []
    result["notRun"] = not_run
    result["cases"] = [t.get("caseId", "") for t in targets]

    test_file = Path(request.get("testFile") or (root / "tests" / "test_generated.py"))
    # 执行仍在原位置：不把测试文件换地方（那样会改变 conftest / __file__ / sys.path 的行为）。
    # 改为内容校验：准备时记了 SHA256，这里重算；不一致就拒绝执行，
    # 而不是默默跑成另一个版本。
    if not test_file.is_file():
        log_path.write_text(f"找不到测试文件 {test_file}。\n", encoding="utf-8")
        return finish(2, "no-test-file", f"找不到 {test_file.name}")

    expected_sha = str(request.get("testFileSha256") or "")
    if expected_sha:
        actual_sha = sha256_of(test_file)
        if actual_sha != expected_sha:
            message = ("测试文件在准备执行之后被修改过。\n"
                       "本次执行已作废，避免跑到和面板里不一致的内容；请重新点一次执行。\n"
                       f"文件：{test_file}\n准备时：{expected_sha}\n现在：  {actual_sha}\n")
            log_path.write_text(message, encoding="utf-8")
            print(message, flush=True)
            return finish(2, "test-file-changed", "测试文件在准备后被修改，请重新点执行")

    if not targets:
        note = "本次没有可执行的用例"
        if not_run:
            note += "（" + "、".join(n.get("caseId", "?") for n in not_run) + " 没有关联测试函数）"
        log_path.write_text(note + "\n", encoding="utf-8")
        return finish(2, "no-targets", note)

    # ── 精确节点执行：每个函数一个 nodeid，不再是 -k 名称匹配 ──
    command = [
        sys.executable, "-m", "pytest",
        "-v", "--tb=short", "--no-header", "-p", "no:warnings",
        f"--junitxml={junit_path}",
    ]
    command += [f"{test_file}::{t['func']}" for t in targets if t.get("func")]
    result["command"] = command

    env = dict(os.environ)
    env["PYTHONPATH"] = str(project) + (os.pathsep + env["PYTHONPATH"] if env.get("PYTHONPATH") else "")
    env["PYTHONIOENCODING"] = "utf-8"
    env["PYTHONUNBUFFERED"] = "1"

    print(f"runId: {args.run_id}")
    print(f"项目: {project}")
    print(f"范围: {'全部用例' if result['scope'] == 'all' else result['caseId']}"
          f"（{len(targets)} 条）")
    if not_run:
        print("注意：以下用例没有关联测试函数，未执行 -> " + "、".join(n.get("caseId", "?") for n in not_run))
    print("-" * 60, flush=True)

    # ── 边跑边写：日志用追加模式，每块都 flush ──
    import subprocess

    log_file = open(log_path, "w", encoding="utf-8", errors="replace")
    stop_reader = threading.Event()

    def pump(stream):
        """把子进程输出同时送到终端和日志文件，逐行 flush。"""
        try:
            for line in iter(stream.readline, ""):
                if line == "":
                    break
                sys.stdout.write(line)
                sys.stdout.flush()
                log_file.write(line)
                log_file.flush()
        finally:
            try:
                stream.close()
            except Exception:
                pass
            stop_reader.set()

    try:
        process = subprocess.Popen(
            command,
            cwd=str(project),
            env=env,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            encoding="utf-8",
            errors="replace",
            bufsize=1,
        )
    except Exception as error:
        log_file.write(f"启动 pytest 失败：{error}\n")
        log_file.close()
        return finish(2, "no-test-file", f"启动 pytest 失败：{error}")

    reader = threading.Thread(target=pump, args=(process.stdout,), daemon=True)
    reader.start()

    deadline = started + args.timeout
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
    if not stop_reader.is_set():
        kill_tree(process)
    try:
        log_file.close()
    except Exception:
        pass

    if timed_out:
        with open(log_path, "a", encoding="utf-8") as extra:
            extra.write(f"\n[执行超时，已终止（{args.timeout} 秒）]\n")
            extra.flush()
        result["tests"] = parse_junit(junit_path)
        apply_test_counts(result)
        return finish(3, "timeout", f"超过 {args.timeout} 秒")
    if interrupted:
        with open(log_path, "a", encoding="utf-8") as extra:
            extra.write("\n[执行被中断]\n")
            extra.flush()
        result["tests"] = parse_junit(junit_path)
        apply_test_counts(result)
        return finish(130, "interrupted", "执行被中断")

    code = process.returncode if process.returncode is not None else 1
    output = log_path.read_text(encoding="utf-8", errors="replace") if log_path.is_file() else ""
    result.update(parse_counts(output))
    result["tests"] = parse_junit(junit_path)
    apply_test_counts(result)

    if code == 0:
        # 退出 0 但有用例没跑（缺测试函数）时不能算“全部通过”。
        status = "partial" if not_run else "passed"
    elif code == 5:
        status = "no-tests"
    else:
        status = "failed"
    return finish(code, status)


def apply_test_counts(result: dict) -> None:
    """用 junit 的逐条结果校正总数（比解析 stdout 可靠）。"""
    tests = result.get("tests") or []
    if not tests:
        return
    result["passed"] = sum(1 for t in tests if t["outcome"] == "passed")
    result["failed"] = sum(1 for t in tests if t["outcome"] in ("failed", "error"))
    result["skipped"] = sum(1 for t in tests if t["outcome"] == "skipped")


def kill_tree(process) -> None:
    """连子进程树一起结束（Windows 上 pytest 可能有子进程）。"""
    if process.poll() is not None:
        return
    try:
        import subprocess

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


if __name__ == "__main__":
    sys.exit(main())