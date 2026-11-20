# 集成测试报告生成器

把集成测试的结构化数据填进「配置项测试报告模板」模板，生成 Word 报告。

> **与单元测试报告工具（`testReport/`）是两套独立的东西**，互不 import、互不修改。
> 单元测试用 `testReport/report-tool/`，集成测试用本目录。别把两者的路径、模板、数据格式搞混。

---

## 文件

| 文件 | 说明 |
|---|---|
| `bridge.py` | **数据转换**：读一次执行的产物 → 写 `report-plan.json` + `report-data.json` → 调生成器 |
| `integration_report.py` | **生成器**：填表排版，出 docx（只做这一件事） |
| `配置项测试报告模板.docx` | 模板（随仓库进库，90 KB） |
| `sample-project.json` | 整项目报告的样例数据（供 `build_full`） |
| `sample-step.json` | 单条步骤报告的样例数据（供 `build_single_step`） |
| `README.md` | 本文件 |

`输出/` 目录在首次运行时自动创建，存放生成的 docx（已在 `.gitignore` 里，不进库）。

### 两层结构（与单元测试 `testReport/` 一致）

```
<会话>/integration/
    step-versions/<V>/steps.json + cases.snapshot.json   ← 输入
    runs/<runId>/result.json + observations.json          ← 输入
            ↓
    bridge.py                                            ← 数据转换（本目录）
            ↓
    reports/<runId>/report-plan.json                     ← 编排计划
    reports/<runId>/report-data.json                     ← 权威中间产物
            ↓
    integration_report.py                                ← 填表排版
            ↓
    reports/<runId>/集成测试报告-<项目>-整项目-<版本>.docx
    reports/<runId>/cases/….docx
```

**为什么拆两层**（照单元测试的做法）：

- **数据转换可复核**：`report-data.json` 是纯数据，出问题能直接看，不用去猜 docx 里为什么少一行。
- **编排计划可追溯**：`report-plan.json` 记录阶段怎么分、每个阶段有哪些功能项。报告结构不对时先看它。
- **职责不越界**：`bridge.py` 不碰任何表格填充，`integration_report.py` 不碰任何数据判断。

> ⚠️ **与单元测试是两套，不能混用**。单元测试用 `testReport/report-tool/bridge.py`，
> 数据是 `tests[]`；集成测试用本目录的 `bridge.py`，数据是 `steps[]`。
> 详见 `skills-integration/SKILL.md` 的「两套报告绝不能混用」一节。

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

**模板随本目录一起进库**（90 KB），克隆仓库后直接可用，不需要另外找人要。
这与单元测试的 `testReport/templates/单元测试报告模板.docx` 处理方式一致 ——
模板虽然是二进制，但缺了它就生成不出报告，让人额外去要等于链路断的。

前两种方式仍然保留：某个项目要换自己的模板样式时，用参数或环境变量覆盖即可，不用改仓库。

**注意两个模板不是同一个文件**：单元测试用 `单元测试报告模板.docx`（50 KB），
集成测试用 `配置项测试报告模板.docx`（90 KB，多出附录 A 问题报告单、
附录 B 问题处理单、单用例 16 行表等结构）。**不要互相替换**。

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

### 在真实流程里调用（推荐：走 bridge.py）

**正常情况一条命令就够**，不用自己组装数据结构：

```powershell
cd <仓库根>\integrationReport
python bridge.py --session-root <会话>\integration `
                 --run-id run_20261120_1020_all `
                 --project-code JYSG `
                 --software-name "肌颜时光" `
                 --software-version V0.0.1
```

它会依次完成：读步骤与快照 → 读执行结果与观察记录 → 生成/复用编排计划 →
组装 `report-data.json` → 调生成器出总体报告 + 每条用例一份单条报告。

常用参数：

| 参数 | 说明 |
|---|---|
| `--session-root` | **必填**，集成测试根目录（`<会话>/integration`） |
| `--run-id` | **必填**，本次执行的 runId |
| `--step-version` | 步骤版本，缺省取 `index.json` 的 `activeVersion` |
| `--project-code` | 项目缩写，用于用例标识（如 `JYSG`） |
| `--source` | `DM`（按代码归纳）或 `SRS`（有需求文档） |
| `--software-name` / `--software-version` | 报告封面与 3.1 段落用 |
| `--report-version` | 报告版本号。缺省从 `report-versions/index.json` 按 runId 查 |
| `--no-docx` | 只产出两份 json，不生成 docx（调试用） |

