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


def analyze(project_dir: Path) -> List[dict]:
    """分析一个项目，返回按复杂度降序的函数列表。

    每项：{function, file, complexity, nloc}
    无 lizard 或目录不存在时返回空列表（调用方据此写“未开展”，不编数字）。
    """
    lizard, _source = load_lizard()
    if lizard is None:
        return []
    src = resolve_source_dir(project_dir)
    if src is None:
        return []
    try:
        items: List[dict] = []
        for file_info in lizard.analyze([str(src)]):
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


if __name__ == "__main__":
    sys.exit(main())