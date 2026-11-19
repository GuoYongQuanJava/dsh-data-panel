"""圈复杂度分析：优先用本机装的 lizard，没有就用 testReport 自带的。

为什么不直接用 `import lizard`：
    客户机器不一定装过 lizard，而圈复杂度是报告表2的必备数据。所以包里带一份
    lizard 核心（testReport/vendor/lizard，约 700 KB），本机没装时自动降级使用。

vendored 副本的边界：
    - 已去掉 pathspec（只影响 gitignore 过滤）和 pygments（只影响 Erlang/F#/OCaml 解析）；
      对 C/C++/Java/C#/Python/JS 这些常用语言没有影响。
    - 实测：屏蔽 site-packages 后，仅靠 vendor 目录也能正常分析 C++。

命令行：
    python complexity.py <源码目录或项目根>
    python complexity.py <项目根> --json
"""
from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import List, Optional, Tuple

VENDOR_DIR = Path(__file__).resolve().parent.parent / "vendor" / "lizard"

# 常见源码子目录：项目根传进来时按顺序找第一个存在的
SOURCE_CANDIDATES = ("src", "source", "lib", "app", "include", "")

# 扫描源码时要跳过的目录：构建产物、工具/会话目录、依赖等
NOISE_DIRS = {
    'build', 'out', 'bin', 'obj', 'dist', 'target', 'lib64',
    '.git', '.dsh', '.vs', '.vscode', '.idea', '__pycache__', '.pytest_cache',
    'node_modules', 'vendor', 'third_party', 'thirdparty', 'external',
    'test-sessions', 'reports', 'runs', 'cmake-build-debug', 'cmake-build-release',
}

# 「测试代码」目录名与文件名特征：圈复杂度/注释率只统计被测源码，不统计测试
TEST_DIR_NAMES = {'test', 'tests', '__tests__', 'spec', 'specs', 'unittest', 'testing'}
TEST_STEM_PREFIXES = ('test_', 'tests_')          # test_generated.cpp / test_xxx.py
TEST_STEM_SUFFIXES = ('_test', '_tests', '_spec', 'Test', 'Tests', 'Spec')

# 当作「被测源码」的扩展名（其他文件不参与静态分析）
SOURCE_EXTS = {
    '.c', '.h', '.cc', '.cpp', '.cxx', '.hpp', '.hh', '.hxx', '.inl',
    '.cs', '.java', '.kt', '.scala', '.swift', '.m', '.mm',
    '.js', '.jsx', '.ts', '.tsx', '.go', '.rs', '.py', '.rb', '.php', '.lua',
}


def _iter_source_files(src: Path):
    """遍历源码目录，跳过构建产物/工具/会话目录。"""
    src = Path(src)
    for path in sorted(src.rglob('*')):
        if not path.is_file():
            continue
        rel_dirs = path.relative_to(src).parts[:-1]
        if any(part.lower() in NOISE_DIRS for part in rel_dirs):
            continue
        if path.suffix.lower() not in SOURCE_EXTS:
            continue
        if _is_test_file(path, src):
            continue
        yield path



def _is_test_file(path: Path, root: Path) -> bool:
    """判断是不是测试代码：tests/ 目录下的、test_xxx、xxx_test、*Test 这类。

    只看文件名/目录名，不猜内容；宁可漏排除也不误伤被测源码。
    """
    try:
        rel = path.relative_to(root)
    except ValueError:
        rel = path
    if any(part.lower() in TEST_DIR_NAMES for part in rel.parts[:-1]):
        return True
    stem = path.stem
    if stem.startswith(TEST_STEM_PREFIXES):
        return True
    return stem.endswith(TEST_STEM_SUFFIXES)


def resolve_project_root(root: Path, hints=None) -> Path:
    """把传入的目录收敛到真正要分析的那个工程。

    面板里的「项目」often 是工作区根（里面放好几个工程）。如果用例的 subjectFunction
    带相对路径（如 src/order.cpp），就找唯一一个包含这个相对路径的子目录当工程根。
    """
    root = Path(root)
    hints = [h for h in (hints or []) if h]
    if not hints or not root.is_dir():
        return root
    if any((root / h).is_file() for h in hints):
        return root   # 工作区根自己就对得上

    matches = []
    for child in root.iterdir():
        if not child.is_dir() or child.name.lower() in NOISE_DIRS:
            continue
        if child.name.lower() in TEST_DIR_NAMES:
            continue
        if any((child / h).is_file() for h in hints):
            matches.append(child)
    # 只有一个子工程对得上才收敛，多个就不猜
    return matches[0] if len(matches) == 1 else root
_lizard_module = None
_lizard_source = ""


def load_lizard() -> Tuple[Optional[object], str]:
    """返回 (lizard 模块, 来源标记)。

    来源：``system`` = 本机已安装；``vendored`` = 用 testReport 自带的；
    ``""`` = 都没有。
    """
    global _lizard_module, _lizard_source
    if _lizard_module is not None:
        return _lizard_module, _lizard_source

    try:
        import lizard  # noqa: F401
        _lizard_module, _lizard_source = lizard, "system"
        return _lizard_module, _lizard_source
    except ImportError:
        pass

    if VENDOR_DIR.is_dir():
        if str(VENDOR_DIR) not in sys.path:
            sys.path.insert(0, str(VENDOR_DIR))
        try:
            import lizard  # noqa: F811
            _lizard_module, _lizard_source = lizard, "vendored"
            return _lizard_module, _lizard_source
        except ImportError:
            pass

    return None, ""


