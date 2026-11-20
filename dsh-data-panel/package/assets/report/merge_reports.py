"""把多份「单条用例报告」合并成一份 Word（一张表一页）。

为什么要这个脚本
----------------
集成测试面板的多选导出，用户要的是**一份**文档里把所有选中用例的表拼在一起，
而不是导出 N 个零散文件。「拼接」的语义很具体：

  · 文档标题只出现一次（「配置项测试报告（选中用例汇总）」）
  · 每个用例一张表，**一张表一页**（表之间插分页符，不拆表）
  · 表与表之间不加章节号、不加表题 —— 单条报告本来就是「一张填好的表」

为什么从 docx 里抠表，而不是重新填表
------------------------------------
生成端（`integration_report.py` 的 `build_single_step`）已经把每条用例填成了
一张 16 行的表，行内横向合并、`tblLayout`、列宽、`keepNext` 全都调好了。
重新填一遍等于把那套排版逻辑抄第二遍，改一处漏一处就会两套报告长得不一样。
直接复制已生成表格的 XML 节点，**排版与单条报告逐字节一致**，这是唯一不会漂的做法。

用法
----
    python merge_reports.py --template <模板.docx> --out <输出.docx> <单条1.docx> [单条2.docx ...]

输出：成功时打印 `OK <输出路径> <合并的表数>`，失败打印 `FAIL <原因>` 并以非 0 退出。
"""

import copy
import sys
from pathlib import Path

try:
    from docx import Document
except ImportError:  # pragma: no cover - 环境问题，明确报错而不是静默降级
    print("FAIL 缺少 python-docx：请先 pip install python-docx", file=sys.stderr)
    sys.exit(3)

from docx.oxml import OxmlElement
from docx.oxml.ns import qn

# 合并后文档的标题。单条报告用的是「配置项测试报告（单步骤执行结果）」，
# 汇总件换成这个，看文件名和标题就知道这是「选出来的几条」而不是整本项目报告。
MERGED_TITLE = "配置项测试报告（选中用例汇总）"


def _text_of(element):
    """取一个段落元素里的纯文本（只用于认标题，不做排版判断）。"""
    return "".join(node.text or "" for node in element.iter(qn("w:t")))


def _find_prototypes(body):
    """从模板里取出「标题段落」和「用例表格」两个原型节点。

    模板是整本项目报告，正文里第一个 w:tbl 就是用例表的母版；
    标题则取含「配置项测试报告」的那一段，保留它的字体字号。
    """
    proto_title = None
    proto_table = None
    for element in list(body):
        if element.tag == qn("w:tbl") and proto_table is None:
            proto_table = copy.deepcopy(element)
        if element.tag == qn("w:p") and proto_title is None:
            if "配置项测试报告" in _text_of(element):
                proto_title = copy.deepcopy(element)
    if proto_table is None:
        raise RuntimeError("模板里找不到表格原型（第一个 w:tbl）")
    return proto_title, proto_table


def _set_paragraph_text(paragraph_element, text):
    """把一个已存在的段落元素的文字换掉，保留它的段落/字符格式。

    直接改第一个 w:t 的文本，其余 run 清空 —— 标题原型可能被拆成多个 run，
    不清理就会残留模板原文。
    """
    runs = list(paragraph_element.iter(qn("w:t")))
    if not runs:
        return
    runs[0].text = text
    for extra in runs[1:]:
        extra.text = ""


def _separator_paragraph(page_break=False):
    """表格之间的分隔段落：高度压到最小，只为了让两张表不粘连。

    OOXML 要求相邻表格之间必须有段落，否则 Word 会把它们**当成同一张表**合并
    （实测：74 张表被读成 1 张）。

    `page_break=True` 时这个段落同时承担「下一页开始」的职责：
    分页必须写成**段落属性** `w:pageBreakBefore` —— 挂在表格行的 `w:trPr` 上
    Word 并不稳定识别（实测会多出空白页，个别地方还会失效）。
    字号 1 磅、行距固定 1 磅、段前段后 0，视觉上几乎不可见，但结构合法。
    """
    paragraph = OxmlElement("w:p")
    props = OxmlElement("w:pPr")

    if page_break:
        props.append(OxmlElement("w:pageBreakBefore"))

    spacing = OxmlElement("w:spacing")
    spacing.set(qn("w:before"), "0")
    spacing.set(qn("w:after"), "0")
    spacing.set(qn("w:line"), "20")      # 1 磅 = 20 缇
    spacing.set(qn("w:lineRule"), "exact")
    props.append(spacing)

    mark_props = OxmlElement("w:rPr")
    size = OxmlElement("w:sz")
    size.set(qn("w:val"), "2")           # 半磅为单位：2 = 1 磅
    mark_props.append(size)
    props.append(mark_props)

    paragraph.append(props)
    return paragraph


