# ZZKZ 注入面（怎么把输入喂进被测系统）

Step 5 准备注入工装时读。**本文件只管「往哪发什么帧」**，观测与断言见 [observation.md](observation.md)。

> **无头 = harness 直接构造报文，替代 POP 的人工点按钮。**
> POP 页只是「人工操作代理」，它的每个发送函数都有等价的报文。

## 1. 无头启动四服务（已实证，不需要 Center.exe）

- 预编译 exe 四份齐全：`<PROJECT_ROOT>\zzkz_sar_win\ZZKZSC_SAR\VS\x64\Debug\`
  （**优先用这份**，MM/SS 自身 VS 目录曾缺 exe）。
- 启动方式：

```
taskkill /F /IM <exe>                     # 清残留
Popen(exe, cwd=该 VS 目录, env.PATH 前置 DebugCRT + ucrt + SCF 三库目录)
```

  历史成功模板：`<SESSION_ROOT>\tests\it_service.py`。
- **存活判据**：10s 内四进程存活 + 每服务 netstat UDP 端点 ≥3 + 周期主题有流量。
- **构建**：各服务根目录 `build_windows_x64.bat`（CMake，`TGT_PLATFORM=win_x86_64`，
  `ENDIAN_TYPE` 控制大小端宏）；或直接 cl 链 `SCF_INSTALL\lib\windows\x86_64\scfd.lib`。
- **运行依赖**：`SCF_INSTALL\lib\windows\x86_64` 下 `scfd.dll`、`ACI_DDS.dll`、`MonitorCenter.dll`、
  `sqlite3.dll`、`face_oss.dll`、pthread；SAR 目录另有第三方
  `Libs\simulator\x64\{ddsc,TSS601,xmw_lib}.lib`。

## 2. DDS 配置（第一大坑，先过这里）

所有参与进程（四服务 + 探针 + 注入器）**各自工作目录**放一份 `ACI_DDS_config.properties`：

| 要求 | 说明 |
|---|---|
| **同一 `DDS_CONFIG_DOMAIN` + `DDS_CONFIG_IP`** | 不同 domain 直接互相看不见 |
| **`(DEVICE_ID, PROCESS_ID)` 全局唯一** | participant guid 前缀即 `DEVICE_ID`；**相同会被判为同一 participant，自发自收被静默丢弃** |

- 历史成功运行用过 `domainId 200 + 127.0.0.1`，也曾改成 `77 + 192.168.10.77`
  —— **两者都不是固定值**。**跑测试前必须先探测本机当前配置并统一**，
  不要照抄文档里的数字（换电脑后配置可能完全不同）。
- 探针惯例 `DEVICE_ID=14`、`PROCESS_ID=99`。**工装一律分配独立 ID 段**。
- `Initialize("")` 按**当前工作目录**查找该文件，所以探针必须在放了
  properties（+ `ACI_DDS.dll` + `DDS_increment_seq.txt`）的目录里启动。

## 3. 两条通信通道（必须都懂）

### 通道 A：SCF 服务化 versioned-data（按 serviceID/operationID 路由）

- 发布：`m_container->versioned_data__publish_merge_data(serviceID, 0, std::set<versioned_data_id>{opID}, len, buf)`
- 订阅：`subscribe_service(serviceID, opID, ...)`
- 注册服务：`set_service_communicate_topic({interactMode=SCF_SERVICE_INTERACT_MODE_VERSIONED_DATA, regSubType=REGISTER|SUBSCRIBE, reqEvtVdSize=GetTopicSize(sizeof(结构)), reqEvtVdNum=10})`
- SCF 有回环（自己发的能被自己 `versioned_data__updated` 收到）。
- **最小初始化序列**（可照抄）：

```
Init_Protection_Domain
  → Set_Application_ID
  → Set_Platform_Node_Domain_ID(1, Set_Compute_Node_IP("127.0.0.1"), Get_Auto_General_Domain_ID)
  → Set_Cross_Compute_Platform_ID(本平台ID)
  → set_service_communicate_topic...
  → SimpleTriggerModule(25ms) + Component + start_thread
  → INITIALIZE__received(); Sleep(500); START__received()
