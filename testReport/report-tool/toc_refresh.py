"""Refresh the table of contents via Word automation so the report opens
quietly, without Word asking "update fields?".

Why this exists
---------------
``python-docx`` cannot paginate, so a freshly built report carries a stale (or
emptied) TOC.  The usual workaround is ``<w:updateFields/>``, but Word then
asks the reader a question before showing the document — unacceptable in a
delivered report.

Word itself can do the job: open the file, rebuild the TOC, save.  Word also
drops the ``updateFields`` flag on save, so the next reader sees a finished
document and gets no prompt at all.

Only Windows + Microsoft Word are required.  When Word is unavailable the
caller keeps the ``updateFields`` fallback, which still produces a correct
document — it just asks the reader once.

Background
----------
The process is driven from PowerShell because ``pywin32`` is not part of the
bundled runtime, while COM automation works out of the box on Windows.
"""

import os
import subprocess
import tempfile
from pathlib import Path
from typing import Tuple

# Word's DisplayAlerts = 0 and WdUnits/WdSaveOptions constants are numeric in
# late binding, so no type library is needed.
SCRIPT = r"""
$ErrorActionPreference = 'Stop'
$path = '{path}'
$word = $null
$doc = $null
$presetRunning = $false
try {{
    $word = New-Object -ComObject Word.Application
    $presetRunning = ($word.Documents.Count -gt 0)
    $word.Visible = $false
    $word.DisplayAlerts = 0
    $word.Options.UpdateFieldsAtPrint = $false
    $doc = $word.Documents.Open($path, $false, $false, $false)
    $tocCount = $doc.TablesOfContents.Count
    for ($i = 1; $i -le $tocCount; $i++) {{
        $doc.TablesOfContents.Item($i).Update() | Out-Null
    }}
    $doc.Fields.Update() | Out-Null
    $doc.Save()
    $pages = $doc.ComputeStatistics(2)
    $doc.Close($false)
    $doc = $null
    Write-Output "OK toc=$tocCount pages=$pages"
}}
catch {{
    Write-Output "FAIL $($_.Exception.Message)"
    if ($doc -ne $null) {{ try {{ $doc.Close($false) }} catch {{}} }}
}}
finally {{
    if ($word -ne $null) {{
        # Only quit when we started the instance; never close a Word window
        # the user is already working in.
        if (-not $presetRunning) {{ try {{ $word.Quit() }} catch {{}} }}
        try {{ [void][System.Runtime.InteropServices.Marshal]::ReleaseComObject($word) }} catch {{}}
    }}
}}
"""


def _powershell() -> str:
    return os.environ.get("COMSPEC_POWERSHELL") or "powershell.exe"


def refresh_with_word(path: str, timeout: int = 180) -> Tuple[bool, str]:
    """Rebuild the TOC of *path* with Word.

    Returns ``(ok, message)``.  ``ok`` is False when Word is missing, the file
    is locked, or automation fails; callers should then fall back to the
    ``updateFields`` flag.
    """
    target = Path(path).resolve()
    if not target.is_file():
        return False, f"文件不存在：{target}"

    # PowerShell 5.1 reads a script file as ANSI unless it carries a UTF-8 BOM,
    # and report paths routinely contain Chinese characters.
    script = tempfile.NamedTemporaryFile(
        "w", suffix=".ps1", delete=False, encoding="utf-8-sig", newline="\r\n"
    )
    try:
        script.write(SCRIPT.format(path=str(target).replace("'", "''")))
        script.close()
        completed = subprocess.run(
            [
                _powershell(),
                "-NoProfile",
                "-NonInteractive",
                "-ExecutionPolicy",
                "Bypass",
                "-File",
                script.name,
            ],
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            timeout=timeout,
        )
    except subprocess.TimeoutExpired:
        return False, f"Word 刷新超时（{timeout}s）"
    except FileNotFoundError:
        return False, "找不到 powershell.exe"
    except OSError as exc:
        return False, f"无法启动 PowerShell：{exc}"
    finally:
        try:
            os.unlink(script.name)
        except OSError:
            pass

    output = (completed.stdout or "").strip()
    if completed.returncode == 0 and output.startswith("OK"):
        return True, output
    detail = output or (completed.stderr or "").strip() or f"退出码 {completed.returncode}"
    return False, detail


def word_available() -> bool:
    """Cheap probe: is Word registered as a COM server?"""
    try:
        import winreg

        with winreg.OpenKey(
            winreg.HKEY_CLASSES_ROOT, r"Word.Application\CLSID"
        ):
            return True
    except (ImportError, OSError):
        return False