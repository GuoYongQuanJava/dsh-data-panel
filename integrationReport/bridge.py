# -*- coding: utf-8 -*-
"""bridge.py（集成测试）：把「某一次真实执行」转换成报告生成器需要的 data 结构。

与单元测试的 `testReport/report-tool/bridge.py` 是**同一种分工**，但数据模型完全不同
（集成测试是 steps[]，单元测试是 tests[]，详见 SKILL.md「两套报告绝不能混用」）。

职责边界（照单元测试的原则）
============================
1. **只做数据转换**：读 steps / 快照 / 执行证据 → 组装 data → 写中间产物。
   填表、合并单元格、勾选框、排版**全部交给 integration_report.py**，本脚本不碰。
2. **不重跑测试**：只消费 `--run` 指定的那一次执行结果，保证报告与日志是同一件事。
3. **不信「整体通过」**：逐步骤结论只来自该步骤自己的证据；找不到证据就标 notRun /
   未确认，绝不用整体状态推断它通过。
4. **不编造数据**：没有的信息留空或写「未采集」，不猜。

产出两份中间产物（与单元测试对齐）
==================================
```
<会话>/integration/reports/<runId>/
    report-plan.json   ← 报告编排计划：阶段划分 + 每个阶段的功能项
    report-data.json   ← 喂给生成器的完整数据（meta / people / stages）
    整项目-<版本>.docx  ← 由 integration_report.build_full() 生成
    cases/*.docx        ← 由 integration_report.build_single_step() 生成
```

`report-plan.json` 为什么要存在（照单元测试的做法）：报告结构一旦出问题
（阶段分错、章节少了一章），只有最终 docx 很难倒查。有了计划文件可以逐项核对，
而且**阶段划分要稳定**——同一次执行重复生成报告，阶段不能每次都不一样。

用法
====
```
python bridge.py --session-root <会话>/integration \\
                 --run-id run_20261120_1020_all \\
                 --project-code JYSG \\
                 [--source DM|SRS] \\
                 [--software-name ...] [--software-version ...] \\
                 [--template <模板路径>] \\
                 [--no-docx]          # 只产出两份 json，不生成 docx
```

只给 `--session-root` 和 `--run-id` 就能跑，其余从磁盘上已有的数据推断。
"""

from __future__ import annotations

import argparse
import importlib.util
import json
import os
import random
import re
import sys
from datetime import datetime, timezone
from pathlib import Path
from xml.etree import ElementTree as ET

# 集成测试的测试类型 → 报告里的中文名（与 SKILL.md 的 7 类枚举一致）
TYPE_LABELS = {
    "functional": "功能测试",
    "performance": "性能测试",
    "boundary": "边界测试",
    "api": "接口测试",
    "stress": "强度测试",
    "security": "安全性测试",
    "margin": "余量测试",
}

# 结论映射：执行结果 → 报告里「结论」列的文字
OUTCOME_CONCLUSION = {
    "passed": "通过",
    "failed": "未通过",
    "error": "未通过",
    "notRun": "未执行",
    "unconfirmed": "未确认",
}

# 执行通道说明（报告备注里会用到）
CHANNEL_TEXT = {
    "runner": "测试代码执行",
    "cua": "CUA 桌面交互",
}

DEFAULT_PEOPLE = "admin"

# ─────────────────────────────────────────────────────────────
#  真实值判定：识别并拒绝「固定话术」式的假观察
# ─────────────────────────────────────────────────────────────

# 这些是「断言通过/失败」的通用描述，**不含任何真实数据**。
# 报告要的是「读到了什么」，不是「断言结果如何」—— 后者已经由结论列表达。
#
# 2026-11-24 实测事故：模型自写的一次性转换脚本把 243 步里的 180 步
# `observed` 全写成「断言全部通过（接口返回与落库字段均符合预期）」，
# 报告「实际测试结果」列于是 180 行一模一样，验收方无法判断测了什么。
_boilerplate_patterns = (
    r"^断言全部通过",
    r"^断言未通过[：:]\s*$",
    r"断言?结果(?:与预期)?(?:一致|不符|不符合|符合预期)",
    r"^与预期(?:一致|不符|不符合)",
    r"^实际结果与预期(?:结果)?(?:一致|不符|不符合)",
    r"^符合预期$",
    r"^测试通过$",
    r"^通过$",
    r"^未记录实际值$",
    r"^实际与预期不符$",
    r"^实际结果与预期不符$",
    r"^执行成功$",
    r"^无异常$",
    r"^一切正常$",
)


def is_boilerplate_observed(text: str) -> bool:
    """判断一段 `observed` 是不是「不含真实数据的固定话术」。

    只做两件事：命中白名单话术、或整段没有任何 ASCII 可见内容以外的
    字段/数值线索时，视为无效。宁可留空（显示「未记录实际值」），
    也不让套话冒充实际结果 —— 留空至少能暴露问题，套话会掩盖问题。
    """
    value = str(text or "").strip()
    if value == "":
        return False  # 空值由调用方单独处理
    for pattern in _boilerplate_patterns:
        if re.search(pattern, value):
            return True
    return False


def first_line(text) -> str:
    """取多行文本的第一行非空内容（断言消息常带堆栈，只取首行）。"""
    for line in str(text or "").splitlines():
        stripped = line.strip()
        if stripped:
            return stripped
    return ""


_STEP_NO_IN_FUNC = re.compile(r"step[_-]?(\d+)\s*$", re.IGNORECASE)


def step_no_from_func(func: str):
    """从测试函数名反推步骤号：`test_v0_0_1_it003_step2` → 2。

    `assets/run_tests.py` 的 `tests[]` 只有 `func`，没有 `stepNo`；
    而 bridge 的定位键是 `caseId|stepNo`。不反推的话所有步骤都会
    取到 `None` 挤到同一个键上（就是 SKILL 里记的那个「173 步只剩 74 条证据」的坑）。
    """
    match = _STEP_NO_IN_FUNC.search(str(func or "").strip())
    if match:
        return int(match.group(1))
    return None


# ─────────────────────────────────────────────────────────────
#  读盘
# ─────────────────────────────────────────────────────────────


def read_json(path: Path, fallback=None):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return fallback if fallback is not None else {}


def find_step_version_dir(session_root: Path, step_version: str = "") -> Path:
    """定位步骤版本目录。

    不指定版本时取 `step-versions/index.json` 里的 activeVersion；
    再不行就取字典序最大的那个（最新）。
    """
    step_root = session_root / "step-versions"
    if step_version:
        candidate = step_root / step_version.replace(".", "_")
        if candidate.is_dir():
            return candidate
        raise SystemExit("找不到步骤版本目录：%s" % candidate)

    index = read_json(step_root / "index.json", {})
    active = str(index.get("activeVersion") or "")
    if active:
        candidate = step_root / active.replace(".", "_")
        if candidate.is_dir():
            return candidate

    dirs = [p for p in step_root.glob("V*") if p.is_dir()] if step_root.is_dir() else []
    if not dirs:
        raise SystemExit("找不到任何步骤版本：%s" % step_root)
    return sorted(dirs, key=lambda p: p.name)[-1]


def load_steps(session_root: Path, step_version: str = "") -> tuple:
    """读步骤版本的全部输入，返回 (steps_doc, snapshot, step_version_name)。"""
    vdir = find_step_version_dir(session_root, step_version)
    version_name = vdir.name.replace("_", ".")

    steps_doc = read_json(vdir / "steps.json", {})
    snapshot = read_json(vdir / "cases.snapshot.json", {})

    if not steps_doc:
        raise SystemExit("步骤文件缺失或为空：%s" % (vdir / "steps.json"))
    if not snapshot:
        raise SystemExit("用例快照缺失或为空：%s" % (vdir / "cases.snapshot.json"))

    return steps_doc, snapshot, version_name


def load_run(run_dir: Path) -> tuple:
    """读一次执行的结果与观察记录。

    ★ 顺带读 `junit.xml` / `run.log` 里的 `ACTUAL[...]` 标记作为**补充证据**：
      `assets/run_tests.py` 会把测试代码打印的 `ACTUAL[<caseId>]: <值>`
      收进 `result.json` 的 `tests[].actual` 与 `tests[].actualOutputs`，
      但**只有走 runner 那条链路时才有**；模型自己拼 result.json 时常常丢掉。
      真实输出已经在日志里时，从日志捞一遍比重跑测试便宜得多。
    """
    result = read_json(run_dir / "result.json", {})
    observations = read_json(run_dir / "observations.json", {})
    if not result:
        raise SystemExit("执行结果缺失或为空：%s" % (run_dir / "result.json"))

    actuals = collect_actuals(run_dir)
    if actuals:
        result = dict(result)
        result["_actuals"] = actuals
    return result, observations


