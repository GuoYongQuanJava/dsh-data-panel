---
name: ai-test-workflow
description: 通用单元测试工作流：识别项目语言和测试框架，生成会话专属用例与测试代码，经人工审查后通过面板的统一执行链路运行，并整理日志与 Word 报告。
---

# AI 自动化测试工作流

你是 AI 测试工程师。按以下流程执行自动化测试。

本 Skill 面向**不同语言和项目**：先识别被测代码的语言、构建系统与测试框架，再按该项目适用的方式生成与运行测试。用例分析、人工审查、会话归属、面板台账、执行与日志、报告桥接都是通用流程；面板的「执行 / 全部执行」不绑定 Python，它按会话资产目录里的 `runner.json`（或自动识别的内置框架）选择命令。

## 进度：用 `todo_write` 固定在输入框上方

用户说的「输入框上方的任务气泡」是 **DSH 原生 `todo_write`** 渲染的固定任务列表（不是 genUI 卡片，也不会随对话滚走）。它是本工作流进度的**唯一权威来源**。

- **每个新回合都要重写（重要）**：DSH 在 `turn/start`（你每发一条新消息/确认）时会把任务投影重置为空，输入框上方的列表会消失。所以每次用户回复/确认/追问后，本回合**第一件事**就是重新调用 `todo_write`，恢复完整 6 步和当前状态，再继续干活；任何时候都不要传空清单。

- **开始单元测试的第一步**（还没分析源码之前）就调用 `todo_write`，把 6 步一次性写进去：第 1 步 `in_progress`，其余 `pending`：
  1. 分析源码
  2. 生成测试用例（含 runner.json）
  3. 生成测试代码
  4. 人工审查
  5. 执行测试
  6. Word 报告

  开工时就是一次 `todo_write` 调用：

  ```json
  { "todos": [
    { "content": "分析源码", "status": "in_progress" },
    { "content": "生成测试用例（含 runner.json）", "status": "pending" },
    { "content": "生成测试代码", "status": "pending" },
    { "content": "人工审查", "status": "pending" },
    { "content": "执行测试", "status": "pending" },
    { "content": "Word 报告", "status": "pending" }
  ] }
  ```
- **每完成一步立即再调用一次 `todo_write`**：该步改 `completed`，下一步改 `in_progress`。不要只在最后更新一次，也不要只在对话里发文字进度。
- 等待用户审查/确认期间，第 4 步保持 `in_progress`；确认后再推进到第 5 步。
- 某步被阻塞（缺运行时、构建失败、等用户回答）时，保持该步 `in_progress` 并说明原因，不要把后续步骤提前标成完成。
- 对话里的 TinySteps 卡片只用于留档，可选；**不能替代 `todo_write`**。

### 长步骤显示百分比

`todo_write` 没有独立的百分比字段，百分比写在任务文案里，靠更新文案实现（输入框上方会原样显示）：

- 格式：`阶段名 ████░░░░ 40%（5/12）`（10 格进度条，按百分比取整；CJK 字符宽度不同，看不齐就少用格子、只留百分比）
- 更新时机：0% → 25% → 50% → 75% → 100%，或每 3~5 条一批；不要每生成一条就调一次，避免工具调用过密。
- 生成用例 / 生成代码：先写 `生成测试用例 ░░░░░░░░░░ 0%（0/12）` 并置 `in_progress`；每完成一批更新百分比；收尾写 `100%（12/12）` 再置 `completed`。
- 执行测试：命令预计超过 60 秒时用后台任务运行，轮询 `runs/<runId>/run.log` 的逐条结果数更新百分比；短命令直接跑完再更新，不要为了刷百分比而拆碎命令。
- 百分比只是文案，不要为了它虚报进度；数字必须对应真实完成的条数/文件数。

## 工作流

> 动手前先调用一次 `todo_write`（见上节「进度」），再进入 Step 1。

### Step 1: 分析源码
扫描项目源码目录，识别：
- 语言、构建系统、现有测试框架与测试目录
- 所有函数、类、方法
- 签名、文档字符串
- 边界条件和异常路径

输出：可测试单元清单。

### Step 2: 生成测试用例
为每个可测试单元生成覆盖以下类型的用例：
- **功能测试（functional）**：正常输入，期望输出
- **边界测试（boundary）**：边界值（0、-1、最大值、空值）
- **异常测试（exception）**：无效输入、错误条件

**Step 2 的第一步：取当前会话 ID 和会话资产目录**

```bash
echo $env:DSH_SESSION_ID                                    # PowerShell
echo "$DSH_SESSION_ID"                                       # bash
```

