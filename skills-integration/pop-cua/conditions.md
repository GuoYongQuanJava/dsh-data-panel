# 页 104 条件注入全表（40 条报文映射）

> 出处：`DataTrans_src\unifiedbackend.cpp` → `UnifiedBackend::sendTestCondition(int index)`
> （`index` = 按钮 0-based 下标，**界面显示序号 = index + 1**）。
>
> **发送套路**：零清 → 填字段 → 字节序转换 → 发布。
> **这些按钮是「周期发送开关」，激活态在屏幕上看不出来** → 点一次查一次总线/控制台。

## 40 条条件按钮 → 报文映射

| 界面# | idx | 按钮文字 | topic / 结构体 | 写入字段与取值 |
|---|---|---|---|---|
| 1 | 0 | SC_STA 加载结果成功 | `ZZKZSC_STA` | `BMscDataManLoadResValid=1`、`BMscDataManLoadResEn=0`；`BMscDataAutoLoadEn=0` |
| 2 | 1 | SC_STA 加载结果失败 | `ZZKZSC_STA` | 上述两个 `Valid=0` |
| 3 | 2 | DC_STA 加载结果成功 | `ZZKDC_STA` | `BMdcDataManLoadResValid=1`、`BMdcDataAutoLoadResValid=1`（`En=0`） |
| 4 | 3 | DC_STA 加载结果失败 | `ZZKDC_STA` | 两个 `Valid=0` |
| 5 | 4 | SC DC 实时能力状态正常 | `IAGSM_ICP_RT_ABI_STA_INFO` | `field_fixdata=2`；`loop[0]` 软开关 ID `0x62`(SC) 枚举=1；`loop[1]` ID `0x61`(DC) 枚举=1 |
| 6 | 5 | SC 实时能力状态异常 DC 实时能力状态正常 | 同上 | SC=2、DC=1 |
| 7 | 6 | SC 实时能力状态正常 DC 实时能力状态异常 | 同上 | SC=1、DC=2 |
| 8 | 7 | SC DC 实时能力状态异常 | 同上 | SC=2、DC=2 |
| 9 | 8 | PWL 告警 自飞控异常退出 | **不发报文** | `case 8: case 9: case 10: break;` |
| 10 | 9 | PWL 告警 自飞控不可用 | **不发报文** | 同上 |
| 11 | 10 | PWL 无告警 | **不发报文** | 同上 |
| 12 | 11 | 飞行员 HOTAS 杆控手动退出自主空战 | `DSU_VMC_AP_DSU_DATA` | `DSUhotasValid=1`、`DSUhotasEn=1`；**连发 4 拍**（每拍 `Sleep(25)`） |
| 13 | 12 | 处于导航模式，未开启"时间导航"辅助模式 | `SC_MISSION_STA` | `AvionicsSysMainMode=2` |
| 14 | 13 | 处于导航模式，开启"时间导航"辅助模式 | `SC_MISSION_STA` | `AvionicsSysMainMode=2` —— **与 #13 报文完全相同**（`AuxNavModeCmd` 未填） |
| 15 | 14 | 处于拦截模式 | `SC_MISSION_STA` | `AvionicsSysMainMode=3` |
| 16 | 15 | 飞机当前状态满足要求 | `ZZKZSC_SS_VMC_INFO`（走 `STATUSSNAPSHOT_ID`/`VMCINFORMATION_ID`）+ **额外发** `ZZKZSC_SAR_ACT_CONSTRAINT` | 固定喂：横滚 600(=3.00°)、天向速度 200(=2.00m/s)、气压高 20000(=6000m)、表速 5000(=500.0km/h)、Ma 40000；`DSUmaneuverCtrlStaValid=1`、`DSUflyVmcSta=1`、`DSUvmcLimitValid=1`(`En=0` 未进保护)、**`DataValid=0`**；前校准范围：高度 5000-8000、表速 400-800km/h、Ma 0.6-1.0 |
| 17 | 16 | 飞机当前状态不满足要求 | 同上 | 与 #16 **唯一差别是 `DataValid=0`**（横滚/速度/高度仍是那组「满足」值） |
| 18 | 17 | 飞管系统反馈正常 | 同上 | 同上 + **`DataValid=1`** |
| 19 | 18 | 飞管系统反馈异常 | 同上 | 同上 + **`DataValid=0`** |
| 20 | 19 | IA上报雷达及光雷生命消息为有效 | `IAGSM_SOFTSWITCHING_NETWORK_STA` | `field_boolean__38`(光雷)=1、`field_boolean__41`(雷达)=1 |
| 21 | 20 | IA上报雷达及光雷生命消息为无效 | 同上 | 两个位=0 |
| 22 | 21 | 攻击列表目标数目>0 且存在NTS目标 | `TM_ATTACK_LIST_DATA`（`sendTMSITUATION`） | `AAAttackListTarNum=1`；`m_AttackListSingleTarMsg[0]`：`AATgtMissileAtta…`、`AATgtID=2`、`AATargetVecVal=1` |
| 23 | 22 | 攻击列表目标数目=0 | 同上 | `AAAttackListTarNum=0`（**[0] 三个字段仍照填**） |
| 24 | 23 | 有武器且全机可用武器数量大于0 | 先 `SC_MISSION_STA` 再 `SMM_WEAPON_STA`（`sendSMMWEAPONTOSSService`） | `MainWeaponPro=1`（主武器程序=PL16）；`m_wpn_synt_state_PL16[0].pl16_missile_available_num=2`；控制台 `[AUTOA AVAILBLE p1b number is 2` |
| 25 | 24 | 无武器 | 同上 | `available_num=0` |
| 26 | 25 | 任务目标态势有 | `DF_AA_PANORAMA_SITUATION` | `m_PanoSituationInf[0].FuseID=2` + 11 个 Valid 位=1（Altitude/Lat/Lon/DistHoriz/Slant/GoePitch/GoeAzi/StablePitch/StableAzi/Body…） |
| 27 | 26 | 任务目标态势无 | 同上 | `FuseID=0`（11 个 Valid 位**仍=1**） |
| 28 | 27 | 双惯导失效 | `DMP_AW_FULL_PWL`（结构体 `AW_FULL_PFL`） | 告警码 **34001**，按万/千/百/十个拆进 5 个 `FIELD_FIX_DATA_*`；`FIELD_FIX_DATA_270iu62i32vf=1`（告警条数） |
| 29 | 28 | 双纯惯失效 | 同上 | **34002** |
| 30 | 29 | 双惯导FC通信断 | 同上 | **42002** |
| 31 | 30 | 传感器管理失效 | 同上 | **42032** |
| 32 | 31 | 任务综合管理失效 | 同上 | **42033** |
| 33 | 32 | 任务通用管理失效 | 同上 | **42026** |
| 34 | 33 | 空空融合失效 | 同上 | **42037** |
| 35 | 34 | 战术决策失效 | 同上 | **42029** |
| 36 | 35 | 雷达失效 | 同上 | **41044** |
| 37 | 36 | 前向武器制导失效 | 同上 | **41052** |
| 38 | 37 | 火控解算失效 | 同上 | **42028** |
| 39 | 38 | 悬挂物管理失效 | 同上 | **94001** |
| 40 | 39 | 无全机告警信息 | `DMP_AW_FULL_PWL` | **整包全零**（清告警） |

