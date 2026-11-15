# dsh-data-panel

一个给 DeepSeek Harness 用的测试用例台账 + 执行入口：

- **对话行新增「面板」按钮**，点击后在右侧栏打开测试用例看板；工作流也可调用 `window.__dshOpenDataPanel()` 自动打开。
- **表格列**：用例标识 / 用例名称 / 测试类型 / 测试说明 / 输入 / 预期输出 / 操作。
- **分页**：表格右下角有分页栏，可选每页 5 / 10 / 20 / 50 条，上一页 / 下一页 / 页码。
- **增删改查**：搜索（名称、标识、说明、输入、输出）、按测试类型筛选、新增、编辑、删除。
- **查看测试代码**：用例按钮按本会话运行器的 `testFile` 和用例 `testFunc` 定位实际测试文件；旧 `codeRef` 指错路径时只提示，不会跳到源码。
- **点击用例名称 → 右侧栏详情**：右侧栏展示输入、预期输出与代码，可继续编辑或删除。
- **执行（一键就绪）**：工具栏「全部执行」和每行「执行」会先让宿主**准备这次执行**（导出当前面板用例 → 分配 runId → 生成命令），再把命令预填进**面板所属会话**的输入框。切到对话按回车即可。
- **执行不绑定语言**：面板只认一份「运行器描述」——测试文件在哪、命令怎么拼、逐条结果从哪来。内置 pytest / Vitest / Jest / Node test / go test / cargo / dotnet / Maven / Gradle / CTest / GoogleTest，项目也可以用 `runner.json` 完全自定义。
- **日志由执行过程自己写**：命令跑的是本插件的通用 runner（`run_tests.py`），它边跑边把原始输出送到对话，同时写进 `runs/<runId>/run.log`，结束时写 `result.json`（退出码 / 通过失败数 / 耗时 / 超时或中断状态）。不靠模型事后回传，所以不会“对话里有、面板里没有”。
- **查看日志**：展开执行记录后，每条记录的「日志」按钮看这次执行；工具栏「日志」看本会话**最近一次整体**执行。弹窗里同时显示通过与失败数、耗时、runId。没跑过就明确显示「还没有执行过」。
- **执行记录**：每行可展开，按时间列出这条用例每次单独执行的时间、结果（通过/未通过）、耗时和**实际输出**。实际输出取测试代码打印的 `ACTUAL[<caseId>]: <值>`，没打印就显示「未记录实际值」（失败时退回断言信息）。每条记录都有自己的「报告 / 日志」按钮，也可删除该条记录。
- **查看报告（只读）**：工具栏「报告」打开最近一次**整体执行**的 Word 报告；每条执行记录的「报告」按钮打开**这次执行**的 Word 报告。报告优先在**右侧栏**用 DSH 的文档预览打开（docx 由宿主转 PDF），失败时才回退系统默认程序。没有报告时按钮会在面板顶部明确提示，不会打开空白页。面板只展示/打开，不生成报告 —— 生成走 `bridge.py`，且默认读该次 run 的快照用例；单条执行的快照只含这一条。

## 执行模型

「执行 / 全部执行」不是由面板直接启动测试，而是：

1. **准备（宿主）**：解析运行器 → 导出本会话用例到 `cases.json` → 校验测试文件存在并记录 SHA256 → 把本次要跑的目标冻结进 `runs/<runId>/request.json` → 返回一条命令；
2. **执行（runner）**：模型在对话里原样执行这条命令。`run_tests.py` 读 `request.json`，重算测试文件哈希，按运行器描述跑测试；
3. **记录（runner）**：边跑边写 `run.log`，结束时写 `result.json`。逐条结果写进 `tests`，报告与面板都只认这里。

> runner 本身是一个小的 Python 胶水脚本（DSH 自带运行时）。它不参与被测项目的构建，也不要求项目是 Python；真正跑测试的是 `runner.json` 里声明的项目原生命令。

