---
name: ai-test-workflow
description: 通用单元测试工作流：识别项目语言和测试框架，生成会话专属用例与测试代码，经人工审查后通过面板的统一执行链路运行，并整理日志与 Word 报告。
---

# AI 自动化测试工作流

你是 AI 测试工程师。按以下流程执行自动化测试。

本 Skill 面向**不同语言和项目**：先识别被测代码的语言、构建系统与测试框架，再按该项目适用的方式生成与运行测试。用例分析、人工审查、会话归属、面板台账、执行与日志、报告桥接都是通用流程；面板的「执行 / 全部执行」不绑定 Python，它按会话资产目录里的 `runner.json`（或自动识别的内置框架）选择命令。

## 工具链发现（通用，适用于任何语言）

这门工作流要支持任意语言，所以**没有任何“特殊语言”**：Python、Node、Go、Rust、Java、.NET、C/C++、Ruby、PHP 一律走同一条搜索阶梯。

**一次命令失败不代表没装工具**（尤其是 DSH 自带的 Python / Node，它们不在系统 PATH 里）。

### 第一步：调接口看机器能力

```powershell
Invoke-RestMethod "$env:DSH_WEB_URL/data-panel/tools?project=$PWD" | ConvertTo-Json -Depth 6
```

返回结构（每个框架需要哪些工具由 `lib/runners.js` 的 `tools: [...]` 声明）：

```json
{ "ok": true, "detected": "pytest", "detectedAvailable": true,
  "tools": { "python": "C:\\…\\python.exe", "go": "", "cargo": "C:\\…\\cargo.exe" },
  "presets": { "pytest": { "available": true, "missing": [] }, "go": { "available": false, "missing": ["go"] } },
  "searched": ["env", "project", "sdk-home", "dsh-runtimes", "path", "common-install-dirs"] }
```

**`tools` 里空串的含义**：这 6 个层级都找过了，它确实不在常用位置。不等于项目不能用这门语言（可能没装、装在非标准位置，或用项目自带 wrapper）。

### 第二步：找不到就继续找（阶梯，命中即停）

| 顺序 | 去哪找 | 具体做法 |
| --- | --- | --- |
| 1 | 显式指定 | `$env:DSH_<TOOL>_PATH` 直接指向可执行文件或目录 |
| 2 | 项目自带 wrapper | `./mvnw`、`./gradlew`、`node_modules/.bin`、`.venv/Scripts`、`.venv/bin`、`build/install/bin`、`target/debug`、`target/release` |
| 3 | SDK 根变量 | `%M2_HOME%\bin`、`%JAVA_HOME%\bin`、`%GOROOT%\bin`、`%DOTNET_ROOT%`、`%CARGO_HOME%\bin`、`%PYENV_ROOT%\shims` |
| 4 | DSH 自带运行时 | `$env:DSH_HOME\dsh-runtimes\**`（限深扫描）—— Python / Node 就在这里 |
| 5 | PATH | `Get-Command <tool>` / `where.exe <tool>` / `which <tool>` |
| 6 | 常见安装位置 | 版本管理器：nvm、volta、pyenv、sdkman、rustup、scoop、chocolatey、Homebrew；或 `Get-ChildItem -Path <候选根> -Recurse -Filter <tool>*.exe -Depth 3` |

找到候选后先验证它真的能跑：

```powershell
& "<找到的可执行文件>" --version    # go version / java -version / mvn -v / cargo --version
```

有的工具没有 `--version`，能启动就是找到了，不要因为版本命令报错就当没装。

### 第三步：仍然找不到时

- **不要默不作声地少生成**。在对话里明确写：「X 语言没找到 <工具名>，按阶梯找过 env / 项目 wrapper / SDK 变量 / DSH 运行时 / PATH / 常见安装目录，均未命中」，并给出用户可执行的解法（装工具、设 `DSH_<TOOL>_PATH`、提供项目自带 wrapper）。
- 其他语言**照常生成**，不要因为一个语言卡住就把整次任务停掉。
- 绝不允许把「某次命令失败」当成「该语言不支持」，从而跳过它的全部用例。

### 铁律

- 项目里有哪种语言，就要为那种语言生成用例和测试代码。
- 工具探测失败 → 按阶梯继续找 → 真找不到才报告；**不允许静默跳过整门语言**。
- 新增语言不需要改面板：往 `lib/runners.js` 的 `PRESETS` 加一项并写 `tools: [...]` 即可。
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

#### Step 1.5: 确认被测语言与工具（必做，不要跳过）

按上文「工具链发现」那节执行。最短路径：

```powershell
Invoke-RestMethod "$env:DSH_WEB_URL/data-panel/tools?project=$PWD" | ConvertTo-Json -Depth 6
```

重点看 `detected` / `detectedAvailable` 和 `presets.<框架>.missing`：

