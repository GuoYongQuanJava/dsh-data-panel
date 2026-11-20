# -*- coding: utf-8 -*-
"""
集成测试报告生成器（原型）

设计原则
========
1. **完全独立**：不 import、不修改 testReport/ 下任何文件，不写仓库内路径。
2. **方法复用**：照搬单元测试报告的做法 —— 砍掉模板正文 → 按数据克隆标题和表格 → 逐格填。
3. **定位方式更换**：该模板 43 段全是 Normal 样式，无法靠「编号标题2/3/4」定位，
   改为按**文字特征**定位原型段落。

产出两种报告
============
- 整项目报告：完整章节（1 范围 … 5 注释 + 附录），4.x 按功能项循环
- 单步骤报告：只保留 4.1.1「测试结果总结」那一张表
"""

from __future__ import annotations

import copy
import json
import os
import re
import sys
from pathlib import Path

from docx import Document
from docx.oxml.ns import qn
from docx.table import Table
from docx.text.paragraph import Paragraph

# ─────────────────────────────────────────────────────────────
#  EQ 域：与单元测试报告同一套做法
#  模板用 `eq \\o\\ac(□,√)` 画勾选框。写入时先落一个私有区标记，
#  再展开成 7 个 run 的域序列，从而复用模板首 run 的字体与字号。
# ─────────────────────────────────────────────────────────────
CHECK = "\ue000"

FIELD_PARTS = [
    ("fldChar", "begin"),
    ("instrText", " eq \\o\\ac("),
    ("instrText", "□"),
    ("instrText", ","),
    ("instrText", "√"),
    ("instrText", ")"),
    ("fldChar", "end"),
]

EMPTY_BOX = "□"

# 人员三字段（设计者 / 校对者 / 测试人员）的默认值。
# 用户明确要求：现在还没有规范，暂时都写 admin，等定稿后再改。
DEFAULT_PEOPLE = "admin"

# 模板里给填写者看的提示括号，正式报告要清掉
HINT_PATTERNS = [
    "（制式的，按情况写x的值）",
    "（制式的）",
    "（功能项名称）",
    "（功能点名称）",
]

# 用例类型 → 报告里「测试类型」列的中文名。
#
# 注意与「测试方法」区分：测试方法固定写「黑盒测试」，
# 测试类型要按用例本身是功能/接口/边界/性能/安全性/余量来填。
# 强度测试（stress）本轮不做，但映射留着，免得遇到旧数据报 KeyError。
TYPE_LABELS = {
    "functional": "功能测试",
    "performance": "性能测试",
    "boundary": "边界测试",
    "api": "接口测试",
    "stress": "强度测试",
    "security": "安全性测试",
    "margin": "余量测试",
}

# 用例类型 → 用例标识里的**测试类型缩写**（标识规范第一段）。
#
# 标识规范：GZ-651-ZZKZDZ_SRS_RECV_TOPIC-1-T001.CTD
#                  ↑ 这一段
TYPE_ABBR = {
    "functional": "GN",
    "performance": "XN",
    "boundary": "BJ",
    "api": "JK",
    "stress": "QD",
    "security": "AQ",
    "margin": "YL",
}

# 标识里固定不变的两段（用户明确要求：651 和 .CTD 不动）
CASE_CODE_PREFIX_NUM = "651"
CASE_CODE_SUFFIX = ".CTD"

# 规范用例标识的形状：`GN-651-JYSG_DM_AUTH_LOGIN-1-T001.CTD`
#
# 用途只有一个：**挡住「用例标识」列被内部主键冒充**。
# 内部主键 `caseId` 形如 `V0_0_1-IT-001`，带版本前缀，肉眼一看就像版本号 ——
# 之前它就是「有的报告标识写得跟版本号一样」的根因。
CASE_CODE_PATTERN = re.compile(
    r"^(?:GN|XN|BJ|JK|QD|AQ|YL)-" + re.escape(CASE_CODE_PREFIX_NUM) + r"-[A-Z0-9_]+-\d-T\d{3}"
    + re.escape(CASE_CODE_SUFFIX) + r"$"
)

# ─────────────────────────────────────────────────────────────
#  页面可用宽度（twips）
#
#  模板是 A4 纵向，左右页边距各 1800，可用 11906-3600 = 8306。
#  所有表格都按 fixed 布局铺满这 8306 —— 模板原样是 `tblLayout=autofit`，
#  交给 Word/WPS 按内容算列宽，结果就是「标签列被压成一列字、右侧留一大片空白」
#  （用户截图里的样子）。固定列宽是唯一稳定的做法。
# ─────────────────────────────────────────────────────────────
PAGE_USABLE_WIDTH = 8306

# 单用例表（模板表4，5 个 gridCol）。
#
# 模板原值是 705/1425/2130/2131/2131：前两列被 gridSpan=2 合成 2130 的标签列，
# 问题不大，但 word 在 autofit 下会把 705 那一列当「最窄可压缩列」压到接近 0，
# 于是「测试用例标识」六个字被挤成一列竖排。
# 这里显式给成：标签 1800 / 值 2100 / 类型 1600 / 值 2806。
CASE_TABLE_WIDTHS = [900, 900, 2100, 1600, 2806]

# 表1 分布统计（11 列）：序号 / 测试阶段 / 需求功能项 / 用例数 / 7 类
DISTRIBUTION_WIDTHS = [500, 1150, 1900, 760, 570, 570, 570, 570, 570, 570, 576]

# 表2 测试结果记录单（6 列）
RECORD_TABLE_WIDTHS = [560, 1100, 1500, 2300, 2200, 646]

# 表0 软件信息表（9 列）
INFO_TABLE_WIDTHS = [1000, 800, 800, 1100, 900, 1000, 1100, 700, 906]

# 表2 软件问题分类统计（8 个 gridCol：文档问题×3 / 程序问题×3 / 合计 / 归零）
ISSUE_TABLE_WIDTHS = [800, 750, 800, 800, 750, 800, 1600, 2006]

# 附录 A 软件问题报告单（6 列）
APPENDIX_ISSUE_WIDTHS = [1100, 1500, 1000, 1600, 1200, 1906]

# 附录 B 软件问题处理单（5 列）
APPENDIX_FIX_WIDTHS = [1500, 2700, 900, 1100, 2106]

# 需求来源缩写
SOURCE_SRS = "SRS"   # 有需求规则文档
SOURCE_CODE = "DM"   # 无需求文档，按代码归纳


def build_case_code(
    case_type: str,
    project_code: str,
    source: str,
    chapter: str,
    normal: bool,
    seq: int,
) -> str:
    """按规范拼用例标识。

    `GZ-651-ZZKZDZ_SRS_RECV_TOPIC-1-T001.CTD` 各段含义：

    | 段 | 含义 | 例 |
    |---|---|---|
    | `GZ` | 测试类型缩写（GN/JK/AQ/XN/BJ/QD/YL） | `JK` |
    | `651` | 固定不变 | `651` |
    | `ZZKZDZ` | 项目缩写 | `JYSG` |
    | `SRS` | 需求来源：有需求文档=SRS，按代码归纳=DM | `DM` |
    | `RECV_TOPIC` | 需求文档章节名；无需求时用功能点英文名（如 API_TESTING） | `API_TESTING` |
    | `1` / `2` | 1=正常用例，2=专门测异常情况的用例 | `2` |
    | `T001` | 序号 | `T002` |
    | `.CTD` | 固定不变 | `.CTD` |

    @param case_type: 用例类型（functional / api / security …）
    @param project_code: 项目缩写，如 JYSG
    @param source: "SRS" 或 "DM"
    @param chapter: 章节英文名或功能点英文名，如 API_TESTING
    @param normal: True=正常用例（1），False=异常用例（2）
    @param seq: 序号，从 1 开始
    """
    abbr = TYPE_ABBR.get(case_type, "GN")
    proj = (project_code or "PROJ").strip().upper()
    src = (source or SOURCE_CODE).strip().upper()
    chap = (chapter or "UNKNOWN").strip().upper().replace(" ", "_").replace("-", "_")
    flag = 1 if normal else 2
    return "{}-{}-{}_{}_{}-{}-T{:03d}{}".format(
        abbr, CASE_CODE_PREFIX_NUM, proj, src, chap, flag, int(seq), CASE_CODE_SUFFIX
    )


def build_trace_code(case_code: str) -> str:
    """详细需求追踪条目 = 用例标识去掉 `-N-Tnnn.CTD` 尾部。

    `JK-651-JYSG_DM_API_TESTING-2-T002.CTD` → `JK-651-JYSG_DM_API_TESTING`
    """
    text = str(case_code or "").strip()
    if text.endswith(CASE_CODE_SUFFIX):
        text = text[: -len(CASE_CODE_SUFFIX)]
    # 去掉最后两段（-N-Tnnn）
    parts = text.rsplit("-", 2)
    return parts[0] if len(parts) == 3 else text


# ═════════════════════════════════════════════════════════════
#  底层 XML 操作
# ═════════════════════════════════════════════════════════════


def _clone_run(run_el, text: str):
    """复制格式，写入新文本。"""
    new = copy.deepcopy(run_el)
    for child in list(new):
        if child.tag != qn("w:rPr"):
            new.remove(child)
    node = new.makeelement(qn("w:t"), {})
    node.set(qn("xml:space"), "preserve")
    node.text = text
    new.append(node)
    return new


def _field_runs(paragraph, rpr_template):
    """追加 7 个 run，Word 渲染成 [√] 方框。"""
    for kind, value in FIELD_PARTS:
        run = copy.deepcopy(rpr_template)
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


def set_cell_text(cell, text: str) -> None:
    """写入单元格，保留首 run 的格式；文本中的 CHECK 展开成勾选框。"""
    template_run = None
    for paragraph in cell.paragraphs:
        if paragraph.runs:
            template_run = paragraph.runs[0]._r
            break

    for paragraph in cell.paragraphs[1:]:
        paragraph._element.getparent().remove(paragraph._element)
    paragraph = cell.paragraphs[0]

    for child in list(paragraph._p):
        if child.tag != qn("w:pPr"):
            paragraph._p.remove(child)

    text = "" if text is None else str(text)
    for line_index, line in enumerate(text.split("\n")):
        if line_index:
            if template_run is not None:
                br_run = copy.deepcopy(template_run)
                for child in list(br_run):
                    if child.tag != qn("w:rPr"):
                        br_run.remove(child)
                br_run.append(br_run.makeelement(qn("w:br"), {}))
                paragraph._p.append(br_run)
            else:
                paragraph.add_run().add_break()
        for chunk_index, chunk in enumerate(line.split(CHECK)):
            if chunk_index and template_run is not None:
                _field_runs(paragraph, template_run)
            if not chunk:
                continue
            if template_run is not None:
                paragraph._p.append(_clone_run(template_run, chunk))
            else:
                paragraph.add_run(chunk)


