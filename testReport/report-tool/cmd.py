#!/usr/bin/env python3
"""Command-line entry point for the test-report builder.

Usage::

    python cmd.py \
        --template "单元测试报告模板.docx" \
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


def _force_utf8_output() -> None:
    """强制 stdout/stderr 用 UTF-8。

    中文 Windows 下 stdout/stderr 被管道接住时默认用 cp936，调用方按 UTF-8
    解码就会报 UnicodeDecodeError（表现为 stderr 变成 None，直接看不清诊断信息）。
    """
    for stream in (sys.stdin, sys.stdout, sys.stderr):
        try:
            stream.reconfigure(encoding="utf-8", errors="replace")
        except Exception:
            pass

from config_file import load_key_values as _load_key_values  # 与 bridge 共用一份解析实现

def main(argv: list = None):
    _force_utf8_output()
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
        help="（已废弃）旧版从 SKILL.md 读人员；v2 数据自包含，本参数不生效，仅为兼容旧调用保留",
    )
    parser.add_argument(
        "--config",
        default=None,
        type=Path,
        help="项目配置文件（testReport/skills/<工作区>.md）；补充 meta 中缺失的软件信息与人员",
    )
    parser.add_argument(
        "--notes",
        default=None,
        type=Path,
        help="模型分析 report-notes.json；合并 overallAssessment/environmentImpact/improvements/issues/consistency",
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


    # ── 合并项目配置（只补 meta 中缺失的值）──
    if args.config:
        if not args.config.is_file():
            print(f"错误：找不到项目配置文件 {args.config}", file=sys.stderr)
            sys.exit(1)
        cfg = _load_key_values(args.config)
        meta = payload.setdefault("meta", {})
        mapping = {
            "projectName": None,  # project 需要拼“单元测试”，单独处理
            "projectPackage": "projectPackage",
            "softwareVersion": "softwareVersion",
            "devUnit": "devUnit",
            "importance": "importance",
            "language": "language",
        }
        for ckey, mkey in mapping.items():
            if not mkey:
                continue
            val = (cfg.get(ckey) or "").strip()
            cur = str(meta.get(mkey) or "").strip()
            if val and (not cur or cur in ("未配置", "未提供")):
                meta[mkey] = val
        name = (cfg.get("projectName") or "").strip()
        if name and (not str(meta.get("project") or "").strip() or meta.get("project", "").endswith("单元测试") and "未记录" in str(meta.get("project"))):
            meta["project"] = name + " 单元测试"
        refs = meta.get("references")
        if not refs:
            meta["references"] = [
                {"type": "需求文档", "name": cfg.get("reqDocName") or "", "version": cfg.get("reqDocVersion") or ""},
                {"type": "设计文档", "name": cfg.get("designDocName") or "", "version": cfg.get("designDocVersion") or ""},
            ]
        ppl = meta.get("people") or {}
        for k in ("designer", "reviewer", "tester"):
            if (cfg.get(k) or "").strip() and not str(ppl.get(k) or "").strip():
                ppl[k] = cfg[k].strip()
        meta["people"] = ppl

    # ── 合并模型分析（report-notes.json）──
    if args.notes:
        if not args.notes.is_file():
            print(f"错误：找不到分析文件 {args.notes}", file=sys.stderr)
            sys.exit(1)
        try:
            notes = json.loads(args.notes.read_text(encoding="utf-8-sig"))
        except json.JSONDecodeError as exc:
            print(f"错误：分析文件 JSON 解析失败 — {exc}", file=sys.stderr)
            sys.exit(1)
        if isinstance(notes, dict):
            for key in ("overallAssessment", "environmentImpact", "improvements"):
                if notes.get(key) and not payload.get(key):
                    payload[key] = notes[key]
            for key in ("issues", "consistency"):
                if notes.get(key) and not payload.get(key):
                    payload[key] = notes[key]
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