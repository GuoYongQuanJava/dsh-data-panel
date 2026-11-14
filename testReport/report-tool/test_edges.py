"""Edge cases: variable-row counts, module/case scaling, template errors."""

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

TEMPLATE = Path(__file__).resolve().parent.parent / "templates" / "RingBuffer-test.docx"
if not TEMPLATE.is_file():
    TEMPLATE = Path(r"C:\Users\PC\Desktop\RingBuffer-test(1).docx")
PY = sys.executable
failures = []


def check(condition, message):
    print(("  PASS  " if condition else "  FAIL  ") + message)
    if not condition:
        failures.append(message)


def make_payload(modules):
    cases = [c for m in modules for c in m["cases"]]
    return {
        "meta": {"project": "边界测试", "executedAt": "2026-11-13", "executor": "h"},
        "summary": {
            "total": len(cases),
            "passed": sum(1 for c in cases if c["passed"]),
            "failed": sum(1 for c in cases if not c["passed"]),
        },
        "modules": modules,
    }


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


tmp = Path(tempfile.mkdtemp(prefix="rpt-edge-"))

print("== 0 组变量 ==")
payload = make_payload([{"name": "M", "cases": [mkcase("Z-000.CTD", [], [])]}])
out = tmp / "zero.docx"
build(str(TEMPLATE), payload, str(out))
doc = Document(str(out))
t = doc.tables[0]
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
    payload = make_payload([{"name": "M", "cases": [mkcase(f"N-{n:03d}.CTD", inputs, outputs)]}])
    out = tmp / f"n{n}.docx"
    build(str(TEMPLATE), payload, str(out))
    doc = Document(str(out))
    t = doc.tables[0]
    expected = 13 + (n - 1)  # template ships 1 variable row
    check(len(t.rows) == expected, f"{n} 组变量 → {len(t.rows)} 行（期望 {expected}）")
    check(
        t.rows[8].cells[0].text.strip() == "in1" if n > 1 else True,
        f"{n} 组时第二行变量名正确",
    )

print("\n== 多模块多用例 ==")
modules = []
for mi in range(4):
    modules.append(
        {
            "name": f"模块{mi}",
            "issues": f"模块{mi}问题",
            "inconsistent": "无。",
            "cases": [
                mkcase(f"M{mi}-C{ci}.CTD", [["a", "1"]], [["b", "2", "2"]], passed=(ci % 2 == 0))
                for ci in range(3)
            ],
        }
    )
out = tmp / "many.docx"
build(str(TEMPLATE), make_payload(modules), str(out))
doc = Document(str(out))
check(len(doc.tables) == 12, f"4 模块 × 3 用例 → 12 张表（实际 {len(doc.tables)}）")
h3 = [p.text.strip() for p in doc.paragraphs if p.style.name == "编号标题3" and p.text.strip()]
check(h3 == ["模块0", "模块1", "模块2", "模块3"], f"模块标题顺序正确：{h3}")
issues = [p.text.strip() for p in doc.paragraphs if p.text.strip().startswith("模块") and "问题" in p.text]
check(len(issues) == 4, f"4 个模块级问题写入（实际 {len(issues)}）")

print("\n== 通过/失败统计 ==")
stats = [p.text for p in doc.paragraphs if p.text.startswith("共 ")]
check(stats[0] == "共 3 条用例，通过 2 条，未通过 1 条。", f"统计行正确：{stats[0]!r}")

print("\n== 模板异常 ==")
broken = tmp / "broken.docx"
d = Document(str(TEMPLATE))
for p in d.paragraphs:
    if p.style.name == "编号标题3":
        p.style = d.styles["Normal"]
d.save(str(broken))
try:
    build(str(broken), make_payload([{"name": "M", "cases": [mkcase("X-1.CTD", [], [])]}]), str(tmp / "b.docx"))
    check(False, "缺少编号标题3 时应抛 BuilderError")
except BuilderError as exc:
    check(True, f"缺少编号标题3 抛 BuilderError：{exc}")

no_table = tmp / "notable.docx"
d = Document(str(TEMPLATE))
for tbl in list(d.element.body.findall(qn_table)):
    d.element.body.remove(tbl)
d.save(str(no_table))
try:
    build(str(no_table), make_payload([{"name": "M", "cases": [mkcase("X-2.CTD", [], [])]}]), str(tmp / "b2.docx"))
    check(False, "模板无表格时应抛错")
except BuilderError as exc:
    check(True, f"模板无表格抛 BuilderError：{exc}")

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
good.write_text(json.dumps(make_payload([{"name": "M", "cases": [mkcase("G-1.CTD", [], [])]}]), ensure_ascii=False), encoding="utf-8")

r = run(["--template", str(TEMPLATE), "--data", str(good), "-o", str(tmp / "ok.docx")])
check(r.returncode == 0, f"正常路径退出码 0（实际 {r.returncode}）")

badj = tmp / "bad.json"
badj.write_text("{not json", encoding="utf-8")
r = run(["--template", str(TEMPLATE), "--data", str(badj), "-o", str(tmp / "x.docx")])
check(r.returncode == 1, f"JSON 语法错误退出码 1（实际 {r.returncode}）")

schemafail = tmp / "sf.json"
sf = make_payload([{"name": "M", "cases": [mkcase("S-1.CTD", [], [])]}])
# keep passed+failed == total so the module-count check is the one that fires
sf["summary"]["total"] = 99
sf["summary"]["passed"] = 99
sf["summary"]["failed"] = 0
schemafail.write_text(json.dumps(sf, ensure_ascii=False), encoding="utf-8")
r = run(["--template", str(TEMPLATE), "--data", str(schemafail), "-o", str(tmp / "x.docx")])
check(r.returncode == 2, f"schema 校验失败退出码 2（实际 {r.returncode}）")
check("用例总数" in r.stderr, f"stderr 含诊断信息：{r.stderr.strip()[:60]}")

r = run(["--template", str(tmp / "nope.docx"), "--data", str(good), "-o", str(tmp / "x.docx")])
check(r.returncode == 4, f"模板不存在退出码 4（实际 {r.returncode}）")

r = run(["--template", str(TEMPLATE), "--data", "-", "-o", str(tmp / "stdin.docx")], stdin=json.dumps(make_payload([{"name": "M", "cases": [mkcase("P-1.CTD", [], [])]}]), ensure_ascii=False))
check(r.returncode == 0, f"stdin 输入退出码 0（实际 {r.returncode}）")
check((tmp / "stdin.docx").is_file(), "stdin 模式生成文件")

shutil.rmtree(tmp, ignore_errors=True)

print()
if failures:
    print(f"FAILED {len(failures)}: {failures}")
    sys.exit(1)
print("ALL EDGE TESTS PASSED")