> **报告版本号必须由面板分配**。正确顺序：面板调
> `POST /data-panel/integration { kind:'report', op:'createVersion', runId }` 拿版本号，
> 再把这个版本号传给 `bridge.py`。脚本里写死 `V0.0.1` 会让第二次执行覆盖第一次。

产出（都在 `<会话>/integration/reports/<runId>/` 下）：

```
report-plan.json                              编排计划（阶段 → 功能项）
report-data.json                              权威数据（面板 + 生成器都读）
集成测试报告-<项目>-整项目-<版本>.docx           总体报告
cases/集成测试报告-<caseId>-全步骤-<版本>.docx   每条用例一份
```

### 只想要生成器（不经过 bridge.py）

`integration_report.py` 也能直接用，但它**只负责填表**，数据得你自己组装：

```python
import importlib.util
from pathlib import Path

# 按插件包自身位置定位，不要写死绝对路径
PROTOTYPE = Path("<仓库根>/integrationReport/integration_report.py")
spec = importlib.util.spec_from_file_location("ir", PROTOTYPE)
proto = importlib.util.module_from_spec(spec)
spec.loader.exec_module(proto)

data = {
    "meta":   { "softwareName": ..., "projectCode": "JYSG", "source": "SRS", ... },
    "people": { "designer": ..., "reviewer": ..., "tester": ... },
    "stages": [ ... ]
}
proto.build_full(Path("<模板>"), data, Path("<输出>/报告.docx"))
proto.build_single_step(Path("<模板>"), step_data, Path("<输出>/单条.docx"))
```

> ⚠️ **两个函数不能混用**：单条报告用 `build_single_step`，整项目报告用 `build_full`。
> 拿 `build_full` 生成单条会套上整本模板（曾踩过：产出 60 份 70KB 的大报告）。

---

## 数据结构

`build_full` 的 `data` **两种结构都吃**：

**写法一：`features` 平铺（单阶段）**

```json
{ "meta": {...}, "people": {...}, "features": [ { "code", "name", "cases": [...] } ] }
```

只有一个阶段，报告只有一章。

**写法二：`stages` 分阶段（多章）** —— **推荐，正式报告一律用这个**

```json
{
  "meta": {...}, "people": {...},
  "stages": [
    {
      "name": "第一阶段",
      "startDate": "2026 年 11 月 10 日",
      "endDate": "2026 年 11 月 12 日",
      "features": [ { "code", "name", "stage": "第一阶段", "cases": [...] } ],
      "issues": [...],
      "inconsistent": "无",
      "regression": { "date", "version", "features": [...] }
    }
  ]
}
```

每个阶段生成一章（4、5、6…）。没给 `stages` 时，脚本会把 `features` 自动包成单个阶段，阶段名取 `meta.testStage`，缺省为「集成测试」。

完整例子见 `sample-project.json`（三阶段示范）。

**阶段在数据里的位置**：功能项写 `stage`，用例也带 `stage`（继承同一阶段）。
报告侧全部按 `stage` 生成：

- 3.1 总体评估 —— 每阶段一段；
- 3.1 分布统计表 —— 同阶段的「序号」「测试阶段」两列纵向合并，每阶段一组小计；
- 3.1 测试结果记录单 —— 「测试阶段」「功能点名称」两列按连续同值纵向合并；
- 第 4 章起 —— 每阶段一章。

---

## 主要公开函数

| 函数 | 用途 |
|---|---|
| `build_full(template, data, out_path)` | 整项目报告，按测试阶段分章 |
| `build_single_step(template, data, out_path)` | 单条用例/步骤报告，一张表一页 |
| `pick_case_code(case, meta, seq)` | **取规范用例标识**，绝不退回内部 `caseId` |
| `build_case_code(...)` | 拼用例标识（`GN-651-<项目缩写>-...-T001.CTD`） |
| `build_trace_code(case_code)` | 由用例标识推出需求追踪条目编号 |
| `fill_case_table(...)` | 往模板表格里填一条用例 |
| `fill_distribution_table(...)` | 填测试类型分布表（阶段合并 + 小计） |
| `fill_issue_table(...)` | 填软件问题分类统计表 |
| `fill_record_table(...)` | 填测试记录汇总表（阶段/功能项纵向合并） |
| `fill_issue_report_table(...)` | 填附录 A 一张软件问题报告单 |
| `fill_issue_fix_table(...)` | 填附录 B 一张软件问题处理单 |
| `build_overall_evaluation(...)` | 生成 3.1 总体评估段落（按阶段） |
| `build_sufficiency_section(...)` | 生成 3.2 充分性分析（换掉 `xxx`） |
| `build_environment_section(...)` | 生成 3.3 测试环境的影响 |
| `set_table_layout(table, widths)` | 把表格改成 fixed 布局并写死列宽 |
| `relax_line_spacing(table)` | 放开模板里过紧的行距（长标识不再糊成一团） |

