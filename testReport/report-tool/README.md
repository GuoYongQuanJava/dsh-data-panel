# 测试报告生成（T08）

把**真实测试执行结果**填入客户提供的 Word 模板，输出可直接交付的 `.docx` 报告。

本模块只做 T08：不生成用例、不执行测试。上游（T03/T07）产出 JSON，这里负责变成报告。

---

## 快速开始

```powershell
# 准备一个 python-docx 环境，或用 DSH 自带的
$py = 'C:\Users\PC\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\python\python.exe'

# 生成报告（测试人员来自 skill 文件）
& $py cmd.py --template "C:\Users\PC\Desktop\RingBuffer-test(1).docx" `
             --data results.json `
             --skill "<你的 skill 目录>" `
             -o report.docx
```

输出：

```
modules=3  cases=8  passed=7  failed=1  notRun=0  removed=74  toc_cleared=29
目录：已重建（OK toc=1 pages=9）
skill=<你的 skill>  →  设计者=…，校对者=…，测试人员=…
报告已生成：D:\1\report-tool\report.docx
```

`--skill` 可省略。省略时测试人员取执行结果 JSON 里的值，JSON 也没写就留空。

也支持从标准输入读数据（宿主进程管道调用，不落临时文件）：

```powershell
Get-Content results.json -Raw | & $py cmd.py --template t.docx --data - --skill sk.md -o r.docx
```

---

## 人员字段：来自 skill 文件

**设计者、校对者、测试人员**三个字段来自 skill 文件。其余字段——单元标识、设计追溯、驱动模块、覆盖率、问题描述——都是**本次执行的技术产出**，必须由执行系统写进数据 JSON。

### skill 怎么写

frontmatter（推荐）：

```yaml
---
name: your-project-unit-test
description: 某模块单元测试流程
designer: 张伟
reviewer: 刘洋
tester: 王芳
---
```

或正文表格：

```markdown
| 角色 | 姓名 |
| --- | --- |
| 设计者 | 张伟 |
| 校对者 | 刘洋 |
| 测试人员 | 王芳 |
```

DSH 的 skill 加载器只读 `name` / `description`，其他键会被忽略，所以放这三个人员字段不影响 skill 正常调用。

**skill 里写 `coverage` / `driver` / `unitId` / `trace` 之类的键会被脚本忽略**，不会静默改变报告内容。

### 取值优先级

```
执行数据（用例级） > 执行数据（模块级） > skill 文件 > 空
```

三个人员字段都适用这条规则。数据里写了就覆盖 skill 的值，适用于临时换人。

| 字段 | 来源 |
|---|---|
| `designer` / `reviewer` / `tester` | 用例级 → 模块级 → **skill** → 空 |
| `name` / `unitId` / `trace` / `driver` / `coverage` / `issues` / `inconsistent` | 模块级（有默认值，但真实值应由系统采集） |

---

## 模块组成

| 文件 | 职责 | 说明 |
|---|---|---|
| `schema.py` | 输入校验 | 字段、类型、枚举、唯一性、统计一致性；错误带字段路径 |
| `skill_meta.py` | skill 元信息 | 从 `SKILL.md` 读人员/覆盖率/驱动模块，frontmatter + 正文表格双支持 |
| `filler.py` | 单表填充 | 单元格写入保留格式；勾选框用 EQ 域；变量行按需增删 |
| `builder.py` | 流程编排 | 截断模板正文 → 按模块/用例循环克隆标题与表格 → 组装 |
| `toc_refresh.py` | 目录自动重建 | 用 Word COM 重算目录并清掉 `updateFields`，打开文档不弹提示 |
| `make_blank_template.py` | 清空模板 | 把客户原始模板清理成空白表单（保留结构标签 + 占位符） |
| `cmd.py` | CLI 入口 | 参数解析、退出码、stdin 支持、文件占用提示 |
| `verify_report.py` | 产物校验 | 数据驱动：所有期望值从 JSON 推导，不硬编码任何 fixture |
| `test_schema.py` | 校验单测 | 25 条用例覆盖缺失/类型/枚举/一致性/空集/notRun |
| `test_skill.py` | skill 单测 | frontmatter/表格解析、优先级、多模块 unitId 隔离 |
| `test_edges.py` | 边界与 CLI 单测 | 0~8 组变量、多模块、模板损坏、6 种退出码 |
| `auth-demo.json` | 全新演示数据 | 认证服务 8 条用例（含 1 条未执行），与模板样例零重叠 |
| `fresh-demo.json` | 演示数据 | 订单中心 8 条用例 |
| `demo.json` | 旧演示数据 | RingBuffer 5 条用例（保留做回归） |
| `demo-nopeople.json` | 无人员数据 | 用于验证 skill 注入 |

---

### 执行状态：通过 / 未通过 / 未执行

模板的「执行情况」「执行结果」两行能表达三种状态，用 `status` 字段区分：

| `status` | 执行情况 | 执行结果 | 典型场景 |
|---|---|---|---|
| `passed` | `[√]执行` □ 未执行 | `[√]通过` □ 未通过 | 正常跑通 |
| `failed` | `[√]执行` □ 未执行 | □ 通过 `[√]未通过` | 断言不成立 |
| `notRun` | □ 执行 **`[√]未执行`** | □ 通过 □ 未通过（都不勾） | **AI 漏测、环境缺夹具、用例被跳过** |

`status` 可省略：省略时按 `passed` 推导（`true` → `passed`，`false` → `failed`）。

`notRun` 的额外约定：

- `passed` 必须为 `false`（没执行不可能"通过"）
- `outputs` 的第三项（实际输出）留空，生成时会自动填「未执行」
- `notRunReason` 写原因，生成时会前置到「异常现象描述」：`未执行：<原因>`
- `summary` 里要加 `notRun` 计数：`total = passed + failed + notRun`，且必须与用例实际状态吻合
- 模块统计行会多出「未执行 N 条」，仅在 N > 0 时出现

```jsonc
{
  "summary": { "total": 8, "passed": 6, "failed": 1, "notRun": 1 },
  "cases": [
    {
      "id": "AUTH-PERM-0003",
      "name": "跨租户资源越权访问",
      "passed": false,
      "status": "notRun",
      "notRunReason": "该用例依赖多租户测试夹具，当前执行环境未部署夹具，执行集跳过本条。",
      "outputs": [["granted", "false", ""]]   // 实际输出留空
    }
  ]
}
```

`summary.executedRate` 是校验后派生出来的执行率（`(passed+failed)/total`），生成时用于提示，不写进 Word。

## 输入数据契约

```jsonc
{
  "meta": {
    "project": "订单中心单元测试",              // 必填
    "executedAt": "2026-11-13T20:10:00+08:00", // 必填，ISO-8601 或 yyyy/mm/dd
    "executor": "gtest-1.14 / gcc-13.2"        // 可选，默认 dsh-test-harness
  },
  "summary": {
    "total": 8,     // 必填，必须等于所有模块用例数之和
    "passed": 7,    // 必填
    "failed": 1,    // 必填
    "notRun": 0     // 可选，未执行数；total = passed + failed + notRun
  },
  "modules": [                                  // 必填，非空
    {
      "name": "订单金额计算单元测试",             // 必填 → 「编号标题3」
      "unitId": "订单金额计算单元测试",           // 可选 → 表格行0「单元标识」，默认取 name
      "trace": "详细设计 5.9.2 订单金额",         // 可选 → 行0「设计追溯」，默认 "-"
      "driver": "无",                            // 可选 → 行0「驱动模块」，默认 "无"
      "coverage": "-S 92% -B 85% -MCDC n/a",     // 可选 → 行0「覆盖率记录」，默认 "-"（不推断）
      "issues": "无。",                          // 可选 → 「遇到的问题」正文
      "inconsistent": "无。",                    // 可选 → 「与测试用例/规程的不一致」正文
      "cases": [                                // 必填，非空
        {
          "id": "ORD-CALC-0001",                // 必填，全局唯一
          "name": "三件商品订单金额计算",          // 必填
          "type": "功能测试",                    // 必填，五选一
          "description": "按单价与数量计算小计…",  // 必填
          "funcDesc": "订单金额计算",             // 可选 → 行0「功能描述」，默认取 name
          "stub": "库存服务（StubStockService）", // 可选 → 行0「打桩模块」+「活动桩」
          "inserted": "无",                      // 可选 → 「插入代码」
          "inputs":  [["items_count", "3"]],     // 可选，[变量名, 取值]
          "outputs": [["subtotal", "59.70", "59.70"]], // 可选，[变量名, 预期, 实际]
          "passed": true,                        // 必填，passed 与 status 需自洽
          "status": "passed",                    // 可选：passed | failed | notRun
          "notRunReason": "",                    // 可选：未执行原因
          "issue": "无",                         // 可选 → 异常现象描述
          "bugId": "BUG-ORD-0042",               // 可选 → 软件问题单编号
          "designer": "李航",                    // 可选
          "reviewer": "周敏",                    // 可选 → 校对者
          "tester": "李航",                      // 可选 → 测试人员
          "executedAt": "2026/11/13"             // 可选 → 测试执行时间
        }
      ]
    }
  ]
}
```

`type` 枚举：`功能测试` `接口测试` `边界测试` `逻辑测试` `性能测试`
（枚举来自客户模板类型行的五个复选框，模板改了就同步改 `schema.py` 的 `TYPE_OPTIONS`）

---

## 模板约定

代码**不识别**任意模板，而是要求模板满足固定结构。支持两种模板：

| 模板 | 特点 | `removed=` |
|---|---|---|
| `templates/RingBuffer-test.docx` | 客户原始样例（12 张表、6 个模块的 RingBuffer 数据） | 74 |
| `templates/RingBuffer-test-blank.docx` | 已清空的空白表单（1 张空表 + 占位符） | 10 |

两者生成的报告**逐单元格完全一致**。

### 空白模板怎么来的

`make_blank_template.py` 把原始模板清理成空白表单：

```powershell
& $py make_blank_template.py `
      D:\1\templates\RingBuffer-test.docx `
      D:\1\templates\RingBuffer-test-blank.docx
