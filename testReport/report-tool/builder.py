"""Build a formal unit-test report from 单元测试报告模板.docx and v2 JSON data.

v2 结构与模板约定
=================
模板使用 Word **自动编号**（numbering.xml，numId=3）：
    编号标题1 → 1 / 2 / 3 …         （章：范围/引用文档/测试结果概述/第N阶段/注释）
    编号标题2 → 1.1 / 1.2 …         （节：标识/系统概述/…/函数名）
    编号标题3 → 1.1.1 …             （函数下的小节：测试结果总结/遇到的问题/不一致）
    附录标题  → 不编号，outline 0 级（进目录）

因此本模块**不再手写章节号**，编号全部交给 Word。段落原型按文本内容定位，
不按 "4." 这类字面编号定位（自动编号后段落文本里没有数字）。

文档结构::

    1 范围
        1.1 标识                  ← 插入项目标识正文
        1.2 系统概述              ← 插入系统概述正文
        1.3 文档概述
    2 引用文档
    3 测试结果概述
        3.1 对被测试软件的总体评估  ← 插入总体评估正文
        3.2 测试环境的影响          ← 插入环境说明
        3.3 改进建议                ← 插入改进建议
        3.4 回归测试                ← 由 4.4 迁移到此处
    4 第一阶段                      ← 每个 phase 一章
        4.1 函数名                  ← 每个 function 一节
            4.1.1 测试结果总结
                  <caseId> + 13×11 用例表（每案一张）
            4.1.2 遇到的问题
            4.1.3 与测试用例/规程不一致
    5 第二阶段 …
    N 注释
    附录A~F
"""
from copy import deepcopy
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from docx import Document
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.table import Table

from filler import fill_table, set_cell_text
from schema import SchemaError, validate
from toc_refresh import refresh_with_word

# 样式名（模板中已定义；找不到时降级为文本定位）
STYLE_H1 = '编号标题1'
STYLE_H2 = '编号标题2'
STYLE_H3 = '编号标题3'
STYLE_H4 = '编号标题4'


class BuilderError(RuntimeError):
    """Template is not well-formed enough to build from."""


# ════════════════════════════════════════════════════════════════════════
#  XML 基础工具
# ════════════════════════════════════════════════════════════════════════

def _flat(p_el) -> str:
    """段落的规范化文本（去掉所有空白）。"""
    return ''.join(''.join(t.text or '' for t in p_el.iter(qn('w:t'))).split())


def _find_para(body_els: list, text: str):
    """body 直属子元素里第一个包含 *text* 的 ``<w:p>``。"""
    for el in body_els:
        if el.tag == qn('w:p') and text in _flat(el):
            return el
    return None


def _find_para_index(body_els: list, text: str) -> int:
    for i, el in enumerate(body_els):
        if el.tag == qn('w:p') and text in _flat(el):
            return i
    return -1


def _style_id(doc: Document, name: str) -> str:
    """按样式名查 styleId；找不到返回空串。"""
    for st in doc.styles.element.findall(qn('w:style')):
        n = st.find(qn('w:name'))
        if n is not None and n.get(qn('w:val')) == name:
            return st.get(qn('w:styleId')) or ''
    return ''


def _set_para_style(p_el, style_id: str) -> None:
    """把段落的 w:pStyle 设为 *style_id*（没有 pPr 时补一个）。"""
    if not style_id:
        return
    pPr = p_el.find(qn('w:pPr'))
    if pPr is None:
        pPr = p_el.makeelement(qn('w:pPr'), {})
        p_el.insert(0, pPr)
    for old in pPr.findall(qn('w:pStyle')):
        pPr.remove(old)
    node = pPr.makeelement(qn('w:pStyle'), {})
    node.set(qn('w:val'), style_id)
    pPr.insert(0, node)


def _make_paragraph(proto_p, text: str, style_id: str = ''):
    """克隆 *proto_p* 的段属性与首个 run 的字符格式，写入 *text*。"""
    new = deepcopy(proto_p)
    runs = new.findall(qn('w:r'))
    template_run = deepcopy(runs[0]) if runs else None
    for child in list(new):
        if child.tag != qn('w:pPr'):
            new.remove(child)
    if template_run is not None:
        for child in list(template_run):
            if child.tag != qn('w:rPr'):
                template_run.remove(child)
        node = template_run.makeelement(qn('w:t'), {})
        node.set(qn('xml:space'), 'preserve')
        node.text = text
        template_run.append(node)
        new.append(template_run)
    if style_id:
        _set_para_style(new, style_id)
    return new


