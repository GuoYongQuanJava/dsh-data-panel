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


def fill_case_table(table: Table, case: dict, people: dict, feature: dict | None = None) -> None:
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

    # ── 身份区 ──
    # 用例标识：报告里显示**规范 caseCode**（如 JK-651-JYSG_DM_API_TESTING-2-T002.CTD），
    # 不是内部主键 caseId。没给 caseCode 时回退到 caseId。
    set_cell_text(table.rows[0].cells[2], case.get("caseCode") or case.get("caseId", ""))
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
      · 「测试阶段」列不能空，填该功能项所属阶段。

    模板给了 11 行数据位 + 2 行收尾（用例汇总 / 百分比），收尾行按需重建。
    """
    # ── 修表头：「测试功能」→「功能测试」──
    for cell in table.rows[0].cells:
        if norm(cell.text) == "测试功能":
            set_cell_text(cell, "功能测试")

    header_row = 0
    data_start = 1

    # 计算数据
    rows_data = []
    for feature in features:
        cases = feature.get("cases") or []
        counts = {key: 0 for key, _ in TYPE_COLUMNS}
        for case in cases:
            ctype = case.get("type", "functional")
            if ctype in counts:
                counts[ctype] += 1
        stage_of_feature = feature.get("stage") or stage_name or ""
        rows_data.append((stage_of_feature, feature.get("name") or "", len(cases), counts))

    # 删掉模板的 11 行数据位（保留表头），再按需重建
    template_tr = table.rows[data_start]._tr
    header_anchor = table.rows[header_row]._tr
    for _ in range(len(table.rows) - 1):
        tr = table.rows[1]._tr
        tr.getparent().remove(tr)

    anchor = header_anchor
    wanted = max(len(rows_data), 1)
    for _ in range(wanted):
        clone = copy.deepcopy(template_tr)
        anchor.addnext(clone)
        anchor = clone

    for offset, (stage, name, total, counts) in enumerate(rows_data):
        row = table.rows[1 + offset]
        set_cell_text(row.cells[0], str(offset + 1))
        # 「测试阶段」列不能空
        set_cell_text(row.cells[1], stage)
        set_cell_text(row.cells[2], name)
        set_cell_text(row.cells[3], str(total))
        # 各类测试没有的写 0，不空着
        for col, (key, _) in enumerate(TYPE_COLUMNS, start=4):
            set_cell_text(row.cells[col], str(counts[key]))

    # 汇总两行
    totals = {key: 0 for key, _ in TYPE_COLUMNS}
    grand = 0
    for _, _, total, counts in rows_data:
        grand += total
        for key in totals:
            totals[key] += counts[key]

    for offset, (label, values) in enumerate((
        ("用例汇总", [str(grand)] + [str(totals[k]) for k, _ in TYPE_COLUMNS]),
        ("占总测试用例百分比%", ["100%"] + [
            ("%.1f%%" % (totals[k] * 100.0 / grand)) if grand else "0%"
            for k, _ in TYPE_COLUMNS
        ]),
    )):
        clone = copy.deepcopy(template_tr)
        anchor.addnext(clone)
        anchor = clone
        row = table.rows[len(table.rows) - 1]
        set_cell_text(row.cells[0], str(len(rows_data) + 1 + offset))
        set_cell_text(row.cells[1], "—")
        set_cell_text(row.cells[2], label)
        for col, value in enumerate(values, start=3):
            if col < len(row.cells):
                set_cell_text(row.cells[col], value)


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

    # ① 每个阶段一段
    for stage in stages:
        total, passed, failed, issues = stats_of(stage)
        p = copy.deepcopy(proto_first)
        add_after_anchor(p)
        anchor = p  # 下一段接在它后面，保持顺序
        text = (
            "测试组依据软件需求，共设计了测试用例 {total} 个，共执行测试用例 {total} 个，"
            "其中 {passed} 个测试用例执行通过，{failed} 个测试用例执行未通过，"
            "测试共发现程序问题 {issues} 个，问题详见附录 A。"
            "本阶段为「{stage}」，覆盖软件 {software}（{version}）。"
        ).format(
            total=total, passed=passed, failed=failed, issues=issues,
            stage=stage.get("name") or "集成测试",
            software=software, version=version,
        )
        set_para_text(Paragraph(p, doc), text)

    # ② 结尾段（固定文案）
    ep = copy.deepcopy(proto_end)
    add_after_anchor(ep)
    set_para_text(
        Paragraph(ep, doc),
        "经本次配置项测试验证，{software}软件实现了软件需求规格说明中的各项功能需求，"
        "外部接口的设计符合软件需求规格说明中软件外部接口的需求，"
        "各项时间性能指标满足软件需求规格说明书中的时间要求。"
        "测试用例执行结果见表2。".format(software=software),
    )


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

    # 表1 功能项 × 7 类分布
    fill_distribution_table(doc.tables[1], all_features)

    # 表2 问题分类统计：合计问题数没有就写 0，测试问题归零解决情况没有就写「无」
    issue_table = doc.tables[2]
    total_issues = sum(len(s.get("issues") or []) for s in stages)
    last_row = issue_table.rows[len(issue_table.rows) - 1]
    cells = last_row.cells
    # 前 6 格是文档/程序问题的 重大/严重/一般 —— 本轮不区分等级，统一 0
    for col in range(min(6, len(cells))):
        set_cell_text(cells[col], "0")
    if len(cells) > 6:
        set_cell_text(cells[6], str(total_issues))       # 合计问题数
    if len(cells) > 7:
        set_cell_text(cells[7], "无" if total_issues == 0 else "已归零")

    # 表3 测试结果记录单
    fill_record_table(doc.tables[3], all_features, meta)

    # ── ③ 3.1 总体评估：按阶段数展开段落 ──
    build_overall_evaluation(doc, stages, meta)

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
                code = case.get("caseCode") or build_case_code(
                    case_type=case.get("type", "functional"),
                    project_code=meta.get("projectCode") or "PROJ",
                    source=meta.get("source") or SOURCE_CODE,
                    chapter=case.get("chapter") or feature.get("name") or "UNKNOWN",
                    normal=(case.get("polarity") or "normal") != "abnormal",
                    seq=case.get("seq") or counter,
                )
                # 表N 标识 <用例标识>
                add_para(proto_caption_p, "表%d 标识%s" % (counter, code))

                tbl_el = copy.deepcopy(proto_case_tbl)
                insert_before.addprevious(tbl_el)
                case_table = Table(tbl_el, doc)
                fill_case_table(case_table, dict(case, caseCode=code), people, feature)

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
                    code = case.get("caseCode") or build_case_code(
                        case_type=case.get("type", "functional"),
                        project_code=meta.get("projectCode") or "PROJ",
                        source=meta.get("source") or SOURCE_CODE,
                        chapter=case.get("chapter") or r_feature.get("name") or "UNKNOWN",
                        normal=(case.get("polarity") or "normal") != "abnormal",
                        seq=case.get("seq") or counter,
                    )
                    add_para(proto_caption_p, "表%d 标识%s" % (counter, code))
                    tbl_el = copy.deepcopy(proto_case_tbl)
                    insert_before.addprevious(tbl_el)
                    fill_case_table(Table(tbl_el, doc), dict(case, caseCode=code), people, r_feature)
        else:
            add_para(proto_incons_body_p, "无（本次测试无未通过用例重跑）。")

    # ── ⑤ 注释 / 附录 A / 附录 B ──
    add_para(proto_module_p, "注释")
    add_para(proto_incons_body_p, "无")

    all_issues = []
    for stage in stages:
        all_issues.extend(stage.get("issues") or [])

    add_para(proto_module_p, "附录A软件问题报告单")
    if all_issues:
        for idx, issue in enumerate(all_issues, start=1):
            add_para(
                proto_incons_body_p,
                "问题编号 %s-JT-WT-%03d：%s（等级：%s）" % (
                    (meta.get("projectCode") or "PROJ"), idx,
                    issue.get("title") or issue.get("desc") or "问题描述待补充",
                    issue.get("level") or "一般",
                ),
            )
    else:
        add_para(proto_incons_body_p, "本次测试未发现软件问题。")

    add_para(proto_module_p, "附录B软件问题处理单")
    add_para(proto_incons_body_p, "无" if not all_issues else "见上表，处理情况待补充。")

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
      · 「测试阶段」列不能空 → 用用例所属阶段；
      · 「功能点名称」= 生成用例时归类的功能项；
      · 「详细需求追踪条目」= 用例标识去掉 `-N-Tnnn.CTD` 尾部；
      · 「用例标识」= 规范的 caseCode（如 `JK-651-JYSG_DM_API_TESTING-2-T002.CTD`）。
    """
    all_cases = []
    for feature in features:
        for case in feature.get("cases") or []:
            all_cases.append((feature, case))

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

        # 用例标识：优先用规范 caseCode；没有就按规范现场生成
        code = case.get("caseCode") or ""
        if not code:
            code = build_case_code(
                case_type=case.get("type", "functional"),
                project_code=meta.get("projectCode") or "PROJ",
                source=meta.get("source") or SOURCE_CODE,
                chapter=case.get("chapter") or feature.get("name") or "UNKNOWN",
                normal=(case.get("polarity") or "normal") != "abnormal",
                seq=case.get("seq") or (offset + 1),
            )
        trace = build_trace_code(code)

        set_cell_text(row.cells[0], str(offset + 1))
        set_cell_text(row.cells[1], case.get("stage") or feature.get("stage") or stage_name or "")
        set_cell_text(row.cells[2], feature.get("name", ""))
        set_cell_text(row.cells[3], trace)
        set_cell_text(row.cells[4], code)
        set_cell_text(row.cells[5], verdict)


