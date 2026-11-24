"""报告桥接必须保留真实变量和值，并明确标出证据缺口。"""

import json
import importlib.util
import subprocess
import sys
from pathlib import Path
import os

import pytest

from schema import validate


BRIDGE = Path(__file__).with_name("bridge.py")


def _find_runner():
    """定位插件资产 run_tests.py；部署形态不同，逐个候选试。"""
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
    # 子进程输出统一按 UTF-8 解：Windows 上默认按 cp936 读，会抛 UnicodeDecodeError 线程告警。
    proc = subprocess.run([sys.executable, str(BRIDGE), "--run", str(result_path)],
                          capture_output=True, text=True, encoding="utf-8", errors="replace")
    assert proc.returncode == 0, proc.stderr
    payload = json.loads((tmp_path / "reports" / "run-1" / "report-data.json").read_text(encoding="utf-8"))
    validate(payload)
    return payload["phases"][0]["functions"][0]["cases"][0]


def build_scope_report(tmp_path, test_scope):
    """构造含 testScope 的 result，跑 bridge，返回 sourceScope 部分。"""
    case = {"caseId": "TC-S", "title": "scope-test", "testType": "functional", "testFunc": "test_scope"}
    test = {"caseId": "TC-S", "func": "test_scope", "outcome": "passed"}
    run_dir = tmp_path / "runs" / "run-1"
    snapshot = run_dir / "snapshot"
    snapshot.mkdir(parents=True)
    (snapshot / "cases.json").write_text(json.dumps({"cases": [case]}, ensure_ascii=False), encoding="utf-8")
    result = {
        "runId": "run-1", "status": "passed", "startedAt": "2026-11-16T01:00:00Z",
        "project": str(tmp_path / "project"), "cases": [case["caseId"]], "tests": [test],
        "testScope": test_scope,
    }
    result_path = run_dir / "result.json"
    result_path.write_text(json.dumps(result, ensure_ascii=False), encoding="utf-8")
    proc = subprocess.run([sys.executable, str(BRIDGE), "--run", str(result_path)],
                          capture_output=True, text=True, encoding="utf-8", errors="replace")
    assert proc.returncode == 0, proc.stderr
    payload = json.loads((tmp_path / "reports" / "run-1" / "report-data.json").read_text(encoding="utf-8"))
    validate(payload)
    return payload["scope"]["sourceScope"]



def test_named_values_follow_runtime_evidence(tmp_path):
    case = {
        "caseId": "TC-1", "title": "折扣", "testType": "functional", "testFunc": "test_discount",
        "input": "order_total([(50.0, 1)], member_level='Platinum')",
        "expected": "discount=50.0", "inputVariables": [{"name": "member_level", "value": "Platinum"}],
        "expectedOutputs": [{"name": "discount", "value": "50.0"}],
    }
    test = {"caseId": "TC-1", "func": "test_discount", "outcome": "failed",
            "actualOutputs": [{"name": "discount", "value": "40.0"}], "message": "期望 50.0，得到 40.0"}
    output = build_report(tmp_path, case, test)
    assert output["inputs"] == [["member_level", "Platinum"]]
    assert output["outputs"] == [["discount", "50.0", "40.0"]]
    assert output["status"] == "failed"