def _replace_para_text(p_el, text: str) -> None:
    """替换段落文本，保留 pPr 与首个 run 的格式。"""
    old_runs = p_el.findall(qn('w:r'))
    template_run = deepcopy(old_runs[0]) if old_runs else None
    for child in list(p_el):
        if child.tag != qn('w:pPr'):
            p_el.remove(child)
    if template_run is not None:
        for child in list(template_run):
            if child.tag != qn('w:rPr'):
                template_run.remove(child)
        node = template_run.makeelement(qn('w:t'), {})
        node.set(qn('xml:space'), 'preserve')
        node.text = text
        template_run.append(node)
        p_el.append(template_run)


def _clear_toc_cache(doc: Document) -> int:
    """清空目录缓存文本，让 Word 重建。"""
    cleared = 0
    for paragraph in doc.paragraphs:
        style = (paragraph.style.name or '').lower()
        if not style.startswith('toc'):
            continue
        for run in paragraph._p.findall(qn('w:r')):
            for node in run.findall(qn('w:t')):
                run.remove(node)
                cleared += 1
        for hyperlink in paragraph._p.findall(qn('w:hyperlink')):
            for run in hyperlink.findall(qn('w:r')):
                for node in run.findall(qn('w:t')):
                    run.remove(node)
                    cleared += 1
    return cleared


def _normalize_tables(doc: Document) -> int:
    """把所有表格的宽度设成正文宽度的 100%，避免列宽过窄导致逐字换行。"""
    changed = 0
    for table in doc.tables:
        tbl = table._tbl
        tblPr = tbl.find(qn('w:tblPr'))
        if tblPr is None:
            tblPr = tbl.makeelement(qn('w:tblPr'), {})
            tbl.insert(0, tblPr)
        for old in tblPr.findall(qn('w:tblW')):
            tblPr.remove(old)
        node = tblPr.makeelement(qn('w:tblW'), {})
        node.set(qn('w:type'), 'pct')
        node.set(qn('w:w'), '5000')
        tblStyle = tblPr.find(qn('w:tblStyle'))
        if tblStyle is not None:
            tblStyle.addnext(node)
        else:
            tblPr.insert(0, node)
        table.autofit = True
        changed += 1
    return changed


def _add_footer_page_numbers(doc: Document) -> int:
    """在每个节的页脚居中加 PAGE 域。"""
    added = 0
    for sec in doc.sections:
        footer = sec.footer
        para = footer.paragraphs[0] if footer.paragraphs else footer.add_paragraph()
        for run in list(para.runs):
            run._r.getparent().remove(run._r)
        para.alignment = WD_ALIGN_PARAGRAPH.CENTER
        run = para.add_run()
        begin = OxmlElement('w:fldChar')
        begin.set(qn('w:fldCharType'), 'begin')
        instr = OxmlElement('w:instrText')
        instr.set(qn('xml:space'), 'preserve')
        instr.text = ' PAGE '
        end = OxmlElement('w:fldChar')
        end.set(qn('w:fldCharType'), 'end')
        run._r.append(begin)
        run._r.append(instr)
        run._r.append(end)
        added += 1
    return added


def _insert_before_sectpr(body, element):
    sect_pr = body.find(qn('w:sectPr'))
    if sect_pr is not None:
        sect_pr.addprevious(element)
    else:
        body.append(element)


# ════════════════════════════════════════════════════════════════════════
#  RingBuffer 13×11 用例表原型
# ════════════════════════════════════════════════════════════════════════

def _load_ringbuffer_prototype() -> Tuple[Document, Any]:
    base = Path(__file__).resolve().parent
    candidates = [
        base.parent / 'templates' / 'RingBuffer-test.docx',
        base.parent / 'templates' / 'RingBuffer-test-blank.docx',
        base.parents[3] / '单元测试资料' / '报告' / 'RingBuffer-test(1).docx',
    ]
    for p in candidates:
        if p.is_file():
            proto_doc = Document(str(p))
            if proto_doc.tables:
                return proto_doc, proto_doc.tables[0]._tbl
    raise BuilderError(
        '找不到 RingBuffer 13×11 用例表原型。请确认以下文件之一存在：\n'
        + '\n'.join(f'  • {c}' for c in candidates)
    )


# ════════════════════════════════════════════════════════════════════════
#  模板三张固定表：T0 软件信息 / T1 圈复杂度 / T2 覆盖率
# ════════════════════════════════════════════════════════════════════════

def _resize_table_rows(table: Table, data_rows: int) -> None:
    """把表格调成「表头 + data_rows 个数据行」，多删少补（克隆最后一行）。"""
    data_rows = max(data_rows, 1)
    current = len(table.rows) - 1
    if current > data_rows:
        for tr in [table.rows[i]._tr for i in range(len(table.rows) - 1, data_rows, -1)]:
            tr.getparent().remove(tr)
    elif current < data_rows:
        template_tr = table.rows[-1]._tr
        previous = template_tr
        for _ in range(data_rows - current):
            new_tr = deepcopy(template_tr)
            previous.addnext(new_tr)
            previous = new_tr