```

它做三件事：

1. **只留一张表**作为原型，删掉其余 11 张
2. **只留第一个模块章节**，删掉其余 5 个
3. **清空所有数据值，保留结构标签**，并把三个原型段落换成占位符：
   - 模块标题 `RingBuffer单元测试` → `<MODULE-NAME>`
   - 用例标识 `GN-ZZKZ-RINGBUFFER-T001.CTD` → `<CASE-ID>`
   - 问题正文 `无。` → `<ISSUE-TEXT>`

| 位置 | 内容 | 用途 |
|---|---|---|
| `编号标题2` 段落 | 「通用模块」 | 保留到此为止，之后内容全部重建 |
| `编号标题3` 段落 | `<MODULE-NAME>` | 克隆成每个模块标题 |
| `编号标题4` 段落 | 「测试结果总结」 | 克隆成总结/问题/不一致三个小标题 |
| `<CASE-ID>` 段落 | 占位符 | 克隆成每条用例的标识标签 |
| `<ISSUE-TEXT>` 段落 | 占位符 | 克隆成统计行与问题正文 |
| 第一张表格 | 用例表原型（已清空数据） | 深拷贝成每一条用例的表 |

> 代码定位顺序：**先找占位符，找不到再回退到原始模板的样例文字**（`.CTD` / `无。`），
> 所以两种模板都能用。

### 清空模板时必须保留什么

不能无脑清空 —— 下面这些是**结构标签**，清掉会导致生成失败：

| 必须保留 | 原因 |
|---|---|
| `编号标题1/2/3/4` 段落 | 标题格式原型，用于克隆与自动编号 |
| 表格行标题：`测试用例名称` `测试用例标识` `通过准则` `异常现象描述` `软件问题单编号` `设计者` `校对者` `执行情况` `执行结果` `测试人员` `测试执行时间` | 代码靠这些文字定位行 |
| 表格列标题：`输入` `输出` `变量名` `取值` `预期输出` `实际输出` | 表头 |
| 表头字段前缀：`单元标识：` `设计追溯：` `功能描述：` `驱动模块：` `打桩模块：` `覆盖率记录：` `备注：` | 行 0 的 7 个段落 |
| 五个测试类型名 | 类型行的固定选项 |
| 勾选域（EQ 公式） | 勾选状态的载体 |

表格内部骨架（11 列网格）：

```
行 0  单元标识 / 设计追溯 / 功能描述 / 驱动模块 / 打桩模块 / 覆盖率记录 / 备注
      （7 个独立段落，代码逐段落覆盖，保持原排版）
