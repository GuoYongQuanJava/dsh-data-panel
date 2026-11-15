"""Orchestrate a full test report from a template and a JSON payload.

.. code-block:: text

                           ┌─────────────┐
    results.json  ────────>│  schema.py   │── valid ──┐
                           └─────────────┘           │
                                                     ▼
    template.docx ─────────────────────────>  builder.py
                                                     │
                    ┌─────────────┐                  │
                    │  filler.py   │<── per table ───┤
                    └─────────────┘                  │
                                                     ▼
                                              report.docx
"""

from copy import deepcopy
from pathlib import Path
from typing import Any, Dict, List, Optional

from docx import Document
from docx.oxml.ns import qn

from filler import CHECK, fill_table, read_case_identity, set_cell_text  # noqa: F401
from schema import SchemaError, validate
from skill_meta import describe, load_skill
from toc_refresh import refresh_with_word


class BuilderError(RuntimeError):
    """Template is not well-formed enough to build from."""


# ───────────────────────────────────────────────
#  Element-by-element section construction
# ───────────────────────────────────────────────


def _make_paragraph(proto_p, text: str):
    """Clone ``proto_p``, keep its ``<w:pPr>``, and write ``text`` in the
    format of its first run."""
    new = deepcopy(proto_p)
    runs = new.findall(qn("w:r"))
    template_run = deepcopy(runs[0]) if runs else None
    for child in list(new):
        if child.tag != qn("w:pPr"):
            new.remove(child)
    if template_run is not None:
        for child in list(template_run):
            if child.tag != qn("w:rPr"):
                template_run.remove(child)
        node = template_run.makeelement(qn("w:t"), {})
        node.set(qn("xml:space"), "preserve")
        node.text = text
        template_run.append(node)
        new.append(template_run)
    return new


def _find_paragraph(doc: Document, style_name: str, min_text: str = ""):
    """Return the first paragraph element with *style_name* as its style
    whose text contains *min_text*."""
    for paragraph in doc.paragraphs:
        if paragraph.style.name != style_name:
            continue
        if min_text and min_text not in "".join(paragraph.text.split()):
            continue
        if paragraph.text.strip():
            return paragraph._p
    return None


# Placeholders a pre-cleaned template may use instead of sample text.  A
# template author can therefore blank the whole document and still keep the
# three prototype paragraphs addressable.
PLACEHOLDER_CASE_LABEL = "<CASE-ID>"
PLACEHOLDER_ISSUE_TEXT = "<ISSUE-TEXT>"


def _find_paragraph_any_style(doc: Document, *needles: str):
    """Return the first paragraph whose text contains any of *needles*,
    regardless of its style.  Used for placeholder lookup."""
    for paragraph in doc.paragraphs:
        flat = "".join(paragraph.text.split())
        if not flat:
            continue
        for needle in needles:
            if needle in flat:
                return paragraph._p
    return None


def _locate_prototypes(doc: Document) -> Dict[str, Any]:
    """Find the paragraphs and table the builder clones per module / case.

    Two template flavours are supported:

    * **pre-cleaned** — the sample rows were replaced by ``<CASE-ID>`` and
      ``<ISSUE-TEXT>`` placeholders.  Preferred: the template contains no
      sample data at all.
    * **sample-based** — the original client template, where the first
      ``….CTD`` row and a ``无。`` row serve as prototypes.
    """
    module_heading = _find_paragraph(doc, "编号标题3")
    sub_heading = _find_paragraph(doc, "编号标题4")
    general_heading = _find_paragraph(doc, "编号标题2")

    case_label = _find_paragraph_any_style(doc, PLACEHOLDER_CASE_LABEL)
    issue_para = _find_paragraph_any_style(doc, PLACEHOLDER_ISSUE_TEXT)

    if case_label is None:
        case_label = _find_paragraph(doc, "Normal", min_text=".CTD")
    if issue_para is None:
        issue_para = _find_paragraph(doc, "Normal", min_text="无。")

    return {
        "general_heading": general_heading,
        "module_heading": module_heading,
        "sub_heading": sub_heading,
        "case_label": case_label,
        "issue_para": issue_para,
    }