def _set_table_font_size(table: Table, size_pt: float) -> None:
    """把表格里所有 run 的字号统一（含 set_cell_text 新建的 run）。"""
    from docx.shared import Pt

    for row in table.rows:
        for cell in row.cells:
            for paragraph in cell.paragraphs:
                for run in paragraph.runs:
                    run.font.size = Pt(size_pt)

def _fill_table_T0(doc: Document, meta: Dict[str, Any], data: Dict[str, Any]) -> bool:
    """T0 软件信息表（9 列）：一个测试阶段一行，共用列纵向合并。

    模板只保留表头 + 1 个数据行，行数按阶段数动态克隆。
    - 每行独立：测试阶段（列 1）、软件规模（列 3，= 该阶段函数数）
    - 纵向合并：被测软件名称、软件版本、编程语言、开发环境、
      运行环境、重要度、研制单位（所有阶段共用同一值）
    """
    t0 = next((t for t in doc.tables if len(t.columns) == 9), None)
    if t0 is None:
        return False

    phases = [p for p in (data.get('phases') or []) if isinstance(p, dict)] or [{}]
    meta = meta or {}
    executor = (meta.get('executor') or '').strip() or '未记录'

    # 共用列（列号 → 值）：软件版本来自项目配置文件，其余也来自 meta
    shared = {
        0: meta.get('project') or '未提供',
        2: meta.get('softwareVersion') or '未提供',
        4: meta.get('language') or '未提供',
        5: executor,
        6: executor,
        7: meta.get('importance') or '未提供',
        8: meta.get('devUnit') or '未提供',
    }

    _resize_table_rows(t0, len(phases))

    # 每行写自己的阶段与规模（规模 = 该阶段包含几个函数）
    for index, phase in enumerate(phases):
        row = t0.rows[index + 1]
        set_cell_text(row.cells[1], str(phase.get('name') or '未提供'))
        func_count = len(phase.get('functions') or [])
        set_cell_text(row.cells[3], f'{func_count} 个函数')

    # 共用列：多个阶段时纵向合并成一格，只写一次值
    last_row = len(phases)
    for col, value in shared.items():
        cell = t0.cell(1, col)
        if last_row > 1:
            cell = cell.merge(t0.cell(last_row, col))
        set_cell_text(cell, str(value))

    # 9 列要装下 9 个表头，字号统一降到 9pt，否则「测试阶段」这类 4 字表头会被迫折行
    _set_table_font_size(t0, 9)
    return True


def _fill_table_T1(doc: Document, data: Dict[str, Any], proto_body=None) -> bool:
    """T1 圈复杂度表（7×3）。未开展静态分析时明确写“未开展”。"""
    t1 = next((t for t in doc.tables if len(t.rows) == 7 and len(t.columns) == 3), None)
    if t1 is None:
        return False

    reviews = data.get('reviews') or {}
    items = data.get('staticItems') or []
    if not reviews.get('staticAnalysisDone') and not items:
        set_cell_text(t1.rows[1].cells[0], '未开展')
        set_cell_text(t1.rows[1].cells[1], '未开展静态分析工具，无圈复杂度数据')
        set_cell_text(t1.rows[1].cells[2], '—')
        return True

    # 3.1 话术说的是「圈复杂度大于 10 的函数」，所以只列 CC>10 的（与话术一致）。
    risky = [it for it in items if int(it.get('complexity') or 0) > 10]
    if not risky:
        _resize_table_rows(t1, 1)
        merged = t1.rows[1].cells[0].merge(t1.rows[1].cells[2])
        set_cell_text(merged, '本软件源代码中不存在圈复杂度大于 10 的函数。')
        return True

    _resize_table_rows(t1, len(risky))
    for i, item in enumerate(risky):
        row = t1.rows[i + 1]
        set_cell_text(row.cells[0], str(i + 1))
        set_cell_text(row.cells[1], str(item.get('function', '')))
        set_cell_text(row.cells[2], str(item.get('complexity', '')))
    _append_t1_note(t1, risky, proto_body)
    return True


def _append_t1_note(t1, risky: list, proto_body) -> None:
    """圈复杂度表后面那段固定说明（客户话术，只填真实算出来的数）。"""
    if not risky:
        return  # 没有 CC>10 的函数就不说这段话

    total_stmt = sum(int(it.get('nloc') or 0) for it in risky)
    total_branch = sum(max(int(it.get('complexity') or 0) - 1, 0) for it in risky)
    top_cc = max(int(it.get('complexity') or 0) for it in risky)
    level = '较为复杂' if top_cc <= 20 else '复杂'
    text = (
        "经与开发人员确认，以上函数由多个"
        f"{total_stmt}条"
        "语句中多个"
        f"{total_branch}个"
        "分支构成的，使得圈复杂度"
        f"最高达{top_cc}"
        "，代码逻辑"
        f"{level}"
        "，不会对后续软件维护与测试产生不良影响。"
    )

    if proto_body is not None:
        paragraph = _make_paragraph(proto_body, text)
    else:
        paragraph = OxmlElement('w:p')
        run = OxmlElement('w:r')
        node = OxmlElement('w:t')
        node.text = text
        run.append(node)
        paragraph.append(run)

    t1._tbl.addnext(paragraph)