```

- 骨架样例：各服务 `src\*_main.cpp` + `ModuleImpl\UserInit.cpp`；
  POP 侧等价物 `DataTrans_src\unifiedbackend.cpp::start()`（POP Application_ID=123456689；
  服务各自 `g_App_ID`，如 TDM 927239169）。

### 通道 B：裸 DDS topic（ACI_DDS/TSS601，头 `src\NonService\DDS\TSS601.h`）

```
Initialize("")
  → Create_Connection(topic, PUB_SUB, &id, &dir, &maxMsgSize, 100, &rc)
  → Send_Message / Receive_Message
  → Get_Connection_Id 后收
```

- 方向表 `PART_PCT_TYPE pct[]` 在各服务 `src\NonService\DDS\topics.cpp`，
  条目格式 `{名字, DDS, 方向, "0","0", 65535, 0, 0}`（IP/端口 0 = 由 properties 决定）。

### 统一约定（两侧都必守）

- 所有 ICD 是 `#pragma pack(1)` 定长位域（当前 `LITTLE_ENDIAN_ICD` 分支，头里同时存在 BIG 分支）。
- 发送前 `memcpy(结构→buf)` + `Xxx_EndianChange(buf)` 再发；接收后同函数再来一次还原
  （逐字段交换、**自反**）。
- **报文长度必须等于 `sizeof(结构)`，否则被静默丢弃。**
- **第一步永远先编译一个 sizeof 打印工具固化各结构长度。**

### 通道选择策略（历史实证）

- **裸 topic 通道完全可靠** —— 四服务都同时消费/发布大量裸 topic，
  历史三轮测试（注入、观测、DSU 闭环、DCMII 场景）全部走裸通道成功。
- **SCF versioned-data 直发注入是「待校准项」**：需要 REGISTER 对端订阅的 serviceID
  才能喂 SCF-only 主题（如 `SO_*` 喂 SS）。做 SCF 注入前先用 ACI_DDS 发现日志
  （`discoveredWriter` / `discoveredReader`）验证匹配。

### 已确认的结构长度（以编译为准，此表是快速参考）

```
DSU_VMC_AP_DSU_DATA            76 B
DF_AA_PANORAMA_SITUATION   60012 B
ZZKZSC_EXP_DIS_INFO          742 B
ZZKZSC_SAR_SO_PERIOD_ZII      22 B
ZZKZSC_SAR_SO_EVENT_ZII       76 B
ZZKZSC_DSU_ZII                80 B
ZZKZSC_SMM_ZII                 4 B
DMP_ZZKZSC_DCMII            ≈ 30 B
ZZKZSC_SAR_ACT_CONSTRAINT     54 B
ZZKZSC_MM_STA                204 B
ZZKZSC_STA                     6 B
ZZKZDC_STA                     2 B
DSU_STA                      254 B
TM_ATTACK_LIST_DATA       每目标 14 字（字块最大 Word445）
MISSILE_PANORAMA_SITUATION  推算 20 B（注释写 18，以编译为准）
```

## 4. 服务/操作 ID（两侧 `src\MacroId.h`，GBK 编码）

**MISSIONMANAGEMENT 19599**：INTENTUNDERSTANDING 19600（`ZZKZSC_IU_CMD`）、
EXPLAINABLEDISPLAY 19601（`ZZKZSC_EXP_DIS_INFO`）、SERVICELIFEMSGANDLOGSREPORT 20756（`ZZKZSC_MM_STA`）

**SAFETYADJUDICATIUON 19602**：PRECALIBRATION 19603、POSTCALIBRATION 19604、
SENSORPERIODCONTROL 24307（`SAR_SO_PERIOD_ZII`）、SENSOREVENTCONTROL 24308（`SAR_SO_EVENT_ZII`）、
WEAPONEVENTCONTROL 55555（`SMM_ZII`）

**STATUSSNAPSHOT 19636**：VMCINFORMATION 19637（`SS_VMC_INFO`）、MISSIONINFORMATIONEVENT 24301、
PANORAMASITUATION 24302、MISSIONINFORMATIONPERIOD 24500

**TACTICALDECITIONMAKING 19614**：INTERPRETABLE 19629、MANEUVERDECISION 19631、
SENSORPERIODDECISION 24305、SENSOREVENTDECISION 24306、行为树综合控制 26329

