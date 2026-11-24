# ZZKZ 场景与科目矩阵

Step 1 切功能项、Step 5 设计用例时读。**v2：2026-11-24 MM/TDM/SAR/SS/POP 五侧源码逐条核实；
与早前描述冲突处以本文件为准。**

## 0. 公共链与架构事实（全场景共用，先读后用）

### 进入全闭环天然成立（不只握手）

```
DCMII
  → MM 25ms enterSceneMonitor(Impl:462-474)
  → 审批
  → MM IU_CMD（SCF 19599/19600 + 裸 topic）
  → TDM 50ms 新 IU_CMD → 行为树（TreeManager 场景1/2/3/4 子树 :32/74/107/118）
  → TDM 发 BT_EXP_DIS_INFO(19629)
  → SAR PostCalibExp 转成 POC_EXDISP(19604)（SAR Impl:644-659）
  → MM getPocDisScene(Impl:170-225) 置 hasEntered*/科目级标志
```

退出且 TDM 可解释全 0 → SAR 发全 0 POC 驱动 MM 复位（:335-343）。

> **四服务在线时 harness 不需扮 POC**；POC 注入（SCF 19602/19604）是覆盖/加速通道
> 或 TDM/SAR 缺席时兜底。
> `CurStaEn` 2/3/4 由 POC 报文回写（MM 只置 5/6/7/8），POP `sendSceneSelect` 自带 `CurStaEn=2`，
> harness 注入 POC 时要自带。

### 三种审批通道

| # | 通道 | 场景 | 怎么同意 |
|---|---|---|---|
| ① | **SCM** | 2 / 4 | MM `IU_CMD.IUsensorEnter`/`IUAutoDetectEnter=1` 脉冲（NS:463/466）+ 每拍 `waitingScmAllow`（Impl:557-577 三分支）；同意 = **`SC_MISSION_STA.FIELD_ENUM_zsmZ4N3NZ9Ok==1`**（Word155 位13-15；==2 → `EXP.ZZKZentryStaDis=1` 入场中；退场景同意 ==3） |
| ② | **VMC** | 1 / 3 | MM 发 **`ZZKZSC_DSU_ZII.ZzkzEntryCMD`**（首拍 0 后每拍 1，NS:491/608-614）；**进入同意 = `DSU_VMC_AP_DSU_DATA{DSUentryReqAckValid=1, DSUentryReqAckEn=1}`**（NS:1335） |
| ③ | **旁路** | 1-4 | `blockingStratege=1`（页106 `DSU_AI_RULE_LOAD_DB`）**对场景 1-4 一律旁路**（Impl:466-474）；旁路进机动场景 `IU_CMD` 自动附 `TestCaseSelValid=1`/`TestCaseSelEn=1`（Impl:547-551，**断言须预期**） |

> **`blockingStratege` 来源**：`m_localAIRuleDb.blockingStratege` 来自裸 topic `DSU_AI_RULE_LOAD_DB`
> （`LOCAL_AI_RULE_DB` = 6×FT64 + UT32 `blockingStratege` + 3×UT32；非 0/1 被归 0，
> `NonServiceParamsLoad.cpp:297`）。
> **=1 → `entryScene(scene,true)` 免审批直发**；=0 → 场景 2/4 走 SCM 握手、场景 1/3 走 VMC 握手。

### DSU 反馈双源（注入分清）

| 用途 | 读哪个 |
|---|---|
| VMC 握手 | **裸 topic `DSU_VMC_AP_DSU_DATA`**（NS:130；entryReqAck / StaEn / CtrlStaValid / hotas） |
| 保护 / 禁机动判定 | **SCF `ZZKZSC_SS_VMC_INFO`(19636/19637)**（SS 从 DSU 报文转发拷贝，`FCSSnapInfo:69-76`） |

跑页 105 DSU 闭环则 SS 自动出一份；不经 DSU 则**两个都要直注**。

### 退出链

- **确认** = `DCMII{ZzkzExitValid=1, ZzkzExitBool=1}`（清弹窗停表 Impl:1045）
- **拒绝** = `DCMII{pilotRefuseExit=1}`（清弹窗；机动/自主飞行停表，
  **传感器/自主探测仍 30s 自动退**，Impl:1054-1055）