def test_legacy_text_goes_to_its_own_column_not_description(tmp_path):
    """缺结构化变量时，原始文本进各自的表格列；测试说明里不得混入输入/输出。"""
    case = {"caseId": "TC-2", "title": "旧用例", "testType": "api", "testFunc": "test_api",
            "input": "请求体为 {}", "expected": "HTTP 200"}
    test = {"caseId": "TC-2", "func": "test_api", "outcome": "passed", "actual": "HTTP 200"}
    output = build_report(tmp_path, case, test)
    # 输入进「输入」列，预期 + 实际进同一行的「预期 / 实际」列。
    assert output["inputs"] == [["原始输入", "请求体为 {}"]]
    assert output["outputs"] == [["预期结果", "HTTP 200", "HTTP 200"]]
    # 测试说明只放场景说明，不再拼「（原始记录）」字样。
    assert "输入条件（原始记录）" not in output["description"]
    assert "实际输出（原始记录）" not in output["description"]


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
    if RUNNER is None:
        pytest.skip("未找到插件资产 run_tests.py（可用 DSH_DATA_PANEL_ASSETS 指向所在目录）")
    spec = importlib.util.spec_from_file_location("dsh_runner_report_test", RUNNER)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    parsed = module.parse_actuals('ACTUAL_JSON[TC-1]: {"discount": 40.0, "ok": true, "items": [1, 2]}\n'
                                  'ACTUAL_JSON[TC-2]: {not-json}\n'
                                  'ACTUAL[TC-1]: raw value')
    assert parsed["named"] == {
        "TC-1": [
            {"name": "discount", "value": "40.0"},
            {"name": "ok", "value": "true"},
            {"name": "items", "value": "[1, 2]"},
        ]
    }
    assert parsed["tagged"]["TC-1"] == "raw value"


def test_missing_scope_returns_available_false(tmp_path):
    source_scope = build_scope_report(tmp_path, {"status": "missing"})
    assert source_scope["available"] is False


def test_invalid_scope_returns_available_false(tmp_path):
    source_scope = build_scope_report(tmp_path, {"status": "invalid"})
    assert source_scope["available"] is False


def test_empty_inventory_returns_available_false(tmp_path):
    source_scope = build_scope_report(tmp_path, {"inventory": {"files": []}})
    assert source_scope["available"] is False


def test_rawWarnings_preserved_in_scope(tmp_path):
    source_scope = build_scope_report(tmp_path, {
        "status": "warning",
        "inventory": {"files": [{"path": "src/a.cpp", "status": "tested", "functions": []}]},
        "warnings": ["foo"],
        "rawWarnings": ["bar", "baz"],
    })
    assert source_scope["available"] is True
    assert source_scope["rawWarnings"] == ["bar", "baz"]


def test_failure_summary_is_chinese_and_keeps_evidence():
    import bridge as bridge_module

    evidence = {
        "message": (r"E:\proj\tests\test_generated.cpp:222" + "\n"
                    "Expected equality of these values:\n  0.00\n    Which is: 0\n  pay\n    Which is: -180"),
    }
    text = bridge_module.summarize_failure(evidence)
    assert "断言失败" in text
    assert "pay" in text and "0.00" in text and "-180" in text
    assert "test_generated.cpp:222" in text
    assert "Expected equality" not in text


def test_failure_summary_falls_back_for_unknown_text():
    import bridge as bridge_module

    text = bridge_module.summarize_failure({"message": "something odd happened"})
    assert text.startswith("测试判定失败：")
    assert bridge_module.summarize_failure(None, "未执行") == "未执行"


def test_unit_label_uses_short_function_name():
    import bridge as bridge_module

    assert bridge_module._unit_label("src/order.cpp::Order::payable") == "payable单元测试"
    assert bridge_module._unit_label("pickPWL") == "pickPWL单元测试"
    assert bridge_module._unit_label("pickPWL单元测试") == "pickPWL单元测试"


def test_cn_time_formats_iso_timestamp():
    import re as re_module

    import bridge as bridge_module

    formatted = bridge_module.cn_time("2026-11-16T01:00:00Z")
    assert re_module.fullmatch(r"\d{4}/\d{2}/\d{2} \d{2}:\d{2}", formatted), formatted
    assert bridge_module.cn_time("") == ""
    assert bridge_module.cn_time("不是时间") == "不是时间"


def test_case_executed_at_falls_back_to_run_start(tmp_path):
    case = {"caseId": "TC-9", "title": "时间回填", "testType": "functional", "testFunc": "test_t"}
    # tests[] 里没有 startedAt，应该用 result.startedAt 回填执行时间
    test = {"caseId": "TC-9", "func": "test_t", "outcome": "passed"}
    output = build_report(tmp_path, case, test)
    assert output["executedAt"], "执行时间不应该为空"
    assert "/" in output["executedAt"]