def set_para_text(paragraph, text: str) -> None:
    """替换段落文字，保留段落属性与首个 run 的格式。"""
    runs = paragraph._p.findall(qn("w:r"))
    template_run = copy.deepcopy(runs[0]) if runs else None
    for child in list(paragraph._p):
        if child.tag != qn("w:pPr"):
            paragraph._p.remove(child)
    if template_run is None:
        paragraph.add_run(text)
        return
    for child in list(template_run):
        if child.tag != qn("w:rPr"):
            template_run.remove(child)
    node = template_run.makeelement(qn("w:t"), {})
    node.set(qn("xml:space"), "preserve")
    node.text = text
    template_run.append(node)
    paragraph._p.append(template_run)


# ═════════════════════════════════════════════════════════════
#  文档结构导航
# ═════════════════════════════════════════════════════════════


def body_items(doc):
    """按文档顺序返回 [(kind, obj)]，kind ∈ p / tbl / sect。"""
    items = []
    for child in doc.element.body.iterchildren():
        if child.tag == qn("w:p"):
            items.append(("p", Paragraph(child, doc)))
        elif child.tag == qn("w:tbl"):
            items.append(("tbl", Table(child, doc)))
        elif child.tag == qn("w:sectPr"):
            items.append(("sect", child))
    return items


def norm(text: str) -> str:
    return "".join((text or "").split())


def strip_hint(text: str) -> str:
    out = text
    for hint in HINT_PATTERNS:
        out = out.replace(hint, "")
    return out.strip()


def find_index(items, needle: str, start: int = 0) -> int:
    """在 items 里找第一个文字包含 needle 的段落，返回下标。"""
    key = norm(needle)
    for idx in range(start, len(items)):
        kind, obj = items[idx]
        if kind == "p" and key and key in norm(obj.text):
            return idx
    return -1


def find_table_after(items, para_idx: int) -> int:
    """段落之后的第一张表。"""
    for idx in range(para_idx + 1, len(items)):
        if items[idx][0] == "tbl":
            return idx
    return -1


def remove_items(items, lo: int, hi: int) -> None:
    """删除 [lo, hi) 区间的元素（段落与表格）。"""
    for idx in range(lo, hi):
        kind, obj = items[idx]
        if kind in ("p", "tbl"):
            el = obj._p if kind == "p" else obj._tbl
            parent = el.getparent()
            if parent is not None:
                parent.remove(el)


# ═════════════════════════════════════════════════════════════
#  排版：固定列宽 / 允许行内换行 / 竖向合并
#
#  这三件事都是「美观」问题，但根因都是结构问题：
#    · 模板表格是 autofit，Word 按内容算列宽 → 标签列被压成竖排一排字；
#    · set_cell_text 沿用模板里 `line=19 atLeast` 的紧凑行距，长英文标识
#      在窄格里换行后行距叠在一起，看起来像糊成一团；
#    · 分阶段后「测试阶段」「序号」两列会出现大量同值，必须合并才有可读性。
#  所以这里统一按「结构」去改，而不是靠调字号凑。
# ═════════════════════════════════════════════════════════════


def set_table_layout(table: Table, widths) -> None:
    """把表格改成 fixed 布局，并按 widths（twips）逐列写死列宽。

    为什么必须 fixed：模板里的表都是 `tblLayout=autofit` + `tblW=auto`，
    宽度完全由内容撑。用例标识这类长英文字符串一旦落进窄列，列就被拉宽，
    其它列被挤扁 —— 用户看到的就是「侧边挤成一竖排、右侧一片空白」。

    写三处才稳（Word 三处都看）：
      1. `<w:tblLayout w:type="fixed"/>`
      2. `<w:tblW>` 改成固定总宽
      3. `tblGrid` 的每个 `<w:gridCol w:w>`，以及每行每个 `<w:tcW>`

    @param table: 目标表
    @param widths: 每列宽度（twips）列表，长度按 gridCol 数给，允许比实际列少
    """
    if not widths:
        return
    tbl = table._tbl
    tblPr = tbl.tblPr

    # ① 布局方式：autofit → fixed
    layout = tblPr.find(qn("w:tblLayout"))
    if layout is None:
        layout = tblPr.makeelement(qn("w:tblLayout"), {})
        tblPr.append(layout)
    layout.set(qn("w:type"), "fixed")

    # ② 表宽：auto → 固定总宽
    total = sum(int(w) for w in widths)
    tblW = tblPr.find(qn("w:tblW"))
    if tblW is None:
        tblW = tblPr.makeelement(qn("w:tblW"), {})
        tblPr.append(tblW)
    tblW.set(qn("w:type"), "dxa")
    tblW.set(qn("w:w"), str(total))

    # ③ 列宽：gridCol + 每行每个 tc 的 tcW
    grid_cols = tbl.tblGrid.findall(qn("w:gridCol"))
    for index, grid_col in enumerate(grid_cols):
        if index < len(widths):
            grid_col.set(qn("w:w"), str(int(widths[index])))

    # 每行按各自 tc 的 gridSpan 分配宽度：一个横跨 n 格的 tc 拿 n 格之和。
    for row in table.rows:
        span_cursor = 0
        for tc in row._tr.findall(qn("w:tc")):
            tcPr = tc.find(qn("w:tcPr"))
            if tcPr is None:
                tcPr = tc.makeelement(qn("w:tcPr"), {})
                tc.insert(0, tcPr)
            span = 1
            span_el = tcPr.find(qn("w:gridSpan"))
            if span_el is not None:
                span = int(span_el.get(qn("w:val")) or 1)
            width = sum(int(w) for w in widths[span_cursor:span_cursor + span])
            span_cursor += span
            tcW = tcPr.find(qn("w:tcW"))
            if tcW is None:
                tcW = tcPr.makeelement(qn("w:tcW"), {})
                # tcW 必须排在 gridSpan 之前（schema 顺序），否则 Word 可能忽略
                span_el = tcPr.find(qn("w:gridSpan"))
                if span_el is not None:
                    span_el.addprevious(tcW)
                else:
                    tcPr.insert(0, tcW)
            tcW.set(qn("w:type"), "dxa")
            tcW.set(qn("w:w"), str(width))


def relax_line_spacing(table: Table) -> None:
    """把单元格段落里过紧的固定行距放开，让长英文换行后不再糊在一起。

    模板里大量段落写的是 `<w:spacing w:line="19" w:lineRule="atLeast"/>`
    （19 缇≈1 磅）。中文短标签单行时没问题，但用例标识这种长串一旦折行，
    行与行之间几乎没有间隙，截图里就是「字挤成一坨」。
    这里只对**数据表**调：把 lineRule 改成 auto 并给一个合理行距，
    不动字体字号，避免破坏模板观感。
    """
    for row in table.rows:
        for cell in row.cells:
            for paragraph in cell.paragraphs:
                pPr = paragraph._p.find(qn("w:pPr"))
                if pPr is None:
                    continue
                spacing = pPr.find(qn("w:spacing"))
                if spacing is None:
                    continue
                line = spacing.get(qn("w:line"))
                rule = spacing.get(qn("w:lineRule"))
                # 只放开「固定/最小值且过小」的那批
                if line is None:
                    continue
                try:
                    value = int(line)
                except ValueError:
                    continue
                if value < 240 or rule in ("exact", "atLeast"):
                    spacing.set(qn("w:line"), "240")
                    spacing.set(qn("w:lineRule"), "auto")


def merge_cells_down(table: Table, col: int, rows) -> None:
    """把某一列里连续的若干行纵向合并成一格，文字保留首行的。

    Word 的纵向合并是「首格 restart + 后续格 vMerge continue」，
    内容只留在首格，后续格的段落必须清空 —— 否则文字会叠加显示。

    @param table: 目标表
    @param col: 列索引（row.cells 的可见下标）
    @param rows: 要合并的行下标列表，必须连续且至少 2 行
    """
    if not rows or len(rows) < 2:
        return

    first_cell = table.rows[rows[0]].cells[col]
    text = first_cell.text

    for offset, row_index in enumerate(rows):
        cell = table.rows[row_index].cells[col]
        tcPr = cell._tc.get_or_add_tcPr()
        v_merge = tcPr.find(qn("w:vMerge"))
        if v_merge is None:
            v_merge = tcPr.makeelement(qn("w:vMerge"), {})
            tcPr.append(v_merge)
        if offset == 0:
            v_merge.set(qn("w:val"), "restart")
        else:
            # continue 不写 val（或写 continue），两种写法 Word 都认
            if qn("w:val") in v_merge.attrib:
                del v_merge.attrib[qn("w:val")]
            # 清空后续格，避免文字重复显示
            for paragraph in cell.paragraphs[1:]:
                paragraph._element.getparent().remove(paragraph._element)
            if cell.paragraphs:
                for child in list(cell.paragraphs[0]._p):
                    if child.tag != qn("w:pPr"):
                        cell.paragraphs[0]._p.remove(child)

    # 首格文字按原样写回（合并后 cells[col] 返回的都是首格，写一次就够）
    if text:
        set_cell_text(table.rows[rows[0]].cells[col], text)


def merge_cells_right(table: Table, row_index: int, start: int, end: int) -> None:
    """把同一行里 [start, end] 这几列横向合并成一格，文字取起始格。

    用于「用例汇总 / 占总测试用例百分比」这类需要跨列加长标签的收尾行：
    模板里这些标签是要塞进「需求功能项」那一列的。列宽一固定，长标签
    在那格里就折成三四行；跨到旁边几列就一行放得下。
    """
    if end <= start:
        return
    row = table.rows[row_index]
    cells = row.cells
    if end >= len(cells):
        return
    merged = cells[start]
    for index in range(start + 1, end + 1):
        merged = merged.merge(cells[index])
    return merged


# ═════════════════════════════════════════════════════════════
#  单用例表（模板表4，5 列 16 行）填充
# ═════════════════════════════════════════════════════════════


def find_row_by_anchor(table: Table, anchor: str) -> int:
    for idx, row in enumerate(table.rows):
        if norm(row.cells[0].text).startswith(norm(anchor)):
            return idx
    return -1


