"""「测试范围与排除」必须单独成文，主报告只留摘要 + 附件路径。

验收点：
  1. 生成报告时同目录多出一份 `<报告名>-测试范围与排除.docx`；
  2. 该附件里保留完整的纳入/排除清单（含每个文件的排除理由与探针证据）；
  3. 主报告 3.4 节只写规模摘要 + 附件路径，不再展开逐文件明细；
  4. 本次没有范围清单时，报告仍如实写原因，不声称覆盖全工程。
"""

import json
import subprocess
import sys
from pathlib import Path

from docx import Document

HERE = Path(__file__).resolve().parent
BRIDGE = HERE / "bridge.py"
CMD = HERE / "cmd.py"
TEMPLATE = HERE.parent / "templates" / "单元测试报告模板.docx"


def _doc_text(path: Path) -> str:
    """把整份 docx（正文段落 + 表格单元格）拼成一段文本，便于断言。"""
    doc = Document(str(path))
    parts = [p.text for p in doc.paragraphs]
    for table in doc.tables:
        for row in table.rows:
            for cell in row.cells:
                parts.append(cell.text)
    return "\n".join(parts)


def _write_run(tmp_path, *, with_scope: bool):
    run_dir = tmp_path / "runs" / "run-1"
    snapshot = run_dir / "snapshot"
    snapshot.mkdir(parents=True)
    case = {
        "caseId": "BJ-PKG-ADD_LINE-T001.CTD",
        "sequence": "T001",
        "title": "addLine-边界测试",
        "testType": "boundary",
        "subjectFunction": "src/order.cpp::Order::addLine",
        "testFunc": "OrderAddLineTest.Zero",
        "description": "数量为 0 时抛异常",
        "inputVariables": [{"name": "quantity", "value": 0}],
        "expectedOutputs": [{"name": "exceptionType", "value": "std::invalid_argument"}],
    }
    (snapshot / "cases.json").write_text(
        json.dumps({"cases": [case]}, ensure_ascii=False), encoding="utf-8")
    result = {
        "runId": "run-1",
        "status": "passed",
        "startedAt": "2026-11-23T10:00:00Z",
        "finishedAt": "2026-11-23T10:00:02Z",
        "durationMs": 2000,
        "project": str(tmp_path / "project"),
        "cases": [case["caseId"]],
        "tests": [{
            "caseId": case["caseId"], "func": case["testFunc"], "outcome": "passed",
            "actualOutputs": [{"name": "exceptionType", "value": "std::invalid_argument"}],
        }],
    }
    if with_scope:
        result["testScope"] = {
            "status": "ok",
            "inventory": {
                "sourceRoots": ["src"],
                "files": [
                    {"path": "src/order.cpp", "status": "tested", "functions": [{"name": "addLine"}]},
                    {
                        "path": "src/legacy.cpp",
                        "status": "excluded",
                        "reason": "依赖第三方加密库，无法独立编译",
                        "proof": {"exitCode": 2, "logFile": "probe-legacy.log"},
                    },
                ],
            },
            "summary": {
                "scannedFiles": 2, "testedFiles": 1, "excludedFiles": 1,
                "declarationFiles": 0, "deferredFiles": 0,
                "declaredFunctions": 2, "linkedFunctions": 1,
            },
            "warnings": ["src/order.cpp 有 1 个函数未关联用例"],
        }
    (run_dir / "result.json").write_text(
        json.dumps(result, ensure_ascii=False), encoding="utf-8")
    return run_dir / "result.json"


def _build_report(tmp_path, run_result, *extra):
    proc = subprocess.run(
        [sys.executable, str(BRIDGE), "--run", str(run_result)],
        capture_output=True, text=True, encoding="utf-8", errors="replace")
    assert proc.returncode == 0, proc.stderr
    data = tmp_path / "reports" / "run-1" / "report-data.json"
    out = tmp_path / "reports" / "run-1" / "demo-测试报告.docx"
    proc = subprocess.run(
        [sys.executable, str(CMD), "--template", str(TEMPLATE), "--data", str(data), "-o", str(out), *extra],
        capture_output=True, text=True, encoding="utf-8", errors="replace")
    assert proc.returncode == 0, proc.stderr
    return out, proc


def test_scope_detail_goes_to_a_separate_document(tmp_path):
    run_result = _write_run(tmp_path, with_scope=True)
    report, proc = _build_report(tmp_path, run_result)

    # 附件放 attachments/ 子目录：与 report 同层会被面板误认成正式报告。
    scope_doc = report.parent / "attachments" / "demo-测试报告-测试范围与排除.docx"
    assert scope_doc.is_file(), "必须生成独立的范围与排除文档（attachments/ 下）"
    assert str(scope_doc) in proc.stdout, "命令行要回显附件路径，便于技能侧引用"

    # 附件保留完整证据。
    detail = _doc_text(scope_doc)
    assert "测试范围与排除" in detail
    assert "执行编号：run-1" in detail
    assert "本次扫描根：src" in detail
    assert "纳入测试的源码文件：src/order.cpp" in detail
    assert "src/legacy.cpp" in detail
    assert "依赖第三方加密库，无法独立编译" in detail
    assert "退出码 2" in detail and "probe-legacy.log" in detail
    assert "范围校验告警" in detail

    # 主报告只留摘要 + 路径。
    body = _doc_text(report)
    assert "测试范围与排除" in body
    assert "纳入测试 1 个，排除 1 个" in body
    assert "完整的测试范围与排除清单" in body
    assert "测试范围与排除.docx" in body
    # 逐文件明细（理由/探针证据/告警）不再出现在报告正文。
    assert "排除的源码文件（含理由与证据）" not in body
    assert "依赖第三方加密库，无法独立编译" not in body
    assert "probe-legacy.log" not in body


def test_scope_out_can_point_elsewhere(tmp_path):
    run_result = _write_run(tmp_path, with_scope=True)
    custom = tmp_path / "手动指定" / "范围说明.docx"
    report, proc = _build_report(tmp_path, run_result, "--scope-out", str(custom))
    assert custom.is_file()
    assert str(custom) in _doc_text(report), "报告里引用的必须是实际落盘路径"
    # 指定了位置就不再往 attachments/ 写默认文件。
    assert not (report.parent / "attachments" / "demo-测试报告-测试范围与排除.docx").exists()


def test_missing_scope_is_stated_honestly(tmp_path):
    run_result = _write_run(tmp_path, with_scope=False)
    report, _ = _build_report(tmp_path, run_result)
    body = _doc_text(report)
    assert "本次执行没有范围清单" in body
    assert "不能据此声称覆盖整个工程" in body
    # 不能出现任何编造的规模数字。
    assert "共扫描 0 个源码文件" not in body