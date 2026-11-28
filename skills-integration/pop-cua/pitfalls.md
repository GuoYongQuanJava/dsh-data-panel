# POP 集成测试坑清单 + 真实排查案例

> 每次执行前过一遍。前半是「跨场景复用的坑」，后半是一个**完整排查案例**
> （场景自动退出与按钮闪烁）—— 那个案例里有两个机制值得所有 GUI 用例记住。

## 一、跨场景通用坑清单

### 1. UIA 与定位

1. **主窗口标准控件 UIA 全暴露**（按 [uia-fix.md](uia-fix.md) 修复后，树 ≥118 节点、
   `Name`=按钮文字、`AutomationId`=objectName；场景页同样全暴露）。
   **标准路**：`get_window_state`（无截图）→ `element_token`/`AutomationId` invoke
   → `verify_state` 断言 `enabled`；截图只作存证，**不用于定位**。

2. **不在树里的三处**（必须认清，否则会写出假证据）：
   平显 HUD 自绘页、页 119 字段行、108/109 雷达圆弧
   → 这些用**源码级基线**（[pages.md](pages.md) / [conditions.md](conditions.md)）或截图。

3. **`QT_ACCESSIBILITY=1` 已实测无效**（根因是布局挂父，见 [uia-fix.md](uia-fix.md) §1）。
   不要再试这个环境变量。

### 2. CUA 会话与截图

4. **一个 CUA session 标签用到底，收尾 `end_session`**。
   混用会出现**两个光标覆盖层** + 跨会话截图帧拒绝。

5. **`get_window_state` 带 `screenshot_out_file` 时不注册像素帧**
   → 同批像素步骤报 `No screenshot frame…`，**原批次重发一次即成**（不是失败）。

6. **窗口最小化后读到的元素在解析时会被判定 stale**
   → 先恢复窗口再操作；**最小化后 UIA 空树、点击被拒**。

### 3. 断言优先级（照这个顺序取证据）

```
verify_state（Name 精确文字 + enabled）
  → get_window_state 树行
    → MM 控制台字符串
      → 截图
```

> **截图是最后的、最弱的一层。** 只用截图当证据 = 无法复现 = 假证据。

### 4. 节奏（判断超时，别瞎等）

7. **MM 25ms 一拍**（`allButtonEnableMonitor → SceneMonitor → hasEnterSceneMonitor
   → exitInternal → errorControl → sendDmpExpDisInfo`，MM:113-128）
8. **菜单 1s 刷新**；**SS 镜像 ~1s** → 断言窗口 **≥3s**
9. **tip30s = 1200 拍 = 30s**（但只在退出条件命中后才起表）

### 5. 状态语义（最容易写错结论的地方）

10. **模式与状态互覆盖、停发不复位**
    → 切航电模式**必须主动点目标模式按钮**，不能指望它自己恢复

11. **控制台文案不可按字面读**
    - `ManeuverOtherExp` 那行的**第一个实参其实是 `pwlWarningManTest`**（MM:270）
    - 出现 `------pdata is null or length error------` = **ICD 长度不符 / 版本漂移信号**

12. **命名陷阱**
    - `m_hasEnteredDetectTestScene` = **传感器**场景（不是探测）
    - 旧文档函数名 `checkScnModelIfIntercept` 源码实名 `checkSensorSceneHighlightedScm`

13. **只操作本轮确认的 POP/服务实例，不按 exe 名清理进程**
    → 同名进程可能属于别人的测试床

14. **场景互斥**：任一场景 `state=2` 期间其余三个按钮强制 0，且不再评估其进入门（MM:295-350）；
    **科目互斥**同理（MM:149-163）
    → 「我只点一个场景，另外三个变灰」是正常行为

### 6. 页面守卫（这个坑会毁掉整批用例）

15. **只有传感器页（101）与自主探测页（102）有 50ms 页面守卫**
    → 进页后若 `EXP.SceSelValid == 0`，**数秒内自动退回菜单**
    → 机动（100）/自主飞行（103）**没有**这个守卫，进去不会自杀

16. **守卫在「EXP 完全收不到」时失效**（开头 `if (!backend || !isExpDisInfoValid()) return;`）
    → 停 MM 后页面不会被踢，**但也进不去**（点亮按钮同样靠 EXP）
    → **「停 MM」不是可用的测试路径**