# 测试代码约定打印 `ACTUAL[<caseId>]: <值>` / `ACTUAL[<func>]: <值>`
_ACTUAL_LINE = re.compile(r"ACTUAL\[([^\]]+)\]\s*[:：]\s*(.+)$")


def read_log_text(path: Path) -> str:
    """读日志文本，自动识别编码。

    ★ 踩过的坑：`run_tests.py` 在 Windows 上写出的 `run.log` 是 **UTF-16LE**
      （带 BOM），直接用 `utf-8` 读会得到满屏 `F . . . .` 的乱码 ——
      看起来像「日志里没有真实输出」，实际是编码没认对。
    """
    if not path.is_file():
        return ""
    try:
        raw = path.read_bytes()
    except Exception:
        return ""
    if raw[:2] in (b"\xff\xfe", b"\xfe\xff"):
        try:
            return raw.decode("utf-16")
        except Exception:
            pass
    if raw[:3] == b"\xef\xbb\xbf":
        try:
            return raw.decode("utf-8-sig")
        except Exception:
            pass
    for encoding in ("utf-8", "gbk"):
        try:
            return raw.decode(encoding)
        except Exception:
            continue
    return raw.decode("utf-8", errors="replace")


def collect_actuals(run_dir: Path) -> dict:
    """从本次执行的日志与 junit 里收集 `ACTUAL[<key>]: <值>`。

    返回 `{ key: 值 }`，key 可以是 `caseId`、`caseId|stepNo` 或测试函数名。
    这条路径**只做补充**：`result.json` 里已经有 `actual` 时以它为准。
    """
    found = {}

    # ① run.log（就是测试进程的完整 stdout）
    text = read_log_text(run_dir / "run.log")
    for line in text.splitlines():
        match = _ACTUAL_LINE.search(line)
        if not match:
            continue
        key = match.group(1).strip()
        value = match.group(2).strip()
        if key and value:
            found[key] = value

    # ② junit.xml 的 failure/error 正文里也可能有（pytest -s 之外的场景）
    junit_path = run_dir / "junit.xml"
    if junit_path.is_file():
        try:
            tree = ET.parse(junit_path)
            for case in tree.iter("testcase"):
                name = (case.get("name") or "").strip()
                for child in case:
                    for line in (child.text or "").splitlines():
                        match = _ACTUAL_LINE.search(line)
                        if not match:
                            continue
                        key = match.group(1).strip()
                        value = match.group(2).strip()
                        if key and value:
                            found.setdefault(key, value)
                        elif name and value:
                            found.setdefault(name, value)
        except Exception:
            pass

    return found


# ─────────────────────────────────────────────────────────────
#  软件信息自动探测（软件规模 / 编程语言 / 开发环境 / 运行环境）
# ─────────────────────────────────────────────────────────────

# 为什么要有这一段（2026-11-24 实测事故）：
#   `meta` 里那几个字段原本只能靠 `--software-scale` / `--language` /
#   `--dev-env` / `--run-env` 显式传入，Skill 的调用示例又没列这几个参数，
#   于是模型每次照抄示例 → 报告表头「软件规模/编程语言/开发环境/运行环境」
#   四格全是「未采集」。
#
#   但**这些信息本来就在被测项目里**：`package.json` / `*.csproj` /
#   `requirements.txt` / `.csproj` 的 TargetFramework 就是现成的答案。
#   用户的原话：「正常来说读取代码后这几个信息应该都可以读到吧」——
#   是的，所以这里改成自动探测，探测不到才退回命令行参数。
#
# 原则：**只报能证实的东西**。探测不到就留空（显示「未采集」），
# 绝不猜测版本号或编造环境描述。

# 语言识别：扩展名 → 语言名
_LANG_BY_SUFFIX = {
    ".cs": "C#",
    ".java": "Java",
    ".py": "Python",
    ".ts": "TypeScript",
    ".tsx": "TypeScript",
    ".js": "JavaScript",
    ".jsx": "JavaScript",
    ".go": "Go",
    ".rs": "Rust",
    ".cpp": "C++",
    ".cc": "C++",
    ".c": "C",
    ".kt": "Kotlin",
    ".swift": "Swift",
    ".php": "PHP",
    ".rb": "Ruby",
    ".vue": "Vue",
}

# 扫描时要跳过的目录（依赖、构建产物、版本库）
_SKIP_DIRS = {
    "node_modules", ".git", ".svn", "bin", "obj", "dist", "build",
    "target", "out", ".venv", "venv", "__pycache__", ".dsh", ".next",
    "coverage", ".idea", ".vs", "packages", "vendor",
}

# 统计规模时最多扫多少个源文件（防止大仓库卡住）
_MAX_SCAN_FILES = 4000


def detect_languages(project_root: Path):
    """按源码文件数量识别编程语言，返回 [(语言, 文件数), ...] 降序。"""
    if not project_root or not project_root.is_dir():
        return []
    counts = {}
    scanned = 0
    for dirpath, dirnames, filenames in os.walk(project_root):
        dirnames[:] = [d for d in dirnames if d not in _SKIP_DIRS]
        for name in filenames:
            suffix = Path(name).suffix.lower()
            language = _LANG_BY_SUFFIX.get(suffix)
            if not language:
                continue
            counts[language] = counts.get(language, 0) + 1
            scanned += 1
        if scanned >= _MAX_SCAN_FILES:
            break
    return sorted(counts.items(), key=lambda kv: kv[1], reverse=True)


def detect_scale(project_root: Path, languages) -> str:
    """软件规模：按真实文件统计，不写形容词。

    能算的才算：源码文件数、（若有）后端 Controller/Service 个数。
    算不出来就返回空串，让 meta 显示「未采集」。
    """
    if not project_root or not project_root.is_dir():
        return ""
    if not languages:
        return ""

    total = sum(count for _, count in languages)
    parts = ["源码文件 %d 个" % total]

    # 后端分层计数（.NET / Java 常见命名），只在真扫到对应文件时才写
    layers = []
    for pattern, label in (
        ("*Controller.cs", "Controller"),
        ("*Service.cs", "Service"),
        ("*Repository.cs", "Repository"),
    ):
        hits = []
        for path in project_root.rglob(pattern):
            if any(part in _SKIP_DIRS for part in path.parts):
                continue
            hits.append(path)
            if len(hits) > 500:
                break
        if hits:
            layers.append("%d 个 %s" % (len(hits), label))
    if layers:
        parts.append("后端 " + "、".join(layers))

    return "；".join(parts)


def _find_first(project_root: Path, name: str):
    """在项目里找第一个匹配的文件（跳过依赖/构建目录）。找不到返回 None。"""
    if not project_root or not project_root.is_dir():
        return None
    for path in project_root.rglob(name):
        if any(part in _SKIP_DIRS for part in path.parts):
            continue
        if path.is_file():
            return path
    return None