# ═════════════════════════════════════════════════════════════
#  单步骤报告（只有 4.1.1 那张表）
# ═════════════════════════════════════════════════════════════


def build_single_step(template: Path, data: dict, out_path: Path) -> Path:
    doc = Document(str(template))
    people = data.get("people") or {}
    case = data.get("case") or {}
    feature = data.get("feature") or {}

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
    fill_case_table(case_table, case, people, feature)
    # 整表尽量一页显示（用户要求：一张表不要拆成两页）
    keep_table_on_one_page(case_table)

    out_path.parent.mkdir(parents=True, exist_ok=True)
    doc.save(str(out_path))
    return out_path


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

    为什么不再写死桌面路径：原来硬编码的是某台机器上的
    C:\\Users\\<用户名>\\Desktop\\...，换人换机直接跑不起来。
    """
    base = Path(__file__).resolve().parent
    template_raw = argv[1] if len(argv) > 1 else os.environ.get("INTEGRATION_REPORT_TEMPLATE", "")
    template = Path(template_raw) if template_raw else (base / "配置项测试报告模板.docx")
    if not template.is_file():
        print("找不到模板：%s" % template, file=sys.stderr)
        print("提示：把模板放到本脚本同目录并命名为「配置项测试报告模板.docx」，", file=sys.stderr)
        print("      或用第一个参数指定路径，或设置环境变量 INTEGRATION_REPORT_TEMPLATE。", file=sys.stderr)
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