- `detectedAvailable: true` → 直接进入 Step 2，不需要再自己跑任何版本命令。
- `missing` 非空 → 按阶梯继续找（项目 wrapper → SDK 变量 → DSH 运行时 → PATH → 常见安装目录），每条候选都用 `--version` 验一次。
- 阶梯走完仍找不到 → 先交付其他语言的用例，并**在对话里明确报告缺哪个语言的什么工具**，不允许静默少生成。
- 无论哪种语言（含 Go / Rust / Java / .NET / C++ / Ruby / PHP），判断标准一致：只看阶梯结果，不凭一次命令失败下结论。

### Step 2: 生成测试用例
按被测单元的实际特性，从以下五种测试类型中选择；不要求每个单元都凑齐五类：
- **功能测试（functional）**：正常业务行为与预期输出
- **接口测试（api）**：接口参数、返回值、协议约定与错误响应
- **边界测试（boundary）**：0、-1、最大值、空值等边界输入
- **逻辑测试（logic）**：条件分支、状态转换与业务规则
- **性能测试（performance）**：有明确指标时验证耗时、吞吐量或资源使用

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

`inputVariables` 和 `expectedOutputs` 必须同时写入这两处；面板导出时会沿用面板记录，只有面板未提供结构化变量时才保留 `cases.json` 中原有的结构化字段。编辑用例后再次核对导出结果，避免报告读到旧变量。

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
- `targetExtract` 只用于从面板用例的 `code` 推断测试名；在 `runner.json` 中自定义时会**替换**内置提取规则，可用字符串或字符串数组兼容多种写法。`targetDeclare` 是**单个正则字符串**，准备执行时用它检查测试文件是否声明了目标；自定义它也会替换内置规则。两项不能代替核对实际注册的测试名。
- **C/C++ 专用（内网常见）**：
  - 先看 `GET /data-panel/tools?project=<项目>` 里 `ctest` / `gtest` 的 `missing`；缺的通常是 `cmake` 或编译器。
  - 编译器是**三选一**（`g++` / `clang++` / `cl`），装了任一个就行；`missing` 里写的是整组 `g++|clang++|cl`。
  - Windows 上 `cmake.exe` / `ctest.exe` / `cl.exe` 大多数时候**不在 PATH**（Visual Studio 自带）。面板会自动去 VS / CMake / LLVM / MSYS2 的常见落点扫，不用你手动找。
  - 装在非标准位置（内网离线包解压到 D 盘等）：`$env:DSH_TOOL_SEARCH_DIRS = 'D:\tools\cmake-3.29\bin;D:\tools\msys64\mingw64\bin'`，支持 `*`；单个工具也可以用 `$env:DSH_CMAKE_PATH`。
  - `gtest` 必须写 `binary`（已构建的可执行文件）和构建步骤，例如：
    ```json
    { "preset": "gtest",
      "testFile": "project:tests/generated_test.cpp",
      "binary": "project:build/tests/generated_test",
      "preCommand": ["cmake", "--build", "build"] }
    ```
    `preCommand` 只是一条命令（argv 数组），所以 configure 要先单独做完：`cmake -S . -B build` 跑一次（或在项目里写个 build 脚本，`preCommand` 调它）。
  - CTest 项目不需要 `binary`：测试注册进 CTest 后，面板直接 `ctest -R ^名字$`；同样建议把构建写进 `preCommand`。
  - 项目只有 `Makefile` / `*.vcxproj`、既没有 `CMakeLists.txt` 也没有 `meson.build` 时，面板无法自动识别；不要硬编，直接写 `runner.json` 声明命令，或者先问用户是否同意加一个 CMake 构建入口。
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

**写完测试代码后核对目标关联，再进入人工审查：**

1. 逐条核对 `cases.json` 中的 `caseId`、`testFunc` 与测试框架实际注册的测试名。`testFunc` 应填写真实测试名，不能不经核对就批量设为 `caseId`。面板执行前会重新导出用例：若面板记录的 `code` 能推断出测试名，该推断值优先；否则才保留 `cases.json` 中已有的 `testFunc`。因此还要核对面板用例代码与最终测试文件是否一致。
2. 按当前运行器的 `targetDeclare` 检查测试文件能否声明这些目标。静态写出的 `test('名字', …)`、`def test_xxx()` 等通常可直接检查；循环或数据表动态注册的测试名即使写了 `testFunc`，也可能过不了默认的静态检查。遇到这种情况，优先生成可静态识别的声明；确需动态注册时，为该项目配置能核对实际用例数据的 `targetDeclare`，并确认运行器能检测“未匹配到测试”。
3. 汇报用例总数、缺少测试名的条数、声明检查未命中的条数。后两项要逐条说明并修正；不要用只搜索测试名字符串是否出现的脚本代替运行器的声明检查。