def resize_step_rows(table: Table, wanted: int) -> int:
    """把步骤行数量调整为 wanted，返回「通过准则」行的新下标。

    模板给 3 行步骤位（row 7/8/9）。步骤数大于 3 就克隆，少于 3 就删。
    """
    pass_row = find_row_by_anchor(table, "通过准则")
    if pass_row < 0:
        raise RuntimeError("表格里找不到「通过准则」行，模板结构不符")

    row_start = find_row_by_anchor(table, "序号")
    if row_start < 0:
        raise RuntimeError("表格里找不到「序号」表头行")

    row_start += 1  # 步骤数据从表头的下一行开始
    have = pass_row - row_start
    if wanted <= 0:
        wanted = 1

    if wanted > have:
        template_tr = table.rows[row_start]._tr
        anchor = table.rows[pass_row - 1]._tr
        for _ in range(wanted - have):
            clone = copy.deepcopy(template_tr)
            anchor.addnext(clone)
            anchor = clone
        pass_row += wanted - have
    elif wanted < have:
        for _ in range(have - wanted):
            tr = table.rows[pass_row - 1]._tr
            tr.getparent().remove(tr)
            pass_row -= 1

    return pass_row, row_start


def outcome_marks(status: str):
    """执行情况 / 执行结果 两个格子的文字（CHECK 展开成 [√]）。"""
    if status == "notRun":
        return (EMPTY_BOX + " 执行  " + CHECK + " 未执行",
                EMPTY_BOX + " 通过    " + EMPTY_BOX + " 未通过")
    if status == "unconfirmed":
        return (EMPTY_BOX + " 执行  " + EMPTY_BOX + " 未执行（未确认）",
                EMPTY_BOX + " 通过    " + EMPTY_BOX + " 未通过（未确认）")
    if status == "failed":
        return (CHECK + " 执行  " + EMPTY_BOX + " 未执行",
                EMPTY_BOX + " 通过    " + CHECK + " 未通过")
    return (CHECK + " 执行  " + EMPTY_BOX + " 未执行",
            CHECK + " 通过    " + EMPTY_BOX + " 未通过")


def pick_case_code(case: dict, meta: dict | None = None, fallback_seq: int = 1) -> str:
    """取这条用例的**规范用例标识**，绝不让内部主键冒出来当标识。

    这是「有的报告标识写得跟版本号一样」的根治点。

    历史坑：`caseId` 形如 `V0_0_1-IT-001`（带用例版本前缀），当用例没有
    `caseCode` 时，旧代码直接用 `caseId` 兜底 —— 于是报告里那一列就出现了
    「跟版本号一样」的东西，而且**不同报告表现还不一样**：
    用例生成得早的有 caseCode，晚的没有，就混着出来了。

    现在的规则（三层，全部挡住 caseId）：
      1. 用例自带合法 `caseCode` → 用它；
      2. 否则按规范**现场生成**一个（用 meta 的 projectCode/source）；
      3. 生成不出来（缺项目缩写）→ 用 `T{序号}` 占位，**也不用 caseId**。

    @param case: 用例字典，可能含 caseCode / type / chapter / polarity / seq
    @param meta: 报告 meta，提供 projectCode、source
    @param fallback_seq: 现场生成时的序号兜底
    @return: 规范形态的用例标识
    """
    meta = meta or {}
    code = str(case.get("caseCode") or "").strip()
    if code and CASE_CODE_PATTERN.match(code):
        return code
    # caseCode 存在但形状不合规（比如有人手填了 caseId）→ 也重建，不将错就错
    try:
        return build_case_code(
            case_type=case.get("type", "functional"),
            project_code=meta.get("projectCode") or "",
            source=meta.get("source") or SOURCE_CODE,
            chapter=case.get("chapter") or case.get("featureCode") or "UNKNOWN",
            normal=(case.get("polarity") or "normal") != "abnormal",
            seq=case.get("seq") or fallback_seq,
        )
    except Exception:
        # 兜底绝不用 caseId：宁可显示 T001 占位，也不让版本号冒充标识
        return "T%03d" % int(fallback_seq)


def fill_case_table(
    table: Table,
    case: dict,
    people: dict,
    feature: dict | None = None,
    meta: dict | None = None,
) -> None:
    """把一条用例填进 5 列 16 行的模板表。

    列索引对照（gridSpan 合并后 row.cells 的可见位置）：
        row0  [0]测试用例标识(span2) [2]值        [3]测试类型      [4]值
        row1  [0]测试用例名称(span2) [2]值        [3]测试方法      [4]值
        row2  [0]测试需求追踪(span2) [2]值(span3)
        row3  [0]测试说明(span2)     [2]值(span3)
        row4  [0]预置条件(span2)     [2]值(span3)
        row5  [0]测试过程(span5)
        row6  [0]序号 [1]输入步骤(span2) [3]预期结果 [4]实际测试结果
        row7+ 步骤数据行
        ...   [0]通过准则(span2)  [2]值(span3)
        ...   [0]备注信息(span2)  [2]值(span3)
        ...   [0]异常现象描述(span2) [2]值 [3]软件问题单编号 [4]值
        ...   [0]设计者(span2) [2]值 [3]校对者 [4]值
        ...   [0]执行情况(span2) [2]值 [3]执行结果 [4]值
        ...   [0]测试人员(span2) [2]值 [3]测试时间 [4]值
    """
    status = case.get("outcome") or "passed"
    steps = case.get("steps") or []
    feature = feature or {}

    # 先定列宽：必须在填内容之前 —— 内容一多，autofit 就会把列挤变形。
    set_table_layout(table, CASE_TABLE_WIDTHS)

    # ── 身份区 ──
    # 用例标识：一律走 pick_case_code()，它保证出来的是规范 caseCode，
    # 绝不让内部主键（V0_0_1-IT-001，长得像版本号）落进这一格。
    set_cell_text(
        table.rows[0].cells[2],
        pick_case_code(case, meta, fallback_seq=case.get("seq") or 1),
    )
    # 测试类型：按用例自身的类型填（功能测试 / 接口测试 / 边界测试 / 性能测试 / 安全性测试 / 余量测试）
    # 不能一律写「黑盒测试」——那是测试方法，不是类型。
    set_cell_text(table.rows[0].cells[4], case.get("typeLabel") or TYPE_LABELS.get(case.get("type"), case.get("type") or "功能测试"))

    set_cell_text(table.rows[1].cells[2], case.get("title", ""))
    # 测试方法：黑盒测试（固定值，与测试类型是两回事）
    set_cell_text(table.rows[1].cells[4], "黑盒测试")

    # 测试需求追踪：功能项编号 + 需求条目
    trace = " · ".join(
        part for part in [
            feature.get("code", ""),
            feature.get("name", ""),
            case.get("requirement", ""),
        ] if part
    )
    set_cell_text(table.rows[2].cells[2], trace or "未提供设计追溯")

    set_cell_text(table.rows[3].cells[2], case.get("description") or "无")
    set_cell_text(table.rows[4].cells[2], case.get("precondition") or "测试环境已部署，测试数据准备就绪")

    # ── 步骤区：先按实际步骤数增删行 ──
    pass_row, row_start = resize_step_rows(table, len(steps))

    for offset, step in enumerate(steps):
        row = table.rows[row_start + offset]
        step_status = step.get("outcome") or status
        observed = step.get("observed") or ("未记录实际值" if step_status != "notRun" else "未执行")
        set_cell_text(row.cells[0], str(step.get("no", offset + 1)))
        set_cell_text(row.cells[1], step.get("operation") or step.get("action") or "")
        set_cell_text(row.cells[3], step.get("expected") or "")
        set_cell_text(row.cells[4], observed)

    # 通过准则行：值在 cells[2]
    set_cell_text(table.rows[pass_row].cells[2], "实际测试结果与预期结果一致")

    # 备注信息
    note_row = pass_row + 1
    set_cell_text(table.rows[note_row].cells[2], case.get("note") or "无")

    # 异常现象描述 + 软件问题单编号
    issue_row = note_row + 1
    issue = case.get("issue")
    if status == "notRun" and case.get("notRunReason"):
        issue = "未执行：" + case["notRunReason"]
    failed_steps = [s for s in steps if (s.get("outcome") or status) in ("failed", "error")]
    if not issue and failed_steps:
        issue = "；".join(
            "第 %s 步：%s" % (s.get("no", "?"), s.get("observed") or s.get("expected") or "实际结果与预期不符")
            for s in failed_steps
        )
    set_cell_text(table.rows[issue_row].cells[2], issue or "无")
    # 软件问题单编号：暂定写「无」（用户要求：有规范了再说）
    set_cell_text(table.rows[issue_row].cells[4], case.get("bugId") or "无")

    # 设计者 / 校对者
    # 人员三字段暂定都写 admin（用户要求：等有规范了再改）
    people_row = issue_row + 1
    set_cell_text(table.rows[people_row].cells[2], people.get("designer") or DEFAULT_PEOPLE)
    set_cell_text(table.rows[people_row].cells[4], people.get("reviewer") or DEFAULT_PEOPLE)

    # 执行情况 / 执行结果
    exec_row = people_row + 1
    exec_text, result_text = outcome_marks("notRun" if status == "notRun" else status)
    set_cell_text(table.rows[exec_row].cells[2], exec_text)
    set_cell_text(table.rows[exec_row].cells[4], result_text)

    # 测试人员 / 测试时间
    tail_row = exec_row + 1
    set_cell_text(table.rows[tail_row].cells[2], people.get("tester") or DEFAULT_PEOPLE)
    set_cell_text(table.rows[tail_row].cells[4], case.get("executedAt") or "")


# ═════════════════════════════════════════════════════════════
#  表格：功能项 × 7 类 交叉统计（模板表1）
# ═════════════════════════════════════════════════════════════

TYPE_COLUMNS = [
    ("functional", "测试功能"),
    ("performance", "性能测试"),
    ("boundary", "边界测试"),
    ("api", "接口测试"),
    ("stress", "强度测试"),
    ("security", "安全性测试"),
    ("margin", "余量测试"),
]


