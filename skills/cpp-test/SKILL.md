---
name: cpp-test
description: C++ 单元测试专项：结合 ai-test-workflow 完成原生构建、GoogleTest 目标配置和 VS CodeCoverage 覆盖率采集；用于被测代码含 C++ 的测试任务。
---

# C++ 测试专项 Skill

本 Skill 与上一级 [整体测试 Skill](../SKILL.md) 结合使用。若整体流程尚未加载，先读取它；若已加载，直接按当前步骤继续，不反复跳转读取。用例拆分、类型、函数分组与编号、范围清单、实际输出 JSON 自检、审查、执行后差异分析和报告统一遵循主 Skill，本文件只补充 C++ 细节。

识别到 C++ 后先读本文件，再按项目原有 MSBuild/CMake/Make 等方式准备测试。Windows 客户环境优先使用本地 GoogleTest 与 VS CodeCoverage.exe；已有其他适用框架时尊重工程现状，不为套 preset 改建项目。不默认联网下载依赖，不改写被测源码迎合测试，也不新增执行中途的确认环节。

## 构建与测试入口

- 先检查工具接口的 ctest/gtest 缺项，再按主 Skill 的工具搜索阶梯查找；编译器候选是 g++、clang++ 或 cl，实际采用哪种取决于项目 ABI、平台和构建配置，不能随意替换。
- Windows 的 cl、MSBuild、CMake、CTest 可能不在 PATH；核对 VS 安装根及开发者环境。单个工具可用 DSH_CMAKE_PATH 等变量指定，非标准安装根可用 DSH_TOOL_SEARCH_DIRS 指定，不将一次命令失败当成未安装。
- 复用项目已有 gtest 头文件、库和构建目标，保持架构、运行库与构建配置一致。找得到 cl.exe 不代表开发者环境、SDK、库均完整；构建错误保留原文，定位头文件、库或配置原因，不擅自修复系统文件。
- gtest preset 的 binary 指向本次真实测试可执行文件；testFile 用 project: 声明真实测试源码路径。将 Suite.Name 保存为 testFunc，以 --gtest_list_tests 核对实际注册名，不把 caseId 或显示编号直接当测试入口。
- 需要在执行前构建时使用 runner 的 preCommand；它是一条 argv 数组。CMake configure 需按原有授权提前完成，或由一个构建脚本串联 configure/build。prepare 允许有 preCommand 时 binary 尚未生成，但正式测试前必须构建成功，不能据此声称已验证。
- CTest 项目通常无需 binary；核对已注册的测试目标及项目筛选命令。只有 Makefile/vcxproj 等入口、无法自动识别时，显式写 runner.json，不擅自引入 CMake。
- 一条面板用例对应一个可筛选、可取得逐条证据的测试项。本 Skill 不改动“查看测试代码”的既有定位逻辑。

gtest 有两种执行模式，**各对应一个完整 preset，选一个就行，不要自己改 mode**（路径与命令按项目核实）：

逐条执行（默认，一条用例一个进程，退出码即证据）——要覆盖的用例少，或期望每个用例独立进程时用：

```json
{
  "preset": "gtest",
  "testFile": "project:tests/generated_test.cpp",
  "binary": "project:build/tests/generated_test.exe",
  "preCommand": ["cmake", "--build", "{project}/build", "--config", "Debug"]
}
```

整批执行（一次进程跑完，逐条结果来自 JUnit XML）——要跑完整套或需要 JUnit 逐条证据时用：

```json
{
  "preset": "gtest-batch",
  "testFile": "project:tests/generated_test.cpp",
  "binary": "project:build/tests/generated_test.exe",
  "preCommand": ["cmake", "--build", "{project}/build", "--config", "Debug"]
}
```

**铁律：写 `preset` 时不要同时写 `mode`、`command`、`targetArg`、`targetsSeparator`、`junit`。**
这些字段由 preset 提供，且彼此配套（`per-case` 用 `{target}`，`batch` 用 `{targets}`）；
单独覆盖 `mode` 会让继承来的 `command` 占位符对不上，插件会直接报错。
确实需要自定义命令时，去掉 `preset`，自己写完整的 `id` / `mode` / `command`。