两种执行粒度：

| mode | 命令形态 | 逐条结果来源 | 适用 |
| --- | --- | --- | --- |
| `batch` | 一个进程跑完本次所有目标（`{targets}` 展开） | JUnit XML（`junit`） | pytest 等能产出 JUnit 的框架 |
| `per-case` | 每条用例一个进程（`{target}` 替换） | 每条命令的退出码 | 大多数框架；不需要 JUnit |

`per-case` 下如果命令退出码为 0、但输出命中了运行器声明的 `notRunPattern`（例如 `node --test` 没匹配到用例也返回 0），该条标记为**未确认**，不会被算成通过。

单条执行同样有独立的 runId、日志和报告；prepare 会把它自己的 `snapshot/cases.json` 过滤成只有这一条，报告不会把同会话的其他用例写成「未执行」。

## 内置框架

| preset | 语言 | 模式 | 默认测试文件 |
| --- | --- | --- | --- |
| `pytest` | Python | batch | `<会话资产>/tests/test_generated.py` |
| `vitest` | JavaScript / TypeScript | per-case | `<会话资产>/tests/test_generated.test.mjs` |
| `jest` | JavaScript / TypeScript | per-case | `<会话资产>/tests/test_generated.test.js` |
| `node-test` | JavaScript / TypeScript | per-case | `<会话资产>/tests/test_generated.test.mjs` |
| `go` | Go | per-case | `<项目>/tests/test_generated_test.go` |
| `cargo` | Rust | per-case | `<项目>/tests/generated.rs` |
| `dotnet` | C# | per-case | `<项目>/GeneratedTests.cs` |
| `maven` | Java | per-case | `<项目>/src/test/java/GeneratedTest.java` |
| `gradle` | Java / Kotlin | per-case | `<项目>/src/test/java/GeneratedTest.java` |
| `ctest` | C / C++ | per-case | `<项目>/tests/generated_test.cpp` |
| `gtest` | C / C++ | per-case | `<项目>/tests/generated_test.cpp`（`binary` 指向已构建的测试可执行文件） |
| `meson` | C / C++ | per-case | `<项目>/tests/generated_test.cpp`（`meson test -C build`） |

没有 `runner.json` 时，宿主按项目标记识别：`go.mod` / `Cargo.toml` / `pom.xml` / `build.gradle*` / `*.csproj|*.sln` / `CMakeLists.txt`（内容引了 GoogleTest 就用 gtest，否则 CTest）/ `meson.build` / `package.json` 依赖 / Python 测试迹象。识别不出来会明确报错，让你写 `runner.json`，**不会**默默按 Python 猜。

> 内置命令是**常见默认值**，不是对所有项目都保证正确。第一次接入某个项目时，应由 Skill 核对项目实际的测试命令；不一致就写 `runner.json` 覆盖。

### 每个 preset 需要什么工具

`tools` 是运行已有测试必需的工具；`buildTools` 只描述需要重新构建时的工具。每项可以是工具名，也可以是**任选其一**的数组：

| preset | `tools`（运行） | `buildTools`（构建） |
| --- | --- | --- |
| `ctest` | `['ctest']` | `['cmake', ['g++', 'clang++', 'cl']]` |
| `gtest` | `[]`，但必须有 `binary` | `['cmake', ['g++', 'clang++', 'cl']]` |
| `meson` | `['meson', 'ninja']` | — |

C/C++ 没有“必须装 g++”这回事：MSVC（`cl`）、GCC（`g++`）、Clang（`clang++`）任选一个就行，缺的时候报的是整组 `g++|clang++|cl`。

Windows 上这些工具**通常不在 PATH**（尤其是 Visual Studio 自带的 `cl.exe` / `cmake.exe`），所以解析器会额外扫这些固定落点：