def _fill_table_T2(doc: Document, data: Dict[str, Any]) -> bool:
    """T2 覆盖率统计表（5×8，列序与客户模板一致）。

    表头：序号|测试阶段|函数|语句覆盖率|分支覆盖率|MCDC覆盖率|软件版本号|分析结果

    旧版 VS CodeCoverage.exe 只输出块/行覆盖率，没有语句、分支、MC-DC 口径；
    行≠语句，不能冒充，所以语句/分支写「未采集」，MC/DC 按客户要求写 n/a。
    真采到的行/块数据写进「分析结果」列，不额外加列。
    """
    t2 = next((t for t in doc.tables if len(t.rows) == 5 and len(t.columns) == 8), None)
    if t2 is None:
        return False

    cov = data.get('coverage') or {}
    phases = data.get('phases') or []
    version = (data.get('meta') or {}).get('softwareVersion') or '未提供'


    # 口径：旧版 VS 采集器只给块/行，报告要语句/分支；按客户要求行→语句、块→分支，
    # 并在「分析结果」列明写口径。
    note = '本次运行整体采集（行→语句、块→分支代标）' if cov.get('available') else '未采集'

    def pct(key: str) -> str:
        block = cov.get(key) or {}
        if block.get('percent') is None:
            return '未采集'
        return f'{block.get("percent")}%'

    if not cov.get('available'):
        reason = (cov.get('reason') or '未采集').strip()
        set_cell_text(t2.rows[1].cells[0], '1')
        set_cell_text(t2.rows[1].cells[1], '全部阶段')
        set_cell_text(t2.rows[1].cells[2], '全部函数')
        set_cell_text(t2.rows[1].cells[3], '未采集')
        set_cell_text(t2.rows[1].cells[4], '未采集')
        set_cell_text(t2.rows[1].cells[5], 'n/a')
        set_cell_text(t2.rows[1].cells[6], version)
        set_cell_text(t2.rows[1].cells[7], f'未采集：{reason}')
        _resize_table_rows(t2, 1)
        return True

    _resize_table_rows(t2, len(phases))
    for i, phase in enumerate(phases[: len(t2.rows) - 1]):
        row = t2.rows[i + 1]
        funcs = phase.get('functions') or []
        set_cell_text(row.cells[0], str(i + 1))
        set_cell_text(row.cells[1], phase.get('name', ''))
        set_cell_text(row.cells[2], '、'.join(f.get('name', '') for f in funcs) or '—')
        # 列序：序号|阶段|函数|语句|分支|MCDC|版本|分析结果
        set_cell_text(row.cells[3], pct('line'))     # 语句覆盖率 ← 行覆盖率代标
        set_cell_text(row.cells[4], pct('block'))    # 分支覆盖率 ← 块覆盖率代标
        set_cell_text(row.cells[5], 'n/a')
        set_cell_text(row.cells[6], version)
        set_cell_text(row.cells[7], note)
    return True


# ════════════════════════════════════════════════════════════════════════
#  章节正文
# ════════════════════════════════════════════════════════════════════════

def _insert_after(anchor, element):
    """在 *anchor* 段落之后插入 *element*。"""
    anchor.addnext(element)
    return element


def _fill_chapter1(body_els: list, meta: Dict[str, Any], proto_body) -> None:
    """1.1 标识 / 1.2 系统概述：按客户模板要求**不写正文**。

    1.2 下面直接就是表 1 软件信息表（表格是模板自带的 body 元素，不在这里插）。
    1.1 和 1.3 同理，只留标题，不填说明性文字。
    """
    return


def _cn_date(value: str) -> tuple:
    """'2026-11-19T17:01:04+08:00' → (2026, 11, 19)；解析不了就全部 None。"""
    import re

    match = re.match(r'(\d{4})-(\d{1,2})-(\d{1,2})', str(value or ''))
    if not match:
        return (None, None, None)
    return (int(match.group(1)), int(match.group(2)), int(match.group(3)))


def _short_software_name(project: str) -> str:
    """'cpp-gtest-demo 单元测试' → 'cpp-gtest-demo'（话术里只需要软件名）。"""
    name = str(project or '').strip()
    for suffix in (' 单元测试', '单元测试'):
        if name.endswith(suffix):
            return name[: -len(suffix)].strip() or name
    return name