- **HOTAS** = 裸 DSU 报文 `{DSUhotasValid=1, DSUhotasEn=1}`（NS:994，= 条件 11）
- **场景 1/3 退**：MM 每拍 `DSU_ZII.ZzkzExitCMD=1`（Impl:776-779）→ 同意 `StaEn==6 && CtrlStaValid==1`
  （NS:1435），故障旁路 `StaEn∈{5,6}`（NS:1565）
- **场景 2/4 退**：`IU_CMD.IUsensorExit`/`IUAutoDetectQuit` + `FIELD_ENUM==3`，SCM 故障直通退（Impl:838-841）
- 复位靠 POC（自然全 0 或注入 `{SceSelValid=0}`）
- **tip30s = 25ms × 1200 = 30s**（`Macros.h:20`），首触发另发 `SteadyFlyCMD`（机动/自主飞行）

### 弹窗字典（MM 侧，EXP ICD:203）

| `TipDialogInfoEn` | 含义 |
|---|---|
| 1 | 机动申请退出 |
| 2 | 传感器未选科目 |
| 3 | 雷达区域 |
| 4 | 光雷 |
| 5 | 协同 |
| 6 | 自主飞行 |
| 7 | 自主探测 |

> NS:1006-1041 置位；场景 2 按科目 RADAR(18)/IRST(19)/MIX(20) → 3/4/5；
> `sendTipClearToDmpDc` NS:1049 清零；POC 回写覆盖 `m_disInfo` 时刻意保留 tip 两字段 NS:955-971。
> **各 POP 页 Widget 的文案字典是显示层本地实现，断言以 EXP 字段为准。**

### 目标真值链

```
DF_AA_PANORAMA_SITUATION
  →（SS 订阅 main:357-365）
  → SS 合成 ZZKZSC_SS_PANORAMA_SITUATION_INFO(19636/24302)
  → TDM / POP 消费
```

**★ TDM 不直连 DF。** 链验证 = 注 DF 后 PANORAMA 出现新目标。

### 场景号消费边界

- **MM 只认 1-4**（NS:393-398；5 可作数据透传不驱动状态机）
- **TDM 对 `BTsceSelEn==5` 有真实处理**（武器参数打印 + 发 `ZZKZDC_TDM_SC_ZII`/SCF 26329，
  TDM Impl:482/543/571、:649-675）→ **harness 可直发 `IU_CMD{SceSelValid=1, SceSelEn=5}`
  （SCF 19599/19600）驱动攻击行为树，不经 MM**
- **6/7 无人消费**（MM/TDM grep 零命中）→「全流程」= harness 时间轴编排概念

### 机动动作字典

`DSUmaneuverIdEn` 0..8：

| 值 | 含义 |
|---|---|
| 0 | 无效 |
| 1 | 停止当前机动 |
| 2 | 最速爬升 |
| 3 | 速度矢量跟踪 |
| 4 | S弯 |
| 5 | 转弯到指令高度巡航 |
| 6 | 定向定时过点 |
| 7 | 智能杆操控 |
| 8 | 自动导航 |

> **16 科目 ≠ 16 个 IdEn**：TDM 场景 1 行为树 17 子树（序号 1..17）收敛为 ActionCmd 6 种
> （`BTmaneuverIdEn ∈ {2,3,4,5,6,8}`）发 **`ZZKZDC_BT_MANEUVER_ZII`(19631)**；
> **MM 从不读 `DSUmaneuverIdEn`**（此断言在 TDM/DSU 面做）。
> `DSUmaneuverStaEn` 断言权威值 = **5 异常 / 6 正常**（POP 闭环另用 1 执行中/2 完成/3 超限）。

## 1. 第一层：七大测试场景进入总表

