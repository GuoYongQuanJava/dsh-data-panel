# POP 四场景进入/退出与握手（Step 5 执行前必读）

> 这份文件解决「点了按钮，场景到底进没进、退没退、卡在哪一步」。
>
> **所有门控与握手结论都带源码位置**（`文件:行`），方便换项目时对照改。

## 场景枚举与命名陷阱（源码确认）

MM 只认 **4 个场景**（`MissionManagementImpl.h:19-26`）：机动1 / 传感器2 / 自主飞行3 / 自主探测4。

**两个易混的内部标志**：

- `m_hasEnteredDetectTestScene` = **传感器**场景（MM:173-214）
- `m_hasEnteredAutoDetectScene` = **自主探测**

**函数名陷阱**：旧文档里的 `checkScnModelIfIntercept`，
源码实名是 **`checkSensorSceneHighlightedScm`**（NS:855）。

## 进场景握手（按场景不同，源码确认）

| 场景 | 申请通道 | 同意判据 | 界面表现 |
|---|---|---|---|
| **1 机动 / 3 自主飞行** | **不发 IU_CMD**：<br>`ZZKZSC_DSU_ZII.ZzkzEntryCMD` 0→1 跳变 + `ZzkzEntryCMDValid=1`<br>（MM:586-597；NS:606-615） | `DSU_VMC_AP_DSU_DATA.DSUentryReqAckValid==1 && DSUentryReqAckEn==1`<br>（NS:1332-1344）→ `entryScene(n,true)` | 等待期间黄字「正在进入中」= `EXP.ZZKZentryStaDis=1`<br>（只在 NS:1428 置、NS:1000 清） |
| **2 传感器 / 4 自主探测** | `IU_CMD` Word3 申请位：<br>传感器 `IUsensorEnter`=Bit1、探测 `IUAutoDetectEnter`=Bit2<br>**发一次后立即清零重拍一拍**（MM:104-107） | 每拍查 `SC_MISSION_STA.FIELD_ENUM_zsmZ4N3NZ90k`<br>（3bit：1=进入成功 / 2=进入中 / 3=退出 / 0=NA）<br>（NS:1379-1423） | 同上 |
| **全部（旁路）** | `blockingStrategy==1`<br>（来自订阅 `DSU_AI_RULE_LOAD_DB`，非法值钳 0，PL:296-302） | **跳过握手直接** `setSceSelCMD`（MM:466-469）<br>手动退出直接 `passExitCmdToTDM`（MM:751-756）<br>30s 超时直接透传退出（MM:1085-1088） | 本机装载包=1 → **点亮的按钮点了就进** |

**三条要点**：

- 场景/科目目标的**唯一驱动源**是 POP 的 `ZZKZSC_POC_EXDISP_INFO`：
  `SceSelValid==1` 置位、`!=1` 全复位（MM:171-225）。四服务在线时这条链天然闭合，无需卡点。
- **进入等待中点退出会清全部申请 flag**（MM:495-505）。
- **旁路（blockingStrategy=1）是闭锁全局态**：用过它，负向用例必须**干净重启四服务后另跑**；
  旁路不置 `m_EnterManeuverFlag`、不发 `DSU_ZII`，**勿据此判缺陷**。

## 四场景进入门全式（源码确认）

### 传感器（场景 2，MM:383-399）

```
DcLoadRes && ScLoadRes && DcStatus && ScStatus
&& 拦截模式 && !pwl(传感器黑名单6码) && b_checkVMInfo(五valid全1)
&& IA生命 && !checkSceneExitCondition(2)
→ 置 1 并打印 1111…
否则置 0 打印 2222…
```

> **传感器门不查平飞 `checkPlaneStatusRes`，也不查 `checkReadyTest`**（与机动不同）。

### 机动（场景 1，MM:365-380，9 个原子全 AND）

| # | 条件名 | 字段 = 期望值 |
|---|---|---|
| 1 | `isPlaneModeIfNavigation` | `SC_MISSION_STA.AvionicsSysMainMode==2` |
| 2 | `DcLoadRes` | `ZZKZDC_STA.BMdcDataManLoadResValid==1 && En==0`（或 Auto 同） |
| 3 | `ScLoadRes` | `ZZKZSC_STA.BMscDataManLoadResValid==1 && En==0` |
| 4 | `DcStatus` | `IAGSM_ICP_RT_ABI_STA_INFO` 中 `4a37nmd2xu45==DC_SOFT_ID(0x61)` 且 `ha2qtwj71pn4==1` |
| 5 | `ScStatus` | 同上但 `SC_SOFT_ID(0x62)` |
| 6 | `pwlWarningManTest = !checkPWLWarning(1)` | PWL 信号 key 不在 **101 项黑名单** |
| 7 | `flyControl_ManTest = flyControlFeedback(1,0)` | `DSUflyVmcSta==1 && DSUvmcLimitValid==1 && DSUvmcLimitEn==0 && DataValid==1` |
| 8 | `checkPlaneStatusRes` | 平飞：`\|DSUgammaDeg\|≤7 && \|DSUspdUMps\|<5`；高速在 SAR 前校准界内（<8000m 用表速界，≥8000m 用马赫界，有效字全 1）（NS:768-831） |
| 9 | `!checkSceneExitCondition(1)` | 见下「退出门」 |