行 1  测试用例名称(c1..c4) | 测试用例标识(c5..c6) | ID(c7..c10)
行 2  测试类型 (整行合并)
行 3  活动桩 (整行合并)
行 4  测试说明 + 插入代码 (整行合并)
行 5  输入(c0..c3) | 输出(c4..c10)
行 6  变量名(c0..c2) | 取值(c3) | 变量名(c4..c7) | 预期(c8..c9) | 实际(c10)
行 7+ 变量数据行（按数据增删）
...   通过准则（锚点）
...   异常现象描述 | 软件问题单编号
...   设计者 | 校对者
...   执行情况 | 执行结果
...   测试人员 | 测试执行时间
```

目录（TOC）是域缓存，模板里存的是样例模块名。生成时分两步处理：

1. **清空缓存文本**（`toc_cleared`），避免旧模块名残留
2. **用 Word 自动重建**（`目录：已重建（OK toc=1 pages=9）`），生成后自动调 Word COM 重算目录并保存

第 2 步完成后 Word 会顺带清掉 `updateFields` 标记，所以**打开文档不会弹「是否更新域」的提示**。

前提是本机装了 Microsoft Word。没装时自动回退到 `updateFields`（目录空缺，打开时 Word 会问一次），命令行会明确提示：

```
目录：未重建，回退到 updateFields —— 找不到 powershell.exe
```

想强制跳过自动重建：`--no-toc-refresh`。

---

## 关键技术点

### 1. 保留单元格格式

直接 `cell.text = "..."` 会清掉字体、字号、颜色。正确做法是复制首个 `<w:r>` 的 `<w:rPr>`，只替换内容：

```python
new = deepcopy(run_el)
for child in list(new):
    if child.tag != qn("w:rPr"):
        new.remove(child)      # 只保留格式
