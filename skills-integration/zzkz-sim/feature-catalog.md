# ZZKZ 功能项展开目录（Step 1 必读，逐项对照）

**这份文件的用途：防止「源码分析不全导致用例漏」。**

模型自己读代码时，容易只看主流程、漏掉分支与状态组合。本文件把每个功能项
**已经确认存在的可测点**逐条列出来（来源：MM/TDM/SAR/SS/POP 五侧源码逐行核实 +
三个历史会话的实跑结果）。

> **怎么用（硬要求）**：生成用例前，逐个功能项打开对应小节，
> **把「可测点」当检查表逐条对照自己的分析**：
>
> - 你分析出来的 → 记账
> - 这里有但你没分析到的 → **补上**（这是本文件的主要价值）
> - 你判断本不该测的 → 写进 `coverage.json` 的 `excluded[]` 并给可复核理由
>
> **每个功能项至少要回答一次「本项 N 个可测点，本版覆盖 M 个，其余为什么」**，
> 这个 N/M 要写进 Step 1 的汇报里。
>
> **★ 每行还带了 `type` 列**：对照时**同时用它定测试类型**，
> 不要所有可测点都写成 `functional`（历史事故：整批用例全是功能测试，
> `api`/`security`/`boundary`/`margin` 一个都没有）。类型分布见下面「`type` 列怎么用」一节。