- `%ProgramFiles%\CMake\bin`、`%LOCALAPPDATA%\Programs\CMake\bin`、`%ProgramFiles%\LLVM\bin`；
- `%ProgramFiles%\Microsoft Visual Studio\<年>\<版>\Common7\IDE\CommonExtensions\Microsoft\CMake\CMake\bin`（VS 自带 cmake/ctest）；
- `…\VC\Tools\MSVC\<版本>\bin\Hostx64\x64`（`cl.exe`）、`…\MSBuild\Current\Bin`；
- `C:\msys64\mingw64\bin`、`C:\msys64\usr\bin`、`C:\MinGW\bin` 等 MinGW/MSYS2 常见位置；
- `VCPKG_ROOT` / `VCINSTALLDIR` / `VCToolsInstallDir` / `VSINSTALLDIR` / `CMAKE_ROOT` 这些环境变量指到的目录。

装在别处（内网很常见）时不用改代码，也不用改 PATH：

```powershell
$env:DSH_TOOL_SEARCH_DIRS = 'D:\tools\cmake-3.29\bin;D:\tools\msys64\mingw64\bin'
```

支持 `*` 通配（如 `D:\tools\cmake-*\bin`），也可以只给单个工具：`$env:DSH_CMAKE_PATH = 'D:\tools\cmake\bin\cmake.exe'`。

## runner.json

位置：`<项目>/.dsh/test-sessions/<sessionId>/runner.json`。Skill 最清楚项目用什么语言/框架，所以优先由 Skill 写这个文件；面板只负责消费。

```json
{
  "preset": "go",
  "testFile": "project:tests/test_generated_test.go"
}
```

完全自定义（不依赖任何内置 preset）：

```json
{
  "id": "rspec",
  "label": "RSpec",
  "language": "ruby",
  "testFile": "tests/generated_spec.rb",
  "mode": "per-case",
  "command": ["bundle", "exec", "rspec", "{file}", "-e", "{target}"],
  "targetExtract": "it\\s+['\"]([^'\"]+)['\"]",
  "targetDeclare": "['\"]{target}['\"]",
  "timeoutSec": 900
}
```

C++ / GoogleTest 项目：`binary` 指向构建产物，`preCommand` 可选地先构建：

```json
{
  "preset": "gtest",
  "testFile": "project:tests/generated_test.cpp",
  "binary": "project:build/tests/generated_test",
  "preCommand": ["cmake", "--build", "{project}/build", "--config", "Release"]
}
```

字段：

| 字段 | 说明 |
| --- | --- |
| `preset` | 可选，内置框架 id；给了就以内置命令为底，再用本文件覆盖 |
| `testFile` | **必填**。`project:xxx` 相对项目、`root:xxx` 相对会话资产、绝对路径，或直接相对会话资产目录 |
| `binary` | 编译型框架（gtest）要执行的可执行文件；`project:` / `root:` / 绝对路径，未写扩展名时 Windows 自动补 `.exe` |
| `mode` | `batch` 或 `per-case`；默认 `per-case` |
| `command` | **必填**，字符串数组。`{target}` 单条目标、`{targets}` 本次全部目标 |
| `preCommand` | 执行测试前先跑一次的命令（如 `cmake --build`）；非 0 退出码 → 状态 `build-failed` |
| `targetArg` | batch 模式每个目标的写法，默认 `{file}::{target}`（如 pytest 的 `file.py::test_x`） |
| `junit` | batch 模式的 JUnit XML 路径，默认 `junit.xml`（在 run 目录下） |
| `cwd` | 命令工作目录，默认 `{project}` |
| `env` | 追加环境变量，值支持占位符 |
| `shell` | `true` 或 `"win32"`；启动 `.cmd` / `.bat`（npx、mvn、gradlew）时需要 |
| `targetExtract` | 从用例代码里提取目标的 JS 正则（字符串或数组，取第一个捕获组） |
| `targetCompose` | 多个捕获组时如何拼成目标，如 `{1}.{2}`（gtest 的 `Suite.Name`） |
| `targetDeclare` | 测试文件里校验目标的 JS 正则，`{target}` 会被转义后替换 |
| `targetDotted` | 为 `true` 时把 `Suite.Name` 按 `Suite, Name` 的形式去测试文件里校验 |
| `targetEscape` | 为 `true` 时把 `{target}` 当正则字面量转义（`-t`、`-run` 这类正则过滤参数） |
| `notRunPattern` | 退出码 0 但输出命中该正则 → 该条记为「未确认」 |
| `timeoutSec` | 整次执行超时，默认 1800 |
| `coverage` | 覆盖率采集配置，见下节「覆盖率」 |