**测试代码编写规范：**
- 遵循项目本身的语言、构建方式和测试框架，不把其他语言的项目强行改为 Python。
- 不写入项目共享的测试输出路径；多个会话共用会互相覆盖。
- **每个用例必须打印实际输出**：统一用 `ACTUAL[<caseId>]: <值>` 标记，通过/失败都打印；面板「实际输出」列只认这个标记，没打印就显示「未记录实际值」。
  报告中的变量表另需真实的结构化证据：在用例中按实际测试代码填写 `inputVariables: [{"name":"参数名","value":"调用时的值"}]`、`expectedOutputs: [{"name":"结果名","value":"断言期望值"}]`，并从测试代码打印单行 `ACTUAL_JSON[<caseId>]: {"结果名":"运行得到的值"}`。变量名必须对应代码里的真实参数或结果；无法确定时留空数组，报告保留原始输入和预期文字，不得写“输入”“预期输出”当变量名。多个输出都必须逐个打印。值为数字、布尔或 null 时使用合法 JSON；文本值需要 JSON 转义。不要从预期值复制实际值。
  - Python：`print(f"ACTUAL[{case_id}]: {actual!r}")`
    结构化输出示例：`print(f"ACTUAL_JSON[{case_id}]: " + json.dumps({"discount": actual_discount}, ensure_ascii=False))`。
  - JS/TS：`console.log("ACTUAL[" + caseId + "]:", JSON.stringify(actual))`
    结构化输出示例：`console.log("ACTUAL_JSON[" + caseId + "]: " + JSON.stringify({ discount: actualDiscount }))`。
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

#### 执行准备失败速查

| 报错或返回内容 | 含义与处理 |
| --- | --- |
| `用例没有关联测试函数/测试名` | 该用例的 `testFunc` 为空，且无法从面板用例 `code` 提取测试名；核对实际注册名并补齐关联。整体执行时先将这条记为未执行；只有本次没有任何可执行目标才拒绝准备。 |
| `测试文件里找不到 <名字>` | 测试名已取得，但 `targetDeclare` 未在测试文件中匹配；核对名称、测试声明及 `runner.json` 的规则。该条会记为未执行。 |
| `这次没有可执行的用例` | 本次所有目标都缺少测试名或未通过声明检查；按括号中的逐条原因修复后重新点「执行」。 |
| `本会话还没有测试代码（...）` | `runner.json` 的 `testFile` 指向的文件不存在；生成测试文件或修正路径。 |
| `无法识别项目的测试框架` | 自动识别失败；核对项目实际测试方式，并按 Step 2.5 写 `runner.json`。 |

准备成功后还要核对返回的 `targetCount`、`missingTestFunc`；需要逐条复查时查看本次 `runs/<runId>/request.json` 的 `targets` 与 `notRun`，不要把“准备成功”当成所有用例都能执行。

> 每次执行（包括面板里单条用例的「执行」）都必须生成报告；单条执行只包含这一条用例，报告文件名带 caseId。

### Step 6: 生成 Word 报告
报告只消费**已经真实跑过的那次 run**：

- **每次执行都要生成报告，包括单条用例的「执行」**。单条执行的 snapshot/cases.json 只含该条用例，报告就只写这一条；文件名建议 `<项目>-<caseId>-测试报告.docx`。
- 报告必须落在 `reports/<runId>/`，否则面板工具栏「报告」和每行的「报告」按钮找不到它。

**先定位报告工具（Windows / PowerShell）**：报告工具独立部署在当前用户目录的 `.dsh\tools\testReport`，不从项目目录或 `DSH_HOME` 查找。把下面的占位值替换为本次执行的会话资产目录和 runId；找不到工具就明确报“报告工具未部署”，不要猜测其他位置。

```powershell
$reportRoot = Join-Path ([Environment]::GetFolderPath('UserProfile')) '.dsh\tools\testReport'
$sessionAssets = '<本次会话资产绝对路径>'
$runId = '<本次 runId>'
$bridge = Join-Path $reportRoot 'report-tool\bridge.py'
$builder = Join-Path $reportRoot 'report-tool\cmd.py'
$dshRoot = if ($env:DSH_HOME) { $env:DSH_HOME } else { Join-Path ([Environment]::GetFolderPath('UserProfile')) '.dsh' }
$reportPython = Join-Path $dshRoot 'dsh-runtimes\dsh-primary-runtime\dependencies\python\python.exe'
$runResult = Join-Path $sessionAssets "runs\$runId\result.json"
$reportDir = Join-Path $sessionAssets "reports\$runId"
if (-not (Test-Path -LiteralPath $bridge -PathType Leaf) -or
    -not (Test-Path -LiteralPath $builder -PathType Leaf)) {
  throw "报告工具未部署：$reportRoot"
}
if (-not (Test-Path -LiteralPath $reportPython -PathType Leaf)) {
  throw "DSH 自带 Python 3 未找到：$reportPython"
}
& $reportPython -c 'import sys; sys.exit(0 if sys.version_info.major == 3 else 1)'
if ($LASTEXITCODE -ne 0) { throw "报告工具需要 DSH 自带 Python 3：$reportPython" }
```