def detect_dev_env(project_root: Path) -> str:
    """开发环境：从项目配置里读出真实的 SDK / 运行时版本。

    只从**项目自身配置文件**取：`*.csproj` 的 TargetFramework、
    `package.json` 的 engines、`.nvmrc`、`pyproject.toml`、`global.json`。
    取不到就不写。

    ★ 配置文件常在子目录里（如 `node端/package.json`、`api/xxx.csproj`），
      所以**必须递归找**，不能只看项目根 —— 只看根会让前端/后端版本全丢。
    """
    if not project_root or not project_root.is_dir():
        return ""
    found = []

    # .NET：TargetFramework（如 net10.0）
    frameworks = set()
    for path in project_root.rglob("*.csproj"):
        if any(part in _SKIP_DIRS for part in path.parts):
            continue
        try:
            text = path.read_text(encoding="utf-8", errors="replace")
        except Exception:
            continue
        for match in re.finditer(r"<TargetFrameworks?>([^<]+)</TargetFrameworks?>", text):
            for item in match.group(1).split(";"):
                item = item.strip()
                if item:
                    frameworks.add(item)
        if len(frameworks) >= 4:
            break
    if frameworks:
        found.append(".NET " + " / ".join(sorted(frameworks)))

    # Node：package.json 的 engines.node，其次 .nvmrc
    node_versions = []
    for path in project_root.rglob("package.json"):
        if any(part in _SKIP_DIRS for part in path.parts):
            continue
        try:
            pkg = json.loads(path.read_text(encoding="utf-8"))
        except Exception:
            continue
        node_version = str((pkg.get("engines") or {}).get("node") or "").strip()
        if node_version and node_version not in node_versions:
            node_versions.append(node_version)
    if node_versions:
        found.append("Node " + " / ".join(node_versions))
    else:
        nvmrc = _find_first(project_root, ".nvmrc")
        if nvmrc is not None:
            try:
                value = nvmrc.read_text(encoding="utf-8").strip()
                if value:
                    found.append("Node %s" % value)
            except Exception:
                pass

    # Python：pyproject 的 requires-python，其次 requirements.txt 的实际内容
    pyproject = _find_first(project_root, "pyproject.toml")
    if pyproject is not None:
        try:
            text = pyproject.read_text(encoding="utf-8", errors="replace")
            match = re.search(r'requires-python\s*=\s*"([^"]+)"', text)
            if match:
                found.append("Python %s" % match.group(1))
        except Exception:
            pass

    # 前端框架：从 package.json 的 dependencies 取**主框架**版本（只取认识的那几个）
    # 没有 `engines.node` 的项目很多，但 `dependencies.vue` 一定在 —— 这是能证实的。
    framework_keys = (
        ("vue", "Vue"), ("react", "React"), ("@angular/core", "Angular"),
        ("uni-app", "uni-app"), ("express", "Express"), ("koa", "Koa"),
    )
    framework_hits = []
    for path in project_root.rglob("package.json"):
        if any(part in _SKIP_DIRS for part in path.parts):
            continue
        try:
            pkg = json.loads(path.read_text(encoding="utf-8"))
        except Exception:
            continue
        deps = dict(pkg.get("dependencies") or {})
        deps.update(pkg.get("devDependencies") or {})
        for dep_key, label in framework_keys:
            version = str(deps.get(dep_key) or "").strip()
            if version:
                item = "%s %s" % (label, version)
                if item not in framework_hits:
                    framework_hits.append(item)
    if framework_hits:
        found.append(" / ".join(framework_hits[:4]))

    return " / ".join(found)


def detect_run_env(project_root: Path) -> str:
    """运行环境：从启动配置里读真实的监听地址/数据库。

    只认**能证实**的：`launchSettings.json` 的 applicationUrl、
    `appsettings*.json` 的连接字符串主机名与库名。

    ★ 与 `detect_dev_env` 同理：这些文件在 `api/Properties/`、`api/` 等子目录里，
      必须递归找。
    """
    if not project_root or not project_root.is_dir():
        return ""
    found = []

    urls = set()
    for path in project_root.rglob("launchSettings.json"):
        if any(part in _SKIP_DIRS for part in path.parts):
            continue
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
        except Exception:
            continue
        for profile in (data.get("profiles") or {}).values():
            for url in str(profile.get("applicationUrl") or "").split(";"):
                url = url.strip()
                if url:
                    urls.add(url)
        if urls:
            break
    if urls:
        found.append("监听 " + "、".join(sorted(urls)))

    # 数据库：appsettings 里的连接字符串，只取 Server/Database 两段
    for path in project_root.rglob("appsettings*.json"):
        if any(part in _SKIP_DIRS for part in path.parts):
            continue
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
        except Exception:
            continue
        conn = str((data.get("ConnectionStrings") or {}).get("Default") or "")
        if not conn:
            continue
        server = re.search(r"(?:Server|Data Source)\s*=\s*([^;]+)", conn, re.IGNORECASE)
        database = re.search(r"(?:Database|Initial Catalog)\s*=\s*([^;]+)", conn, re.IGNORECASE)
        pieces = []
        if server:
            pieces.append(server.group(1).strip())
        if database:
            pieces.append("库 " + database.group(1).strip())
        if pieces:
            found.append("SQL Server " + " ".join(pieces))
            break

    return "；".join(found)


def detect_meta(project_root: Path, runner: dict | None = None) -> dict:
    """一次性探测全部软件信息，返回可直接合并进 meta_overrides 的字典。

    `runner` 来自 `result.json` 的 `runner` 字段（如 `{"language": "javascript"}`），
    作为语言探测的补充证据 —— 它记录的是**这次实际跑测试用的运行时**。
    """
    info = {
        "language": "",
        "software_scale": "",
        "dev_env": "",
        "run_env": "",
        "runner_language": "",
    }
    if not project_root or not project_root.is_dir():
        return info

    languages = detect_languages(project_root)
    if languages:
        # 只报占比最高的前 3 种，避免列成清单
        top = languages[:3]
        info["language"] = " + ".join(
            "%s（%d 文件）" % (name, count) for name, count in top
        )
        info["software_scale"] = detect_scale(project_root, languages)

    info["dev_env"] = detect_dev_env(project_root)
    info["run_env"] = detect_run_env(project_root)

    runner_lang = str((runner or {}).get("language") or "").strip()
    if runner_lang:
        info["runner_language"] = runner_lang

    return info


# 判断「这一层像不像项目根」：有这些文件/目录之一基本就是
_PROJECT_MARKERS = (
    # 通用
    "package.json", "pyproject.toml", "requirements.txt", "setup.py",
    "pom.xml", "build.gradle", "build.gradle.kts", "settings.gradle",
    "go.mod", "Cargo.toml", "CMakeLists.txt", "Makefile",
    "composer.json", "Gemfile", "mix.exs",
    # .NET
    "global.json",
)
_PROJECT_SUFFIXES = (".sln", ".csproj", ".vbproj", ".fsproj")


def looks_like_project_root(path: Path, depth: int = 0) -> bool:
    """这一层目录看起来是不是「被测项目根」。

    判据（命中任一即可）：
      ① 有构建/依赖清单（package.json / pom.xml / go.mod / *.csproj …）
      ② 其**子目录**里有这些清单，且子目录不只是 .dsh 这类工具目录

    ★ 为什么必须有 ②（2026-11-25 实测）：
        真实项目的根目录常常**只有文档**，源码在子目录里：
            myproject/
              REASONIX.md  README.md  design.txt     ← 外层只有文档
              node端/package.json                    ← 代码在这
              web/pom.xml                            ← 另一个模块在这
        只认 ① 会把这种根判成「不是项目」→ 探测全空 → 报告四格「未采集」，
        但代码明明是能读到的。

    `depth` 限制递归层数（默认只看 1 层子目录），避免误把盘符根当项目根。
    """
    try:
        if not path.is_dir():
            return False
    except Exception:
        return False

    # ① 自己就是项目根
    for name in _PROJECT_MARKERS:
        try:
            if (path / name).exists():
                return True
        except Exception:
            continue
    try:
        for child in path.iterdir():
            if child.is_file() and child.suffix.lower() in _PROJECT_SUFFIXES:
                return True
    except Exception:
        pass

    if depth <= 0:
        return False

    # ② 子目录里有工程（多模块 / 前后端分离项目的常见布局）
    try:
        children = [
            child for child in path.iterdir()
            if child.is_dir() and child.name not in _SKIP_DIRS
            and not child.name.startswith(".")
        ]
    except Exception:
        return False
    for child in children[:50]:  # 防止超大目录拖慢
        for name in _PROJECT_MARKERS:
            try:
                if (child / name).exists():
                    return True
            except Exception:
                continue
        try:
            for sub in child.iterdir():
                if sub.is_file() and sub.suffix.lower() in _PROJECT_SUFFIXES:
                    return True
        except Exception:
            pass
    return False


def _find_project_root_by_markers(path: Path, max_up: int = 6):
    r"""从 path 往上逐层找，返回**第一个像项目根的目录**。

    ★ 为什么不能「固定往上推 4 层」（2026-11-25 实测事故）：
        `<项目>/.dsh/test-sessions/<sid>/integration` 往上 4 层确实是项目根，
        但这个结构**不是唯一的**：
          · 有的项目把 .dsh 放在子目录（如 `D:\pj\newzzkz\.dsh\...`）
          · 有的会话目录不在项目内
          · 模型可能把 sessionRoot 指向别的层级

        固定层数在这些情况下会推到一个**完全无关的目录**（甚至盘符根），
        探测自然全是「未采集」，而且**看起来像「代码里读不到」**，
        实际是「根本没去对的地方找」。

        所以改成**逐层验证**：往上走，第一个带源码标记的目录就是它。

    ★ 判据什么时候放宽到「子目录里有工程」（depth=1）：
        真实项目常是「外层只有文档、里层才放代码」——
            myproject/
              README.md  design.txt          ← 外层只有文档
              node端/package.json            ← 代码在这

        但这种放宽**只在能确认「这一层就是 .dsh 的宿主目录」时才用**，
        否则一路往上会认到盘符根（兄弟目录有工程也算命中）。
        判定 `.dsh` 宿主：本层的 `.dsh` 子目录里能找到通往当前会话的路径。
    """
    current = path
    for _ in range(max_up + 1):
        # 只有「这一层就是 .dsh 宿主」才允许「子目录有工程」的宽松判据
        relaxed = _hosts_dsh_for(current, path)
        if looks_like_project_root(current, depth=1 if relaxed else 0):
            return current
        parent = current.parent
        if parent == current:  # 到根了
            break
        current = parent
    return None


