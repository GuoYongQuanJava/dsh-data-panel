"""Verify a generated report against the JSON it was built from.

The checker is data-driven: every expectation is derived from the input
payload, so it works for any dataset, not just one fixture.

Usage::

    python verify_report.py <report.docx> <data.json> [template.docx] [skill]

When the template path is given, the checker additionally asserts that no
template sample content leaked into the output.  Pass the same skill file the
report was built from, otherwise skill-derived fields (driver / coverage /
people) will not match.
"""

import json
import re
import sys

from docx import Document
from docx.oxml.ns import qn

from schema import validate
from skill_meta import load_skill

failures = []


def check(condition, message):
    if condition:
        print(f"  PASS  {message}")
    else:
        print(f"  FAIL  {message}")
        failures.append(message)


def fld_count(cell):
    """Number of <w:fldChar> elements = 2 per ticked-box field."""
    return len(cell._tc.findall(".//" + qn("w:fldChar")))


def cell_text(cell):
    return (cell.text or "").strip()


def body_text(doc):
    parts = []
    for p in doc.paragraphs:
        parts.append(p.text)
    for t in doc.tables:
        seen = set()
        for r in t.rows:
            for c in r.cells:
                if id(c._tc) in seen:
                    continue
                seen.add(id(c._tc))
                parts.append(c.text)
    return "\n".join(parts)


