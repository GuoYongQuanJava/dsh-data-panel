"""覆盖率链路的单元测试：报告解析 + 桥接成报告字段。

覆盖的三种事实：
1. 有真实报告时，解析出正确的行/分支百分比；
2. 没有报告（或格式不认识）时，明确给出“未采集 + 原因”，绝不编数字；
3. bridge.py 能把 result.json 里的覆盖率写进 report-data.json 的 coverage 字段。

跑法：python -m pytest test_coverage.py -q
"""
import json
import subprocess
import sys
import textwrap
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent))

import bridge  # noqa: E402

ASSETS = Path(__file__).resolve().parents[2] / "dsh-data-panel" / "package" / "assets"
if not ASSETS.is_dir():
    # 插件目录可能在别处，按仓库相对位置兜底。
    ASSETS = Path(__file__).resolve().parents[2] / "package" / "assets"


def load_runner_module():
    """把 run_tests.py 当模块导入（它不依赖第三方包）。"""
    import importlib.util

    path = ASSETS / "run_tests.py"
    spec = importlib.util.spec_from_file_location("run_tests", path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


runner = load_runner_module()


# ────────────────────────────── 解析器 ──────────────────────────────

def test_coveragepy_json(tmp_path):
    report = tmp_path / "coverage.json"
    report.write_text(json.dumps({
        "totals": {
            "num_statements": 120,
            "covered_lines": 96,
            "num_branches": 40,
            "covered_branches": 30,
        }
    }), encoding="utf-8")

    stats = runner.parse_coverage_report(report, "coveragepy-json")
    assert stats["line"] == {"covered": 96, "total": 120, "percent": 80.0}
    assert stats["branch"] == {"covered": 30, "total": 40, "percent": 75.0}


def test_istanbul_summary(tmp_path):
    report = tmp_path / "coverage-summary.json"
    report.write_text(json.dumps({
        "total": {
            "lines": {"total": 200, "covered": 150, "pct": 75.0},
            "branches": {"total": 50, "covered": 20, "pct": 40.0},
        }
    }), encoding="utf-8")

    stats = runner.parse_coverage_report(report, "istanbul-summary")
    assert stats["line"]["percent"] == 75.0
    assert stats["branch"]["percent"] == 40.0


def test_go_cover_profile(tmp_path):
    report = tmp_path / "coverage.out"
    report.write_text(
        "mode: set\n"
        "example.com/x/a.go:3.20,5.2 2 1\n"
        "example.com/x/a.go:7.20,9.2 3 0\n"
        "example.com/x/b.go:1.1,2.2 5 2\n",
        encoding="utf-8",
    )

    stats = runner.parse_coverage_report(report, "go-cover")
    # 总语句 2+3+5=10；被覆盖 2+0+5=7
    assert stats["line"] == {"covered": 7, "total": 10, "percent": 70.0}
    assert stats["branch"] is None


def test_lcov(tmp_path):
    report = tmp_path / "lcov.info"
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
    assert stats["line"] == {"covered": 29, "total": 40, "percent": 72.5}
    assert stats["branch"] == {"covered": 3, "total": 10, "percent": 30.0}


def test_jacoco_xml(tmp_path):
    report = tmp_path / "jacoco.xml"
    report.write_text(textwrap.dedent("""\
        <?xml version="1.0" encoding="UTF-8"?>
        <report name="demo">
          <counter type="INSTRUCTION" missed="10" covered="90"/>
          <counter type="BRANCH" missed="6" covered="4"/>
          <counter type="LINE" missed="12" covered="48"/>
        </report>
        """), encoding="utf-8")

    stats = runner.parse_coverage_report(report, "jacoco")
    assert stats["line"] == {"covered": 48, "total": 60, "percent": 80.0}
    assert stats["branch"] == {"covered": 4, "total": 10, "percent": 40.0}


def test_cobertura_attributes(tmp_path):
    report = tmp_path / "coverage.xml"
    report.write_text(
        '<coverage lines-valid="100" lines-covered="85" '
        'branches-valid="20" branches-covered="11"/>',
        encoding="utf-8",
    )

    stats = runner.parse_coverage_report(report, "cobertura")
    assert stats["line"] == {"covered": 85, "total": 100, "percent": 85.0}
    assert stats["branch"] == {"covered": 11, "total": 20, "percent": 55.0}


def test_cobertura_without_attributes_counts_lines(tmp_path):
    report = tmp_path / "coverage.xml"
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
    assert stats["line"] == {"covered": 2, "total": 3, "percent": 66.7}


def test_unknown_format_raises():
    with pytest.raises(ValueError):
        runner.parse_coverage_report(Path("whatever"), "not-a-format")


# ────────────────────────────── 找文件 ──────────────────────────────

def test_locate_coverage_file_glob(tmp_path):
    nested = tmp_path / "coverage" / "abc123"
    nested.mkdir(parents=True)
    report = nested / "coverage.cobertura.xml"
    report.write_text("<coverage lines-valid='1' lines-covered='1'/>", encoding="utf-8")

    found = runner.locate_coverage_file(str(tmp_path / "coverage" / "**" / "coverage.cobertura.xml"), tmp_path)
    assert found == report


def test_locate_coverage_file_missing(tmp_path):
    assert runner.locate_coverage_file(str(tmp_path / "nope.xml"), tmp_path) is None


# ────────────────────────────── 桥接 ──────────────────────────────

def _write_run(tmp_path: Path, coverage: dict | None) -> Path:
    run_dir = tmp_path / "runs" / "r1"
    (run_dir / "snapshot").mkdir(parents=True)
    (run_dir / "snapshot" / "cases.json").write_text(json.dumps([{
        "caseId": "TC-1",
        "title": "用例一",
        "testType": "functional",
        "description": "",
        "input": "",
        "expected": "",
        "codeRef": "",
        "testFunc": "test_one",
        "status": "pending",
    }]), encoding="utf-8")
    result = {
        "runId": "r1",
        "startedAt": "2026-01-01T00:00:00+08:00",
        "status": "passed",
        "cases": ["TC-1"],
        "tests": [{"caseId": "TC-1", "func": "test_one", "outcome": "passed"}],
        "runner": {"id": "pytest", "label": "pytest"},
    }
    if coverage is not None:
        result["coverage"] = coverage
    path = run_dir / "result.json"
    path.write_text(json.dumps(result), encoding="utf-8")
    return path


def _bridge(tmp_path: Path, coverage) -> dict:
    run = _write_run(tmp_path, coverage)
    out = tmp_path / "report-data.json"
    code = subprocess.run(
        [sys.executable, str(Path(bridge.__file__)), "--run", str(run), "--out", str(out)],
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
    )
    assert code.returncode == 0, code.stderr
    return json.loads(out.read_text(encoding="utf-8"))


def test_bridge_writes_real_coverage(tmp_path):
    data = _bridge(tmp_path, {
        "available": True,
        "format": "coveragepy-json",
        "line": {"covered": 96, "total": 120, "percent": 80.0},
        "branch": {"covered": 30, "total": 40, "percent": 75.0},
    })
    assert data["modules"][0]["coverage"] == "-S 80.0% -B 75.0%"


def test_bridge_marks_unavailable_with_reason(tmp_path):
    data = _bridge(tmp_path, {
        "available": False,
        "reason": "需要 coverage.py 与 pytest-cov：python -m pip install coverage pytest-cov",
    })
    coverage = data["modules"][0]["coverage"]
    assert coverage.startswith("未采集")
    assert "pytest-cov" in coverage


def test_bridge_reports_unconfigured_when_absent(tmp_path):
    data = _bridge(tmp_path, None)
    assert data["modules"][0]["coverage"] == "未采集"


# ──────────────────── 端到端：runner 采集 → result.json ────────────────────

def _write_project(tmp_path: Path) -> Path:
    project = tmp_path / "proj"
    (project / "tests").mkdir(parents=True)
    (project / "tests" / "test_generated.py").write_text(
        "def test_one():\n    assert True\n\n"
        "def test_two():\n    assert True\n",
        encoding="utf-8",
    )
    return project


def _run_runner(tmp_path: Path, coverage: dict, pre_command: list | None = None) -> dict:
    """用真实 run_tests.py 跑一次，返回 result.json。"""
    project = _write_project(tmp_path)
    root = tmp_path / "assets"
    run_dir = root / "runs" / "r1"
    run_dir.mkdir(parents=True)
    (run_dir / "request.json").write_text(json.dumps({
        "runId": "r1",
        "scope": "all",
        "caseId": "",
        "project": str(project),
        "root": str(root),
        "testFile": str(project / "tests" / "test_generated.py"),
        "targets": [
            {"caseId": "TC-1", "func": "test_one"},
            {"caseId": "TC-2", "func": "test_two"},
        ],
        "notRun": [],
        "runner": {
            "id": "pytest",
            "label": "pytest",
            "language": "python",
            "mode": "batch",
            "testFile": str(project / "tests" / "test_generated.py"),
            "cwd": str(project),
            "command": [
                sys.executable, "-m", "pytest", "-q",
                f"--junitxml={run_dir / 'junit.xml'}", "{targets}",
            ],
            "targetArg": "{file}::{target}",
            "junit": str(run_dir / "junit.xml"),
            "env": {"PYTHONPATH": str(project), "PYTHONIOENCODING": "utf-8"},
            "timeoutSec": 120,
            "preCommand": pre_command or [],
            "coverage": coverage,
        },
    }), encoding="utf-8")

    completed = subprocess.run(
        [sys.executable, str(ASSETS / "run_tests.py"),
         "--project", str(project), "--root", str(root), "--run-id", "r1"],
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
    )
    result_path = run_dir / "result.json"
    assert result_path.is_file(), completed.stdout + completed.stderr
    return json.loads(result_path.read_text(encoding="utf-8"))


def test_runner_records_coverage_when_report_exists(tmp_path):
    report = tmp_path / "coverage.json"
    writer = (
        "import json, sys;"
        f"open(r'{report}', 'w', encoding='utf-8').write("
        "json.dumps({'totals': {'num_statements': 50, 'covered_lines': 40,"
        "'num_branches': 10, 'covered_branches': 5}}))"
    )
    assert isinstance(writer, str), "测试自身的脚本必须是单个字符串（不能用逗号拆成 tuple）"
    result = _run_runner(tmp_path, {
        "command": [sys.executable, "-c", writer],
        "format": "coveragepy-json",
        "file": str(report),
        "timeoutSec": 60,
    })

    coverage = result["coverage"]
    log_tail = (tmp_path / "assets" / "runs" / "r1" / "run.log").read_text(encoding="utf-8", errors="replace")[-900:]
    assert coverage["available"] is True, (coverage, log_tail)
    assert coverage["line"]["percent"] == 80.0
    assert coverage["branch"]["percent"] == 50.0
    assert Path(coverage["source"]) == report


def test_runner_degrades_gracefully_when_coverage_command_fails(tmp_path):
    result = _run_runner(tmp_path, {
        "command": [sys.executable, "-c", "import definitely_missing_module"],
        "format": "coveragepy-json",
        "file": str(tmp_path / "nope.json"),
        "hint": "需要 coverage.py 与 pytest-cov",
        "timeoutSec": 60,
    })

    coverage = result["coverage"]
    assert coverage["available"] is False
    assert "coverage.py" in coverage["reason"]
    # 覆盖率失败不能影响用例结论
    assert result["status"] in ("passed", "partial")


def test_coverage_expands_batch_targets(tmp_path):
    report = tmp_path / "coverage-targets.json"
    test_file = tmp_path / "proj" / "tests" / "test_generated.py"
    writer = (
        "import json,sys;"
        f"assert sys.argv[1:]==[{str(test_file) + '::test_one'!r},"
        f"{str(test_file) + '::test_two'!r}];"
        f"open({str(report)!r},'w',encoding='utf-8').write("
        "json.dumps({'totals':{'num_statements':2,'covered_lines':2}}))"
    )
    result = _run_runner(tmp_path, {
        "command": [sys.executable, "-c", writer, "{targets}"],
        "format": "coveragepy-json",
        "file": str(report),
        "timeoutSec": 60,
    })
    assert result["coverage"]["available"] is True
    assert result["coverage"]["line"]["percent"] == 100.0


def test_build_failure_skips_coverage(tmp_path):
    report = tmp_path / "should-not-exist.json"
    result = _run_runner(tmp_path, {
        "command": [sys.executable, "-c", f"open({str(report)!r},'w').write('ran')"],
        "format": "coveragepy-json",
        "file": str(report),
    }, pre_command=[sys.executable, "-c", "import sys; sys.exit(7)"])
    assert result["status"] == "build-failed"
    assert result["coverage"]["available"] is False
    assert not report.exists()
