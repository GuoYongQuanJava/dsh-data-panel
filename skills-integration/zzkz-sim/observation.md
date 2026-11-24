# ZZKZ 观测面（断言从哪读）

Step 5 写断言时读。**本文件只管「从哪读到什么」**，注入见 [injection.md](injection.md)。

## 1. 四服务裸 DDS 发布/消费表（探针订阅 = 服务的订阅面）

### TDM

- **发布**：`APP_LIFE_MSG`、`ZZKZDC_STA`、`APP_SOFTWARE_INFO`、`ZZKZDC_TDM_STA`
- **订阅**：`DSU_STA`、`ZZKZSC_STA`、`IAGSM_ICP_RT_ABI_STA_INFO`、
  `DSU_{AI_RULE,AI_MODEL_LOAD,WAYPOINT,WAVE_MATCHPOINT,AIRPORTPOINT}_*DB`、`DSU_TACAN_INFO`、
  `ZZKZDC_SA_{EVENT,PERIOD}_STA`

### MM

- **发布**：`APP_LIFE_MSG`、`APP_SOFTWARE_INFO`、`ZZKZSC_MM_STA`、**`ZZKZSC_EXP_DIS_INFO`**、
  **`ZZKZSC_IU_CMD`**、`ZZKZSC_DSU_ZII`
- **订阅**：`DSU_VMC_AP_DSU_DATA`、`ZZKZSC_SAR_STA_INFO`、`DSU_STA`、`DSU_AI_RULE_LOAD_DB`、
  `IAGSM_ICP_RT_ABI_STA_INFO`、`DMP_ZZKZSC_DCMII`、`DMP_AW_FULL_PWL`、`ZZKZDC_STA`、
  `ZZKZSC_SS_MISSION_EVENT_INFO`、`MSWM_IMS_PWL`、`SC_MISSION_STA`、
  `IAGSM_SOFTSWITCHING_NETWORK_STA`、`TM_ATTACK_LIST_DATA`、`ZZKZSC_STA`

### SS

- 裸 topic 消费：`DSU_VMC_AP_DSU_DATA`、`NV_PERIOD_DATA`
- SCF 订阅：`SO_OEDE_DECT_EVENT_STA`×9、`SO_AESA_*`、`DF_AA_PANORAMA_SITUATION`、
  `TM_*`、`FCM_*`、`SMM_*`、TDM/SAR `SO_*`、`ZZKZSC_IU_CMD`

### SAR

- **发布**：`ZZKZSC_SAR_EVENT_STA`、`ZZKZSC_SAR_PERIOD_STA`、`ZZKZSC_DSU_ZII`、`ZZKZSC_SAR_SC_ZII`
- **订阅**：`DSU_STA`、`DSU_AI_{KNOWLEDGE,RULE}_LOAD_DB`、`IAGSM_ICP_RT_ABI_STA_INFO`、
  `AW_FULL_PFL`、`MSWM_IMS_PWL`

### SCF 通道各服务发布/订阅（`*_main.cpp` `SetFrameworkTopic`/`SetUserTopic`）

| 服务 | 发布 | 订阅 |
|---|---|---|
| TDM | `ZZKZDC_BT_{EXP_DIS_INFO,MANEUVER_ZII}`、`ZZKZDC_TDM_{SO_PERIOD,SO_EVENT,SC,SMM}_ZII` | `ZZKZSC_IU_CMD`、`SS_VMC_INFO`、`SAR_ACT_CONSTRAINT`、`SS_MISSION_{PERIOD,EVENT}`、`SS_PANORAMA` |
| MM | `ZZKZSC_IU_CMD`、`EXP_DIS_INFO`（+ 框架 `ZZKZSC_MM_STA`） | — |
| SS | `SS_VMC_INFO`、`SS_MISSION_EVENT/PERIOD`、`SS_PANORAMA` | — |
| SAR | `SAR_ACT_CONSTRAINT`(19603)、`POC_EXDISP_INFO`(19604)、`DSU_ZII`、`SAR_SO_{PERIOD,EVENT}_ZII`、`SMM_ZII` | — |

