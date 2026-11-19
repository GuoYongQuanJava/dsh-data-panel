"""Verify a generated v2 report against the JSON it was built from.

The checker is data-driven: every expectation is derived from the input
payload, so it works for any dataset, not just one fixture.

Usage::

    python verify_report.py <report.docx> <data.json> [template.docx]
"""
import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from docx import Document  # noqa: E402
from docx.oxml.ns import qn  # noqa: E402

from schema import SchemaError, validate  # noqa: E402

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

    # 先过一遍 schema 归一化：builder 看到的也是归一化后的数据，这样缺省字段
    # （unitId / trace / driver / coverage 等）两边口径一致，不会因为原始文件省字段就 KeyError。
    raw = json.load(open(data_path, encoding="utf-8"))
    try:
        data = validate(raw)
    except SchemaError as exc:
        print(f"数据不符合 v2 约定：{exc}", file=sys.stderr)
        return 2
    doc = Document(report_path)

    phases = data["phases"]

    # Flatten all cases with their phase and function context.
    all_cases = []       # [(phase, func, case), ...]
    all_funcs = []       # [(phase, func), ...]
    for phase in phases:
        for func in phase["functions"]:
            all_funcs.append((phase, func))
            for case in func["cases"]:
                all_cases.append((phase, func, case))

    # ── balance checks ──
    print("== 数量平衡校验 ==")

    # Per-phase: function.summary.total sum vs actual case count
    for phase in phases:
        func_sum = sum(f["summary"]["total"] for f in phase["functions"])
        actual = sum(1 for p, f, c in all_cases if p["phaseId"] == phase["phaseId"])
        check(
            func_sum == actual,
            f"{phase['name']} function.summary.total 合计({func_sum}) == 实际用例数({actual})",
        )

    # Global: sum of all function totals == summary.total
    phase_total = sum(
        sum(f["summary"]["total"] for f in p["functions"]) for p in phases
    )
    summary_total = data["summary"]["total"]
    check(
        phase_total == summary_total,
        f"各 phase 用例合计({phase_total}) == summary.total({summary_total})",
    )

    # Case-by-case status counts == summary counts
    status_counts = {"passed": 0, "failed": 0, "notRun": 0, "unconfirmed": 0}
    for _, _, case in all_cases:
        s = case.get("status", "passed")
        status_counts[s] = status_counts.get(s, 0) + 1
    for key in ["passed", "failed", "notRun", "unconfirmed"]:
        check(
            status_counts[key] == data["summary"][key],
            f"逐条 status={key} 计数({status_counts[key]}) == summary.{key}({data['summary'][key]})",
        )

    # ── coverage checks ──
    print("\n== 覆盖率校验 ==")
    if len(all_funcs) > 1:
        cov_values = [f.get("coverage", "") for _, f in all_funcs]
        unique = set(cov_values)
        all_same = len(unique) == 1
        # 所有函数都是「未采集」时，相同是正确结果（本来就没数据），不能当成串用。
        # 只有真有覆盖率数据时，「每个函数数字完全一样」才是把项目级数字复制到函数的迹象。
        # 只有真带百分比数字时，「每个函数数字完全一样」才是把项目级数字复制到函数的迹象。
        has_data = any("%" in (v or "") for v in cov_values)
        if not has_data:
            check(True, f"覆盖率全部未采集，无需比较串用（{len(all_funcs)} 个函数）")
        else:
            check(
                not all_same,
                f"覆盖率值未在所有 {len(all_funcs)} 个函数间串用（{len(unique)} 种不同值）",
            )
    else:
        check(True, "仅 1 个函数，覆盖率值唯一无需检查串用")

    for phase, func in all_funcs:
        cov = func.get("coverage", "")
        has_weicaiji = "未采集" in cov
        has_percent = bool(re.search(r"\d+%", cov))
        check(
            not (has_weicaiji and has_percent),
            f"{func['name']} 覆盖率无'未采集'与百分比数字并存",
        )

    # ── docx content checks ──
    print("\n== Docx 内容校验 ==")
    text = body_text(doc)

    # Phase names
    for phase in phases:
        check(
            phase["name"] in text,
            f"阶段标题「{phase['name']}」出现在文档中",
        )

    # Function names
    for _, func in all_funcs:
        check(
            func["name"] in text,
            f"函数标题「{func['name']}」出现在文档中",
        )

    # Case IDs
    case_ids = {c["id"] for _, _, c in all_cases}
    missing_ids = []
    for cid in case_ids:
        if cid not in text:
            missing_ids.append(cid)
    check(
        not missing_ids,
        f"全部 caseId 出现在文档中（缺 {len(missing_ids)}: {missing_ids[:5]}...）"
        if missing_ids
        else f"全部 {len(case_ids)} 个 caseId 出现在文档中",
    )

    # ── tables ──
    print("\n== 表格 ==")

    # Match tables to cases by case ID in row 1 cell 7.
    table_by_case = {}
    for t in doc.tables:
        if len(t.rows) > 1 and len(t.rows[1].cells) > 7:
            ident = cell_text(t.rows[1].cells[7])
            if ident in case_ids:
                table_by_case[ident] = t

    check(
        len(table_by_case) == len(all_cases),
        f"识别的用例表格数 == 用例数（{len(table_by_case)} vs {len(all_cases)}）",
    )

    if len(table_by_case) != len(all_cases):
        print("  表格数不符，后续逐表比对跳过")
        missing = case_ids - set(table_by_case)
        if missing:
            print(f"  缺失表格的用例: {missing}")
    else:
        for phase, func, case in all_cases:
            table = table_by_case.get(case["id"])
            if table is None:
                continue
            tag = f"{case['id']}"

            # Row 1 — name + caseId
            ident = cell_text(table.rows[1].cells[7])
            name = cell_text(table.rows[1].cells[1])
            check(ident == case["id"], f"{tag} 标识一致（{ident}）")
            check(name == case["name"], f"{tag} 名称一致（{name}）")

            # Header block (row 0) — metadata from function level
            header = table.rows[0].cells[0]
            # 与 filler._fill_header_block 保持一致：v2 一共 8 个字段（比 v1 多了「被测函数」），
            # 模板表头只有 7 个段落时，filler 会整个单元格换行拼成 1 个段落。
            # 所以这里按「文本行」比对，不假设段落数。
            coverage_text_v = (func.get('coverage') or '未采集').replace('-S', '-L')
            # 与 filler._func_title 一致：优先 function.name，取 :: 后的短名。
            raw_title = (func.get('name') if isinstance(func, dict) else '') or ''
            function_title = raw_title.split('::')[-1] or raw_title or '未记录'
            expected_lines = [
                f"单元标识：{func['unitId']}",
                f"设计追溯：{func['trace']}",
                f"功能描述：{function_title} 功能测试",
                f"被测函数：{case.get('subjectFunction') or case.get('functionId') or '未记录'}",
                f"驱动模块：{func['driver']}",
                f"打桩模块：{case.get('stub') or '未记录'}",
                f"覆盖率记录：{coverage_text_v}",
                f"备注：本单元共有{func['summary']['total']}个测试用例",
            ]
            actual_lines = [line for line in cell_text(header).splitlines() if line.strip()]
            check(
                actual_lines == expected_lines,
                f"{tag} 行0 八个字段逐段一致",
            )
            if actual_lines != expected_lines:
                for want, got in zip(expected_lines, actual_lines):
                    if want != got:
                        print(f"          期望 {want!r}")
                        print(f"          实际 {got!r}")
            check(
                len(actual_lines) == 8,
                f"{tag} 行0 有 8 个字段行（{len(actual_lines)}）",
            )

            # Type row (row 2)
            type_row = cell_text(table.rows[2].cells[0])
            check(type_row.startswith("测试类型："), f"{tag} 类型行存在")
            check("□" in type_row, f"{tag} 未选类型保留方框")
            check(
                fld_count(table.rows[2].cells[0]) == 2,
                f"{tag} 类型行有 1 个勾选域（fldChar={fld_count(table.rows[2].cells[0])}）",
            )

            # Description row (row 4)
            desc_row = cell_text(table.rows[4].cells[0])
            check(
                case["description"][:12] in desc_row,
                f"{tag} 测试说明写入",
            )

            # Variable rows — between row 7 and the "通过准则" row
            status = case.get("status", "passed")
            pass_row = next(
                (
                    i
                    for i, r in enumerate(table.rows)
                    if "通过准则" in "".join(cell_text(r.cells[0]).split())
                ),
                -1,
            )
            wanted = max(len(case.get("inputs", [])), len(case.get("outputs", [])), 1)
            actual_rows = pass_row - 7
            check(
                actual_rows == wanted,
                f"{tag} 变量行 {actual_rows} 行（期望 {wanted}）",
            )

            for offset in range(wanted):
                row = table.rows[7 + offset]
                if offset < len(case.get("inputs", [])):
                    expect_var, expect_val = case["inputs"][offset]
                    check(
                        cell_text(row.cells[0]) == expect_var,
                        f"{tag} 入参变量名 {expect_var}",
                    )
                    check(
                        cell_text(row.cells[3]) == expect_val,
                        f"{tag} 入参取值 {expect_val}",
                    )
                if offset < len(case.get("outputs", [])):
                    out_var, expected, actual = case["outputs"][offset]
                    check(
                        cell_text(row.cells[4]) == out_var,
                        f"{tag} 输出变量名 {out_var}",
                    )
                    check(
                        cell_text(row.cells[8]) == expected,
                        f"{tag} 预期输出 {expected}",
                    )
                    if status == "notRun" and not actual:
                        check(
                            cell_text(row.cells[10]) == "未执行",
                            f"{tag} 未执行时实际输出列标注（{cell_text(row.cells[10])!r}）",
                        )
                    else:
                        check(
                            cell_text(row.cells[10]) == actual,
                            f"{tag} 实际输出 {actual}",
                        )

            # Outcome rows after "通过准则"
            if pass_row >= 0:
                # +1 异常现象描述 | 软件问题单编号
                # +2 设计者 | 校对者
                # +3 执行情况 | 执行结果
                # +4 测试人员 | 测试执行时间
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
                    check(
                        fld_count(exec_cell) == 2,
                        f"{tag} 执行情况有勾选域",
                    )
                    check(
                        fld_count(result_cell) == 2,
                        f"{tag} 执行结果有勾选域",
                    )
                    if status == "passed":
                        check(
                            result_cell.text.startswith("通过")
                            or "通过" in result_cell.text,
                            f"{tag} 标记为通过",
                        )
                        check(
                            "□ 通过" not in result_cell.text,
                            f"{tag} 未误勾未通过",
                        )
                    else:
                        check(
                            "□ 通过" in result_cell.text,
                            f"{tag} 勾选在未通过侧（{result_cell.text!r}）",
                        )

                # Issue row (+1 after pass_row)
                if case.get("issue") and not str(case["issue"]).startswith("未记录"):
                    issue_row = table.rows[pass_row + 1]
                    check(
                        case["issue"][:10] in cell_text(issue_row.cells[2]),
                        f"{tag} 异常描述写入",
                    )

    # ── optional fields ──
    print("\n== 可选字段 ==")
    for phase, func, case in all_cases:
        table = table_by_case.get(case["id"])
        if table is None:
            continue
        if not case.get("bugId") or str(case["bugId"]).startswith("未记录"):
            continue
        issue_idx = next(
            (
                i
                for i, r in enumerate(table.rows)
                if "异常现象描述" in "".join(cell_text(r.cells[0]).split())
            ),
            -1,
        )
        if issue_idx < 0:
            continue
        issue_row = table.rows[issue_idx]
        check(
            case["bugId"] in cell_text(issue_row.cells[9]),
            f"{case['id']} 问题单号 {case['bugId']}",
        )

    # ── example leakage ──
    print("\n== 示例泄漏检查 ==")
    forbidden = [
        ("ZZKZDC-JT-WT-006", "示例问题编号"),
        ("WTCLD-ZZKZDC-JT-WT-001", "示例处理单编号"),
        ("2026年3月1日至2026年7月31日", "示例日期1"),
        ("2026年2月24日至2026年3月6日", "示例日期2"),
    ]
    for pattern, desc in forbidden:
        check(
            pattern not in text,
            f"文档不含{desc}「{pattern}」",
        )

    # 140 / 308 — only flag if present AND not real data
    nums_in_text = set(int(n) for n in re.findall(r"\b\d+\b", text))
    real_values = {
        data["summary"]["total"],
        data["summary"]["passed"],
        data["summary"]["failed"],
        data["summary"]["notRun"],
        data["summary"]["unconfirmed"],
    }
    for p in phases:
        for f in p["functions"]:
            for k in ("total", "passed", "failed", "notRun", "unconfirmed"):
                real_values.add(f["summary"].get(k, 0))
    for suspect in [140, 308]:
        if suspect in nums_in_text:
            check(
                suspect in real_values,
                f"示例统计数字 {suspect} 未泄漏（或确为真实数据）",
            )
        else:
            check(True, f"示例统计数字 {suspect} 未出现在文档中")

    # ── template residue (if template provided) ──
    if template_path:
        print("\n== 模板残留 ==")
        tpl = Document(template_path)
        tpl_ids = set(
            re.findall(r"[A-Z]{2,}-[A-Z0-9]+(?:-[A-Z0-9]+)+\.CTD", body_text(tpl))
        )
        used_ids = {c["id"] for _, _, c in all_cases}
        residue = {i for i in tpl_ids if i not in used_ids}
        leaked = [i for i in residue if i in text]
        check(
            not leaked,
            f"模板样例标识无残留（检查 {len(residue)} 个，泄漏 {leaked}）",
        )

        tpl_phases = set()
        for p in tpl.paragraphs:
            if p.style.name == "编号标题3" and p.text.strip():
                tpl_phases.add(p.text.strip())
        used_phases = {p["name"] for p in phases}
        leaked_phases = [m for m in (tpl_phases - used_phases) if m in text]
        check(
            not leaked_phases,
            f"模板样例阶段名无残留（泄漏 {leaked_phases}）",
        )

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
        listed = "\n".join(toc_entries)
        missing = [p["name"] for p in phases if p["name"] not in listed]
        check(not missing, f"目录覆盖全部阶段（缺 {missing}）")
        if template_path:
            tpl = Document(template_path)
            tpl_mods = {
                p.text.strip()
                for p in tpl.paragraphs
                if p.style.name == "编号标题3" and p.text.strip()
            }
            used = {p["name"] for p in phases}
            leaked = [m for m in (tpl_mods - used) if m in listed]
            check(not leaked, f"目录无模板样例阶段（泄漏 {leaked}）")
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