def _page_break_on_table_row(table_element):
    """给表格的第一行加「段前分页」，让表格从新页开始。

    为什么不用「插一个带 pageBreakBefore 的空段落」：段落本身要占一行高度，
    表格前后还各有间距，结果每张表后面都多出一整页空白（实测 74 张表排出 117 页）。
    把分页属性挂在表格首行的 w:trPr 上，首页从新页起、且不多占任何高度。
    """
    rows = table_element.findall(qn("w:tr"))
    if not rows:
        return
    first_row = rows[0]
    row_props = first_row.find(qn("w:trPr"))
    if row_props is None:
        row_props = OxmlElement("w:trPr")
        # trPr 必须是 tr 的第一个子元素，顺序错了 Word 会忽略整段属性
        first_row.insert(0, row_props)
    if row_props.find(qn("w:pageBreakBefore")) is None:
        row_props.append(OxmlElement("w:pageBreakBefore"))


def merge_reports(template, sources, out_path):
    """把 sources 里每份 docx 的第一张表按顺序拼进模板，返回合并的表数。"""
    template = Path(template)
    out_path = Path(out_path)
    if not template.is_file():
        raise RuntimeError("找不到模板：%s" % template)

    doc = Document(str(template))
    body = doc.element.body
    proto_title, _proto_table = _find_prototypes(body)
    section_props = body.find(qn("w:sectPr"))

    # 清空正文，只留 sectPr（页面尺寸、页边距都挂在它身上）。
    for element in list(body):
        if element.tag != qn("w:sectPr"):
            body.remove(element)

    def append(element):
        if section_props is not None:
            section_props.addprevious(element)
        else:
            body.append(element)

    if proto_title is not None:
        title = copy.deepcopy(proto_title)
        _set_paragraph_text(title, MERGED_TITLE)
        append(title)

    merged = 0
    for source in sources:
        source = Path(source)
        if not source.is_file():
            continue
        try:
            source_doc = Document(str(source))
        except Exception as error:  # 单个文件坏了不该毁掉整批
            print("WARN 跳过打不开的文件 %s：%s" % (source.name, error), file=sys.stderr)
            continue
        if not source_doc.tables:
            print("WARN 跳过没有表格的文件 %s" % source.name, file=sys.stderr)
            continue

        # 第 2 张表起，让表格本身从新页开始：一张表一页，任何一张都不跨页拆开。
        # 只取表格本身，丢掉每条报告自带的标题（标题只在最前面出现一次）。
        table = source_doc.tables[0]
        table_element = copy.deepcopy(table._tbl)
        if merged > 0:
            # 分隔段落同时负责分页：表格之间必须有段落（否则 Word 会并表），
            # 分页也必须写在段落上（挂在表格行上会多出空白页甚至失效）。
            append(_separator_paragraph(page_break=True))
        append(table_element)
        merged += 1

    if merged == 0:
        raise RuntimeError("没有任何可合并的用例表")

    out_path.parent.mkdir(parents=True, exist_ok=True)
    doc.save(str(out_path))
    return merged


def main(argv):
    template = ""
    out_path = ""
    sources = []
    index = 1
    while index < len(argv):
        token = argv[index]
        if token == "--template" and index + 1 < len(argv):
            template = argv[index + 1]
            index += 2
            continue
        if token == "--out" and index + 1 < len(argv):
            out_path = argv[index + 1]
            index += 2
            continue
        sources.append(token)
        index += 1

    if template == "" or out_path == "" or not sources:
        print("FAIL 用法：merge_reports.py --template <模板> --out <输出> <单条1.docx> [...]", file=sys.stderr)
        return 2

    try:
        count = merge_reports(template, sources, out_path)
    except Exception as error:
        print("FAIL %s" % error, file=sys.stderr)
        return 1
    print("OK %s %d" % (out_path, count))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))