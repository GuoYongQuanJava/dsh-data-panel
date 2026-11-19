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

def _fill_table_T0(doc: Document, meta: Dict[str, Any], data: Dict[str, Any]) -> bool:
    """T0 软件信息表（6×9）。表头 R0，数据写 R1。"""
    t0 = next((t for t in doc.tables if len(t.rows) == 6 and len(t.columns) == 9), None)
    if t0 is None:
        return False

    phases = data.get('phases') or []
    phase_names = '、'.join(p.get('name', '') for p in phases if p.get('name')) or '未提供'
    functions = sum(len(p.get('functions') or []) for p in phases)
    summary = data.get('summary') or {}
    scale = f'{functions} 函数 / {summary.get("total", 0)} 用例'
    executor = (meta.get('executor') or '').strip()

    values = [
        meta.get('project', '未提供'),
        phase_names,
        meta.get('softwareVersion', '未提供'),
        scale,
        meta.get('language', '未提供'),
        executor or '未记录',
        executor or '未记录',
        meta.get('importance', '未提供'),
        meta.get('devUnit', '未提供'),
    ]
    row = t0.rows[1]
    for idx, val in enumerate(values):
        if idx < len(row.cells):
            set_cell_text(row.cells[idx], val)
    return True


def _fill_table_T1(doc: Document, data: Dict[str, Any]) -> bool:
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

    for i, item in enumerate(items[: len(t1.rows) - 1]):
        row = t1.rows[i + 1]
        set_cell_text(row.cells[0], str(i + 1))
        set_cell_text(row.cells[1], str(item.get('function', '')))
        set_cell_text(row.cells[2], str(item.get('complexity', '')))
    return True


def _fill_table_T2(doc: Document, data: Dict[str, Any]) -> bool:
    """T2 覆盖率统计表（5×10）。按阶段逐行；run 级覆盖率不复制给每个函数。"""
    t2 = next((t for t in doc.tables if len(t.rows) == 5 and len(t.columns) == 10), None)
    if t2 is None:
        return False

    cov = data.get('coverage') or {}
    phases = data.get('phases') or []

    def pct(key: str) -> str:
        block = cov.get(key) or {}
        if block.get('percent') is None:
            return '未提供'
        return f'{block.get("percent")}%'

    if not cov.get('available'):
        reason = (cov.get('reason') or '未采集').strip()
        set_cell_text(t2.rows[1].cells[0], '1')
        set_cell_text(t2.rows[1].cells[1], '全部阶段')
        set_cell_text(t2.rows[1].cells[2], '全部函数')
        for col in (3, 4, 5, 6, 7):
            set_cell_text(t2.rows[1].cells[col], '未采集')
        set_cell_text(t2.rows[1].cells[8], (data.get('meta') or {}).get('softwareVersion', '未提供'))
        set_cell_text(t2.rows[1].cells[9], f'未采集：{reason}')
        return True

    for i, phase in enumerate(phases[: len(t2.rows) - 1]):
        row = t2.rows[i + 1]
        funcs = phase.get('functions') or []
        set_cell_text(row.cells[0], str(i + 1))
        set_cell_text(row.cells[1], phase.get('name', ''))
        set_cell_text(row.cells[2], '、'.join(f.get('name', '') for f in funcs) or '—')
        # 列序：序号|阶段|函数|行|块|语句|分支|MCDC|版本|分析结果
        set_cell_text(row.cells[3], pct('line'))
        set_cell_text(row.cells[4], pct('block'))
        set_cell_text(row.cells[5], pct('statement'))
        set_cell_text(row.cells[6], pct('branch'))
        set_cell_text(row.cells[7], pct('mcdc'))
        set_cell_text(row.cells[8], (data.get('meta') or {}).get('softwareVersion', '未提供'))
        set_cell_text(row.cells[9], '本次运行采集（run 级同口径）')
    return True


# ════════════════════════════════════════════════════════════════════════
#  章节正文
# ════════════════════════════════════════════════════════════════════════

def _insert_after(anchor, element):
    """在 *anchor* 段落之后插入 *element*。"""
    anchor.addnext(element)
    return element