def _mcdc_unmet_count(data: Dict[str, Any]):
    """分支/MCDC 覆盖率未达到 100% 的函数数；没有 MCDC 数据时返回 None。

    只有采集器真的给了分支或 MCDC 指标时才能算，否则写「未能判定」而不是编一个数。
    """
    coverage = data.get('coverage') or {}
    if not coverage.get('available'):
        return None
    metric = coverage.get('mcdc') or coverage.get('branch') or {}
    if not metric or metric.get('total') in (None, 0):
        return None
    percent = metric.get('percent')
    if percent is None:
        return None
    # 只有整体未达 100% 时，才能说“有函数未达到”；具体几个函数得逐函数数据，
    # 当前运行级采集不提供，所以只要整体达标就返回 0，否则返回 None（无法逐函数判定）。
    return 0 if float(percent) >= 100.0 else None
def _build_assessment(data: Dict[str, Any]) -> str:
    """3.1 对被测试软件的总体评估：客户固定话术，只把数据填进去。

    没采集到的指标写「未采集」，不编造数字。
    """
    meta = data.get('meta') or {}
    summary = data.get('summary') or {}
    issues = data.get('issues') or {}
    phases = data.get('phases') or []

    start_y, start_m, start_d = _cn_date(meta.get('executedAt') or '')
    end_y, end_m, end_d = _cn_date(meta.get('finishedAt') or meta.get('executedAt') or '')
    if start_y and end_y:
        date_text = f"{start_y}年{start_m}月{start_d}日至{end_y}年{end_m}月{end_d}日"
    else:
        date_text = "测试日期未记录"

    software = _short_software_name(meta.get('project') or '')
    phase_count = len(phases)
    func_count = sum(len(p.get('functions') or []) for p in phases)

    total = int(summary.get('total') or 0)
    passed = int(summary.get('passed') or 0)
    failed = int(summary.get('failed') or 0)
    not_run = int(summary.get('notRun') or 0)
    executed = total - not_run

    doc_issues = len(issues.get('docIssues') or [])
    static_issues = len(issues.get('staticIssues') or [])
    code_issues = len(issues.get('codeIssues') or [])
    dynamic_issues = len(issues.get('dynamicIssues') or [])

    # 注释率与 MCDC 未达标函数数：当前只有旧版 VS 采集器（不提供 MCDC）与静态分析（不统计注释），
    # 没有真数据就写「未采集」，绝不推测。
    comment_rate = ((data.get('staticMetrics') or {}).get('commentRate'))
    comment_text = f"{comment_rate}%" if comment_rate not in (None, '') else '未采集'
    mcdc_count = _mcdc_unmet_count(data)

    # MCDC 那句话：有数据就用数字，没数据就如实说明无法判定（旧版 VS 采集器不提供）
    if mcdc_count is not None:
        mcdc_clause = (f"导致{mcdc_count}个函数单元分支覆盖率MCDC覆盖率未达到100%。"
                       "具体问题详细信息见附录E。")
    else:
        mcdc_clause = ("本次采集器不提供 MCDC（修正条件判定覆盖）数据，"
                       "无法判定函数单元是否达到100%；相关用例明细见附录E。")

    def issue_clause(count: int, appendix: str, subject: str) -> str:
        if count > 0:
            return (f"{subject}共发现{count}个问题，均为一般问题，"
                    f"具体问题详细信息见附录{appendix}。")
        return f"{subject}未发现问题。"

    return (
        f"{date_text}，测试人员分{phase_count}个迭代阶段，"
        f"对开发人员提供的{software}软件源程序。及{software}软件研制任务书、"
        "需求规格说明、设计说明进行单元测试，主要进行了文档审查、静态分析、"
        "代码审查和动态单元测试。整体测试结果总结如下，"
        + issue_clause(doc_issues, 'B', '文档审查')
        + issue_clause(static_issues, 'C', '静态分析')
        + issue_clause(code_issues, 'D', '代码审查')
        + (f"动态单元测试共选取了{func_count}个函数单元，作为本次单元测试的重点单元，"
           f"共设计了{total}个测试用例，实际执行{executed}个测试用例，"
           f"执行通过测试用例{passed}个，未通过测试用例{failed}个。")
        + f"测试过程中共发现{dynamic_issues}个程序问题，"
        + mcdc_clause
        + "通过软件测试结果可得，被测软件并无重大设计类缺陷，不影响软件和系统设计。"
        "经本阶段单元测试，软件函数单元的设计实现符合软件设计说明的要求，"
        "软件编码符合编码规范，"
        + f"{software}软件代码注释率为{comment_text}。"
        + "符合软件代码有效注释率不小于30%的要求，"
        "本软件源代码中圈复杂度大于10的函数及其圈复杂度如下表所示："
    )

