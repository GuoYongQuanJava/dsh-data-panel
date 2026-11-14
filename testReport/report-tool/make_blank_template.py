"""Build a blank version of the report template.

Strips every sample value while keeping the structural labels the generator
relies on (row titles, column headers, field prefixes).  Used to answer:
"can the template itself be pre-cleaned into an empty form?"
"""

import sys

from docx import Document
from docx.oxml.ns import qn

CHECK = "\ue000"


def set_cell(cell, text: str) -> None:
    """Replace cell content, keeping the first run's formatting."""
    paragraphs = cell.paragraphs
    template_run = None
    for p in paragraphs:
        if p.runs:
            template_run = p.runs[0]._r
            break
    for p in paragraphs[1:]:
        p._element.getparent().remove(p._element)
    paragraph = cell.paragraphs[0]
    for child in list(paragraph._p):
        if child.tag != qn("w:pPr"):
            paragraph._p.remove(child)
    if not text:
        return
    if template_run is not None:
        new = __import__("copy").deepcopy(template_run)
        for child in list(new):
            if child.tag != qn("w:rPr"):
                new.remove(child)
        node = new.makeelement(qn("w:t"), {})
        node.set(qn("xml:space"), "preserve")
        node.text = text
        new.append(node)
        paragraph._p.append(new)
    else:
        paragraph.add_run(text)


def set_paragraph(paragraph, text: str) -> None:
    """Replace a paragraph's text, keeping its style and run formatting."""
    template_run = None
    if paragraph.runs:
        template_run = paragraph.runs[0]._r
    for child in list(paragraph._p):
        if child.tag != qn("w:pPr"):
            paragraph._p.remove(child)
    if not text:
        return
    if template_run is not None:
        new = __import__("copy").deepcopy(template_run)
        for child in list(new):
            if child.tag != qn("w:rPr"):
                new.remove(child)
        node = new.makeelement(qn("w:t"), {})
        node.set(qn("xml:space"), "preserve")
        node.text = text
        new.append(node)
        paragraph._p.append(new)
    else:
        paragraph.add_run(text)


def clear_table(table) -> None:
    # row 0: keep "字段名：" prefixes, blank the values
    cell0 = table.rows[0].cells[0]
    paras = cell0.paragraphs
    labels = ["单元标识：", "设计追溯：", "功能描述：", "驱动模块：",
              "打桩模块：", "覆盖率记录：", "备注：本单元共有    个测试用例"]
    for i, label in enumerate(labels):
        if i < len(paras):
            for child in list(paras[i]._p):
                if child.tag != qn("w:pPr"):
                    paras[i]._p.remove(child)
            paras[i].add_run(label)

    # row 1: name + id
    set_cell(table.rows[1].cells[1], "")
    set_cell(table.rows[1].cells[7], "")

    # row 2: keep the five type options, uncheck all of them
    set_cell(table.rows[2].cells[0],
             "测试类型：□功能测试、□接口测试、□边界测试、□逻辑测试、□性能测试")

    # row 3: stub
    set_cell(table.rows[3].cells[0], "活动桩：")

    # row 4: description + inserted code
    set_cell(table.rows[4].cells[0], "测试说明：\n插入代码：")

    # rows 7..: leave exactly one empty variable row, delete the rest
    pass_row = None
    for idx, row in enumerate(table.rows):
        if "通过准则" in "".join(row.cells[0].text.split()):
            pass_row = idx
            break
    if pass_row is None:
        return
    # collapse to a single variable row
    for idx in range(pass_row - 1, 7, -1):
        tr = table.rows[idx]._tr
        tr.getparent().remove(tr)
    for col in (0, 3, 4, 8, 10):
        set_cell(table.rows[7].cells[col], "")

    # outcome block
    for idx, row in enumerate(table.rows):
        head = "".join(row.cells[0].text.split())
        if head == "异常现象描述":
            set_cell(row.cells[2], "")
            set_cell(row.cells[9], "")
        elif head == "设计者":
            set_cell(row.cells[2], "")
            set_cell(row.cells[9], "")
        elif head == "执行情况":
            set_cell(row.cells[2], "□ 执行  □ 未执行")
            set_cell(row.cells[9], "□ 通过    □ 未通过")
        elif head == "测试人员":
            set_cell(row.cells[2], "")
            set_cell(row.cells[9], "")


def main():
    src, dst = sys.argv[1], sys.argv[2]
    doc = Document(src)
    body = doc.element.body

    # keep only the first table as the prototype
    tbls = body.findall(qn("w:tbl"))
    for tbl in tbls[1:]:
        body.remove(tbl)

    # keep only the first module chapter: everything from the second
    # "编号标题3" onwards is sample scaffolding the builder rebuilds anyway
    module_headings = [
        p._p for p in doc.paragraphs if p.style.name == "编号标题3" and p.text.strip()
    ]
    if len(module_headings) > 1:
        cut_from = module_headings[1]
        removing = False
        for element in list(body):
            if element is cut_from:
                removing = True
            if removing and element.tag != qn("w:sectPr"):
                body.remove(element)

    # the surviving module heading is only a formatting prototype
    for p in doc.paragraphs:
        if p.style.name == "编号标题3" and p.text.strip():
            set_paragraph(p, "<MODULE-NAME>")
            break

    # blank the cached table of contents so no sample module name survives
    for p in doc.paragraphs:
        if (p.style.name or "").lower().startswith("toc"):
            for run in p._p.findall(qn("w:r")):
                for node in run.findall(qn("w:t")):
                    run.remove(node)
            for link in p._p.findall(qn("w:hyperlink")):
                for run in link.findall(qn("w:r")):
                    for node in run.findall(qn("w:t")):
                        run.remove(node)

    # Sample case labels and issue paragraphs double as prototypes for the
    # builder, so they must survive — but as explicit placeholders rather than
    # real data.
    seen_case = seen_issue = False
    for p in list(doc.paragraphs):
        flat = "".join(p.text.split())
        if not flat:
            continue
        if ".CTD" in flat:
            if seen_case:
                p._p.getparent().remove(p._p)
            else:
                seen_case = True
                set_paragraph(p, "<CASE-ID>")
        elif flat == "无。":
            if seen_issue:
                p._p.getparent().remove(p._p)
            else:
                seen_issue = True
                set_paragraph(p, "<ISSUE-TEXT>")

    clear_table(doc.tables[0])
    doc.save(dst)
    print(f"saved {dst}")


if __name__ == "__main__":
    main()