**传感器/武器侧**：AASITUATIONPUBLISH 61/515（`DF_AA_PANORAMA_SITUATION`）、
ATTACKLISTCREATE 75/507（`TM_ATTACK_LIST_DATA`）、TRACKLIST 74/375、ITA 759/762、
SOAESAAADETECTIONCTRL 26（271 周期/272 事件）、SOAESASTATECTRL 25/543、SOGENSER 23（773/775/777）、
SOOESTATECTRL 148（691/692/693/695/696/697/1011/1018）、FCM_STA 11111/22222、
FCM_PL13 33333/44444、FCM_PL16 55555/60000（**与 WEAPONEVENTCONTROL 撞号，日志分析勿混淆**）、
SMM_WEAPON 60001/60002、SMM_WORK 60003/60004

**其他常量**：`SET_DESPLATFORMID_DELAYTIME 3`；`Macros.h`：`DC_SOFT_ID 0x62`、`SC_SOFT_ID 0x61`、
`PERIODIC_200MS_COUNT 8` / `100MS 4` / `30S 1200`

## 5. 注入接口目录

### 5.1 场景与科目（等效 POP 点菜单按钮）

topic `DMP_ZZKZSC_DCMII`（裸 DDS，MM 消费）。结构 `DMP_ZZKZSC_DCMII`（~30B）：
`ValidWord` 11 位 + `SceneCtrlCMD` + `TestCaseCMD{TestCaseSelEn:8, TestCaseTerBool:1}` + 搜索区域 5 个 32 位。

**场景字典**（`SceSelValid=1, SceSelEn=<n>`）：

| n | 场景 | POP 页 |
|---|---|---|
| 0 | 退出 / 未选择 | — |
| 1 | 机动测试 | 100 |
| 2 | 传感器测试 | 101 |
| 3 | 自主飞行 | 103 |
| 4 | 自主探测 | 102 |
| 5 | 自主攻击 | 110 |
| 6 | 全流程空战 | 114 |
| 7 | 全流程 json | 107 |

**科目**（`TestCaseSelValid=1, TestCaseSelEn=<n>`）：

- `1` = 姿态调整
- **机动 16 科目 = 2..17**（稳定平飞/平飞加速/平飞减速/稳定爬升/稳定下降/稳定左转/稳定右转/
  稳定左盘旋/稳定右盘旋/最速爬升/S弯/左上脱离/右下脱离/定向定时过点/修正飞行/组合机动1；
  POP 按钮 `index+2`）
- **传感器区域探测科目**：`18` = 雷达、`19` = 光雷、`20` = 雷达+光雷
- 退出科目再发 `0`

**终止**：`TestCaseTerValid=1, TestCaseTerBool=1`（仅当被测侧 `CurStaEn==3` 测试中才有效）。
**退出场景**：`ZzkzExitValid=1, ZzkzExitBool=1`；飞行员拒绝：`pilotRefuseExit=1`。

**区域参数**（传感器测试前置，POP 页 105-tab 区域探测）：
`startLon` / `startLat` / `endLon` / `endLat`（LSB `1e-7°`）+ `topHeight` / `bottomHeight`（LSB `0.01m`）
+ 各自 Valid → 同 DCMII。

> **DCMII 全字段只有 11 个有效位 + CMD1 + CMD2 + 区域六参**，**没有**时长/速度/高度/转弯量字段。
> 机动参数在 **MM→DSU 的 `ZZKZSC_DSU_ZII` 相位模板**（`sendAction` 硬编码）里。

另一路径（SCF）：`ZZKZSC_POC_EXDISP_INFO{SceSelValid=1,CurStaEn=2}` → 19602/19604（POP `sendSceneSelect`）。

### 5.2 前置条件 / 故障注入 40 种（POP 页 104 `UnifiedBackend::sendTestCondition` 全映射）

