# 给「生成测试数据」的模型看的任务说明

> 如果你是被要求「生成一份测试执行结果 JSON，然后跑通报告生成」的模型，按本文档执行。
> 你是**数据供给侧**，不是报告代码的作者。不要改 `report-tool/` 里的任何 `.py` 文件。

---

## 你的任务

1. 编写一份测试执行结果 JSON
2. 调用报告生成脚本，把 JSON 填进 Word 模板
3. 用校验脚本确认产物正确

---

## 环境

| 项 | 值 |
|---|---|
| 工作区 | `D:\1` |
| Python | `C:\Users\PC\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\python\python.exe`（已装 python-docx） |
| 模板（正式，唯一可用） | `D:\1\templates\单元测试报告模板.docx` |
| 用例表原型 | 正式模板自带（13×11），无需单独准备 |
| 生成脚本 | `D:\1\report-tool\cmd.py` |
| 校验器 | `D:\1\report-tool\verify_report.py` |
| skill 目录 | `D:\1\skills\<你的项目名>\SKILL.md` |

有 Microsoft Word 时，`cmd.py` 会自动重建目录（打开文档不弹提示）。

正式模板自带 13×11 用例表原型，生成时直接用模板里那张表。

---

## 字段从哪来（重要）

| 字段 | 来源 | 说明 |
|---|---|---|
| **`designer` / `reviewer` / `tester`** | **skill 文件** | 只有这三个人员字段来自 skill。「谁设计、谁校对、谁执行」是流程属性，项目定一次就固定 |
| `name` / `functionId` / `unitId` / `trace` / `driver` / `coverage` | **执行数据（函数级）** | 系统分析代码、查设计文档、调覆盖率工具得到 |
| `phaseIssues` / `phaseInconsistent` | **执行数据（阶段级）** | 执行过程中汇总的问题 |
| 用例的全部字段（`id`/`name`/`type`/`inputs`/`outputs`/`passed`/`status`/`issue`/`bugId`/`executedAt`） | **执行数据（用例级）** | 用例与结果 |

**除三个人员字段外，其余一律写进 JSON，不要指望 skill 提供。**
skill 里就算写了 `coverage` / `driver` 之类的键，脚本也会忽略。

人员字段也可以在数据里覆盖 skill（用例级 > 函数级 > 阶段级 > skill），用于临时换人。

---

## 数据契约（必须严格遵守）

### 顶层结构

```jsonc
{
  "schemaVersion": "2.0",
  "meta": {
    "project": "项目名",                          // 必填
    "executedAt": "2026-11-14T10:00:00+08:00",   // 必填，ISO-8601 或 yyyy/mm/dd
    "executor": "gtest-1.14 / gcc-13.2 / Linux"  // 可选
  },
  "summary": {
    "total": 8,        // 必填 = 所有阶段用例数之和
    "passed": 6,       // 必填
    "failed": 1,       // 必填
    "notRun": 1        // 可选，未执行数；total = passed + failed + notRun
  },
  "phases": [ /* 见下 */ ]
}
```

### 阶段与函数

阶段（phase）是报告顶层的迭代分组：

```jsonc
{
  "phaseId": "phase-1",                 // 必填，全局唯一
  "name": "第1阶段",                    // 必填 → 生成阶段标题
  "order": 1,                           // 必填，正整数，决定阶段顺序
  "phaseIssues": "无。",                 // 可选 → 「遇到的问题」
  "phaseInconsistent": "无。",           // 可选 → 「与测试用例/规程的不一致」
  "functions": [ /* 至少 1 个 */ ]
}
```

函数（function）是报告章节的三级标题：

```jsonc
{
  "functionId": "订单金额计算单元测试",   // 必填，跨阶段唯一
  "name": "订单金额计算",                 // 必填 → 生成三级标题
  "unitId": "订单金额计算单元测试",        // 可选 → 表头「单元标识」，默认取 name
  "trace": "详细设计 5.9.2 订单金额",      // 可选 → 表头「设计追溯」，默认 "-"
  "driver": "测试驱动（TestDriver）",     // 可选 → 表头「驱动模块」，默认 "无"
  "coverage": "-S 94.2% -B 88.6%",       // 可选 → 表头「覆盖率记录」，默认 "-"
  "summary": { "total": 3, "passed": 3, "failed": 0, "notRun": 0 },  // 必填，必须与本函数用例数一致
  "cases": [ /* 至少 1 条 */ ]
}
```

> `coverage` 必须是覆盖率工具的真实输出（如 `gcovr`）。**没有采集就写 `-`，不许估算。**

