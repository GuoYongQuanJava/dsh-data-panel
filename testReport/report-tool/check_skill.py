"""项目配置文件解析的契约测试（v2）。

v2 起，软件名称/版本/研制单位/重要度/人员/引用文档来自**项目配置文件**：

    <项目根>/testReport/skills/<工作区名>.md

本脚本验证 config_file.load_key_values 的解析规则，并保留一小段 skill_meta
兼容性冒烟（builder 的 skill_path 参数仍接受旧 SKILL.md，但不再驱动人员默认值）。

运行：python check_skill.py
"""
import sys
import tempfile
from pathlib import Path

from config_file import as_int, load_key_values

failures = []


def check(condition, message):
    print(("  PASS  " if condition else "  FAIL  ") + message)
    if not condition:
        failures.append(message)


tmp = Path(tempfile.mkdtemp(prefix="cfgspec-"))

print("== Markdown 列表格式（客户现有写法）==")
md = tmp / "proj.md"
md.write_text(
    "# 某项目配置\n"
    "\n"
    "## 基本信息\n"
    "- projectName: 某软件\n"
    "- projectPackage: ZZKZ\n"
    "- softwareVersion: 1.0.1\n"
    "- devUnit: 质量保障部\n"
    "- importance: A级\n"
    "- language: C++\n"
    "\n"
    "## 人员\n"
    "- designer: 张伟\n"
    "- reviewer: 刘洋\n"
    "- tester: 王芳\n"
    "\n"
    "## 引用文档\n"
    "- reqDocName: 软件需求规格说明\n"
    "- reqDocVersion: B\n",
    encoding="utf-8",
)
cfg = load_key_values(md)
check(cfg.get("projectName") == "某软件", f"projectName={cfg.get('projectName')!r}")
check(cfg.get("projectPackage") == "ZZKZ", f"projectPackage={cfg.get('projectPackage')!r}")
check(cfg.get("softwareVersion") == "1.0.1", f"softwareVersion={cfg.get('softwareVersion')!r}")
check(cfg.get("devUnit") == "质量保障部", f"devUnit={cfg.get('devUnit')!r}")
check(cfg.get("importance") == "A级", f"importance={cfg.get('importance')!r}")
check(cfg.get("language") == "C++", f"language={cfg.get('language')!r}")
check(cfg.get("designer") == "张伟", f"designer={cfg.get('designer')!r}")
check(cfg.get("reviewer") == "刘洋", f"reviewer={cfg.get('reviewer')!r}")
check(cfg.get("tester") == "王芳", f"tester={cfg.get('tester')!r}")
check(cfg.get("reqDocName") == "软件需求规格说明", f"reqDocName={cfg.get('reqDocName')!r}")
check(cfg.get("reqDocVersion") == "B", f"reqDocVersion={cfg.get('reqDocVersion')!r}")

print("\n== YAML frontmatter 格式（模板写法）==")
yml = tmp / "yaml.md"
yml.write_text(
    "---\n"
    "projectName: 另一软件\n"
    "projectPackage: ABC\n"
    "designer: 李明\n"
    "---\n"
    "\n"
    "正文无关内容，不应影响解析。\n",
    encoding="utf-8",
)
cfg = load_key_values(yml)
check(cfg.get("projectName") == "另一软件", f"frontmatter projectName={cfg.get('projectName')!r}")
check(cfg.get("projectPackage") == "ABC", f"frontmatter projectPackage={cfg.get('projectPackage')!r}")
check(cfg.get("designer") == "李明", f"frontmatter designer={cfg.get('designer')!r}")

print("\n== 解析细节 ==")
detail = tmp / "detail.md"
detail.write_text(
    "# 注释行被忽略\n"
    "<!-- HTML 注释也忽略 -->\n"
    "\n"
    "- quoted: \"带双引号的值\"\n"
    "- single: '带单引号的值'\n"
    "- star: 星号列表\n"
    "* star2: 星号列表二\n"
    "- empty: \n"
    "- projectName: 第一次\n"
    "- projectName: 第二次\n"
    "没有冒号的行\n",
    encoding="utf-8",
)
cfg = load_key_values(detail)
check(cfg.get("quoted") == "带双引号的值", f"双引号被去掉：{cfg.get('quoted')!r}")
check(cfg.get("single") == "带单引号的值", f"单引号被去掉：{cfg.get('single')!r}")
check(cfg.get("star") == "星号列表", f"星号列表前缀被去掉：{cfg.get('star')!r}")
check(cfg.get("star2") == "星号列表二", f"第二种星号列表：{cfg.get('star2')!r}")
check(cfg.get("empty") == "", f"空值保留为空字符串：{cfg.get('empty')!r}")
check(cfg.get("projectName") == "第一次", f"同名键取第一次出现：{cfg.get('projectName')!r}")
check("# 注释行被忽略" not in cfg, "注释行没有被当成键")
check("没有冒号的行" not in cfg, "无冒号的行没有被当成键")

print("\n== 缺失与空文件（不许编默认值）==")
check(load_key_values(None) == {}, "None → 空 dict")
check(load_key_values("") == {}, "空字符串 → 空 dict")
check(load_key_values(tmp / "no-such.md") == {}, "不存在 → 空 dict")
blank = tmp / "blank.md"
blank.write_text("# 只有注释\n\n", encoding="utf-8")
check(load_key_values(blank) == {}, "只有注释 → 空 dict")
check(load_key_values(md).get("reqDocVersion") == "B", "无关文件不影响已有解析")

print("\n== 数字安全转换 ==")
check(as_int("42") == 42, "as_int('42') == 42")
check(as_int(" 7 ") == 7, "as_int 容忍空格")
check(as_int("abc", 3) == 3, "非法值回落默认")
check(as_int("", 0) == 0, "空值回落默认")

print("\n== 真实项目配置能读通 ==")
real = Path(r"E:\gongzuo\harness\dshCJ\test\cpp-gtest-demo\testReport\skills\cpp-gtest-demo.md")
if real.is_file():
    cfg = load_key_values(real)
    check(cfg.get("projectPackage") == "CPPGTEST", f"真实配置 projectPackage={cfg.get('projectPackage')!r}")
    check(bool(cfg.get("projectName")), f"真实配置 projectName={cfg.get('projectName')!r}")
    check(bool(cfg.get("designer")), f"真实配置 designer={cfg.get('designer')!r}")
else:
    print("  (跳过) 本机没有该项目配置样例")

print("\n== skill_meta 兼容（旧 SKILL.md 仍可读，但不再驱动人员默认值）==")
try:
    from skill_meta import load_skill, tester_of

    old = tmp / "SKILL.md"
    old.write_text("---\nname: t\ndesigner: 旧设计\nreviewer: 旧校对\ntester: 旧测试\n---\n", encoding="utf-8")
    meta = load_skill(str(old))
    check(tester_of(meta) == "旧测试", f"兼容读取旧 SKILL.md：{tester_of(meta)!r}")
    check(load_skill(str(tmp / "nope.md")) == {}, "旧 skill 文件不存在时返回空 dict")
    print("  说明：v2 的 schema.validate 已忽略 skill_meta，人员以配置文件与数据为准。")
except ImportError:
    print("  (跳过) 未部署 skill_meta.py")

print()
if failures:
    print(f"FAILED {len(failures)}: {failures}")
    sys.exit(1)
print("ALL CONFIG TESTS PASSED")