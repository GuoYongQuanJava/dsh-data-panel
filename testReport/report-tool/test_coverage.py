"""覆盖率链路的单元测试（v2，纯脚本，不依赖 pytest）。

覆盖的事实：
1. 有真实报告时，解析出正确的括号指标；
2. 没有报告/格式不认识时，明确给出"未采集 + 原因"，绝不编数字；
3. bridge 把覆盖率写进 phases[].functions[].coverage；
4. runner 能按 coverage.command + postCommand 两步采集，并容忍失败；
5. 旧版 VS XML（vs-codecoverage-xml）的块/行口径单独可解析。

部署差异：解析器与采集链路需要插件自带的 `assets/run_tests.py`。
如果当前部署里没有它（例如只拷贝了 testReport 目录），这两段会明确 SKIP，
bridge 部分仍照常验证；可用 `DSH_DATA_PANEL_ASSETS` 指向该目录。

运行：python test_coverage.py
"""
import json
import shutil
import subprocess
import sys
import tempfile
import textwrap
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import bridge  # noqa: E402

failures = []
tmp = Path(tempfile.mkdtemp(prefix="rpt-cov-"))


def check(condition, message):
    print(("  PASS  " if condition else "  FAIL  ") + message)
    if not condition:
        failures.append(message)


def find_assets():
    """定位插件自带 assets（run_tests.py 所在目录）；部署形态不同，逐个候选试。"""
    import os

    candidates = []
    env = os.environ.get("DSH_DATA_PANEL_ASSETS", "").strip()
    if env:
        candidates.append(Path(env))
    here = Path(__file__).resolve().parent
    candidates += [
        here.parents[2] / "dsh-data-panel" / "package" / "assets",  # 仓库布局
        here.parents[2] / "package" / "assets",
        here / "assets",
    ]
    for candidate in candidates:
        if (candidate / "run_tests.py").is_file():
            return candidate
    return None


ASSETS = find_assets()