## 2. 速率基线（受控重启后实测）

**10s 窗口**：

| 主题 | 期望帧数 |
|---|---|
| `ZZKZSC_MM_STA` | ≈62 |
| `ZZKZSC_SS_STA` | ≈62 |
| `ZZKZDC_TDM_STA` | ≈62 |
| `ZZKZSC_EXP_DIS_INFO` | ≈197 |
| `ZZKZSC_SAR_PERIOD_STA` | ≈197 |

**3s 窗口**：STA 12–24、`SAR_PERIOD_STA` 40–75。

**★ 事件主题（`IU_CMD` / `DSU_ZII` / `SAR_SC_ZII` / `SAR_EVENT_STA`）静默基线 = 0 是正确语义**
（单拍脉冲），断言要窗口化捕获跳变，**不要用瞬时读**。

**netstat**：每服务 UDP 端点 ≥3。

**★ 退化观察（必须内置对策）**：连续运行约 **1h** 后 `EXP_DIS_INFO` 可能归零、`SAR_PERIOD` 降速。
**每轮测试前受控重启四服务再取基线。**

## 3. 关键观测结构

### `ZZKZSC_EXP_DIS_INFO`（742B，MM 发）＝ 场景/科目主判据面

- `SceSelValid` / `SceSelEn`（**==0 表示场景已结束/自动返回**）
- **`CurStaEn` 全字典**（ICD `ZZKZSC_EXP_DIS_INFO.h:198`）：

  | 值 | 含义 |
  |---|---|
  | 0 | 无效 |
  | 1 | 姿态调整 |
  | 2 | 准备测试 |
  | 3 | 正在测试 |
  | 4 | 测试完毕 |
  | 5 | 接管飞机 |
  | 6 | 运行异常 |
  | 7 | 智能保护 AI |
  | 8 | 飞控保护 |

  > **2/3/4 由 POC 回写产生，MM 只置 5/6/7/8。**

- 16 科目按钮三态 `*ButtonDis`（0 灰不可进 / 1 可进 / 2 执行中；
  `ManeuverTestButtonDis`/`SensorTestButtonDis`/`AutoDectButtonDis`/`AutoFlyButtonDis`/`AutoAttackButtonDis`
  还控制 POP 菜单置灰）
- 测试时长 / 速度 / 高度 / 航迹偏向 / 斜距 / 转弯方向 / 期望时间
- 速度高度保护 / 当前 G / 油门类型 / 期望坐标 `TarLonDeg`（×1e-7）
- `TipDialogInfoValid` / `TipDialogInfoEn`（弹窗请求，**MM 侧字典 1..7** 见 [scenarios.md](scenarios.md)）
- `curDetectTar`(1 区域/2 目标) / `curSensor`(1 雷达/2 光雷/3 双) /
  `detectConcealLevel`(1 无源/2 隐蔽/3 有源) / `detectIntent`(1 搜索/2 跟踪/3 攻击制导/4 再截获)
- `ExplainableInfoWord1..5`（各 50×UT16 **GBK** 行为文案）

### `ZZKZSC_IU_CMD`（~36B，MM 发）＝ 指令回执

- `SceSelActValid` / `SceSelValid`、`SceSelEn`（同上字典）
- `ZzkzExitBool`（=1 要求退出）
- `TestCaseSelEn` / `TestCaseTerBool`
- `IUzzkzEnterExitMission`、`IUzzkzEntryValidFlag`（=2 有效）
- 搜索区域六参、`SAdataLoadStaValid` / `Info`
- **申请位**：`IUsensorEnter` / `IUAutoDetectEnter` / `IUsensorExit` / `IUAutoDetectQuit`
  （观测这些位 + `EXP.ZZKZentryStaDis` 即可判定申请/同意时序）

### `ZZKZSC_SAR_SO_PERIOD_ZII`(22B) / `EVENT_ZII`(76B)（SAR 发）＝ 传感器控制指令