def _hosts_dsh_for(candidate: Path, session_path: Path) -> bool:
    """`candidate` 是不是当前会话所在 `.dsh` 的宿主目录。

    判据：`candidate/.dsh` 存在，且 `session_path` 在它下面。
    这样能精确锁定「项目根」，不会把无关的上级目录误认成项目。
    """
    try:
        dsh = candidate / ".dsh"
        if not dsh.is_dir():
            return False
        return dsh in session_path.parents or dsh == session_path
    except Exception:
        return False


def resolve_project_root(session_root: Path, result: dict, explicit: str = "") -> Path | None:
    """定位被测项目根目录。

    顺序（前三个命中即用，第四个兜底）：
      1. 命令行显式指定 `--project-root`
      2. `result.json` 的 `project` 字段（`run_tests.py` 会写，最可信）
      3. 从 `session_root` 往上**逐层找**第一个带源码标记的目录
      4. 老逻辑：固定往上 4 层（`<项目>/.dsh/test-sessions/<sid>/integration`）
          —— 只在第 3 步找不到时用，且**要求它确实像项目根**

    ★ 2026-11-25 实测事故：只有「固定往上 4 层」时，一旦项目的 `.dsh`
      嵌在子目录里，就会推到一个无关目录，报告表头四格全是「未采集」，
      但代码其实完全能读到 —— 是**找错了地方**，不是读不到。
    """
    candidates = []

    # ① 显式指定最优先
    if explicit:
        candidates.append(Path(explicit))

    # ② result.json 里的 project
    project = str(result.get("project") or "").strip()
    if project:
        candidates.append(Path(project))

    # ③ 逐层向上找源码标记 —— 这一步能覆盖绝大多数真实布局
    by_markers = _find_project_root_by_markers(session_root)
    if by_markers is not None:
        candidates.append(by_markers)

    # ④ 兜底：固定往上 4 层（仅当它像项目根时才用）
    try:
        legacy = session_root.parent.parent.parent.parent
        if looks_like_project_root(legacy):
            candidates.append(legacy)
    except Exception:
        pass

    for candidate in candidates:
        try:
            if candidate.is_dir():
                return candidate.resolve()
        except Exception:
            continue
    return None


# ─────────────────────────────────────────────────────────────
#  证据归集：把一次执行的原始输出整理成「按步骤可查」
# ─────────────────────────────────────────────────────────────


def build_evidence_index(result: dict, observations: dict) -> dict:
    """建立 步骤定位键 → 该步骤的执行证据。

    一键执行的证据分散在**三处**，必须合并（优先级从高到低）：
      · observations.json 的 `items[]`：模型回写的逐步骤观察（最具体）
      · result.json 的 `steps[]`：逐步骤结果（含 observed）
      · result.json 的 `tests[]`：runner 原生逐测试函数结果（含 `actual`）

    定位键用 `caseId|stepNo`，与面板子表的键一致，避免只靠序号错位。

    ★ 字段名是 `stepNo`（不是 `no`）。踩过：写成 `no` 会让所有步骤都取到
      `None` 而挤到同一个键上，表现为「173 个步骤只有 74 条证据、结论全 notRun」。
      这里同时兼容 `stepNo` / `no` / `step` 三种写法，免得旧数据对不上。

    ★ 为什么要读 `tests[]`（2026-11-24 实测事故）：
      `assets/run_tests.py` 产出的是 `tests[]`（`func` / `outcome` / `actual`），
      **从不产出 `steps[]`**。只读 `steps[]` 时整次执行会变成「一条证据都没有」，
      逼得执行者自己写脚本转换 result.json —— 那次就把 `observed` 全写成了
      「断言全部通过（接口返回与落库字段均符合预期）」这种固定话术（243 步里 180 步）。
      所以这里直接兼容 `tests[]`，并从 `actual` / `message` / `detail` 取真实值。

    ★ 绝不让固定话术进报告：`observed` 若命中 `BANNED_OBSERVED`，视为「没有记录」，
      继续往下找真实值；全都没有才留空（生成器会显示「未记录实际值」）。
    """
    index = {}

    def step_no_of(item: dict):
        for key in ("stepNo", "no", "step"):
            value = item.get(key)
            if value is not None:
                return value
        return None

    def key_of(case_id: str, step_no) -> str:
        return "%s|%s" % (case_id, step_no)

    def meaningful(text) -> str:
        """过滤掉固定话术与空串，只留真实记录。"""
        value = str(text or "").strip()
        if value == "":
            return ""
        if is_boilerplate_observed(value):
            return ""
        return value

    # ① steps[]：逐步骤结果（最直接的来源）
    for item in result.get("steps") or []:
        if not isinstance(item, dict):
            continue
        case_id = str(item.get("caseId") or "")
        if case_id == "":
            continue
        index[key_of(case_id, step_no_of(item))] = {
            "outcome": str(item.get("outcome") or "notRun"),
            "observed": meaningful(item.get("observed")),
            "reason": str(item.get("reason") or ""),
            "channel": str(item.get("channel") or "runner"),
            "durationMs": item.get("durationMs") or 0,
        }

    # ② tests[]：runner 原生结果，靠 `func` 里的 stepN 反推步骤号
    for item in result.get("tests") or []:
        if not isinstance(item, dict):
            continue
        case_id = str(item.get("caseId") or "")
        if case_id == "":
            continue
        step_no = step_no_of(item)
        if step_no is None:
            step_no = step_no_from_func(item.get("func") or "")
        if step_no is None:
            continue
        k = key_of(case_id, step_no)
        if k in index and index[k].get("observed"):
            continue  # steps[] 已经给了真实观察，不覆盖
        # 真实值的优先级：actual（测试代码打印的实际输出）> message（断言消息）
        # > detail（失败正文）。message/detail 只在失败时才有意义。
        outcome = str(item.get("outcome") or "notRun")
        observed = meaningful(item.get("actual"))
        if observed == "" and outcome in ("failed", "error", "unknown"):
            observed = meaningful(first_line(item.get("message")))
        if observed == "" and outcome in ("failed", "error", "unknown"):
            observed = meaningful(first_line(item.get("detail")))
        merged = index.get(k, {})
        merged.update({
            "outcome": merged.get("outcome") or outcome,
            "observed": merged.get("observed") or observed,
            "reason": merged.get("reason") or str(item.get("message") or ""),
            "channel": merged.get("channel") or str(item.get("channel") or "runner"),
            "durationMs": merged.get("durationMs") or item.get("durationMs") or 0,
        })
        index[k] = merged

    # ③ observations[]：模型回写的观察，优先级最高（能覆盖前面两步）
    for item in observations.get("items") or []:
        if not isinstance(item, dict):
            continue
        case_id = str(item.get("caseId") or "")
        if case_id == "":
            continue
        k = key_of(case_id, step_no_of(item))
        merged = index.get(k, {})
        merged.update({
            "outcome": str(item.get("outcome") or merged.get("outcome") or "notRun"),
            "observed": meaningful(item.get("observed")) or merged.get("observed") or "",
            "reason": str(item.get("reason") or merged.get("reason") or ""),
            "channel": str(item.get("channel") or merged.get("channel") or "runner"),
            "durationMs": item.get("durationMs") or merged.get("durationMs") or 0,
        })
        index[k] = merged

    # ④ `_actuals`：从 run.log / junit 里捞到的 `ACTUAL[...]` 标记
    #    优先级**高于** tests[] 的 actual（日志是测试进程原样输出，最接近真相），
    #    但低于 observations.json（那是模型逐步骤确认过的）。
    #    key 可能是 `caseId`、`caseId|stepNo` 或测试函数名，三种都要试。
    actuals = result.get("_actuals") or {}
    if actuals:
        for item in result.get("tests") or []:
            if not isinstance(item, dict):
                continue
            case_id = str(item.get("caseId") or "")
            func = str(item.get("func") or "")
            if case_id == "":
                continue
            step_no = step_no_of(item)
            if step_no is None:
                step_no = step_no_from_func(func)
            if step_no is None:
                continue
            value = (
                actuals.get("%s|%s" % (case_id, step_no))
                or actuals.get(func)
                or actuals.get(case_id)
                or ""
            )
            value = meaningful(value)
            if value == "":
                continue
            k = key_of(case_id, step_no)
            merged = index.get(k, {})
            merged["observed"] = value
            index[k] = merged

    return index


