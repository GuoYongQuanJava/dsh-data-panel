# 测试报告生成

把**测试执行结果**填进客户给定的 Word 模板，输出一份可直接交付的测试报告。

输入是一份 JSON（用例、输入、预期输出、实际输出、通过与否），输出是填好的 `.docx`。

---

## 1. 环境要求

| 项 | 要求 | 必需 |
|---|---|---|
| Python | 3.10 或更高 | ✅ |
| python-docx | 1.1 或更高 | ✅ |
| Microsoft Word | 任意较新版本（2016 / 365） | ⬜ 可选 |

装依赖：

```powershell
pip install -r requirements.txt
```

```bash
pip3 install -r requirements.txt
```

**Word 是可选的**，但强烈建议装：

- **有 Word** → 生成时自动重算目录页码，打开文档**不会**弹「是否更新域」
- **没 Word** → 自动降级，目录留空，打开时 Word 会问一次「是否更新域」，点「是」即可

---

## 2. 五分钟跑通

### 第一步：用示例数据生成一份报告

```powershell
python report-tool/cmd.py `
  --template templates/单元测试报告模板.docx `
  --data examples/auth-demo.json `
  -o 示例报告.docx
```

（macOS / Linux 把 `python` 换成 `python3`，反引号换行改成 `\`）

人员（设计者/校对者/测试人员）写在数据 JSON 的 `meta.people`；也可用 `--config testReport/skills/<工作区名>.md` 传入项目配置。`--skill` 仅为兼容旧调用保留，传了不生效。

看到这个就成功了：

```
phases=3  functions=3  cases=8  passed=6  failed=1  notRun=1  unconfirmed=0  toc_cleared=0
目录：已重建（OK toc=1 pages=9）
报告已生成：示例报告.docx
```

### 第二步：校验产物

```powershell
python report-tool/verify_report.py `
  示例报告.docx `
  examples/auth-demo.json `
  templates/单元测试报告模板.docx
```

最后一行必须是：

```
ALL CHECKS PASSED
```

### 第三步：打开看

用 Word 打开 `示例报告.docx`。应该看到：

- 目录有 5 条，页码正确，**没有弹窗**
- 3 个阶段章节
- 8 张用例表，其中 1 条未通过（红色异常描述）、1 条未执行（勾在「未执行」）

---

## 3. 目录说明

```
.
├── README.md                        本文件
├── requirements.txt                 依赖清单
├── report-tool/                     核心脚本
│   ├── cmd.py                       ★ 命令行入口
│   ├── verify_report.py             ★ 独立校验器
│   ├── builder.py                   流程编排：清空模板 → 按数据重建章节和表格
│   ├── filler.py                    单表填充：写值、勾选框、变量行增删
│   ├── schema.py                    输入 JSON 校验
│   ├── skill_meta.py                （已废弃）旧版从 skill 读人员，v2 不再使用
│   ├── toc_refresh.py               用 Word 重算目录
│   ├── make_blank_template.py       把样例模板清空成空白表单
│   ├── GENERATE-DATA.md             ★ 数据契约（造数据必读）
│   ├── README.md                    技术文档：原理、模板约定、已知限制
│   ├── 如何换模型生成.md             让其他 AI 生成数据的话术
│   ├── 来源对照表.md                 报告里每个字段从哪来的对照表
│   └── test_*.py                    单元测试（3 个文件）
├── templates/
│   └── 单元测试报告模板.docx        ★ 正式模板（唯一可用，自带用例表原型）
├── vendor/lizard/                   圈复杂度分析（本机没装 lizard 时自动用它）
└── examples/
    ├── auth-demo.json               3 阶段 8 用例（含未执行）
    ├── calculator-data.json         3 阶段 12 用例（全部通过）
    └── paygate-demo.json            3 阶段 16 用例（含失败与未执行）
```

**先看哪个文件**：