def fill_distribution_table(table: Table, features: list, stage_name: str = "") -> None:
    """表1：每个功能项一行，统计 7 类用例数。

    用户明确要求：
      · 表头「测试功能」要改成「功能测试」；
      · 各类测试**没有的写 0，不要空着**；
      · 「测试阶段」列不能空，填该功能项所属阶段；
      · **同一阶段的「序号」和「测试阶段」两列要纵向合并** ——
        合并后那一格代表「这个阶段有这么多个功能项」，而不是每行重复一遍阶段名；
      · **每个阶段一组小计（用例汇总 / 占总测试用例百分比%），表尾再一行总计**。

    注意：合并只合并「序号」和「测试阶段」两列，**不动「需求功能项」列**。
    功能项是这一行的主体，合并它会让人以为是一个功能项。

    模板给了 11 行数据位 + 2 行收尾，全部按数据重建。
    """
    # ── 修表头：「测试功能」→「功能测试」──
    for cell in table.rows[0].cells:
        if norm(cell.text) == "测试功能":
            set_cell_text(cell, "功能测试")

    # 列宽先定死：11 列表头里有 7 个“xx测试”，autofit 会把它们挤到互相压字
    set_table_layout(table, DISTRIBUTION_WIDTHS)

    header_row = 0
    data_start = 1

    # ── 计算数据：按阶段分组，保持功能项原有顺序 ──
    # 分组键 = 功能项自己的 stage，没有就用整表传入的 stage_name（单阶段兼容）
    groups = []          # [(阶段名, [ (功能项名, 用例数, counts) ... ])]
    group_index = {}     # 阶段名 → groups 下标
    for feature in features:
        stage_of_feature = feature.get("stage") or stage_name or ""
        cases = feature.get("cases") or []
        counts = {key: 0 for key, _ in TYPE_COLUMNS}
        for case in cases:
            ctype = case.get("type", "functional")
            if ctype in counts:
                counts[ctype] += 1
        entry = (feature.get("name") or "", len(cases), counts)
        if stage_of_feature not in group_index:
            group_index[stage_of_feature] = len(groups)
            groups.append((stage_of_feature, []))
        groups[group_index[stage_of_feature]][1].append(entry)

    # 一个功能项都没有时也要能出表：补一个空分组，避免整表空掉
    if not groups:
        groups = [(stage_name or "", [])]

    # ── 删掉模板的所有数据行（保留表头），按「数据行 + 小计行」重建 ──
    template_tr = copy.deepcopy(table.rows[data_start]._tr)
    header_anchor = table.rows[header_row]._tr
    for _ in range(len(table.rows) - 1):
        tr = table.rows[1]._tr
        tr.getparent().remove(tr)

    # 计划出所有行的类型，方便一次建够
    plan = []                      # [(kind, stage, name, total, counts)]
    stage_blocks = []              # [(阶段名, 数据行起始下标, 数据行结束下标, 小计行下标)]
    for stage, items in groups:
        start = len(plan)
        for name, total, counts in items:
            plan.append(("data", stage, name, total, counts))
        end = len(plan) - 1
        # 阶段小计：用例数 = 该阶段内功能项用例数之和；7 类分别累加
        sub_totals = {key: 0 for key, _ in TYPE_COLUMNS}
        grand_of_stage = 0
        for _, total, counts in items:
            grand_of_stage += total
            for key in sub_totals:
                sub_totals[key] += counts[key]
        plan.append(("subtotal", stage, "本阶段用例汇总", grand_of_stage, sub_totals))
        stage_blocks.append((stage, start, end, len(plan) - 1))

    # 全项目总计
    overall_totals = {key: 0 for key, _ in TYPE_COLUMNS}
    overall_grand = 0
    for _, items in groups:
        for _, total, counts in items:
            overall_grand += total
            for key in overall_totals:
                overall_totals[key] += counts[key]
    plan.append(("total", "", "用例汇总", overall_grand, overall_totals))
    plan.append((
        "percent", "", "占总测试用例百分比%", None,
        {key: (overall_totals[key] * 100.0 / overall_grand if overall_grand else 0.0)
         for key, _ in TYPE_COLUMNS},
    ))

    anchor = header_anchor
    for _ in plan:
        clone = copy.deepcopy(template_tr)
        anchor.addnext(clone)
        anchor = clone

    # ── 逐行填 ──
    for offset, (kind, stage, name, total, counts) in enumerate(plan):
        row_index = 1 + offset
        row = table.rows[row_index]

        if kind == "data":
            set_cell_text(row.cells[0], "1")     # 合并后会被首行文字覆盖，先占位
            set_cell_text(row.cells[1], stage)
            set_cell_text(row.cells[2], name)
            set_cell_text(row.cells[3], str(total))
            for col, (key, _) in enumerate(TYPE_COLUMNS, start=4):
                set_cell_text(row.cells[col], str(counts[key]))
            continue

        if kind == "subtotal":
            # 小计行：「序号」格写「小计」，「测试阶段」格留空 —— 它已经在阶段名的合并块里，
            # merge_cells_down() 会把后续格清空，所以这里写什么都会被清，只是先写个语义值。
            set_cell_text(row.cells[0], "小计")
            set_cell_text(row.cells[1], "")
            set_cell_text(row.cells[2], name)
            set_cell_text(row.cells[3], str(total))
            for col, (key, _) in enumerate(TYPE_COLUMNS, start=4):
                set_cell_text(row.cells[col], str(counts[key]))
            continue

        # total / percent 两行是表尾总计：序号留空，测试阶段写「合计」
        set_cell_text(row.cells[0], "")
        set_cell_text(row.cells[1], "合计")
        set_cell_text(row.cells[2], name)
        if kind == "total":
            set_cell_text(row.cells[3], str(overall_grand))
            for col, (key, _) in enumerate(TYPE_COLUMNS, start=4):
                set_cell_text(row.cells[col], str(counts[key]))
        else:
            set_cell_text(row.cells[3], "100%" if overall_grand else "0%")
            for col, (key, _) in enumerate(TYPE_COLUMNS, start=4):
                set_cell_text(row.cells[col], "%.1f%%" % counts[key])

    # ── 纵向合并：每个阶段内「序号」与「测试阶段」两列各合成一格 ──
    # 用户原话：「测试阶段都是第一阶段，测试阶段这一列属于第一阶段的就要合并单元格，
    #           包括序号也是，就说明这一个阶段有这么多的功能项」。
    # 所以：
    #   · 序号列合并块 = 该阶段的**功能项行**，首格写功能项数（= 这阶段有几个功能项）；
    #   · 测试阶段列合并块 = 功能项行 + 本阶段小计行，首格写阶段名。
    #     小计行也算这一阶段的，让阶段名一直竖到底，不会出现「小计行那格空着」。
    # 两列合并范围不同是允许的，Word 按每格自己的 vMerge 走。
    for stage, start, end, subtotal_row in stage_blocks:
        feature_block = list(range(1 + start, 1 + end + 1))
        if len(feature_block) >= 2:
            merge_cells_down(table, 0, feature_block)
            # 合并后首格写「本阶段功能项数」——比重复流水号更有信息量
            set_cell_text(table.rows[1 + start].cells[0], str(len(feature_block)))

        stage_block = feature_block + [1 + subtotal_row]
        if len(stage_block) >= 2:
            merge_cells_down(table, 1, stage_block)

    # 放宽行距：这表里「需求功能项」列有中文长名，固定 19 缇会挤在一起
    relax_line_spacing(table)


# ═════════════════════════════════════════════════════════════
#  表格：软件问题分类统计（模板表2）
# ═════════════════════════════════════════════════════════════


def fill_issue_table(table: Table, issues: list) -> None:
    """表2：软件问题分类统计。

    用户明确要求：
      · 「测试问题归零解决情况」**填「无」** —— 本套报告里的问题都还没闭环，
        写「已归零」是造假；
      · 六格（文档问题 重大/严重/一般、程序问题 重大/严重/一般）按问题级别真实统计，
        没有就是 0。

    模板 r0/r1 是两级表头（文档问题 × 3、程序问题 × 3、合计问题数、归零情况），
    r2 是数据行 —— 只填 r2。
    """
    if len(table.rows) < 3:
        return
    set_table_layout(table, ISSUE_TABLE_WIDTHS)

    row = table.rows[len(table.rows) - 1]
    cells = row.cells

    # 按「问题类别 + 级别」归集。
    # 我们的数据模型里 issue 只有 level（一般/严重/重大），没有类别，
    # 一律按「程序问题」计 —— 集成测试发现的是软件行为问题，不是文档问题。
    # 若某条 issue 显式给了 kind=doc，才计入文档问题那三格。
    doc_counts = {"重大": 0, "严重": 0, "一般": 0}
    prog_counts = {"重大": 0, "严重": 0, "一般": 0}
    for issue in issues:
        level = (issue.get("level") or "一般").strip()
        if level not in prog_counts:
            level = "一般"
        if (issue.get("kind") or "").strip() in ("doc", "document", "文档问题"):
            doc_counts[level] += 1
        else:
            prog_counts[level] += 1

    values = [
        doc_counts["重大"], doc_counts["严重"], doc_counts["一般"],
        prog_counts["重大"], prog_counts["严重"], prog_counts["一般"],
    ]
    for col, value in enumerate(values):
        if col < len(cells):
            set_cell_text(cells[col], str(value))

    total = sum(values)
    if len(cells) > 6:
        set_cell_text(cells[6], str(total))
    if len(cells) > 7:
        # 用户明确要求填「无」：测试问题归零解决情况，本轮不宣称已闭环
        set_cell_text(cells[7], "无")


# ═════════════════════════════════════════════════════════════
#  整项目报告
# ═════════════════════════════════════════════════════════════