每个会话的用例/测试代码/日志/报告都按会话归属管理：

```
<项目>/.dsh/test-sessions/<SID>/
    runner.json             本会话的运行器描述（可选，建议写；见 Step 2.5）
    cases.json              本会话用例（执行前从面板导出）
    tests/test_generated.<ext>  本会话测试代码（按项目语言命名）
    run_tests.py            通用 runner（面板准备执行时生成，不要手改）
    runs/<runId>/request.json   本次执行冻结的目标用例与运行器描述
    runs/<runId>/run.log        本次执行的原始输出（边跑边写）
    runs/<runId>/junit.xml      batch 模式的逐条结果（框架产出时）
    runs/<runId>/result.json    退出码 / 通过失败 / 耗时 / 逐条结果
    runs/<runId>/snapshot/      当次的用例与测试代码副本（仅供报告/复查）
    reports/<runId>/            绑定该次 run 的报告
```

> 插件不会自动写 .gitignore。建议你把 `.dsh/` 加进仓库忽略，否则这些执行产物会出现在 git 未跟踪列表里。

**写入两个位置（必须同时完成）：**
1. `<项目>/.dsh/test-sessions/<SID>/cases.json` — 规范文件（**不要再写项目共享的 `.dsh/testcases/cases.json`**）
2. 数据面板 API — POST 到 `$env:DSH_WEB_URL/data-panel/api`，body 必须带 `"sessionId": "<SID>"`

### Step 2.5: 声明运行器（runner.json）
面板不认识具体语言，它只认一份运行器描述。请先判断项目用什么测试方式，然后在 `<会话资产>/runner.json` 写明：

- 常见框架优先只写 preset + 测试文件：
  ```json
  { "preset": "go", "testFile": "project:tests/test_generated_test.go" }
  ```
  内置 preset：`pytest` / `vitest` / `jest` / `node-test` / `go` / `cargo` / `dotnet` / `maven` / `gradle` / `ctest` / `gtest`。
- 项目有自己的命令就完全自定义：
  ```json
  {
    "id": "rspec", "label": "RSpec", "language": "ruby",
    "testFile": "tests/generated_spec.rb",
    "mode": "per-case",
    "command": ["bundle", "exec", "rspec", "{file}", "-e", "{target}"],
    "targetExtract": "it\\s+['\"]([^'\"]+)['\"]",
    "targetDeclare": "['\"]{target}['\"]"
  }
  ```

要点：
- `testFile`：`project:xxx` 相对项目、`root:xxx` 相对会话资产；不写前缀时相对会话资产目录。
- `command`：字符串数组；单条模式用 `{target}`，整批模式用 `{targets}`。可用占位符还有 `{file}` `{binary}` `{project}` `{root}` `{runId}` `{runDir}` `{junit}`。
- `mode`：能产出 JUnit XML 的框架用 `batch`（一条命令跑完，逐条结果来自 JUnit）；否则用 `per-case`（一条用例一条命令，退出码即证据，默认）。
- Java / Go / C# / Rust / C++ 的测试文件通常必须位于项目源码树内，用 `project:` 写实际路径。
- C++ / GoogleTest：用 preset `gtest`，`binary` 指向**已构建**的测试可执行文件（`Suite.Name` 会作为 `--gtest_filter`）；需要面板先构建就把构建命令写进 `preCommand`（如 `cmake --build {project}/build`）。
- 没有 `runner.json` 时面板会按 `go.mod` / `pom.xml` / `package.json` / Python 测试迹象等自动识别；识别不出来会直接报错，不要靠猜。
- 内置命令只是常见默认值。第一次接入项目时，请核对项目真实的测试命令；不一致就覆盖。

### Step 3: 生成测试代码
为每个用例按项目语言和现有测试框架生成可执行的测试代码，保存在本会话的目录下（默认 `<会话资产>/tests/`；框架要求项目内路径时按 Step 2.5 的 `testFile` 写入项目并同步声明）。**每个测试函数/测试项对应一条用例，并把它的名字写进该用例的 `testFunc`**：

- pytest：`test_xxx`
- Vitest / Jest / Node test：`it` / `test` 的用例名
- Go：`TestXxx`
- JUnit / xUnit：方法名
- 其他：按框架实际的可筛选名字

`testFunc` 可以写进 `<会话资产>/cases.json` 的对应用例；面板导出时会按 `caseId` 保留它。没写时面板会按运行器声明的 `targetExtract` 从用例 `code` 里推断。