| # | 场景（POP 页） | 触发 | 审批与同意报文 | 闭环与首断言 | 详情 |
|---|---|---|---|---|---|
| 1 | 机动测试（100，scene=1） | `DCMII{SceSelValid=1, SceSelEn=1}`（页100 菜单置灰只约束 POP UI，不拦报文入口） | VMC：`DSUentryReqAck{Valid=1,En=1}`（DSU 闭环自动产或直注）；或旁路 | `IU_CMD` 预期 `{SceSelEn=1, TestCaseSelEn=1 自动附}`；闭环天然或注 `POC{SceSelEn=1,CurStaEn=2}`；场景按钮需**导航模式=2** | §2 机动 |
| 2 | 传感器测试（101，scene=2） | `DCMII scene=2` | SCM：`FIELD_ENUM=1`；或旁路 | `IU_CMD{SceSelEn=2}`；场景按钮需**拦截模式=3** + VMC 信息有效（双源） | §2 传感器 |
| 3 | 自主飞行（103，scene=3） | `DCMII scene=3` | VMC（同机动）或旁路 | `IU_CMD{SceSelEn=3}`；**空壳**，可测面仅进/退链 + 置灰 + tip30s | §2 自主飞行 |
| 4 | 自主探测（102，scene=4） | `DCMII scene=4` | SCM 或旁路 | `IU_CMD{SceSelEn=4}`；无 VMC/模式要求 | §2 自主探测 |
| 5 | 自主攻击（110，scene=5） | 页110 仅显示标记；**测法 = 直发 `IU_CMD{SceSelValid=1,SceSelEn=5}` 驱动 TDM** | 无 | TDM 26329 SC_ZII + 武器链 | §2 自主攻击 |
| 6 | 全流程空战（114，scene=6） | 页114/107 同一 `FullAirCombatWidget(m_scenario=6/7)`，点开只发 `DCMII scene=6/7` | 无 | **无人消费**；「JSON 剧本」说法作废 | §2 全流程 |
| 7 | 全流程 json（107，scene=7） | 同上 | 无 | 同上：时间轴冒烟 = harness 按时序编排全链注入（DSU闭环+加载+DF+攻击列表+科目+武器族），断言各环节关键报文时序不断链 | §2 全流程 |

## 2. 第二层：科目与功能组矩阵

**科目字典 `TestCaseSelEn` 1..20；只有场景 1/2 有科目按钮**，其余场景第二层 = 功能组。

### 2.1 机动科目 1..17（场景 1）

| n | 科目 | EXP 按钮字段 |
|---|---|---|
| 1 | 姿态调整 | 无按钮字段（判据 `TestCaseSelEn==1` 即手动退出态，NS:977） |
| 2 | 稳定平飞 | SteadyFly |
| 3 | 平飞加速 | AccelerFlyTest |
| 4 | 平飞减速 | DecelFlyTest |
| 5 | 稳定爬升 | SteadyClimb |
| 6 | 稳定下降 | SteadyDecline |
| 7 | 稳定左转 | LeftTurn |
| 8 | 稳定右转 | RightTurn |
| 9 | 稳定左盘旋 | LeftSpiral |
| 10 | 稳定右盘旋 | RightSpiral |
| 11 | 最速爬升 | MaxSpdClimb |
| 12 | S弯 | SCurve |
| 13 | 左上脱离 | UpLeftDetach |
| 14 | 右下脱离 | LowRightDetach |
| 15 | 定向定时过点 | PointTransit |
| 16 | 修正飞行 | CorrectFly |
| 17 | 组合机动1 | CombineMan |

字段 = 前缀 + `ButtonDis` 三态；进入判据 `isManeuverTestProjectEntered` `Valid=1 && 2..17`（NS:1104）。

**每科目同构测法**（F4，k=2..17 参数化 16 条）：

```
入场（§0）
  → DCMII{TestCaseSelValid=1, TestCaseSelEn=k}
  → 断言 ① IU_CMD 8 字段透传（无参数带，Ter* 不透传）
          ② TDM 行为树子树 k 驱动（ManeuverTest.cpp 按
             BTtestCaseSelStaValid==1 && BTtestCaseSelStaEn==k 分发：:515(2)…:5283(17)）
             + 动作指令 19631 BTmaneuverIdEn ∈ {2,3,4,5,6,8}
          ③ DSU 反馈 StaEn 5/6、（跑真闭环时）IdEn 0..8
          ④ EXP 科目按钮置灰 = 2 执行中
  → 退科目 TestCaseSelEn=0
```

**关键差异（v2 更正，与传感器场景三点不同）**：

