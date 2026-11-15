"""Skill-contract checks, exposed as a pytest test.

The assertions live in ``check_skill.py``: that script runs them at import time
and ends with ``sys.exit(1)`` when one fails, so importing it from pytest would
abort collection and hide every other test.  Running it in a subprocess keeps a
failure a normal test failure.

``python test_skill.py`` still prints the same PASS/FAIL report.
"""

import subprocess
import sys
from pathlib import Path

SCRIPT = Path(__file__).with_name("check_skill.py")


def _run():
    return subprocess.run(
        [sys.executable, str(SCRIPT)],
        cwd=str(SCRIPT.parent),
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
    )


def test_skill_contract():
    proc = _run()
    assert proc.returncode == 0, proc.stdout + "\n" + proc.stderr


if __name__ == "__main__":
    completed = subprocess.run([sys.executable, str(SCRIPT)], cwd=str(SCRIPT.parent))
    sys.exit(completed.returncode)