### 用例

```jsonc
{
  "id": "ORD-CALC-0001",              // 必填，全局唯一
  "name": "三件商品订单金额计算",       // 必填
  "type": "功能测试",                  // 必填，五选一，见下
  "description": "按单价与数量计算小计…", // 必填
  "funcDesc": "订单金额计算",           // 可选 → 表头「功能描述」，默认取 name
  "stub": "库存服务（StubStockService）", // 可选 → 「打桩模块」+「活动桩」
  "inserted": "无",                    // 可选 → 「插入代码」
  "inputs":  [["items_count", "3"]],   // 可选，[变量名, 取值]
  "outputs": [["subtotal", "59.70", "59.70"]], // 可选，[变量名, 预期输出, 实际输出]
  "passed": true,                      // 必填，布尔
  "status": "passed",                  // 可选：passed | failed | notRun
  "notRunReason": "",                  // 可选，未执行原因
  "issue": "无",                       // 可选 → 「异常现象描述」
  "bugId": "BUG-ORD-0042",             // 可选 → 「软件问题单编号」
  "designer": "张伟",                  // 可选 → 「设计者」，默认取函数级 → skill
  "reviewer": "刘洋",                  // 可选 → 「校对者」，默认取函数级 → skill
  "tester": "王芳",                    // 可选 → 「测试人员」，默认取函数级 → skill
  "executedAt": "2026/11/13"           // 可选 → 测试执行时间
}
```

> 三个人员字段通常都不写，留给 skill 提供 —— 这样能验证 skill 注入确实生效。

### 硬性约束

| 约束 | 说明 |
|---|---|
| `type` 只能取 | `功能测试` `接口测试` `边界测试` `逻辑测试` `性能测试` |
| `passed` 与 `status` 必须自洽 | `status=notRun` 时 `passed` 必须为 `false` |
| `summary` 三项计数必须与用例实际状态吻合 | 脚本会交叉校验 |
| 用例 `id` 全局唯一 | 重复会直接报错 |
| `outputs` 第三项可留空 | 未执行用例的实际输出就留 `""` |

### `status` 与模板勾选框的对应

| status | 执行情况 | 执行结果 |
|---|---|---|
| `passed` | 勾「执行」 | 勾「通过」 |
| `failed` | 勾「执行」 | 勾「未通过」 |
| `notRun` | **勾「未执行」** | **两个都不勾**，实际输出列自动填「未执行」 |

---

## 关键要求：不要抄模板里的内容

正式模板里自带 RingBuffer 样例内容（用例表、附录问题单），**你的数据必须和它们毫无关系**：

- ❌ 不要用 `RingBuffer`、`push`、`pickNew`、`pickPWL`、`clearSaveNewOne`、`clearAll` 作模块名
- ❌ 不要用 `GN-ZZKZ-xxx-T001.CTD` 这类标识
- ❌ 不要用 `m_totalCapacity`、`m_size`、`m_head`、`m_tail`、`m_id`、`m_value` 作变量名
- ✅ 自己造一个真实场景（订单、支付、文件同步、缓存、日志、鉴权、调度……）
- ✅ 自己设计标识规范（如 `PAY-REFUND-0007`）

**原因**：如果数据长得像模板样例，就无法证明脚本「真的从零填内容」——旧数据和模板同源时，填没填、填对没填都看不出来。

---

## 建议的数据规模（覆盖面）

至少包含：

| 场景 | 为什么 |
|---|---|
| 3 个阶段 / 6~9 条用例 | 验证章节按数据重建，而不是照抄模板的样例 |
| 1~2 条 `failed`，带 `issue` 和 `bugId` | 验证未通过勾选与问题单号 |
| 1 条 `notRun`，带 `notRunReason` | 验证「未执行」状态（大模型漏测场景） |
| 变量组数各不相同（1 组 / 3 组 / 5 组） | 验证变量行动态增删 |
| 输入组数与输出组数不相等 | 验证列不对齐时的处理 |
| 五种 `type` 至少覆盖 4 种 | 验证类型勾选位置 |
| 各函数 `coverage` 数值不同 | 验证表头按函数取值，而不是取同一份 |
| 故意不给用例级 `designer`/`reviewer`/`tester` | 验证 skill 注入生效 |

---

## 执行步骤

### 1. 写数据

```powershell
# 放在 D:\1\report-tool\<你的项目名>-data.json
```

### 2. 直接生成（人员写死在数据里）