- 主/辅区方位俯仰搜索中心（ST16 rad，MSB π/2）+ 4 有效位、光雷前后向中心
- EVENT 含辐射管理（`RadiationControl` 0 自动/1 手动、`RadiationLevel`）、雷达模式、
  `AESAInterferenceTargetId`、`AESATargetLockSet`、前后向光电探测控制、
  电子战（`FrontActiveJammingSelection` 等、`JammingRadiationControlResponse` 0 NA/1 辐射/2 静默）

**字典**：

| 维度 | 取值 |
|---|---|
| 方位宽 | 1..4 = ±10/30/60/110° |
| 俯仰宽 | 1..4 = ±1/1.5/2/4°（5/6 顶/底保持；光雷多 5=±180 全向） |
| 量程 | 1..11 = 20..640 km |
| 待机 | 1=关 2=开 |
| 辅区开关 | 锁存 |
| 0 | NA，沿用上一拍 |

> 「光雷方位中心限幅 ±60°」发生在 **POP RadarSimulator 接收换算**，不是 SAR 输出限幅
> —— SAR 输出侧框架角约束在 19603。
>
> **注入全零事件报文会被 POP 接收侧 `memcmp` 过滤丢弃**（POP 行为）。
> SAR 无新指令时会**重发缓存值**（SAR Impl:766-786），观测面为**周期电平流**。

### 其他关键结构

- `ZZKZSC_SAR_SC_ZII`(48B) 武器程序
- `ZZKZSC_DSU_ZII`(80B) 智能杆指令
- `ZZKZSC_SMM_ZII`(4B) 武器事件
- `ZZKZSC_MM_STA`(204B)：MMserverID、生命消息计数、20 槽日志
  `{MMtimeLabel(LSB 20)、MMlogLevel:2(1 INFO/2 WARN/3 ERROR)、MMlogCode:5}`
- `APP_LIFE_MSG`(3B)：`LifeInfo:1`、`SoftID`/`LRUID`/`DevID`/`SubSysID`/`SysID` 软件编码层级

> **字段级数值字典**：POP 的 `View\DemoWidget\SimInfoIcdRows.cpp`
> （由 `tools/icd_rows.awk` 从 ICD GBK 注释生成）＝ 全部 ICD 字段名/含义/LSB-MSB 的权威清单，
> **写断言先查它**。

## 4. 退出协议（每条用例收尾必做，否则污染下一轮）

```
① 发 ZzkzExitBool=1（DCMII）
② 等 IU_CMD 确认 或 EXP_DIS_INFO.SceSelValid / SceSelEn == 0
③ 场景复位
④ 每用例结束校验事件主题回落到 0
```

- **科目终止**仅在 `CurStaEn==3` 时有效。
- 复位靠 POC（自然全 0 或注入 `{SceSelValid=0}`）。

## 5. POP 平台自身的输出面（仅测 POP 时用，不属于被测仿真）

### ZMQ 汇聚（POP ↔ POP）

- 上行 5599 PUSH → PULL、下行 5598 PUB → SUB，客户端 id = 本机 IPv4、500ms 广播 Aggregate
- `typeTag`：0x1001 VMC / 0x1002 告警（`OwnDetectedId`）/ 0x1003 合并（`AlarmStatusMap`）/
  0x1004 导弹（`MISSILE_PANORAMA`）
- 线格式：`MAGIC 0x485A4D53 | ver | u16 idlen | id | f32 value | u64 tsMs | u16 type | u16 payloadlen | payload`，
  `payload ≤ 65535`

### TacView

- TCP 42674（仅回环、单客户端）+ 落盘 `Exe\ALL_ACMI\*.acmi`
- 波束行 `RadarMode`/`RadarAzimuth`（取负）/`RadarRange`/`Beamwidth` 可断言
- 本机 id=1、目标=IP 末段、导弹 0x8000 段、锚点 9000-9003

### RadarSimulator 内部模型规则（POP 行为，非被测，可作 harness 输入生成器）

- **导弹告警** = 白态势敌/未知属性导弹真三维斜距 < **15000 m**
- **被击中** = 对端导弹 `FIELD_ENUM_gmjnd4pqsuzk==1` 且 **`IsHit` 2→1 跳变**

> 这些是 POP 模型判据，**harness 按规则生成 DF 输入，而不是断言它们**。