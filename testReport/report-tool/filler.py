"""Fill a single test-case table inside a Word template.

Public API
----------
fill_table(table: Table, case: dict, table_index: int) -> bool
    Write one case's data into a table that was cloned from the prototype.
    Returns True on success, False if the table does not look like a valid
    test-case table.

set_cell_text(cell, text)
    Write ``text`` into a cell while preserving the formatting of the first
    run found in its paragraphs.  The constant CHECK (``\\ue000``) inside
    the text expands into the template's native tick-box EQ field.
"""

from copy import deepcopy
from typing import Any, Dict, List, Optional

from docx.oxml.ns import qn
from docx.table import Table
from docx.shared import Pt

# ---------------------------------------------------------------------------
# The template draws a ticked box with a Word EQ field:
#     eq \o\ac(□,√)
# Our writer splits on this marker and injects the 7-run field sequence,
# reusing the formatting of the first run in the cell.
# ---------------------------------------------------------------------------
CHECK = "\ue000"  # private-use marker – expands to the ticked-box field

FIELD_PARTS: List[tuple] = [
    ("fldChar", "begin"),
    ("instrText", " eq \\o\\ac("),
    ("instrText", "□"),
    ("instrText", ","),
    ("instrText", "√"),
    ("instrText", ")"),
    ("fldChar", "end"),
]

TYPE_OPTIONS = ["功能测试", "接口测试", "边界测试", "逻辑测试", "性能测试"]


# ===================================================================
#  Internal helpers
# ===================================================================


def _norm(text: str) -> str:
    return "".join((text or "").split())


def _clone_run(run_el, text: str):
    """Create a new ``<w:r>`` element that copies the *formatting* from
    ``run_el`` but writes ``text`` inside a single ``<w:t>`` node."""
    new = deepcopy(run_el)
    for child in list(new):
        if child.tag != qn("w:rPr"):
            new.remove(child)
    node = new.makeelement(qn("w:t"), {})
    node.set(qn("xml:space"), "preserve")
    node.text = text
    new.append(node)
    return new


def _field_runs(paragraph, rpr_template):
    """Append the seven-run sequence that Word renders as a ticked box."""
    for kind, value in FIELD_PARTS:
        run = deepcopy(rpr_template)
        for child in list(run):
            if child.tag != qn("w:rPr"):
                run.remove(child)
        if kind == "fldChar":
            node = run.makeelement(qn("w:fldChar"), {})
            node.set(qn("w:fldCharType"), value)
        else:
            node = run.makeelement(qn("w:instrText"), {})
            node.set(qn("xml:space"), "preserve")
            node.text = value
        run.append(node)
        paragraph._p.append(run)


def _cell_text(cell) -> str:
    """Return intact cell text (including field codes)."""
    return cell.text or ""


def _cell_at(table: Table, row_idx: int, col_idx: int):
    return table.rows[row_idx].cells[col_idx]


def _find_row(table: Table, needle: str) -> int:
    for idx, row in enumerate(table.rows):
        if needle in _norm(row.cells[0].text):
            return idx
    return -1


# ===================================================================
#  Public
# ===================================================================


def set_cell_text(cell, text: str) -> None:
    """Write ``text`` into *cell*, preserving the formatting of its first
    run.  Every occurrence of CHECK triggers the EQ field sequence.

    The function clears existing children of the first paragraph (except
    ``<w:pPr>``) so that stale field codes from an earlier fill do not
    accumulate.
    """
    paragraphs = cell.paragraphs
    template_run = None
    for paragraph in paragraphs:
        if paragraph.runs:
            template_run = paragraph.runs[0]._r
            break

    # Remove extra paragraphs; keep only the first.
    for paragraph in paragraphs[1:]:
        paragraph._element.getparent().remove(paragraph._element)
    paragraph = cell.paragraphs[0]

    # Strip everything but paragraph-level properties.
    for child in list(paragraph._p):
        if child.tag != qn("w:pPr"):
            paragraph._p.remove(child)

    lines = str(text).split("\n")
    for line_index, line in enumerate(lines):
        if line_index:
            if template_run is not None:
                br_run = deepcopy(template_run)
                for child in list(br_run):
                    if child.tag != qn("w:rPr"):
                        br_run.remove(child)
                br_run.append(br_run.makeelement(qn("w:br"), {}))
                paragraph._p.append(br_run)
            else:
                paragraph.add_run().add_break()
        for chunk_index, chunk in enumerate(line.split(CHECK)):
            if chunk_index:
                if template_run is not None:
                    _field_runs(paragraph, template_run)
            if not chunk:
                continue
            if template_run is not None:
                paragraph._p.append(_clone_run(template_run, chunk))
            else:
                paragraph.add_run(chunk)