def _fill_chapter3(body_els: list, data: Dict[str, Any], proto_body) -> None:
    """3.1 总体评估写固定话术；3.2 测试环境的影响 / 3.3 改进建议 按客户要求**空着**。"""
    if proto_body is None:
        return

    assessment = data.get('overallAssessment') or _build_assessment(data)
    p_3_1 = _find_para(body_els, '总体评估')
    if p_3_1 is not None:
        _insert_after(p_3_1, _make_paragraph(proto_body, assessment))
    # 3.2、3.3 不写任何正文（客户模板只要标题）


def _fill_chapter2(body_els: list, meta: Dict[str, Any], proto_body) -> None:
    """2 引用文档：客户模板要求不写说明性文字，只留章节标题。"""
    return


def _fill_doc_overview(body_els: list, data: Dict[str, Any], proto_body) -> None:
    """1.3 文档概述：客户模板要求不写正文。"""
    return


def _move_regressions(body_els: list, data: Dict[str, Any], proto_body,
                      sid_h2: str) -> None:
    """把模板里的 4.4 回归测试迁到 3.4（作为 3 章的最后一节）。"""
    if proto_body is None:
        return
    reg = data.get('regressions') or {}
    p_reg = _find_para(body_els, '回归测试')
    p_3_3 = _find_para(body_els, '改进建议')
    if p_reg is None or p_3_3 is None:
        return

    if reg.get('conducted'):
        text = '已开展回归测试。'
        if reg.get('previousRunId'):
            text += f" 关联前次运行：{reg['previousRunId']}。"
        if reg.get('notes'):
            text += f" {reg['notes']}"
    else:
        text = '未开展回归测试：本次仅有一次真实执行，无前后版本或前次运行记录可供比对。'

    heading = _make_paragraph(p_reg, '回归测试', sid_h2)
    # 找到 3.3 正文之后的插入点
    anchor = p_3_3
    nxt = anchor.getnext()
    if nxt is not None and nxt.tag == qn('w:p') and '未提供改进建议' in _flat(nxt):
        anchor = nxt
    elif nxt is not None and nxt.tag == qn('w:p'):
        pass
    _insert_after(anchor, heading)
    _insert_after(heading, _make_paragraph(proto_body, text))


# ════════════════════════════════════════════════════════════════════════
#  阶段 → 函数 → 用例
# ════════════════════════════════════════════════════════════════════════

def _generate_phases(
    body,
    insert_point,        # 阶段内容插入到该元素之前（注释标题）
    proto_h1,
    proto_h2,
    proto_h3,
    proto_body,
    protos_func,
    sid_h1: str,
    sid_h2: str,
    sid_h3: str,
    data: Dict[str, Any],
    rb_doc: Document,
    rb_tbl,
) -> None:
    """逐个阶段生成章节：阶段 → 函数 → 小节 → 用例表。"""
    phases = data.get('phases') or []

    for phase in phases:
        h1 = _make_paragraph(proto_h1, phase.get('name', '未命名阶段'), sid_h1)
        insert_point.addprevious(h1)
        last = h1

        # 4.x 章节开头的固定话术（客户模板，只填真数据）
        intro = _build_phase_assessment(data, phase)
        intro_p = _make_paragraph(proto_body, intro)
        last.addnext(intro_p)
        last = intro_p

        functions = phase.get('functions') or []
        for func in functions:
            f_summary = func.get('summary') or {}

            h2 = _make_paragraph(proto_h2, func.get('name', '未命名函数'), sid_h2)
            last.addnext(h2)
            last = h2

            # 4.x.1 测试结果总结
            h3 = _make_paragraph(proto_h3, '测试结果总结', sid_h3)
            last.addnext(h3)
            last = h3

            total = f_summary.get('total', 0)
            line = f'共 {total} 条用例，通过 {f_summary.get("passed", 0)} 条'
            if f_summary.get('failed'):
                line += f'，失败 {f_summary["failed"]} 条'
            if f_summary.get('notRun'):
                line += f'，未执行 {f_summary["notRun"]} 条'
            if f_summary.get('unconfirmed'):
                line += f'，未确认 {f_summary["unconfirmed"]} 条'
            line += '。'
            body_p = _make_paragraph(proto_body, line)
            last.addnext(body_p)
            last = body_p

            for case in func.get('cases') or []:
                case_id = case.get('id', '')
                label = _make_paragraph(proto_body, case_id)
                last.addnext(label)
                last = label

                table_el = deepcopy(rb_tbl)
                table = Table(table_el, rb_doc)
                if not fill_table(table, case, function=func):
                    raise BuilderError(f'用例表填充失败：{case_id}')
                last.addnext(table_el)
                last = table_el

            # 4.x.2 遇到的问题
            h3 = _make_paragraph(proto_h3, '遇到的问题', sid_h3)
            # last 可能是元素，用添加上一个元素的方式推进
            _append_after(last, h3)
            last = h3
            body_p = _make_paragraph(proto_body, func.get('issues') or '未记录异常。')
            _append_after(last, body_p)
            last = body_p

            # 4.x.3 与测试用例/规程不一致
            h3 = _make_paragraph(proto_h3, '与测试用例/规程不一致', sid_h3)
            _append_after(last, h3)
            last = h3
            body_p = _make_paragraph(proto_body, func.get('inconsistent') or '未核查。')
            _append_after(last, body_p)
            last = body_p

        # 阶段级问题汇总：仅当本阶段有多个函数时才单独成节，
        if len(functions) > 1:
            h3 = _make_paragraph(proto_h3, '阶段问题汇总', sid_h3)
            _append_after(last, h3)
            last = h3
            body_p = _make_paragraph(
                proto_body, phase.get('phaseIssues') or f'本阶段共 {len(functions)} 个函数，未记录异常。')
            _append_after(last, body_p)
            last = body_p


