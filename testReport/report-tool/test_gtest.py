"""GoogleTest XML 接入 runner 的单元测试。

本机没有 C++ 工具链，所以 fixture 是按 GoogleTest 1.10+ 公开的 XML 格式手写的，
**不是抓到的真实输出** —— 等有编译器之后应换成真实文件再回归一次。

覆盖三件事：
1. gtest 的 <testcase> 能被 parse_junit 读成逐条结果（含 failure 摘要与断言详情）；
2. status="notrun" / result="suppressed" 必须算 skipped —— 否则禁用的用例会被算成通过；
3. TEST(套件, 用例) 的两段名（`OrderTotal.CouponNeverNegative` 与 `CouponNeverNegative`）
   都能被 match_test 命中；老版 gtest 不写 classname 时能退到末段匹配。

跑法：
    python -m pytest test_gtest.py -q
"""

import importlib.util
from pathlib import Path
import os

import pytest


def _find_assets():
    """定位插件资产（run_tests.py 所在目录）；部署形态不同，逐个候选试。"""
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
        if (candidate / "run_tests.py").is_file():
            return candidate
    return None


ASSETS = _find_assets()
if ASSETS is None:
    pytest.skip("未找到插件资产 run_tests.py（可用 DSH_DATA_PANEL_ASSETS 指向所在目录）",
                allow_module_level=True)


def load_runner_module():
    """把 run_tests.py 当模块导入（它不依赖第三方包）。"""
    path = ASSETS / "run_tests.py"
    spec = importlib.util.spec_from_file_location("run_tests", path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


runner = load_runner_module()


GTEST_XML = """<?xml version="1.0" encoding="UTF-8"?>
<testsuites tests="4" failures="1" disabled="1" errors="0" time="0.003" timestamp="2026-11-15T22:00:00">
  <testsuite name="OrderTotal" tests="4" failures="1" disabled="1" skipped="0" errors="0" time="0.003">
    <testcase name="SubtotalMultipliesQuantity" file="tests/test_generated.cpp" line="8"
              status="run" result="completed" time="0.0005" timestamp="2026-11-15T22:00:00"
              classname="OrderTotal" />
    <testcase name="CouponNeverNegative" file="tests/test_generated.cpp" line="40"
              status="run" result="completed" time="0.0007" timestamp="2026-11-15T22:00:00"
              classname="OrderTotal">
      <failure message="Value of: o.payable()&#10;  Actual: -32.0&#10;Expected: 0.0" type=""><![CDATA[
..\\tests\\test_generated.cpp:40
Value of: o.payable()
  Actual: -32.0
Expected: 0.0
]]></failure>
    </testcase>
    <testcase name="DisabledOne" file="tests/test_generated.cpp" line="50"
              status="notrun" result="suppressed" time="0" timestamp="2026-11-15T22:00:00"
              classname="OrderTotal">
      <skipped message="DISABLED_ prefix" />
    </testcase>
    <testcase name="LegacyCase" file="tests/test_generated.cpp" line="60"
              status="run" result="completed" time="0" timestamp="2026-11-15T22:00:00" />
  </testsuite>
</testsuites>
"""


def write_xml(tmp_path: Path) -> Path:
    path = tmp_path / "gtest.xml"
    path.write_text(GTEST_XML, encoding="utf-8")
    return path


def test_parse_gtest_xml(tmp_path):
    entries = runner.parse_junit(write_xml(tmp_path))
    assert len(entries) == 4, entries

    by_name = {entry["name"]: entry for entry in entries}

    passed = by_name["SubtotalMultipliesQuantity"]
    assert passed["outcome"] == "passed"
    assert passed["classname"] == "OrderTotal"

    failed = by_name["CouponNeverNegative"]
    assert failed["outcome"] == "failed"
    assert "Actual: -32.0" in failed["message"]
    assert "Expected: 0.0" in failed["detail"], failed["detail"]


def test_disabled_test_is_skipped_not_passed(tmp_path):
    entries = runner.parse_junit(write_xml(tmp_path))
    disabled = {entry["name"]: entry for entry in entries}["DisabledOne"]
    assert disabled["outcome"] == "skipped"


def test_match_qualified_name(tmp_path):
    entries = runner.parse_junit(write_xml(tmp_path))
    hit = runner.match_test(entries, "OrderTotal.CouponNeverNegative")
    assert hit is not None and hit["name"] == "CouponNeverNegative"


def test_match_bare_case_name(tmp_path):
    entries = runner.parse_junit(write_xml(tmp_path))
    hit = runner.match_test(entries, "CouponNeverNegative")
    assert hit is not None and hit["name"] == "CouponNeverNegative"


def test_match_legacy_without_classname(tmp_path):
    entries = runner.parse_junit(write_xml(tmp_path))
    hit = runner.match_test(entries, "LegacySuite.LegacyCase")
    assert hit is not None and hit["name"] == "LegacyCase"


def test_unknown_case_is_not_guessed(tmp_path):
    entries = runner.parse_junit(write_xml(tmp_path))
    assert runner.match_test(entries, "OrderTotal.CouponNeverPositive") is None


def test_gtest_batch_filter_uses_colon(tmp_path):
    """重复给 --gtest_filter 只有最后一个生效，多个用例必须拼成一条。"""
    junit = tmp_path / "gtest.xml"
    spec = {
        "id": "gtest",
        "language": "cpp",
        "mode": "batch",
        "testFile": "tests/test_generated.cpp",
        "command": [
            "build/tests.exe",
            f"--gtest_output=xml:{junit}",
            "--gtest_filter={targets}",
        ],
        "targetArg": "{target}",
        "targetsSeparator": ":",
    }
    targets = [
        {"caseId": "TC-1", "func": "OrderTotal.CouponNeverNegative"},
        {"caseId": "TC-2", "func": "OrderTotal.FreeShippingAtThreshold"},
    ]
    argv = runner.prepare_argv(spec, targets, "")
    assert argv == [
        "build/tests.exe",
        f"--gtest_output=xml:{junit}",
        "--gtest_filter=OrderTotal.CouponNeverNegative:OrderTotal.FreeShippingAtThreshold",
    ], argv


def test_pytest_batch_layer_unchanged(tmp_path):
    """老行为不能被改坏：{targets} 独占参数时仍是每个目标一个 argv。"""
    spec = {
        "id": "pytest",
        "mode": "batch",
        "testFile": "tests/test_generated.py",
        "command": ["python", "-m", "pytest", "{targets}"],
        "targetArg": "{file}::{target}",
    }
    targets = [{"func": "test_a"}, {"func": "test_b"}]
    argv = runner.prepare_argv(spec, targets, "")
    assert argv == [
        "python", "-m", "pytest",
        "tests/test_generated.py::test_a",
        "tests/test_generated.py::test_b",
    ], argv