def set_paragraph_text(paragraph, text: str) -> None:
    """Replace a paragraph's content, keeping its <w:pPr> and run formatting.

    Unlike :func:`set_cell_text` this writes into *one* paragraph, so a cell
    whose layout is several stacked paragraphs keeps that layout instead of
    collapsing into a single paragraph with line breaks.
    """
    template_run = paragraph.runs[0]._r if paragraph.runs else None
    for child in list(paragraph._p):
        if child.tag != qn("w:pPr"):
            paragraph._p.remove(child)
    if text == "":
        return
    lines = str(text).split("\n")
    for line_index, line in enumerate(lines):
        if line_index and template_run is not None:
            br_run = deepcopy(template_run)
            for child in list(br_run):
                if child.tag != qn("w:rPr"):
                    br_run.remove(child)
            br_run.append(br_run.makeelement(qn("w:br"), {}))
            paragraph._p.append(br_run)
        for chunk_index, chunk in enumerate(line.split(CHECK)):
            if chunk_index and template_run is not None:
                _field_runs(paragraph, template_run)
            if not chunk:
                continue
            if template_run is not None:
                paragraph._p.append(_clone_run(template_run, chunk))
            else:
                paragraph.add_run(chunk)


def _case_count(function: Dict[str, Any]) -> int:
    """本单元用例数：兼容 caseCount / summary.total / cases 长度三种来源。"""
    if not isinstance(function, dict):
        return 0
    if isinstance(function.get('caseCount'), int):
        return function['caseCount']
    summary = function.get('summary') or {}
    if isinstance(summary.get('total'), int):
        return summary['total']
    cases = function.get('cases') or []
    return len(cases) if isinstance(cases, list) else 0


def _func_title(function: Dict[str, Any], case: Dict[str, Any]) -> str:
    """从 function 名或 subjectFunction 取短名（去掉路径和命名空间）。"""
    raw = ''
    if isinstance(function, dict):
        raw = str(function.get('name') or '')
    if not raw and isinstance(case, dict):
        raw = str(case.get('subjectFunction') or '')
    if not raw:
        return '未记录'
    return raw.split('::')[-1] or raw


def _fill_header_block(table: Table, case: Dict[str, Any], function: Optional[Dict[str, Any]]) -> None:
    """Fill the merged header block in row 0.

    The template block carries seven fields::

        单元标识：RingBuffer单元测试
        设计追溯：通用接口模块设计 5.9.2 RingBuffer
        功能描述：RingBuffer功能测试
        驱动模块： 无
        打桩模块：无
        覆盖率记录：-S 100% -B n/a -MCDC n/a
        备注：本单元共有2个测试用例

    All of them name template samples and must be replaced.  Coverage is only
    written when the upstream tool actually reported a value — it is never
    inferred (see the project plan's T08 rule).
    """
    function = function or {}
    lines = [
        f"单元标识：{function.get('unitId') or case.get('name', '')}",
        f"设计追溯：{function.get('trace') or '未提供设计追溯'}",
        f"功能描述：{_func_title(function, case)} 功能测试",
        f"被测函数：{case.get('subjectFunction') or case.get('functionId') or '未记录'}",
        f"驱动模块：{function.get('driver') or '未记录驱动模块'}",
        f"打桩模块：{case.get('stub') or '未记录'}",
        f"覆盖率记录：{(function.get('coverage') or '未采集').replace('-S', '-L')}",
        f"备注：本单元共有{_case_count(function)}个测试用例",
    ]
    cell = _cell_at(table, 0, 0)
    paragraphs = cell.paragraphs
    if len(paragraphs) >= len(lines):
        # the template stacks one paragraph per field — keep that layout
        for index, line in enumerate(lines):
            set_paragraph_text(paragraphs[index], line)
        for extra in paragraphs[len(lines):]:
            set_paragraph_text(extra, "")
    else:
        set_cell_text(cell, "\n".join(lines))