命令占位符（宿主解析）：`{python}` `{node}` `{npx}` `{gradlew}` `{binary}` `{project}` `{root}` `{runId}` `{runDir}` `{file}` `{junit}`；`{target}` / `{targets}` 由 runner 解析。

**用例的 `testFunc`**：可以是测试函数名（pytest/go/JUnit）或测试名（Vitest/Jest/Node test）。Skill 生成用例时应把它写进 `cases.json`；没写时面板会按 `targetExtract` 从用例代码里推断。

## 覆盖率（为什么以前总是「未采集」）

旧版本有两个断点，缺一个都出不来数字：

1. **执行器根本不采集**：`run_tests.py` 只跑测试、解析 JUnit，没有任何覆盖率命令；
2. **桥接写死**：`bridge.py` 把每个模块的 `coverage` 固定为字符串 `未采集`。

所以那时的「未采集」**不是模型忘了填**，而是链路两端都不存在。现在两端都通了。

### 现在怎么采

```
preset/runner.json 的 coverage 配置
   → run_tests.py 额外跑一次采集命令（失败不影响用例结论）
   → 解析报告 → result.json 的 coverage 统计
   → bridge.py 写成 `-S 行% -B 分支%`
   → Word 模板「覆盖率记录：」那一行
```

`coverage` 的形状：

```json
{ "coverage": {
    "command": ["{python}", "-m", "pytest", "--cov=.", "--cov-report=json:{coverageFile}"],
    "format": "coveragepy-json",
    "file": "coverage.json",
    "hint": "需要 coverage.py 与 pytest-cov",
    "timeoutSec": 900 } }
```

- `command`：一条 argv 数组（**元素必须是字符串**），可用 `{coverageFile}` / `{coverageDir}`；
- `file`：报告文件，相对 runDir，或 `project:` / `root:` / 绝对路径；支持 `*` 通配（取最新一份）；
- `format`：解析器名，支持 `coveragepy-json` / `istanbul-summary` / `go-cover` / `lcov` / `cobertura` / `jacoco`；
- `hint`：采不到时写进报告原因里，告诉用户装什么。

### 各语言默认怎么配

| preset | 采集命令 | 需要准备什么 |
| --- | --- | --- |
| `pytest` | `pytest --cov=. --cov-branch --cov-report=json` | `python -m pip install coverage pytest-cov` |
| `vitest` | `vitest run --coverage --coverage.reporter=json-summary` | `npm i -D @vitest/coverage-v8` |
| `jest` | `jest --coverage --coverageReporters=json-summary` | `jest` 自带；需可插桩源码 |
| `go` | `go test -coverprofile=coverage.out ./...` | 自带，无需插件 |
| `maven` | `mvn test jacoco:report` | `pom.xml` 配 `jacoco-maven-plugin` |
| `dotnet` | `dotnet test --collect:"XPlat Code Coverage"` | `coverlet.collector` 包 |
| `ctest` / `gtest` / `meson` | 默认不采，用 `runner.json` 接 gcov/lcov | 如 `gcovr --xml -o coverage.xml` → `format: cobertura` |

C/C++ 的例子（接 lcov/gcovr 后就能出数字）：

```json
{ "preset": "gtest",
  "coverage": {
    "command": ["gcovr", "-r", ".", "--xml", "{coverageFile}"],
    "format": "cobertura",
    "file": "coverage.xml" } }
```

