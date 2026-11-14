"""Exercise skill_meta parsing and confirm which fields are inherited.

The skill file supplies the three **people** fields: designer, reviewer and
tester — who designs, reviews and runs a procedure is decided once when the
procedure is set up.  Everything else (unitId / trace / driver / coverage /
issues) is technical output of a run and must come from the data.
"""

import json
import shutil
import sys
import tempfile
from pathlib import Path

from schema import validate
from skill_meta import describe, load_skill, person, tester_of

failures = []


def check(condition, message):
    print(("  PASS  " if condition else "  FAIL  ") + message)
    if not condition:
        failures.append(message)


ROOT = Path(__file__).resolve().parent.parent
SKILL = ROOT / "skills" / "auth-service-unit-test" / "SKILL.md"
if not SKILL.is_file():
    SKILL = Path(r"D:\1\skills\auth-service-unit-test\SKILL.md")

print("== frontmatter：读取三个人员字段 ==")
meta = load_skill(str(SKILL))
print("  ", describe(meta), "| 原始:", meta)
check(person(meta, "designer") == "张伟", f"designer={person(meta, 'designer')!r}")
check(person(meta, "reviewer") == "刘洋", f"reviewer={person(meta, 'reviewer')!r}")
check(tester_of(meta) == "王芳", f"tester={tester_of(meta)!r}")
check(
    set(meta.keys()) <= {"designer", "reviewer", "tester"},
    f"只解析人员字段，实际键={sorted(meta)}",
)

print("\n== 目录形式也支持 ==")
check(load_skill(str(SKILL.parent)) == meta, "传目录自动找 SKILL.md")

print("\n== 缺失/损坏文件 ==")
check(load_skill(None) == {}, "None → 空 dict")
check(load_skill("") == {}, "空字符串 → 空 dict")
check(load_skill(r"D:\no\such\SKILL.md") == {}, "不存在 → 空 dict")

tmp = Path(tempfile.mkdtemp(prefix="skilltest-"))

print("\n== 非人员键会被忽略 ==")
noisy = tmp / "noisy.md"
noisy.write_text(
    """---
name: t
description: d
designer: 张伟
reviewer: 刘洋
tester: 王芳
coverage: -S 99%
driver: 某驱动
unitId: 某单元
trace: 某追溯
---
""",
    encoding="utf-8",
)
meta_noisy = load_skill(str(noisy))
check(
    meta_noisy == {"designer": "张伟", "reviewer": "刘洋", "tester": "王芳"},
    f"只留三个人员字段，其余忽略：{meta_noisy}",
)

print("\n== 只有正文表格（无 frontmatter）==")
table_only = tmp / "table.md"
table_only.write_text(
    """# 某测试 Skill

| 角色 | 姓名 |
| --- | --- |
| 设计者 | 王五 |
| 校对者 | 赵六 |
| 测试人员 | 孙七 |
""",
    encoding="utf-8",
)
meta_table = load_skill(str(table_only))
check(
    meta_table == {"designer": "王五", "reviewer": "赵六", "tester": "孙七"},
    f"正文表格取三个人员：{meta_table}",
)

print("\n== frontmatter 优先于正文表格 ==")
both = tmp / "both.md"
both.write_text(
    """---
name: t
description: d
tester: 前 Matter
---

| 角色 | 姓名 |
| --- | --- |
| 测试人员 | 正文表格 |
""",
    encoding="utf-8",
)
check(tester_of(load_skill(str(both))) == "前 Matter", "frontmatter 优先")

print("\n== 中文键名也认 ==")
cn = tmp / "cn.md"
cn.write_text("---\n测试人员: 李明\n---\n", encoding="utf-8")
check(tester_of(load_skill(str(cn))) == "李明", f"中文键 tester={tester_of(load_skill(str(cn)))!r}")

print("\n== 嵌套 YAML 被忽略（不崩溃）==")
nested = tmp / "nested.md"
nested.write_text(
    """---
name: t
metadata:
  tester: 嵌套值
tester: 扁平值
---
""",
    encoding="utf-8",
)
check(tester_of(load_skill(str(nested))) == "扁平值", "取扁平键")


def payload(**over):
    p = {
        "meta": {"project": "P", "executedAt": "2026-11-13"},
        "summary": {"total": 1, "passed": 1, "failed": 0},
        "modules": [
            {
                "name": "M",
                "cases": [
                    {
                        "id": "C-1",
                        "name": "n",
                        "type": "功能测试",
                        "description": "d",
                        "inputs": [],
                        "outputs": [],
                        "passed": True,
                    }
                ],
            }
        ],
    }
    p.update(over)
    return p