17. **进场景要 ≤1.5s 内批量点科目组**（雷达=18 / 光雷=19 / 混合=20）
    → 用 `run_steps` 单批完成，间隔超了科目就点不上了

### 7. 重启

18. **重启必删 `DDS_increment_seq.txt`**
    → 不删则 DDS 序号接着上次涨，下游按序号判断的用例全部错乱

19. **重启 MM 会丢失条件发送/装载门锁**（`DcLoadRes`/`ScLoadRes`）
    → 菜单钮转恒灰 → **需补一轮条件发送才恢复**

20. **重启 DSU 只恢复 `DataValid`**，不恢复 `trackPsiValid/lonValid/latValid/baroAltValid`
    → VMC 五 valid 位不全时**必须整机重启**，不是重启 DSU

### 8. 其他 POP 特有

21. **108/109 是单向门**（无返回按钮）→ **放到最后开，或开在牺牲区**
22. **弹窗永不过期**（时效计数失效）→ 必须点掉，不能等它消失
23. **切布局 = 全部区域与页面重建**，已开页面和 DSU 发送线程都会消失
24. **页 106 的「使能」勾选框在文字左侧，点文字无效** → 要点框本身
25. **页 104 的显示序号 1-based，源码下标 0-based（差 1）** → 按按钮文字点，别按数字
26. **切成英文后所有按钮 Name 变英文** → 中文 Name 全部失效，测完记得切回

## 二、真实排查案例：场景自动退出与按钮闪烁

> 排查时间：2026-11-28（16:4x-17:4x）。
> 对象：POP（UIA 改版）+ 部署版 MM + 源码参照。
>
> **结论先行**：这不是崩溃、不是 CUA 操作方式问题，是
> **POP 页面守卫 + MM 确认链断链 + 门控逐拍抖动**三个机制叠加的结果；
> 传感器与自主探测同因同机制，机动/自主飞行没有页内守卫、不受「进页被踢」影响。

### 2.1 现象

| 现象 | 触发 | 说明 |
|---|---|---|
| 进入传感器测试/自主探测页后**数秒自动退回菜单** | 人工点击、CUA `element_token` Invoke **都一样** | 不是崩溃；是**页面自己发「返回菜单」信号并 close** |
| 菜单按钮「传感器测试/自主探测测试」**灰亮交替**（「一会灰一会亮」） | **无人操作时也发生** | 与进入/退出无关，**纯显示状态振荡** |
| 停掉 MM 后按钮**恒灰** | 演示实验 | 按钮点亮本身**也依赖 MM 的周期消息** |

### 2.2 直接触发者：POP 页内 50ms 守卫（只有两处）

全 POP 工程 `SceSelValid == 0` 自动退出守卫**仅存在于两个页面**：

| 页面 | 位置 | 守卫代码（两处逐字相同，连注释都相同） |
|---|---|---|
| 传感器测试 | `View\DemoWidget\SensorTestWidget.cpp:1039-1049` | 见下 |
| 自主探测 | `View\DemoWidget\AutoDetectTestWidget.cpp:245-255` | 见下 |

```cpp
// onTimerUpdate()（50ms 定时器）开头：
if (!backend || !backend->isExpDisInfoValid()) return;  // EXP 收不到 → 守卫整体失效
const ZZKZSC_EXP_DIS_INFO* info = backend->getExpDisInfo();
...
// 退出条件：SceSelValid 为 0 时，自动返回上一级
if (info->SceSelValid == 0)
{
    qDebug()<<"退出条件: SceSelValid 为 0 时，自动返回上一级";
    if (m_timer) m_timer->stop();        // 先停表，否则父级 delete 后 tick 访问已析构成员会崩
    emit signalReturnToMenu();          // 父级 CViewArea::slotReturnToMenu 会 delete 本控件
    close();
    return;
}
```

**要点**：

- 判据是后端 DDS 消息 `ZZKZSC_EXP_DIS_INFO`（简称 EXP）的 **`SceSelValid` 字段**（场景确认），
  **不是点击、不是坐标、不是 UIA**
- EXP 完全收不到时守卫失效（开头 `return`）—— 这是「停 MM 后页面不会被踢」的原因
- 机动（`ManeuverTestWidget`）、自主飞行（`AutoFlyTestWidget`）**没有这个守卫**：
  进去不会自杀（其场景确认链同样断，只是页面不看该字段）