# ─────────────────────────────────────────────────────────────
#  报告编排计划（report-plan.json）
# ─────────────────────────────────────────────────────────────


def collect_stage_of_feature(snapshot: dict) -> dict:
    """功能项 → 阶段名。

    优先用功能项自己带的 `stage`；没有就从它名下的用例里找；
    都没有则归到「未分阶段」——**不随机编一个阶段名**（那是造假）。
    """
    stage_of = {}
    for feature in snapshot.get("features") or []:
        fid = str(feature.get("id") or "")
        if fid == "":
            continue
        stage = str(feature.get("stage") or "").strip()
        if stage:
            stage_of[fid] = stage
    for case in snapshot.get("cases") or []:
        fid = str(case.get("featureId") or "")
        if fid == "":
            continue
        if stage_of.get(fid):
            continue
        stage = str(case.get("stage") or "").strip()
        if stage:
            stage_of[fid] = stage
    return stage_of


def generate_plan(snapshot: dict, run_id: str, seed: int | None = None) -> dict:
    """生成报告编排计划：哪些功能项归哪个阶段、每个阶段多少条用例。

    ★ 与单元测试的关键差别：单元测试的 `bridge.py` 是**随机**把被测函数分到
      3-4 个阶段（`generate_phase_plan` 用贪心+随机平局）。集成测试**不这样做** ——
      集成测试的阶段在生成用例时就已经按业务模块定了，写进功能项的 `stage` 字段。

      所以这里只做「按已有 stage 归组」，绝不重新划分。重新划分会导致：
        · 报告里的阶段和用户在用例页看到的对不上；
        · 同一次执行重复生成报告时阶段变成另一套。
      只有**全都没标 stage** 时，才退化成单阶段并在计划里标出原因。
    """
    stage_of = collect_stage_of_feature(snapshot)

    # 按 stage 归组，保持功能项原有顺序（报告章节顺序要稳定）
    order = []
    buckets = {}
    for feature in snapshot.get("features") or []:
        fid = str(feature.get("id") or "")
        if fid == "":
            continue
        stage = stage_of.get(fid) or stage_of.get("") or "未分阶段"
        if stage not in buckets:
            buckets[stage] = []
            order.append(stage)
        buckets[stage].append(fid)

    case_count_of_feature = {}
    for case in snapshot.get("cases") or []:
        fid = str(case.get("featureId") or "")
        case_count_of_feature[fid] = case_count_of_feature.get(fid, 0) + 1

    phases = []
    for i, stage in enumerate(order, start=1):
        feature_ids = buckets[stage]
        phases.append({
            "phaseId": "phase-%d" % i,
            "name": stage,
            "order": i,
            "featureIds": feature_ids,
            "caseCount": sum(case_count_of_feature.get(fid, 0) for fid in feature_ids),
        })

    notes = []
    if len(phases) == 1 and phases[0]["name"] == "未分阶段":
        notes.append(
            "功能项没有 stage 字段，报告只能出单章。"
            "按规范，测试阶段应在生成用例时就按业务模块划分（3-4 个）并写进 features[].stage。"
        )

    return {
        "schemaVersion": "1.0",
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "runId": run_id,
        "stageSource": "feature.stage" if stage_of else "none",
        "phaseCount": len(phases),
        "phases": phases,
        "notes": notes,
    }


def load_or_create_plan(snapshot: dict, run_id: str, report_dir: Path) -> tuple:
    """读已有计划，没有就生成。

    「有就复用」是为了**阶段划分稳定**：同一次执行重复生成报告，
    章节结构必须一模一样，不能因为重新跑了一次 bridge 就换了。
    但如果快照里的阶段集合变了（用户改了 stage），就重新生成。
    """
    plan_path = report_dir / "report-plan.json"
    fresh = generate_plan(snapshot, run_id)

    if plan_path.is_file():
        try:
            old = json.loads(plan_path.read_text(encoding="utf-8"))
            old_names = [p.get("name") for p in (old.get("phases") or [])]
            new_names = [p.get("name") for p in fresh.get("phases") or []]
            if old_names == new_names:
                return old, plan_path
            # 阶段集合变了 → 用新的（并在计划里记一笔，便于倒查）
            fresh["notes"] = list(fresh.get("notes") or []) + [
                "阶段划分相比上一次计划有变化：%s → %s" % (old_names, new_names)
            ]
        except Exception:
            pass  # 计划损坏就重建

    report_dir.mkdir(parents=True, exist_ok=True)
    plan_path.write_text(json.dumps(fresh, ensure_ascii=False, indent=2), encoding="utf-8")
    return fresh, plan_path


# ─────────────────────────────────────────────────────────────
#  组装 data（喂给 integration_report.py）
# ─────────────────────────────────────────────────────────────


def case_payload(case: dict, evidence: dict, step_rows: list) -> dict:
    """把快照里的一条用例 + 执行证据，转成生成器要的 case 结构。"""
    case_id = str(case.get("caseId") or "")
    steps = []
    outcomes = []

    for i, step in enumerate(step_rows, start=1):
        # `steps.json` 里的步骤序号键名兼容（no / stepNo / step）
        no = None
        for key in ("no", "stepNo", "step"):
            if step.get(key) is not None:
                no = step.get(key)
                break
        if no is None:
            no = i
        ev = evidence.get("%s|%s" % (case_id, no), {})
        outcome = ev.get("outcome") or "notRun"
        observed = ev.get("observed") or ""
        if observed == "":
            # 找不到真实记录时**留空**，交给生成器统一显示「未记录实际值」。
            # 绝不在这里写「实际结果与预期不符」这类套话 —— 那会让验收方
            # 以为「读到了但不对」，而真相是「根本没记录」。空值可被排查，
            # 套话会永久掩盖问题（2026-11-24 事故的教训）。
            if outcome == "notRun":
                observed = "未执行（本次未执行该步）"

        steps.append({
            "no": no,
            "action": step.get("action") or "",
            "operation": step.get("operation") or step.get("action") or "",
            "expected": step.get("expected") or "",
            "observed": observed,
            "outcome": outcome,
        })
        outcomes.append(outcome)

    # 用例级结论：任何一步没通过就是未通过；有步骤根本没执行则未执行/未确认。
    #
    # 这里**不复用 result.json 的整体状态** —— 单元测试的 bridge.py 有同一条原则：
    # 逐条结论只来自该条自己的证据，不用整体状态推断。
    if "failed" in outcomes or "error" in outcomes:
        case_outcome = "failed"
    elif not outcomes:
        case_outcome = "notRun"
    elif all(o == "passed" for o in outcomes):
        case_outcome = "passed"
    elif all(o == "notRun" for o in outcomes):
        case_outcome = "notRun"
    else:
        case_outcome = "unconfirmed"

    return {
        "caseId": case_id,
        "caseCode": case.get("caseCode") or "",
        "chapter": case.get("chapter") or "",
        "seq": case.get("seq"),
        "title": case.get("title") or "",
        "type": case.get("type") or "functional",
        "typeLabel": TYPE_LABELS.get(case.get("type") or "functional", "功能测试"),
        "polarity": case.get("polarity") or "normal",
        "requirement": case.get("requirement") or "",
        "description": case.get("description") or "",
        "precondition": case.get("precondition") or "",
        "executedAt": case.get("executedAt") or "",
        "outcome": case_outcome,
        "steps": steps,
    }