| 你的角色 | 看什么 |
|---|---|
| 要跑出报告 | 本 README 第 2 节 |
| 要造测试数据 | `report-tool/GENERATE-DATA.md` |
| 要改代码 | `report-tool/README.md` |
| 想换 AI 生成数据 | `report-tool/如何换模型生成.md` |
| 要审核报告内容 | `report-tool/来源对照表.md` |

---

## 4. 改成自己的项目

### 4.1 项目资料替换

| 要替换的 | 换成什么 |
|---|---|
| `templates/单元测试报告模板.docx` | 客户的模板（先用 `make_blank_template.py` 清空，见 4.3） |
| 项目配置 `testReport/skills/<工作区名>.md` | 人员与软件信息默认值；用 `--config` 传入 |
| 用例/函数/阶段级的 `designer` / `reviewer` / `tester` | 实际人员信息；优先级高于项目配置 |
| `examples/auth-demo.json` | 自己的执行结果数据 |

### 4.2 数据怎么写

完整契约见 `report-tool/GENERATE-DATA.md`，最小示例：

```json
{
  "schemaVersion": "2.0",
  "meta": { "project": "订单服务单元测试", "executedAt": "2026-11-14" },
  "summary": { "total": 1, "passed": 1, "failed": 0, "notRun": 0 },
  "phases": [{
    "phaseId": "phase-1",
    "name": "第1阶段",
    "order": 1,
    "functions": [{
      "functionId": "价格计算单元测试",
      "name": "价格计算单元测试",
      "summary": { "total": 1, "passed": 1, "failed": 0, "notRun": 0 },
      "coverage": "-S 92.1%",
      "cases": [{
        "id": "ORD-PRICE-0001",
        "name": "三件商品总价",
        "type": "功能测试",
        "description": "按单价乘数量求和，验证总价。",
        "inputs": [["unit_price", "19.90"], ["quantity", "3"]],
        "outputs": [["total", "59.70", "59.70"]],
        "passed": true
      }]
    }]
  }]
}
```

**人员（设计者/校对者/测试人员）写在 `meta.people`**；也可放进项目配置（`--config`）传入。回落顺序：用例级 → 函数级 → 阶段级 → `meta.people`。`inputs` / `outputs` 必须是数组，没有值时写 `[]`。

### 4.3 模板换了怎么办

先用工具清空：

```powershell
python report-tool/make_blank_template.py `
  你的客户模板.docx `
  templates/新模板-blank.docx
```

它会：

1. 只留第一张表作为原型，删掉其余
2. 只留第一个示例单元章节
3. 清空所有数据值，保留结构标签
4. 把三个原型段落换成占位符 `<MODULE-NAME>` / `<CASE-ID>` / `<ISSUE-TEXT>`

**如果客户模板的行结构不一样**（比如列数变了），要改 `make_blank_template.py` 里 `clear_table()` 的坐标，以及 `filler.py` 的取值列号。

---

## 5. 三种执行状态的表达

模板的「执行情况」「执行结果」两行能表达三种状态：

| `status` | 执行情况 | 执行结果 | 什么时候用 |
|---|---|---|---|
| `passed` | 勾「执行」 | 勾「通过」 | 测试跑通 |
| `failed` | 勾「执行」 | 勾「未通过」 | 断言不成立 |
| `notRun` | **勾「未执行」** | **两个都不勾** | AI 漏测、环境缺夹具、用例被跳过 |

`status` 可省略，省略时按 `passed` 布尔推导。

`notRun` 的用例：`passed` 必须为 `false`，实际输出列会自动填「未执行」，`notRunReason` 会前置到异常描述。

---

## 6. 常见问题

### Q：生成时报「文件被占用」

```
无法写入 报告.docx：文件被占用。若它正在 Word/WPS 中打开，请先关闭再重试……
```

关掉正在打开该文件的 Word，或换个输出名（`-o 另一个名字.docx`）。

### Q：目录是空的，或者弹「是否更新域」