| 功能项 | 合并了原来的 | 主要依据 |
|---|---|---|
| [F1 基础设施与总线](#f1-基础设施与总线) | 服务生命周期 + 数据加载 + 退化恢复 | [observation.md](observation.md) §2、[injection.md](injection.md) §1/§5.4 |
| [F2 场景进入与退出](#f2-场景进入与退出) | 场景进入退出（全部） | [scenarios.md](scenarios.md) §0-§1 |
| [F3 测试科目执行](#f3-测试科目执行) | 机动科目 + 传感器科目 | [scenarios.md](scenarios.md) §2.1/§2.2 |
| [F4 前置条件与故障注入](#f4-前置条件与故障注入) | 40 种测试条件 | [injection.md](injection.md) §5.2 |
| [F5 飞控与武器闭环](#f5-飞控与武器闭环) | DSU 闭环 + 攻击列表与武器链 | [injection.md](injection.md) §5.3/§5.5 |
| [F6 显示与告警](#f6-显示与告警) | 可解释显示 | [observation.md](observation.md) §3 |

> **可测点数量不用照抄本文件，你自己数**：下面每个可测点都有稳定编号（`F1-1`、`F2-3`…），
> 按编号统计就是准确数量。**生成用例前先数一遍，再把 N/M 写进 Step 1 汇报。**
>
> 数量不是重点，**「每个可测点去哪了」才是**：被哪条用例覆盖，或为什么排除。

> **功能项已按「同类合并」规则从 10 个并到 6 个**（判据见
> [功能项生成规范](../references/feature-item.md)「★ 粒度：同类必须合并」）。
> 合并只改分组，**可测点一个没少**，每个原编号都能在新分组里找到。

## `type` 列怎么用（新增，2026-11-24）

每行最后一个业务列是 **`type`**（`channel` 之前那一列），取值就是
[7 类判定标准](../references/type-7-criteria.md)里的枚举。

**用途**：本目录以前只标 `channel`（怎么执行），不标 `type`（问什么），
于是即使逐项对照了这 132 个点，也**不知道每个点该归哪一类测试** ——
历史结果就是整批用例全写成 `functional`。

现在要求：**对照可测点时，直接用它给的 `type`**；你有更准确的判断可以改，
但必须能说出理由。汇报时的类型分布应当能和本目录统计对上。

**本目录的类型分布**（按 132 个可测点统计）：

| `type` | 条数 | 说明 |
|---|---|---|
| `functional` | 105 | 业务行为、状态机、时序、流程链路 |
| `api` | 14 | 结构契约：字段层级、枚举字典、编解码、跨报文字段一致、长度自校验 |
| `boundary` | 10 | 界点值：时间阈值、枚举范围、非法值、全零过滤、特殊撞号 |
| `margin` | 2 | 长时运行余量（F1-12 / F1-13：约 1h 后归零、后降速） |
| `performance` | 0 | **本目录未列**。ZZKZ 是周期总线系统，速率由 `F1-3` 以**基线对表**方式验证（属 `functional`），没有书面 SLA/吞吐指标，故不单列性能可测点 |
| `security` | 0 | **本目录未列**。被测形态是**内网封闭的仿真服务群**，源码中没有鉴权/权限/信任边界（服务间靠 UDP 组播互信），无安全属性可断。若后续接入真实装备或开放网络，需重新评估 |
| `stress` | 0 | 本轮不测（用户明确要求） |

> **最后两行为 0 的理由必须保留**：按 Step 1 的自检要求，
> 某一类为 0 时要在 `coverage.json` 写明「搜了哪里、为什么不涉及」。
> 上面两段就是那份理由，**生成用例时直接引用，不要另编**。
> 如果你的项目形态与本目录不同（例如有鉴权模块），**0 的理由不成立，必须补该类用例**。

---

## F1 基础设施与总线

> 合并：原 F1 服务生命周期 + F2 数据加载握手 + F10 退化与恢复

### 原 F1 · 服务生命周期与总线

**依据**：[observation.md](observation.md) §2、[injection.md](injection.md) §1

| # | 可测点 | 判据 | `type` | `channel` |
|---|---|---|---|---|
| F1-1 | 四服务全部拉起并存活 | 10s 内四进程存活，PID 与启动时间已记录 | functional | `service` |
| F1-2 | 每服务 UDP 端点 ≥3 | `netstat -ano` 过滤 UDP | functional | `service` |
| F1-3 | 周期主题速率达标 | 10s 窗口 `MM_STA≈62` / `SS_STA≈62` / `TDM_STA≈62` / `EXP_DIS_INFO≈197` / `SAR_PERIOD_STA≈197` | functional | `runner` |
| F1-4 | `APP_LIFE_MSG` 软件编码层级正确 | `SoftID`/`LRUID`/`DevID`/`SubSysID`/`SysID` 与配置一致 | api | `runner` |
| F1-5 | 残留进程清理 + 重启后恢复 | `taskkill` 后重启仍能达基线 | functional | `service` |

### 原 F2 · 数据加载握手

**依据**：[injection.md](injection.md) §5.4「数据库加载类」

| # | 可测点 | 判据 | `type` | `channel` |
|---|---|---|---|---|
| F1-6 | `DSU_WAYPOINT_DB` 加载成功 | `DSU_STA.LoadStatus` 0→1→2 | functional | `runner` |
| F1-7 | `DSU_AI_RULE_LOAD_DB` 加载成功 + `blockingStratege` 生效 | `blockingStratege=1` 时场景免审批直通 | functional | `runner` |
| F1-8 | `DSU_AI_MODEL/KNOWLEDGE_LOAD_DB` 加载成功 | `LoadStatus==2` | functional | `runner` |
| F1-9 | `DSU_TACAN_INFO` / `WAVE_MATCHPOINT` / `AIRPORTPOINT` 加载成功 | `LoadStatus==2` | functional | `runner` |
| F1-10 | 加载失败路径（`ZZKZSC_STA.BMscDataManLoadResEn=1` 校验失败） | 场景按钮保持置灰 | functional | `runner` |
| F1-11 | `DataLoadRate` 百分比递增可信 | 加载过程 0→100 单调不减 | functional | `runner` |

### 原 F10 · 退化与恢复（归入 F1）

**依据**：[observation.md](observation.md) §2「退化观察」

| # | 可测点 | 判据 | `type` | `channel` |
|---|---|---|---|---|
| F1-12 | 长时运行约 1h 后 `EXP_DIS_INFO` 归零 | 连续跑并采样，记录归零时刻 | margin | `service` |
| F1-13 | 长时运行后 `SAR_PERIOD` 降速 | 速率低于基线 | margin | `service` |
| F1-14 | 受控重启后恢复基线 | `taskkill` + 重启 → 速率回到基线 | functional | `service` |

---


## F2 场景进入与退出

> 合并：原 F3 全部（进入链 / 退出链 / 弹窗 / 异常）

### 原 F3 · 场景进入退出

**依据**：[scenarios.md](scenarios.md) §0「三种审批通道」+ §1「七大场景进入总表」

### F3-A 进入链（场景 × 审批通道）

| # | 可测点 | 判据 | `type` | `channel` |
|---|---|---|---|---|
| F2-1 | 场景 1 机动 · VMC 握手进入 | `DSUentryReqAckValid=1 && DSUentryReqAckEn=1` → `IU_CMD{SceSelEn=1}` | functional | `runner` |
| F2-2 | 场景 1 机动 · 旁路进入 | `blockingStratege=1` → `IU_CMD{SceSelEn=1, TestCaseSelEn=1 自动附}` | functional | `runner` |
| F2-3 | 场景 2 传感器 · SCM 握手进入 | `FIELD_ENUM_zsmZ4N3NZ9Ok=1` → `IU_CMD{SceSelEn=2}` | functional | `runner` |
| F2-4 | 场景 2 传感器 · 旁路进入 | `blockingStratege=1` 直通 | functional | `runner` |
| F2-5 | 场景 3 自主飞行 · VMC 握手进入 | `IU_CMD{SceSelEn=3}` | functional | `runner` |
| F2-6 | 场景 3 自主飞行 · 旁路进入 | `blockingStratege=1` | functional | `runner` |
| F2-7 | 场景 4 自主探测 · SCM 握手进入 | `IU_CMD{SceSelEn=4}` | functional | `runner` |
| F2-8 | 场景 4 自主探测 · 旁路进入 | `blockingStratege=1` | functional | `runner` |
| F2-9 | 场景 5 自主攻击 · 直发驱动 TDM | SCF 发 `IU_CMD{SceSelEn=5}` → TDM 发 `ZZKZDC_TDM_SC_ZII`(26329) | functional | `runner` |
| F2-10 | 场景 6/7 · 无人消费确认 | MM/TDM 均不响应，`IU_CMD` 无回执 | functional | `runner` |
| F2-11 | 进入申请位可观测（SCM 通道） | `IU_CMD.IUsensorEnter` / `IUAutoDetectEnter` 脉冲 | functional | `runner` |
| F2-12 | 入场中显示（SCM 通道） | `FIELD_ENUM==2` → `EXP.ZZKZentryStaDis=1` | functional | `runner` |
| F2-13 | 已在场景内时不重复触发申请 | 第二次 DCMII 不产生新 `IU_CMD` 入口帧 | functional | `runner` |

### F3-B 退出链（三种通道）

| # | 可测点 | 判据 | `type` | `channel` |
|---|---|---|---|---|
| F2-14 | 退出确认（通用） | `DCMII{ZzkzExitValid=1,ZzkzExitBool=1}` → 清弹窗停表 | functional | `runner` |
| F2-15 | 退出拒绝 · 机动/自主飞行 | `pilotRefuseExit=1` → 清弹窗 + **停表** | functional | `runner` |
| F2-16 | 退出拒绝 · 传感器/自主探测 | `pilotRefuseExit=1` → 清弹窗但**仍 30s 自动退** | functional | `runner` |
| F2-17 | HOTAS 退出 | `DSU{DSUhotasValid=1,DSUhotasEn=1}` 脉冲 | functional | `runner` |
| F2-18 | 场景 1/3 退出同意 | `DSUmaneuverStaEn==6 && DSUmaneuverCtrlStaValid==1` | functional | `runner` |
| F2-19 | 场景 1/3 故障旁路退出 | `StaEn∈{5,6}` | functional | `runner` |
| F2-20 | 场景 2/4 退出同意 | `IU_CMD.IUsensorExit` + `FIELD_ENUM==3` | functional | `runner` |
| F2-21 | SCM 故障时直通退出（无需同意） | 生命消息无效 → 直接退（Impl:838-841） | functional | `runner` |
| F2-22 | 退出后 POC 复位 | `SceSelValid==0` + 事件主题回落 0 | functional | `runner` |

### F3-C 弹窗字典（7 种 × 确认/拒绝）

| # | 可测点 | 判据 | `type` | `channel` |
|---|---|---|---|---|
| F2-23 | 弹窗 1 机动申请退出 · 确认 | `TipDialogInfoEn=1` → 确认后退出 | functional | `runner` |
| F2-24 | 弹窗 1 机动申请退出 · 拒绝 | 同上 → 停表不退出 | functional | `runner` |
| F2-25 | 弹窗 2 传感器未选科目 | `TipDialogInfoEn=2` | functional | `runner` |
| F2-26 | 弹窗 3/4/5 雷达/光雷/协同区域 | 按 `TestCaseSelEn` 18/19/20 → 3/4/5 | functional | `runner` |
| F2-27 | 弹窗 6 自主飞行申请退出 | `TipDialogInfoEn=6` + tip30s | functional | `runner` |
| F2-28 | 弹窗 7 自主探测申请退出 · 拒绝仍自动退 | `TipDialogInfoEn=7` → 拒绝后 30s 仍退 | functional | `runner` |
| F2-29 | 弹窗 30s 超时自动确认 | `25ms × 1200 = 30s` 后自动退出 | boundary | `runner` |
| F2-30 | 弹窗被 POC 回写时 tip 字段保留 | `m_disInfo` 覆盖时刻意保留 tip 两字段（NS:955-971） | functional | `runner` |

### F3-D 异常与边界

| # | 可测点 | 判据 | `type` | `channel` |
|---|---|---|---|---|
| F2-31 | 非法场景号被忽略 | `SceSelEn=99` → 无回执、状态不变 | boundary | `runner` |
| F2-32 | 科目终止仅在 `CurStaEn==3` 有效 | `TestCaseTerBool=1` 且 `CurStaEn!=3` → 无效果 | functional | `runner` |

## F3 测试科目执行

> 合并：原 F4 机动科目 + F5 传感器科目与区域

### 原 F4 · 机动科目

**依据**：[scenarios.md](scenarios.md) §2.1

### F4-A 16 个科目（k=2..17 参数化）

| # | 可测点 | 判据 | `type` | `channel` |
|---|---|---|---|---|
| F3-1 | 科目 2 稳定平飞 | `IU_CMD` 8 字段透传 + TDM `19631` 动作指令 + `EXP.SteadyFlyButtonDis=2` | functional | `runner` |
| F3-2 | 科目 3 平飞加速 | 同上（`AccelerFlyTest`） | functional | `runner` |
| F3-3 | 科目 4 平飞减速 | 同上（`DecelFlyTest`） | functional | `runner` |
| F3-4 | 科目 5 稳定爬升 | 同上（`SteadyClimb`） | functional | `runner` |
| F3-5 | 科目 6 稳定下降 | 同上（`SteadyDecline`） | functional | `runner` |
| F3-6 | 科目 7 稳定左转 | 同上（`LeftTurn`） | functional | `runner` |
| F3-7 | 科目 8 稳定右转 | 同上（`RightTurn`） | functional | `runner` |
| F3-8 | 科目 9 稳定左盘旋 | 同上（`LeftSpiral`） | functional | `runner` |
| F3-9 | 科目 10 稳定右盘旋 | 同上（`RightSpiral`） | functional | `runner` |
| F3-10 | 科目 11 最速爬升 | 同上（`MaxSpdClimb`） | functional | `runner` |
| F3-11 | 科目 12 S弯 | 同上（`SCurve`） | functional | `runner` |
| F3-12 | 科目 13 左上脱离 | 同上（`UpLeftDetach`） | functional | `runner` |
| F3-13 | 科目 14 右下脱离 | 同上（`LowRightDetach`） | functional | `runner` |
| F3-14 | 科目 15 定向定时过点 | 同上（`PointTransit`）+ 期望坐标 `TarLonDeg` | functional | `runner` |
| F3-15 | 科目 16 修正飞行 | 同上（`CorrectFly`） | functional | `runner` |
| F3-16 | 科目 17 组合机动1 | 同上（`CombineMan`） | functional | `runner` |

### F4-B 科目 1 姿态调整（判据不同）

| # | 可测点 | 判据 | `type` | `channel` |
|---|---|---|---|---|
| F3-17 | 科目 1 姿态调整走 `isTestItemManualExit` | `TestCaseSelEn==1`（NS:977），不走 `isManeuverTestProjectEntered` | functional | `runner` |

### F4-C 保护态（SS_VMC_INFO 注入）

| # | 可测点 | 判据 | `type` | `channel` |
|---|---|---|---|---|
| F3-18 | 高度/速度出窗 → `CurStaEn=5` 接管 | 需 `POC.TestCaseSelEn==1` 姿态调整中 | functional | `runner` |
| F3-19 | `DSUvmcLimitEn ∈ {8,9,10,11}` → `CurStaEn=7` AI 保护 | 4 个值分别验（高/低高度、低/高速度 AI） | boundary | `runner` |
| F3-20 | `DSUvmcLimitEn ∈ {1-7,12-18}` → `CurStaEn=8` 飞控保护 | 抽样验（如 3 / 15） | boundary | `runner` |
| F3-21 | `checkSceneExitCondition(MAN)` 命中 → `CurStaEn=6` + tip30s | **只有机动分支置 6**（Impl:909-914） | functional | `runner` |
| F3-22 | 科目按钮门 `CurStaEn==2` | 未到准备测试态时科目按钮不亮（Impl:252/304-310） | functional | `runner` |
| F3-23 | 导航模式互斥（`AvionicsSysMainMode=2`） | 机动要导航模式，传感器要拦截模式（NS:911/859） | functional | `runner` |

### 原 F5 · 传感器科目与区域

**依据**：[scenarios.md](scenarios.md) §2.2

### F5-A 三个科目

| # | 可测点 | 判据 | `type` | `channel` |
|---|---|---|---|---|
| F3-24 | 科目 18 雷达 | `IU_CMD` 透传 + TDM `24305/24306` + SAR `24307/24308` | functional | `runner` |
| F3-25 | 科目 19 光雷 | 同上（光雷方位可 ±180） | functional | `runner` |
| F3-26 | 科目 20 雷达+光雷（协同） | 同上（NS:1150 判据）+ 弹窗 En=5 | functional | `runner` |
| F3-27 | 科目切换（18→19→20） | 每次切换产生新 `IU_CMD` | functional | `runner` |

### F5-B 区域参数

| # | 可测点 | 判据 | `type` | `channel` |
|---|---|---|---|---|
| F3-28 | 区域六参下发 → `IU_CMD` 回显 | `startLon/startLat/endLon/endLat`(1e-7°) + `top/bottomHeight`(0.01m) | api | `runner` |
| F3-29 | 区域几何 → `SAR_SO_PERIOD` 搜索中心一致 | 按字典换算（方位 MSB π/2） | api | `runner` |
| F3-30 | 区域几何 → 波束宽一致 | 方位宽 1..4 = ±10/30/60/110° | api | `runner` |
| F3-31 | 区域几何 → 量程一致 | 量程 1..11 = 20..640 km | api | `runner` |
| F3-32 | 自主探测区域 `memcmp` 变化才发 | 首次下发 1 帧 / 同值不新增 / 改值 +1 帧（Impl:641-657） | functional | `runner` |

### F5-C 决策链与约束

| # | 可测点 | 判据 | `type` | `channel` |
|---|---|---|---|---|
| F3-33 | **选科目后** TDM 才发 `24305/24306` | 场景 2 未选科目不发（TDM:622） | functional | `runner` |
| F3-34 | `SAR_SO` 是**周期电平流**（重发缓存） | 无新指令仍持续发（SAR Impl:766-786） | functional | `runner` |
| F3-35 | 全零事件报文被过滤 | 接收侧 `memcmp` 丢弃 | boundary | `runner` |
| F3-36 | `19603` 约束由 SAR 生产、TDM 订阅 | 雷达 ±110°/±60°，光雷 +5°/-60° | api | `runner` |
| F3-37 | SAR 对 SO 输出**不做限幅** | `POC_CHECK=1` 路径纯 memcpy（PostCalibrationOperation:354-355） | functional | `runner` |
| F3-38 | `ApplyLimit` 只作用于 `DSU_ZII` 机动参数 | 8000m 分界选 IAS/Ma（ApplyLimit.cpp:6-56） | functional | `runner` |
| F3-39 | 场景按钮前置置灰矩阵 | 缺任一项（DC/SC 加载、生命、模式、VMC、PWL）→ `SensorTestSceneButtonDis=0` | functional | `runner` |
| F3-40 | 生命消息异常 → 无同意直通退出 | Impl:838-841 | functional | `runner` |
| F3-41 | 目标丢失 30s 计数 | `m_count30s_TargetLost` | boundary | `runner` |

## F4 前置条件与故障注入

> 合并：原 F6 全部 40 种条件

### 原 F6 · 前置条件矩阵

**依据**：[injection.md](injection.md) §5.2「40 种」原文

> **40 种里 8/9/10 是 POP 空操作（break），实际可测 37 种**。
> 下表按「能否独立验证」归并，每一项都要么有用例、要么在 `excluded[]` 说明。

| # | 条件组 | index | 可测点 | `type` | `channel` |
|---|---|---|---|---|---|
| F4-1 | SC 数据加载成功/失败 | 0/1 | `ZZKZSC_STA.BMscDataManLoadResEn` | functional | `runner` |
| F4-2 | DC 数据加载成功/失败 | 2/3 | `ZZKZDC_STA` | functional | `runner` |
| F4-3 | DC/SC 生命消息 4 组合 | 4-7 | `IAGSM_ICP_RT_ABI_STA_INFO` loopSignal + `FIELD_ENUM_ha2qtwj71pn4` | functional | `runner` |
| F4-4 | HOTAS 手动退出（脉冲） | 11 | `DSU{DSUhotasValid=1}` 25ms 后清零 | functional | `runner` |
| F4-5 | 航电模式 导航=2 / 拦截=3 | 12-14 | `SC_MISSION_STA.AvionicsSysMainMode` → 两场景按钮互斥 | functional | `runner` |
| F4-6 | 预置 SS 平飞态 | 15-17 | `SS_VMC_INFO` 各字段 + 追加 `SAR_ACT_CONSTRAINT` | functional | `runner` |
| F4-7 | 预置 DataValid=0 | 18 | `DataValid=0` 分支 | functional | `runner` |
| F4-8 | 雷达生命有效/无效 | 19 | `field_boolean__38` | functional | `runner` |
| F4-9 | 光雷生命有效/无效 | 20 | `field_boolean__41` | functional | `runner` |
| F4-10 | 攻击列表 有/无 | 21/22 | `TM_ATTACK_LIST_DATA.AAAttackListTarNum` | functional | `runner` |
| F4-11 | PL16 导弹可用数 2/0 | 23/24 | `SMM_WEAPON_STA.pl16_missile_available_num` | functional | `runner` |
| F4-12 | 任务目标态势 有/无 | 25/26 | `DF_AA` 单目标 `FuseID=2`/0 | functional | `runner` |
| F4-13 | 全机告警 12 类码 | 27-38 | `DMP_AW_FULL_PWL` 各告警码（34001/34002/42002/…/94001） | functional | `runner` |
| F4-14 | 全机告警清零 | 39 | `FIELD_FIX_DATA_270iu62i32vf=1` 后清零 | functional | `runner` |
| F4-15 | 8/9/10 PWL 三按钮 = 空操作 | 8-10 | **无需测**，登记 `excluded[]` 说明是 POP 空操作 | functional | — |

> **本轮若只测一部分，必须逐条在 `coverage.json` 的 `excluded[]` 写明理由**
> （如「27-38 全机告警 12 类本轮只验 3 类代表值」），**不许整组消失**。

## F5 飞控与武器闭环

> 合并：原 F7 DSU 闭环 + F8 攻击列表与武器链

### 原 F7 · DSU 闭环

**依据**：[injection.md](injection.md) §5.3

| # | 可测点 | 判据 | `type` | `channel` |
|---|---|---|---|---|
| F5-1 | 周期帧环回可见 | 独立观察者数到自己发的 `DSU_VMC_AP_DSU_DATA` | functional | `runner` |
| F5-2 | 进入应答 | 收 `ZzkzEntryCMD=1` → 回 `DSUentryReqAckValid=1, En=1` | functional | `runner` |
| F5-3 | 进入确认 | 收 `ZzkzEntryCMD==2` → 回确认 | functional | `runner` |
| F5-4 | 退出应答 | 收 `ZzkzExitCMD==1 && valid` → 回退出应答 | functional | `runner` |
| F5-5 | HOTAS 脉冲后清零 | 发脉冲 25ms 后字段归零 | functional | `runner` |
| F5-6 | 无指令兜底帧 | 5×12.5ms 无 SS 指令 → 发默认帧 | boundary | `runner` |
| F5-7 | `EndianChange` 自反 | 编码后再解码 == 原结构 | api | `code` |
| F5-8 | 报文长度 == `sizeof` | 不匹配被静默丢弃（构造错误长度验证） | api | `code` |
| F5-9 | `DSUmaneuverStaEn` 字典 5/6 | 异常退出 5 / 正常退出 6 | api | `runner` |
| F5-10 | `DSUmaneuverIdEn` 0..8 全字典 | 逐个值注入验证消费方识别 | api | `runner` |
| F5-11 | 被击中自动关 DSU | 对端 `MISSILE_PANORAMA.IsHit` 2→1 | functional | `runner` |

### 原 F8 · 攻击列表与武器链

**依据**：[injection.md](injection.md) §5.5、[scenarios.md](scenarios.md) §2.5

| # | 可测点 | 判据 | `type` | `channel` |
|---|---|---|---|---|
| F5-12 | 攻击列表字段完整 | `TM_ATTACK_LIST_DATA` 14 字全字段解码 | api | `code` |
| F5-13 | 武器包线各距离字段 | `Rmax/Rmin/Racue/Rtr/Rpi/Ropt/Raero` + 有效位 | api | `code` |
| F5-14 | `attackAreaType` 1..4 | 六线/五线/四线/七线 | boundary | `runner` |
| F5-15 | FCM_STA 装订 PL13 | `FIELD_BOOL_ziYJu0euIVHG` | functional | `runner` |
| F5-16 | FCM_STA 装订 PL16 + `prepState=4` 条件 | 4 个条件同时成立才 4 | functional | `runner` |
| F5-17 | FCM_PL13 弹道评估 飞行=1 / 命中=2 | `FIELD_ENUM_mOPLi0hD0uis` | functional | `runner` |
| F5-18 | FCM_PL16 弹道评估 飞行=1 / 命中=2 | `FIELD_ENUM_LwXnPcUyPask` | functional | `runner` |
| F5-19 | SMM 实战投放（`MainWeaInfo=1`） | `wpn_release_state=2` 等 3 字段 | functional | `runner` |
| F5-20 | SMM 演习投放（`MainWeaInfo=2`） | `pl16_is_sim_launching=1` | functional | `runner` |
| F5-21 | `SMM_ZII` 单拍脉冲 ≥3 拍才触发 | `WeaponFireCMD==1` 连续 ≥3 次 | boundary | `runner` |
| F5-22 | `55555` 撞号区分 | `WEAPONEVENTCONTROL` vs `FCM_PL16` 不同义 | boundary | `code` |
| F5-23 | `IsHit` 2→1 跳变 = 被击中 | `MISSILE_PANORAMA` | functional | `runner` |

## F6 显示与告警

> 合并：原 F9 可解释显示

### 原 F9 · 可解释显示

**依据**：[observation.md](observation.md) §3

| # | 可测点 | 判据 | `type` | `channel` |
|---|---|---|---|---|
| F6-1 | `CurStaEn` 全字典 0-8 | 逐个值可被置出并读到 | api | `runner` |
| F6-2 | 16 科目按钮三态 | `*ButtonDis` 0 灰 / 1 可进 / 2 执行中 | functional | `runner` |
| F6-3 | `ExplainableInfoWord1..5` GBK 文案可读 | 按 GBK 解码不出现乱码 | api | `code` |
| F6-4 | `curDetectTar`/`curSensor`/`detectConcealLevel`/`detectIntent` 字典 | 各值可被置出 | functional | `runner` |
| F6-5 | 显示透传来源正确 | 由 POC 写入（SAR `PostCalibExp` 转发），MM 仅透传 | functional | `runner` |
| F6-6 | 场景退出时 EXP 全 0 复位 | SAR 发全 0 POC 驱动 MM 复位（:335-343） | functional | `runner` |

## 用它做什么（三步）

1. **Step 1 生成用例前**：逐项对照，把 N/M 写进汇报（「本项目录列 N 个可测点，本版覆盖 M 个，其余为什么排除」）。
2. **Step 2 用户审查时**：把这张 N/M 表一起给用户看，他能一眼发现哪项覆盖太少。
3. **Step 6 报告时**：可测点覆盖率可以作为一个附加结论（可选，不在报告必填项里）。

> **不要把它当成「必须写满」的指标。** 它的作用是**让你知道自己漏了什么**，
> 然后**有意识地决定**是补上还是排除 —— 有意识的排除是可接受的，无意识的漏掉才是问题。

## 从可测点写用例：命名与描述（必须照这个写）

可测点是「点」，用例是「面」。**一个可测点通常对应一条用例，有时多条合并成一条。**
无论怎么合并，`title` 与 `description` 必须按下表写：

| 字段 | 要求 | 示例 |
|---|---|---|---|
| `title` | **动宾短语，8-20 字，不带标点、不带「验证/测试/能够/是否」** | ✅ `机动场景 VMC 握手进入`<br>❌ `验证当 DSU 返回进入应答时系统是否正确进入机动场景` |
| `description` | **专业化的测试说明**：概括验什么、覆盖哪些分支。**不套「输入：…操作：…判据：…」模板**，不堆参数值 | ✅ `验证机动场景经 VMC 握手通道进入的完整链路，覆盖进入申请、飞控应答与状态机迁移；同时确认进入成功后默认科目的自动附加行为。` |
| `expectedResult` | 一句话，**必须是可机器判定的字段值** | ✅ `IU_CMD.SceSelEn=1` |

**从可测点行到用例的转换示例**：

```
可测点行：
| F2-1 | 场景 1 机动 · VMC 握手进入 | DSUentryReqAckValid=1 && DSUentryReqAckEn=1 → IU_CMD{SceSelEn=1} | functional | runner |

↓ 转成用例

{
  "title": "机动场景 VMC 握手进入",
  "description": "验证机动场景经 VMC 握手通道进入的完整链路，覆盖进入申请、飞控应答与状态机迁移；同时确认进入成功后默认科目的自动附加行为。",
  "expectedResult": "IU_CMD.SceSelEn=1",
  "type": "functional",
  "precondition": "四服务已启动、blockingStratege=0"
}
```

> **注意**：可测点表的「可测点」列已经是动宾短语（如「机动场景 VMC 握手进入」），
> **直接拿来当 `title` 通常就合格** —— 别自己再扩写成一句话。
>
> `description` **不要**把可测点行的「判据」列照抄进去 —— 那是 `expectedResult` 与步骤的事。
> 描述要说的是**这条用例的设计意图与覆盖范围**（为什么值得测、覆盖了哪几个分支）。