def build_data(snapshot: dict, steps_doc: dict, evidence: dict, plan: dict,
               run_id: str, meta_overrides: dict) -> dict:
    """按 plan 把功能项和用例组织成生成器要的 stages 结构。"""
    feature_by_id = {str(f.get("id") or ""): f for f in snapshot.get("features") or []}
    case_by_id = {str(c.get("caseId") or ""): c for c in snapshot.get("cases") or []}

    # 步骤定义：caseId → 步骤行（`steps.json` 里每条用例挂自己的步骤）
    steps_of_case = {}
    for case in steps_doc.get("cases") or []:
        cid = str(case.get("caseId") or "")
        if cid:
            steps_of_case[cid] = case.get("steps") or []

    # 功能项 → 它名下的用例（保持快照顺序）
    cases_of_feature = {}
    for case in snapshot.get("cases") or []:
        fid = str(case.get("featureId") or "")
        if fid == "":
            continue
        cases_of_feature.setdefault(fid, []).append(case)

    stages = []
    for phase in plan.get("phases") or []:
        features_out = []
        stage_issues = []

        for fid in phase.get("featureIds") or []:
            feature = feature_by_id.get(fid)
            if feature is None:
                continue
            feature_cases = []
            for case in cases_of_feature.get(fid) or []:
                cid = str(case.get("caseId") or "")
                payload = case_payload(case, evidence, steps_of_case.get(cid) or [])
                feature_cases.append(payload)
                # 未通过的用例 → 一条问题（附录 A/B 的来源）
                if payload["outcome"] == "failed":
                    failed_steps = [s for s in payload["steps"]
                                    if s["outcome"] in ("failed", "error")]
                    # 「问题现象描述」的素材：**只写真实观察**。
                    # 观察为空时明确写「未采集到实际数据」并带上预期值 ——
                    # 这比「实际与预期不符」有用：读者知道该去哪里补证据，
                    # 而不是以为「读到了但不对」（2026-11-24 事故的教训）。
                    parts = []
                    for s in failed_steps:
                        observed = (s.get("observed") or "").strip()
                        if observed:
                            parts.append("第 %s 步：%s" % (s["no"], observed))
                        else:
                            expected = (s.get("expected") or "").strip()
                            parts.append(
                                "第 %s 步：未采集到实际数据（预期 %s）"
                                % (s["no"], expected) if expected
                                else "第 %s 步：未采集到实际数据" % s["no"]
                            )
                    desc = "；".join(parts) or payload["title"]
                    stage_issues.append({
                        "title": "%s：%s" % (payload["caseCode"] or cid, payload["title"]),
                        "desc": desc[:800],
                        "level": "一般",
                        "caseCode": payload["caseCode"] or "",
                        "foundAt": payload["executedAt"] or "",
                    })

            if not feature_cases:
                continue
            features_out.append({
                "code": feature.get("code") or "",
                "name": feature.get("name") or "",
                # 功能项也带上 stage，分布统计表和记录单的「测试阶段」列要用
                "stage": phase.get("name") or "",
                "cases": feature_cases,
            })

        stages.append({
            "name": phase.get("name") or "集成测试",
            "features": features_out,
            "issues": stage_issues,
            "inconsistent": "无",
            "regression": {},
        })

    meta = {
        "softwareName": meta_overrides.get("software_name") or "被测软件",
        "softwareVersion": meta_overrides.get("software_version") or "",
        "softwareScale": meta_overrides.get("software_scale") or "未采集",
        "language": meta_overrides.get("language") or "未采集",
        "devEnv": meta_overrides.get("dev_env") or "未采集",
        "runEnv": meta_overrides.get("run_env") or "未采集",
        "importance": meta_overrides.get("importance") or "重要",
        "vendor": meta_overrides.get("vendor") or "未采集",
        "projectCode": meta_overrides.get("project_code") or "",
        "source": meta_overrides.get("source") or "DM",
        "testStartDate": meta_overrides.get("test_start_date") or "",
        "testEndDate": meta_overrides.get("test_end_date") or "",
        "codeCommentRate": meta_overrides.get("code_comment_rate"),
    }

    people = {
        "designer": meta_overrides.get("designer") or DEFAULT_PEOPLE,
        "reviewer": meta_overrides.get("reviewer") or DEFAULT_PEOPLE,
        "tester": meta_overrides.get("tester") or DEFAULT_PEOPLE,
    }

    # 汇总：给面板与人工核对用
    summary = {"caseTotal": 0, "stepTotal": 0, "caseOutcome": {}, "stepOutcome": {}}
    for stage in stages:
        for feature in stage["features"]:
            for case in feature["cases"]:
                summary["caseTotal"] += 1
                summary["caseOutcome"][case["outcome"]] = \
                    summary["caseOutcome"].get(case["outcome"], 0) + 1
                for step in case["steps"]:
                    summary["stepTotal"] += 1
                    summary["stepOutcome"][step["outcome"]] = \
                        summary["stepOutcome"].get(step["outcome"], 0) + 1

    return {
        "runId": run_id,
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "meta": meta,
        "people": people,
        "stages": stages,
        "summary": summary,
    }


# ─────────────────────────────────────────────────────────────
#  调生成器（不自己填表）
# ─────────────────────────────────────────────────────────────


def load_generator(script: str = ""):
    """加载集成报告生成器。

    查找顺序与宿主侧的 `integrationReportScriptPath()` 保持一致：
      1. 命令行/环境变量显式指定
      2. 本脚本同目录的 integration_report.py（两者都在 integrationReport/ 下）
      3. 仓库根的 integrationReport/integration_report.py
    """
    candidates = []
    if script:
        candidates.append(Path(script))
    env = os.environ.get("INTEGRATION_REPORT_SCRIPT", "").strip()
    if env:
        candidates.append(Path(env))
    here = Path(__file__).resolve().parent
    candidates.append(here / "integration_report.py")
    candidates.append(here.parent / "integrationReport" / "integration_report.py")

    for path in candidates:
        if path.is_file():
            spec = importlib.util.spec_from_file_location("integration_report", path)
            module = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(module)
            return module, path

    raise SystemExit(
        "报告生成器缺失：找不到 integration_report.py\n"
        "  已尝试：%s\n"
        "请确认它随仓库一起存在（integrationReport/integration_report.py），\n"
        "或用环境变量 INTEGRATION_REPORT_SCRIPT 指定。\n"
        "不要在缺生成器的情况下自己实现报告生成。"
        % "\n          ".join(str(c) for c in candidates)
    )


def find_template(script_dir: Path, explicit: str = "") -> Path:
    candidates = []
    if explicit:
        candidates.append(Path(explicit))
    env = os.environ.get("INTEGRATION_REPORT_TEMPLATE", "").strip()
    if env:
        candidates.append(Path(env))
    candidates.append(script_dir / "配置项测试报告模板.docx")

    for path in candidates:
        if path.is_file():
            return path

    raise SystemExit(
        "找不到模板：已尝试 %s\n"
        "模板应随仓库进库（integrationReport/配置项测试报告模板.docx）。"
        % "、".join(str(c) for c in candidates)
    )


def resolve_report_version(session_root: Path, run_id: str, explicit: str = "") -> str:
    """确定本次报告该用哪个版本号。

    ★ 关键：版本号**必须向面板要**，不能在脚本里写死。
      面板侧的 `createVersion` 负责分配（V0.0.1 → V0.0.2 → …），
      写死会导致第二次一键执行把上一次的报告覆盖掉。

    这里按优先级：
      1. 命令行 `--report-version` 显式指定
      2. `report-versions/index.json` 里已记录本次 runId 的版本（面板已建过）
      3. 都没有 → 返回空串，让调用方提示「先调 createVersion」

    第 2 条能成立，是因为面板建版本时会把 `runId` 写进 `versions[]`。
    """
    if explicit:
        return explicit

    index = read_json(session_root / "report-versions" / "index.json", {})
    for item in index.get("versions") or []:
        if str(item.get("runId") or "") == run_id:
            name = str(item.get("name") or "")
            if name:
                return name
    return ""