def fill_table(
    table: Table,
    case: Dict[str, Any],
    table_index: int = 0,
    function: Optional[Dict[str, Any]] = None,
) -> bool:
    """Fill *table* with data from *case*.

    The table must follow the template's grid layout:

    ======  ====================================================
    Row 0   Unit header block (merged 11 cols)
    Row 1   测试用例名称 (c1..c4)  |  测试用例标识 (c5..c6)  |  id (c7..c10)
    Row 2   测试类型 (c0..c10, merged)
    Row 3   活动桩 (merged)
    Row 4   测试说明 (merged)
    Row 5   输入 (c0..c3)  |  输出 (c4..c10)
    Row 6   变量名 (c0..c2) | 取值 (c3) | 变量名 (c4..c7) | 预期 (c8..c9) | 实际 (c10)
    Row 7+  Variable rows
    ...     通过准则 (anchor)
    ...     异常现象描述
    ...     设计者 | 校对者
    ...     执行情况 | 执行结果
    ...     测试人员 | 测试执行时间
    ======  ====================================================
    """
    # ── identity ──
    name = case.get("name") or _cell_text(_cell_at(table, 1, 1)).strip()
    case_id = case.get("id") or _cell_text(_cell_at(table, 1, 7)).strip()
    case_type = case.get("type", "功能测试")
    desc = case.get("description") or ""
    stub = case.get("stub") or "未记录"
    inserted = case.get("inserted") or "未记录"
    # "passed" / "failed" / "notRun"; fall back to the boolean when the caller
    # did not normalise the case through schema.validate()
    status = case.get("status") or ("passed" if case.get("passed", True) else "failed")

    _fill_header_block(table, case, function)
    set_cell_text(_cell_at(table, 1, 1), name)
    set_cell_text(_cell_at(table, 1, 7), case_id)

    # ── type row ──
    tokens = []
    for t in TYPE_OPTIONS:
        tokens.append((CHECK if t == case_type else "□") + t)
    set_cell_text(_cell_at(table, 2, 0), "测试类型：" + "、".join(tokens))

    # ── stub & description ──
    set_cell_text(_cell_at(table, 3, 0), "活动桩：" + stub)
    set_cell_text(_cell_at(table, 4, 0), f"测试说明：{desc} \n插入代码：{inserted};")

    # ── variable rows ──
    pass_row = _find_row(table, "通过准则")
    if pass_row < 0:
        return False

    inputs: List[tuple] = case.get("inputs") or []
    outputs: List[tuple] = case.get("outputs") or []
    wanted = max(len(inputs), len(outputs), 1)
    have = pass_row - 7  # rows 7 .. pass_row-1 are variable rows

    template_row = table.rows[7]._tr
    if wanted > have:
        anchor = table.rows[pass_row - 1]._tr
        for _ in range(wanted - have):
            clone = deepcopy(template_row)
            anchor.addnext(clone)
            anchor = clone
        pass_row += wanted - have
    elif wanted < have:
        for _ in range(have - wanted):
            row_el = table.rows[pass_row - 1]._tr
            row_el.getparent().remove(row_el)
            pass_row -= 1

    for offset in range(wanted):
        row_idx = 7 + offset
        var_in = inputs[offset][0] if offset < len(inputs) else ""
        val_in = inputs[offset][1] if offset < len(inputs) else ""
        var_out = outputs[offset][0] if offset < len(outputs) else ""
        expected = outputs[offset][1] if offset < len(outputs) else ""
        actual = outputs[offset][2] if offset < len(outputs) else ""

        # An unexecuted case has no actual output. Writing the template's
        # sample value (or leaving a blank that looks like an oversight) would
        # both be wrong, so say so explicitly — but only on rows that really
        # declare an output variable.
        if status == "notRun" and not actual and var_out:
            actual = "未执行"
        if status == "unconfirmed" and not actual and var_out:
            actual = "未确认"

        for column, value in ((0, var_in), (3, val_in), (4, var_out), (8, expected), (10, actual)):
            cell = _cell_at(table, row_idx, column)
            set_cell_text(cell, value)
            # 模板的窄值列原本使用正文大字号，长值会逐字换行。
            for paragraph in cell.paragraphs:
                paragraph.paragraph_format.space_before = Pt(0)
                paragraph.paragraph_format.space_after = Pt(0)
                for run in paragraph.runs:
                    run.font.size = Pt(9)

    set_cell_text(_cell_at(table, pass_row, 2), "测试断言满足用例预期时判通过；实际值缺少采集证据时按原样标明。")

    # ── outcome block ──
    issue = case.get("issue") or "未记录异常"
    bug_id = case.get("bugId") or "未记录"
    if status == "notRun" and case.get("notRunReason") and issue == "未记录异常":
        issue = "未执行：" + case["notRunReason"]

    row = _find_row(table, "异常现象描述")
    if row >= 0:
        set_cell_text(_cell_at(table, row, 2), issue)
        set_cell_text(_cell_at(table, row, 9), bug_id)

    row = _find_row(table, "执行情况")
    if row >= 0:
        if status == "notRun":
            # tick the second box instead of the first
            set_cell_text(_cell_at(table, row, 2), "□ 执行  " + CHECK + " 未执行")
            # no result at all: both boxes stay empty
            set_cell_text(_cell_at(table, row, 9), "□ 通过    □ 未通过")
        elif status == "unconfirmed":
            set_cell_text(_cell_at(table, row, 2), "□ 执行  □ 未执行（未确认）")
            set_cell_text(_cell_at(table, row, 9), "□ 通过    □ 未通过（未确认）")
        else:
            set_cell_text(_cell_at(table, row, 2), CHECK + " 执行  □ 未执行")
            if status == "passed":
                set_cell_text(_cell_at(table, row, 9), CHECK + " 通过    □ 未通过")
            else:
                set_cell_text(_cell_at(table, row, 9), "□ 通过    " + CHECK + " 未通过")

    row = _find_row(table, "测试人员")
    if row >= 0:
        set_cell_text(_cell_at(table, row, 2), case.get("tester") or "未记录")
        set_cell_text(_cell_at(table, row, 9), case.get("executedAt") or "未记录")

    row = _find_row(table, "设计者")
    if row >= 0:
        set_cell_text(_cell_at(table, row, 2), case.get("designer") or "未记录")
        set_cell_text(_cell_at(table, row, 9), case.get("reviewer") or "未记录")

    return True


def read_case_identity(table: Table):
    """Return ``(case_id, name)`` from the template's header rows."""
    return (
        _cell_text(_cell_at(table, 1, 7)).strip(),
        _cell_text(_cell_at(table, 1, 1)).strip(),
    )
