"""项目配置文件的解析（v2）。

v2 起，软件名称/版本/研制单位/重要度/人员/引用文档不再从项目专属 SKILL.md 的
frontmatter 读取，而是从**项目配置文件**读取：

    <项目根>/testReport/skills/<工作区名>.md

同时兼容两种写法，方便客户手写：

    ---
    projectName: 某软件
    ---

    ## 基本信息
    - projectName: 某软件

规则：
- `#` 开头的行是注释，跳过；
- 没有冒号的行（例如 `## 小标题`、`<!-- 注释 -->`）跳过；
- 列表前缀 `- ` / `* ` 会被去掉；
- 值两端的单双引号会被去掉；
- **同一个键只取第一次出现的值**（前文优先，避免正文里的示例覆盖顶部声明）。
"""
from __future__ import annotations

from pathlib import Path
from typing import Dict, Optional, Union


def load_key_values(path: Optional[Union[str, Path]]) -> Dict[str, str]:
    """读取项目配置文件，返回 ``{键: 值}``。

    文件不存在、读不了或内容为空时返回空字典（调用方据此显示"未提供/未配置"，
    而不是编造一份默认值）。
    """
    if path is None:
        return {}
    file_path = Path(path)
    if not file_path.is_file():
        return {}
    try:
        raw = file_path.read_text(encoding="utf-8-sig")
    except OSError:
        return {}

    out: Dict[str, str] = {}
    for line in raw.splitlines():
        text = line.strip()
        if not text or text.startswith("#") or text in ("---", "..."):
            continue
        if text.startswith("- ") or text.startswith("* "):
            text = text[2:].strip()
        if ":" not in text:
            continue
        key, _, value = text.partition(":")
        key = key.strip()
        value = value.strip().strip('"').strip("'").strip()
        if key and key not in out:
            out[key] = value
    return out


def as_int(value: str, default: int = 0) -> int:
    """把配置里的数字安全转成 int（非法时返回默认值）。"""
    try:
        return int(str(value).strip())
    except (TypeError, ValueError):
        return default