### 采不到时会怎样

- 用例的通过/失败**不受影响**，执行不失败；
- `result.json` 写 `coverage.available = false` + `reason`；
- 报告里显示 `未采集（<原因>）`，例如 `未采集（没生成覆盖率报告（coverage.json）；需要 coverage.py 与 pytest-cov：python -m pip install coverage pytest-cov）`；
- 绝不自己编一个百分比。

## 会话资产目录

项目内，插件**不会**自动写 `.gitignore`，建议你自己忽略 `.dsh/`：

```
<项目>/.dsh/test-sessions/<sessionId>/
    runner.json                本会话的运行器描述（可选；Skill 写入）
    cases.json                 本会话用例（执行前从面板导出，示例行不导出）
    tests/test_generated.py    本会话测试代码（Python/pytest 约定）
    run_tests.py               通用 runner（每次准备时覆盖为包内最新版）
    runs/<runId>/request.json  本次执行**冻结**的目标用例、测试文件与运行器描述
    runs/<runId>/run.log       原始输出（边跑边写，不是最后才写）
    runs/<runId>/junit.xml     batch 模式的逐条结果（pytest 等）
    runs/<runId>/result.json   退出码 / 通过失败 / 耗时 / 逐条结果
    runs/<runId>/snapshot/     当次的用例与测试代码快照
    reports/<runId>/           绑定该次 run 的报告
```

**整体报告和单条报告都按会话存，结构相同：**

- `runs/<runId>/`：这次执行的输入与结果（`request.json` / `run.log` / `result.json` / `junit.xml` / `snapshot/`）。
- `reports/<runId>/`：这次执行的报告（`report-data.json` + Word 文件）。
- `result.json` 的 `scope: "all"` 是整体执行；`scope: "case"` + `caseId` 是单条执行。
- 单条执行的 `snapshot/cases.json` 只含这一条用例，所以单条报告只写一条。
- 报告**按会话隔离**：A 会话跑出来的报告，B 会话的面板看不到；切换工作目录后靠 `assets-<sessionId>.json` 仍能按 runId 找回。

执行期间你再改面板，也不会影响已开始的这次执行与报告。

- **按会话持久化**：每个会话一份 `<DSH_HOME>/plugin-data/dsh-data-panel/records-<sessionId>.json`，切换会话各自看到自己的用例；刷新页面、重启应用都不丢。
- **示例数据**：首次启动写入 7 条示例用例，面板顶部有「示例数据」标识和「清空示例」按钮。

交互参考了 `dsh-genui` 的卡片式面板：克制的标题栏、工具栏、类型 pill、行 hover、右侧详情，不抢对话区的视觉重心。

## 安装

在插件目录执行（把路径换成你的实际路径）：

```powershell
dsh plugin --profile desktop add file:D:/1/dsh-data-panel/dsh-data-panel/package
```

安装完成后**刷新页面**（Ctrl/Cmd + Shift + R），对话行末尾会出现「面板」按钮。

> 跨盘安装（工作区在 D 盘、profile 在 C 盘）是复制而不是硬链接：改完 `lib/` 里的代码要重新装一次才生效。

## 使用

1. 打开任意会话，点对话行末尾的「面板」。
2. 点「新增用例」填写用例标识、用例名称、测试类型、测试说明、输入、预期输出、代码。
3. 点表格里的用例名称，在右侧栏查看详情；详情页可以「编辑」「删除」。
4. 操作列：「</>」查看代码、「铅笔」编辑、「垃圾桶」删除（有二次确认）。
5. 表格右下角分页栏可切换每页条数（5 / 10 / 20 / 50）并翻页。
6. 顶部「清空示例」只删除标记为示例的用例，你自己新建/编辑过的内容会保留。
7. 点「执行 / 全部执行」→ 切到对话按回车 → 回面板看「日志」；报告生成后在「报告」里打开。