def resolve_source_dir(project_dir: Path) -> Optional[Path]:
    """项目根 → 实际要分析的源码目录。"""
    project_dir = Path(project_dir)
    if not project_dir.is_dir():
        return None
    if project_dir.name in ("src", "source", "lib", "include"):
        return project_dir
    for name in SOURCE_CANDIDATES:
        candidate = project_dir / name if name else project_dir
        if candidate.is_dir():
            # 空目录不算
            if any(candidate.rglob("*")):
                return candidate
    return None


def analyze(project_dir: Path, hints=None) -> List[dict]:
    """分析一个项目，返回按复杂度降序的函数列表。

    每项：{function, file, complexity, nloc}
    无 lizard 或目录不存在时返回空列表（调用方据此写“未开展”，不编数字）。
    """
    lizard, _source = load_lizard()
    if lizard is None:
        return []
    project_dir = resolve_project_root(Path(project_dir), hints)
    src = resolve_source_dir(project_dir)
    if src is None:
        return []
    try:
        files = [str(p) for p in _iter_source_files(src)]
        if not files:
            return []
        items: List[dict] = []
        for file_info in lizard.analyze(files):
            for func in file_info.function_list:
                items.append({
                    "function": func.name,
                    "file": Path(file_info.filename).name,
                    "complexity": int(func.cyclomatic_complexity),
                    "nloc": int(func.nloc),
                })
        items.sort(key=lambda item: (-item["complexity"], item["function"]))
        return items
    except Exception:  # noqa: BLE001 — 分析失败不能拖垮报告
        return []


def main(argv: Optional[List[str]] = None) -> int:
    argv = list(sys.argv[1:] if argv is None else argv)
    as_json = "--json" in argv
    argv = [a for a in argv if a != "--json"]

    if not argv:
        print("用法：python complexity.py <源码目录或项目根> [--json]", file=sys.stderr)
        print(f"  lizard 来源：{load_lizard()[1] or '未找到（本机未安装且 vendor 缺失）'}", file=sys.stderr)
        return 2

    target = Path(argv[0])
    items = analyze(target)

    if as_json:
        print(json.dumps({
            "source": load_lizard()[1],
            "items": items,
        }, ensure_ascii=False, indent=2))
        return 0 if items else 1

    if not items:
        print(f"未获得圈复杂度数据：{target}")
        print(f"  lizard 来源：{load_lizard()[1] or '未找到（本机未安装且 vendor 缺失）'}")
        return 1

    print(f"lizard 来源：{load_lizard()[1]}")
    print(f"{'CC':>4}  {'函数':<40} {'行数':>5}  文件")
    print("-" * 78)
    for item in items:
        print(f"{item['complexity']:>4}  {item['function']:<40} {item['nloc']:>5}  {item['file']}")
    print("-" * 78)
    avg = sum(i["complexity"] for i in items) / len(items)
    print(f"{len(items)} 个函数，平均 CC={avg:.2f}，"
          f"最高 CC={max(i['complexity'] for i in items)}")
    return 0




# 语言 → 行注释符；支持块注释的都是 C 系
LINE_COMMENT = {
    '.c': '//', '.h': '//', '.cc': '//', '.cpp': '//', '.cxx': '//', '.hpp': '//',
    '.hh': '//', '.hxx': '//', '.cs': '//', '.java': '//', '.js': '//', '.jsx': '//',
    '.ts': '//', '.tsx': '//', '.go': '//', '.rs': '//', '.swift': '//', '.kt': '//',
    '.scala': '//', '.m': '//', '.mm': '//',
    '.py': '#', '.sh': '#', '.rb': '#', '.pl': '#', '.r': '#',
}
BLOCK_COMMENT_EXTS = {'.c', '.h', '.cc', '.cpp', '.cxx', '.hpp', '.hh', '.hxx',
                       '.cs', '.java', '.js', '.jsx', '.ts', '.tsx',
                       '.go', '.rs', '.swift', '.kt', '.scala', '.m', '.mm'}

def comment_ratio(project_dir: Path, hints=None) -> Optional[float]:
    """代码注释率（%）= 注释行 / (注释行 + 代码行) × 100。

    只统计源码目录下的已知语言（见 LINE_COMMENT）；空行不计入分母。
    目录不存在或没有可统计文件时返回 None（调用方写「未采集」，不编数字）。
    """
    project_dir = resolve_project_root(Path(project_dir), hints)
    src = resolve_source_dir(project_dir)
    if src is None:
        return None

    comment_lines = 0
    code_lines = 0
    for path in _iter_source_files(src):
        ext = path.suffix.lower()
        if ext not in LINE_COMMENT:
            continue
        try:
            text = path.read_text(encoding='utf-8', errors='replace')
        except OSError:
            continue
        marker = LINE_COMMENT[ext]
        supports_block = ext in BLOCK_COMMENT_EXTS
        in_block = False
        for raw in text.splitlines():
            line = raw.strip()
            if not line:
                continue
            if in_block:
                comment_lines += 1
                if '*/' in line:
                    in_block = False
                continue
            if supports_block and line.startswith('/*'):
                comment_lines += 1
                if '*/' not in line:
                    in_block = True
                continue
            if line.startswith(marker):
                comment_lines += 1
                continue
            code_lines += 1

    total = comment_lines + code_lines
    if total == 0:
        return None
    return round(comment_lines / total * 100, 1)


if __name__ == "__main__":
    sys.exit(main())