def load_runner_module():
    import importlib.util

    path = ASSETS / "run_tests.py"
    spec = importlib.util.spec_from_file_location("run_tests", path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def stat(covered, total):
    return {"covered": covered, "total": total, "percent": round(covered / total * 100, 1)}


# ────────────────────────────── 解析器 + 找文件 ──────────────────────────────
def check_parser(runner):
    print("== 解析器 ==")

    report = tmp / "coverage.json"
    report.write_text(json.dumps({"totals": {"num_statements": 120, "covered_lines": 96,
                                             "num_branches": 40, "covered_branches": 30}}), encoding="utf-8")
    stats = runner.parse_coverage_report(report, "coveragepy-json")
    check(stats["line"] == stat(96, 120), f"coveragepy-json 行 {stats['line']}")
    check(stats["branch"] == stat(30, 40), f"coveragepy-json 分支 {stats['branch']}")

    report = tmp / "coverage-summary.json"
    report.write_text(json.dumps({"total": {"lines": {"total": 200, "covered": 150, "pct": 75.0},
                                            "branches": {"total": 50, "covered": 20, "pct": 40.0}}}),
                      encoding="utf-8")
    stats = runner.parse_coverage_report(report, "istanbul-summary")
    check(stats["line"]["percent"] == 75.0, f"istanbul 行 {stats['line']['percent']}")
    check(stats["branch"]["percent"] == 40.0, f"istanbul 分支 {stats['branch']['percent']}")

    report = tmp / "coverage.out"
    report.write_text("mode: set\n"
                      "example.com/x/a.go:3.20,5.2 2 1\n"
                      "example.com/x/a.go:7.20,9.2 3 0\n"
                      "example.com/x/b.go:1.1,2.2 5 2\n", encoding="utf-8")
    stats = runner.parse_coverage_report(report, "go-cover")
    check(stats["line"] == stat(7, 10), f"go-cover 行 {stats['line']}")
    check(stats["branch"] is None, "go-cover 不伪造分支")

    report = tmp / "lcov.info"
    report.write_text(textwrap.dedent("""\
        SF:src/a.cpp
        LF:10
        LH:8
        BRF:4
        BRH:3
        end_of_record
        SF:src/b.cpp
        LF:30
        LH:21
        BRF:6
        BRH:0
        end_of_record
        """), encoding="utf-8")
    stats = runner.parse_coverage_report(report, "lcov")
    check(stats["line"] == stat(29, 40), f"lcov 行 {stats['line']}")
    check(stats["branch"] == stat(3, 10), f"lcov 分支 {stats['branch']}")

    report = tmp / "jacoco.xml"
    report.write_text(textwrap.dedent("""\
        <?xml version="1.0" encoding="UTF-8"?>
        <report name="demo">
          <counter type="INSTRUCTION" missed="10" covered="90"/>
          <counter type="BRANCH" missed="6" covered="4"/>
          <counter type="LINE" missed="12" covered="48"/>
        </report>
        """), encoding="utf-8")
    stats = runner.parse_coverage_report(report, "jacoco")
    check(stats["line"] == stat(48, 60), f"jacoco 行 {stats['line']}")
    check(stats["branch"] == stat(4, 10), f"jacoco 分支 {stats['branch']}")

    report = tmp / "cobertura-attr.xml"
    report.write_text('<coverage lines-valid="100" lines-covered="85" '
                      'branches-valid="20" branches-covered="11"/>', encoding="utf-8")
    stats = runner.parse_coverage_report(report, "cobertura")
    check(stats["line"] == stat(85, 100), f"cobertura 行 {stats['line']}")
    check(stats["branch"] == stat(11, 20), f"cobertura 分支 {stats['branch']}")

    report = tmp / "cobertura-lines.xml"
    report.write_text(textwrap.dedent("""\
        <coverage>
          <packages><package name="p"><classes>
            <class filename="a.py">
              <lines>
                <line number="1" hits="1"/>
                <line number="2" hits="0"/>
                <line number="3" hits="3"/>
              </lines>
            </class>
          </classes></package></packages>
        </coverage>
        """), encoding="utf-8")
    stats = runner.parse_coverage_report(report, "cobertura")
    check(stats["line"] == stat(2, 3), f"cobertura 逐行统计 {stats['line']}")

    # 旧版 VS：只有块和行，没有语句/分支/MC-DC
    report = tmp / "vs-coverage.xml"
    report.write_text(textwrap.dedent("""\
        <?xml version="1.0" encoding="UTF-8" ?>
        <results>
          <modules>
            <module name="tests.exe" path="tests.exe" id="ID1"
                    block_coverage="46.43" line_coverage="50.00"
                    blocks_covered="13" blocks_not_covered="15"
                    lines_covered="12" lines_partially_covered="2" lines_not_covered="10">
              <functions>
                <function id="1" name="addLine" block_coverage="50.00" line_coverage="50.00"
                          blocks_covered="1" blocks_not_covered="1"
                          lines_covered="1" lines_partially_covered="0" lines_not_covered="1"/>
              </functions>
            </module>
          </modules>
        </results>
        """), encoding="utf-8")
    stats = runner.parse_coverage_report(report, "vs-codecoverage-xml")
    check(stats["block"] is not None and stats["block"]["total"] == 28,
          f"VS 块总数 = 13+15 = 28（实际 {stats['block']}）")
    check(stats["line"]["total"] == 24, f"VS 行总数 = 12+2+10 = 24（实际 {stats['line']['total']}）")
    check(stats["branch"] is None, "VS 旧版没有分支口径，不伪造")
    check(stats.get("statement") is None, "VS 旧版没有语句口径，不伪造")

    report = tmp / "vs-coverage-empty.xml"
    report.write_text('<?xml version="1.0" encoding="UTF-8" ?>\n<results/>', encoding="utf-8")
    try:
        runner.parse_coverage_report(report, "vs-codecoverage-xml")
        check(False, "VS 空报告应报错（不能当成 0%）")
    except ValueError as exc:
        check("AllowLowIntegrityProcesses" in str(exc) or "空报告" in str(exc),
              f"VS 空报告给出可操作原因：{str(exc)[:50]}…")

    try:
        runner.parse_coverage_report(Path("whatever"), "not-a-format")
        check(False, "未知格式应抛 ValueError")
    except ValueError:
        check(True, "未知格式抛 ValueError")

    print("\n== 找报告文件 ==")
    nested = tmp / "covglob" / "abc123"
    nested.mkdir(parents=True)
    report = nested / "coverage.cobertura.xml"
    report.write_text("<coverage lines-valid='1' lines-covered='1'/>", encoding="utf-8")
    found = runner.locate_coverage_file(str(tmp / "covglob" / "**" / "coverage.cobertura.xml"), tmp)
    check(found == report, f"glob 取最新报告：{found}")
    check(runner.locate_coverage_file(str(tmp / "nope.xml"), tmp) is None, "找不到时返回 None")


# ────────────────────────────── 桥接 ──────────────────────────────
def check_bridge():
    print("\n== bridge 写覆盖率 ==")

    def write_run(base: Path, coverage) -> Path:
        run_dir = base / "runs" / "r1"
        (run_dir / "snapshot").mkdir(parents=True)
        (run_dir / "snapshot" / "cases.json").write_text(json.dumps([{
            "caseId": "TC-1", "title": "用例一", "testType": "functional",
            "description": "", "input": "", "expected": "", "codeRef": "",
            "testFunc": "test_one", "status": "pending",
            "subjectFunction": "src/a.cpp::addLine",
        }]), encoding="utf-8")
        result = {
            "runId": "r1",
            "startedAt": "2026-01-01T00:00:00+08:00",
            "status": "passed",
            "cases": ["TC-1"],
            "tests": [{"caseId": "TC-1", "func": "test_one", "outcome": "passed"}],
            "runner": {"id": "gtest-batch-cov", "label": "GoogleTest (batch + VS 覆盖率)"},
        }
        if coverage is not None:
            result["coverage"] = coverage
        path = run_dir / "result.json"
        path.write_text(json.dumps(result), encoding="utf-8")
        return path

    def do_bridge(base: Path, coverage) -> dict:
        run = write_run(base, coverage)
        out = base / "report-data.json"
        proc = subprocess.run([sys.executable, str(Path(bridge.__file__)), "--run", str(run),
                               "--out", str(out)],
                              capture_output=True, text=True, encoding="utf-8", errors="replace")
        assert proc.returncode == 0, proc.stderr
        return json.loads(out.read_text(encoding="utf-8"))

    def func_of(data: dict) -> dict:
        return data["phases"][0]["functions"][0]

    data = do_bridge(tmp / "b1", {
        "available": True,
        "line": stat(96, 120),
        "branch": stat(30, 40),
        "block": stat(13, 28),
    })
    cov_text = func_of(data)["coverage"]
    check("-L 80.0%" in cov_text, f"行覆盖率用 -L 标签：{cov_text}")
    check("-B 75.0%" in cov_text, f"分支覆盖率用 -B 标签：{cov_text}")
    check("-BK 46.4%" in cov_text, f"块覆盖率用 -BK 标签：{cov_text}")
    check("-S " not in cov_text, "行覆盖率没有被错写成 -S")

    data = do_bridge(tmp / "b2", {"available": False, "reason": "本次未配置覆盖率采集"})
    cov_text = func_of(data)["coverage"]
    check(cov_text.startswith("未采集"), f"未采集如实标注：{cov_text}")
    check("未配置" in cov_text, "未采集附带原因")

    data = do_bridge(tmp / "b3", None)
    check(func_of(data)["coverage"] == "未采集", "完全没有覆盖率字段时写未采集")


# ──────────────────── 端到端：runner 采集 → result.json ────────────────────
def check_runner(runner):
    print("\n== runner 采集链路 ==")

    def make_project(base: Path) -> Path:
        project = base / "proj"
        (project / "tests").mkdir(parents=True)
        (project / "tests" / "test_generated.py").write_text("x = 1\n", encoding="utf-8")
        return project

    def py_writer(path: Path, payload: dict) -> list:
        code = f"import json;open(r'{path}','w',encoding='utf-8').write({json.dumps(json.dumps(payload))})"
        return [sys.executable, "-c", code]

    def run_runner(base: Path, coverage: dict, pre_command=None) -> dict:
        project = make_project(base)
        root = base / "assets"
        run_dir = root / "runs" / "r1"
        run_dir.mkdir(parents=True)
        (run_dir / "request.json").write_text(json.dumps({
            "runId": "r1",
            "scope": "all",
            "caseId": "",
            "project": str(project),
            "root": str(root),
            "testFile": str(project / "tests" / "test_generated.py"),
            "targets": [{"caseId": "TC-1", "func": "test_one"},
                        {"caseId": "TC-2", "func": "test_two"}],
            "notRun": [],
            "runner": {
                "id": "gtest-batch-cov",
                "label": "GoogleTest (batch + VS 覆盖率)",
                "language": "cpp",
                "mode": "per-case",
                # 不依赖 pytest：每条用例跑一个必然成功的进程，{target} 由 runner 展开
                "command": [sys.executable, "-c", "import sys", "{target}"],
                "targetArg": "{target}",
                "testFile": str(project / "tests" / "test_generated.py"),
                "cwd": str(project),
                "junit": "",
                "env": {"PYTHONIOENCODING": "utf-8"},
                "timeoutSec": 120,
                "preCommand": pre_command or [],
                "coverage": coverage,
            },
        }), encoding="utf-8")

        proc = subprocess.run([sys.executable, str(ASSETS / "run_tests.py"),
                               "--project", str(project), "--root", str(root), "--run-id", "r1"],
                              capture_output=True, text=True, encoding="utf-8", errors="replace")
        result_path = run_dir / "result.json"
        assert result_path.is_file(), proc.stdout + proc.stderr
        return json.loads(result_path.read_text(encoding="utf-8"))

    base = tmp / "r4"
    report = base / "coverage.json"
    result = run_runner(base, {
        "command": py_writer(report, {"totals": {"num_statements": 50, "covered_lines": 40,
                                                 "num_branches": 10, "covered_branches": 5}}),
        "format": "coveragepy-json",
        "file": str(report),
        "timeoutSec": 60,
    })
    cov = result["coverage"]
    check(cov["available"] is True, f"runner 采到覆盖率（{cov.get('reason', '')}）")
    check(cov["line"]["percent"] == 80.0, f"行百分比 {cov['line']['percent']}")
    check(cov["branch"]["percent"] == 50.0, f"分支百分比 {cov['branch']['percent']}")
    check(Path(cov["source"]) == report, "source 指向真实报告文件")

    base = tmp / "r5"
    result = run_runner(base, {
        "command": [sys.executable, "-c", "import definitely_missing_module"],
        "format": "coveragepy-json",
        "file": str(base / "nope.json"),
        "hint": "需要 coverage.py 与 pytest-cov",
        "timeoutSec": 60,
    })
    cov = result["coverage"]
    check(cov["available"] is False, "采集失败记为未采集")
    check("coverage.py" in cov["reason"], f"失败原因带 hint：{cov['reason'][:60]}")
    check(result["status"] in ("passed", "partial", "failed"),
          f"用例结论不受覆盖率失败影响：{result['status']}")

    # 两步采集：command 不产出报告，postCommand 才写
    base = tmp / "r6"
    report = base / "two-step.json"
    result = run_runner(base, {
        "command": [sys.executable, "-c", "pass"],
        "postCommand": py_writer(report, {"totals": {"num_statements": 10, "covered_lines": 5}}),
        "format": "coveragepy-json",
        "file": str(report),
        "timeoutSec": 60,
    })
    cov = result["coverage"]
    check(cov["available"] is True, f"两步采集（collect→post）成功：{cov.get('reason', '')}")
    check(cov["line"]["percent"] == 50.0, f"两步采集的行百分比 {cov.get('line')}")

    # 构建失败不采集
    base = tmp / "r7"
    report = base / "should-not-exist.json"
    result = run_runner(base, {
        "command": py_writer(report, {"totals": {"num_statements": 1, "covered_lines": 1}}),
        "format": "coveragepy-json",
        "file": str(report),
    }, pre_command=[sys.executable, "-c", "import sys; sys.exit(7)"])
    check(result["status"] == "build-failed", f"构建失败状态：{result['status']}")
    check(result["coverage"]["available"] is False, "构建失败不采集覆盖率")
    check(not report.exists(), "构建失败时覆盖率命令没有执行")


# ────────────────────────────── 主流程 ──────────────────────────────
if ASSETS is not None:
    runner_module = load_runner_module()
    check_parser(runner_module)
else:
    print("  (SKIP) 未找到插件 assets/run_tests.py —— 跳过“解析器”与“采集链路”；bridge 部分照常验证")
    print("         可设 DSH_DATA_PANEL_ASSETS=<dsh-data-panel>/package/assets 指向它")

check_bridge()

if ASSETS is not None:
    check_runner(runner_module)

shutil.rmtree(tmp, ignore_errors=True)

print()
if failures:
    print(f"FAILED {len(failures)}: {failures}")
    sys.exit(1)
print("ALL COVERAGE TESTS PASSED")