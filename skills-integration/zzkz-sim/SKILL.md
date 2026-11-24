---
name: integration-zzkz-sim
description: 总线/后端进程集成测试的专项 Skill（Step 1 判形态、Step 5 执行前后各读一次）。给出这类系统怎么测的通用方法（七阶段、红线、路径约定、RESULT/KV 协议、排障定式、产物清单），并以 ZZKZ 仿真系统（MM/SS/TDM/SAR 四服务 + DDS）为完整实例，提供功能项划分、注入面、观测面、场景矩阵与坑清单。不是给单个工程写集成测试的通用指南。
---

# 总线 / 后端进程集成测试（含 ZZKZ 实例）

被测系统是**多个后台进程通过总线（DDS 等消息中间件）互联**、没有（或不需要）人工操作界面时，走这套方法。

**REQUIRED BACKGROUND:** 必须已加载主 Skill `ai-integration-test-workflow`。本文件**不另起流程**——
六步流程、版本模型、用例与步骤的数据契约、报告生成全部由主 Skill 决定。
本文件只补充「被测对象是总线形态时，**执行步骤**该怎么做、工装怎么写、证据从哪来」。

> **提炼来源**：飞控 DSU + 雷达仿真项目（15 用例 35 步，`run-20261123-1751`）
> 与 ZZKZ 仿真系统（四服务 MM/SS/TDM/SAR，见 §7 起）的源码逐行核实。
> 里面每一条坑都是源码看不见、只在运行时咬人的。

## 本文件的结构（先看这张表，别顺序读）

| 部分 | 内容 | 换项目能用吗 |
|---|---|---|
| **§1-§6 通用方法** | 加载判定、红线、路径约定、七阶段、排障定式、产物清单 | ✅ **换任何总线项目都照用** |
| **§7 起 ZZKZ 实例** | 四服务、topic 字典、注入/观测面、场景矩阵、坑清单 | ❌ ZZKZ 专属，换项目要换 |

配套文件（都在本目录）：

| 文件 | 什么时候读 | 内容 |
|---|---|---|
| [**feature-catalog.md**](feature-catalog.md) | **Step 1 生成用例前必读** | **功能项逐项展开成带编号的可测点，当检查表逐条对照自己的分析** |
| [scenarios.md](scenarios.md) | Step 1 切功能项、Step 5 设计用例时 | 三层结构总纲、七大场景进入总表、科目矩阵 |
| [injection.md](injection.md) | Step 5 准备注入工装时 | DDS 配置、裸 topic / SCF 双通道、注入面目录（场景/科目/40 条件/DSU/武器链） |
| [observation.md](observation.md) | Step 5 写断言时 | 四服务发布消费表、速率基线、关键观测结构、退出协议 |
| [pitfalls.md](pitfalls.md) | 每次执行前过一遍 | 坑清单、已知缺陷基线、参考文件索引 |

> **★ 为什么 `feature-catalog.md` 是第一份要读的**：
> 真实原因是「**模型分析源码不够精确，有些功能点根本没被发现**」，
> 不是「模型偷懒少写用例」。历史三轮只覆盖了其中一小部分（30 用例），
> 根因就是**不知道有那么多点**。
> 那份目录把「已经确认存在的东西」列全了，模型对着它一查就知道自己漏了什么。

## 什么时候加载（主 Skill 在 Step 1 判定、Step 5 再读执行细节）

| 条件 | 判定 |
|---|---|
| 被测对象由多个进程组成，且进程之间靠主题/消息通信 | ✅ 加载本文件 |
| 断言依据是「总线上出现了什么帧、字段是什么值」 | ✅ 加载本文件 |
| 有界面但只是显示，核心逻辑在总线上 | ✅ 加载（**界面交互本身不在范围内**，见下） |
| 纯 HTTP 接口、单进程、或直接调函数就能验 | ❌ 用 `run_tests.py`，不加载 |
| 需要点按钮/读控件树取证 | ❌ **不测**，见下方「边界」 |

**★ 要读两次**：

- **Step 1**（切功能项、推导 `expectedResult`）：读本文件 §7 的**功能项划分**与 [scenarios.md](scenarios.md) 的三层结构。
  **不读就生成的用例，`expectedResult` 是猜的**。
- **Step 5**（真正跑步骤）：读 [injection.md](injection.md) / [observation.md](observation.md) / [pitfalls.md](pitfalls.md)。

## 红线（破一条，结果不可信）