### 2.3 为什么 `SceSelValid` 恒 0：确认链断在两个没运行的进程上

点击菜单钮时 POP 发的**是一次性申请**（不是周期、不是确认）：

- `View\ViewMenu\ViewMenu.cpp:289/311` `slotMenuClicked`：
  plugin 101→`DCMII(SceSelValid=1, SceSelEn=2)`（传感器），
  plugin 102→`DCMII(SceSelValid=1, SceSelEn=4)`（自主探测），
  plugin 100→`SceSelEn=1`（机动）

MM 收到申请后要**走完两站**才会确认字段变 1：

```
POP —DCMII(一次性)—▶ MM
站1 SCM 同意：entryScene → sendApplyEnterToScm → 等 SC_MISSION_STA.zsmZ4N3NZ90k==1
  （MissionManagementImpl.cpp:526-531；NonServer.cpp:1382/1413）
  ⚠ SC_MISSION_STA 的发送方是外部 SC(SCM) 进程 — 本机没跑（MM/SS 均只订阅）
站2 POC 确认：MM 的 m_disInfo.SceSelValid 只能由 POC 进程回发的 POC_EXDISP_INFO
  整包 memcpy 写入（NonServer.cpp:955-971 setPocInfoToDisInfo）
  ⚠ 部署版 MM 自己从不写该字段（全 NonServer.cpp 仅 :393 读 DCMII）
MM —EXP_DIS_INFO(周期，每拍)—▶ POP  ← 唯一发布者就是 MM，没有第二家
```

**本机进程实况**：在跑的只有 `ZZKZSC_MM / ZZKZSC_SS / ZZKZDC_TDM / ZZKZSC_SAR`。
**SC(SCM) 与 POC 没有运行**，全盘也找不到 POC exe → 两站全断
→ MM 周期广播的 EXP 里 `SceSelValid` **恒 0** → **进页数秒内必被踢**。

### 2.4 灰亮交替的真相：不是两方打架，是门控输入逐拍抖动

- `EXP_DIS_INFO` **全系统只有 MM 一个发布者**；DCMII 是一次性。
  **没有任何人周期发 `SceSelValid=1`**。
- 菜单钮亮/灰看的是 EXP 的**另一个字段** `SensorTestButtonDis`（0 灰/1 亮/2 执行中），
  由 MM 每拍重算门控公式写入（`setSensorTestSceneButtonSta`，NS:1167）。
- 传感器门控（部署版 MM:383-401）：

```cpp
if (DcLoadRes && ScLoadRes &&          // DC/SC 装载具备 ← "条件发送"推的就是这些
    DcStatus && ScStatus &&            // DC/SC 生命消息活着（未拍收到才 true）
    checkScmModeIfIntercept &&         // 拦截模式
    pwlWarningSensorTest &&            // 无 PWL 告警
    b_checkVMInfo &&                   // 飞控(VMC)信息
    checkSensorSceneIaLifeMessage &&   // IA 生命有效
    !checkSceneExitCondition(SENSOR_TEST_SCENE))  // 无场景退出条件命中
    setSensorTestSceneButtonSta(1);    // 亮
else setSensorTestSceneButtonSta(0);   // 灰
```

- 自主探测门控（403-418）结构相同，多一路**易抖输入**：
  `(checkTaskParam || getSearchAreaConfigured())`，PWL 类型为 `AUTO_DEC`。
- **抖动机制**：`clearRecvTopicVaild()`（NS:103-116）**每一拍把全部「消息有效」位清 0**，
  本拍收到才置 1。仿真服务（SAR/TDM）的发送周期与 MM 的拍周期接近或有 jitter 时，
  `DcStatus`/`ScStatus`/IA生命/VMC 这些布尔**逐拍翻转**
  → 门控输出逐拍 `1→0→1` → POP 每拍重绘 → 肉眼「灰一下又亮回来」。
- `checkSceneExitCondition`（NS:1699-1731，含 IA 生命无效、SCM 异常等）命中同样置灰。
- **若场景真正确认（需站2）**，钮会置 2（执行中）且其余三场景强制置 0（互斥段 293-353）
  —— **本机走不到这条**。

### 2.5 两字段模型（一句话记住）