**测试代码编写规范：**
- 遵循项目本身的语言、构建方式和测试框架，不把其他语言的项目强行改为 Python。
- 不写入项目共享的测试输出路径；多个会话共用会互相覆盖。
- **每个用例必须打印实际输出**：统一用 `ACTUAL[<caseId>]: <值>` 标记，通过/失败都打印；面板「实际输出」列只认这个标记，没打印就显示「未记录实际值」。
  - Python：`print(f"ACTUAL[{case_id}]: {actual!r}")`
  - JS/TS：`console.log("ACTUAL[" + caseId + "]:", JSON.stringify(actual))`
  - 其他语言：用对应语言的 stdout 打印同样格式。
- 生成后先自检（见下方「源码一致性规则」）。

### Step 4: 等待人工审查
生成完成后**必须停下来**，告知用户审查。禁止未经确认就执行测试。

### Step 5: 执行测试
用户确认后执行。使用面板「执行 / 全部执行」按钮：

- 它会先生成 runId、导出本会话用例、校验测试文件、冻结本次目标，再把一条命令填进输入框；
- **只需原样运行那条命令**，不要自己另拼 pytest / vitest / go test 等命令；
- 命令跑的是通用 runner（`run_tests.py`），按 `runner.json` 的 `mode`：
  - `batch`：一次进程跑完，逐条结果来自 JUnit；
  - `per-case`：一条用例一个进程，退出码就是该条的通过/失败证据。
- runner 会边跑边打印并写 `runs/<runId>/run.log`，结束时写 `runs/<runId>/result.json`。
- 配了 `preCommand` 时 runner 会先跑它；构建失败会以 `build-failed` 结束，不要绕过构建自己找二进制或手动运行测试。

> 测试文件**在原位执行**（不改路径，conftest / `__file__` / 相对导入行为不变）。runner 执行前会校验文件的 SHA256：若准备之后测试文件被改过，它会直接拒绝并提示重跑 —— 这时**不要自己重跑**，让用户重新点一次「执行」。

如果准备接口报错（没有测试代码、识别不到框架、没有可执行目标），按错误里的框架和路径补齐；不要绕过 runner 自己跑测试再把结果回传。

> 每次执行（包括面板里单条用例的「执行」）都必须生成报告；单条执行只包含这一条用例，报告文件名带 caseId。

### Step 6: 生成 Word 报告
报告只消费**已经真实跑过的那次 run**：

- **每次执行都要生成报告，包括单条用例的「执行」**。单条执行的 snapshot/cases.json 只含该条用例，报告就只写这一条；文件名建议 `<项目>-<caseId>-测试报告.docx`。
- 报告必须落在 `reports/<runId>/`，否则面板工具栏「报告」和每行的「报告」按钮找不到它。

**6.1 桥接数据**：
```bash
python <报告工具目录>/report-tool/bridge.py \
  --run <会话资产>/runs/<runId>/result.json
```

不传 `--cases` 时 bridge 会自动读 `runs/<runId>/snapshot/cases.json`（本次执行的冻结用例）—— 这很重要：根目录的 `cases.json` 之后可能被改，快照不会。

`--run` 必须是**已经跑过的那次** runId 的 result.json。bridge.py：
- **不会**重跑测试；
- **不会**编造覆盖率（没真实数据就写「未采集」）；
- 逐条结论**只认** result.json 里 `tests` 的逐条结果——`batch` 来自 JUnit，`per-case` 来自每条命令的退出码；找不到证据就标「未确认」，绝不用整体状态推断通过。

**6.2 生成报告**：
```bash
python <报告工具目录>/report-tool/cmd.py \
  --template <报告工具目录>/templates/<适用的报告模板>.docx \
  --data <会话资产>/reports/<runId>/report-data.json \
  --skill <报告工具目录>/skills/<项目名> \
  -o <会话资产>/reports/<runId>/<项目名>-测试报告.docx
```

> 报告中间文件按 `reports/<runId>/` 存放，不同次执行不会互相覆盖。生成后面板工具栏「报告」就能看到。
先确认模板文件与该项目的报告 Skill 目录真实存在；不要把 RingBuffer 示例模板直接用于任意项目。

报告工具目录：本仓库根目录下的 `testReport/`。
SKILL.md 的 frontmatter 写 `designer` / `reviewer` / `tester` 三个人员字段。

---

## 数据模型

```json
{
  "caseId": "TC-XXX-001",
  "title": "用例名称",
  "testType": "functional|boundary|exception|performance|compat",
  "description": "测试说明",
  "input": "输入",
  "expected": "预期输出",
  "codeRef": "测试文件绝对路径#L行号",
  "code": "测试代码内容",
  "testFunc": "测试函数名或测试名",
  "status": "pending"
}
```

### ⚠️ codeRef 规则（重要！多次踩坑）