> **机动/自主飞行没有 1111/2222 门串** → 只能靠**按钮态** + 控制台各项逐条核对。

### 自主探测（场景 4，MM:405-417）

```
拦截模式 && (目标帧 || 搜索区六参全有效)
&& !pwl(探测黑名单11码) && DcStatus && ScStatus
&& IA生命 && b_checkVMInfo(五有效) && DcLoadRes && ScLoadRes
&& !checkSceneExitCondition(4)
```

> **未参与任何门（源码确认，只是算了没用）**：`radarLifeInfo`、`isweaponAvailable`、
> `isweaponGuiding` → **别指望页 104 的武器/攻击列表条件点亮任何场景按钮**。

### 自主飞行（场景 3，MM:420-431）

```
导航模式 && Dc/ScLoadRes && Dc/ScStatus && !pwl(与机动共用101项大表)
&& flyControl_AutoFly && isPlaneHightSpdIfAllow
&& !checkSceneExitCondition(3)
```

- `flyControl_AutoFly = flyControlFeedback(1,0)`：比机动多两项
  `MainNavModeCmd ∈ {0,5,6}`（计划航线/直飞锁定/塔康导航）与 `AuxNavModeCmd == 0`（未开辅助导航）
- 用 `isPlaneHightSpdIfAllow`（只查高度/速度，**不查平飞角速度**）替代 `checkPlaneStatusRes`

### 自主攻击（场景 5，页 110）— 环境不可达

**MM 不处理场景 5**：

- `isSceneTriggered` 只接受 1..4（NS:390-408）
- `AutoAttackButtonDis` / `AutoJamButtonDis` 在 MM 全文**无赋值点**，只随 POC 整体 `memcpy` 透传（NS:955-971）
- `entryScene` 注释写了「自主攻击」但**分支只处理 2/4**（MM:525-532）

→ **菜单恒灰，页 110 环境不可达，记 `blocked` 勿重试。**
→ 若能进：打开页 110 时 POP 自动发 `DCMII{SceSelValid=1, SceSelEn=5}`；页内只有标题 +「返回」。
→ **别把「页 110 被打开」写成 MM 通过。**

## 退出协议与 tip30s（按场景行为不同）

| 场景 | 手动退出<br>TipDialogInfoEn | 取消<br>(`pilotRefuseExit=1`) | 场景退出自动触发 | tip30s 到点 |
|---|---|---|---|---|
| **1 机动** | `DCMII{ZzkzExitValid=1,ZzkzExitBool=1}`<br>或 HOTAS `DSUhotasValid&&En==1`<br>无飞控故障时先发 `ZZKZSC_DSU_ZII{ZzkzExitCMD=1}`，<br>等飞控 `DSUmaneuverStaEn==6`（正常退出）才透传 | `checkSceneExitCondition(1)` 命中 →<br>`CurStaEn=6`(运行异常) + tip30s（MM:909-915） | **1** | **复位计数、停止计时** → 只清弹窗，**不强制退出** |
| **2 传感器** | `IU_CMD.IUsensorExit`(Bit0) 申请，<br>等 SCM `zsmZ4N3NZ90k==3` 才透传退出；<br>SCM 故障时直接透传 | 同 1 | **2** | **继续计数，到期照退** → **强制退出** |
| **4 自主探测** | `IU_CMD.IUAutoDetectQuit`(Bit3) 申请，同上 | 同上 + 任务目标丢失 30s | **7** | 继续计数 → **强制退出** |
| **3 自主飞行** | 同机动（共用 `exitInternal` 分支） | 命中 → tip30s，**不置 `CurStaEn=6`** | **6** | 复位计数 → 只清弹窗，**不强退** |

> **这是一条最容易写错结论的地方**：
> 场景 2/4 点「取消」**不会停止 30s 计时器**，到点照样强制退出；
> 场景 1/3 点「取消」**会停表**，30s 到点不强退。
> **不要用同一套预期写四个场景的取消用例。**