1. **场景 1/3 默认走 VMC 握手**：进入同意 = `DSU_VMC_AP_DSU_DATA{DSUentryReqAckValid==1 && DSUentryReqAckEn==1}`
   （NS:1335，**不是 StaEn∈{5,6}**）；`blockingStratege=1` 对场景 1/3 也旁路。
2. **场景/科目按钮前置要导航模式 `AvionicsSysMainMode=2`**（`checkPlaneModeIfNavigation` NS:911；
   对照传感器场景要 =3 拦截 NS:859），两场景切换要换模式。
3. **退出同意 = `DSUmaneuverStaEn==6 && DSUmaneuverCtrlStaValid==1`**（NS:1435），
   故障旁路 `StaEn∈{5,6}`（`onVMCFaultExit` NS:1565）。

**科目按钮多一道门**：`CurStaEn==2`（准备测试，POC 回写态，Impl:252/304-310）。

**保护组**（SS_VMC_INFO 注入，`errorControl` Impl:873-1023）：

| 注入 | 期望 `CurStaEn` | 条件 |
|---|---|---|
| 高度/速度出窗且科目==1 | **5** 接管 | `checkPlaneHightSpdIfAllow`（NS:834-848，Impl:881-883） |
| `DSUvmcLimitValid=1 && DSUvmcLimitEn ∈ {8,9,10,11}` | **7** AI 保护 | 表 Impl:886-895 |
| `DSUvmcLimitEn ∈ {1-7,12-18}` | **8** 飞控保护 | Impl:899-901 |
| `checkSceneExitCondition(MAN)` 命中 | **6** 运行异常 + tip30s | **只有机动分支置 6**（Impl:909-914）；自主飞行/自主探测只 tip30s 不置 6 |

> ICD 语义：8 高高度 AI / 9 低高度 AI / 10 低速度 AI / 11 高速度 AI，1-7/12-18 各飞控保护。
> **7/8 独立态分别断言。**

### 2.2 传感器科目 18/19/20（场景 2）

判据 NS:1104 同族（20 协同 NS:1150），退科目 `En=0`（NS:1479）。
**科目按钮无 `CurStaEn==2` 门**（Impl:328/262）。

**场景内按钮点亮前置**（MM 每 25ms 刷新，全部同时成立）：

```
DcLoadRes(条件2) + ScLoadRes(条件0) + DC/SC生命消息正常(条件4)
+ 航电主模式=3拦截(条件14) + PWL无传感器禁令(条件39)
+ VMC信息有效(页105开DSU 或 条件15-17直预置 SS_VMC_INFO)
+ 雷达或光雷生命消息有效(条件19或20) + 无场景退出条件
→ EXP.SensorTestSceneButtonDis=1
```

> **MM 的 `checkVMCInfo`/`checkPlaneStatus` 读的是 SS 转发的 `ZZKZSC_SS_VMC_INFO`（SCF 19636/19637），
> 不是 DSU 原始报文** —— 无头时可二选一：跑 DSU 闭环让 SS 产出，或按条件 15-17 直接喂 SS_VMC_INFO。

**功能组七项**：

1. **科目进入/切换/退出**：`DCMII{TestCaseSelValid=1, TestCaseSelEn=18/19/20}`，
   退科目 `TestCaseSelEn=0`（NonServer:1117/1133/1478）；MM 每拍 `sensorTestSceneING`
   把 DCMII 原样转 `IU_CMD`（Impl:683-705）；观测 `EXP.SensorTestProjectButtonDis` 三态
   （场景内科目置灰 = DC 加载成功 + 无 PWL，Impl:328）。
2. **区域参数下发**：`DCMII` 区域六参 → `IU_CMD` 回显 → 下游 `SAR_SO_PERIOD`
   搜索中心/波束宽/量程按区域几何一致；自主探测场景另有 `memcmp` 变化才发 IU_CMD 的行为（Impl:645-657）。
