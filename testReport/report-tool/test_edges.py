"""Edge cases（v2）：变量行数、阶段/函数/用例规模、模板异常、CLI 退出码。

运行：python test_edges.py
"""
import json
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

from docx import Document
from docx.oxml.ns import qn

from builder import BuilderError, build

qn_table = qn("w:tbl")

TEMPLATE = Path(__file__).resolve().parent.parent / "templates" / "单元测试报告模板.docx"
if not TEMPLATE.is_file():
    TEMPLATE = Path(r"E:\gongzuo\harness\dshCJ\gitcode\单元测试资料\报告\单元测试报告模板.docx")
PY = sys.executable
failures = []

# 模板自带 9 张固定表（软件信息/圈复杂度/覆盖率 + 附录 A~F）
TEMPLATE_TABLES = 9


def check(condition, message):
    print(("  PASS  " if condition else "  FAIL  ") + message)
    if not condition:
        failures.append(message)


def mkcase(cid, inputs, outputs, passed=True):
    return {
        "id": cid,
        "name": f"用例 {cid}",
        "type": "功能测试",
        "description": "desc",
        "inputs": inputs,
        "outputs": outputs,
        "passed": passed,
        "tester": "T",
        "executedAt": "2026/11/13",
    }


def mkfunction(fid, cases, coverage="未采集"):
    passed = sum(1 for c in cases if c["passed"])
    return {
        "functionId": fid,
        "name": fid,
        "summary": {"total": len(cases), "passed": passed, "failed": len(cases) - passed},
        "coverage": coverage,
        "cases": cases,
    }


def make_payload(phases):
    """phases: [{name, functions:[mkfunction(...)]}]"""
    all_cases = [c for p in phases for f in p["functions"] for c in f["cases"]]
    passed = sum(1 for c in all_cases if c["passed"])
    return {
        "schemaVersion": "2.0",
        "meta": {"project": "边界测试", "executedAt": "2026-11-13", "executor": "h"},
        "summary": {"total": len(all_cases), "passed": passed, "failed": len(all_cases) - passed},
        "phases": [
            {
                "phaseId": f"phase-{i + 1}",
                "name": p["name"],
                "order": i + 1,
                "functions": p["functions"],
            }
            for i, p in enumerate(phases)
        ],
    }


tmp = Path(tempfile.mkdtemp(prefix="rpt-edge-"))

print("== 0 组变量 ==")
payload = make_payload([{"name": "第一阶段", "functions": [mkfunction("F", [mkcase("Z-000.CTD", [], [])])]}])
out = tmp / "zero.docx"
build(str(TEMPLATE), payload, str(out), refresh_toc=False)
doc = Document(str(out))
case_tables = [t for t in doc.tables if len(t.columns) == 11]  # RingBuffer 用例表是唯一的 11 列
check(len(case_tables) == 1, f"1 条用例 → 1 张用例表（实际 {len(case_tables)}）")
t = case_tables[0]
check(len(t.rows) == 13, f"空变量时保留 1 行变量占位（实际 {len(t.rows)} 行）")
row7 = t.rows[7]
check(
    row7.cells[0].text.strip() == "" and row7.cells[8].text.strip() == "",
    f"变量占位行被清空（左={row7.cells[0].text!r} 右={row7.cells[8].text!r}）",
)

print("\n== 1 组到 8 组变量 ==")
for n in (1, 2, 5, 8):
    inputs = [[f"in{i}", f"v{i}"] for i in range(n)]
    outputs = [[f"out{i}", f"e{i}", f"a{i}"] for i in range(n)]
    payload = make_payload([{"name": "第一阶段", "functions": [mkfunction("F", [mkcase(f"N-{n:03d}.CTD", inputs, outputs)])]}])
    out = tmp / f"n{n}.docx"
    build(str(TEMPLATE), payload, str(out), refresh_toc=False)
    doc = Document(str(out))
    t = [x for x in doc.tables if len(x.columns) == 11][0]
    expected = 13 + (n - 1)  # 模板自带 1 行变量占位
    check(len(t.rows) == expected, f"{n} 组变量 → {len(t.rows)} 行（期望 {expected}）")
    if n > 1:
        check(t.rows[8].cells[0].text.strip() == "in1", f"{n} 组时第二行变量名正确")