本机没装 Microsoft Word。两种情况：

- 报告内容和表格都是对的，只是目录没算页码
- 打开时点「是」即可

想彻底避免：在装了 Word 的 Windows 上生成。或者加 `--no-toc-refresh` 明确跳过这一步（日志会说明）。

### Q：报错 `模板缺少 <CASE-ID> 占位符`

模板既没有 `<CASE-ID>` 占位符，也没有 `.....CTD` 样例段落。你的模板没经过清理，用 `make_blank_template.py` 处理一下。

### Q：报错 `phases[x].functions[y].cases[z].xxx: ...`

数据不合契约。报错里带精确路径，按路径改 JSON 即可。

### Q：输出里的 `toc_cleared` 不是 0

`toc_cleared` 是清掉的目录缓存节点数，取决于模板里残留多少旧目录条目。
它是诊断信息，不是失败条件；不为 0 也能正常出报告。

### Q：怎么验证报告填得对

```powershell
python report-tool/verify_report.py 报告.docx 你的数据.json 模板.docx
```

它不复用生成逻辑，独立读 docx 逐个单元格比对，输出几百条 `PASS` 或具体 `FAIL`。

---

## 7. 退出码

| 码 | 含义 | 怎么办 |
|---|---|---|
| 0 | 成功 | 继续 |
| 1 | 数据文件不存在 / JSON 语法错 | 查路径和 JSON 格式 |
| 2 | 数据不符合契约 | 按报错里的字段路径修 |
| 3 | 模板结构不可用 | 确认模板经过清理、没被改坏 |
| 4 | 未预期异常 | 看完整堆栈 |
| 5 | 输出文件被占用 | 关掉 Word 或换 `-o` |

---

## 8. 已知限制

1. **目录重建依赖 Microsoft Word**。Linux / macOS 上没有 Word，会降级为「打开时提示更新域」。如需跨平台，可以自行接入 LibreOffice headless。
2. **模板结构强依赖**。换模板且行/列结构变化时，需要改 `filler.py` 的坐标。
3. **所有模块共用一张表原型**。如果某些模块需要不同的表格结构（比如性能模块多一行"响应时间"），当前版本不支持，需要扩展多原型机制。
4. **勾选框使用 Word 的 EQ 公式域**。非 Word/WPS 的阅读器可能只显示方框不显示勾。
5. **无结果总览表**。模板本身没有汇总表，如需可在 `builder.py` 里加一段。
6. **测试类型固定五种**（功能/接口/边界/逻辑/性能）。来自客户模板的勾选框，增减需同时改模板和 `schema.py`。

---

## 9. 跑单元测试

```powershell
cd report-tool
python test_schema.py       # 输入校验：v2 契约（schemaVersion/阶段平衡/唯一性/notRun）
python test_edges.py        # 0~8 组变量、多阶段多函数、模板缺标记、6 种退出码
python test_coverage.py     # 6 种格式 + 旧版 VS XML、两段采集、bridge 标签
python test_complexity.py   # 圈复杂度：本机 lizard / vendor 副本 两种来源与降级
python test_skill.py        # 项目配置文件解析（两种写法/注释/首值优先）
```

五个都应以 `ALL ... PASSED` 结束。
---

## 📌 想交给 AI 模型来跑？

如果你的意图是「让一个大模型来代替人执行这套流程」，先看 **[让AI来跑.md](让AI来跑.md)**。

要点只有三条：

1. **工作区设成这个包的根目录**（有 README.md 的那一层），所有命令都用相对路径
2. **第一步永远先跑自检**：`python report-tool/doctor.py`，出现 ❌ 就停下装依赖
3. **不要修改 `report-tool/` 下的 .py 文件**，报错就改数据，改代码等于绕过测试

自检脚本会逐项检查 Python 版本、python-docx、包内文件、数据契约、目录写权限、Word 可用性，
最后给出 `✅ 环境可用` 或具体的阻塞项。