**6.1 桥接数据**：
```powershell
& $reportPython $bridge --run $runResult
```

不传 `--cases` 时 bridge 会自动读 `runs/<runId>/snapshot/cases.json`（本次执行的冻结用例）—— 这很重要：根目录的 `cases.json` 之后可能被改，快照不会。

`--run` 必须是**已经跑过的那次** runId 的 result.json。bridge.py：
- **不会**重跑测试；
- **不会**编造覆盖率（没真实数据就写「未采集」）；
- 变量表只写用例快照中的 `inputVariables`、`expectedOutputs` 和本次运行记录中的 `ACTUAL_JSON`；缺少结构化证据时保留原始文字并标明“未采集/未提供”，不能猜变量名或把预期当实际。
- 覆盖率**只读** result.json 里的 `coverage` 统计（runner 采到的真实数字）；采不到就写「未采集（原因）」，绝不编一个百分比。

**覆盖率怎么才有数字**（不是模型手填，是 runner 采的）：

- 每个 preset 已自带 coverage 配置（pytest / vitest / jest / go / maven / dotnet），runner 会在**用例跑完后额外跑一次采集**，解析报告后写进 result.json；
- 所以报告里总是「未采集」时，先看 `result.json` 的 `coverage.reason`，常见的两种：
  1. **没装采集插件** —— reason 里会直接给安装命令（如 `python -m pip install coverage pytest-cov`、`npm i -D @vitest/coverage-v8`）；**让用户装好再重跑**，不要自己编数据；
  2. **框架默认不采覆盖率**（C/C++ 的 ctest/gtest/meson）—— 在 `runner.json` 里写 `coverage` 接上 gcov/gcovr/lcov，例如：
     ```json
     { "coverage": { "command": ["gcovr", "-r", ".", "--xml", "{coverageFile}"],
                     "format": "cobertura", "file": "coverage.xml" } }
     ```
- 支持的 `format`：`coveragepy-json` / `istanbul-summary` / `go-cover` / `lcov` / `cobertura` / `jacoco`；
- 覆盖率采集失败**不会**把执行判成失败，不要因为它失败就把这次执行说成失败。
- 逐条结论**只认** result.json 里 `tests` 的逐条结果——`batch` 来自 JUnit，`per-case` 来自每条命令的退出码；找不到证据就标「未确认」，绝不用整体状态推断通过。

**6.2 生成报告**：
```powershell
$template = Join-Path $reportRoot 'templates\<适用的报告模板>.docx'
$reportSkill = Join-Path $reportRoot 'skills\<项目名>'
if (-not (Test-Path -LiteralPath $template -PathType Leaf)) { throw "报告模板不存在：$template" }
if (-not (Test-Path -LiteralPath $reportSkill -PathType Container)) { throw "项目报告 Skill 不存在：$reportSkill" }
& $reportPython $builder --template $template --data (Join-Path $reportDir 'report-data.json') `
  --skill $reportSkill -o (Join-Path $reportDir '<项目名>-测试报告.docx')
```

> 报告中间文件按 `reports/<runId>/` 存放，不同次执行不会互相覆盖。生成后面板工具栏「报告」就能看到。
先确认模板文件与该项目的报告 Skill 目录真实存在；不要把 RingBuffer 示例模板直接用于任意项目。

报告工具目录固定为当前用户目录下的 `.dsh\tools\testReport\`。
SKILL.md 的 frontmatter 写 `designer` / `reviewer` / `tester` 三个人员字段。

---

## 数据模型

```json
{
  "caseId": "TC-XXX-001",
  "title": "用例名称",
  "testType": "functional|api|boundary|logic|performance",
  "description": "测试说明",
  "input": "输入",
  "expected": "预期输出",
  "inputVariables": [{"name": "真实输入参数名", "value": "本用例取值"}],
  "expectedOutputs": [{"name": "真实结果名", "value": "断言期望值"}],
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
- **不能因为工具探测失败就整语言跳过**：任何语言都先按「工具链发现」的阶梯（env → 项目 wrapper → SDK 变量 → DSH 运行时 → PATH → 常见安装目录）继续找，找不到也要报告，不得静默少生成
- **Step 2 完成后自动弹出用例面板**：在生成用例的卡片中加 `lifeCycles.onMounted`，JSFunction 里调用 `window.__dshOpenDataPanel()` 自动弹出右侧数据面板；同时卡片里放一个「📋 打开用例面板」按钮作为备用