def write_report_data(report_dir: Path, data: dict, made: dict, overall: Path,
                      run_id: str, step_version: str, case_version: str) -> Path:
    """写 report-data.json。

    ★ 这份文件有**两个消费者**，结构必须同时满足：

      1. **面板**（`/data-panel/run/report` 读它，报告页按它列文件、按 docx 路径打开）
         需要的顶层字段：`runId`、`stepVersion`、`caseVersion`、`overallDocx`、
         `features[].cases[]`（每条带 `docx` / `relPath` / `caseOutcome`）
      2. **人/脚本**核对本次编排：`meta`、`people`、`stages`、`summary`

    踩过的坑：只写第 2 种（生成器要的那种 stages 结构）会**把面板依赖的字段冲掉**，
    表现为报告页「文件列表还在、但点开提示没有报告」。
    所以这里两套都写：`features`（面板用，扁平按功能项）+ `stages`（生成用）。
    """
    base = report_dir.parent.parent  # <会话>/integration
    overall_str = str(overall) if overall is not None else ""
    overall_rel = ""
    if overall_str:
        try:
            overall_rel = str(Path(overall_str).relative_to(base)).replace("\\", "/")
        except Exception:
            overall_rel = overall_str

    # ── 面板用的扁平 features（按功能项 → 每条用例一份 docx 路径）──
    features_out = []
    seen = set()
    for stage in data.get("stages") or []:
        for feature in stage.get("features") or []:
            entry_cases = []
            for case in feature.get("cases") or []:
                cid = case.get("caseId") or ""
                docx_path = made.get(cid, "")
                rel = ""
                if docx_path:
                    try:
                        rel = str(Path(docx_path).relative_to(base)).replace("\\", "/")
                    except Exception:
                        rel = docx_path
                entry_cases.append({
                    "caseId": cid,
                    "caseCode": case.get("caseCode") or "",
                    "caseOutcome": case.get("outcome") or "",
                    "docx": docx_path,
                    "relPath": rel,
                })
            key = feature.get("code") or feature.get("name") or ""
            if key in seen:
                continue
            seen.add(key)
            features_out.append({
                "featureId": feature.get("code") or "",
                "code": feature.get("code") or "",
                "name": feature.get("name") or "",
                "stage": feature.get("stage") or "",
                "cases": entry_cases,
            })

    payload = {
        # ① 面板依赖的字段（缺了报告页就打不开报告）
        "runId": run_id,
        "stepVersion": step_version,
        "caseVersion": case_version,
        "generatedAt": data.get("generatedAt") or "",
        "summary": data.get("summary") or {},
        "overallDocx": overall_str,
        "overallRelPath": overall_rel,
        "features": features_out,
        # ② 生成器/人工核对用的结构（保留，便于复现与倒查）
        "meta": data.get("meta") or {},
        "people": data.get("people") or {},
        "stages": data.get("stages") or [],
    }

    path = report_dir / "report-data.json"
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    return path


def render_docx(module, template: Path, data: dict, report_dir: Path,
                run_id: str, software_name: str, report_version: str = "") -> tuple:
    """生成整项目报告 + 每条用例一份单条报告。

    文件名带**报告版本号**（不是 runId）：与 SKILL.md 的约定一致，
    这样同一 run 重新生成不同版本时不会互相覆盖，也和单元测试的命名习惯对齐。
    """
    case_dir = report_dir / "cases"
    case_dir.mkdir(parents=True, exist_ok=True)

    suffix = report_version or run_id
    overall_name = "集成测试报告-%s-整项目-%s.docx" % (software_name or "项目", suffix)
    overall = module.build_full(template, data, report_dir / overall_name)

    made = {}
    for stage in data.get("stages") or []:
        for feature in stage.get("features") or []:
            for case in feature.get("cases") or []:
                cid = case.get("caseId") or ""
                if cid == "":
                    continue
                out = case_dir / ("集成测试报告-%s-全步骤-%s.docx"
                                  % (cid.replace(".", "_"), suffix))
                module.build_single_step(
                    template,
                    {"people": data.get("people") or {}, "meta": data.get("meta") or {},
                     "feature": {"code": feature.get("code") or "",
                                 "name": feature.get("name") or ""},
                     "case": case},
                    out,
                )
                made[cid] = str(out)

    return overall, made


# ─────────────────────────────────────────────────────────────
#  CLI
# ─────────────────────────────────────────────────────────────


def write_exec_records(session_root: Path, step_version: str, run_id: str,
                       result: dict) -> Path | None:
    """生成/合并 `step-versions/<V>/exec-records.json` —— **报告页能显示的唯一前提**。

    ★★ 为什么必须有这一步（2026-11-25 实测事故）：
        报告 docx 生成成功、`report-versions/index.json` 也写了，
        但面板「测试报告」页依旧空白，只显示「当前还没有测试报告」。
        而「测试步骤」页是正常的 —— 两页用**完全不同的数据源**：

            测试步骤页  ←  step-versions/<V>/steps.json       （有，所以能显示）
            测试报告页  ←  step-versions/<V>/exec-records.json （没有，所以空白）

        面板 `client.js` 的 `reportsView()` 判定条件（两条都必须满足）：
            ① 每条用例的 `records[]` 里必须有 `source === "all"` 的记录
            ② 该记录的 `runId` 还必须等于「当前报告版本」的 `runId`

        `bridge.py` 以前**完全不写这个文件**，报告页就永远是空的，
        而且不报任何错 —— 用户只会以为报告没生成。

    写入规则（与面板约定一致）：
      · 结构 `{ 步骤版本: { caseId: [记录] } }`
      · 一条用例一次执行 = 一条记录，存 `runId`/`at`/`result`/`durationMs`/`source`
      · 同一 `runId` 在一条用例下**只能有一条**（按 runId 去重，重跑不堆叠）
      · 已存在的其他 run 记录**保留**（多次一键执行累积）

    返回写入路径；没有可写记录时返回 None。
    """
    steps = result.get("steps") or []
    if not isinstance(steps, list) or not steps:
        return None

    version_dir = session_root / "step-versions" / step_version.replace(".", "_")
    if not version_dir.is_dir():
        return None
    path = version_dir / "exec-records.json"

    existing = read_json(path, {})
    if not isinstance(existing, dict):
        existing = {}

    # 外层键用带点的版本号（面板拿 activeVersion 去取）
    group = existing.get(step_version)
    if not isinstance(group, dict):
        group = existing.get(step_version.replace(".", "_"))
    if not isinstance(group, dict):
        group = {}

    # 按 caseId 聚合本次 run 的步骤结论
    per_case = {}
    for item in steps:
        if not isinstance(item, dict):
            continue
        case_id = str(item.get("caseId") or "")
        if case_id == "":
            continue
        per_case.setdefault(case_id, []).append(str(item.get("outcome") or "unconfirmed"))
    if not per_case:
        return None

    def case_result(outcomes):
        """用例级结论：任一步未通过 → fail；全通过 → pass；其余 unconfirmed。"""
        if any(o in ("failed", "error") for o in outcomes):
            return "fail"
        if outcomes and all(o == "passed" for o in outcomes):
            return "pass"
        if outcomes and all(o == "notRun" for o in outcomes):
            return "fail"
        return "unconfirmed"

    at = str(result.get("finishedAt") or result.get("startedAt")
             or datetime.now(timezone.utc).isoformat())

    duration_of = {}
    for item in steps:
        if isinstance(item, dict) and item.get("caseId"):
            duration_of[item["caseId"]] = duration_of.get(item["caseId"], 0) + float(
                item.get("durationMs") or 0)

    for case_id, outcomes in per_case.items():
        arr = group.get(case_id)
        arr = list(arr) if isinstance(arr, list) else []
        # ★ 同 runId 去重：重跑同一 run 时不堆叠
        arr = [r for r in arr if not (isinstance(r, dict) and r.get("runId") == run_id)]
        arr.insert(0, {
            "runId": run_id,
            "at": at,
            "result": case_result(outcomes),
            "durationMs": int(duration_of.get(case_id, 0)),
            "source": "all",
        })
        arr.sort(key=lambda r: str((r or {}).get("at") or ""), reverse=True)
        group[case_id] = arr

    # ★ 顺手清掉「source 非法」的历史记录（2026-11-25 实测）：
    #   有的执行者手写 exec-records 时把 source 写成 "run"，
    #   这类记录**永远显示不出来**（报告页只认 "all"），留着只会让
    #   契约校验器一直 FAIL，也让人误以为「跑过但没显示」。
    #   它们本来就没有展示价值，直接丢弃。
    dropped = 0
    for case_id, arr in list(group.items()):
        if not isinstance(arr, list):
            continue
        kept = [r for r in arr
                if isinstance(r, dict) and r.get("source") in ("all", "step")]
        dropped += len(arr) - len(kept)
        group[case_id] = kept

    # 写回：外层统一成带点的版本号，并清掉可能存在的下划线写法
    existing.pop(step_version.replace(".", "_"), None)
    existing[step_version] = group
    path.write_text(json.dumps(existing, ensure_ascii=False, indent=2), encoding="utf-8")
    if dropped:
        print("      已清掉 %d 条 source 非法的历史记录（写成 \"run\" 这类，报告页永远显示不出来）"
              % dropped)
    return path