def main():
    report_path = sys.argv[1]
    data_path = sys.argv[2]
    template_path = sys.argv[3] if len(sys.argv) > 3 else None
    skill_path = sys.argv[4] if len(sys.argv) > 4 else None

    data = validate(
        json.load(open(data_path, encoding="utf-8")),
        load_skill(skill_path),
    )
    doc = Document(report_path)

    modules = data["modules"]
    all_cases = [c for m in modules for c in m["cases"]]

    # ── headings ──
    print("== 章节结构 ==")
    h3 = [p.text.strip() for p in doc.paragraphs if p.style.name == "编号标题3" and p.text.strip()]
    check(
        h3 == [m["name"] for m in modules],
        f"三级标题顺序与模块一致：{h3}",
    )
    h4 = [p.text.strip() for p in doc.paragraphs if p.style.name == "编号标题4" and p.text.strip()]
    check(
        h4.count("测试结果总结") == len(modules),
        f"每个模块都有「测试结果总结」：{h4.count('测试结果总结')}/{len(modules)}",
    )
    check(
        h4.count("遇到的问题") == len(modules),
        f"每个模块都有「遇到的问题」：{h4.count('遇到的问题')}/{len(modules)}",
    )
    check(
        h4.count("与测试用例/规程的不一致") == len(modules),
        f"每个模块都有「不一致」：{h4.count('与测试用例/规程的不一致')}/{len(modules)}",
    )

    stats = [p.text.strip() for p in doc.paragraphs if p.text.strip().startswith("共 ")]
    expected_stats = []
    for m in modules:
        n = len(m["cases"])
        ok = sum(1 for c in m["cases"] if c.get("status", "passed") == "passed")
        bad = sum(1 for c in m["cases"] if c.get("status") == "failed")
        skipped = sum(1 for c in m["cases"] if c.get("status") == "notRun")
        line = f"共 {n} 条用例，通过 {ok} 条，未通过 {bad} 条"
        if skipped:
            line += f"，未执行 {skipped} 条"
        expected_stats.append(line + "。")
    check(stats == expected_stats, f"模块统计行与数据一致：{stats}")

    # ── tables ──
    print("\n== 表格 ==")
    check(len(doc.tables) == len(all_cases), f"表格数 = 用例数（{len(doc.tables)} vs {len(all_cases)}）")
    if len(doc.tables) != len(all_cases):
        print("  表格数不符，后续逐表比对跳过")
    else:
        for idx, (table, case) in enumerate(zip(doc.tables, all_cases)):
            tag = f"T{idx} {case['id']}"
            ident = cell_text(table.rows[1].cells[7])
            name = cell_text(table.rows[1].cells[1])
            check(ident == case["id"], f"{tag} 标识一致（{ident}）")
            check(name == case["name"], f"{tag} 名称一致（{name}）")

            # header block (row 0) — unit / trace / func / driver / stub / coverage / note
            header = table.rows[0].cells[0]
            header_text = header.text
            expected_index = None
            running = 0
            for m in modules:
                if case in m["cases"]:
                    expected_index = (m, running + m["cases"].index(case))
                    break
                running += len(m["cases"])
            mod = expected_index[0] if expected_index else None
            if mod:
                # exact comparison beats a "must not contain X" heuristic: it
                # proves every field came from the data, whatever the data says.
                expected_lines = [
                    f"单元标识：{mod['unitId']}",
                    f"设计追溯：{mod['trace']}",
                    f"功能描述：{case.get('funcDesc') or case['name']}",
                    f"驱动模块：{mod['driver']}",
                    f"打桩模块：{case.get('stub') or '无'}",
                    f"覆盖率记录：{mod['coverage']}",
                    f"备注：本单元共有{mod['caseCount']}个测试用例",
                ]
                actual_lines = [p.text for p in header.paragraphs]
                check(
                    actual_lines == expected_lines,
                    f"{tag} 行0 七个字段逐段一致",
                )
                if actual_lines != expected_lines:
                    for want, got in zip(expected_lines, actual_lines):
                        if want != got:
                            print(f"          期望 {want!r}")
                            print(f"          实际 {got!r}")
                # the template stacks one paragraph per field; keep that layout
                check(
                    len(header.paragraphs) == 7,
                    f"{tag} 行0 保留 7 段落结构（{len(header.paragraphs)}）",
                )

            type_row = cell_text(table.rows[2].cells[0])
            check(type_row.startswith("测试类型："), f"{tag} 类型行存在")
            check("□" in type_row, f"{tag} 未选类型保留方框")
            check(
                fld_count(table.rows[2].cells[0]) == 2,
                f"{tag} 类型行有 1 个勾选域（fldChar={fld_count(table.rows[2].cells[0])}）",
            )

            desc_row = cell_text(table.rows[4].cells[0])
            check(
                case["description"][:12] in desc_row,
                f"{tag} 测试说明写入",
            )

            # variable rows: rows between index 7 and the 通过准则 anchor
            status = case.get("status", "passed" if case["passed"] else "failed")
            pass_row = next(
                (i for i, r in enumerate(table.rows) if "通过准则" in "".join(cell_text(r.cells[0]).split())),
                -1,
            )
            wanted = max(len(case["inputs"]), len(case["outputs"]), 1)
            actual_rows = pass_row - 7
            check(actual_rows == wanted, f"{tag} 变量行 {actual_rows} 行（期望 {wanted}）")

            for offset in range(wanted):
                row = table.rows[7 + offset]
                if offset < len(case["inputs"]):
                    expect_var, expect_val = case["inputs"][offset]
                    check(cell_text(row.cells[0]) == expect_var, f"{tag} 入参变量名 {expect_var}")
                    check(cell_text(row.cells[3]) == expect_val, f"{tag} 入参取值 {expect_val}")
                if offset < len(case["outputs"]):
                    out_var, expected, actual = case["outputs"][offset]
                    check(cell_text(row.cells[4]) == out_var, f"{tag} 输出变量名 {out_var}")
                    check(cell_text(row.cells[8]) == expected, f"{tag} 预期输出 {expected}")
                    if status == "notRun" and not actual:
                        check(
                            cell_text(row.cells[10]) == "未执行",
                            f"{tag} 未执行时实际输出列标注（{cell_text(row.cells[10])!r}）",
                        )
                    else:
                        check(cell_text(row.cells[10]) == actual, f"{tag} 实际输出 {actual}")

            # outcome — row order after 通过准则:
            #   +1 异常现象描述 | 软件问题单编号
            #   +2 设计者 | 校对者
            #   +3 执行情况 | 执行结果
            #   +4 测试人员 | 测试执行时间
            result_row = table.rows[pass_row + 3]
            exec_cell = result_row.cells[2]
            result_cell = result_row.cells[9]

            if status == "notRun":
                check(
                    "未执行" in exec_cell.text and fld_count(exec_cell) == 2,
                    f"{tag} 执行情况勾在「未执行」侧（{exec_cell.text!r}）",
                )
                check(
                    "通过" in result_cell.text
                    and "未通过" in result_cell.text
                    and fld_count(result_cell) == 0,
                    f"{tag} 执行结果两框都未勾（{result_cell.text!r}）",
                )
            else:
                check(fld_count(exec_cell) == 2, f"{tag} 执行情况有勾选域")
                check(fld_count(result_cell) == 2, f"{tag} 执行结果有勾选域")
                if status == "passed":
                    check(
                        result_cell.text.startswith("通过") or "通过" in result_cell.text,
                        f"{tag} 标记为通过",
                    )
                    check("□ 通过" not in result_cell.text, f"{tag} 未误勾未通过")
                else:
                    check("□ 通过" in result_cell.text, f"{tag} 勾选在未通过侧（{result_cell.text!r}）")

            if case.get("issue") and case["issue"] != "无":
                issue_row = table.rows[pass_row + 1]
                check(case["issue"][:10] in cell_text(issue_row.cells[2]), f"{tag} 异常描述写入")

    # ── optional fields ──
    print("\n== 可选字段 ==")
    if len(doc.tables) == len(all_cases):
        for idx, (table, case) in enumerate(zip(doc.tables, all_cases)):
            if not case.get("bugId") or case["bugId"] == "无":
                continue
            issue_row = table.rows[
                next(
                    i for i, r in enumerate(table.rows)
                    if "异常现象描述" in "".join(cell_text(r.cells[0]).split())
                )
            ]
            check(case["bugId"] in cell_text(issue_row.cells[9]), f"T{idx} 问题单号 {case['bugId']}")

    # ── template residue ──
    print("\n== 模板残留 ==")
    text = body_text(doc)
    if template_path:
        tpl = Document(template_path)
        tpl_ids = set(re.findall(r"[A-Z]{2,}-[A-Z0-9]+(?:-[A-Z0-9]+)+\.CTD", body_text(tpl)))
        used_ids = {c["id"] for c in all_cases}
        residue = {i for i in tpl_ids if i not in used_ids}
        leaked = [i for i in residue if i in text]
        check(not leaked, f"模板样例标识无残留（检查 {len(residue)} 个，泄漏 {leaked}）")

        tpl_modules = set()
        for p in tpl.paragraphs:
            if p.style.name == "编号标题3" and p.text.strip():
                tpl_modules.add(p.text.strip())
        used_modules = {m["name"] for m in modules}
        leaked_mods = [m for m in (tpl_modules - used_modules) if m in text]
        check(not leaked_mods, f"模板样例模块名无残留（泄漏 {leaked_mods}）")

    # ── TOC ──
    print("\n== 目录与文档属性 ==")
    toc_entries = [
        p.text.strip()
        for p in doc.paragraphs
        if p.style.name.lower().startswith("toc") and p.text.strip()
    ]
    has_update_flag = doc.settings.element.find(qn("w:updateFields")) is not None

    if toc_entries:
        check(True, f"目录已重建（{len(toc_entries)} 条）")
        check(
            not has_update_flag,
            "目录已重建且无 updateFields → 打开文档不会提示更新域",
        )
        # every module heading should appear in the TOC
        listed = "\n".join(toc_entries)
        missing = [m["name"] for m in modules if m["name"] not in listed]
        check(not missing, f"目录覆盖全部模块（缺 {missing}）")
        # no sample module from the template may survive in the TOC
        if template_path:
            tpl = Document(template_path)
            tpl_mods = {
                p.text.strip()
                for p in tpl.paragraphs
                if p.style.name == "编号标题3" and p.text.strip()
            }
            used = {m["name"] for m in modules}
            leaked = [m for m in (tpl_mods - used) if m in listed]
            check(not leaked, f"目录无模板样例模块（泄漏 {leaked}）")
    else:
        check(
            has_update_flag,
            "目录未重建时保留 updateFields 回退（打开时提示更新）",
        )

    print()
    if failures:
        print(f"FAILED {len(failures)}")
        for f in failures:
            print("  -", f)
        sys.exit(1)
    print("ALL CHECKS PASSED")


if __name__ == "__main__":
    main()