| index | 注入 |
|---|---|
| 0/1 | `ZZKZSC_STA.BMscDataManLoadResValid` / `AutoLoadResValid` = 1/0（SC 数据加载成功/失败）。结构 6B：`BMscDataManLoadResEn:2`（0 成功/1 校验失败/…）、`BMscAutoLoadReqEn:2`、`BMabnormalBool` 自主空战异常、`BMzzkzdc_PWL1~16` |
| 2/3 | 同构 `ZZKZDC_STA`（topic `ZZKZDC_STA`，2B） |
| 4-7 | `IAGSM_ICP_RT_ABI_STA_INFO`（`fixdata=2`、`loopSignal[0]=0x62` SC、`[1]=0x61` DC、`FIELD_ENUM_ha2qtwj71pn4`=1 正常/2 异常；4 全正常 / 5 SC异常 / 6 DC异常 / 7 全异常） |
| 8/9/10 | PWL 三按钮 —— **POP 里就是空操作（break），无需测** |
| 11 | HOTAS 手动退出：`DSU_VMC_AP_DSU_DATA{DSUhotasValid=1,DSUhotasEn=1}` 发后 25ms 清零（脉冲） |
| 12/13/14 | `SC_MISSION_STA.AvionicsSysMainMode`=2（时间导航关/开两变体）/=3（拦截模式），topic `SC_MISSION_STA` |
| 15-18 | `ZZKZSC_SS_VMC_INFO`（SCF 19636/19637）预置平飞态：`DSUgammaDeg=600`(3°, LSB 0.01)、`DSUspdUMps=200`(2 m/s)、`DSUbaroAltM=20000`(LSB 0.5)、`DSUcasAirSpdKmph=5000`(500 km/h, LSB 0.1)、`DSUma=40000`(LSB 0.00002)、`DSUflyVmcSta=1`（允许接入自主）、`DSUmaneuverCtrlStaValid=1`、`DSUvmcLimitValid=1`、`DataValid`=(15..17=1, 18=0)；**并追加** `ZZKZSC_SAR_ACT_CONSTRAINT`（SCF 19603 前校准）：`SARflightPreAltAllowMaxM=1200000`/`Min500000`(LSB 0.01 m)、IAS 8000/4000(LSB 0.1)、Ma 50000/30000(LSB 0.00002) |
| 19/20 | `IAGSM_SOFTSWITCHING_NETWORK_STA.field_boolean__38` / `__41` = 1/0（雷达/光雷生命消息有效/无效） |
| 21/22 | `TM_ATTACK_LIST_DATA`：`AAAttackListTarNum=1`/0，`[0]{AATgtID=2, AATgtMissileAttackFlag=2(NTS), AATargetVecVal=1}`（有/无攻击列表） |
| 23/24 | `SC_MISSION_STA.MainWeaponPro=1` + `SMM_WEAPON_STA.m_wpn_synt_state_PL16[0].pl16_missile_available_num=2`/0 |
| 25/26 | `DF_AA_PANORAMA_SITUATION` 单目标 `FuseID=2`/0 + 各 `Valid=1`（任务目标态势有/无） |
| 27-38 | `AW_FULL_PFL` 全机告警（**topic 名是 `DMP_AW_FULL_PWL`**）：五段告警码 `FIELD_FIX_DATA_mhlyjpurnewe..rjjjz3pbfkud` 依次 34001 双惯导/34002 双纯惯/42002 双惯导FC/42032 传感器管理/42033 任务综合/42026 任务通用/42037 空空融合/42029 战术决策/41044 雷达/41052 前向武器制导/42028 火控解算/94001 悬挂物管理；条数 `FIELD_FIX_DATA_270iu62i32vf=1` |
| 39 | `AW_FULL_PFL` 全清零（无全机告警） |

### 5.3 本机 DSU 飞控闭环（POP 页 105 核心 `DataSendDSU`；SS 的第一依赖）

**周期喂** topic `DSU_VMC_AP_DSU_DATA`（76B）：POP 用 12.5ms 高精度线程
（`timeBeginPeriod(1)` + `sleep_until`）；界面周期 {10,25,50,100,200}ms 只作动力学步长。
harness 可 25~50ms 喂。

**机体字段定标**：`DSUspdN/U/E`(0.02 m/s)、`DSUheadPsiDeg`(0.01° 北偏东)、
`DSUlon/latDeg`(1e-7°)、`DSUbaroAltM`(0.5 m)、`DSUcasAirSpdKmph`(0.1 km/h)、`DSUma`(0.00002)、
`DSUmaneuverIdEn:4`（1 停止机动/2 最速爬升/3 速度矢量跟踪/4 S弯/5 转弯到指令高度巡航/
6 定向定时过点/7 智能杆操控/8 自动导航）+ 机动号有效位、
`DSUmaneuverStaEn:3`（1 执行中/2 执行完毕/3 超限保护/5 异常退出/6 正常退出）、
`DSUflyVmcSta`(1=允许接入自主空战)、`DSUvmcLimitEn/Valid`。

**闭环应答规则（被测发→DSU 回，必须复刻）**：收 topic `ZZKZSC_DSU_ZII`（80B，SAR/MM 发布）：

