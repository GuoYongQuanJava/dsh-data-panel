"""Exercise schema.validate against valid and invalid v2 payloads.

v2 结构：schemaVersion + meta + summary + phases[].functions[].cases[]
运行：python test_schema.py
"""
import copy
import sys

from schema import SchemaError, validate

BASE = {
    "schemaVersion": "2.0",
    "meta": {"project": "P", "executedAt": "2026-11-13", "executor": "h"},
    "summary": {"total": 1, "passed": 1, "failed": 0},
    "phases": [
        {
            "phaseId": "phase-1",
            "name": "第一阶段",
            "order": 1,
            "functions": [
                {
                    "functionId": "F",
                    "name": "F",
                    "summary": {"total": 1, "passed": 1, "failed": 0},
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
assert out["phases"][0]["functions"][0]["cases"][0]["id"] == "C-001.CTD"

print("\n== schemaVersion ==")
bad("缺少 schemaVersion", drop(["schemaVersion"]), "schemaVersion")
bad("schemaVersion 不是 2.0", setval(["schemaVersion"], "1.0"), "schemaVersion")

print("\n== 必填缺失 ==")
bad("缺少 meta", drop(["meta"]), "meta")
bad("缺少 project", drop(["meta", "project"]), "project")
bad("缺少 summary", drop(["summary"]), "summary")
bad("缺少 phases", drop(["phases"]), "phases")

print("\n== 类型错误 ==")
bad("project 不是字符串", setval(["meta", "project"], 123), "字符串")
bad("summary.total 是字符串", setval(["summary", "total"], "1"), "整数")
bad("case.passed 不是布尔", setval(["phases", 0, "functions", 0, "cases", 0, "passed"], "true"), "布尔")
bad("phase.order 不是正整数", setval(["phases", 0, "order"], 0), "正整数")

print("\n== 枚举约束 ==")
bad("测试类型不在枚举内",
    setval(["phases", 0, "functions", 0, "cases", 0, "type"], "随机测试"), "不在")
bad("执行状态取值非法",
    setval(["phases", 0, "functions", 0, "cases", 0, "status"], "skipped"), "不在")

print("\n== 数值一致性 ==")
bad("summary 四项和 ≠ total", setval(["summary", "failed"], 2), "≠")


def total_mismatch(data):
    # summary 自身自洽（5=5+0），但 phases 里实际只有 1 条用例
    data["summary"] = {"total": 5, "passed": 5, "failed": 0}


bad("phases 用例总数 ≠ summary.total", total_mismatch, "用例总数")


def func_summary_mismatch(data):
    data["phases"][0]["functions"][0]["summary"]["total"] = 2
    data["phases"][0]["functions"][0]["summary"]["passed"] = 2


bad("function.summary.total ≠ 用例数", func_summary_mismatch, "cases 数量")


def counted_mismatch(data):
    # summary 自洽（2=1+1+0），但逐条 status 分布与 summary 不一致
    data["summary"] = {"total": 2, "passed": 1, "failed": 1}
    func = data["phases"][0]["functions"][0]
    func["summary"] = {"total": 2, "passed": 1, "failed": 0, "notRun": 1}
    second = copy.deepcopy(func["cases"][0])
    second.update(id="C-002.CTD", passed=False, status="notRun", outputs=[["b", "2", ""]])
    func["cases"].append(second)


bad("逐条 status 计数与 summary 不符", counted_mismatch, "但 summary")

print("\n== 元组长度 ==")
bad("inputs 项长度不是 2",
    setval(["phases", 0, "functions", 0, "cases", 0, "inputs"], [["a"]]), "长度为 2")
bad("outputs 项长度不是 3",
    setval(["phases", 0, "functions", 0, "cases", 0, "outputs"], [["a", "b"]]), "长度为 3")

print("\n== 唯一性 ==")


def dup_case_id(data):
    data["summary"] = {"total": 2, "passed": 2, "failed": 0}
    func = data["phases"][0]["functions"][0]
    func["summary"] = {"total": 2, "passed": 2, "failed": 0}
    func["cases"].append(copy.deepcopy(func["cases"][0]))


bad("caseId 重复", dup_case_id, "重复")


def dup_function_id(data):
    data["summary"] = {"total": 2, "passed": 2, "failed": 0}
    phase = data["phases"][0]
    second = copy.deepcopy(phase["functions"][0])
    second["cases"][0]["id"] = "C-002.CTD"
    phase["functions"].append(second)


bad("functionId 跨 phase 重复", dup_function_id, "跨 phase 重复")


def dup_phase_id(data):
    data["summary"] = {"total": 2, "passed": 2, "failed": 0}
    second = copy.deepcopy(data["phases"][0])
    second["functions"][0]["functionId"] = "F2"
    second["functions"][0]["cases"][0]["id"] = "C-002.CTD"
    data["phases"].append(second)


bad("phaseId 重复", dup_phase_id, "重复")

print("\n== 空集合 ==")
bad("phases 为空", setval(["phases"], []), "非空")
bad("functions 为空", setval(["phases", 0, "functions"], []), "非空")
bad("cases 为空", setval(["phases", 0, "functions", 0, "cases"], []), "非空")

print("\n== 日期格式 ==")
bad("日期非法", setval(["meta", "executedAt"], "昨天"), "日期格式")
data = copy.deepcopy(BASE)
data["meta"]["executedAt"] = "2026/11/13"
validate(data)
ok("接受 yyyy/mm/dd 格式")

print("\n== 未执行（notRun）状态 ==")


def with_not_run(data):
    data["summary"] = {"total": 2, "passed": 1, "failed": 0, "notRun": 1}
    func = data["phases"][0]["functions"][0]
    func["summary"] = {"total": 2, "passed": 1, "failed": 0, "notRun": 1}
    case = copy.deepcopy(func["cases"][0])
    case.update(id="C-002.CTD", passed=False, status="notRun", outputs=[["b", "2", ""]])
    func["cases"].append(case)


data = copy.deepcopy(BASE)
with_not_run(data)
out = validate(data)
not_run_case = out["phases"][0]["functions"][0]["cases"][1]
ok(f"notRun 用例通过校验，status={not_run_case['status']!r}，实际输出={not_run_case['outputs'][0][2]!r}")
print(f"         summary: {out['summary']}")
assert out["summary"]["notRun"] == 1
assert out["summary"]["executionRate"] == 50.0


def not_run_passed_true(data):
    with_not_run(data)
    data["phases"][0]["functions"][0]["cases"][1]["passed"] = True


bad("status=notRun 但 passed=true", not_run_passed_true, "notRun")


def not_run_missing_in_summary(data):
    with_not_run(data)
    del data["summary"]["notRun"]


bad("用例有 notRun 但 summary 没记", not_run_missing_in_summary, "≠")


def failed_consistent(data):
    with_not_run(data)
    data["summary"] = {"total": 2, "passed": 0, "failed": 1, "notRun": 1}
    func = data["phases"][0]["functions"][0]
    func["summary"] = {"total": 2, "passed": 0, "failed": 1, "notRun": 1}
    func["cases"][0]["passed"] = False
    func["cases"][0]["status"] = "failed"


data = copy.deepcopy(BASE)
failed_consistent(data)
validate(data)
ok("status=failed 与 passed=false 一致时通过")

print("\n== 覆盖率口径 ==")
bad("available=false 却给百分比",
    lambda d: d.update(coverage={"available": False, "line": {"total": 10, "covered": 10, "percent": 100.0}}),
    "百分比")

data = copy.deepcopy(BASE)
data["coverage"] = {"available": False, "reason": "本次未配置覆盖率采集"}
validate(data)
ok("未采集只写原因时通过")

data = copy.deepcopy(BASE)
data["coverage"] = {"available": True, "line": {"total": 24, "covered": 12, "percent": 50.0},
                    "block": {"total": 28, "covered": 13, "percent": 46.4}}
validate(data)
ok("块/行同时存在时通过")

print("\n== 可选字段默认值 ==")
data = copy.deepcopy(BASE)
out = validate(data)
case = out["phases"][0]["functions"][0]["cases"][0]
print(f"  PASS  缺省填充 stub={case['stub']!r} issue={case['issue']!r} bugId={case['bugId']!r}")


print("\n== 人员回落 ==")


def people_case(phase_people=None, func_people=None, case_people=None, meta_people=True):
    data = copy.deepcopy(BASE)
    if meta_people:
        data["meta"]["people"] = {"designer": "M-D", "reviewer": "M-R", "tester": "M-T"}
    phase = data["phases"][0]
    func = phase["functions"][0]
    case = func["cases"][0]
    if phase_people:
        phase.update(phase_people)
    if func_people:
        func.update(func_people)
    if case_people:
        case.update(case_people)
    return validate(data)["phases"][0]["functions"][0]["cases"][0]


def expect(label, got, want):
    if got == want:
        ok(f"{label} → {got!r}")
    else:
        print(f"  FAIL  {label} —— 期望 {want!r}，实际 {got!r}")
        failures.append(label)


c = people_case()
expect("只用 meta.people",
       (c["designer"], c["reviewer"], c["tester"]), ("M-D", "M-R", "M-T"))

c = people_case(phase_people={"designer": "P-D"})
expect("阶段级覆盖 meta.people",
       (c["designer"], c["tester"]), ("P-D", "M-T"))

c = people_case(phase_people={"designer": "P-D"}, func_people={"designer": "F-D"})
expect("函数级覆盖阶段级",
       (c["designer"], c["tester"]), ("F-D", "M-T"))

c = people_case(phase_people={"designer": "P-D"}, func_people={"designer": "F-D"},
                case_people={"designer": "C-D"})
expect("用例级覆盖全部",
       (c["designer"], c["tester"]), ("C-D", "M-T"))

c = people_case(meta_people=False)
expect("都没有时留空（由 filler 显示未记录）",
       (c["designer"], c["reviewer"], c["tester"]), ("", "", ""))
print()
if failures:
    print(f"FAILED {len(failures)}: {failures}")
    sys.exit(1)
print("ALL SCHEMA TESTS PASSED")