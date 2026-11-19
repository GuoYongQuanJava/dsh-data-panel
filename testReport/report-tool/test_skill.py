"""项目配置文件解析的测试入口（v2）。

断言在 ``check_skill.py``：它以脚本形式逐条打印 PASS/FAIL，失败时 ``sys.exit(1)``。
直接 import 会终止测试收集，所以在子进程里跑，失败才能当成普通失败。

``python test_skill.py`` 打印同一份 PASS/FAIL 报告。
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