def _fill_chapter1(body_els: list, meta: Dict[str, Any], proto_body) -> None:
    """1.1 标识 / 1.2 系统概述 正文。"""
    p_1_1 = _find_para(body_els, '标识')
    if p_1_1 is not None and proto_body is not None:
        parts = [f"被测软件：{meta.get('project', '未提供')}"]
        if meta.get('projectPackage') and meta.get('projectPackage') != '未填写':
            parts.append(f"项目包：{meta['projectPackage']}")
        if meta.get('softwareVersion') and meta.get('softwareVersion') != '未填写':
            parts.append(f"软件版本：{meta['softwareVersion']}")
        parts.append(f"本次运行标识：{meta.get('runId', '未记录')}")
        _insert_after(p_1_1, _make_paragraph(proto_body, '；'.join(parts) + '。'))

    p_1_2 = _find_para(body_els, '系统概述')
    if p_1_2 is not None and proto_body is not None:
        overview = (
            f"本报告针对 {meta.get('project', '未提供')} 开展单元测试，"
            f"软件版本 {meta.get('softwareVersion', '未提供')}，"
            f"编程语言 {meta.get('language', '未提供')}，"
            f"研制单位 {meta.get('devUnit', '未提供')}，"
            f"软件重要度 {meta.get('importance', '未提供')}。"
        )
        _insert_after(p_1_2, _make_paragraph(proto_body, overview))


def _fill_chapter3(body_els: list, data: Dict[str, Any], proto_body) -> None:
    """3.1 总体评估 / 3.2 环境影响 / 3.3 改进建议 正文。"""
    if proto_body is None:
        return

    summary = data.get('summary') or {}
    total = summary.get('total', 0)
    passed = summary.get('passed', 0)
    failed = summary.get('failed', 0)
    not_run = summary.get('notRun', 0)
    unconfirmed = summary.get('unconfirmed', 0)
    exec_rate = summary.get('executionRate', 0)
    pass_rate = summary.get('passRate', 0)

    assessment = data.get('overallAssessment') or (
        f"本次单元测试共设计 {total} 条用例，已执行 {total - not_run} 条"
        f"（执行率 {exec_rate:.1f}%），通过 {passed} 条（通过率 {pass_rate:.1f}%），"
        f"失败 {failed} 条，未执行 {not_run} 条"
        + (f"，未确认 {unconfirmed} 条" if unconfirmed else "")
        + "。"
    )
    p_3_1 = _find_para(body_els, '总体评估')
    if p_3_1 is not None:
        _insert_after(p_3_1, _make_paragraph(proto_body, assessment))

    env_text = data.get('environmentImpact') or (
        f"测试环境：{data.get('meta', {}).get('language', '未记录')}；"
        f"执行器：{data.get('meta', {}).get('executor', '未记录')}。"
    )
    p_3_2 = _find_para(body_els, '测试环境的影响')
    if p_3_2 is not None:
        _insert_after(p_3_2, _make_paragraph(proto_body, env_text))

    improvements = data.get('improvements')
    if not improvements:
        imp_text = '未提供改进建议。'
    elif isinstance(improvements, list):
        imp_text = '；'.join(str(x) for x in improvements) + '。'
    else:
        imp_text = str(improvements)
    p_3_3 = _find_para(body_els, '改进建议')
    if p_3_3 is not None:
        _insert_after(p_3_3, _make_paragraph(proto_body, imp_text))


def _fill_chapter2(body_els: list, meta: Dict[str, Any], proto_body) -> None:
    """2 引用文档：按配置里提供的真实文档列出。"""
    p = _find_para(body_els, '引用文档')
    if p is None or proto_body is None:
        return
    refs = meta.get('references') or []
    items = [r for r in refs if isinstance(r, dict) and str(r.get('name') or '').strip()]
    if items:
        parts = []
        for i, r in enumerate(items, 1):
            ver = str(r.get('version') or '').strip()
            ver_text = f'（{ver}）' if ver else '（版本未提供）'
            parts.append(f"{i}. {r.get('type') or '文档'}：{r['name']}{ver_text}")
        text = '；'.join(parts) + '。'
    else:
        text = '未提供引用文档：本次未收到任务书、需求规格说明或设计说明等受控文档。'
    _insert_after(p, _make_paragraph(proto_body, text))


def _fill_doc_overview(body_els: list, data: Dict[str, Any], proto_body) -> None:
    """1.3 文档概述：说明报告目的、范围与适用限制。"""
    p = _find_para(body_els, '文档概述')
    if p is None or proto_body is None:
        return
    phases = data.get('phases') or []
    text = (
        "本报告说明本次单元测试的范围、依据、执行结果与发现的问题，"
        f"按测试阶段与被测函数组织，共 {len(phases)} 个阶段。"
        "报告内容仅来源于本次真实执行记录及其快照；未开展的工作与未采集的数据均已如实标注，"
        "分析性结论与执行证据分开标注，不代表额外已执行的测试。"
    )
    _insert_after(p, _make_paragraph(proto_body, text))


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
    _move_regressions(body_els, data, proto_body, sid_h2)

    # ── 固定表 ──
    _fill_table_T0(doc, meta, data)
    _fill_table_T1(doc, data)
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