def _clear_toc_cache(doc: Document) -> int:
    """Drop the cached text of the table of contents.

    The template ships a TOC whose cached entries name the sample modules
    (RingBuffer / push / pickNew …).  Those names would survive into the
    output and describe modules that no longer exist.  We keep the field
    machinery (``fldChar`` / ``instrText``) but remove the cached ``<w:t>``
    runs, so Word rebuilds the list when it honours ``updateFields``.
    """
    cleared = 0
    for paragraph in doc.paragraphs:
        style = (paragraph.style.name or "").lower()
        if not style.startswith("toc"):
            continue
        for run in paragraph._p.findall(qn("w:r")):
            for node in run.findall(qn("w:t")):
                run.remove(node)
                cleared += 1
        # hyperlinked entries keep their text inside <w:hyperlink><w:r><w:t>
        for hyperlink in paragraph._p.findall(qn("w:hyperlink")):
            for run in hyperlink.findall(qn("w:r")):
                for node in run.findall(qn("w:t")):
                    run.remove(node)
                    cleared += 1
    return cleared


def _insert_before_sectpr(body, element):
    """Insert *element* just before the section properties so that the
    report ends with ``<w:sectPr>``."""
    sect_pr = body.find(qn("w:sectPr"))
    if sect_pr is not None:
        sect_pr.addprevious(element)
    else:
        body.append(element)


# ───────────────────────────────────────────────
#  Main builder
# ───────────────────────────────────────────────