其余以下划线开头的都是内部辅助函数，不要在外部调用。

---

## 表格排版：列宽固定

模板里的表都是 `tblLayout=autofit`，Word/WPS 按内容算列宽 —— 长英文用例标识一落进
窄列就把整表挤变形（标签列被压成一竖排字、右侧留一大片空白）。

生成器对每张数据表都做 `set_table_layout()`：`fixed` 布局 + 逐列写死宽度，铺满
A4 版心（11906 − 左右页边距各 1800 = **8306 缇**）。要调列宽就改这几个常量：

| 常量 | 对应表 | 列数 |
|---|---|---|
| `INFO_TABLE_WIDTHS` | 1.2 软件信息表 | 9 |
| `DISTRIBUTION_WIDTHS` | 3.1 分布统计表 | 11 |
| `ISSUE_TABLE_WIDTHS` | 3.1 软件问题分类统计 | 8 |
| `RECORD_TABLE_WIDTHS` | 3.1 测试结果记录单 | 6 |
| `CASE_TABLE_WIDTHS` | 4.x.1 单用例表 | 5 |
| `APPENDIX_ISSUE_WIDTHS` | 附录 A 问题报告单 | 6 |
| `APPENDIX_FIX_WIDTHS` | 附录 B 问题处理单 | 5 |

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

**报告里的「测试用例标识」列只允许出现上面这个形态。**

内部主键 `caseId`（形如 `V0_0_1-IT-001`）**绝不允许**落进这一列 —— 它带版本前缀，
看着就像版本号，正是「有的报告标识写得跟版本号一样、有的又对」的根因。
`pick_case_code()` 封死了这条路：

1. 用例自带合法 `caseCode` → 用它；
2. 没有、或形状不合规（例如被填成了 `caseId`）→ **按规范现场生成**；
3. 连项目缩写都没有 → 写 `T001` 占位，**也不退回 `caseId`**。

---

## 附录 A / 附录 B

两张附录**都是表格**，不是文字段落：

- **附录 A 软件问题报告单** —— 每条问题一张表（10 行 6 列），
  含问题编号 / 类别 / 级别 / 研发阶段 / 现象描述 / 更改建议 / 签字。
- **附录 B 软件问题处理单** —— 每条问题一张表（13 行 5 列），
  含处理责任人 / 处理措施 / 处理结果 / 未处理原因 / 影响分析 / 回归确认。

处理情况按**实际**填：参数 `handled: false`（默认）就写「处理结果：未处理」+
未处理原因，**不会**为了好看编一个「已修改」。

---

## 常见问题

**报「找不到模板」** — 按上面「模板」一节三种方式之一指定。

**报 `ModuleNotFoundError: No module named 'docx'`** — 当前 Python 没装 python-docx。换用 DSH 自带那个 python.exe，或 `pip install python-docx`。

**生成的报告打不开 / 提示损坏** — 先确认模板本身能正常打开。模板被别的工具改过（比如另存为）可能破坏 `numbering.xml`，报告依赖它的自动编号。

**生成的报告章节结构不对 / 少了某几章** — 检查 `data` 里有没有 `stages`：有 `stages` 才有多个章节；只给 `features` 时只有一个阶段、一章。

**报告里「测试用例标识」变成了 `V0_0_1-IT-001` 这种像版本号的串** — 这是把内部主键 `caseId` 当成了标识。现在生成器已封死这条路（见「用例标识规范」），若仍出现，说明用的是旧版 `integration_report.py`，更新它。

**表格被挤成一竖排字 / 右侧一大片空白** — 列宽没固定。确认生成器里有 `set_table_layout()` 调用；不要靠调字号去凑。

**报告页反复一键执行版本号还是 V0.0.1** — 报告版本号必须调
`POST /data-panel/integration`（`kind:"report", op:"createVersion"`）向面板要。
脚本里写死 `V0.0.1` 或自己重写 `report-versions/index.json` 就会盖掉上一次报告。

**跟单元测试报告搞混了** — 本目录只产出集成测试报告。单元测试报告在 `testReport/report-tool/`，走 `bridge.py` + `cmd.py`，模板和数据格式都不同。