node = new.makeelement(qn("w:t"), {})
node.text = text
new.append(node)
```

### 2. 勾选框是 EQ 域，不是字符

模板里的「√」用 Word 公式域 `eq \o\ac(□,√)` 把 √ 叠在 □ 上，由 7 个 run 组成：

```xml
<w:r><w:fldChar w:fldCharType="begin"/></w:r>
<w:r><w:instrText> eq \o\ac(</w:instrText></w:r>
<w:r><w:instrText>□</w:instrText></w:r>
<w:r><w:instrText>,</w:instrText></w:r>
<w:r><w:instrText>√</w:instrText></w:r>
<w:r><w:instrText>)</w:instrText></w:r>
<w:r><w:fldChar w:fldCharType="end"/></w:r>
```

所以代码用 `CHECK = "\ue000"` 作为占位符，写入时展开成上面 7 个 run。**不要换成 `☑` 字符**，那会改变字体和观感。

### 3. 变量行动态增删

- 数据组数 > 模板组数：`deepcopy` 模板行 → `addnext` 插入
- 数据组数 < 模板组数：删除多余行（避免残留样例数据）
- 增删后「通过准则」等锚点行索引要同步调整

### 4. 清空段落要连带清掉域

`paragraph.runs` 可能读不到被 `smartTag`/`sdt` 包裹的 run，导致旧域残留、新域叠加。所以清空时直接遍历 `<w:p>` 的子元素，只保留 `<w:pPr>`。

---

## 退出码

| 码 | 含义 |
|---|---|
| 0 | 成功 |
| 1 | 数据文件不存在 / JSON 语法错误 |
| 2 | schema 校验失败（字段缺失、类型错误、统计不一致等）|
| 3 | 模板结构不可用（缺标题样式、缺表格）|
| 4 | 未预期异常 |
| 5 | 输出文件被占用（多半是正在 Word/WPS 里打开）|

---

## 测试

```powershell
& $py test_schema.py        # 18 条校验场景
& $py test_skill.py         # skill 解析与注入优先级
& $py test_edges.py         # 变量行、多模块、模板损坏、CLI 退出码
& $py cmd.py --template RingBuffer-test.docx --data fresh-demo.json --skill ..\skills\<你的skill> -o report.docx
& $py verify_report.py report.docx fresh-demo.json RingBuffer-test.docx
```

---

## 已知限制

1. **目录重建依赖 Microsoft Word**：装了 Word 时生成后自动重建目录、清掉 `updateFields`，打开零提示。没装 Word 时回退到 `updateFields`，打开时 Word 会问一次「是否更新域」。LibreOffice 未实现（可作为后续增强）。
2. **模板结构强依赖**：换模板（列数、行序变化）需要改 `filler.py` 的坐标，或补一层模板配置。
3. **EQ 域在部分阅读器不渲染**：非 Word/WPS 的阅读器可能只显示方框。
4. **无结果总览表**：模板本身没有，如需可在 `builder.py` 里加一段。
5. **Word 重建会重写文档 XML**：自动化结束时会保存，页数、目录、格式由 Word 决定；已验证表格结构、勾选域、行 0 的 7 段落均保持不变。