## 先核实本机能力

1. 检查项目已有 gtest 头文件、库、vcpkg/包缓存、构建配置及测试二进制，调用该二进制 `--gtest_list_tests` 核实真实测试目标。gtest 是库/测试框架，不应把找不到 `gtest.exe` 当作未安装。
2. 覆盖率工具先查显式路径 `DSH_CODECOVERAGE_PATH`，再查 VS 安装位置（可用本地 vswhere 的 installationPath）。在这些安装根内查找：
   - `Team Tools/Dynamic Code Coverage Tools/CodeCoverage.exe`（旧版，可有 amd64 子目录）；
   - `Common7/IDE/Extensions/Microsoft/CodeCoverage.Console/Microsoft.CodeCoverage.Console.exe`（新版）。
   - 同时考虑 Program Files、Program Files (x86)、VSINSTALLDIR 和客户提供的离线目录，按已知安装根限深查询，不扫描全盘。
3. 保存实际可执行文件路径、版本及 `/?` 或 `--help` 输出。旧版 CodeCoverage.exe 与新版 Microsoft.CodeCoverage.Console 的命令不同，必须按该机器帮助配置，不能互换参数。
4. 检查匹配版本与架构的 PDB、被测二进制和收集器；需要 VS 开发者环境时使用本机开发者命令行。原生静态插桩需要核实链接选项（如 `/PROFILE`）和运行库，不只确认“exe 存在”。构建配置修改需说明具体范围，不自动批量改项目。
5. 不将 NuGet 同名包、旧版工具与 VS 安装版控制台视为等价。检查实际帮助与一个小型原生测试的结果：退出码 0、文件存在甚至提示“结果已生成”都不足以证明采集成功；必须有业务模块及可核对的计数。只有 `<results />` 的 XML 或无模块的报告属于未采集到，不能记为 0% 或成功。安装额外工具需遵守用户授权和客户离线要求。

## 旧版 CodeCoverage.exe：优先复用已验证的本地链路

### 构建和配置

1. 使用未被其他性能分析工具插桩的 Debug 测试二进制、同次构建的完整 PDB（如 /Zi 与 /DEBUG:FULL），关闭优化。旧版动态采集不要求先调用 vsinstr；已经用 vsinstr 插桩的实验程序应重新构建后再采集，不混用新旧链路的插桩步骤。
2. 从当前选定 VS 安装的 Dynamic Code Coverage Tools/CodeCoverage.config 复制配置到本会话资产目录，再修改业务模块和源码过滤。不要从几行精简 XML 起步，不覆盖 VS 安装目录中的配置。
3. 保留工具自带配置中的 AllowLowIntegrityProcesses 等连接设置，不因精简配置而遗漏。该项控制低完整性进程能否连接；对本次可信测试进程按原配置及环境需要设置，空报告时核对它。不要将某个环境的连接要求推断为所有环境都需改系统权限，不为此默认提权或关闭系统防护。
4. 对 ModulePaths/Sources 使用当前工具支持的正则，匹配实际二进制名和 PDB 中的业务源码路径，排除 gtest、测试实现和第三方库。先用原默认配置确认有数据，再逐步添加过滤；不能把过滤后空报告当成业务覆盖率 0%。

### 采集和导出

以下是旧版参数结构；以选中工具的帮助为准，路径按项目实际值替换。PowerShell 中使用调用运算符和独立参数，不把整条命令拼成一个字符串：

```powershell
& $coverageExe collect "/config:$coverageConfig" "/output:$rawCoverage" $testBinary "--gtest_filter=$selectedTargets"
& $coverageExe analyze "/output:$coverageXml" $rawCoverage
```

$selectedTargets 必须与本次 request 中的目标一致，多条 gtest 目标用冒号连接；不能为单条执行采集整个工程。原始 .coverage、导出 XML、实际命令和退出码都保存在本次 run 目录。不要因覆盖率采集再次运行业务而混入正式 ACTUAL_JSON 日志，覆盖率重放证据独立保留。