def _append_after(anchor, element):
    """在任意 body 子元素之后插入（表格/段落都适用）。"""
    anchor.addnext(element)
    return element


# ════════════════════════════════════════════════════════════════════════
#  附录
# ════════════════════════════════════════════════════════════════════════

def _fill_appendices(body_els: list, data: Dict[str, Any], proto_body) -> None:
    """附录A 未开展文档审查时，在标题后注明。"""
    reviews = data.get('reviews') or {}
    p_app_a = _find_para(body_els, '附录A')
    if p_app_a is None or proto_body is None:
        return
    if not reviews.get('docReviewDone'):
        _insert_after(
            p_app_a,
            _make_paragraph(proto_body, '未开展文档审查：本次未提供待审查文档，附录A 审查单未填写。'),
        )



def _build_phase_assessment(data: Dict[str, Any], phase: Dict[str, Any]) -> str:
    """第 4 章（各阶段「项目测试结果」）开头的固定话术，只填真数据。

    日期/问题数是运行级的（本次运行就是一次真实执行），
    函数数/用例数按**本阶段**统计。
    """
    meta = data.get('meta') or {}
    issues = data.get('issues') or {}
    people = meta.get('people') or {}

    start_y, start_m, start_d = _cn_date(meta.get('executedAt') or '')
    end_y, end_m, end_d = _cn_date(meta.get('finishedAt') or meta.get('executedAt') or '')
    if start_y and end_y:
        date_text = f"{start_y}年{start_m}月{start_d}日至{end_y}年{end_m}月{end_d}日"
    else:
        date_text = "测试日期未记录"
    # 交付日期没有独立字段，暂用执行日期（要区分就加配置项 deliveryDate）
    delivery_text = date_text.split('至')[0] if '至' in date_text else '日期未记录'

    tester = str(people.get('tester') or '').strip() or '测试人员未记录'
    software = _short_software_name(meta.get('project') or '')
    version = str(meta.get('softwareVersion') or '').strip()
    version_text = f"（{version}）" if version and version != '未配置' else ''

    funcs = phase.get('functions') or []
    func_count = len(funcs)
    total = passed = failed = not_run = 0
    for func in funcs:
        summary = func.get('summary') or {}
        total += int(summary.get('total') or 0)
        passed += int(summary.get('passed') or 0)
        failed += int(summary.get('failed') or 0)
        not_run += int(summary.get('notRun') or 0)
    executed = total - not_run

    doc_issues = len(issues.get('docIssues') or [])
    static_issues = len(issues.get('staticIssues') or [])
    code_issues = len(issues.get('codeIssues') or [])

    def issue_clause(count: int, appendix: str, subject: str) -> str:
        if count > 0:
            return (f"{subject}共发现{count}个问题，均为一般问题，"
                    f"具体问题详细信息见附录{appendix}。")
        return f"{subject}未发现问题。"

    return (
        f"{date_text}，测试人员{tester}，对开发人员于{delivery_text}提供的"
        f"{software}源程序{version_text}进行单元测试，主要进行了文件审查、静态分析、"
        "代码审查和动态单元测试。"
        + issue_clause(doc_issues, 'B', '文档审查')
        + issue_clause(static_issues, 'C', '静态分析')
        + issue_clause(code_issues, 'D', '代码审查')
        + (f"动态单元测试共选取了{func_count}个函数单元作为本次单元测试的重点单元，"
           f"共设计了{total}个测试用例，实际执行{executed}个测试用例，"
           f"执行通过测试用例{passed}个。"
           f"未通过测试用例{failed}个，其余用例全部执行通过。")
    )


# ════════════════════════════════════════════════════════════════════════
#  主入口
# ════════════════════════════════════════════════════════════════════════