主 Skill 的红线全部适用。以下是总线形态额外必须守的：

1. 【必要】**不改产品源码**。工装源码、编译产物、配置副本、运行数据全部放会话目录内。
   被质疑「你是不是改了我源码」时，靠这条 + 文件时间戳自证。
2. 【必要】**观察回写必须是真实读到的现象**。绝不把预期值抄成观察值；找不到证据写「未确认」；
   编译错误、依赖缺失、端点建立失败一律计为**失败**，不算通过。
3. 【必要】**归因分三层写清**：产品侧现象 / 工装侧能力缺口 / 未确认。
   失败步的 `observed` 用业务语言，**不出现测试代码、函数名、变量名**。
4. 【必要】**通道如实披露**：每条步骤记录其执行通道（`code` / `service` / `runner` / `cmd`，见下）。

## 四个 `channel`（与主 Skill 数据契约一致）

| `channel` | 用途 | 典型产物 |
|---|---|---|
| `code` | 把**产品源码直接编进测试**做白盒验证（编解码、分片重组、算法） | `it_codec_*.cpp` |
| `service` | **启停被测服务进程**、断言存活与端点 | `it_service.py` |
| `runner` | 调工装 exe 里的测试函数（主力通道） | `RESULT\|<func>\|PASS\|...` |
| `cmd` | 构建门 / 环境检查这类命令步骤 | `build_all.bat` |

> **没有 `uia`，也没有界面操作通道**。界面交互不在本方法范围内 —— 见下方「边界」。

## 边界：这套方法测什么、测不了什么

**能测**：总线驱动的一切后端行为 —— 周期流、字段解码、因果时间窗（注入 → N ms 内下游出现某帧某值）、
参数库/模式切换、进程存活与崩溃（CRASH 通道）、报文↔字段一致性。

**测不了 / 需单独打通**：

- **纯界面交互**（点按钮的视觉效果、布局、菜单翻页、控件树断言）—— **本方法不测**。
  这类场景要么由人手工验，要么由产品侧补一个总线可观测的字段来替代。
- 纯交互驱动的半侧（操纵杆物理量、语言/单位/布局设置）—— 只有当它最终变成总线报文时才测得到。
- 中间件「版本化数据」直发通道需单独证明可用（历史项目曾以 FAIL 记录该缺口）。

**遇到测不了的部分：在用例里如实记 FAIL 或 `blocked` 并写明原因**，不要绕过去，
也不要编造总线证据。**绝不要为了「测到界面」去读代码推断界面长什么样**——那是假证据。

## 路径约定（全文只用占位符，禁止写死绝对路径）

换电脑、换用户、换盘符都不影响可用。所有路径按下表解析：