通常 collect 执行被测程序后结束；需要独立会话收集时，按帮助指定本次唯一 /session，并使用 shutdown /session:<同一名称> 正常结束。不得关闭其他用户或任务的采集会话。异常等待应按项目超时处理，保留诊断，不能无限挂起。

### 成功证据与当前边界

退出码 0 或“结果已生成”不足以证明成功。用 analyze 检查存在本次业务模块、函数和计数；10 字节 .coverage、空 results 或只含被跳过项的 XML 都不能算有效采集。排查时可用 /include_skipped_modules 与 /include_skipped_functions 保留跳过原因。不要把“权限不足，无法从其他 Windows 会话收集”的提示单独认定为当前测试失败；同一用户进程能否采集要看真实输出。

旧版 analyze XML 的 blocks_covered/blocks_not_covered 和 lines_covered/lines_partially_covered/lines_not_covered 分别属于块、行口径；没有独立分支或语句字段时，不得推导或改名。保留部分覆盖行状态，不无说明地重算百分比。

当前 runner 不直接解析旧版 VS XML。可以通过已有 coverage.command 调用经验证的项目收集/转换脚本，但只有转换器确实输出受支持的格式时才配置相应 format。不能将旧 XML 改后缀或标成 Cobertura，不把块覆盖率填入行/分支字段。尚无转换器时明确记录“原始覆盖率已收集，面板及 Word 自动统计尚未接入”，保留本次原件和 analysis.md 证据，不手填 result.json；不能因此切换掉客户已正常工作的工具。

## 新版工具与 runner coverage 扩展点

`gtest` preset 默认不采覆盖率。将已核实的收集命令写入 `runner.json.coverage`；运行器会在本次测试后调用它并读取报告，失败只记覆盖率缺失原因，不改变真实测试结论。

新版工具支持原生 C++ 收集并输出 Cobertura 时，可用以下配置结构。路径均替换为本机验证过的实际值，不把示例路径当成客户路径。`coverage.config` 要限定被测业务模块和源码，排除 gtest、测试实现、第三方库；为原生 C++ 配置本版本支持的静态/动态插桩方式。先核实 `collect --help` 支持 `--output-format cobertura` 与 `--settings`，再采用：

```json
{
  "preset": "gtest-batch",
  "testFile": "project:tests/generated_test.cpp",
  "binary": "project:build/tests.exe",
  "coverage": {
    "command": ["C:/actual/VS/Microsoft.CodeCoverage.Console.exe", "collect", "--settings", "{root}/coverage.config", "--output-format", "cobertura", "--output", "{coverageFile}", "{binary}", "--gtest_filter={targets}"],
    "format": "cobertura",
    "file": "coverage/coverage.xml",
    "hint": "检查 VS 原生插桩配置、PDB、工具架构、被测模块过滤及工具帮助"
  }
}
```

`gtest-batch` 已经内置了 `targetsSeparator=:`，所以正式执行和覆盖率重放都只包含本次目标，单条也只重放该条。
不要用 `per-case` 配置去接未展开的 `{targets}`，也不要为单条结果采集整套项目覆盖率。
额外重放可能有文件/数据库等副作用，先隔离测试数据，并在总结中说明覆盖率来自额外采集运行。

旧版 CodeCoverage.exe 的使用和解析边界见上节；不要将旧 XML 当作以上示例的 Cobertura。

非 Windows 或项目已使用其他 C++ 工具链时，复用本地适用的 gcov/gcovr/lcov 等方案，先核对构建时的覆盖率配置与实际输出格式，再接入 runner。不要把已经正常工作的项目强制切换为 VS 或默认联网安装采集器。

## 语句、分支、MC/DC 分开说明

