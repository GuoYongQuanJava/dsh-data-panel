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

`输出/` 目录在首次运行时自动创建，存放生成的 docx。

---

## 依赖

- **Python 3**（实测 3.12）
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

- `样例1-整项目完整报告.docx` ← `build_full`，按测试阶段分章
- `样例2-单个测试步骤报告.docx` ← `build_single_step`，一张表一页

### 在真实流程里调用

集成测试 Skill 是**写一段 Python 脚本 import 本模块**再调用，不是直接命令行跑：

```python
import sys
sys.path.insert(0, r"<仓库根>\integrationReport")
from integration_report import build_full, build_single_step
from pathlib import Path

# 整项目报告：data 要按 stages 组织（不是平铺 features）
data = { "meta": {...}, "people": {...}, "stages": [ { "name": ..., "features": [...],
         "issues": [...], "inconsistent": [...], "regression": [...] } ] }
build_full(Path(r"<模板路径>"), data, Path(r"<输出>\报告.docx"))

# 单条步骤报告：一张表一页，不带章节号与表题
build_single_step(Path(r"<模板路径>"), step_data, Path(r"<输出>\单条.docx"))
```

> ⚠️ **两个函数不能混用**：单条报告用 `build_single_step`，整项目报告用 `build_full`。
> 拿 `build_full` 生成单条会套上整本模板（曾踩过：产出 60 份 70KB 的大报告）。

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

**跟单元测试报告搞混了** — 本目录只产出集成测试报告。单元测试报告在 `testReport/report-tool/`，走 `bridge.py` + `cmd.py`，模板和数据格式都不同。