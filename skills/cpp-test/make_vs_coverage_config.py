"""生成项目级 VS CodeCoverage 配置：以工具自带完整配置为基础，只改过滤。

为什么不能手写配置：
    VS 旧版动态采集器有一批通信/采集开关，其中最关键的
    <AllowLowIntegrityProcesses>true</AllowLowIntegrityProcesses>
    一旦缺失或被改成 false，collect 仍然退出码 0，但只会写出 10 字节的空 .coverage，
    analyze 得到 <results/>，看起来像“采到了 0%”。必须保留工具自带设置。

本脚本做的事：
    1) 读取采集器同目录的 CodeCoverage.config（完整版）
    2) 只替换 <ModulePaths> 的 Include（限定本次测试的可执行文件）
    3) 只在 <Sources> 里追加/替换 Include（限定被测业务源码）
    4) 校验关键开关仍在，再写回项目

用法：
    python make_vs_coverage_config.py --project <项目根> \
        --binary-name test_generated.exe \
        --source-regex '.*[\\\\/]项目目录名[\\\\/]src[\\\\/].*\\\\.(cpp|hpp)$' \
        --tool-config "<VS>\\Team Tools\\Dynamic Code Coverage Tools\\CodeCoverage.config" \
        --out <项目根>\\testReport\\coverage.config
"""
from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

MUST_KEEP = (
    '<AllowLowIntegrityProcesses>true</AllowLowIntegrityProcesses>',
    '<CollectFromChildProcesses>true</CollectFromChildProcesses>',
)

# gtest / 标准库的源码路径里也有 \src\，所以调用方必须把项目目录名写进 source-regex，
# 否则 .*\src\.* 会把 googletest\src\gtest.cc 一起算进来。
DEFAULT_SOURCE_REGEX = r'.*[\\/]src[\\/].*\.(?:cpp|hpp|cxx|cc|h)$'


def build(tool_config: Path, module_re: str, source_re: str, timeout_ms: int | None) -> str:
    base = tool_config.read_text(encoding='utf-8-sig')

    module_block = (
        '<ModulePaths><Include>'
        f'<ModulePath>{module_re}</ModulePath>'
        '</Include></ModulePaths>'
    )
    if '<ModulePaths />' in base:
        base = base.replace('<ModulePaths />', module_block, 1)
    elif '<ModulePaths>' in base:
        base = re.sub(r'<ModulePaths>.*?</ModulePaths>', module_block, base, flags=re.S)
    else:
        raise SystemExit('工具配置里找不到 <ModulePaths> 段')

    include_block = f'<Include><Source>{source_re}</Source></Include>'
    if '<Include><Source>' in base:
        base = re.sub(r'<Include><Source>.*?</Source></Include>', include_block, base, flags=re.S, count=1)
    elif '</Sources>' in base:
        base = base.replace('</Sources>', f'{include_block}</Sources>', 1)
    else:
        raise SystemExit('工具配置里找不到 <Sources> 段')

    if timeout_ms is not None:
        base = re.sub(r'<CommunicationTimeout>\d+</CommunicationTimeout>',
                      f'<CommunicationTimeout>{timeout_ms}</CommunicationTimeout>', base, count=1)

    for must in MUST_KEEP:
        if must not in base:
            raise SystemExit(
                f'生成的配置缺少关键项：{must}\n'
                '  这会导致 collect 只产出 10 字节空报告；请勿改精简配置，'
                '应以工具自带 CodeCoverage.config 为基础。'
            )
    return base


def main() -> int:
    parser = argparse.ArgumentParser(description='生成项目级 VS CodeCoverage 配置')
    parser.add_argument('--project', required=True, help='项目根目录')
    parser.add_argument('--binary-name', required=True, help='测试可执行文件名，如 test_generated.exe')
    parser.add_argument('--source-regex', default=DEFAULT_SOURCE_REGEX,
                        help='业务源码路径正则；建议带上项目目录名，避免命中 googletest\\src')
    parser.add_argument('--tool-config', required=True,
                        help='采集器自带的 CodeCoverage.config 路径')
    parser.add_argument('--out', default='', help='输出路径，默认 <project>/testReport/coverage.config')
    parser.add_argument('--timeout-ms', type=int, default=None, help='可选：覆盖 CommunicationTimeout')
    args = parser.parse_args()

    tool_config = Path(args.tool_config)
    if not tool_config.is_file():
        print(f'错误：找不到工具自带配置 {tool_config}', file=sys.stderr)
        return 2

    module_re = '.*' + re.escape(args.binary_name) + '$'
    text = build(tool_config, module_re, args.source_regex, args.timeout_ms)

    out = Path(args.out) if args.out else Path(args.project) / 'testReport' / 'coverage.config'
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(text, encoding='utf-8')

    print(f'已生成 {out}')
    print(f'  ModulePath = {module_re}')
    print(f'  Source     = {args.source_regex}')
    print('  AllowLowIntegrityProcesses / CollectFromChildProcesses 已保留')
    return 0


if __name__ == '__main__':
    sys.exit(main())