print("\n== 多阶段 × 多函数 × 多用例 ==")
phases = []
for pi in range(3):
    funcs = []
    for fi in range(2):
        funcs.append(
            mkfunction(
                f"F{pi}{fi}",
                [mkcase(f"P{pi}F{fi}C{ci}.CTD", [["a", "1"]], [["b", "2", "2"]], passed=(ci % 2 == 0))
                 for ci in range(2)],
            )
        )
    phases.append({"name": f"第{pi + 1}阶段", "functions": funcs})

out = tmp / "many.docx"
build(str(TEMPLATE), make_payload(phases), str(out), refresh_toc=False)
doc = Document(str(out))
case_count = 3 * 2 * 2
check(len(doc.tables) == TEMPLATE_TABLES + case_count,
      f"3 阶段 × 2 函数 × 2 用例 → {TEMPLATE_TABLES + case_count} 张表（实际 {len(doc.tables)}）")

h1 = [p.text.strip() for p in doc.paragraphs if p.style.name == "编号标题1" and p.text.strip()]
for name in ("第1阶段", "第2阶段", "第3阶段"):
    check(f"{name}项目测试结果" in h1, f"阶段标题存在：{name}项目测试结果")

h2 = [p.text.strip() for p in doc.paragraphs if p.style.name == "编号标题2" and p.text.strip()]
h3 = [p.text.strip() for p in doc.paragraphs if p.style.name == "编号标题3" and p.text.strip()]

check(h2.count("测试结果总结") == 3, f"每个阶段一个「测试结果总结」（实际 {h2.count('测试结果总结')}）")
check(h3 and sum(1 for x in h3 if x.startswith("F")) == 6,
      f"6 个函数各成三级标题（实际 {sum(1 for x in h3 if x.startswith('F'))}）")
for section in ("遇到的问题", "与测试用例/规程不一致", "回归测试"):
    check(h2.count(section) == 3, f"每个阶段一节「{section}」（实际 {h2.count(section)}）")


print("\n== 模板异常 ==")
broken = tmp / "broken.docx"
d = Document(str(TEMPLATE))
for p in d.paragraphs:
    if "项目测试结果" in p.text:
        for run in p.runs:
            run.text = ""
d.save(str(broken))
try:
    build(str(broken), make_payload([{"name": "第一阶段", "functions": [mkfunction("F", [mkcase("X-1.CTD", [], [])])]}]),
          str(tmp / "b.docx"), refresh_toc=False)
    check(False, "缺少「项目测试结果」时应抛 BuilderError")
except BuilderError as exc:
    check(True, f"缺少「项目测试结果」抛 BuilderError：{str(exc).splitlines()[0]}")

print("\n== CLI 退出码 ==")


def run(args, stdin=None):
    return subprocess.run(
        [PY, str(Path(__file__).parent / "cmd.py")] + args,
        capture_output=True,
        text=True,
        encoding="utf-8",
        input=stdin,
        cwd=str(Path(__file__).parent),
    )


good = tmp / "good.json"
good.write_text(
    json.dumps(make_payload([{"name": "第一阶段", "functions": [mkfunction("F", [mkcase("G-1.CTD", [], [])])]}]),
               ensure_ascii=False),
    encoding="utf-8",
)

r = run(["--template", str(TEMPLATE), "--data", str(good), "-o", str(tmp / "ok.docx"), "--no-toc-refresh"])
check(r.returncode == 0, f"正常路径退出码 0（实际 {r.returncode}）{r.stderr.strip()[:80]}")

badj = tmp / "bad.json"
badj.write_text("{not json", encoding="utf-8")
r = run(["--template", str(TEMPLATE), "--data", str(badj), "-o", str(tmp / "x.docx"), "--no-toc-refresh"])
check(r.returncode == 1, f"JSON 语法错误退出码 1（实际 {r.returncode}）")