- 行覆盖率、块覆盖率、语句覆盖率是不同口径，不能将行或块数据改名为语句覆盖率。
- 分支必须来自报告明确的分支 covered/total；报告没给就写“未提供”，不能根据测试条数或行覆盖率计算。
- MC/DC 需要工具明确提供条件独立影响判定结果的覆盖证据。工具是 VS 自带，不代表该版本支持 MC/DC；不能由分支覆盖率推导 MC/DC。查本机帮助、客户报告样本及工具文档，有实证才登记百分比，否则写“当前工具/报告未提供 MC/DC”。
- 当前 runner 的 Cobertura 解析记录 `line`、`branch`，当前报告模板尚未适配语句/MC/DC；原始指标和单位保留在工具报告及 analysis.md，不能手改 result.json 填进去。
- 客户 VS 界面若确实提供块、语句、分支数据，应导出并保留对应原始报告，逐项记录其真实口径，不要求客户更换已能工作的工具。当前自动解析未支持的指标须明确为“保留原始证据，尚未接入面板”，不能说已自动采集；缺少 MC/DC 则单独注明。
- 采不到时在 analysis.md 记录是工具缺失、插桩/PDB/权限错误、过滤不到业务模块、没执行目标，还是格式无法解析；区分“未采集”和“0%”。覆盖率报告范围必须与本次函数、用例及被测源码一致。


## v2 报告覆盖率指标映射

runner 的 coverage 字段现在支持以下五种指标，各按真实工具报告取值：

| 指标 | 标签 | 数据来源 | 说明 |
|------|------|----------|------|
| 行覆盖率 | -L | lines_covered / lines_total | 旧版 VS XML 的 lines_covered/lines_partially_covered/lines_not_covered |
| 块覆盖率 | -BK | blocks_covered / blocks_total | 旧版 VS CodeCoverage.exe analyze XML |
| 语句覆盖率 | -S | statements_covered / statements_total | 需工具明确提供 statement 字段 |
| 分支覆盖率 | -B | branches_covered / branches_total | 需工具明确提供 branch 字段 |
| MC/DC | -MCDC | 条件独立影响判定的覆盖证据 | 需工具明确提供 MC/DC 字段 |

**旧版 VS XML 规则：**
- blocks_covered / blocks_not_covered → 块覆盖率，标签 -BK
- lines_covered / lines_partially_covered / lines_not_covered → 行覆盖率，标签 -L
- 旧版 XML 没有独立的语句或分支字段 → 对应字段写"未提供"，不得推导或改名

**MC/DC 规则：**
- 当前版本 VS 默认不提供 MC/DC
- 客户 VS 界面若确实提供 MC/DC 数据，保留原始报告
- 无实证时写"当前工具/报告未提供 MC/DC"

**result.json.coverage 写入规则：**
```json
{
  "available": true,
  "line": {"total": 100, "covered": 85, "percent": 85.0},
  "block": {"total": 50, "covered": 40, "percent": 80.0},
  "statement": {"total": null, "covered": null, "percent": null, "reason": "未提供"},
  "branch": {"total": null, "covered": null, "percent": null, "reason": "未提供"},
  "mcdc": {"total": null, "covered": null, "percent": null, "reason": "当前工具未提供 MC/DC"}
}
```
不可用时 available=false，并填写 reason。

## 旧版 VS CodeCoverage.exe 接入（已验证可用）

**适用条件：** 本机装了 **Enterprise 版** VS（2019/2022），带 `Team Tools/Dynamic Code Coverage Tools`。
Professional 版没有这个采集器（旧版覆盖率是 Enterprise 功能），只能换工具或换版本。

### 1. 先确认采集器真实存在

```powershell
$tool = '<VS>\Team Tools\Dynamic Code Coverage Tools\amd64\CodeCoverage.exe'
if (-not (Test-Path -LiteralPath $tool)) { Write-Host '未安装 Dynamic Code Coverage Tools' }
```

面板按下面的阶梯找它（工具名 `codecoverage`），**不写死路径**：