3. **传感器控制指令链**（页 108/109 观测对象）：
   ```
   IU_CMD + 目标态势（经 SS 合成 PANORAMA 快照 19636/24302 转给 TDM，TDM 不直连 DF）
     → TDM 50ms 决策（TacticalDecitionMakingImpl:282；新 IU_CMD(IUsceSelValid=1,IUsceSelEn!=0)
       → BehaviorTreeManagement；场景 2/4 才调 outputTdmScZii/SoPeriod/SoEvent 发 SCF 24305/24306）
     → SAR 25ms 仲裁（SafetyAdjudicatiuonImpl:183 → Post_Calibration → :766-786 SensorPeriodCmdSendControl）
     发 SCF 24307/24308
     → 下游消费者 = 外部传感器（测试环境 = POP RadarSimulator + 108/109 观察窗）
   ```
   > **SS 不消费 SAR_SO**；SS 消费传感器上报 `SO_*_STA`（服务 23(773/775/777)/26/25/148 合成快照）。
   >
   > **场景 2 未选科目不发 SO，断言必须在选科目之后**（TDM :622 注释「只有进入测试项目了才发」）。
   > 时序预算 = 决策 50ms 拍 + 仲裁 25ms 拍数个周期。
4. **安全约束联动（v2 更正方向）**：**19603 `SAR_ACT_CONSTRAINT` 由 SAR 生产**
   （`Pre_Calibration`，SAR Impl:249-251/680），**TDM 订阅它预约束决策** ——
   框架角约束：雷达方位 ±110°/俯仰 ±60°、光雷俯仰 +5°/-60°（`SensorDomainProcessor:38-41/181-182`）
   + `SensorAvailable`/`SensorFunctionComplete` 降级枚举（:280-317）。
   > **SAR 对 SO 输出没有限幅钳制**（`POC_CHECK=1` 路径纯 `memcpy`，`PostCalibrationOperation:354-355`）。
   > 真正的 `ApplyLimit` 只作用于 **`ZZKZSC_DSU_ZII` 机动参数**（`ApplyLimit.cpp:6-56`，
   > `POCmin/maxAlt`、IAS/Ma，8000m 分界选 IAS/Ma）。
   > 旧说法「SAR 按约束钳制 SO/光雷方位 ±60°」**作废** —— ±60° 钳制发生在 POP RadarSimulator 接收换算。
5. **显示透传陷阱（v2 更正来源）**：EXP 的 `curDetectTar`/`curSensor`/`detectConcealLevel`/`detectIntent`/
   `ExplainableInfoWord1-5` 由 **POC 端写入** —— 或 POP 测试注入，或 **SAR `PostCalibExp` 自然转发**
   （SAR Impl:644-659；场景!=0 收到新 TDM BT_EXP(19629) → 整包 `memcpy` 为底 + 安全保护标注叠加；
   场景退出且 TDM 可解释全 0 → `memset` 发**全 0 POC** 驱动 MM 复位 :335-343）。
   **MM 仅透传**（`setPocInfoToDisInfo`）。测 MM 时不算被测行为；真实行为树文案主题 = `ZZKZDC_BT_EXP_DIS_INFO`(19629)。
6. **异常自动退出链**：条件 19/20 生命消息无效 → `onRelatedSoftFaultSensorExit`/`onScmFaultSensorExit`
   时**无需 SCM 同意直通退出**（Impl:838-841）；相关告警码 41044 雷达/41052 前向武器制导/42028 火控解算
   （条件 27-38）；目标丢失 30s 计数 `m_count30s_TargetLost`（`errorControl` 内）。
7. **终止与弹窗**：`DCMII TestCaseTerValid/TerBool` **不被 `generatePassCMD` 透传**
   （科目终止实际走 `TestCaseSelEn=0`）；弹窗字典见 §0。

**F5 用例骨架**：

```
§0 进入（SCM FIELD_ENUM=1 同意或 blockingStratege=1 旁路）
  → 闭环（四服务在线时 TDM→SAR→POC 天然闭合，无需扮 POC；
          如需 CurStaEn=2/加速，注入 POC_EXDISP{SceSelValid=1,SceSelEn=2,CurStaEn=2}）
  → 区域六参
  → DCMII{TestCaseSelValid=1,TestCaseSelEn=18}
  → 断言 IU_CMD 透传（★选科目前 TDM 不发 SO，勿在此前断言 24305-24308）
  → 喂 DF 目标（→SS→PANORAMA→TDM）
  → 窗口捕获 24305/24306 按字典断言决策 + 24307/24308 与区域几何一致
    （SAR 曾发过则持续重发，按电平流采样）
  → TestCaseSelEn=0 退科目
  → ZzkzExitBool=1 + FIELD_ENUM=3 退场景
  → POC 复位（自然全 0 或注入 {SceSelValid=0}）、事件主题回落 0
```