def build_overall_evaluation(doc, stages: list, meta: dict) -> None:
    """3.1 总体评估：按测试阶段数展开段落。

    模板里是两段：
      ① 制式段 —— 说明「共 x 个这样的段」，实际有几个阶段就复制几段，
         每段填对应阶段的数据（用例数 / 通过 / 未通过 / 问题数 / 日期 / 阶段名）。
      ② 结尾段 —— 「经本次配置项测试验证…」，固定文案，只替换软件名等占位。

    用户明确要求：「测试阶段有几个，第一段就有几个」。
    """
    items = body_items(doc)
    # 定位制式段与结尾段
    first_idx = find_index(items, "测试组依据软件需求")
    end_idx = find_index(items, "经本次配置项测试验证")
    if first_idx < 0 or end_idx < 0:
        return  # 模板结构变了就跳过，不要抛错打断整份报告

    # 锚点必须先取：删除之后元素就脱离文档树，getprevious() 拿不到了。
    anchor_element = items[first_idx][1]._p.getprevious()

    proto_first = copy.deepcopy(items[first_idx][1]._p)
    proto_end = copy.deepcopy(items[end_idx][1]._p)

    software = meta.get("softwareName") or "被测软件"
    version = meta.get("softwareVersion") or "x.xx.A"
    start_date = meta.get("testStartDate") or ""
    end_date = meta.get("testEndDate") or ""

    # 先删掉原来的制式段与结尾段（后面按阶段重建）
    for idx in (end_idx, first_idx):
        el = items[idx][1]._p
        if el.getparent() is not None:
            el.getparent().remove(el)

    body = doc.element.body
    anchor = anchor_element if anchor_element is not None else body[0]

    def add_after_anchor(element):
        nonlocal anchor
        anchor.addnext(element)
        anchor = element

    def stats_of(stage: dict):
        cases = []
        for feature in stage.get("features") or []:
            cases.extend(feature.get("cases") or [])
        total = len(cases)
        passed = sum(1 for c in cases if (c.get("outcome") or "") == "passed")
        failed = sum(1 for c in cases if (c.get("outcome") or "") in ("failed", "error"))
        issues = len(stage.get("issues") or [])
        return total, passed, failed, issues

    # ① 段落：**第一段写全项目总量**，之后每个阶段一段。
    #
    # 模板原文是一大段制式句，里面既有全项目总量也有单个阶段的描述：
    #   「测试组依据软件需求，共设计了测试用例 xxx 个 … 问题详见附录 A。
    #     其中，<起>到<止>，测试项目组对 x.xx.A 版 <软件> 的功能，开展了第一阶段配置项测试，
    #     测试组依据软件需求共设计测试用例 xx 个，共执行测试用例 xx 个。其中 …」
    #
    # 如果按阶段整段复制，总量句会重复 N 遍（3 个阶段就说 3 次「共设计 74 个」），
    # 越看越像凑字数。所以拆成两层：
    #   段 1：总量句（全项目）+ 第 1 阶段的「其中…」句
    #   段 2…N：只有本阶段的「其中…」句
    # 既没丢模板的任何一句，也没有重复。
    total_all, passed_all, failed_all, issues_all = 0, 0, 0, 0
    for stage in stages:
        t, p, f, i = stats_of(stage)
        total_all += t
        passed_all += p
        failed_all += f
        issues_all += i

    for index, stage in enumerate(stages):
        total, passed, failed, issues = stats_of(stage)
        p_el = copy.deepcopy(proto_first)
        add_after_anchor(p_el)
        anchor = p_el  # 下一段接在它后面，保持顺序
        stage_name = stage.get("name") or "集成测试"
        stage_start = stage.get("startDate") or start_date
        stage_end = stage.get("endDate") or end_date

        text = ""
        if index == 0:
            text = (
                "测试组依据软件需求，共设计了测试用例 {total} 个，共执行测试用例 {total} 个，"
                "其中 {passed} 个测试用例执行通过，{failed} 个测试用例执行未通过，"
                "测试共发现程序问题 {issues} 个，问题详见附录 A。"
            ).format(total=total_all, passed=passed_all, failed=failed_all, issues=issues_all)

        stage_text = ""
        # 日期缺失时**不写这一句**，而不是写「—到—」这种明显是没填的占位
        if stage_start or stage_end:
            stage_text = (
                "其中，{start}到{end}，测试项目组对 {version} 版 {software} 的功能，"
                "开展了{stage}配置项测试，测试组依据软件需求共设计测试用例 {total} 个，"
                "共执行测试用例 {total} 个。其中 {passed} 个测试用例执行通过，"
                "{failed} 个测试用例执行未通过，测试共发现程序问题 {issues} 个。"
            ).format(
                start=stage_start or "—", end=stage_end or "—",
                version=version, software=software, stage=stage_name,
                total=total, passed=passed, failed=failed, issues=issues,
            )
        else:
            stage_text = (
                "其中，对 {version} 版 {software} 的功能开展了{stage}配置项测试，"
                "测试组依据软件需求共设计测试用例 {total} 个，共执行测试用例 {total} 个。"
                "其中 {passed} 个测试用例执行通过，{failed} 个测试用例执行未通过，"
                "测试共发现程序问题 {issues} 个。"
            ).format(
                version=version, software=software, stage=stage_name,
                total=total, passed=passed, failed=failed, issues=issues,
            )
        text += stage_text
        set_para_text(Paragraph(p_el, doc), text)

    # ② 结尾段：模板里有两处 x（软件名 + 代码注释率）。
    #
    # 软件名换真值。注释率**没有测量数据就整句不写**，绝不瞎填一个百分比 ——
    # 那是编数据，比留占位更糟。只有 meta 真给了 codeCommentRate 才补这句。
    ep = copy.deepcopy(proto_end)
    add_after_anchor(ep)
    tail = (
        "经本次配置项测试验证，{software}软件实现了软件需求规格说明中的各项功能需求，"
        "外部接口的设计符合软件需求规格说明中软件外部接口的需求，"
        "各项时间性能指标满足软件需求规格说明书中的时间要求。"
    ).format(software=software)
    comment_rate = meta.get("codeCommentRate")
    if comment_rate:
        tail += (
            "{software}软件代码注释率为 {rate}%。"
            "符合软件代码注释率不小于 {req}% 的要求。"
        ).format(
            software=software, rate=comment_rate,
            req=meta.get("codeCommentRateRequired") or 20,
        )
    tail += "测试用例执行结果见表2。"
    set_para_text(Paragraph(ep, doc), tail)


def build_sufficiency_section(doc, stages: list, meta: dict) -> None:
    """3.2 配置项测试充分性分析：把模板里的 xxx 换成真数据。

    用户第 4 点：3.2 这段为什么有 xxx 的地方你不换成真数据呢，
    这毕竟是个模板，xxx 只是预留出来的，以后生成要填真数据。

    模板原文（模板 P020）：
        本次配置项测试共涉及测试用例xxx个。本次设计的测试用例，覆盖了xxxxxxxxxxxxx
        软件需求规格说明中的所有需求，测试用例对软件需求的覆盖率达到百分之百…

    能填真值的两处：用例总数、软件名。
    **覆盖率不能凭空写 100%** —— 覆盖率的真实性依赖「需求条目 → 用例」的逐条映射，
    本轮数据里没有这个映射（用例只挂在功能项下，没有需求条目 id）。所以按可验证的
    口径写功能项覆盖率，并明说逐条映射未统计，而不是抄一个 100% 糊过去。
    """
    items = body_items(doc)
    idx = find_index(items, "本次配置项测试共涉及测试用例")
    if idx < 0:
        return

    software = meta.get("softwareName") or "被测软件"
    total_cases = 0
    total_features = 0
    covered_features = 0
    for stage in stages:
        for feature in stage.get("features") or []:
            total_features += 1
            cases = feature.get("cases") or []
            total_cases += len(cases)
            if cases:
                covered_features += 1

    rate = (covered_features * 100.0 / total_features) if total_features else 0.0
    text = (
        "本次配置项测试共涉及测试用例 {total} 个。本次设计的测试用例，覆盖了 {software} "
        "软件需求规格说明中的需求功能项 {covered}/{features} 个，功能项覆盖率达到 {rate:.1f}%；"
        "测试结果充分准确，能够满足对软件所实现的功能、性能等指标的验证。"
        "（用例与单一需求条目的逐条映射覆盖率未单独统计，以功能项覆盖为准。）"
    ).format(
        total=total_cases, software=software,
        covered=covered_features, features=total_features,
        rate=rate,
    )
    set_para_text(Paragraph(items[idx][1]._p, doc), text)


def build_environment_section(doc, meta: dict) -> None:
    """3.3 测试环境的影响：模板占位是「有则写，无则写无」。

    用户第 4 点的同类问题 —— 模板预留文字要换成真数据。
    按 meta 里的 envImpact 填；没有就按 runEnv 写具体环境，明确「无不良影响」。
    """
    items = body_items(doc)
    idx = find_index(items, "有则写，无则写无")
    if idx < 0:
        return
    impact = meta.get("envImpact")
    if impact:
        text = str(impact)
    else:
        run_env = meta.get("runEnv") or ""
        text = "无。"
        if run_env:
            text = "无。本次测试在以下环境执行：%s，测试环境对测试结果未产生不良影响。" % run_env
    set_para_text(Paragraph(items[idx][1]._p, doc), text)