skill = {"designer": "张伟", "reviewer": "刘洋", "tester": "王芳"}

print("\n== 三个人员字段的注入优先级：用例 > 模块 > skill ==")
out = validate(payload(), skill)
case = out["modules"][0]["cases"][0]
check(case["designer"] == "张伟", f"仅 skill → designer={case['designer']!r}")
check(case["reviewer"] == "刘洋", f"仅 skill → reviewer={case['reviewer']!r}")
check(case["tester"] == "王芳", f"仅 skill → tester={case['tester']!r}")

p = payload()
p["modules"][0].update({"designer": "模块设计", "reviewer": "模块校对", "tester": "模块测试人"})
out = validate(p, skill)
case = out["modules"][0]["cases"][0]
check(case["designer"] == "模块设计", "designer 模块覆盖 skill")
check(case["reviewer"] == "模块校对", "reviewer 模块覆盖 skill")
check(case["tester"] == "模块测试人", "tester 模块覆盖 skill")

p = payload()
p["modules"][0]["cases"][0].update(
    {"designer": "用例设计", "reviewer": "用例校对", "tester": "用例测试人"}
)
out = validate(p, skill)
case = out["modules"][0]["cases"][0]
check(case["designer"] == "用例设计", "designer 用例覆盖模块")
check(case["reviewer"] == "用例校对", "reviewer 用例覆盖模块")
check(case["tester"] == "用例测试人", "tester 用例覆盖模块")

out = validate(payload(), None)
case = out["modules"][0]["cases"][0]
check(
    case["designer"] == "" and case["reviewer"] == "" and case["tester"] == "",
    "都缺失 → 三个人员均为空",
)

print("\n== skill 不得影响技术字段 ==")
rich_skill = dict(skill)
rich_skill.update(
    {"coverage": "-S 99%", "driver": "某驱动", "unitId": "某单元", "trace": "某追溯"}
)
out = validate(payload(), rich_skill)
mod = out["modules"][0]
check(mod["coverage"] == "-", f"coverage 不从 skill 取（{mod['coverage']!r}）")
check(mod["driver"] == "无", f"driver 不从 skill 取（{mod['driver']!r}）")
check(mod["unitId"] == "M", f"unitId 回落模块名（{mod['unitId']!r}）")
check(mod["trace"] == "-", f"trace 回落默认（{mod['trace']!r}）")

print("\n== 数据里的值保真 ==")
p = payload()
p["modules"][0].update(
    {
        "unitId": "单元甲",
        "trace": "设计 1.1",
        "driver": "驱动甲",
        "coverage": "-S 88% -B 77%",
        "designer": "设计甲",
        "reviewer": "校对甲",
    }
)
p["modules"][0]["cases"][0]["tester"] = "测试甲"
out = validate(p, rich_skill)
mod = out["modules"][0]
check(mod["unitId"] == "单元甲", "unitId 来自数据")
check(mod["trace"] == "设计 1.1", "trace 来自数据")
check(mod["driver"] == "驱动甲", "driver 来自数据")
check(mod["coverage"] == "-S 88% -B 77%", "coverage 来自数据")
check(mod["cases"][0]["designer"] == "设计甲", "designer 来自数据")
check(mod["cases"][0]["reviewer"] == "校对甲", "reviewer 来自数据")
check(mod["cases"][0]["tester"] == "测试甲", "tester 仍是数据优先")

print("\n== 多模块 unitId 各自独立 ==")
p = payload()
p["summary"]["total"] = 2
p["summary"]["passed"] = 2
second_case = json.loads(json.dumps(p["modules"][0]["cases"][0]))
second_case["id"] = "C-2"
p["modules"][0]["cases"].append(second_case)
p["modules"].append({"name": "模块二", "cases": [dict(second_case, id="C-3")]})
p["summary"]["total"] = 3
p["summary"]["passed"] = 3
out = validate(p, {"unitId": "统一单元"})
check(out["modules"][0]["unitId"] == "M", f"模块一 unitId={out['modules'][0]['unitId']!r}")
check(
    out["modules"][1]["unitId"] == "模块二",
    f"模块二 unitId={out['modules'][1]['unitId']!r}",
)

shutil.rmtree(tmp, ignore_errors=True)

print()
if failures:
    print(f"FAILED {len(failures)}: {failures}")
    sys.exit(1)
print("ALL SKILL TESTS PASSED")