1. **指向测试代码文件，不是被测源码** — 用户在数据面板点"查看代码"看的是 `codeRef` 指向的文件；路径按实际测试语言和文件名填写
2. **使用绝对路径** — 相对路径在不同工作目录下解析不一致
3. **使用正斜杠 `/`** — Windows 兼容
4. **使用 `#L` 标注行号而非 `:`** — 避免与 Windows 盘符的冒号冲突

**示例：**
```json
"codeRef": "<会话资产>/tests/test_generated.py#L6"
"codeRef": "<项目>/tests/order_test.go#L12"
"codeRef": "<项目>/tests/order.test.ts#L8"
```

**错误示例（会导致 404/路径错误）：**
```json
"codeRef": "src/calculator.py:8"           // 相对路径 + 指向源码
"codeRef": "E:\xxx\file.py:8"             // 反斜杠 + 冒号行号
```

---

### ⚠️ 源码一致性规则（重要！多次踩坑）

1. **生成测试后必须重读源码** — 测试代码是基于 Step 1 分析结果生成的，但源码可能在分析后被修改
2. **验证 API 兼容性** — 逐项对比测试中的函数签名、类方法、属性名与源码是否一致
3. **不一致时的处理**：
   - **不要自己改源码去迎合测试**。先报告：不一致的具体位置、是测试错还是源码错、你建议改哪些文件，等用户确认后再动。
   - 如果确认是测试逻辑错 → 改测试代码和用例数据。
   - 如果确认是源码错 → 先说清拟改的文件与行为变化，等用户确认后再改。
4. **典型不匹配**：函数参数个数/名称不同、属性名不同（`value` vs `memory`）、方法不存在

**踩坑记录：** Calculator 源码 `__init__(self)` + `.value`，但测试期望 `Calculator(100)` + `.memory`。

---

## 数据面板 API

地址取 `$env:DSH_WEB_URL`（就是当前 DSH 页面的地址），数据面板路径为 `/data-panel/api`。

所有接口**必须**带上当前会话 ID。

**第一步：取当前会话 ID（每次都要，不要缓存）**

```bash
echo $env:DSH_SESSION_ID      # PowerShell
echo "$DSH_SESSION_ID"         # bash
```

下面示例里的 `<SID>` 就换成这个值。
没拿到 SID 就不要调面板接口，直接告诉用户当前会话还没就绪。

**GET 查询：**
```
GET $env:DSH_WEB_URL/data-panel/api?sessionId=<SID>
→ { ok: true, records: [...], demoCount: N, seeded: bool }
```

**POST 创建：**
```json
{ "sessionId": "<SID>", "op": "create", "record": { "caseId": "TC-001", "title": "...", "testType": "functional", ... } }
```

**POST 更新：**
```json
{ "sessionId": "<SID>", "op": "update", "id": "rec_xxx", "patch": { "title": "新名称", ... } }
```

**POST 删除：**
```json
{ "sessionId": "<SID>", "op": "delete", "id": "rec_xxx" }
```

**日志不需要你回传。** runner（`run_tests.py`）会边跑边写 `runs/<runId>/run.log`，结束时写 `result.json` 与（batch 模式的）`junit.xml`。请**不要再自己拼日志 JSON 回传**，否则会和 runner 写的日志重复、甚至不一致。

`sessionId` 缺失或为空 → 面板接口返回 `400`，不会静默写到其他位置。

---

## 重要规则

- **禁止未经用户确认就执行测试**
- **禁止跳过审查步骤**
- **必须同时写入文件和数据面板 API**（面板 API 要带 `sessionId`）
- **编译错误和依赖缺失视为执行失败，不是通过**
- **用户界面文本用中文，代码用英文**
- **不要绕过面板的 runner 执行测试**：执行命令由宿主生成，日志与逐条结果由 runner 写
- **测试目标名写进 `testFunc`**：否则面板只能从用例代码推断，非 Python 框架容易对不上
- **codeRef 指向本会话实际生成的测试代码**；不要指向被测源码或项目共享测试输出
- **生成测试后先自检源码一致性**：重读源码，对比 API（函数签名、属性名），不一致则同步修正
- **进度必须用 `todo_write` 固定任务气泡**：开工先写 6 步，每完成一步立即更新；TinySteps 卡片只是可选留档，不能替代
- **Step 2 完成后自动弹出用例面板**：在生成用例的卡片中加 `lifeCycles.onMounted`，JSFunction 里调用 `window.__dshOpenDataPanel()` 自动弹出右侧数据面板；同时卡片里放一个「📋 打开用例面板」按钮作为备用