### 弹窗字典 `TipDialogInfoEn`

（NS:1008-1041；MM:938-957）

| En | 含义 | 备注 |
|---|---|---|
| 1 | 机动申请退出 | 同时向 TDM 发姿态调整 `TestCaseSelEn=1`（MM:1034-1037） |
| 2 | 传感器场景退出申请 | — |
| 3 | 雷达科目自动退出 | — |
| 4 | 光雷科目自动退出 | — |
| 5 | 雷达+光雷协同科目自动退出 | — |
| 6 | 自主飞行申请退出 | 也发姿态调整 |
| 7 | 自主探测申请退出 | — |

> **弹窗没有自动过期**：时效计数 `m_sendDisInfoCount` 在活跃代码里从未置非 0（NS:50,339-349）
> → **必须点「确定/取消」，弹窗不会自己消失。**
> 如果用例依赖「等它自己消失」，那条用例一定超时。

### tip30s 的真相

`tip30s = PERIODIC_30S_COUNT=1200 拍 × 25ms = 30s`（`Macros.h:20`）。

**tip30s 不是「进场景即触发」**，而是 `checkSceneExitCondition` 命中后经 `errorControl` 触发。
本机环境进入即命中退出条件，才表现为「一进去就弹窗」——
**这是环境特性，不是产品行为**，写用例时要说清。

## 退出门原子

### 机动（`checkSceneExitCondition(1)`，NS:1677-1693）

```
!导航 || !DcStatus || !ScStatus
|| ZZKZSC_STA.BMabnormalBool/BMinvalidBool == 1
|| flyControlFeedback(1,1)
```

后者 = `DSUmaneuverCtrlStaValid==1 && DSUmaneuverStaEn==5`(异常退出) `|| DataValid==0`

### 自主探测（`checkSceneExitCondition(4)`）

```
!拦截 || !DcStatus || !ScStatus
|| BMabnormal/BMinvalid || !IA生命 || !checkVMInfo
```

**任务目标丢失 30s**（MM:993-1006；NS:1880-1909）：

- 最新全景帧的 `FuseIDValid==1` 且 `FuseID == 进入时记录的 m_ntsTargetID` 才算「未丢」
- 丢失且**没有搜索区配置** → 启动 `m_count30s_TargetLost`，1200 拍（30s）与退出门一命中 → `tip30s(4)`

## 控制台断言字符串总表（最强的断言面）

`DEBUG_PRINT=1`，每 25ms 一拍；`LOG_PRINT=printf`

| 打印原文 | 位置 | 含义 |
|---|---|---|
| `DcLoadRes is %d, ScLoadRes is %d, DcStatus is %d, ScStatus is %d` | MM:269 | 四场景共用四项加载/实时能力 |
| `ManeuverOtherExp is %d, checkPlaneStatusRes is %d, isPlaneHightSpdIfAllow is %d, checkReadyTest is %d` | MM:270 | **第 1 个实参其实是 `pwlWarningManTest`（文案过时，别按字面读）** |
| `checkScmModeIfIntercept is %d, checkSensorScenePwl is %d, checkAutoDetectPwl is %d` | MM:271 | 拦截模式 / 传感器 PWL / 探测 PWL |
| `checkSensorSceneIaLifeMessage is %d, isPlaneModeIfNavigation is %d, checkSensorCaseIfExe is %d` | MM:272 | IA 生命 / 导航模式 / 传感器科目总门 |
| `flyControl_AutoFly is %d pwlWarningAutoFly is %d` | MM:273 | 自主飞行飞控反馈 / 其 PWL |
| `111111111111111111111` | MM:393 | **传感器进入门通过** |
| `222222222222222222222222222222` | MM:398 | **传感器进入门不通过**<br>机动/自主飞行没有对应串 → 只能靠按钮态 + 上面各项 |
| `------------- 传感器状态显示 is %d` | NS:371 | 直接读 `SensorTestButtonDis`（0/1/2） |
| `KKKKKKKKKK FIELD_BOOL_kjqfedyxv19 %d` | NS:1580 | 场景 2/4 退出判定（`onScmFaultSensorExit`）与 30s 超时路径 |
| `m_zzkzscIuCmd m_zzkzscIuCmd 成功 / 失败` | MM:1139/1144 | 每次发布 IU_CMD（进入、科目透传、退出透传都算） |
| `------pdata is null or length error------` | NS:1065/1084/1096 | **写缓存失败（ICD 长度不符 = 版本漂移信号）** |

> **观察面**：MM 控制台（标题 = `ZZKZSC_MM.exe` 全路径）是**最强断言面**；
> POP 菜单/页面文字是 EXP（340 字节）的屏幕镜像（弱一些，但有 1s 镜像延迟）。
>
> **MM 假死检测**：控制台截图 sha 与 10 分钟前一致 → 回「通用前置 1.1」全重启。