## 数据模型

```ts
type TestCase = {
  id: string                                          // rec_xxxxxxxxxxxx
  caseId: string                                      // 用例标识（≤80，留空时后端生成 TC-xxxxxxxx）
  title: string                                       // 用例名称（必填，≤200）
  testType: 'functional' | 'api' | 'boundary' | 'logic' | 'performance'
  description: string                                 // 测试说明（≤2000）
  input: string                                       // 输入（≤4000，按换行原样展示）
  expected: string                                    // 预期输出（≤4000，按换行原样展示）
  code: string                                        // 代码（≤20000，代码弹窗里按原样展示）
  demo: boolean                                       // 是否示例数据
  createdAt: string                                   // ISO
  updatedAt: string                                   // ISO
}
```

测试类型的中文标签：功能测试 / 接口测试 / 边界测试 / 逻辑测试 / 性能测试。

## 数据存储

```
<DSH_HOME>/plugin-data/dsh-data-panel/records-<sessionId>.json   每个会话一份（唯一在用）
<DSH_HOME>/plugin-data/dsh-data-panel/assets-<sessionId>.json    该会话用过的资产根（切换工作目录后仍能找回旧 run）
<DSH_HOME>/plugin-data/dsh-data-panel/records.json                 旧版全局文件（已弃用，仅保留在磁盘）
```

- 默认 `DSH_HOME` 是 `C:\Users\<你>\.dsh`（Windows）或 `~/.dsh`。
- **按会话隔离**：每个会话读写自己的 `records-<sessionId>.json`，文件名里的会话 ID 只保留 `[A-Za-z0-9_-]` 并截断到 120 字符。切换会话看到的就是该会话自己的用例。
- **旧全局文件已弃用**：不再迁移、也不再读取。文件本身留在磁盘上作为历史备份，可以随时手动删除。
- **不带 `sessionId` 的请求会被拒绝**（400），不再回退到任何共享文件。
- **会话 ID 一律可区分**：符合 DSH 格式的直接用；不合法字符会被清洗并**额外拼上原值哈希**，两个不同会话绝不会指向同一个文件。
- 首次读取不存在时自动创建，并写入 7 条示例用例。
- 写入走「临时文件 + rename」；读到损坏 JSON 时会把原文件改名为 `<文件名>.corrupt-<时间戳>`，再重建示例数据。
- 旧版本数据文件会改名为 `.v<旧版本>-<时间戳>` 保留（如记录面板 v1、无代码字段的 v2），然后重建用例数据。
- 读取时容忍 UTF-8 BOM，避免用记事本手改过文件后被当成损坏而隔离。
- 所有写操作在 Host 进程内串行化，避免并发覆盖。

## HTTP 接口

Host 半在 `ctx.webServer` 上注册同源路由：

```
GET  /data-panel/api?sessionId=<会话ID>
POST /data-panel/api   { "sessionId": "<会话ID>", "op": "create" | "update" | "delete" | "clearDemo", … }
GET  /data-panel/test-code?sessionId=<会话ID>&cwd=<项目>&caseId=TC-001
  → { ok, caseId, testFile, testFunc, line, warning }

POST /data-panel/run/prepare  { "sessionId": "<会话ID>", "scope": "case"|"all", "caseId": "TC-001" }
  → { ok, runId, root, command, targetCount, testFile,
      framework, frameworkId, runnerMode, language, missingTestFunc }
GET  /data-panel/run/latest?sessionId=<会话ID>&cwd=<项目>&scope=case&caseId=TC-001
GET  /data-panel/run/log?sessionId=<会话ID>&cwd=<项目>&runId=<runId>
GET  /data-panel/run/result?…&runId=<runId>
GET  /data-panel/run/report?…[&runId=<runId>]
GET  /data-panel/run/report/latest?sessionId=<会话ID>&cwd=<项目>&scope=all|case[&caseId=TC-001]
POST /data-panel/open   { "sessionId": "<会话ID>", "cwd": "<项目>", "path": "<报告绝对路径>" }

GET  /data-panel/tools
```

