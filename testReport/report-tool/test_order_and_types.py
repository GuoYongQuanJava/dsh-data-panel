"""报告顺序必须确定、变量值不得因类型被丢掉。

这两件事都曾经出过问题：
* 阶段计划随机（按用例数贪心装桶 + 随机 seed），同一份快照两次生成的 Word 顺序不同；
* 变量值只接受字符串，0 / false / null / 数组 / 对象在 bridge 里被静默丢掉。
"""

import json
import subprocess
import sys
from pathlib import Path

from schema import validate

BRIDGE = Path(__file__).with_name("bridge.py")


def _case(case_id, sequence, title, subject, test_func, **extra):
    case = {
        "caseId": case_id,
        "sequence": sequence,
        "title": title,
        "testType": "functional",
        "subjectFunction": subject,
        "testFunc": test_func,
    }
    case.update(extra)
    return case


def _write_run(tmp_path, cases, tests=None):
    run_dir = tmp_path / "runs" / "run-1"
    snapshot = run_dir / "snapshot"
    snapshot.mkdir(parents=True)
    (snapshot / "cases.json").write_text(
        json.dumps({"cases": cases}, ensure_ascii=False), encoding="utf-8")
    result = {
        "runId": "run-1",
        "status": "passed",
        "startedAt": "2026-11-23T10:00:00Z",
        "project": str(tmp_path / "project"),
        "cases": [case["caseId"] for case in cases],
        "tests": tests if tests is not None else [
            {"caseId": case["caseId"], "func": case["testFunc"], "outcome": "passed"}
            for case in cases
        ],
    }
    result_path = run_dir / "result.json"
    result_path.write_text(json.dumps(result, ensure_ascii=False), encoding="utf-8")
    return result_path


def _run_bridge(result_path, tmp_path):
    proc = subprocess.run(
        [sys.executable, str(BRIDGE), "--run", str(result_path)],
        capture_output=True, text=True, encoding="utf-8", errors="replace",
    )
    assert proc.returncode == 0, proc.stderr
    payload = json.loads(
        (tmp_path / "reports" / "run-1" / "report-data.json").read_text(encoding="utf-8"))
    return validate(payload), payload


def _order(payload):
    """[(函数名, [caseId, ...]), ...] —— 按报告里的真实顺序。"""
    return [
        (func["functionId"], [case["id"] for case in func["cases"]])
        for phase in payload["phases"]
        for func in phase["functions"]
    ]


def _mixed_cases():
    # 故意打乱：函数按首次出现是 addLine → subtotal；函数内编号乱序。
    return [
        _case("BJ-PKG-ADD_LINE-T003.CTD", "T003", "addLine-边界测试",
              "src/order.cpp::Order::addLine", "OrderAddLineTest.Boundary"),
        _case("GN-PKG-ADD_LINE-T001.CTD", "T001", "addLine-功能测试",
              "src/order.cpp::Order::addLine", "OrderAddLineTest.Normal"),
        _case("LJ-PKG-ADD_LINE-T010.CTD", "T010", "addLine-逻辑测试",
              "src/order.cpp::Order::addLine", "OrderAddLineTest.Logic"),
        _case("GN-PKG-ADD_LINE-T002.CTD", "T002", "addLine-功能测试",
              "src/order.cpp::Order::addLine", "OrderAddLineTest.Normal2"),
        _case("BJ-PKG-SUBTOTAL-T002.CTD", "T002", "subtotal-边界测试",
              "src/pay.cpp::payable", "PayableTest.Boundary"),
        _case("GN-PKG-SUBTOTAL-T001.CTD", "T001", "subtotal-功能测试",
              "src/pay.cpp::payable", "PayableTest.Normal"),
    ]


def test_function_order_follows_first_appearance_and_cases_sort_numerically(tmp_path):
    result_path = _write_run(tmp_path, _mixed_cases())
    _, payload = _run_bridge(result_path, tmp_path)
    order = _order(payload)
    assert [name for name, _ in order] == ["src/order.cpp::Order::addLine", "src/pay.cpp::payable"]
    add_line = order[0][1]
    # 数字排序：T002 在 T010 之前；字符串排序会把 T010 排到 T002 前面。
    assert add_line == [
        "GN-PKG-ADD_LINE-T001.CTD",
        "GN-PKG-ADD_LINE-T002.CTD",
        "BJ-PKG-ADD_LINE-T003.CTD",
        "LJ-PKG-ADD_LINE-T010.CTD",
    ]
    # 同一个函数的用例必须连续，不能被拆到多个阶段。
    seen = set()
    for name, _ in order:
        assert name not in seen, f"{name} 被拆到了多个阶段"
        seen.add(name)