## 互斥规则（决定「为什么别的按钮灰了」）

**场景互斥**（MM:295-350）：任一 `hasEntered*Scene` 为 true
→ 该场景按钮置 **2**、其余三个置 **0**，且**不再评估其他场景进入门**。

**科目互斥**（MM:149-163）：场景内 `1 < TestCaseSelEn <= 20` 时
→ 选中科目置 **2**、其余置 **0**。

> 所以看到「我只点了一个场景，另外三个变灰了」是**正常行为**，不是 bug。

## 各场景可测面小结（写用例前先看这张表，别写测不了的）

| 场景 | 可测面 | 环境状态 |
|---|---|---|
| **2 传感器** | 进/退链、三科目（18/19/20）、参数表、40 条件注入、可解释显示、弹窗 | ✅ 已实测（3~4 轮复验 + 干净重启复跑） |
| **1 机动** | 16 科目、状态九态标签、退出链 | ⚠️ **环境阻塞**：本机 `DSUmaneuverStaEn===5` → 退出门恒真 → `ManeuverTestButtonDis` 恒 0<br>（第 4/5 轮注入 #16/#18 + DSU 重启均无效） |
| **4 自主探测** | 5 组标签、搜索区回显、退出链 | ⚠️ 部分实测：区域指定与 NTS 都注入成功，但 **VMC 五个 valid 位不全** → `AutoDetectButtonDis` 恒 0 |
| **3 自主飞行** | **只有**进/退链、菜单置灰、tip30s、弹窗 En=6 | ⚠️ 环境同机动 |
| **5 自主攻击** | 无（MM 不处理） | ⛔ 不可达 |

> **环境阻塞的用例标 `blocked` 并写明「环境不可达已定论，勿重试」**，
> 不要反复重试同一件事——那是浪费，也不是发现新缺陷。

## 场景内功能组（传感器为例，其他场景同理裁剪）

| 组 | 点哪里 | 断言面 |
|---|---|---|
| 科目切换 | 三科目轮点；退科目发 `TestCaseSelEn=0`（NS:1475-1488） | 页 101「当前状态」；三按钮字段 18/19/20 |
| 区域六参 | 页 105 tab「区域探测」（均 Name 定位）：6 输入框 + 每行「有效」勾选 +「指定探测区域」按钮 | 「发送成功！」toast 约 2s 消失，**点完立刻截图存证**；页 101/119 区域回显 |
| TDM 决策→SAR 控制 | 选科目后看页 108/109 SO + 页 101 参数表「当前」对「期望」 | SAR 期望表有值 = EXP 双向链路通 |
| 安全约束 19603 | 页 104 注入 #28-#39 告警 | 页 101 参数被约束 |
| 可解释显示 | 页 101 顶部四行：探测对象/探测意图/当前状态/测试提示 | 显示 `--` = 有效字 0 |
| 弹窗确认/拒绝 | 见「弹窗字典」 | En=2 场景退出；En=3/4/5=雷达/光雷/协同科目自动退出 |
| 异常自动退出 | 页 104「飞行员HOTAS杆控手动退出自主空战」；告警码 41044/41052/42028；IA 生命失效 | `KKKKKKKKKK` 打印 + 弹窗 + 场景退出后页回菜单 |

## 整机重启的必要性（什么时候必须重来）

**必须干净重启四服务的三种情况**：

1. **用过旁路（`blockingStrategy=1`）后跑负向用例** —— 旁路是闭锁全局态
2. **VMC 五个 valid 位丢失**（`DataValid/DSUtrackPsiValid/DSUlonValid/DSUlatValid/DSUbaroAltValid`）
   - 这些位在 DSU 600s 停或漂移后丢失
   - **重启 DSU 只恢复 `DataValid`**（`flyControl_AutoFly` 0→1），**不恢复全部 valid 位**
3. **MM 假死**（控制台 10 分钟无变化）

**重启流程**（通用前置 1.1）：
VS 窗口 `shift+F5` 全停 → **删 `DDS_increment_seq.txt`** → `F5`

> **不删 `DDS_increment_seq.txt` 会怎样**：DDS 序号接着上次涨，下游按序号判断的用例全部错乱。
> 这是重启流程里最容易漏的一步。

**重启 MM 的副作用**（实测）：新 MM 会**丢失此前条件发送/装载门锁**（`DcLoadRes`/`ScLoadRes` 输入）
→ 菜单钮转恒灰 → **需补一轮条件发送才恢复**。