> `SO_*` 探测上报喂入仍 SCF-only 待校准（报 `blocked`）。
> RadarSimulator 15000m 告警 / `IsHit` 2→1 / 光雷 ±60° 换算为 POP 内部模型规则，
> **harness 按规则生成 DF 输入而非断言**。

### 2.3 自主探测（场景 4）—— 无科目

**进入**：同传感器（SCM 握手或 `blockingStratege` 旁路）。
**菜单前置**（`checkAutoDetectButtonSta` Impl:265-268、置按钮 Impl:402-408）：
`DcLoadRes` + `ScLoadRes` + `DcStatus`/`ScStatus` + 无 PWL(`checkPwlWarningAutoDetect`) +
雷达或光雷生命(`checkSensorSceneIaLife`) + 平飞(`checkPlaneStatusRes`)，
**无 VMC 信息要求、无航电模式要求**。
**POC 闭环**：`POC_EXDISP{SceSelValid=1,SceSelEn=4}` → `m_hasEnteredAutoDetectScene`（Impl:210，或由 SAR 自然转发）。

**场景内唯一自动行为**（`hasEnterSceneMonitor` Impl:641-657）：区域六参全 Valid
**且 `memcmp` 检测到变化** → 发一次 `IU_CMD`（区域六参回显）；不变不重发。

> **断言法**：首次下发 / 同值重复下发不应新增帧 / 改值必新增一帧。
> 与传感器场景区别：传感器区域随科目链透传，自主探测区域本身就是唯一参数面。

**弹窗确认/拒绝链**：MM 侧字典 = `EXP.TipDialogInfoEn` **7 = 自主探测申请退出**（NS:1041）；
触发 = `checkSceneExitCondition(AUTO_DETECT)`（SCM 故障 `FIELD_BOOL_kjqfedyexvl9` / 拦截模式丢失 / IA 生命 / PWL /
VMC 信息 / DC 或 SC 生命任一，NS:1694-1707）→ **只 tip30s 不置 `CurStaEn`**（Impl:1004-1007）；
30s 弹窗：确认 = `DCMII{ZzkzExitValid=1, ZzkzExitBool=1}`（清弹窗停表 Impl:1045-1047）；
拒绝 = `DCMII{pilotRefuseExit=1}` —— **清弹窗但传感器/自主探测不停表，仍 30s 自动退**；
HOTAS = `DSU_VMC_AP_DSU_DATA{DSUhotasValid=1, DSUhotasEn=1}`（NS:994，= 条件 11）。

**退出链**：`DCMII{ZzkzExitBool=1}` → `IU_CMD{SceSelEn=4, ZzkzExitBool=1}` + `IUAutoDetectQuit=1`
→ SCM 同意 → `POC_EXDISP{SceSelValid=0}` 复位。

### 2.4 自主飞行（场景 3）—— 空壳，低优先

POP `AutoFlyTestWidget` **无任何发送**（grep 零匹配）。MM 有进入链（默认 VMC 握手：
`DSU_ZII entryCmd` + `DSUentryReqAck` 同意，或旁路；**不附默认科目**）、
场景按钮置灰（`AutoFlyButtonDis`；前置集未逐行核实，疑似同机动：加载+生命+PWL+导航模式+平飞）、
`errorControl` autoFly 分支（Impl:977-989：只 tip30s **不置 `CurStaEn`**）、
场景内监控**空分支**（Impl:637-639；`autoFlySceneING` 桩 :709-711 未被调用）。

**可测面只有**：进入/退出链（`DCMII scene3` + VMC 同意 → `IU_CMD{SceSelEn=3}`；
退出 `ZzkzExitBool` + `DSU_ZII exitCmd` + `StaEn=6`）与 `AutoFlyButtonDis` 置灰矩阵、tip30s 分支（弹窗 En=6）。
**其余建议跳过。**

### 2.5 自主攻击（场景 5）与武器链（F8）

