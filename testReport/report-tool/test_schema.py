"""Exercise schema.validate against valid and invalid payloads."""

import copy
import json
import sys

from schema import SchemaError, validate

BASE = {
    "meta": {"project": "P", "executedAt": "2026-11-13", "executor": "h"},
    "summary": {"total": 1, "passed": 1, "failed": 0},
    "modules": [
        {
            "name": "M",
            "cases": [
                {
                    "id": "C-001.CTD",
                    "name": "n",
                    "type": "功能测试",
                    "description": "d",
                    "inputs": [["a", "1"]],
                    "outputs": [["b", "2", "2"]],
                    "passed": True,
                }
            ],
        }
    ],
}

failures = []


def ok(label):
    print(f"  PASS  {label}")


def bad(label, mutate, expect_substring=""):
    data = copy.deepcopy(BASE)
    mutate(data)
    try:
        validate(data)
    except SchemaError as exc:
        if expect_substring and expect_substring not in str(exc):
            print(f"  FAIL  {label} —— 报错信息未包含 {expect_substring!r}：{exc}")
            failures.append(label)
        else:
            print(f"  PASS  {label} —— {exc}")
        return
    print(f"  FAIL  {label} —— 未抛出 SchemaError")
    failures.append(label)


def drop(path):
    def _mutate(data):
        target = data
        for key in path[:-1]:
            target = target[key]
        del target[path[-1]]

    return _mutate


def setval(path, value):
    def _mutate(data):
        target = data
        for key in path[:-1]:
            target = target[key]
        target[path[-1]] = value

    return _mutate


print("== 正常输入 ==")
out = validate(BASE)
ok(f"通过校验，返回 {out['summary']['total']} 条用例")

print("\n== 必填缺失 ==")
bad("缺少 meta", drop(["meta"]), "meta")
bad("缺少 project", drop(["meta", "project"]), "project")
bad("缺少 summary", drop(["summary"]), "summary")
bad("缺少 modules", drop(["modules"]), "modules")

print("\n== 类型错误 ==")
bad("project 不是字符串", setval(["meta", "project"], 123), "字符串")
bad("total 是字符串", setval(["summary", "total"], "1"), "整数")
bad("passed 不是布尔", setval(["modules", 0, "cases", 0, "passed"], "true"), "布尔")

print("\n== 枚举约束 ==")
bad("测试类型不在枚举内", setval(["modules", 0, "cases", 0, "type"], "随机测试"), "不在")

print("\n== 数值一致性 ==")


def total_mismatch(data):
    # keep passed+failed consistent so the count check is what fires
    data["summary"]["total"] = 5
    data["summary"]["passed"] = 5
    data["summary"]["failed"] = 0


bad("total 与用例数不符", total_mismatch, "用例总数")
bad("passed+failed≠total", setval(["summary", "failed"], 3), "≠")

print("\n== 元组长度 ==")
bad("inputs 项长度不是 2", setval(["modules", 0, "cases", 0, "inputs"], [["a"]]), "长度为 2")
bad("outputs 项长度不是 3", setval(["modules", 0, "cases", 0, "outputs"], [["a", "b"]]), "长度为 3")

print("\n== 唯一性 ==")


def dup_id(data):
    data["summary"]["total"] = 2
    data["summary"]["passed"] = 2
    case = copy.deepcopy(data["modules"][0]["cases"][0])
    data["modules"][0]["cases"].append(case)


bad("用例标识重复", dup_id, "重复")

print("\n== 空集合 ==")
bad("modules 为空", setval(["modules"], []), "非空")
bad("cases 为空", setval(["modules", 0, "cases"], []), "非空")

print("\n== 日期格式 ==")
bad("日期非法", setval(["meta", "executedAt"], "昨天"), "日期格式")
data = copy.deepcopy(BASE)
data["meta"]["executedAt"] = "2026/11/13"
validate(data)
ok("接受 yyyy/mm/dd 格式")

print("\n== 未执行（notRun）状态 ==")


def with_not_run(data):
    data["summary"]["total"] = 2
    data["summary"]["passed"] = 1
    data["summary"]["failed"] = 0
    data["summary"]["notRun"] = 1
    case = copy.deepcopy(data["modules"][0]["cases"][0])
    case["id"] = "C-002.CTD"
    case["passed"] = False
    case["status"] = "notRun"
    case["outputs"] = [["b", "2", ""]]
    data["modules"][0]["cases"].append(case)


data = copy.deepcopy(BASE)
with_not_run(data)
out = validate(data)
not_run_case = out["modules"][0]["cases"][1]
ok(f"notRun 用例通过校验，status={not_run_case['status']!r}，实际输出={not_run_case['outputs'][0][2]!r}")
print(f"         summary: {out['summary']}")
assert out["summary"]["notRun"] == 1
assert out["summary"]["executedRate"] == 50.0

def missing_not_run(data):
    with_not_run(data)
    del data["summary"]["notRun"]


bad("summary 缺 notRun 但用例有", missing_not_run, "notRun")


def bad_status(data):
    with_not_run(data)
    data["modules"][0]["cases"][1]["status"] = "skipped"


bad("status 取值非法", bad_status, "不在")


def contradictory(data):
    with_not_run(data)
    data["modules"][0]["cases"][1]["passed"] = True  # says passed, status says notRun


bad("status=notRun 但 passed=true", contradictory, "notRun")


def contradiction_failed(data):
    with_not_run(data)
    data["modules"][0]["cases"][1]["status"] = "failed"
    data["modules"][0]["cases"][1]["passed"] = False
    data["summary"]["notRun"] = 0
    data["summary"]["failed"] = 1


data = copy.deepcopy(BASE)
contradiction_failed(data)
out = validate(data)
ok("status=failed 与 passed=false 一致时通过")


def summary_notrun_wrong(data):
    # summary is self-consistent (passed+failed+notRun == total) but its
    # notRun contradicts the cases: 3 cases (1/1/1) vs claimed (1/1/0).
    data["summary"] = {"total": 3, "passed": 1, "failed": 1, "notRun": 1}
    mod = data["modules"][0]
    base = mod["cases"][0]
    not_run = copy.deepcopy(base)
    not_run.update(id="C-002.CTD", passed=False, status="notRun", outputs=[["b", "2", ""]])
    failed = copy.deepcopy(base)
    failed.update(id="C-003.CTD", passed=False, status="failed")
    mod["cases"] = [base, not_run, failed]
    data["summary"]["notRun"] = 0  # 1+1+0 != 3 → caught by the sum check


bad("summary.notRun 与用例数不符", summary_notrun_wrong, "notRun")


def total_wrong_with_notrun(data):
    with_not_run(data)
    data["summary"]["total"] = 9
    data["summary"]["passed"] = 9
    data["summary"]["failed"] = 0
    data["summary"]["notRun"] = 0


bad("三项和 ≠ total", total_wrong_with_notrun, "≠")

print("\n== 可选字段默认值 ==")
data = copy.deepcopy(BASE)
out = validate(data)
case = out["modules"][0]["cases"][0]
print(f"  PASS  缺省填充 stub={case['stub']!r} issue={case['issue']!r} bugId={case['bugId']!r}")

print()
if failures:
    print(f"FAILED {len(failures)}: {failures}")
    sys.exit(1)
print("ALL SCHEMA TESTS PASSED")