| 顺序 | 去哪找 |
| --- | --- |
| 1 | `DSH_CODECOVERAGE_PATH` 显式指定 |
| 2 | `DSH_TOOL_SEARCH_DIRS` 自定义搜索目录 |
| 3 | 所有 VS 实例：`%ProgramData%\Microsoft\VisualStudio\Packages\_Instances\*\state.json` 的 `installationPath` → `<VS>\Team Tools\Dynamic Code Coverage Tools\amd64` |
| 4 | `%VSINSTALLDIR%` / `%VCINSTALLDIR%` 指向的安装根 |
| 5 | `%ProgramFiles%`、`%ProgramFiles(x86)%` 下的 `Microsoft Visual Studio\*\*\Team Tools\...`（VS2017/2019/2022 通用） |
| 6 | **兜底**：遍历固定盘做限深扫描，找名为 `Dynamic Code Coverage Tools` 的目录（绿色包 / 自定义安装根） |

优先用 `amd64\CodeCoverage.exe`（64 位采集器）；拿 32 位采集器去采 64 位进程会失败。

客户环境常见情况：**只装了一个 VS2017**，默认路径 `C:\Program Files (x86)\Microsoft Visual Studio\2017\<Edition>\Team Tools\Dynamic Code Coverage Tools\`，第 5 层就能命中。

VS **Professional 2022 不带**这个采集器（旧版覆盖率是 Enterprise 功能），本机实测确实没有；遇到这种情况如实报告，不要假装采集成功。

### 2. 生成项目级配置 —— 必须以工具自带配置为基础

```powershell
$py '<插件>/skills/cpp-test/make_vs_coverage_config.py' `
    --project <项目根> `
    --binary-name test_generated.exe `
    --source-regex '.*[\\/]<项目目录名>[\\/]src[\\/].*\.(cpp|hpp)$' `
    --tool-config '<VS>\Team Tools\Dynamic Code Coverage Tools\CodeCoverage.config'