schemafail = tmp / "sf.json"
sf = make_payload([{"name": "第一阶段", "functions": [mkfunction("F", [mkcase("S-1.CTD", [], [])])]}])
sf["summary"] = {"total": 99, "passed": 99, "failed": 0}
schemafail.write_text(json.dumps(sf, ensure_ascii=False), encoding="utf-8")
r = run(["--template", str(TEMPLATE), "--data", str(schemafail), "-o", str(tmp / "x.docx"), "--no-toc-refresh"])
check(r.returncode == 2, f"schema 校验失败退出码 2（实际 {r.returncode}）")
check("用例总数" in r.stderr, f"stderr 含诊断信息：{r.stderr.strip()[:60]}")

r = run(["--template", str(broken), "--data", str(good), "-o", str(tmp / "x.docx"), "--no-toc-refresh"])
check(r.returncode == 3, f"模板不可用退出码 3（实际 {r.returncode}）")

r = run(["--template", str(tmp / "nope.docx"), "--data", str(good), "-o", str(tmp / "x.docx"), "--no-toc-refresh"])
check(r.returncode == 4, f"模板不存在退出码 4（实际 {r.returncode}）")

r = run(["--template", str(TEMPLATE), "--data", "-", "-o", str(tmp / "stdin.docx"), "--no-toc-refresh"],
        stdin=json.dumps(make_payload([{"name": "第一阶段", "functions": [mkfunction("F", [mkcase("P-1.CTD", [], [])])]}]),
                         ensure_ascii=False))
check(r.returncode == 0, f"stdin 输入退出码 0（实际 {r.returncode}）")
check((tmp / "stdin.docx").is_file(), "stdin 模式生成文件")

print()
print("== 注释率边界 ==")

# 1. 注释率达标（>= 30%）
payload_ok = make_payload([{"name": "第一阶段", "functions": [mkfunction("F", [mkcase("CR-1.CTD", [], [])])]}])
payload_ok["staticMetrics"] = {"commentRate": 35.0}
out_cr1 = tmp / "cr_ok.docx"
build(str(TEMPLATE), payload_ok, str(out_cr1), refresh_toc=False)
doc1 = Document(str(out_cr1))
text1 = "".join(p.text for p in doc1.paragraphs)
check("符合软件代码有效注释率不小于30%" in text1,
      f"注释率 35% → 报告含「符合」要求（{text1.count('注释率')} 处提到注释率）")

# 2. 注释率不达标（< 30%）
payload_bad = make_payload([{"name": "第一阶段", "functions": [mkfunction("F", [mkcase("CR-2.CTD", [], [])])]}])
payload_bad["staticMetrics"] = {"commentRate": 8.8}
out_cr2 = tmp / "cr_bad.docx"
build(str(TEMPLATE), payload_bad, str(out_cr2), refresh_toc=False)
doc2 = Document(str(out_cr2))
text2 = "".join(p.text for p in doc2.paragraphs)
check("不符合软件代码有效注释率不小于30%的要求（实际 8.8%）" in text2,
      f"注释率 8.8% → 报告含「不符合」及实际值（{text2.count('注释率')} 处提到注释率）")

# 3. 注释率未采集（staticMetrics 缺失）
payload_none = make_payload([{"name": "第一阶段", "functions": [mkfunction("F", [mkcase("CR-3.CTD", [], [])])]}])
out_cr3 = tmp / "cr_none.docx"
build(str(TEMPLATE), payload_none, str(out_cr3), refresh_toc=False)
doc3 = Document(str(out_cr3))
text3 = "".join(p.text for p in doc3.paragraphs)
check("不小于30%" not in text3,
      "注释率未采集 → 报告不含「不小于30%」声称")

shutil.rmtree(tmp, ignore_errors=True)

print()
if failures:
    print(f"FAILED {len(failures)}: {failures}")
    sys.exit(1)
print("ALL EDGE TESTS PASSED")