## 告警码 → 会打哪个场景的门

黑名单来自 SS/NS 源码：

| 场景 | PWL 黑名单码 | 页 104 里能造出来的按钮 |
|---|---|---|
| **传感器测试** | 6 码：`34001, 34002, 42002, 42032, 42033, 42026` | #28 #29 #30 #31 #32 #33 |
| **自主探测测试** | 11 码：`34001, 34002, 42027, 42032, 42033, 42026, 42037, 42029, 47022, 41044, 41051` | #28 #29 #31 #32 #33 #34 #35 #36<br>（`42027/47022/41051` 这三个码**页 104 造不出来**） |
| **机动 / 自主飞行** | 共用 **101 项大表**（`21001…94079`） | #28–#39 全部（按大表判定） |

## 源码级坑（本轮新增，全部实测/读码确认）

1. **#9 / #10 / #11 是空操作**
   （PWL 告警 自飞控异常退出 / 自飞控不可用 / PWL 无告警）
   源码 `case 8: case 9: case 10: break;`，只打印 `[TestCondition] 条件测试 #N: …`，**不发任何 DDS**。
   → **要造告警用 #28-#39，要清告警用 #40。**
   → 这也解释了为什么「点了『PWL 无告警』但门还是灰的」：它本来就不发东西。

2. **#13 与 #14 报文相同**（都只发 `AvionicsSysMainMode=2`）
   → 「时间导航辅助模式」开/关**在页 104 点不出来**；
     自主飞行门里那项 `AuxNavModeCmd==0` **只能靠 DSU 侧满足**。

3. **#16/#17/#18/#19 喂的是同一组「满足要求」的 VMC 快照**，唯一变量是 `DataValid`
   （#18=1，其余=0）
   → **想造「姿态/速度不满足」不能靠 #17** —— 它的横滚/速度/高度仍是「满足」值。

4. **#16-#19 每次还会附带发一份 SAR 前校准安全范围**（`ZZKZSC_SAR_ACT_CONSTRAINT`）
   → **做安全约束用例时注意它会被这几个按钮顺手改掉**。

