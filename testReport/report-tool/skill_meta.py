"""Read the people fields (designer / reviewer / tester) from a DSH skill file.

Why this module exists
----------------------
Who designed, reviewed and executed a test procedure are attributes of the
**procedure**, not of one run's data: they are decided when the procedure is
set up and stay the same across every report that procedure produces.  So they
are recorded once, next to the skill that describes the procedure.

Everything else in the report — unit id, design trace, driver module, coverage
figures, issues — is technical output of an actual run and must come from the
execution data, never from this file.

A DSH skill file is a Markdown document whose YAML frontmatter only requires
``name`` and ``description``; additional keys are ignored by the loader, so we
can safely store the three people fields there.  Two read strategies are
supported, frontmatter first:

1. **frontmatter** — flat ``key: value`` lines::

       ---
       name: your-project-unit-test
       description: ...
       designer: 张伟
       reviewer: 刘洋
       tester: 王芳
       ---

2. **body table** — a Markdown table mapping role to name, which is what people
   usually write by hand::

       | 角色 | 姓名 |
       | --- | --- |
       | 设计者 | 张伟 |
       | 校对者 | 刘洋 |
       | 测试人员 | 王芳 |

Nothing here is mandatory: a missing or unparsable file yields no people, and
the report falls back to whatever the run data provides.
"""

import re
from pathlib import Path
from typing import Dict, Optional

# The three people fields a skill file may supply.
PERSON_FIELDS = ("designer", "reviewer", "tester")

# Keys we understand in the frontmatter.  Anything else is ignored.
FRONTMATTER_KEYS = {
    "designer": "designer",
    "设计者": "designer",
    "设计": "designer",
    "reviewer": "reviewer",
    "校对者": "reviewer",
    "校对": "reviewer",
    "审核者": "reviewer",
    "tester": "tester",
    "testers": "tester",
    "测试人员": "tester",
    "测试人": "tester",
}

# Body-table role label → internal field name
TABLE_ROLES = {
    "设计者": "designer",
    "设计": "designer",
    "校对者": "reviewer",
    "校对": "reviewer",
    "审核者": "reviewer",
    "测试人员": "tester",
    "测试人": "tester",
    "执行人": "tester",
    "测试执行人": "tester",
}

_FRONTMATTER = re.compile(r"\A---\s*\n(.*?)\n---\s*\n", re.DOTALL)
_TABLE_ROW = re.compile(r"^\s*\|(.+)\|\s*$")


def _parse_frontmatter(block: str) -> Dict[str, str]:
    """Parse flat ``key: value`` lines; nested blocks are ignored on purpose
    (a hand-written YAML subset beats pulling in a YAML dependency)."""
    out: Dict[str, str] = {}
    for raw_line in block.splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or ":" not in line:
            continue
        if raw_line[:1].isspace():
            # indented → belongs to a nested map we do not handle
            continue
        key, _, value = line.partition(":")
        key = key.strip().lower()
        value = value.strip().strip('"').strip("'")
        if not value:
            continue
        field = FRONTMATTER_KEYS.get(key)
        if field:
            out[field] = value
    return out


def _parse_table(body: str) -> Dict[str, str]:
    """Find ``| 角色 | 姓名 |`` rows and map the role label to a field."""
    out: Dict[str, str] = {}
    for line in body.splitlines():
        match = _TABLE_ROW.match(line)
        if not match:
            continue
        cells = [c.strip() for c in match.group(1).split("|")]
        if len(cells) < 2:
            continue
        role, name = cells[0], cells[1]
        if not role or not name:
            continue
        if set(role) <= set("-: "):
            continue
        field = TABLE_ROLES.get(role)
        if field and name and name not in ("姓名", "名字"):
            out.setdefault(field, name)
    return out


def load_skill(path: Optional[str]) -> Dict[str, str]:
    """Return the people declared by *path*.

    Result keys are a subset of ``{"designer", "reviewer", "tester"}``.  A
    missing file, a file without frontmatter, or a file that only declares
    ``name`` / ``description`` all yield ``{}``.
    """
    if not path:
        return {}
    file = Path(path)
    if file.is_dir():
        file = file / "SKILL.md"
    try:
        text = file.read_text(encoding="utf-8")
    except (OSError, UnicodeDecodeError):
        return {}

    meta: Dict[str, str] = {}
    match = _FRONTMATTER.match(text)
    if match:
        meta.update(_parse_frontmatter(match.group(1)))
        body = text[match.end():]
    else:
        body = text

    # the body table fills whatever the frontmatter did not declare
    for field, value in _parse_table(body).items():
        meta.setdefault(field, value)

    return meta


def person(meta: Dict[str, str], field: str) -> str:
    """Extract one people field (``designer`` / ``reviewer`` / ``tester``)."""
    return (meta or {}).get(field, "")


def tester_of(meta: Dict[str, str]) -> str:
    """Extract the tester name from a :func:`load_skill` result."""
    return person(meta, "tester")


def describe(meta: Dict[str, str]) -> str:
    """One-line summary for CLI output."""
    labels = {"designer": "设计者", "reviewer": "校对者", "tester": "测试人员"}
    parts = [f"{labels[f]}={meta[f]}" for f in PERSON_FIELDS if meta.get(f)]
    return "，".join(parts) if parts else "(skill 中未声明人员)"