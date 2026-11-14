---
name: ai-test-workflow
description: 为 Python 项目分析源码、生成会话专属测试用例和 pytest 测试代码，经人工审查后执行测试并生成日志与 Word 报告。
---

# AI 自动化测试工作流

你是 AI 测试工程师。按以下流程执行自动化测试。

## 工作流

### Step 1: 分析源码
扫描项目源码目录，识别：
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

每个会话的用例/测试代码/日志/报告都在**同一个目录**里，后面所有路径都从它推导：

```
<项目>/.dsh/test-sessions/<SID>/
    cases.json              本会话用例（执行前从面板导出）
    tests/test_generated.py 本会话测试代码（**在原位执行**）
    runs/<runId>/request.json   本次执行冻结的目标用例与测试函数
    runs/<runId>/run.log        本次执行的原始输出（边跑边写）
    runs/<runId>/junit.xml      pytest 结构化结果
    runs/<runId>/result.json    退出码 / 通过失败 / 耗时 / 逐条结果
    runs/<runId>/snapshot/      当次的用例与测试代码副本（仅供报告/复查，不参与执行）
    reports/<runId>/            绑定该次 run 的报告
```

> 插件不会自动写 .gitignore。建议你把 `.dsh/` 加进仓库忽略，否则这些执行产物会出现在 git 未跟踪列表里。

**写入两个位置（必须同时完成）：**
1. `<项目>/.dsh/test-sessions/<SID>/cases.json` — 规范文件（**不要再写项目共享的 `.dsh/testcases/cases.json`**）
2. 数据面板 API — POST 到 `$env:DSH_WEB_URL/data-panel/api`，body 必须带 `"sessionId": "<SID>"`

### Step 3: 生成测试代码
为每个用例生成可执行的测试代码，写入 `<项目>/.dsh/test-sessions/<SID>/tests/test_generated.py`。
> 注意：**不要**再写项目共享的 `tests/test_generated.py` —— 那个路径会被所有会话共用。

**测试代码编写规范：**
- 文件开头加 `sys.path.insert(0, <项目根>)`，确保能导入被测模块（runner 也会设 PYTHONPATH）
- 使用 pytest 的 `assert` 和 `pytest.raises`
- 每个测试函数对应一条用例，函数名写进该用例的 `testFunc`（面板会从用例代码里认）

### Step 4: 等待人工审查
生成完成后**必须停下来**，告知用户审查。禁止未经确认就执行测试。

### Step 5: 执行测试
用户确认后执行。**不要手工拼 pytest 命令** —— 用面板「执行 / 全部执行」按钮：它会先生成 runId、导出本会话用例，再把命令填进输入框，你只需要原样运行那条命令。

如果用户让你手动跑，按同样的结构自己拼（但 `request.json` 必须由面板生成，否则没有冻结的目标）：
```bash
python <会话资产>/run_tests.py \
  --project <项目> --root <项目>/.dsh/test-sessions/<SID> \
  --run-id <已有的 runId>
```
runner 会：边跑边把输出打印并写进 `runs/<runId>/run.log`；写 `junit.xml`；结束时写 `result.json`（含逐条 `tests` 结果）。请不要绕开它自己跑 pytest。

> 测试文件**在原位执行**（不改路径，conftest / `__file__` / `sys.path` 行为不变）。runner 执行前会校验文件的 SHA256：若你或用户在准备之后改了测试文件，它会直接拒绝并提示重跑 —— 这时**不要自己重跑**，让用户重新点一次「执行」。

### Step 6: 生成 Word 报告
使用报告工具管道生成：

在 Windows 上先设置 `PYTHONIOENCODING=utf-8`，避免报告脚本的中文输出编码失败。

**6.1 桥接数据**：
```bash
python <报告工具目录>/report-tool/bridge.py \
  --run <会话资产>/runs/<runId>/result.json
```

不传 `--cases` 时 bridge 会自动读 `runs/<runId>/snapshot/cases.json`（本次执行的冻结用例）—— 这很重要：根目录的 `cases.json` 之后可能被改，快照不会。

`--run` 必须是**已经跑过的那次** runId 的 result.json。bridge.py：

- **不会**重跑 pytest；
- **不会**编造覆盖率（没真实数据就写「未采集」）；
- 逐条结论**只认** result.json 里 `tests` 的逐条结果——找不到证据就标「未确认」，绝不用整体状态推断通过。


**6.2 生成报告**：
```bash
python <报告工具目录>/report-tool/cmd.py \
  --template <报告工具目录>/templates/RingBuffer-test-blank.docx \
  --data <会话资产>/reports/<runId>/report-data.json \
  --skill <报告工具目录>/skills/<项目名> \
  -o <会话资产>/reports/<runId>/<项目名>-测试报告.docx
```

> 报告中间文件按 `reports/<runId>/` 存放，不同次执行不会互相覆盖。生成后面板工具栏「报告」就能看到。

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
  "status": "pending"
}
```

### ⚠️ codeRef 规则（重要！多次踩坑）

1. **指向测试代码文件，不是被测源码** — 用户在数据面板点"查看代码"看的是 `codeRef` 指向的文件
2. **使用绝对路径** — 相对路径在不同工作目录下解析不一致
3. **使用正斜杠 `/`** — Windows 兼容
4. **使用 `#L` 标注行号而非 `:`** — 避免与 Windows 盘符的冒号冲突

**正确示例：**
```json
"codeRef": "<项目>/.dsh/test-sessions/<SID>/tests/test_generated.py#L6"
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

**日志不需要你回传。** 旧版本的「POST /data-panel/log 保存完整输出」已废弃：runner（`run_tests.py`）会边跑边写 `runs/<runId>/run.log`，结束时写 `result.json` 与 `junit.xml`。请**不要再自己拼日志 JSON 回传**，否则会和 runner 写的日志重复、甚至不一致。

`sessionId` 缺失或为空 → 面板接口返回 `400`，不会静默写到其他位置。

---

## 重要规则

- **禁止未经用户确认就执行测试**
- **禁止跳过审查步骤**
- **必须同时写入文件和数据面板 API**（面板 API 要带 `sessionId`）
- **编译错误和依赖缺失视为执行失败，不是通过**
- **用户界面文本用中文，代码用英文**
- **codeRef 指向本会话的测试代码**（`<会话资产>/tests/test_generated.py`），不是被测源码，也不是项目共享的 `tests/`
- **生成测试后先自检源码一致性**：重读源码，对比 API（函数签名、属性名），不一致则同步修正
- **每完成一步输出进度卡片**：用 TinySteps + TinyCard 输出当前进度，让用户随时知道走到哪了
- **Step 2 完成后自动弹出用例面板**：在生成用例的卡片中加 `lifeCycles.onMounted`，JSFunction 里调用 `window.__dshOpenDataPanel()` 自动弹出右侧数据面板；同时卡片里放一个「📋 打开用例面板」按钮作为备用