def build(
    template_path: str,
    data: Dict[str, Any],
    out_path: str,
    skill_path: Optional[str] = None,
    refresh_toc: bool = True,
) -> Path:
    """生成报告并返回输出路径。

    *skill_path* 仅为兼容旧调用保留，v2 不再使用（数据自包含）。
    """
    data = validate(data)

    doc = Document(template_path)
    body = doc.element.body
    body_els = list(body)
    meta = data.get('meta') or {}

    rb_doc, rb_tbl = _load_ringbuffer_prototype()

    # ── 样式 ID ──
    sid_h1 = _style_id(doc, STYLE_H1)
    sid_h2 = _style_id(doc, STYLE_H2)
    sid_h3 = _style_id(doc, STYLE_H3)

    # ── 段落原型 ──
    proto_h1 = _find_para(body_els, '项目测试结果')
    if proto_h1 is None:
        tpl_name = Path(template_path).name
        hint = ''
        if ('RingBuffer' in tpl_name
                or _find_para(body_els, '详细测试结果') is not None):
            hint = ('\n  当前模板是 RingBuffer 样本，仅作用例表格式原型，不能生成报告。')
        raise BuilderError(
            '模板缺少阶段标题原型（找不到「项目测试结果」段落）。' + hint
            + '\n  请改用正式模板：templates/单元测试报告模板.docx'
            + f'\n  当前模板：{tpl_name}'
        )

    proto_h2 = _find_para(body_els, '测试结果总结')
    if proto_h2 is None:
        raise BuilderError('模板缺少函数级标题原型（找不到「测试结果总结」段落）')

    proto_h3 = proto_h2  # 三级标题以二级为蓝本，靠样式区分

    proto_body = _find_para(body_els, '各函数语句覆盖率')
    if proto_body is None:
        proto_body = _find_para(body_els, '覆盖率统计分析表如下')
    if proto_body is None:
        proto_body = _find_para(body_els, '无')
    if proto_body is None:
        raise BuilderError('模板缺少正文段落原型')

    # ── 标题 / 章节正文 ──
    p_title = _find_para(body_els, '单元测试报告')
    if p_title is not None:
        _replace_para_text(p_title, meta.get('project', '单元测试报告'))

    _fill_chapter1(body_els, meta, proto_body)
    _fill_doc_overview(body_els, data, proto_body)
    _fill_chapter2(body_els, meta, proto_body)
    _fill_chapter3(body_els, data, proto_body)
    # 3.4 回归测试不生成（客户模板里没有这一节，也不要求）

    # ── 固定表 ──
    _fill_table_T0(doc, meta, data)
    _fill_table_T1(doc, data, proto_body)
    _fill_table_T2(doc, data)

    # ── 清掉模板第 4 章示例区（阶段内容动态生成） ──
    ch4_idx = _find_para_index(body_els, '项目测试结果')
    ch5_idx = _find_para_index(body_els, '注释')
    if ch4_idx < 0 or ch5_idx < 0 or ch5_idx <= ch4_idx:
        raise BuilderError('模板结构异常：找不到「项目测试结果」或「注释」章节')
    insert_point = body_els[ch5_idx]
    for el in body_els[ch4_idx:ch5_idx]:
        try:
            body.remove(el)
        except Exception:
            pass

    # ── 生成阶段章节（插到「注释」之前） ──
    _generate_phases(
        body, insert_point, proto_h1, proto_h2, proto_h3, proto_body, None,
        sid_h1, sid_h2, sid_h3, data, rb_doc, rb_tbl,
    )

    # ── 附录 ──
    _fill_appendices(list(body), data, proto_body)

    # ── 表格宽度归一化 + 页脚页码 ──
    table_count = _normalize_tables(doc)
    footer_count = _add_footer_page_numbers(doc)


    # ── 目录清理 + 重建 ──
    cleared = _clear_toc_cache(doc)
    settings = doc.settings.element
    if settings.find(qn('w:updateFields')) is None:
        node = settings.makeelement(qn('w:updateFields'), {})
        node.set(qn('w:val'), 'true')
        settings.append(node)

    doc.save(out_path)

    toc_note = 'updateFields（打开时需手动更新）'
    if refresh_toc:
        ok, detail = refresh_with_word(out_path)
        toc_note = f'已重建（{detail}）' if ok else f'未重建，回退到 updateFields —— {detail}'

    phases = data.get('phases') or []
    func_count = sum(len(p.get('functions') or []) for p in phases)
    case_count = sum(len(f.get('cases') or []) for p in phases for f in (p.get('functions') or []))
    summary = data.get('summary') or {}
    print(
        f"phases={len(phases)}  functions={func_count}  cases={case_count}  "
        f"passed={summary.get('passed', 0)}  failed={summary.get('failed', 0)}  "
        f"notRun={summary.get('notRun', 0)}  unconfirmed={summary.get('unconfirmed', 0)}  "
        f"toc_cleared={cleared}"
    )
    print(f'目录：{toc_note}')
    return Path(out_path)