def main(argv) -> int:
    parser = argparse.ArgumentParser(
        description="集成测试报告数据转换（把一次执行转成生成器要的 data）")
    parser.add_argument("--session-root", required=True,
                        help="集成测试根目录，形如 <会话>/integration")
    parser.add_argument("--run-id", required=True, help="本次执行的 runId")
    parser.add_argument("--step-version", default="",
                        help="步骤版本（缺省取 index.json 的 activeVersion）")
    parser.add_argument("--project-code", default="", help="项目缩写，用于用例标识，如 JYSG")
    parser.add_argument("--project-root", default="",
                        help="被测项目根目录。缺省从 result.json 的 project 字段推断，"
                             "用于自动探测软件规模/编程语言/开发环境/运行环境")
    parser.add_argument("--source", default="DM", choices=["DM", "SRS"],
                        help="需求来源：DM=按代码归纳，SRS=有需求文档")
    parser.add_argument("--software-name", default="")
    parser.add_argument("--software-version", default="")
    parser.add_argument("--software-scale", default="")
    parser.add_argument("--language", default="")
    parser.add_argument("--dev-env", default="")
    parser.add_argument("--run-env", default="")
    parser.add_argument("--importance", default="")
    parser.add_argument("--vendor", default="")
    parser.add_argument("--test-start-date", default="")
    parser.add_argument("--test-end-date", default="")
    parser.add_argument("--designer", default="")
    parser.add_argument("--reviewer", default="")
    parser.add_argument("--tester", default="")
    parser.add_argument("--template", default="", help="模板路径（缺省用仓库内那份）")
    parser.add_argument("--report-version", default="",
                        help="报告版本号，如 V0.0.1。缺省从 report-versions/index.json "
                             "按本次 runId 查；查不到时退回用 runId（并提示先调面板 createVersion）")
    parser.add_argument("--no-docx", action="store_true",
                        help="只产出 report-plan.json / report-data.json，不生成 docx")
    args = parser.parse_args(argv)

    session_root = Path(args.session_root).resolve()
    if not session_root.is_dir():
        raise SystemExit("集成测试根目录不存在：%s" % session_root)

    run_dir = session_root / "runs" / args.run_id
    if not run_dir.is_dir():
        raise SystemExit("找不到这次执行：%s" % run_dir)

    print("[1/5] 读取步骤与快照…")
    steps_doc, snapshot, step_version = load_steps(session_root, args.step_version)
    print("      步骤版本 %s，用例 %d 条"
          % (step_version, len(snapshot.get("cases") or [])))

    print("[2/5] 读取执行结果与观察记录…")
    result, observations = load_run(run_dir)
    evidence = build_evidence_index(result, observations)
    print("      证据条目 %d 个" % len(evidence))

    report_dir = session_root / "reports" / args.run_id
    report_dir.mkdir(parents=True, exist_ok=True)
    case_version = read_json(session_root / "case-versions" / "index.json", {}).get(
        "activeVersion") or ""

    print("[3/6] 生成/复用报告编排计划…")
    plan, plan_path = load_or_create_plan(snapshot, args.run_id, report_dir)
    print("      阶段 %d 个：%s"
          % (plan.get("phaseCount") or 0,
             "、".join(p.get("name") or "" for p in plan.get("phases") or [])))
    for note in plan.get("notes") or []:
        print("      注意：" + note)

    print("[3/5] 探测软件信息（软件规模 / 编程语言 / 开发环境 / 运行环境）…")
    project_root = resolve_project_root(session_root, result, args.project_root)
    detected = detect_meta(project_root, result.get("runner")) if project_root else {
        "language": "", "software_scale": "", "dev_env": "", "run_env": "",
        "runner_language": "",
    }
    if project_root:
        print("      被测项目根：%s" % project_root)
        missing = []
        for label, key in (("编程语言", "language"), ("软件规模", "software_scale"),
                           ("开发环境", "dev_env"), ("运行环境", "run_env")):
            value = detected.get(key) or ""
            if value:
                print("      %s：%s" % (label, value))
            else:
                missing.append(label)
                print("      %s：未采集" % label)
        if missing:
            # 只在这个目录**确实没有源码**时才提示「可能找错地方」
            if not looks_like_project_root(project_root, depth=1):
                print("      ⚠️ 这个目录下（含 1 层子目录）没找到任何源码标记"
                      "（package.json / *.csproj / pom.xml / go.mod / pyproject.toml …）")
                print("         很可能**不是真正放源码的目录**。若被测项目在别处，请加参数：")
                print("         --project-root <被测项目根目录>")
            else:
                print("      ⚠️ 源码目录已找到，但以下项在其中没有可证实的来源：%s"
                      % "、".join(missing))
                print("         这属于「确实读不到」（例如没有 SLA 文档、没有连接串配置），"
                      "不是找错了目录。")
            print("         需要写进报告时，用参数显式指定：")
            print("         --software-scale \"…\" --language \"…\" --dev-env \"…\" --run-env \"…\"")
    else:
        print("      ⚠️ 定位不到被测项目根目录 —— 软件信息四格会全是「未采集」。")
        print("         最常见原因：`result.json` 里没有 `project` 字段，"
              "且从会话目录往上找不到源码标记。")
        print("         解决：① 在 `result.json` 里写 `\"project\": \"<源码根目录>\"`（推荐）")
        print("               ② 或生成报告时加 `--project-root <被测项目根目录>`。")

    # 探测值优先，命令行显式参数作为覆盖 —— 用户显式传的就按用户说的来。
    def pick(explicit_value, detected_key):
        explicit = str(explicit_value or "").strip()
        if explicit:
            return explicit
        return str(detected.get(detected_key) or "").strip()

    print("[5/6] 组装 report-data.json…")
    data = build_data(snapshot, steps_doc, evidence, plan, args.run_id, {
        "project_code": args.project_code,
        "source": args.source,
        "software_name": args.software_name,
        "software_version": args.software_version or step_version,
        "software_scale": pick(args.software_scale, "software_scale"),
        "language": pick(args.language, "language"),
        "dev_env": pick(args.dev_env, "dev_env"),
        "run_env": pick(args.run_env, "run_env"),
        "importance": args.importance,
        "vendor": args.vendor,
        "test_start_date": args.test_start_date,
        "test_end_date": args.test_end_date,
        "designer": args.designer,
        "reviewer": args.reviewer,
        "tester": args.tester,
    })
    data_path = report_dir / "report-data.json"
    summary = data.get("summary") or {}
    print("      用例 %d 条，步骤 %d 个，结论分布 %s"
          % (summary.get("caseTotal", 0), summary.get("stepTotal", 0),
             summary.get("caseOutcome", {})))

    print("OK report-plan.json -> %s" % plan_path)

    if args.no_docx:
        # 只出 json 时也要写完整结构（面板字段 + stages），否则会把面板要的字段冲掉
        data_path = write_report_data(report_dir, data, {}, None, args.run_id,
                                      step_version, case_version)
        print("OK report-data.json -> %s" % data_path)
        rec_path = write_exec_records(session_root, step_version, args.run_id, result)
        if rec_path:
            print("OK exec-records.json -> %s（报告页靠它显示）" % rec_path)
        print("[6/6] 已跳过 docx 生成（--no-docx）")
        return 0

    print("[6/6] 调生成器出 docx…")
    module, script_path = load_generator()
    template = find_template(script_path.parent, args.template)

    # 报告版本号：优先用显式参数，其次从面板写的 index.json 按 runId 找
    report_version = resolve_report_version(session_root, args.run_id, args.report_version)
    if report_version == "":
        print("      ⚠️ 没找到本次 runId 对应的报告版本号。")
        print("         正确做法：先调面板 POST /data-panel/integration")
        print("         { kind:'report', op:'createVersion', runId:'%s' } 拿版本号，" % args.run_id)
        print("         或用 --report-version 显式指定。本次临时用 runId 作文件名后缀。")
    else:
        print("     报告版本：%s" % report_version)

    overall, made = render_docx(module, template, data, report_dir, args.run_id,
                                args.software_name, report_version)
    data_path = write_report_data(report_dir, data, made, overall, args.run_id,
                                  step_version, case_version)
    print("     生成器：%s" % script_path)
    print("     模板：%s" % template)
    print("OK 总体报告 -> %s" % overall)
    print("OK 单条报告 %d 份 -> %s" % (len(made), report_dir / "cases"))
    print("OK report-data.json -> %s" % data_path)

    # ★★ 报告页的数据源：没有 exec-records.json，「测试报告」页就是空白。
    #    这一步不能省，也不能指望「面板自己会写」—— 面板只在用户手动
    #    增删执行记录时才写它，一键执行后不会自动补。
    rec_path = write_exec_records(session_root, step_version, args.run_id, result)
    if rec_path:
        print("OK exec-records.json -> %s（报告页靠它显示）" % rec_path)
    else:
        print("      ⚠️ 没有写出 exec-records.json（本次 result.json 里没有 steps[]）")
        print("         报告页会是空白，尽管 docx 已生成。")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))