"""环境自检：判断当前机器能不能跑通报告生成流程。

用法::

    python report-tool/doctor.py

逐项检查环境、文件、数据契约、Word 能力，最后给出结论。
每一项都是 ✅ / ⚠️ / ❌，⚠️ 表示可选能力缺失（不影响出报告）。

任何模型或人拿到这个包，第一步都该跑它。
"""

import importlib.util
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PKG = "测试报告生成"

results = []


def add(level, name, detail=""):
    results.append((level, name, detail))
    mark = {"ok": "✅", "warn": "⚠️ ", "bad": "❌"}[level]
    print(f"  {mark} {name}" + (f" — {detail}" if detail else ""))


# ── 1. Python ──────────────────────────────────────────────
print("\n[1/6] Python 解释器")
ver = sys.version_info
add(
    "ok" if ver >= (3, 10) else "bad",
    f"Python {ver.major}.{ver.minor}.{ver.micro}",
    f"{sys.executable}" + ("" if ver >= (3, 10) else "  ← 需要 3.10 或更高"),
)

# ── 2. python-docx ─────────────────────────────────────────
print("\n[2/6] 依赖库")
spec = importlib.util.find_spec("docx")
if spec is None:
    add("bad", "python-docx 未安装", "运行: pip install -r requirements.txt")
else:
    import docx

    version = getattr(docx, "__version__", "unknown")
    try:
        major, minor = (int(x) for x in str(version).split(".")[:2])
        ok = (major, minor) >= (1, 1)
    except ValueError:
        ok = True
    add(
        "ok" if ok else "bad",
        f"python-docx {version}",
        "" if ok else "需要 1.1 或更高，运行: pip install -U python-docx",
    )

# ── 3. 包内文件 ────────────────────────────────────────────
print("\n[3/6] 包内文件")
required = [
    "report-tool/cmd.py",
    "report-tool/verify_report.py",
    "templates/RingBuffer-test-blank.docx",
    "examples/auth-demo.json",
]
missing = [p for p in required if not (ROOT / p).is_file()]
if missing:
    add("bad", "缺少必需文件", ", ".join(missing))
else:
    add("ok", f"{len(required)} 个必需文件齐全", f"包根目录: {ROOT}")

# ── 4. 数据契约 ────────────────────────────────────────────
print("\n[4/6] 数据契约")
try:
    sys.path.insert(0, str(ROOT / "report-tool"))
    from schema import SchemaError, validate

    import json

    sample = ROOT / "examples" / "auth-demo.json"
    data = validate(json.loads(sample.read_text(encoding="utf-8")))
    add(
        "ok",
        "示例数据通过校验",
        f"{len(data['phases'])} 阶段 / "
        f"{sum(len(p['functions']) for p in data['phases'])} 函数 / "
        f"{data['summary']['total']} 用例",
    )
except SchemaError as exc:
    add("bad", "示例数据校验失败", str(exc))
except Exception as exc:  # noqa: BLE001
    add("bad", "数据契约加载失败", f"{type(exc).__name__}: {exc}")

# ── 5. 输出目录可写 ────────────────────────────────────────
print("\n[5/6] 输出能力")
probe = ROOT / ".write-probe"
try:
    probe.write_text("ok", encoding="utf-8")
    probe.unlink()
    add("ok", "包目录可写", str(ROOT))
except OSError as exc:
    add("bad", "包目录不可写", f"{exc}（换一个有写权限的目录解压）")

# ── 6. Microsoft Word ──────────────────────────────────────
print("\n[6/6] Microsoft Word（可选，用于自动重算目录）")
if sys.platform != "win32":
    add("warn", "非 Windows 平台，无法调用 Word", "目录会留空，打开时需手动更新域")
else:
    try:
        completed = subprocess.run(
            ["powershell", "-NoProfile", "-Command", "exit 0"],
            capture_output=True,
            timeout=20,
        )
        has_pwsh = completed.returncode == 0
    except Exception:  # noqa: BLE001
        has_pwsh = False
    if not has_pwsh:
        add("warn", "找不到 powershell.exe", "目录会留空，打开时需手动更新域")
    else:
        try:
            import winreg

            with winreg.OpenKey(winreg.HKEY_CLASSES_ROOT, r"Word.Application\CLSID"):
                pass
            add("ok", "检测到 Microsoft Word", "生成时会自动重算目录，打开无弹窗")
        except OSError:
            add("warn", "未安装 Microsoft Word", "目录会留空，打开时需手动更新域")

# ── 结论 ───────────────────────────────────────────────────
bad = [r for r in results if r[0] == "bad"]
warn = [r for r in results if r[0] == "warn"]

print("\n" + "=" * 60)
if bad:
    print(f"❌ 有 {len(bad)} 项阻塞问题，先解决这些再跑：")
    for _, name, detail in bad:
        print(f"   - {name}" + (f"：{detail}" if detail else ""))
    print("\n修好后重新运行: python report-tool/doctor.py")
    sys.exit(1)

print("✅ 环境可用，可以生成报告")
if warn:
    print(f"   （{len(warn)} 项可选能力缺失，不影响出报告）")
print("\n下一步：")
print("  python report-tool/cmd.py --template \"templates/单元测试报告模板.docx\" `")
print("         --data examples/auth-demo.json `")
print("         -o 示例报告.docx")
print()
print("（只有 templates/单元测试报告模板.docx 能出正式报告；")
print("  RingBuffer-test*.docx 是用例表原型，仅供原型参考，不要拿来出报告。）")
print("\n（Windows 命令换行用反引号 ` 而不是 \\）")
sys.exit(0)