| 占位符 | 含义 | 怎么得到 |
|---|---|---|
| `<PROJECT_ROOT>` | 被测项目根目录 | 换机器时人工指定 |
| `<SESSION_ROOT>` | 会话根 = `<PROJECT_ROOT>\.dsh\test-sessions\session-<id>\integration\` | **由面板自动创建**，会话 id 不固定，绝不写死 |
| `<RUN_ID>` | 本次一键执行 id | 面板 `createVersion` / 执行器返回 |
| `<DSH_HOME>` | DSH 数据目录（Windows 默认 `%USERPROFILE%\.dsh`） | 用环境变量解析，不写死用户名 |
| `<TOOLS_DIR>` | 报告生成器目录 | 优先 `<DSH_HOME>\tools\integrationReport\`；不存在按主 Skill Step 6 的兜底顺序找 |
| `<BUNDLED_PYTHON>` | 带 python-docx 的捆绑运行时 | 运行时探测，不写死盘符 |
| `<ICD_DIR>` / `<EXE_DIR>` | 产品 ICD 头目录 / 服务 exe 目录 | 阶段 1 环境盘点时登记 |

所有工装脚本（bat/py/ps1）内部路径必须以 `<SESSION_ROOT>`、`<PROJECT_ROOT>` 为参数或环境变量传入，
**脚本文件本身不落绝对路径**。

## 七个阶段（在总线形态下的落地方式）

主 Skill 的六步流程不变；下面把「Step 5 执行」展开成总线形态必需的七件事。
**阶段 1-3 属于 Step 1 与 Step 5 的前期准备，阶段 4-7 就是 Step 5 到 Step 6。**

### 阶段 1：环境盘点与启动【必要】

- 先弄清中间件的**参与者身份规则**。实测教训：同一 `DEVICE_ID` + `PROCESS_ID`
  会被判为同一个 participant，**自发自收被直接丢弃**——这是源码里看不见的第一号坑。
- 列一张身份表：每个产品进程、每个工装进程各占哪个 DEVICE/PROCESS。
  **工装一律分配独立 ID 段**。工装用**配置文件副本**（放在自己目录里），不改产品原位配置。
- 服务启动配方脚本化（启动顺序、工作目录、环境变量、DLL PATH），
  **记录每个进程 PID 与启动时间**——后续「是不是没启动」的质疑靠这张表 + 总线证据回应。

### 阶段 2：源码推导预期表【必要】【重点】

对每条被测链路做一次「三段式」推导，写成预期表（它就是用例 `expectedResult` 的依据来源）：

```
输入：哪个主题、哪个字段、什么值、什么节奏（周期/电平/事件）
逻辑：源码哪个文件哪个分支消费它、状态机走到哪一步
输出：产出哪个主题、哪个字段、在多长时限内出现
```

预期表每一行必须能回答「依据（源码位置）」。同时**显式列出不写在源码里的前提**：
订阅注册配置、ICD 两侧字节布局是否一致、字节序、端点身份、被测进程当时的状态机位置。

> **集成测试失败几乎总是死在这些前提上**，把它们列出来才能事后逐条排除。

没有需求文档时，预期全部来自源码推导，这一点要写进用例的版本说明里。

### 阶段 3：用例/步骤生成与冻结【必要】

这部分**服从主 Skill 的数据契约**，本文件不另立格式。要点：

- 结构：功能项（带 `stage`）→ 用例（`precondition` 写「程序已启动」这类前提）→ 步骤。
- 用例编号带版本前缀（如 `V0_0_1-IT-007`）；生成后冻结 `cases.snapshot.json`，**执行只认冻结版**。
- 步骤的 `channel` 四选一：`code` / `service` / `runner` / `cmd`（见上文表格）。
- **`target` 怎么写（exe+func 的对齐规则，别写错）**：

  | 历史材料里怎么说 | 落到主 Skill 契约里 |
  |---|---|
  | 步骤绑定「可执行函数（`exe` + `func`）」 | `steps.json` 的 **`target`** 只写**函数字符串**，如 `test_v0_0_1_it003_step3` |
  | exe 路径 | 写进 **`runner.json`**（集成根下），不写进 `steps.json` |
  | 单步过滤用的 `argv[1]` | 由编排器按 `target` 自动拼，**不要作为字段存** |

  ```json
  // steps.json —— 只出现 target，不出现 exe / func / codeFile
  { "no": 3, "action": "...", "operation": "...", "expected": "...",
    "target": "test_v0_0_1_it003_step3", "channel": "runner" }

  // runner.json —— exe 路径在这里
  { "preset": "custom",
    "command": ["<SESSION_ROOT>\\tests\\bin\\it_probe.exe", "{target}"] }
  ```

  > **★ 绝对不要把 `exe` / `func` / `codeFile` 写进 `steps.json`** ——
  > 主 Skill 的校验器把 `func` / `codeFile` / `codeRef` / `code` / `testFunc` 列为
  > **铁律禁止字段**（界面/报告只出现步骤，不许暴露测试函数名），
  > 写了直接 FAIL：「★ 铁律违反：暴露了测试函数名/代码字段」。`target` 是唯一允许的函数标识。

- **落盘后必须跑主 Skill 的契约校验器**，PASS 才能继续：

```
python <插件包>/assets/report/check_contract.py --root <SESSION_ROOT>
```

### 阶段 4：测试工装三件套【必要】【重点】

三个独立小程序，**都用产品的 ICD 头文件编译**（保证结构定义一致），**只链中间件库，绝不编译产品源码**：

1. **观察者（observer/probe）**：纯订阅。统计各主题帧率、解码字段值、对无法解析的主题做偏移扫描定位字段。
   回答两类问题：「我的发布在总线子上可见吗」「服务发了什么」。**必须用独立 participant 身份**。
2. **仿真节点（sim node）**：重放上游输入。
   周期帧（按 ICD 填小端结构 → 整消息字节序转换 → 发送）、电平位（某状态字常置位）、事件帧（一次性控制字）。
   用命令行参数做模式开关（场景/应答位/开关），供不同用例复用。
3. **注入器（injector）**：单发/少发控制帧（参数库加载帧、模式切换帧、使能显示状态帧）。

**工装编译必须走构建门**：一个 bat，先杀掉在跑的工装进程（否则 `LNK1104` 锁文件）再编译，
成功打印哨兵字（如 `BUILD_OK`）。**一键执行的第一步就是这个门，编译失败 = 整个 run 失败。**

**工装 → 编排器的协议约定**：

```
RESULT|<函数名>|PASS|CRASH|FAIL|<ms>|<消息>
KV|<用例id>|<键>|<值>          ← 观察到的原始数值，回写报告的唯一数字来源
ACTUAL_JSON[<用例id>]={...}     ← 汇总
SUMMARY|total=<n>|passed=<n>|failed=<n>|blocked=<n>
```

> 解析时取每行**最后一次**出现的关键字 —— 中间件日志会粘连在同一行。

### 阶段 5：一键执行【必要】

编排器（一个 Python 脚本）按面板 `runs/<runId>/request.json` 契约执行：

- 逐条用例按**冻结步骤表**跑；单步超时（按项目定，历史用 180s / 整体 2400s）；
  **无 `RESULT` 行 = FAIL**（挂死不是跳过）。
- `junit.xml` 的 `<testcase name>` 必须**等于登记在面板的函数字符串**；
  `<skipped>` → `skipped`；进程退出码非 0 → 整个 run 标 `failed`。
- 每步产出 `evidence.json` 记录（`stepId` / `result` / `durationMs` / `channel` / `kv` / `observed` 原始串）
  —— 这是**回写观察值的唯一事实源**。
- 依赖前序步 `blocked` 的后续步**在同一用例内级联记 `blocked`**，不许「顺手补测」。
- 崩溃必须 SEH / 子进程隔离捕获记 `CRASH`，不拖垮整批。

> **`result.json` 必须按主 Skill 的契约写 `steps[]`**（不是 runner 原生的 `tests[]`）。
> 这一点主 Skill 已写明并有校验器把关，这里是提醒：编排器要负责转换。

### 阶段 6：证据回写与结果登记【必要】【重点】

- **`observations.json`**：把 evidence 的 KV 原始值翻译成业务语言的观察句
  （「5 秒窗口总线观测到 123 帧全景态势数据」）。
  **每个数字都必须能在 KV 里找到出处**；句子里不出现函数名/变量名。
- **失败分类落到 `reason` 字段**：
  产品现象 / 工装缺口 / 归因未确认。
- **`exec-records.json`**：每用例**恰一条** `{runId, at, result, durationMs, source:"all"}`。
  用例结果聚合：全过 = `pass`；含 FAIL = `fail`；仅 BLOCKED = `blocked`。

> 落盘后跑契约校验器，PASS 才能进 Step 6：
> ```
> python <插件包>/assets/report/check_contract.py --root <SESSION_ROOT> --run <RUN_ID>
> ```

### 阶段 7：报告生成【必要】

这部分**完全走主 Skill 的 Step 6**，本文件不重复。要点：

1. 面板 `createVersion`（带 `runId` + `sourceStepVersion`）登记报告版本名，**不手改** `report-versions/index.json`。
2. 调官方生成器产出单条报告 + 总报告。
3. **报告全文扫一遍，确认无测试代码与函数名泄漏**。

## 排障定式（失败后照这个顺序查，别跳步）

1. 进程活着吗（PID + 启动时间）。
2. 工装自发布可见吗（独立观察者数到自己发的帧 → 发布链路 OK）。
3. 服务→工装通吗（能收到服务周期流 → 总线、DOMAIN、字节序 OK）。
4. 若**只有**「工装→服务」不通，依次查：
   服务订阅注册与配置副本差异 → 帧的字节布局/字节序/序列化路径 → 端点身份匹配 →
   服务当时的状态机门（**前置状态未满足，逻辑正确也不产出**）。
5. 结论写成「未确认」直到拿到能钉死归因的证据；**不臆断**。

## 必备产物 checklist（缺一即流程不完整）

| 文件 | 位置 | 作用 |
|---|---|---|
| `request.json` | `runs/<runId>/` | 一键执行契约（scope/targets/runner 命令） |
| `result.json` + `junit.xml` | `runs/<runId>/` | 步骤级结果（面板/生成器读）；**必须 `steps[]`** |
| `evidence.json` | `runs/<runId>/` | 每步 KV 原始证据（回写唯一事实源） |
| `observations.json` | `runs/<runId>/` | 业务语言观察（bridge 读） |
| `exec-records.json` | `step-versions/<v>/` | 每用例一条执行记录，`source=all` |
| `cases.snapshot.json` | `step-versions/<v>/` | 冻结快照，必须是 `{caseVersionId, features[], cases[]}` 容器 |
| `report-data.json` + docx | `reports/<runId>/` | 单用例表 + 总报告 |

## 换新项目时的替换点

| 要素 | 换项目要改的 | 不变的 |
|---|---|---|
| 中间件身份表 | properties 文件路径与 ID 分配 | 独立 ID 段 + 配置副本原则 |
| ICD | 头文件目录、字节序转换函数名 | 「填小端 → 整消息转换 → 发送」序列 |
| 服务清单 | exe 路径、启动顺序、工作目录 | 启动配方脚本化 + PID 留痕 |
| 用例/功能项 | 全部重写（源码三段式推导） | 冻结与版本纪律 |
| 报告元数据 | 软件名/版本/人员/日期 | 生成器契约与版本登记流程 |

---

# 以下为 ZZKZ 实例（换项目时整段替换）

## ZZKZ 是什么

被测项目是**四个独立 git 服务**（每个是 SCF 服务组件框架的分区进程，CMake+VS 工程）。
目标是**不需要启动 POP GUI**，把 POP 的全部测试能力翻译成「注入 + 断言」。

> **路径一律用占位符，不写死盘符/用户名**（本项目会在不同电脑上跑）：
>
> | 占位符 | 含义 | 怎么得到 |
> |---|---|---|
> | `<PROJECT_ROOT>` | 被测仿真项目根目录（四个服务所在目录） | **开工前问用户，或从当前工作区推断** |
> | `<POP_ROOT>` | POP 测试平台根目录（被测系统的 GUI 参照，只作源码查阅，不运行） | 用户提供；没有就不查它 |
> | `<SESSION_ROOT>` | 会话集成根 = `<PROJECT_ROOT>\.dsh\test-sessions\session-<id>\integration\` | 面板自动创建 |
>
> 下文的目录名（`zzkzsc_mm_win\ZZKZSC_MM` 等）都是**相对 `<PROJECT_ROOT>` 的路径**。

| 目录 | 服务 | 角色 | 主周期 | Clock ID |
|---|---|---|---|---|
| `zzkzsc_mm_win\ZZKZSC_MM` | MM | 任务管理（场景/科目入口、意图理解指令 IU_CMD、可解释显示 EXP_DIS_INFO） | 25ms | 19754 |
| `zzkzsc_ss_win\ZZKZSC_SS` | SS | 态势快照（VMC 快照、任务周期/事件快照、全景态势；消费传感器 SO_* 与 DSU） | 25ms | 19752 |
| `zzkzdc_tdm_win\ZZKZDC_TDM` | TDM | 战术决策（机动决策 BT_MANEUVER、SO 控制指令 TDM_SO_*、行为树） | 50ms | 19755 |
| `zzkz_sar_win\ZZKZSC_SAR` | SAR | 安全仲裁（前/后标定约束、SO 控制指令 SAR_SO_*、武器事件 SMM_ZII、DSU_ZII 智能杆指令） | 25ms | 19753 |

**四服务的启动、DDS 配置、注入面** → [injection.md](injection.md)
**四服务的发布/消费面、速率基线、观测结构** → [observation.md](observation.md)
**场景进入链、科目矩阵、三层结构** → [scenarios.md](scenarios.md)
**坑清单、已知缺陷基线、源码索引** → [pitfalls.md](pitfalls.md)

## ZZKZ 的功能项划分（Step 1 直接取用，共 6 组）

历史存量：12 功能项 / 30 用例 / 71 步（`session-732e654f`，权威 run-002 = 68/71）。
**但 12 个功能项切太细了** —— 多数只有 1-2 条用例，报告里一堆碎章节。
**新一轮按下面 6 组切**（同类已合并），从存量合并出发，不要从零发明。

| 编号 | 功能项 | 合并了原来的 | 主要 `channel` |
|---|---|---|---|
| **F1** | 基础设施与总线 | 原「服务生命周期」+「数据加载握手」+「退化恢复」 | `service` / `runner` |
| **F2** | 场景进入与退出 | 原「场景进入退出」全部（进入链 / 退出链 / 弹窗 / 异常） | `runner` |
| **F3** | 测试科目执行 | 原「机动科目」+「传感器科目与区域」 | `runner` |
| **F4** | 前置条件与故障注入 | 原「前置条件矩阵」全 40 种条件 | `runner` |
| **F5** | 飞控与武器闭环 | 原「DSU 闭环」+「攻击列表与武器链」 | `code` / `runner` |
| **F6** | 显示与告警 | 原「可解释显示」 | `runner` |

**合并依据（照判据走，不是拍脑袋）**：

| 为什么这么合 | 判据 |
|---|---|
| F1 吞掉「服务启动 + 加载 + 退化」 | 三者都是**基础设施**，验证手段都是「启停/注入 → 看状态位」，且退化是启动的逆过程 |
| F4 吞掉全部 40 种条件 | 40 种只是**参数不同**，验证手段完全相同（注报文 → 看置灰矩阵） |
| F5 吞掉 DSU 与武器链 | 两者都是**闭环链路**（注入 → 下游回包），判据同族（看报文出现） |
| F3 机动与传感器科目合并 | 都是「选科目 → 看 `IU_CMD` 透传 + 下游指令」，只是科目号不同 |

**每个功能项有多少可测点，不用照抄本文件** —— [feature-catalog.md](feature-catalog.md) 里每个可测点都有稳定编号
（`F1-1`、`F2-3`…），**你读到时自己数**，把 N/M 写进 Step 1 汇报。

> **每个功能项都必须有自己的用例**（`source` 不是 `manual` 时），不许留空。
> `code` 步集中在 F5（白盒编解码），`service` 步集中在 F1（启停与加载）。

**用例树建议**：F1（基础设施）→ F2 每场景进入链（场景 1-4，含旁路/审批两路各一条）
→ F3（科目）→ F4（前置条件）→ F5（闭环与武器链）→ F6（显示）。

## ZZKZ 现有历史资产（复用前先改路径）

历史资产在旧会话里：`<PROJECT_ROOT>\.dsh\test-sessions\{session-3c776ebb…, session-732e654f…, session-94f20c0f…}\integration\`。

> **⚠️ 这些脚本是上一台机器上写的，路径全写死成那台机器的旧目录。**
> 复用前必须先做三件事：
>
> 1. **全局替换路径**：把脚本里写死的绝对路径全部换成 `<PROJECT_ROOT>` 下的相对路径（或从参数/环境变量传入）。
> 2. **探测本机编译环境**：不要假设 VS 版本与安装路径，运行时用 `vswhere` 或 `where cl` 探测 vcvars。
> 3. **探测本机依赖版本**：`ACI_DDS.dll` / `scfd.dll` / ICD 头文件是否与当前代码库一致（见下「坑清单」的 ICD 漂移条）。
>
> **若历史资产不在本机**（换电脑后 `.dsh` 目录不随 git 走）→ 按下表**按功能重建**，不要硬找旧文件。
> 表里的「作用」列就是重建规格。

| 资产 | 作用 |
|---|---|
| `tests\harness.h` | ADDTEST 注册、CHECK、SEH 防崩、`RESULT\|` / `KV\|` 协议行、`argv[1]` 单步过滤 |
| `tests\it_service.py` | 受控启停四服务 + probe 观测 + netstat 断言 |
| `tests\run_all.py` | channel（code/service/runner/cmd）分派 → junit + `ACTUAL_JSON` + `SUMMARY\|` |
| `tools\run_tests_py39.py` | 面板执行链（解析 RESULT/KV/junit，退出码 0/1/2/3/130） |
| `headless_main.cpp`（94f20c0f） | 无 Qt 裸 DDS 仿真节点：DSU 25ms 运动学模型 + `--ack=on` 置应答 + `--radar=on` 发 DF |
| `it_dsu_inject.cpp` | DSU 注入 + 环回断言 + 四服务存活（run-002 全绿） |
| `it_codec_{mm,ss,sar,tdm,sar2}.cpp` | 被测源码（ICDFT EN/DE、分片重组、RingBuffer、FloatToFix）直接编入测试的白盒集成 |

**编译模板**：

```
cl /O2 /MD /EHsc /I <服务>\src\ICD /I <服务>\src\NonService\DDS xx.cpp <服务 ICD *.cpp> ^
   /link /LIBPATH:<SAR>\SCF_INSTALL\lib\windows\x86_64 ACI_DDS.lib
```

运行目录需同置 `ACI_DDS.dll` + `ACI_DDS_config.properties` + `DDS_increment_seq.txt`。