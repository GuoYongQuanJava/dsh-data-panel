#!/usr/bin/env python3
"""Command-line entry point for the test-report builder.

Usage::

    python cmd.py \
        --template "RingBuffer-test(1).docx" \
        --data results.json \
        -o report.docx

If ``--data`` is ``-`` the tool reads JSON from stdin, which allows the
DSH host process to pipe execution results without writing a temp file.
"""

import argparse
import json
import sys
from pathlib import Path

from builder import BuilderError, build
from schema import SchemaError


def main(argv: list = None):
    parser = argparse.ArgumentParser(
        description="Fill a test-report template with execution results.",
    )
    parser.add_argument(
        "--template",
        required=True,
        type=Path,
        help="path to the client's template .docx file",
    )
    parser.add_argument(
        "--data",
        required=True,
        type=Path,
        help="path to the execution-results JSON, or '-' for stdin",
    )
    parser.add_argument(
        "--skill",
        default=None,
        type=Path,
        help="path to the procedure's SKILL.md (or its directory); supplies "
        "designer/reviewer/tester and module metadata",
    )
    parser.add_argument(
        "-o",
        "--out",
        default="report.docx",
        type=Path,
        help="output .docx path（默认 report.docx）",
    )
    parser.add_argument(
        "--no-toc-refresh",
        action="store_true",
        help="跳过用 Word 重建目录（默认开启；关闭后打开文档会提示更新域）",
    )

    args = parser.parse_args(argv)

    # ── read data ──
    # argparse converts "-" into a Path, so compare as text.
    if str(args.data) == "-":
        raw = sys.stdin.read()
    else:
        if not args.data.is_file():
            print(f"错误：找不到数据文件 {args.data}", file=sys.stderr)
            sys.exit(1)
        raw = args.data.read_text(encoding="utf-8")

    try:
        payload = json.loads(raw)
    except json.JSONDecodeError as exc:
        print(f"错误：JSON 解析失败 — {exc}", file=sys.stderr)
        sys.exit(1)

    # ── build ──
    try:
        out_path = build(
            template_path=str(args.template.resolve()),
            data=payload,
            out_path=str(args.out.resolve()),
            skill_path=str(args.skill) if args.skill else None,
            refresh_toc=not args.no_toc_refresh,
        )
        print(f"报告已生成：{out_path}")
    except SchemaError as exc:
        print(f"输入数据不符合约定：{exc}", file=sys.stderr)
        sys.exit(2)
    except BuilderError as exc:
        print(f"模板不可用：{exc}", file=sys.stderr)
        sys.exit(3)
    except PermissionError:
        print(
            f"无法写入 {args.out}：文件被占用。若它正在 Word/WPS 中打开，"
            "请先关闭再重试，或换一个输出文件名（-o）。",
            file=sys.stderr,
        )
        sys.exit(5)
    except Exception as exc:
        print(f"未预期的错误：{exc}", file=sys.stderr)
        sys.exit(4)


if __name__ == "__main__":
    main()