```powershell
$py = 'C:\Users\PC\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\python\python.exe'
& $py D:\1\report-tool\cmd.py `
      --template templates/单元测试报告模板.docx `
      --data D:\1\report-tool\your-data.json `
      -o D:\1\report-tool\your-report.docx
```

### 3. 或先建 skill 再生成（三个人员字段从 skill 读，数据里不写）

```powershell
# 先写 D:\1\skills\<项目>\SKILL.md，frontmatter 里放 designer/reviewer/tester
& $py D:\1\report-tool\cmd.py `
      --template templates/单元测试报告模板.docx `
      --data D:\1\report-tool\your-data.json `
      --skill D:\1\skills\<项目> `
      -o D:\1\report-tool\your-report.docx
```

skill 文件最小形态：

```markdown
---
name: your-project-unit-test
description: 某模块单元测试流程
designer: 张伟
reviewer: 刘洋
tester: 王芳
---
```

**当前只有这三个人员字段会从可选的项目专属 Skill 读取**，写别的键会被忽略。包内不提供具体项目示例；项目特有的其他字段应进入结构化报告 JSON，并同步扩展 schema 白名单和取值逻辑，不能依赖解析 Skill 任意正文。

### 4. 校验产物

```powershell
& $py D:\1\report-tool\verify_report.py `
      D:\1\report-tool\your-report.docx `
      D:\1\report-tool\your-data.json `
      templates/单元测试报告模板.docx
```

最后一行必须是 `ALL CHECKS PASSED`。如果用了 `--skill`，把 skill 路径作为第 4 个参数补上。

---

## 命令输出怎么看

```
phases=3  functions=3  cases=8  passed=6  failed=1  notRun=1  unconfirmed=0  toc_cleared=0
目录：已重建（OK toc=1 pages=9）
报告已生成：D:\1\report-tool\your-report.docx
```

| 字段 | 含义 | 什么时候要警觉 |
|---|---|---|
| `phases / functions / cases` | 你数据里的阶段数、函数数与用例数，应当对得上 | 对不上 → 数据被截断 |
| `passed / failed / notRun` | 三种状态的实际计数 | 与 summary 不一致（校验器已拦） |
| `removed` | 从模板删掉的样例元素个数 | 原始模板固定 74，空白模板固定 10；变了说明模板被改过 |
| `toc_cleared` | 清掉的目录缓存节点数 | 原始模板 29，空白模板 0 |
| `目录：已重建` | Word 已重算目录，打开无提示 | 正常 |
| `目录：未重建，回退到 updateFields` | 本机没 Word | **不是失败**，只是降级 |

---

## 退出码

| 码 | 含义 | 你该做什么 |
|---|---|---|
| 0 | 成功 | 继续校验 |
| 1 | 数据文件不存在 / JSON 语法错误 | 检查文件路径与 JSON 格式 |
| 2 | schema 校验失败 | 按报错里的字段路径修 JSON |
| 3 | 模板结构不可用 | 确认模板没被改坏 |
| 4 | 未预期异常 | 报告给人类 |
| 5 | 输出文件被占用 | 关掉正在打开该 docx 的 Word，或换 `-o` 文件名 |

schema 报错样例（会带精确路径）：

```
输入数据不符合约定：modules[0].cases[1].inputs[0]: 必须是长度为 2 的数组 [变量名, 取值]
输入数据不符合约定：modules[1].cases[0].status=notRun 但 passed=True；未执行的用例不可能「通过」，请把 passed 设为 false
```

---

## 禁止事项

- 不要修改 `report-tool/` 下的 `.py` 文件（除非任务明确要求改代码）
- 不要修改 `templates/单元测试报告模板.docx`
- 不要填 AI 猜测的覆盖率数字（`coverage` 留空或写 `-`）
- 不要把「没执行」的用例写成「通过」
- **不要指望 skill 提供 tester 以外的字段** —— 它只负责测试人员

---

## 参考实现

`D:\1\report-tool\auth-demo.json` 是一份合格的样例：

- 3 个阶段、8 条用例
- 6 通过 / 1 未通过 / 1 未执行
- 变量组数 2~4 组不等
- 三个函数的 `coverage` 各不相同（96.1% / 92.4% / 94.0%）
- 函数级给了 `designer` / `reviewer`，用例级故意不写 `tester`
- 标识 `AUTH-PWD-0001` 风格，与模板零重叠

人员资料可直接写入 JSON，也可由项目专属 Skill 提供默认值；JSON 中的函数或用例值优先，仍缺失的字段保持空白。