5. **#22（攻击列表=0）虽然把 `AAAttackListTarNum` 置 0，但 `[0]` 元素的三个字段仍按有目标填**
   → 下游若**按下标取值**会看到残留。

6. **越界保护写的是 `index < 0 || index > 40`，而按钮只到 idx39**
   → `idx40` 落到 default，打印 `[sendTestCondition] index=40 未映射`。

7. **条件按钮互覆盖、停发不复位**
   → 航电模式（#13/#14/#15）与状态类条件都是**后点覆盖前点**，**停止发送不会自动复位**。

## 注入顺序（实测定的，顺序错了会白跑）

**传感器测试（场景 2）**：

| 顺序 | 按钮文字 | 界面行# | idx | 对应门原子 |
|---|---|---|---|---|
| ① | PWL 无告警 | #11 | 10 | **必须最先点**：SS 在 PWL 告警激活时每 200ms 重发 `ZZKZSC_STA`（last-wins）会冲掉一次性注入 |
| ② | SC_STA 加载结果成功 | #1 | 0 | `ScLoadRes` |
| ③ | DC_STA 加载结果成功 | #3 | 2 | `DcLoadRes` |
| ④ | SC DC 实时能力状态正常 | #5 | 4 | `DcStatus`/`ScStatus` |
| ⑤ | 处于拦截模式 | #15 | 14 | `checkSensorSceneHighlightedScm`：`AvionicsSysMainMode==3`<br>（#13/#14 是导航模式，**模式互覆盖且停发不复位**） |
| ⑥ | IA上报雷达及光雷生命消息为有效 | #20 | 19 | `checkSensorSceneHighlightedIa`：`field_boolean__38`(光雷)==1 或 `__41`(雷达)==1 |
| ⑦ | 无全机告警信息 | #40 | 39 | 清除历史告警 |

> ⚠️ **①「PWL 无告警」本身不发报文（见坑 1）**
> → 它的作用是「停掉 SS 的重发」这个时序效果，不是靠它注入什么。
> 真实项目里如果第 ① 步点完门还是灰，先查 SS 是不是还在重发告警。

**机动测试（场景 1）**：

| 顺序 | 按钮文字 | 界面行# | 对应门原子 |
|---|---|---|---|
| ① | PWL 无告警 | #11 | 先停 SS 重发；机动 PWL 用**大表**（101 个码）→ 最容易踩 |
| ② | SC_STA 加载结果成功 | #1 | `ScLoadRes` |
| ③ | DC_STA 加载结果成功 | #3 | `DcLoadRes` |
| ④ | SC DC 实时能力状态正常 | #5 | `DcStatus`/`ScStatus` |
| ⑤ | 处于导航模式，未开启"时间导航"辅助模式 | #13 | `isPlaneModeIfNavigation`：`AvionicsSysMainMode==2` |
| ⑥ | 飞机当前状态满足要求 / 飞管系统反馈正常 | #16 / #18 | 喂 `checkPlaneStatusRes` 与飞控反馈所需快照 |
| ⑦ | 无全机告警信息 | #40 | 清除历史告警 |

**自主探测测试（场景 4）**：

| 顺序 | 按钮文字 | 界面行# | 对应门原子 |
|---|---|---|---|
| ① | PWL 无告警 | #11 | 探测 PWL 黑名单 11 个码 |
| ② | SC_STA 加载结果成功 | #1 | `ScLoadRes` |
| ③ | DC_STA 加载结果成功 | #3 | `DcLoadRes` |
| ④ | SC DC 实时能力状态正常 | #5 | `DcStatus`/`ScStatus` |
| ⑤ | IA上报雷达及光雷生命消息为有效 | #20 | `checkSensorSceneHighlightedIa` |
| ⑥ | 处于拦截模式 | #15 | **源码确认必需**：探测门含 `checkScmModeIfIntercept = AvionicsSysMainMode==3` |
| ⑦ | 任务目标态势有 | #26 | `checkTaskParam`：最新全景帧 `FuseIDValid==1` |

> **目标/区域二选一即可**（`checkTaskParam || getSearchAreaConfigured()`）：
> 目标帧，或页 105/DCMII 搜索区六参（`startLon/startLat/endLon/endLat/topHeight/bottomHeight` 六个 Valid 全 1）。

## 编号口径（最容易搞混的一条）

- `condN` = 源码 0-based case 下标
- `#N` = 界面可见行序，**`#N` = `cond(N-1)`**
- **一律按按钮文字点**，不要按序号点

**为什么**：源码里 `arg(i + 1)` 生成显示序号（1-based），而 `case` 判断用 0-based `index`。
两套差 1，按数字点必然错位。