```

**三个硬规则（踩过的坑）：**

1. **不能用几行手写配置**。必须保留
   `<AllowLowIntegrityProcesses>true</AllowLowIntegrityProcesses>`。
   实测：同一个程序、同一个收集器，漏了这一项 → `.coverage` 只有 **10 字节**、
   XML 是 `<results />`；补上 → 正常采集；把它改成 `false` → 又变空。
   这说明它是硬依赖，不是可选优化。
2. **源码正则不能只写 `.*\src\.*`**。gtest 自己的
   `build/_deps/googletest-src/googletest/src/gtest.cc` 也含 `\src\`，
   会把整个 gtest 算进覆盖率（实测总行数从 24 直接膨到 4285）。
   把项目目录名写进正则：`.*[\\/]项目名[\\/]src[\\/].*`。
3. **不要先用 vsinstr 插桩**。旧版动态采集直接跑原始可执行文件即可；
   被其他分析工具插桩过的程序可能被跳过。

### 3. runner.json 选带覆盖率的 preset

```json
{
  "preset": "gtest-batch-cov",
  "testFile": "project:tests/test_generated.cpp",
  "binary": "project:build/Debug/test_generated.exe",
  "preCommand": ["cmake", "--build", "{project}/build", "--config", "Debug"]
}
```

`gtest-batch-cov` 会做两步：

```text
CodeCoverage.exe collect /config:<配置> /output:run.coverage tests.exe --gtest_filter=<目标>
CodeCoverage.exe analyze /output:coverage.xml run.coverage
```

报告格式是 `vs-codecoverage-xml`（runner 已支持）。
配置优先用项目里的 `<项目根>/testReport/coverage.config`，没有才用工具自带配置。

### 4. 前置条件与产物口径

- 测试可执行文件必须是 **同次构建** 且带匹配 **PDB**（Debug、不要 `/DEBUG:NONE`）。
- 旧版 XML **只有块和行两种口径**，没有独立的语句 / 分支 / MC-DC 字段。
  报告里这三项写「未提供」，不得推导或改名。
- 采集会额外跑一次测试可执行文件；有副作用时先隔离测试数据，并在总结中说明覆盖率来自额外采集。

### 5. 已验证的实测数据（cpp-gtest-demo）

| 执行范围 | 块覆盖率 | 行覆盖率 |
| --- | --- | --- |
| 2 条用例（AddLine_Normal + Subtotal_EmptyOrder） | 46.4%（13/28） | 50.0%（12/24） |
| 全量 OrderTest.* | 20.0%（2369/11845） | 29.2%（1251/4285）—— 那时正则未加项目目录名，把 gtest 算进去了 |

第二个数字正是上面第 2 条坑的现场证据，不要当成业务覆盖率。

## 圈复杂度（报告表 2）

报告表 2 需要每个函数的圈复杂度。它**不需要编译、不需要 VS**，是纯静态分析。

### 工具来源：本机优先，没有就用包里带的

`report-tool/complexity.py` 按这个顺序找 lizard：

| 顺序 | 来源 | 说明 |
| --- | --- | --- |
| 1 | 本机已安装的 lizard | `pip install lizard` 过的环境，直接 `import lizard` |
| 2 | **testReport 自带的副本** | `testReport/vendor/lizard/`（约 730 KB），本机没装时自动降级使用 |
| 3 | 都没有 | 返回空列表，报告写“未开展静态分析”，**不编数字** |

所以客户机器不需要装 Python 包，也不需要联网。

### 直接跑（也会被 bridge 自动调用）

```powershell
python report-tool/complexity.py <项目根或源码目录>
python report-tool/complexity.py <项目根> --json   # 给程序用
```

它自己会认 `src` / `source` / `lib` / `app` / `include`；直接传源码目录也行。
开头的 `lizard 来源: system|vendored` 告诉你用的是哪一份。

### 口径

- 圈复杂度 = 判定节点数 + 1，`if` / `for` / `while` / `case` / `&&` / `||` / `? :` 都算；
- 结果按复杂度降序，报告表 2 直接按这个顺序填；
- lizard 只做静态估算，**不等于**任何工具的认证结论；报告里不加“已通过静态分析”之类的话。

### vendored 副本的边界

包里那份去掉了两个可选依赖：

| 去掉的 | 影响 |
| --- | --- |
| `pathspec` | 只影响 gitignore 过滤，不影响统计 |
| `pygments` | 只影响 Erlang / F# / OCaml 解析；C/C++/Java/C#/Python/JS 不受影响 |

如果哪天真要分析 Erlang/F#/OCaml，`pip install pygments` 即可，vendor 副本会自动用上。

### 实测（cpp-gtest-demo）

```
CC   函数                     行数  文件
 2   Order::addLine            6   order.cpp
 2   Order::setCoupon          6   order.cpp
 2   Order::shipping           3   order.cpp
 2   Order::subtotal            7   order.cpp
 1   Order::payable            3   order.cpp
 1   round2                    1   order.cpp
```

6 个函数，平均 1.67，最高 2。

## 收尾核对

确认本次 request 的目标筛选、实际收集命令、输出文件新鲜度、非空业务模块、原始指标单位，以及 result.json.coverage.available/reason。已有旧报告不能冒充本次输出。执行有失败时仍检查收集器是否写出报告；不因非零退出码直接丢弃真实覆盖率。

- 覆盖率报告范围必须与本次函数、用例及被测源码一致
- 确认旧 XML 不被改后缀充当 Cobertura
- 确认块覆盖率不填入行/分支字段

命令语义参考（客户本机帮助优先）：

- [Microsoft.CodeCoverage.Console 原生 C++ 收集与插桩](https://learn.microsoft.com/en-us/visualstudio/test/microsoft-code-coverage-console-tool?view=vs-2022)
- [dotnet-coverage 参数参考（该工具本身仅支持 .NET，不替代 C++ 采集器）](https://learn.microsoft.com/en-us/dotnet/core/additional-tools/dotnet-coverage)
- [空报告、PDB 与已有插桩排查](https://learn.microsoft.com/en-us/troubleshoot/developer/visualstudio/ide/troubleshooting-code-coverage?view=vs-2019)
- [VS 覆盖率配置与 PDB](https://learn.microsoft.com/en-us/visualstudio/test/customizing-code-coverage-analysis?view=vs-2022)