def build_full(template: Path, data: dict, out_path: Path) -> Path:
    """生成整项目总体报告（按测试阶段分章）。

    数据结构（v2，按阶段组织）：

        {
          "meta": {                       # 见 META 说明
            "softwareName", "softwareVersion", "language", "devEnv",
            "runEnv", "importance", "vendor", "softwareScale",
            "projectCode": "JYSG",        # 项目缩写，用于用例标识
            "source": "SRS" | "DM",       # 需求来源，用于用例标识
          },
          "people": { "designer", "reviewer", "tester" },
          "stages": [                     # ★ 按测试阶段分章（4、5、6、7…）
            {
              "name": "sprint1",          # 阶段名，出现在「4.sprint1详细测试结果」
              "features": [               # 该阶段下的功能项
                { "code", "name", "cases": [ case... ] }
              ],
              "issues": [...],            # 该阶段发现的问题（附录 A）
              "inconsistent": "无",       # 与测试用例/规程的不一致
              "regression": {             # 回归测试（4.x.2）
                "date", "version", "features": [ { "name", "cases" } ]
              }
            }
          ],
          # 兼容：如果只给了 features 没给 stages，自动包成单阶段
        }
    """
    doc = Document(str(template))
    meta = data.get("meta") or {}
    people = data.get("people") or {}

    # ── 阶段归一化：没有 stages 就把 features 包成单个默认阶段 ──
    stages = data.get("stages")
    if not stages:
        stages = [{
            "name": meta.get("testStage") or "集成测试",
            "features": data.get("features") or [],
            "issues": data.get("issues") or [],
            "inconsistent": data.get("inconsistent") or "无",
            "regression": data.get("regression") or {},
        }]

    items = body_items(doc)

    # ── ⓪ 先取出所有原型（在任何删除之前）──
    module_idx = find_index(items, "运行环境初始化")
    if module_idx < 0:
        raise RuntimeError("找不到 4.1 功能项标题原型")
    module_end_idx = find_index(items, "回归测试")
    if module_end_idx < 0:
        raise RuntimeError("找不到 4.2 回归测试段落，无法确定模块区边界")

    sub_title_idx = find_index(items, "测试结果总结", module_idx)
    caption_idx = find_index(items, "表x标识", sub_title_idx)
    case_table_idx = find_table_after(items, caption_idx)
    problem_title_idx = find_index(items, "遇到的问题", case_table_idx)
    incons_title_idx = find_index(items, "不一致", problem_title_idx + 1)

    proto_module_p = copy.deepcopy(items[module_idx][1]._p)
    proto_sub_p = copy.deepcopy(items[sub_title_idx][1]._p)
    proto_caption_p = copy.deepcopy(items[caption_idx][1]._p)
    proto_case_tbl = copy.deepcopy(items[case_table_idx][1]._tbl)
    proto_problem_title_p = copy.deepcopy(items[problem_title_idx][1]._p)
    proto_problem_body_p = copy.deepcopy(items[problem_title_idx + 1][1]._p)
    proto_incons_title_p = copy.deepcopy(items[incons_title_idx][1]._p)
    proto_incons_body_p = copy.deepcopy(items[incons_title_idx + 1][1]._p)

    # 附录 A / 附录 B 的表原型。
    #
    # ★ 必须在「砍掉 4.x 区」之前取，因为附录 A/B 也在被砍的范围内。
    # 旧代码把附录只输出成文字段落（「附录A 应是有表格的」——用户第 6 点），
    # 根因就是没把这两张模板表留下来复用。
    appendix_a_idx = find_index(items, "附录A软件问题报告单")
    appendix_b_idx = find_index(items, "附录B软件问题处理单")
    proto_issue_tbl = None
    proto_fix_tbl = None
    if appendix_a_idx >= 0:
        tbl_idx = find_table_after(items, appendix_a_idx)
        if tbl_idx >= 0 and tbl_idx < (appendix_b_idx if appendix_b_idx > 0 else len(items)):
            proto_issue_tbl = copy.deepcopy(items[tbl_idx][1]._tbl)
    if appendix_b_idx >= 0:
        tbl_idx = find_table_after(items, appendix_b_idx)
        if tbl_idx >= 0:
            proto_fix_tbl = copy.deepcopy(items[tbl_idx][1]._tbl)

    # 附录里「表x软件问题报告单」这种表题原型，也一并留下
    proto_appendix_caption_p = copy.deepcopy(items[caption_idx][1]._p) if caption_idx >= 0 else None
    if appendix_a_idx >= 0:
        cap = find_index(items, "软件问题报告单", appendix_a_idx)
        if cap >= 0:
            proto_appendix_caption_p = copy.deepcopy(items[cap][1]._p)
    if appendix_b_idx >= 0:
        cap = find_index(items, "软件问题处理单", appendix_b_idx)
        if cap >= 0:
            proto_appendix_caption_p = copy.deepcopy(items[cap][1]._p)

    # ── ① 砍掉 4.x 样例区：从「4.xxxxxxx详细测试结果」到正文末尾整段删除 ──
    #     模板里的 4.x 全是样例（含 4.1/4.2、附录 A/B 样例），
    #     正式报告的 4.x 及之后全部由数据重建，所以这里一次性清空。
    #     ★ 起点要用**章标题**那一行（含 xxxxxxx 占位），不能从 4.1 算起 ——
    #       否则「4.xxxxxxx详细测试结果」这段占位会留在新报告里。
    body = doc.element.body
    chapter_title_idx = find_index(items, "xxxxxxx详细测试结果")
    cut_idx = chapter_title_idx if chapter_title_idx >= 0 else module_idx
    cut_from = items[cut_idx][1]._p
    started = False
    for kind, obj in items:
        el = obj._p if kind == "p" else (obj._tbl if kind == "tbl" else None)
        if el is None:
            continue
        if el is cut_from:
            started = True
        if started and el.getparent() is not None:
            el.getparent().remove(el)

    # ── ② 填前置的几张汇总表 ──
    # 把所有阶段的用例摊平（表2/表3/表4 都是全项目汇总）
    all_features = []
    for stage in stages:
        stage_name = stage.get("name") or ""
        for feature in stage.get("features") or []:
            merged = dict(feature)
            # 阶段继承：功能项自己没写 stage 就用所属阶段的
            if not merged.get("stage"):
                merged["stage"] = stage_name
            # 用例也要带上阶段，表4 的「测试阶段」列靠它
            cases_with_stage = []
            for case in merged.get("cases") or []:
                c = dict(case)
                if not c.get("stage"):
                    c["stage"] = stage_name
                cases_with_stage.append(c)
            merged["cases"] = cases_with_stage
            all_features.append(merged)

    # 表0 软件信息表
    info_table = doc.tables[0]
    set_table_layout(info_table, INFO_TABLE_WIDTHS)
    info_values = [
        meta.get("softwareName", ""),
        "、".join(s.get("name") or "" for s in stages) or meta.get("testStage", ""),
        meta.get("softwareVersion", ""),
        meta.get("softwareScale", ""),
        meta.get("language", ""),
        meta.get("devEnv", ""),
        meta.get("runEnv", ""),
        meta.get("importance", ""),
        meta.get("vendor", ""),
    ]
    for col, value in enumerate(info_values):
        if col < len(info_table.rows[1].cells):
            set_cell_text(info_table.rows[1].cells[col], value)
    for _ in range(len(info_table.rows) - 2):
        tr = info_table.rows[2]._tr
        tr.getparent().remove(tr)

    # 表1 功能项 × 7 类分布（阶段分组 + 合并 + 小计）
    fill_distribution_table(doc.tables[1], all_features)

    # 表2 问题分类统计：按 level 真实统计，归零解决情况一律「无」
    all_issues = []
    for stage in stages:
        all_issues.extend(stage.get("issues") or [])
    fill_issue_table(doc.tables[2], all_issues)

    # 表3 测试结果记录单
    fill_record_table(doc.tables[3], all_features, meta)

    # ── ③ 3.1 总体评估：按阶段数展开段落 ──
    build_overall_evaluation(doc, stages, meta)

    # ── ③' 3.2 充分性分析 / 3.3 测试环境的影响：把模板的 xxx 换成真数据 ──
    #     用户第 4 点：模板里的 xxx 只是预留占位，生成时必须填真数据。
    build_sufficiency_section(doc, stages, meta)
    build_environment_section(doc, meta)

    # ── ④ 第 4 章起：按阶段分章（4、5、6、7…）──
    insert_before = body.find(qn("w:sectPr"))
    if insert_before is None:
        raise RuntimeError("文档缺少 sectPr")

    counter = 0  # 表序号，全文连续

    def add_para(proto, text):
        el = copy.deepcopy(proto)
        insert_before.addprevious(el)
        set_para_text(Paragraph(el, doc), text)

    for s_index, stage in enumerate(stages, start=1):
        stage_name = stage.get("name") or "集成测试"
        features = stage.get("features") or []
        chapter_no = s_index + 3   # 章号：第 1 阶段是 4 章，第 2 阶段是 5 章…

        # 章标题：「4.地基阶段详细测试结果」
        add_para(proto_module_p, "%d.%s详细测试结果" % (chapter_no, stage_name))

        # ── N.x 每个功能项一节；N.x.1 下放该功能项的**所有**用例表 ──
        for f_index, feature in enumerate(features, start=1):
            # N.x <功能点名称>
            add_para(proto_module_p, "%d.%d%s" % (chapter_no, f_index, feature.get("name", "")))
            # N.x.1 测试结果总结
            add_para(proto_sub_p, "%d.%d.1测试结果总结" % (chapter_no, f_index))

            for case in feature.get("cases") or []:
                counter += 1
                code = pick_case_code(case, meta, fallback_seq=counter)
                # 表N 标识 <用例标识>
                add_para(proto_caption_p, "表%d 标识%s" % (counter, code))

                tbl_el = copy.deepcopy(proto_case_tbl)
                insert_before.addprevious(tbl_el)
                case_table = Table(tbl_el, doc)
                fill_case_table(case_table, dict(case, caseCode=code), people, feature, meta)

        # ── N.n 遇到的问题（所有功能项之后，接着编号）──
        issue_no = len(features) + 1
        stage_issues = stage.get("issues") or []
        add_para(proto_problem_title_p, "%d.%d遇到的问题" % (chapter_no, issue_no))
        add_para(
            proto_problem_body_p,
            "详见附录A软件问题报告单。" if stage_issues else "无",
        )

        # ── N.n+1 与测试用例/规程的不一致 ──
        incons_no = issue_no + 1
        add_para(proto_incons_title_p, "%d.%d与测试用例/规程的不一致" % (chapter_no, incons_no))
        add_para(proto_incons_body_p, stage.get("inconsistent") or "无")

        # ── N.n+2 回归测试（章内最后一节）──
        reg_no = incons_no + 1
        regression = stage.get("regression") or {}
        reg_features = regression.get("features") or []
        add_para(proto_module_p, "%d.%d回归测试" % (chapter_no, reg_no))
        if reg_features:
            add_para(
                proto_problem_body_p,
                "%s，测试人员对 %s 版软件源程序进行回归测试。测试阶段未通过的测试用例重新执行，"
                "问题处理情况见附录B软件问题处理单。" % (
                    regression.get("date") or "本次测试期间",
                    regression.get("version") or (meta.get("softwareVersion") or "x.xx.A"),
                ),
            )
            for r_index, r_feature in enumerate(reg_features, start=1):
                # 回归测试：N.n+2.r <功能点名称>，**下面直接接表**，
                # 不再有「N.n+2.r.1 测试结果总结」这一层（用户明确要求）。
                add_para(proto_module_p, "%d.%d.%d%s" % (chapter_no, reg_no, r_index, r_feature.get("name", "")))
                for case in r_feature.get("cases") or []:
                    counter += 1
                    code = pick_case_code(case, meta, fallback_seq=counter)
                    add_para(proto_caption_p, "表%d 标识%s" % (counter, code))
                    tbl_el = copy.deepcopy(proto_case_tbl)
                    insert_before.addprevious(tbl_el)
                    fill_case_table(Table(tbl_el, doc), dict(case, caseCode=code), people, r_feature, meta)
        else:
            add_para(proto_incons_body_p, "无（本次测试无未通过用例重跑）。")

    # ── ⑤ 注释 / 附录 A / 附录 B ──
    add_para(proto_module_p, "注释")
    add_para(proto_incons_body_p, "无")

    # 附录 A：**每一条问题一张表**（模板「表x软件问题报告单」那张 10 行 6 列表）。
    # 以前这里只写一行文字（「问题编号 xxx：…」），用户第 6 点指的就是这个：
    # 附录 A 本来就应该有表格，有表不填却说「见上表」更没道理。
    add_para(proto_module_p, "附录A软件问题报告单")
    if all_issues and proto_issue_tbl is not None:
        for idx, issue in enumerate(all_issues, start=1):
            issue_no = "%s-JT-WT-%03d" % (meta.get("projectCode") or "PROJ", idx)
            if proto_appendix_caption_p is not None:
                add_para(proto_appendix_caption_p, "表%d 软件问题报告单 %s" % (idx, issue_no))
            tbl_el = copy.deepcopy(proto_issue_tbl)
            insert_before.addprevious(tbl_el)
            fill_issue_report_table(
                Table(tbl_el, doc), issue, issue_no, meta, idx
            )
    else:
        add_para(proto_incons_body_p, "本次测试未发现软件问题。")

    # 附录 B：**每条问题一张处理单**。
    # 以前直接写「见上表，处理情况待补充。」—— 用户第 6 点明确否掉这种写法：
    # 附录 B 自己也有表，就该自己填。本轮问题基本都未修复，所以处理结果
    # 按用户要求写「未处理」+ 具体原因，而不是编一个「已修改」。
    add_para(proto_module_p, "附录B软件问题处理单")
    if all_issues and proto_fix_tbl is not None:
        for idx, issue in enumerate(all_issues, start=1):
            issue_no = "%s-JT-WT-%03d" % (meta.get("projectCode") or "PROJ", idx)
            if proto_appendix_caption_p is not None:
                add_para(proto_appendix_caption_p, "表%d 软件问题处理单 %s" % (idx, issue_no))
            tbl_el = copy.deepcopy(proto_fix_tbl)
            insert_before.addprevious(tbl_el)
            fill_issue_fix_table(Table(tbl_el, doc), issue, issue_no, meta, idx)
    else:
        add_para(proto_incons_body_p, "无")

    # ── ⑥ 清理标题里的填写提示 ──
    for paragraph in doc.paragraphs:
        raw = paragraph.text
        if not raw.strip():
            continue
        cleaned = strip_hint(raw)
        if cleaned != raw:
            set_para_text(paragraph, cleaned)

    out_path.parent.mkdir(parents=True, exist_ok=True)
    doc.save(str(out_path))
    return out_path