> **进页看钮亮**（门控字段 `SensorTestButtonDis`，**不依赖 POC/SC**），
> **驻留看确认字段**（`SceSelValid`，**只有 POC 会写 1**）
> ——两个字段在同一条 EXP 消息里、**互相独立**。
> 所以「能进、几秒被踢、还能再进」完全自洽；
> 「灰亮交替」是门控输入按拍抖动，**不是谁在反复激活场景**。

### 2.6 实测记录

| 时间 | 操作/观察 | 结果 |
|---|---|---|
| 16:4x | UIA Invoke 进传感器页（旧 MM 在跑，按钮 `enabled=true`） | 进页成功，**树 142→201**（整页含参数表全暴露）；随后被踢回，复现「几秒自动退出」 |
| 17:00 | 停 MM + 重启 POP 演示「守卫失效」 | EXP 收不到 → 守卫早退不踢页；**但菜单钮 `enabled=false` 进不去**（点亮也靠 EXP）→ **停 MM 不是可用测试路径**（CUA 直接拒绝 Invoke disabled 钮） |
| 17:00:36 | 重启 MM | **副作用**：新 MM 丢失此前条件发送/装载门锁（`DcLoadRes`/`ScLoadRes` 输入），菜单钮转恒灰；需补一轮条件发送才恢复「亮→进→被踢」循环 |
| 17:1x | UIA **逐秒采样**「传感器测试」钮 20 次（两个区域） | `99,99,...,99` 恒灰——与「MM 重启丢门锁」判断一致，同时**证明钮状态可被 UIA 稳定读取** |
| 全程 | MM 门控调试 LOG（源码 269-273 有逐拍打印） | **未落盘**（运行目录无 MM 日志文件），未能直接抓抖动机位 |

### 2.7 解决方案（按推荐排序）

| 方案 | 做法 | 优点 | 缺点 |
|---|---|---|---|
| **A. 起全链** | 找到并运行 **SC(SCM) + POC** 两个进程（原测试床有；位置需向环境负责人确认，可能在另一 DDS 域机器） | **真实协议行为**，门控/确认/tip30s 全是真的 | 依赖外部程序；本机全盘无 POC exe |
| **B. headless 模拟（UI 自动化推荐）** | 停 MM；写小 DDS 发布器周期发 `ZZKZSC_EXP_DIS_INFO`：<br>`SceSelValid=1` + `SensorTestButtonDis=1` + `AutoDetectButtonDis=1` + AESA/OEDE/combine ButtonDis=1，弹窗/参数字段按需。<br>**一帧同时喂饱两页守卫与钮**，参数表数值可遥控做断言 | 页面常驻、状态确定、**无抖动**；复用 `it_runner` 注入骨架 | 测的是「POP 对消息的反应」，**不覆盖 MM 内部逻辑** |
| C. 测试专用 POP 构建 | 注释 `SensorTestWidget.cpp:1039-1049` 与 `AutoDetectTestWidget.cpp:245-255` 两处守卫 | 改动最小 | **失去「异常自动退出链」这一被测功能的验证能力** |

### 2.8 对自动化测试的三条硬建议

1. **不要拿菜单钮亮/灰做基线断言** —— 它会抖；
   要断言就 `verify_state` 读 `enabled`，或读 DDS 字段值。
2. **进景页后立即读 UIA 树**（守卫 50ms 一拍，几秒内会踢）；
   首次 Invoke 后 `observe` 可能抢在插件 widget 创建前，**读到旧树要补读一次**。
3. **即便确认成功，本机环境 `checkSceneExitCondition` 进入即命中**
   → tip30s 30 秒强制退出（传感器/自主探测**取消也不停表**）
   → **进场景要 ≤1.5s 内批量点科目组**（雷达=18 / 光雷=19 / 混合=20）。

### 2.9 这个案例能带走的两条方法论

> ① **「能进」和「驻留」是两个字段、两套机制。**
> 遇到「进去就掉」，先问：是页面守卫主动退（看 `SceSelValid`），
> 还是我点错了/按钮灰了（看 `*ButtonDis`）？**不要一律写成「崩溃」。**
>
> ② **「状态闪烁」优先怀疑输入抖动，而不是「谁在打架」。**
> 每个周期把「消息有效位」清零重算的系统，输入端 jitter 必然传到输出端。
> 判断方法：看有没有**唯一发布者**。有唯一发布者 + 无人周期写该字段
> → 振荡一定来自输入侧，不是多个写者冲突。