`sessionId` 必填。缺失或为空时接口返回 `400`，不会再回退到任何共享文件。

`GET /data-panel/tools?project=<项目路径>` **不需要 `sessionId`**，是给 Skill / 模型用的工具探活入口，**与语言无关**：

```json
{ "ok": true, "project": "E:\\proj", "detected": "pytest", "detectedAvailable": true,
  "tools": { "python": "C:\\…\\python.exe", "go": "", "cargo": "C:\\…\\cargo.exe" },
  "presets": { "pytest": { "label": "pytest", "language": "python", "available": true, "tools": { "python": "C:\\…" }, "missing": [], "buildAvailable": true, "buildMissing": [] },
               "go": { "available": false, "missing": ["go"] } },
  "searched": ["env", "project", "sdk-home", "dsh-runtimes", "path", "common-install-dirs"] }
```

- 需要哪些工具**不在接口里写死**：每个 preset 用 `tools: [...]` 声明运行所需工具，可用 `buildTools: [...]` 声明构建所需工具；`available` 与 `buildAvailable` 分开报告。只有配置了 `preCommand` 才检查它实际调用的构建命令。
- 解析器是 `lib/toolchain.js` 的 `resolveTool`，按以下顺序搜索（命中即返回）：
  1. `DSH_<TOOL>_PATH` 显式指定；
  2. `DSH_TOOL_SEARCH_DIRS` 自定义目录；
  3. 项目内 wrapper / 本地依赖：`mvnw`、`gradlew`、`node_modules/.bin`、`.venv/Scripts`、`.venv/bin`、`build/install/bin`、`target/debug|release`；
  4. SDK 根变量：`<TOOL>_HOME` / `<TOOL>_ROOT`（如 `M2_HOME`、`JAVA_HOME`、`GOROOT`、`DOTNET_ROOT`、`CARGO_HOME`）；
  5. DSH 自带运行时：`$DSH_HOME/dsh-runtimes/**` 限深扫描（Python / Node 就在这里，**不写死路径**）；
  6. `PATH`；
  7. 常见安装目录 + 版本管理器（nvm / volta / pyenv / sdkman / rustup / scoop / chocolatey / Homebrew…），支持一层 `*` 通配。
- `tools` 里的空串含义是「上述层级都找过，没找到」，**不代表项目不能用这门语言**（可能没装、装在非标准位置，或用项目自带 wrapper）。所以要报告缺什么，而不是静默跳过。
- 全部是纯文件系统探测，不 spawn 子进程：响应快，也不会被装坏的工具卡住。

`sessionId` 决定读写哪个会话的数据文件，它是唯一的数据归属依据。

返回统一为 `{ ok: true, … }` 或 `{ ok: false, error }`。

`run/prepare` 关键行为：

- **项目目录由宿主确定**：使用会话自身的 `header.cwd` / 活跃工作目录，客户端传的 `cwd` 只作为兜底，并校验必须是绝对且存在的目录。
- **命令里不拼用户内容**：用例标识、测试目标、运行器描述全部写进 `runs/<runId>/request.json`；命令只含宿主生成的路径与 runId。
- **真正幂等**：测试文件**在原位执行**（不变路径，conftest / `__file__` / import 路径行为不变）；prepare 会记下它的 SHA256，runner 执行前重算，**不一致就拒绝执行**并提示重跑 —— 不会默默跑成另一个版本。用例快照 `runs/<runId>/snapshot/` 仍存一份，供报告与事后复查。
- **快速失败**：本会话没有测试代码、或没有任何可执行目标时直接 `400`，并说明**识别到的框架**和期望的测试文件路径。
- **精确执行**：batch 模式按 `<测试文件>::<函数名>` 逐个传，per-case 模式每条用例单独一条命令；不用 `-k` 名称匹配，不会多跑名称相近的测试。
- **目标存在性校验**：prepare 会按运行器声明的 `targetDeclare` 检查目标确实在测试文件里；认不出或找不到的用例计入 `notRun` 并说明原因，不会拿着旧名字去跑。
- **runId 严格校验**：只允许 `[A-Za-z0-9_-]`，拒绝 `.` / `..` 与路径穿越。
- **资产根不淘汰**：prepare 会把这个会话用过的每个资产目录都记进 `assets-<sessionId>.json`（无上限），切了 working directory 后旧 run 仍能按 runId 找回来。
- **导出用例**：同时把当前面板用例写到 `<会话资产>/cases.json`（示例行不导出）。面板自己不跑测试，模型也不回传日志 —— 一切由 runner 边跑边写。