**关键结论（v2 更正）**：页 110 只发 `DCMII{SceSelEn=5}` 作场景标记 + 显示；
**MM 状态机只认 1-4**（NS:393-398；`generatePassCMD` 可把 5 当数据透传 Impl:731，不驱动状态机）——
但 **TDM 对 `BTsceSelEn==5` 有真实处理**（TDM Impl:482/543/571 攻击场景下对
`SS_MISSION_EVENT`/`PERIOD`/`PANORAMA` 做武器参数打印；:649-675 `outputTdmScZiiGeneration`
发 **`ZZKZDC_TDM_SC_ZII`（SCF 26329 BEHAVIORTREEINTEGRATEDCONTROL）**，日志「自主攻击场景--发布SC_ZII」）。

**因此：harness 可直接 SCF 发 `IU_CMD{SceSelValid=1, SceSelEn=5}`（19599/19600）驱动 TDM 攻击行为树，
不需经 MM、无审批。** 6/7 无人消费（MM/TDM grep 零命中）。`IU_CMD` ICD 字典本身含 5=自主攻击。

**注入面**（页 106 武器三 tab）：攻击指令页 = SCF `FCM_STA` 装订（`sendFCMSTATOSSService`；
仿真侧 `FCM_STA` 11111/22222、`FCM_PL13` 33333/44444、`FCM_PL16` 55555/60000）
+ `SC_MISSION_STA` 周期泛型；武器程序页 = `TM_STA` 周期 + `FCM_STA`；
武器释放页 = `SMM_WORK`(60003/60004)`{MainWeaInfo=1/2}` + `SMM_WEAPON`(60001/60002)，
两模型（发射/解锁，`zzkzscSmmZiiInfoModel=1/2`）。

**武器链生产/消费（v2 核实）**：

- **SS 订阅**武器状态 = `FCM_STA`(11111/22222)、`FCM_PL13`(33333/44444)、`FCM_PL16`(55555/60000)、
  `SMM_WEAPON`(60001/60002)、`SMM_WORK`(60003/60004)（SS main:384-444）
  + **`TM_ATTACK_LIST`(75/507)**（main:370-378）+ `DF_AA`（main:357-365），
  合成快照供观测（**SS 是聚合面，非弹道计算者**）
- **发射/解锁指令 `ZZKZSC_SMM_ZII` 由 SAR 发布**（op `WEAPONEVENTCONTROL_ID=55555`，
  SAR main:151-159、MacroId.h:20，**与 FCM_PL16 的 55555 撞号不同义，日志勿混**）
- → POP `MissileSimulator` 消费 `SMM_ZII`（`WeaponFireCMD==1` 连续 ≥3 拍 → 发射）
  → 上报 `FCM_PL16` 弹道（`launchedEvalData` 飞行中=1/命中帧=2）
  + `MISSILE_PANORAMA`（`IsHit` 1 命中/2 未命中，经 ZMQ 给对端真值）
- 观测面另含：TDM 武器决策输出（`SAR_SC_ZII`/`DSU_ZII`）、EXP/告警联动

> POP 自带弹道模型 `MissileSimulator\missile_model.cpp`（弹动力学 + TacView 输出）
> —— 无头时可复用其模型生成弹道真值或直接注入弹道/命中帧。

**F8 用例骨架**：装订（`FCM_STA` 目标 + 程序号）→ `TM` 攻击列表约束 →
`SMM` 发射（单拍脉冲，≥3 拍回发规则）→ 断言 SMM 事件/`FCM` 轨迹/武器事件回发 →
命中帧 `IsHit=1` → 断言攻击列表与 EXP 联动。

### 2.6 全流程空战（6）与全流程 json（7）

两页是**同一个 `FullAirCombatWidget` 类**（`m_scenario=6/7`），点开只发
`DCMII{SceSelValid=1, SceSelEn=6或7}` + 显示面板；**无内置剧本引擎**
（View 下无 QJson 调用 —— 早期「107=JSON 剧本回放」说法**作废**）。场景号 MM/TDM 均不消费
→「全流程」实质是 **harness 按时间轴编排全链的测试概念**：

- 注入 = DSU 闭环 + 加载 + DF 态势 + TM 攻击列表 + 科目指令 + 武器族按时序发
- 观测 = EXP/SO/武器事件/弹窗/告警全面
- 预期 = 每环节关键报文按时序出现不断链
- **作回归冒烟用一条时间轴脚本串完**