def test_same_snapshot_twice_gives_identical_order(tmp_path):
    cases = _mixed_cases()
    result_path = _write_run(tmp_path, cases)
    _, first = _run_bridge(result_path, tmp_path)
    first_order = _order(first)
    # 第二次：用同一份快照、同一个 run 目录（会读到上一次的 report-plan.json）。
    _, second = _run_bridge(result_path, tmp_path)
    assert _order(second) == first_order


def test_legacy_random_plan_is_discarded(tmp_path):
    cases = _mixed_cases()
    result_path = _write_run(tmp_path, cases)
    report_dir = tmp_path / "reports" / "run-1"
    report_dir.mkdir(parents=True)
    # 旧版随机计划：没有 planVersion，函数顺序还被反着写。
    (report_dir / "report-plan.json").write_text(json.dumps({
        "schemaVersion": "2.0",
        "seed": 123456,
        "phaseCount": 2,
        "phases": [
            {"phaseId": "phase-1", "name": "Sprint1", "order": 1,
             "functionIds": ["src/pay.cpp::payable"]},
            {"phaseId": "phase-2", "name": "Sprint2", "order": 2,
             "functionIds": ["src/order.cpp::Order::addLine"]},
        ],
    }, ensure_ascii=False), encoding="utf-8")

    _, payload = _run_bridge(result_path, tmp_path)
    # 旧计划不得继续控制新报告：函数顺序回到首次出现顺序。
    assert [name for name, _ in _order(payload)] == [
        "src/order.cpp::Order::addLine", "src/pay.cpp::payable"]
    plan = json.loads((report_dir / "report-plan.json").read_text(encoding="utf-8"))
    assert plan["planVersion"] == 2
    assert plan["functionOrder"][0] == "src/order.cpp::Order::addLine"


def test_values_of_every_json_type_reach_the_report(tmp_path):
    case = _case(
        "BJ-PKG-ADD_LINE-T001.CTD", "T001", "addLine-边界测试",
        "src/order.cpp::Order::addLine", "OrderAddLineTest.Zero",
        inputVariables=[
            {"name": "quantity", "value": 0},
            {"name": "enabled", "value": False},
            {"name": "missing", "value": None},
            {"name": "items", "value": [1, 2]},
            {"name": "meta", "value": {"k": 1}},
        ],
        expectedOutputs=[
            {"name": "exceptionType", "value": "std::invalid_argument"},
            {"name": "thrown", "value": True},
        ],
    )
    test = {
        "caseId": case["caseId"], "func": case["testFunc"], "outcome": "passed",
        "actualOutputs": [
            {"name": "exceptionType", "value": "std::invalid_argument"},
            {"name": "thrown", "value": True},
        ],
    }
    result_path = _write_run(tmp_path, [case], [test])
    _, payload = _run_bridge(result_path, tmp_path)
    report_case = payload["phases"][0]["functions"][0]["cases"][0]
    assert report_case["inputs"] == [
        ["quantity", "0"],
        ["enabled", "false"],
        ["missing", "null"],
        ["items", "[1, 2]"],
        ["meta", '{"k": 1}'],
    ]
    assert report_case["outputs"] == [
        ["exceptionType", "std::invalid_argument", "std::invalid_argument"],
        ["thrown", "true", "true"],
    ]
    # 测试说明里不混入任何输入/输出。
    assert "输入条件（原始记录）" not in report_case["description"]
    assert "其他实际输出（运行记录）" not in report_case["description"]


def test_completeness_block_counts_missing_structured_fields(tmp_path):
    ok = _case("GN-PKG-A-T001.CTD", "T001", "addLine-功能测试",
               "src/order.cpp::Order::addLine", "OrderAddLineTest.Normal",
               inputVariables=[{"name": "quantity", "value": 0}],
               expectedOutputs=[{"name": "total", "value": 10}])
    no_structured = _case("BJ-PKG-B-T002.CTD", "T002", "addLine-边界测试",
                          "src/order.cpp::Order::addLine", "OrderAddLineTest.Boundary",
                          input="quantity=0", expected="异常")
    result_path = _write_run(tmp_path, [ok, no_structured])
    _, payload = _run_bridge(result_path, tmp_path)
    stats = payload["completeness"]
    assert stats["total"] == 2
    assert stats["missingInputs"] == 1
    assert stats["missingOutputs"] == 1
    assert stats["missingActual"] >= 1
    assert stats["leakedIntoDescription"] == 0