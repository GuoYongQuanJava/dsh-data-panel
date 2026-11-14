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

**写入两个位置（必须同时完成）：**
1. `<项目>/.dsh/testcases/cases.json` — 规范文件
2. 数据面板 API — 通过 POST 到 `http://127.0.0.1:PORT/data-panel/api`

### Step 3: 生成测试代码
为每个用例生成可执行的测试代码，写入 `<项目>/tests/test_generated.py`。

**测试代码编写规范：**
- Python 项目在文件开头添加 `sys.path.insert(0, ...)` 确保导入路径正确
- 使用 pytest 的 `assert` 和 `pytest.raises`
- 每个测试函数对应一条用例

### Step 4: 等待人工审查
生成完成后**必须停下来**，告知用户审查。禁止未经确认就执行测试。

### Step 5: 执行测试
用户确认后执行：
```bash
cd <项目>
python -m pytest tests/ -v --junitxml=results.xml
```

### Step 6: 生成 Word 报告
使用报告工具管道生成：

在 Windows 上先设置 `PYTHONIOENCODING=utf-8`，避免报告脚本的中文输出编码失败。

**6.1 桥接数据**：
```bash
python <报告工具目录>/report-tool/bridge.py \
  <项目>/.dsh/testcases/cases.json \
  <项目>
```
生成 `<项目>/report-data.json`。

**6.2 生成报告**：
```bash
python <报告工具目录>/report-tool/cmd.py \
  --template <报告工具目录>/templates/RingBuffer-test-blank.docx \
  --data <项目>/report-data.json \
  --skill <报告工具目录>/skills/<项目名> \
  -o <项目>/reports/test_report.docx
```

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
"codeRef": "E:/gongzuo/harness/dshCJ/demo-project/tests/test_generated.py#L6"
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
   - 如果测试逻辑正确 → 修改源码以匹配测试（如加缺失参数、属性别名）
   - 如果源码才是正确的 → 修改测试代码和用例数据
4. **典型不匹配**：函数参数个数/名称不同、属性名不同（`value` vs `memory`）、方法不存在

**踩坑记录：** Calculator 源码 `__init__(self)` + `.value`，但测试期望 `Calculator(100)` + `.memory`。

---
---

## 数据面板 API

端口号从当前 DSH Web GUI URL 提取。数据面板路径为 `/data-panel/api`。

**GET 查询：**
```
GET http://127.0.0.1:PORT/data-panel/api
→ { ok: true, records: [...], demoCount: N, seeded: bool }
```

**POST 创建：**
```json
{ "op": "create", "record": { "caseId": "TC-001", "title": "...", "testType": "functional", ... } }
```

**POST 更新：**
```json
{ "op": "update", "id": "rec_xxx", "patch": { "title": "新名称", ... } }
```

**POST 删除：**
```json
{ "op": "delete", "id": "rec_xxx" }
```

---

## 重要规则

- **禁止未经用户确认就执行测试**
- **禁止跳过审查步骤**
- **必须同时写入文件和数据面板 API**
- **编译错误和依赖缺失视为执行失败，不是通过**
- **用户界面文本用中文，代码用英文**
- **codeRef 指向测试代码（test_generated.py），不是被测源码**
- **生成测试后先自检源码一致性**：重读源码，对比 API（函数签名、属性名），不一致则同步修正
- **每完成一步输出进度卡片**：用 TinySteps + TinyCard 输出当前进度，让用户随时知道走到哪了
- **Step 2 完成后自动弹出用例面板**：在生成用例的卡片中加 `lifeCycles.onMounted`，JSFunction 里调用 `window.__dshOpenDataPanel()` 自动弹出右侧数据面板；同时卡片里放一个「📋 打开用例面板」按钮作为备用