def fill_record_table(table: Table, features: list, meta: dict, stage_name: str = "") -> None:
    """表3 测试结果记录单：每条用例一行。

    用户明确要求：
      · 「测试阶段」列不能空 → 用用例所属阶段，**且同阶段的连续行要纵向合并**；
      · 「功能点名称」= 生成用例时归类的功能项，**同功能项的连续行也纵向合并**
        → 一张 74 行的表不用把「用户注册与登录」重复 74 遍，可读性差得多；
      · 「详细需求追踪条目」= 用例标识去掉 `-N-Tnnn.CTD` 尾部；
      · 「用例标识」= 规范的 caseCode（如 `JK-651-JYSG_DM_API_TESTING-2-T002.CTD`）；
      · 列宽固定，别让长标识把「序号」「结论」挤成竖排（第二张截图的问题）。
    """
    all_cases = []
    for feature in features:
        for case in feature.get("cases") or []:
            all_cases.append((feature, case))

    set_table_layout(table, RECORD_TABLE_WIDTHS)

    template_tr = copy.deepcopy(table.rows[1]._tr)
    header_tr = table.rows[0]._tr
    for _ in range(len(table.rows) - 1):
        tr = table.rows[1]._tr
        tr.getparent().remove(tr)

    anchor = header_tr
    for _ in range(max(len(all_cases), 1)):
        clone = copy.deepcopy(template_tr)
        anchor.addnext(clone)
        anchor = clone

    for offset, (feature, case) in enumerate(all_cases):
        row = table.rows[1 + offset]
        status = case.get("outcome") or "passed"
        verdict = {
            "passed": "通过",
            "failed": "未通过",
            "notRun": "未执行",
            "unconfirmed": "未确认",
        }.get(status, "未确认")

        # 用例标识：一律走 pick_case_code()，绝不用 caseId 冒充
        code = pick_case_code(case, meta, fallback_seq=offset + 1)
        trace = build_trace_code(code)

        set_cell_text(row.cells[0], str(offset + 1))
        set_cell_text(row.cells[1], case.get("stage") or feature.get("stage") or stage_name or "")
        set_cell_text(row.cells[2], feature.get("name", ""))
        set_cell_text(row.cells[3], trace)
        set_cell_text(row.cells[4], code)
        set_cell_text(row.cells[5], verdict)

    # ── 纵向合并「测试阶段」与「功能点名称」 ──
    # 只合并**连续同值**行：功能项在表里本来就是成块排列的，
    # 一旦跨块就不合并（避免把不相邻的功能项硬并成一格）。
    if all_cases:
        merge_runs(
            table, 1,
            [case.get("stage") or feature.get("stage") or stage_name or ""
             for feature, case in all_cases],
        )
        merge_runs(table, 2, [feature.get("name", "") for feature, _ in all_cases])

    relax_line_spacing(table)


def merge_runs(table: Table, col: int, values: list) -> None:
    """把某一列里**连续相同**的值纵向合并。

    与 merge_cells_down() 的差别：那个是「指定哪几行」，这个是「按值自动找连续块」。
    逐块判：块内至少 2 行才合并，只有 1 行不动（单行合并没有意义，还会多出 vMerge 标记）。

    @param table: 目标表（数据行从第 1 行开始，第 0 行是表头）
    @param col: 列索引
    @param values: 与数据行一一对应的值列表
    """
    start = 0
    total = len(values)
    while start < total:
        end = start
        while end + 1 < total and values[end + 1] == values[start]:
            end += 1
        if end > start and values[start] != "":
            merge_cells_down(table, col, list(range(1 + start, 1 + end + 1)))
        start = end + 1


# ═════════════════════════════════════════════════════════════
#  单步骤报告（只有 4.1.1 那张表）
# ═════════════════════════════════════════════════════════════


def build_single_step(template: Path, data: dict, out_path: Path) -> Path:
    doc = Document(str(template))
    people = data.get("people") or {}
    case = data.get("case") or {}
    feature = data.get("feature") or {}
    meta = data.get("meta") or {}

    items = body_items(doc)
    sub_title_idx = find_index(items, "测试结果总结")
    if sub_title_idx < 0:
        raise RuntimeError("找不到 4.1.1 测试结果总结段落")
    caption_idx = find_index(items, "表x标识", sub_title_idx)
    case_table_idx = find_table_after(items, caption_idx)

    proto_sub_p = copy.deepcopy(items[sub_title_idx][1]._p)
    proto_caption_p = copy.deepcopy(items[caption_idx][1]._p)
    proto_case_tbl = copy.deepcopy(items[case_table_idx][1]._tbl)
    # 标题：优先用「配置项测试报告」那一段的格式
    title_idx = find_index(items, "配置项测试报告")
    proto_title_p = copy.deepcopy(items[title_idx][1]._p) if title_idx >= 0 else None

    # 清空全文（保留 sectPr）
    for kind, obj in items:
        if kind == "p":
            obj._p.getparent().remove(obj._p)
        elif kind == "tbl":
            obj._tbl.getparent().remove(obj._tbl)

    body = doc.element.body
    sect = body.find(qn("w:sectPr"))

    def add_before_sect(element):
        if sect is not None:
            sect.addprevious(element)
        else:
            body.append(element)

    # 文档标题
    if proto_title_p is not None:
        tp = copy.deepcopy(proto_title_p)
        add_before_sect(tp)
        set_para_text(Paragraph(tp, doc), "配置项测试报告（单步骤执行结果）")

    # ── 单条报告不放章节标题 ──
    # 用户明确要求：单条报告里**不要**「4.1 功能项」「4.1.1 测试结果总结」这些章节号，
    # 也不要「表1 标识 xxx 第 1-3 步」这种表题文字。
    # 单条报告就是「一张填好的表」，章节号是整本项目报告才有的东西。

    # 用例表
    tbl_el = copy.deepcopy(proto_case_tbl)
    add_before_sect(tbl_el)
    case_table = Table(tbl_el, doc)
    fill_case_table(case_table, case, people, feature, meta)
    # 整表尽量一页显示（用户要求：一张表不要拆成两页）
    keep_table_on_one_page(case_table)

    out_path.parent.mkdir(parents=True, exist_ok=True)
    doc.save(str(out_path))
    return out_path


def fill_issue_report_table(table: Table, issue: dict, issue_no: str, meta: dict, seq: int) -> None:
    """附录 A 一张「软件问题报告单」（模板 10 行 6 列）。

    用户第 6 点：附录 A 应该是有表格的，为什么不填表格。
    以前这里只输出一行文字，等于把模板里的表整张丢掉了。

    模板结构（row.cells 的可见下标）：
        r0 问题编号 | <编号> | 项目名称 | <项目> | 程序/文档名 | <名字>
        r1 发现日期 | <> | 报告日期 | <> | 报告人 | <>
        r2 问题类别 | 程序问题 | 文档问题 | 设计问题 | 其他问题 | <勾选/说明>
        r3 问题级别 | 重大 | 严重 | 一般 | <勾选/说明> | <>
        r4 研发阶段 | <span5 值>
        r5 问题追踪 | <span5 值>
        r6 问题现象描述 | <span5 值>
        r7 更改建议 | <span5 值>
        r8 软件开发技术负责人确认：…签字/日期
        r9 备注：

    「问题类别」「问题级别」两行在模板里是「四个选项平铺」，只把选中的那个
    变成 ✓、其它留空/取消，比另起一格写「一般」更贴模板原意。
    """
    set_table_layout(table, APPENDIX_ISSUE_WIDTHS)

    level = (issue.get("level") or "一般").strip()
    if level not in ("重大", "严重", "一般"):
        level = "一般"
    kind = (issue.get("kind") or "").strip()
    kind_label = "文档问题" if kind in ("doc", "document", "文档问题") else "程序问题"

    software = meta.get("softwareName") or "被测软件"
    version = meta.get("softwareVersion") or "x.xx.A"
    project = meta.get("vendor") or software

    rows = table.rows
    _set_row_pairs(rows[0], ["问题编号", issue_no, "项目名称", project, "程序/文档名", software])
    _set_row_pairs(
        rows[1],
        [
            "发现日期", issue.get("foundAt") or issue.get("date") or "",
            "报告日期", issue.get("reportedAt") or issue.get("date") or "",
            "报告人", issue.get("reporter") or DEFAULT_PEOPLE,
        ],
    )
    # 问题类别：四选一打勾
    _set_choice_row(rows[2], "问题类别", ["程序问题", "文档问题", "设计问题", "其他问题"], kind_label)
    # 问题级别：三选一打勾（第 4 格写「—」占位，第 5 格留空）
    _set_choice_row(rows[3], "问题级别", ["重大", "严重", "一般"], level)

    _set_label_value_row(rows[4], "研发阶段", meta.get("testStage") or issue.get("stage") or "集成测试阶段")
    _set_label_value_row(rows[5], "问题追踪", "%s 版软件 / %s" % (version, issue.get("caseCode") or ""))
    _set_label_value_row(rows[6], "问题现象描述", issue.get("desc") or issue.get("title") or "问题描述待补充")
    _set_label_value_row(rows[7], "更改建议", issue.get("suggestion") or "按软件需求规格说明修正实现，修正后重新执行相关测试用例验证。")

    # r8 / r9 是整行合并的签字区，保留模板文字，只补上人
    _fill_signature_row(rows[8], "软件开发技术负责人确认：%s    签字：            日期：" % DEFAULT_PEOPLE)
    _fill_signature_row(rows[9], "备注：%s" % (issue.get("note") or "无"))
    relax_line_spacing(table)