## 目录

```
lib/index.js          Host 半：会话存储 + API + 执行准备/日志读取
lib/runners.js        运行器适配层：框架识别、runner.json 校验、目标提取与命令渲染
lib/toolchain.js       工具链发现：任意工具名的多层搜索阶梯（与语言无关）
lib/client.js         Client 半：「面板」按钮 + 右侧栏看板和详情
assets/run_tests.py   通用执行器：按 request.runner 执行并产生日志与结构化结果
test/                 适配层单测 + pytest / Node test 端到端测试（node --test test）
cordis.patch.yml      Bundle 挂载行
```

### 扩展点

- 对话行按钮：客户端在会话标签行挂载「面板」入口
- 右侧栏详情类型：`ctx.sidebarRightTabs.register({ id: 'data-panel-detail', kind: 'data-panel-detail' })`
- 详情正文：`ctx.slots.register({ name: 'sidebar.right.pane.tab', key: 'data-panel-detail' })`
- 打开详情：`ctx.sidebarRight.openTab('data-panel-detail', { params: { id } })`
- 新增语言/框架：往 `lib/runners.js` 的 `PRESETS` 加一项并写 `tools: [...]`（工具探活会自动覆盖它），或让项目写 `runner.json`

## 已知边界（v0.4）

- **batch 模式依赖 JUnit**：没有 JUnit 或 JUnit 里匹配不到测试名时，该条记为「未确认」，不会推断通过。需要逐条证据又不想产出 JUnit 的项目请用 `per-case`。
- **内置命令是默认值**：pytest、Node test 和 gtest 的链路有自动化端到端测试；其余 preset 的默认命令按各框架常见用法编写，首次接入请由 Skill 核对后按需用 `runner.json` 覆盖。
- **编译型语言要先构建**：gtest 的 `binary` 必须已经存在；可以在 `runner.json` 里用 `preCommand` 让面板先构建，或由 Skill 在准备前构建好。`ctest` 同样不负责构建。
- **测试文件位置**：Python/JS 默认放会话资产目录；Go / Java / C# / Rust / C++ 通常要求测试文件位于项目源码树内，用 `project:` 声明。会话隔离由 Skill 的目录命名保证。
- 表格列和表单字段是固定的；要加列（例如「执行结果」「负责人」）需要同步改 `lib/index.js` 的校验和 `lib/client.js` 的表格与表单。
- 客户端在切换会话时会作废仍在飞行中的旧请求（epoch 令牌），旧会话的响应不会覆盖新会话的列表。
- 写入响应回到界面时会核对会话（`mutate`）：如果用户已经切走，就不改当前列表，但数据已经写进它自己的文件。
- 详情页会记住自己属于哪个会话；即使右侧栏保留着旧详情、主区已经切走，它也只读写自己那个会话的记录。
- 会话 ID 还没就绪时面板不发请求，显示「正在取得当前会话」，避免误读共享数据。
- 执行按钮只负责**预填指令**，不自动发送、也不回写执行结果；实际执行与结果由会话里的模型完成。
- 没有多用户/权限控制；它运行在本机 DSH 进程里，路由绑定在本地 web server 上。