- `ZzkzEntryCMD` → 回进入应答（`DSUentryReqAck`）
- `ZzkzEntryCMD==2` → 进入确认
- `ZzkzExitCMD==1 && ZzkzExitCMDvalid` → 回退出应答
- HOTAS 退出发脉冲后清零
- **无 SS 指令时 5×12.5ms 兜底发默认帧**（清零 DSUZII 后默认态）

`ZZKZSC_DSU_ZII` 还含：`DataValid` 位、`AxisTypeEn`(0 航迹系/1 机体系)、
`TurnDirectEn`(0 自动/1 左/2 右)、`TarMa/Min/MaxMaLimit`(LSB 0.00002)、
`POCtarHeadPsiDeg`/`HeadPsiOffsetDeg`/`TarThetaDeg`(LSB 0.01°)、
智能杆 `mCenterStick[-10,5]`/`mSideStick[-10,10]`/`mThrottle[0,115]`。

**退出链（POP 行为）**：`EXP_DIS_INFO.SceSelEn==0` → DSU 停止；
被击中（对端 `MISSILE_PANORAMA.IsHit` 2→1）自动关 DSU（开 DSU 时复位）。

**机体模型可复用 POP 仓库**：`sim\flight_dynamics`（`fdsim::AirMover`+`Fuel`）或
DLL `V001_fighting_V20261020_ZN`（POP `Exe\` 下有 dll；
模型入参见 POP `ModelParamWidget`：`uCmdID` 0..8、`fCmdSpd/Ma/Alt/Theta/Psi/DelPsi/PsiVd/Oblique/Ny`、
保护限值、定向定时、风扰 `wind[3]`、舵面 `BF[16]`）。

**headless 参考实现**：`headless_main.cpp`（94f20c0f 会话），
DSU 25ms 运动学模型默认初值 6000m/90°/185km/h/42°/123°（LSB 0.5m / 0.01° / 0.1km/h / 1e-7°），
`--ack=on` 置 `Word6=0x60`，`--radar=on` 50ms 发 DF_AA。

### 5.4 态势/传感器真值喂入（等效 POP 雷达模型输出，SS 消费）

topic `DF_AA_PANORAMA_SITUATION`（60012B；SCF 61/515 或裸 topic；喂 SS 的 SCF 通道需验证匹配）。

结构：头 4 字段（`LastBlockFlag`/`MessagePackCount`/`MessageWordCount`/`MessageTimeStamp`）
+ `TargetTotalNum`（≤200）+ 目标数组（每目标 150 字，最大 200 目标）。

关键位域：`Attribute:3`（0 未知/1 敌/2 我/3 友/4 中立/5 民用）、`Altitude` MSB 16384、
`Longitude` MSB π/2（东经正）、`Latitude` MSB π/4（北纬正）、`North/Up/EastVel` MSB 1024、
`Slant` MSB 480000、稳定方位 = 负相对方位、
`TgtShootPara`（2=NTS；**红机选定条件 = `TgtShootParaValid!=0 && TgtShootPara==2` 第一条**）、
`FIELD_ENUM_gmjnd4pqsuzk==1` 导弹、`IsHit:2`（0 NA/1 命中/2 未命中）、`FuseID=id&0xFFFF`、
`AesaIDValid`/`OedeIDValid` 按来源。

假目标样例（POP 机动科目自动补发）：`BMTgtType=3`、lon 31.1789010 / lat 121.4224540、
`BaroAlt 243839999`(×0.001 m)、`BMUas=1`（i∈1-2, 18-25 假目标；26-38 真实飞机 `BMTgtType=1`）。

topic `TM_ATTACK_LIST_DATA`（攻击列表，MM 消费）：每目标 14 字，
字段：`AATgtID`、协同攻击友机编号有效、`AAIsTgtAccuracyMeetDemand`、
`AATgtHeightVal`/`IdentTypeVal`/`DistanceVal`/`SpeedVal`/`TargetVecVal`、
`AFDisTanceVal:2`(A/F 极)、`AAHitProbabilityVal`、`AACaptureProbabilityVal`、
`AATgtModelNoVal`/`TypeVal`/`WeaponTypeMatchVal`、
`attackAreaType:3`（1 六线/2 五线/3 四线/4 七线）、
`Rmax`/`Rmin`/`Racue`/`Rtr`/`Rpi`/`Ropt`/`Raero` 各距离 + 有效位、距离变化率。
**武器包线断言的主数据面。**

**数据库加载类**（DSU 发布，服务裸 topic 消费）：`DSU_WAYPOINT_DB`、`DSU_WAVE_MATCHPOINT_DB`、
`DSU_AIRPORTPOINT_LOAD_DB`、`DSU_AI_RULE_LOAD_DB`（**`blockingStratege` 开关入口**）、
`DSU_AI_MODEL_LOAD_DB`、`DSU_AI_KNOWLEDGE_LOAD_DB`、`DSU_TACAN_INFO`。

加载握手用 `DSU_STA`（254B：`LoadStatus:3` = 0 未加载/1 正在加载/2 结束/3 无法加载、
`ZZKZPLLoadStatus:2`、`DataLoadRate:8` %、VTS/SO/ZZKZPL LoadResp）
+ `ZZKZSC_STA`/`ZZKZDC_STA` 结果回执。

### 5.5 武器链

**FCM_STA**（SCF 11111/22222）装订/程序字段：PL13 有效（`FIELD_BOOL_ziYJu0euIVHG`）、
PL16 有效（`wpnCtrlValid`）、攻击方式切换允许、`attackMode`、`tgtSize`/`tgtRCS`、
弹道/地形类型、`prepState`（PL16 `prepState=4` 条件 =
`PL16PreparationMethodVaildChar && PL16PreparationMethod && PL16ReadyControlCMDValid && PL16ReadyControlCMD==1`）。

**FCM_PL13/PL16_FIRE_CTRL_DATA**（SCF 33333/44444、55555/60000）弹道评估：
发射后 `m_launchedEvalData[0].FIELD_ENUM_LwXnPcUyPask` 飞行=1、命中帧=2；
PL13 对应 `FIELD_ENUM_mOPLi0hD0uis` 等。

**SMM_WORK_STA / SMM_WEAPON_STA**（SCF 60001-60004）投放：
实战 `MainWeaInfo=1` + `{wpn_release_state=2, current_occupy_wpn_id=1, store_leave_state_1=1}`；
演习 `MainWeaInfo=2` + 武器代码 + `pl16_is_sim_launching=1`。

**发射触发链（观测）**：SAR 发 `ZZKZSC_SMM_ZII`（SCF 55555/WEAPONEVENTCONTROL；
4B：`WeaponUnlockCMD:1 + WeaponFireCMD:1`）—— POP 规则 `WeaponFireCMD==1` 连续 ≥3 次
才回发武器状态（**单拍脉冲是正常语义**，`scmSendTwiceZero`）。

**导弹弹道参考**：`DLL_A2AMissile`（POP `View\DemoWidget\MissileSimulator\DLL_A2A.h`，
发射系原点=本机、[北,天,东]；终止 `stateCutOff` 1 超时/2 交错过/3 弹速低/4 相对速度低，
脱靶量 `flagSimRun`）。

### 5.6 传感器 SO 上报喂入（SCF-only，待校准通道）

SCF REGISTER 并 publish：`SO_AESA_DECT_PERIOD_STA`(26/271)、`SO_AESA_DECT_EVENT_STA`(26/272)、
`SO_AESA_PARA_STA`(25/543)、`SO_GEN_STA`(23/773,775,777)、
`SO_OEDE_DECT_EVENT_STA`(148/691,692,693,695,696,697,1011,1018)。

SS 按这些做探测（消费 `DSU_VMC_AP_DSU_DATA`、`NV_PERIOD_DATA`）。

**历史会话未闭环 SCF 直发**；做前先用发现日志验证 writer 匹配，
失败则降级：SS 侧断言只测其已订阅的裸 topic 面。

### 5.7 其他注入辅助（POP 页 111/118）

**页 111 操纵杆**：物理杆 → DSU 报文 `CenterStick[-10,5]`/`SideStick[-10,10]`/`Throttle[0,115]`
+ `ManeuverIdEn=7`（智能杆）；`btn3` HOTAS（= 条件 11 同链）；`js0 btn0` 手动发射导弹。
**无头等价 = 直写 DSU 报文这些字段。**

**页 118 模型参数**：飞控模型 U 指令入参覆盖（`uCmdID`/目标参数/保护限/定向定时过点/风扰/舵面/干扰），
开启后最高优先级覆盖 DSU 报文生成。**机动参数注入面**（页 104/106 给不了这些参数）。