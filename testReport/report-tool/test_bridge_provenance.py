"""报告桥接必须保留真实变量和值，并明确标出证据缺口。"""

import json
import importlib.util
import subprocess
import sys
from pathlib import Path

from schema import validate


BRIDGE = Path(__file__).with_name("bridge.py")
RUNNER = Path(__file__).resolve().parents[2] / "dsh-data-panel" / "package" / "assets" / "run_tests.py"


def build_report(tmp_path, case, test):
    run_dir = tmp_path / "runs" / "run-1"
    snapshot = run_dir / "snapshot"
    snapshot.mkdir(parents=True)
    (snapshot / "cases.json").write_text(json.dumps({"cases": [case]}, ensure_ascii=False), encoding="utf-8")
    result = {
        "runId": "run-1", "status": "passed", "startedAt": "2026-11-16T01:00:00Z",
        "project": str(tmp_path / "project"), "cases": [case["caseId"]], "tests": [test],
    }
    result_path = run_dir / "result.json"
    result_path.write_text(json.dumps(result, ensure_ascii=False), encoding="utf-8")
    proc = subprocess.run([sys.executable, str(BRIDGE), "--run", str(result_path)], capture_output=True, text=True)
    assert proc.returncode == 0, proc.stderr
    payload = json.loads((tmp_path / "reports" / "run-1" / "report-data.json").read_text(encoding="utf-8"))
    validate(payload)
    return payload["modules"][0]["cases"][0]


def test_named_values_follow_runtime_evidence(tmp_path):
    case = {
        "caseId": "TC-1", "title": "折扣", "testType": "functional", "testFunc": "test_discount",
        "input": "order_total([(50.0, 1)], member_level='Platinum')",
        "expected": "discount=50.0", "inputVariables": [{"name": "member_level", "value": "Platinum"}],
        "expectedOutputs": [{"name": "discount", "value": "50.0"}],
    }
    test = {"caseId": "TC-1", "func": "test_discount", "outcome": "failed",
            "actualOutputs": {"discount": "40.0"}, "message": "期望 50.0，得到 40.0"}
    output = build_report(tmp_path, case, test)
    assert output["inputs"] == [["member_level", "Platinum"]]
    assert output["outputs"] == [["discount", "50.0", "40.0"]]
    assert output["status"] == "failed"


def test_legacy_text_does_not_become_fake_variables(tmp_path):
    case = {"caseId": "TC-2", "title": "旧用例", "testType": "api", "testFunc": "test_api",
            "input": "请求体为 {}", "expected": "HTTP 200"}
    test = {"caseId": "TC-2", "func": "test_api", "outcome": "passed", "actual": "HTTP 200"}
    output = build_report(tmp_path, case, test)
    assert output["inputs"] == [] and output["outputs"] == []
    assert "输入条件（原始记录）：请求体为 {}" in output["description"]
    assert "实际输出（原始记录）：HTTP 200" in output["description"]


def test_missing_named_actual_is_not_copied_from_expected(tmp_path):
    case = {"caseId": "TC-3", "title": "缺实际值", "testType": "logic", "testFunc": "test_logic",
            "expectedOutputs": [{"name": "answer", "value": "42"}]}
    test = {"caseId": "TC-3", "func": "test_logic", "outcome": "passed"}
    output = build_report(tmp_path, case, test)
    assert output["outputs"] == [["answer", "42", "未采集"]]


def test_unknown_result_validates_as_unconfirmed(tmp_path):
    case = {"caseId": "TC-4", "title": "证据缺失", "testType": "boundary", "testFunc": "test_boundary"}
    test = {"caseId": "TC-4", "func": "test_boundary", "outcome": "unknown"}
    output = build_report(tmp_path, case, test)
    assert output["status"] == "unconfirmed"


def test_runner_parses_only_valid_named_json():
    spec = importlib.util.spec_from_file_location("dsh_runner_report_test", RUNNER)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    parsed = module.parse_actuals('ACTUAL_JSON[TC-1]: {"discount": 40.0, "ok": true, "items": [1, 2]}\n'
                                  'ACTUAL_JSON[TC-2]: {not-json}\n'
                                  'ACTUAL[TC-1]: raw value')
    assert parsed["named"] == {"TC-1": {"discount": "40.0", "ok": "true", "items": "[1, 2]"}}
    assert parsed["tagged"]["TC-1"] == "raw value"
