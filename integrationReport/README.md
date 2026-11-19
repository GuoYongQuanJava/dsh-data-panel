# 集成测试报告生成器

把集成测试的结构化数据填进「配置项测试报告模板」模板，生成 Word 报告。

> **与单元测试报告工具（`testReport/`）是两套独立的东西**，互不 import、互不修改。
> 单元测试用 `testReport/report-tool/`，集成测试用本目录。别把两者的路径、模板、数据格式搞混。

---

## 文件

| 文件 | 说明 |
|---|---|
| `integration_report.py` | 生成器本体，唯一入口 |
| `sample-project.json` | 整项目报告的样例数据（供 `build_full`） |
| `sample-step.json` | 单条步骤报告的样例数据（供 `build_single_step`） |
| `README.md` | 本文件 |

`输出/` 目录在首次运行时自动创建，存放生成的 docx（已在 `.gitignore` 里，不进库）。

---

## 依赖

- **Python 3**
- **python-docx**

DSH 自带的 Python 已经装了 python-docx，可直接用：

```powershell
$py = Join-Path ([Environment]::GetFolderPath('UserProfile')) `
      '.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\python\python.exe'
```

自己装的话：`pip install python-docx`

---

## 模板

脚本需要「配置项测试报告模板」这个 docx 作为底板。查找顺序：

1. 命令行第 1 个参数
2. 环境变量 `INTEGRATION_REPORT_TEMPLATE`
3. 与本脚本同目录的 `配置项测试报告模板.docx`

**模板不随本目录分发**（二进制、体积大、各项目可能要改样式）。缺失时脚本会报错并提示上面三种指定方式。

---

## 用法

### 生成样例（验证脚本本身可用）

```powershell
cd <仓库根>\integrationReport
& $py integration_report.py <模板绝对路径>
```

会在 `输出/` 下生成两份 docx：

- `样例1-整项目完整报告.docx` ← `build_full`
- `样例2-单个测试步骤报告.docx` ← `build_single_step`，一张表一页

### 在真实流程里调用

集成测试 Skill 是**写一段 Python 脚本 import 本模块**再调用，不是直接命令行跑：

```python
import importlib.util
from pathlib import Path

PROTOTYPE = r"<仓库根>\integrationReport\integration_report.py"
spec = importlib.util.spec_from_file_location("ir", PROTOTYPE)
proto = importlib.util.module_from_spec(spec)
spec.loader.exec_module(proto)

# 整项目报告
data = {
    "meta":   { "softwareName": ..., "projectCode": "JYSG", "source": "SRS", ... },
    "people": { "designer": ..., "reviewer": ..., "tester": ... },
    # 二选一，见下面「数据结构」
    "stages": [ ... ]   # 或 "features": [ ... ]
}
proto.build_full(Path("<模板>"), data, Path("<输出>/报告.docx"))

# 单条步骤报告：一张表一页，不带章节号与表题
proto.build_single_step(Path("<模板>"), step_data, Path("<输出>/单条.docx"))
```

> ⚠️ **两个函数不能混用**：单条报告用 `build_single_step`，整项目报告用 `build_full`。
> 拿 `build_full` 生成单条会套上整本模板（曾踩过：产出 60 份 70KB 的大报告）。

---

## 数据结构

`build_full` 的 `data` **两种结构都吃**，看 `integration_report.py` 第 683 行：

**写法一：`features` 平铺（单阶段）**

```json
{ "meta": {...}, "people": {...}, "features": [ { "code", "name", "cases": [...] } ] }
```

只有一个阶段，报告只有一章。完整例子见 `sample-project.json`。

**写法二：`stages` 分阶段（多章）**

```json
{
  "meta": {...}, "people": {...},
  "stages": [
    {
      "name": "sprint1",
      "features": [ { "code", "name", "cases": [...] } ],
      "issues": [...],
      "inconsistent": "无",
      "regression": { "date", "version", "features": [...] }
    }
  ]
}
```

每个阶段生成一章（4、5、6…）。没给 `stages` 时，脚本会把 `features` 自动包成单个阶段，阶段名取 `meta.testStage`，缺省为「集成测试」。

---

## 主要公开函数

| 函数 | 用途 |
|---|---|
| `build_full(template, data, out_path)` | 整项目报告，按测试阶段分章 |
| `build_single_step(template, data, out_path)` | 单条用例/步骤报告，一张表一页 |
| `build_case_code(...)` | 拼用例标识（`GN-651-<项目缩写>-...-T001.CTD`） |
| `build_trace_code(case_code)` | 由用例标识推出需求追踪条目编号 |
| `fill_case_table(...)` | 往模板表格里填一条用例 |
| `fill_distribution_table(...)` | 填测试类型分布表 |
| `fill_record_table(...)` | 填测试记录汇总表 |
| `build_overall_evaluation(...)` | 生成总体评估段落 |

其余以下划线开头的都是内部辅助函数，不要在外部调用。

---

## 用例标识规范

```
GN-651-JYSG_SRS_UI_TESTING-1-T001.CTD
│   │    │                  │ │    │
│   │    │                  │ │    └─ .CTD 固定后缀
│   │    │                  │ └────── T001 序号
│   │    │                  └──────── 1=正常 / 2=测异常
│   │    └─────────────────────────── 项目缩写（SRS=需求文档 / DM=代码归纳）
│   └──────────────────────────────── 651 固定
└──────────────────────────────────── 类型缩写 GN/JK/AQ/XN/BJ/QD/YL
```

`build_trace_code()` 会把 `-N-Tnnn.CTD` 去掉，得到需求追踪条目编号。

---

## 常见问题

**报「找不到模板」** — 按上面「模板」一节三种方式之一指定。

**报 `ModuleNotFoundError: No module named 'docx'`** — 当前 Python 没装 python-docx。换用 DSH 自带那个 python.exe，或 `pip install python-docx`。

**生成的报告打不开 / 提示损坏** — 先确认模板本身能正常打开。模板被别的工具改过（比如另存为）可能破坏 `numbering.xml`，报告依赖它的自动编号。

**生成的报告章节结构不对 / 少了某几章** — 检查 `data` 里有没有 `stages`：有 `stages` 才有多个章节；只给 `features` 时只有一个阶段、一章。

**跟单元测试报告搞混了** — 本目录只产出集成测试报告。单元测试报告在 `testReport/report-tool/`，走 `bridge.py` + `cmd.py`，模板和数据格式都不同。