def fill_issue_fix_table(table: Table, issue: dict, issue_no: str, meta: dict, seq: int) -> None:
    """附录 B 一张「软件问题处理单」（模板 13 行 5 列）。

    用户第 6 点：附录 B 也是表格，不能写「见上表，处理情况待补充」。
    用户本轮明确要求：**按实际情况填，未修复就写「未处理」及原因**。

    模板结构（可见下标）：
        r0 软件问题处理单编号 | <单号> | 问题报告单编号(span2) | <问题编号>
        r1 文档版本 | <> | 程序版本(span2) | <>
        r2 处理责任人 | <> | 处理日期(span2) | <>
        r3 发现问题阶段(span4)
        r4 问题严重，程序等级(span4)
        r5 问题处理描述 | 问题处理措施：…
        r6 问题处理描述 | 处理结果：…
        r7 问题处理描述 | 未处理原因及相关方签字：
        r8 处理影响分析(span4)
        r9 处理结果确认 | <> | 确认日期(span2) | <>
        r10 软件项目负责人：… 日期：
        r11 回归测试确认 | 修改后的软件资料名称 | 版本号 | 确认人签字 | 日期
        r12 回归测试确认 | <资料名> | <版本> | <> | <日期>
    """
    set_table_layout(table, APPENDIX_FIX_WIDTHS)

    software = meta.get("softwareName") or "被测软件"
    version = meta.get("softwareVersion") or "x.xx.A"
    level = (issue.get("level") or "一般").strip()
    stage = meta.get("testStage") or issue.get("stage") or "集成测试阶段"
    handled = bool(issue.get("handled"))
    fix_no = "WTCLD-" + issue_no

    rows = table.rows
    # r0：处理单编号 / 问题报告单编号
    set_cell_text(rows[0].cells[1], fix_no)
    set_cell_text(rows[0].cells[4], issue_no)
    # r1：文档版本 / 程序版本
    set_cell_text(rows[1].cells[1], issue.get("docVersion") or "B")
    set_cell_text(rows[1].cells[4], version)
    # r2：处理责任人 / 处理日期
    set_cell_text(rows[2].cells[1], issue.get("owner") or DEFAULT_PEOPLE)
    set_cell_text(rows[2].cells[4], issue.get("fixDate") or "")
    # r3：发现问题阶段（跨 4 格）
    set_cell_text(rows[3].cells[1], stage)
    # r4：问题等级
    set_cell_text(rows[4].cells[1], "%s问题" % level)
    # r5 / r6 / r7：三段「问题处理描述」
    set_cell_text(
        rows[5].cells[1],
        "问题处理措施：%s" % (issue.get("fixAction") if handled else "本轮未修改被测软件，仅记录问题现象与证据。"),
    )
    set_cell_text(
        rows[6].cells[1],
        "处理结果：%s" % ("已修改" if handled else "未处理"),
    )
    set_cell_text(
        rows[7].cells[1],
        "未处理原因及相关方签字：%s" % (
            issue.get("fixReason") if handled
            else (issue.get("reason") or "该问题指向被测试版本的实现缺陷（或被测环境与设计不一致），"
                  "本轮集成测试只做问题定位与取证，不修改被测软件；待开发方修复后回归验证。")
        ),
    )
    # r8：处理影响分析
    set_cell_text(
        rows[8].cells[1],
        issue.get("impact") or ("无影响（未修改软件）" if not handled else "需回归相关功能项。"),
    )
    # r9：处理结果确认 / 确认日期
    set_cell_text(rows[9].cells[1], "已确认" if handled else "未确认")
    set_cell_text(rows[9].cells[4], issue.get("confirmDate") or "")
    # r10：项目负责人签字
    _fill_signature_row(rows[10], "软件项目负责人：%s          日期：%s" % (
        issue.get("owner") or DEFAULT_PEOPLE, issue.get("fixDate") or ""))
    # r11 / r12：回归测试确认（本轮没有回归，写「无」）
    if len(rows) > 12:
        set_cell_text(rows[12].cells[1], "无（本轮无回归测试）")
        set_cell_text(rows[12].cells[2], "—")
        set_cell_text(rows[12].cells[3], "")
        set_cell_text(rows[12].cells[4], "")
    relax_line_spacing(table)


def _set_row_pairs(row, pairs) -> None:
    """把 [标签, 值, 标签, 值, …] 依次写进一行的可见单元格。

    标签格保持模板原文；值格写内容。只写偶数下标（值格）。
    """
    cells = row.cells
    for index, value in enumerate(pairs):
        if index >= len(cells):
            break
        # 偶数位是标签（保留模板文字），奇数位是值
        if index % 2 == 1:
            set_cell_text(cells[index], value)


def _set_choice_row(row, label: str, options: list, chosen: str) -> None:
    """处理「四个选项平铺」这种行：把选中的那格前面打勾，其余照原样保留。

    例：问题级别 | 重大 | 严重 | 一般 | <空>
    选中「一般」后 → 问题级别 | 重大 | 严重 | ✓ 一般 | —（第 5 格占位）
    """
    cells = row.cells
    if not cells:
        return
    set_cell_text(cells[0], label)
    for index, option in enumerate(options, start=1):
        if index >= len(cells):
            break
        if norm(option) == norm(chosen):
            set_cell_text(cells[index], "√ " + option)
        else:
            set_cell_text(cells[index], "　 " + option)
    # 选项之后的空格子：放一个「—」，别让它看起来像漏填
    for index in range(1 + len(options), len(cells)):
        set_cell_text(cells[index], "—")


def _set_label_value_row(row, label: str, value: str) -> None:
    """「标签 | 值（跨多列）」这种行。"""
    cells = row.cells
    if not cells:
        return
    set_cell_text(cells[0], label)
    if len(cells) > 1:
        set_cell_text(cells[1], value)


def _fill_signature_row(row, text: str) -> None:
    """整行合并的签字/备注行：只留一个格，写文字。"""
    cells = row.cells
    if not cells:
        return
    set_cell_text(cells[0], text)


def keep_table_on_one_page(table: Table) -> None:
    """让整张表尽量落在同一页，不要被分页切成两半。

    用户明确要求：单条报告就是「一张表」，被拆到两页就不好看了。

    做法（Word 表格排版的两条规矩）：
      1. 每一行加 `<w:cantSplit/>` —— 单个行内部不许断页；
      2. 除最后一行外，每行加 `<w:keepNext/>` —— 该行必须和下一行同页。

    这两条合起来把整表"粘"在一起。极端情况（表比一页还高）Word 仍会拆，
    那时拆页是合理的，不强行缩放。
    """
    tr_pr_tag = qn("w:trPr")
    cant_split = qn("w:cantSplit")
    keep_next = qn("w:keepNext")

    rows = table.rows
    for index, row in enumerate(rows):
        tr = row._tr
        tr_pr = tr.find(tr_pr_tag)
        if tr_pr is None:
            tr_pr = tr.makeelement(tr_pr_tag, {})
            tr.insert(0, tr_pr)
        # 行内不断页
        if tr_pr.find(cant_split) is None:
            tr_pr.append(tr_pr.makeelement(cant_split, {}))
        # 与下一行同页（最后一行不需要）
        if index < len(rows) - 1 and tr_pr.find(keep_next) is None:
            tr_pr.append(tr_pr.makeelement(keep_next, {}))


# ═════════════════════════════════════════════════════════════
#  CLI
# ═════════════════════════════════════════════════════════════


def main(argv):
    """
    命令行入口：用两份 sample 各生成一份样例报告，便于验证脚本本身可用。

    用法：
        python integration_report.py [模板路径]

    模板路径取值顺序：
        1. 命令行第 1 个参数
        2. 环境变量 INTEGRATION_REPORT_TEMPLATE
        3. 与本脚本同目录的「配置项测试报告模板.docx」

    为什么不再写死桌面路径：原来硬编码的是某台机器「桌面」下的绝对路径，
    换人换机直接跑不起来。现在模板随仓库进库，缺省就在本脚本同目录。
    """
    base = Path(__file__).resolve().parent
    template_raw = argv[1] if len(argv) > 1 else os.environ.get("INTEGRATION_REPORT_TEMPLATE", "")
    template = Path(template_raw) if template_raw else (base / "配置项测试报告模板.docx")
    if not template.is_file():
        print("找不到模板：%s" % template, file=sys.stderr)
        print("", file=sys.stderr)
        # 模板是**随仓库进库**的，所以「本目录里没有」通常意味着仓库不完整或路径不对，
        # 而不是「需要自己准备」。报错要把这一点说清楚，别让人白找一圈。
        print("模板本应随本目录一起进库：%s" % (base / "配置项测试报告模板.docx"), file=sys.stderr)
        print("请先检查上面这个文件在不在（它应该在 git 里，90 KB）。", file=sys.stderr)
        print("若是刻意换模板，可用第一个参数指定路径，或设置环境变量", file=sys.stderr)
        print("INTEGRATION_REPORT_TEMPLATE。", file=sys.stderr)
        print("", file=sys.stderr)
        print("⚠️ 注意别拿单元测试的 templates/单元测试报告模板.docx 顶替：", file=sys.stderr)
        print("   两者结构不同（集成模板多出附录 A/B 与单用例 16 行表）。", file=sys.stderr)
        return 2

    out_dir = base / "输出"
    full_data = json.loads((base / "sample-project.json").read_text(encoding="utf-8"))
    step_data = json.loads((base / "sample-step.json").read_text(encoding="utf-8"))

    p1 = build_full(template, full_data, out_dir / "样例1-整项目完整报告.docx")
    print("已生成：%s" % p1)
    p2 = build_single_step(template, step_data, out_dir / "样例2-单个测试步骤报告.docx")
    print("已生成：%s" % p2)
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))