def build(
    template_path: str,
    data: Dict[str, Any],
    out_path: str,
    skill_path: Optional[str] = None,
    refresh_toc: bool = True,
) -> Path:
    """Build the report and return the output path.

    *skill_path* points at a ``SKILL.md`` whose frontmatter (or role table)
    supplies the designers / reviewers / testers and module-level metadata.
    Values present in *data* win over the skill file.

    *refresh_toc* asks Word to rebuild the table of contents after saving, so
    the delivered document opens without Word prompting "update fields?".
    When Word is unavailable the ``updateFields`` flag is kept as a fallback.

    Raises
    ------
    SchemaError
        *data* does not conform.
    BuilderError
        The template cannot supply the necessary prototype elements.
    """
    skill = load_skill(skill_path)
    data = validate(data, skill)
    doc = Document(template_path)
    body = doc.element.body

    # ── locate prototype elements in the template ──
    proto = _locate_prototypes(doc)
    general_heading = proto["general_heading"]
    module_heading = proto["module_heading"]
    sub_heading = proto["sub_heading"]
    case_label = proto["case_label"]
    issue_para = proto["issue_para"]

    if general_heading is None:
        raise BuilderError(
            "模板缺少「编号标题2」段落（通用模块）—— 这是正文起点，不能被清空"
        )
    if module_heading is None:
        raise BuilderError("模板缺少「编号标题3」段落 —— 它是模块标题的格式原型")
    if sub_heading is None:
        raise BuilderError("模板缺少「编号标题4」段落 —— 它是小节标题的格式原型")
    if case_label is None:
        raise BuilderError(
            "模板缺少用例标识原型：既没有 <CASE-ID> 占位符，也没有 ....CTD 样例段落"
        )
    if issue_para is None:
        raise BuilderError(
            "模板缺少问题正文原型：既没有 <ISSUE-TEXT> 占位符，也没有「无。」样例段落"
        )

    if not doc.tables:
        raise BuilderError("模板没有至少一张表格作为原型")
    proto_table = doc.tables[0]._tbl
    if proto_table is None:
        raise BuilderError("无法读取模板第一张表格")

    # ── strip everything after "通用模块" ──
    removed = 0
    after = False
    for element in list(body):
        if after:
            if element.tag == qn("w:sectPr"):
                continue
            body.remove(element)
            removed += 1
        if element is general_heading:
            after = True

    # 模板目录页的空内容控件会显示“单击此处输入文字”，不能留在正式报告。
    for control in list(body.iter(qn("w:sdt"))):
        if control.find(".//" + qn("w:showingPlcHdr")) is not None:
            parent = control.getparent()
            if parent is not None:
                parent.remove(control)

    total = passed = not_run = 0
    modules: List[dict] = data["modules"]

    for module in modules:
        # Module heading
        _insert_before_sectpr(body, _make_paragraph(module_heading, module["name"]))
        _insert_before_sectpr(body, _make_paragraph(sub_heading, "测试结果总结"))

        module_cases = module["cases"]
        ok = sum(1 for c in module_cases if c.get("status", "passed") == "passed")
        bad = sum(1 for c in module_cases if c.get("status") == "failed")
        skipped = sum(1 for c in module_cases if c.get("status") == "notRun")
        unconfirmed = sum(1 for c in module_cases if c.get("status") == "unconfirmed")
        summary_line = f"共 {len(module_cases)} 条用例，通过 {ok} 条，未通过 {bad} 条"
        if skipped:
            summary_line += f"，未执行 {skipped} 条"
        if unconfirmed:
            summary_line += f"，未确认 {unconfirmed} 条"
        _insert_before_sectpr(body, _make_paragraph(issue_para, summary_line + "。"))

        # Cases
        for case in module_cases:
            _insert_before_sectpr(body, _make_paragraph(case_label, case["id"]))
            table_el = deepcopy(proto_table)

            from docx.table import Table

            table = Table(table_el, doc)
            success = fill_table(table, case, module=module)
            if not success:
                raise BuilderError(f"表格填充失败：{case['id']}")
            _insert_before_sectpr(body, table_el)

            total += 1
            status = case.get("status", "passed")
            if status == "passed":
                passed += 1
            elif status == "notRun":
                not_run += 1

        # Per-module notes
        _insert_before_sectpr(body, _make_paragraph(sub_heading, "遇到的问题"))
        _insert_before_sectpr(body, _make_paragraph(issue_para, module.get("issues", "未记录异常。")))
        _insert_before_sectpr(body, _make_paragraph(sub_heading, "与测试用例/规程的不一致"))
        _insert_before_sectpr(body, _make_paragraph(issue_para, module.get("inconsistent", "未核查。")))

    # ── clean the stale table of contents ──
    # The template's TOC still lists the sample modules; drop the cached text so
    # nothing stale survives, then let Word rebuild it (see below).
    cleared = _clear_toc_cache(doc)

    # Fallback: ask Word to refresh on open.  This is what makes Word prompt,
    # so it is only kept when the silent rebuild below is unavailable.
    settings = doc.settings.element
    if settings.find(qn("w:updateFields")) is None:
        node = settings.makeelement(qn("w:updateFields"), {})
        node.set(qn("w:val"), "true")
        settings.append(node)

    doc.save(out_path)

    # ── silent TOC rebuild ──
    # Word rebuilds the TOC *and* clears the updateFields flag when saving, so
    # the reader gets no "update fields?" prompt at all.
    toc_note = "updateFields（打开时需手动更新）"
    if refresh_toc:
        ok, detail = refresh_with_word(out_path)
        if ok:
            toc_note = f"已重建（{detail}）"
        else:
            toc_note = f"未重建，回退到 updateFields —— {detail}"

    print(
        f"modules={len(modules)}  cases={total}  passed={passed}  "
        f"failed={data['summary']['failed']}  notRun={not_run}  unconfirmed={data['summary']['unconfirmed']}  "
        f"removed={removed}  toc_cleared={cleared}"
    )
    print(f"目录：{toc_note}")
    if skill:
        print(f"skill={skill_path}  →  {describe(skill)}")
    return Path(out_path)