## 3. 第三层：跨场景共用基础设施

### A. 注入面速查（详见 [injection.md](injection.md)）

| 注入面 | 注入什么 | 怎么测 / 测什么 |
|---|---|---|
| 页104 测试条件（40 项） | 0-7 加载/生命、12-14 航电模式、15-18 预置 SS 快照+约束、11 HOTAS、26 目标、27-38 告警、39 清零 | 无头不点按钮直注对应报文；测 = **置灰矩阵**（每缺一项电平 → EXP 场景/科目 `ButtonDis=0`，MM 每 25ms 写 EXP 即电平消费观察面）+ 行为开关（拦截/导航模式对两场景按钮的互斥影响） |
| 页105 DSU 闭环 | 裸 `DSU_VMC_AP_DSU_DATA`(76B) 周期喂；按被测 `ZZKZSC_DSU_ZII`(entry/exit CMD) 回 ack/hot；5×12.5ms 兜底默认帧 | 机动执行收敛（运动模型或直注）、VMC 审批（entryReqAck 进同意 / StaEn=6 退同意）、HOTAS 退出；**双源提醒**：SS 在线时自动转发一份到 19636/19637 |
| 页106 周期加载 | DF 60012B、TM 攻击列表、`DSU_*_DB`（**`DSU_AI_RULE_LOAD_DB` = blockingStratege 开关入口**）、武器三 tab | DF→SS→PANORAMA 24302→TDM 链验证；加载 DB 控制按钮前置与旁路开关 |
| 页111 操纵杆 | 物理杆 → DSU 报文 `CenterStick/SideStick/Throttle` + `ManeuverIdEn=7`；btn3 HOTAS；js0 btn0 手动发射 | 无头等价 = 直写 DSU 报文字段；测智能杆操控链（真消费者 = `DataSendDSU`→DSU 报文）→ MM 稳盘/DSU_ZII 交互→航态变化；科目 7（智能杆）专项 |
| 页118 模型参数 | 飞控模型 U 指令入参覆盖（`uCmdID`/目标参数/保护限/定向定时过点/风扰/舵面/干扰），开启后最高优先级覆盖 DSU 报文生成 | 机动参数注入面（页104/106 给不了这些参数）；测科目参数边界（限幅/保护阈值）对 DSU 报文与运动收敛的影响（配 `ApplyLimit` 8000m IAS/Ma 分界断言） |
| 页113 ZMQ 多机 + 常驻引擎 | RadarSimulator/MissileSimulator 的目标真值源：上行本机 VMC(0x1001)/告警(0x1002→服务端合并 0x1003)，下行他机白态势；引擎产出 `DF_AA_PANORAMA_SITUATION`、`MISSILE_PANORAMA`(`IsHit`) | 测多机告警/协同/命中链；**无头等价物 = harness 直接构造 DF/导弹帧替代多机**（引擎规则作输入生成器，其内部规则非被测）。ZMQ 总线本身不必单测 |

### B. 观察面速查（详见 [observation.md](observation.md)）

`EXP_DIS_INFO`(19601, 742B) = 场景/科目主判据面；
`IU_CMD`(19599/19600) = 指令回执；
SO 观察窗页 108/109 = **24307/24308（SAR_SO 的消费者是外部传感器 = POP 侧；SS 不消费）**；
TDM 决策面 24305/24306、动作指令 19631、攻击 SC_ZII 26329；
SS 快照（19636：VMC_INFO 19637 / PANORAMA 24302 / MISSION_EVENT 24301 / PERIOD 24500）；
112/115/116/117（EXP/SS/PWL 告警显示链）；119 ICD 字典页（`SimInfoIcdRows.cpp` 为 LSB/MSB 权威）；
MM 日志 `MM_STA`(204B) `logCode`。

### C. 边界与剔除

- `SO_*` 探测上报喂入仍 SCF-only 未校准（相关断言报 `blocked`）
- RadarSimulator/MissileSimulator 内部规则（15000m 告警、`IsHit` 2→1、光雷 ±60° 接收换算）
  = POP 模型行为**非被测**，harness 按规则生成输入
- **POP 纯 UI（语言/单位、占位页、座舱布局、模型参数页的保存设置自身）不进用例**