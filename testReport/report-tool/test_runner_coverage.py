"""run_tests.py 的覆盖率约定：必需时采不到要明确标「未完成」，并留补采证据。

验收点：
  3. VS 覆盖率失败时给出明确状态，支持对同一快照补采；
  覆盖率失败不得把测试结论也判成失败（「测试完成、覆盖率未完成」是两件事）。
"""

import hashlib
import json
import os
import subprocess
import sys
from pathlib import Path

import pytest


def _find_runner():
    here = Path(__file__).resolve().parent
    candidates = []
    env = os.environ.get("DSH_DATA_PANEL_ASSETS", "").strip()
    if env:
        candidates.append(Path(env))
    candidates += [
        here.parents[1] / "dsh-data-panel" / "package" / "assets",  # 仓库布局
        here.parents[1] / "package" / "assets",
        here / "assets",
    ]
    for candidate in candidates:
        path = candidate / "run_tests.py"
        if path.is_file():
            return path
    return None


RUNNER = _find_runner()

pytestmark = pytest.mark.skipif(RUNNER is None, reason="未找到插件资产 run_tests.py")


def _make_run(tmp_path, *, coverage_required, coverage_command, run_id="run-1"):
    project = tmp_path / "project"
    root = project / ".dsh" / "test-sessions" / "s1"
    run_dir = root / "runs" / run_id
    (run_dir / "snapshot").mkdir(parents=True)
    test_file = root / "tests" / "test_generated.py"
    test_file.parent.mkdir(parents=True)
    test_file.write_text("def test_one():\n    pass\n", encoding="utf-8")
    sha = hashlib.sha256(test_file.read_bytes()).hexdigest()
    cases_file = run_dir / "snapshot" / "cases.json"
    cases_file.write_text(json.dumps({"cases": [{"caseId": "TC-1"}]}), encoding="utf-8")

    request = {
        "runId": run_id,
        "root": str(root),
        "project": str(project),
        "scope": "case",
        "caseId": "TC-1",
        "testFile": str(test_file),
        "testFileSha256": sha,
        "casesFile": str(cases_file),
        "targets": [{"caseId": "TC-1", "func": "test_one"}],
        "runner": {
            "id": "custom",
            "label": "custom",
            "language": "python",
            "mode": "per-case",
            # 一条永远通过的“测试”：本测试只关心覆盖率约定。
            "command": [sys.executable, "-c", "import sys; sys.exit(0)", "{target}"],
            "targetArg": "{target}",
            "coverageRequired": coverage_required,
            "coverage": {
                "command": coverage_command,
                "format": "cobertura",
                "file": "coverage/coverage.xml",
            },
        },
    }
    (run_dir / "request.json").write_text(
        json.dumps(request, ensure_ascii=False), encoding="utf-8")
    return project, root, run_dir, request


def _run(tmp_path, run_dir, request, extra_args=()):
    args = [
        sys.executable, str(RUNNER),
        "--project", request["project"],
        "--root", request["root"],
        "--run-id", request["runId"],
        *extra_args,
    ]
    proc = subprocess.run(args, capture_output=True, text=True,
                          encoding="utf-8", errors="replace", timeout=120)
    result_path = run_dir / "result.json"
    result = json.loads(result_path.read_text(encoding="utf-8")) if result_path.is_file() else {}
    return proc, result


def _failing_coverage():
    return [sys.executable, "-c", "import sys; sys.exit(1)"]


def test_coverage_required_failure_is_reported_without_failing_the_run(tmp_path):
    project, root, run_dir, request = _make_run(
        tmp_path, coverage_required=True, coverage_command=_failing_coverage())
    proc, result = _run(tmp_path, run_dir, request)
    assert proc.returncode == 0, proc.stdout + proc.stderr

    # 测试本身跑完了 → 状态仍是 passed；覆盖率单独表达。
    assert result["status"] == "passed"
    assert result["coverageRequired"] is True
    assert result["coverageStatus"] == "failed"
    assert "测试完成、覆盖率未完成" in result["note"]
    assert result["coverage"]["available"] is False

    # 失败也留证据，供同一快照补采。
    attempt = Path(result["coverageAttempt"])
    assert attempt.is_file()
    payload = json.loads(attempt.read_text(encoding="utf-8"))
    assert payload["mode"] == "run"
    assert payload["targets"] == ["TC-1"]
    assert payload["coverage"]["available"] is False


def test_coverage_not_required_failure_degrades_quietly(tmp_path):
    project, root, run_dir, request = _make_run(
        tmp_path, coverage_required=False, coverage_command=_failing_coverage())
    proc, result = _run(tmp_path, run_dir, request)
    assert proc.returncode == 0, proc.stdout + proc.stderr
    assert result["status"] == "passed"
    assert result["coverageStatus"] == "skipped"
    assert "测试完成、覆盖率未完成" not in result["note"]


def test_coverage_only_recollects_on_the_same_snapshot(tmp_path):
    project, root, run_dir, request = _make_run(
        tmp_path, coverage_required=True, coverage_command=_failing_coverage())
    _, first = _run(tmp_path, run_dir, request)
    assert first["coverageStatus"] == "failed"
    tests_before = first["tests"]

    # 补采：沿用同一 runId / 同一批目标，只重采覆盖率。
    proc, second = _run(tmp_path, run_dir, request, extra_args=("--coverage-only",))
    # 采集仍然失败 → 非 0 退出，但证据要再记一条，且不重跑用例。
    assert proc.returncode == 2
    assert second["tests"] == tests_before
    attempts = sorted((run_dir / "coverage-attempts").glob("attempt-*.json"))
    assert [path.name for path in attempts] == ["attempt-01.json", "attempt-02.json"]
    assert second["coverageAttempts"] == ["attempt-01.json", "attempt-02.json"]
    assert second["coverageStatus"] == "failed"
    assert json.loads(attempts[1].read_text(encoding="utf-8"))["mode"] == "coverage-only"


def test_coverage_only_without_request_is_refused(tmp_path):
    project = tmp_path / "project"
    root = project / ".dsh" / "test-sessions" / "s1"
    run_dir = root / "runs" / "run-9"
    run_dir.mkdir(parents=True)
    request = {"runId": "run-9", "root": str(root), "project": str(project)}
    proc, result = _run(tmp_path, run_dir, request, extra_args=("--coverage-only",))
    assert proc.returncode == 2
    assert result.get("status") == "no-request"