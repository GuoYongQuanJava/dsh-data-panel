# ZZKZ 坑清单与已知基线

**每次执行前过一遍。** 这些坑都是源码看不见、只在运行时咬人的。

## 1. 坑清单

1. **properties 配置**：`DDS_CONFIG_DOMAIN` / `DDS_CONFIG_IP` 必须一致；
   `(DEVICE_ID, PROCESS_ID)` 必须唯一；探针要在含配置文件的 CWD 启动。
2. **报文长度 = `sizeof` 硬校验**；`EndianChange` 两侧各一次；**全零事件报文被过滤**。
3. **事件主题是单拍脉冲**：断言用窗口捕获，不用瞬时读。
4. **ICD 漂移**：前端（POP）与仿真侧位宽可能不同 ——
   已见例：SAR SO_EVENT 功率开关 2bit vs 前端 1bit；DF_AA 前端版含尾部 15 员扩展；
   SS_MISSION_EVENT 前端 ICD 尾部漂移。**跨端编解码断言前先核对两侧 ICD 文件版本。**
5. **55555 撞号**（`WEAPONEVENTCONTROL` vs `FCM_PL16` server）；
   `versioned_data__updated` 公共 `char buf[9999]` **装不下 DF(60012B)**（case 内另开缓冲）；
   `pct` 的 `max_message_size` 出参未初始化（`Create_Connection` 前显式赋值）。
6. **GBK / cp936**：源码与注释按 GBK 读取；harness 生成源码 ASCII-only 或加 `/utf-8`；
   历史脚本中文注释会乱码。
7. **退化重启**：每轮测试前重启四服务取基线（见 [observation.md](observation.md) §2）。
8. **场景进入链**：见 [scenarios.md](scenarios.md) §0，那里是逐行核实过的完整链条。
9. **非 DPU 环境**：服务若报缺 `USR_getNodeId` / `GET_MASTERSLAVE_MODE` / `INSERT_FAULT` / `GET_SYSTIME`，
   按各服务 `docs\NonDPUImpl` 桩补齐（TDM 见 `docs\非DPU环境的说明.txt`）。
10. **历史坑不要模仿**：`sendTestCaseSelect` 实例曾以 VMC_INFO 内容发 SS_MISSION_EVENT 长度
    （取小截断）——注入器不要照抄。

## 2. 已实测会咬人的运行时坑（都源码不可见）

| 坑 | 现象 | 对策 |
|---|---|---|
| 参与者身份相同 | **自发自收被丢弃** | 工装用独立 ID 段 |
| 源码注释是 GBK | 读取/编辑乱码 | 按 GBK 读写，防中文注释损坏 |
| 大结构体栈上分配 | 栈溢出崩溃 | 改 `static` |
| 工装进程残留 | `LNK1104` 锁文件 | 构建门先杀进程 |
| 中间件日志与协议行粘连 | 解析出错（`...discoTOPIC\|X\|117`） | **取行内最后令牌** |
| 全零事件报文 | 被接收侧 `memcmp` 过滤丢弃 | 不要拿全零帧当「停止」信号，用有效位 |
| 长时运行退化 | 约 1h 后 `EXP_DIS_INFO` 归零、`SAR_PERIOD` 降速 | 每轮前受控重启 |

## 3. 已知缺陷基线（如实报告，勿当回归新增失败）

| 编号 | 现象 | 定性 |
|---|---|---|
| **IT-024** | TDM RingBuffer 覆写，24 条步骤 0ms 即崩（三个会话复现） | **疑似被测缺陷** —— 单独进程隔离跑，报 `CRASH` |
| **IT-026** | 早期用例只注 DCMII，MM 不产入口 `IU_CMD` | **非被测缺陷**：`blockingStratege=0` 时缺 SCM 同意（场景2/4）/ 缺 VMC 应答（场景1/3）是**正常语义**。新用例按 [scenarios.md](scenarios.md) §0 完整链条实施并断言 |

> **MM `entryScene` 的申请分支可观测**：`IU_CMD` 含 `IUsensorEnter` / `IUAutoDetectEnter` /
> `IUsensorExit` / `IUAutoDetectQuit` 位（`NonServer.cpp:461-467/653-656`），
> 观测这些位 + `EXP.ZZKZentryStaDis` 即可判定申请/同意时序。

> **发布退化本身可作 F10 用例**（预期：重启后恢复基线）。

## 4. 现成用例存量（新一轮从存量合并出发，不要从零发明）

| 会话 | 规模 | 结果 |
|---|---|---|
| `session-732e654f` | 12 功能项 / 30 用例 / 71 步 | 权威 run-002 = **68/71**（3 失败见上表） |
| `session-3c776ebb` | 10 功能项 / 25 用例 / 54 步 | run-002 = 53/54 |
| `session-94f20c0f` | 15 用例 / 35 步 + F-002 场景进入深配方 | **从未面板执行** |

**版本索引结构**：

- `case-versions\index.json`（`caseId` `V0_0_1-IT-xxx`、`featureId`/`scenario`/`caseCode`/`title`/`stage`/`expectedResult`）
- `step-versions\index.json`（`stepId`/`caseId`/`stepNo`/`channel`/`target`/`operation`/`expected`/`codeFile`/`exe`/`func`）

## 5. 参考文件索引

### POP 侧（`<POP_ROOT>`，只在需要查发送 API 与字段字典时读，不运行）

| 文件 | 内容 |
|---|---|
| `.dsh-notes\inventory.md` | 带行号全量笔记（若不存在可跳过） |
| `DataTrans_src\unifiedbackend.cpp` | gTopics / pct / 全部发送 API |
| `DataTrans_src\src\MacroId.h` | 服务/操作 ID |
| `View\DemoWidget\SimInfoIcdRows.cpp` | **字段字典（LSB/MSB 权威）** |
| `View\DemoWidget\ManeuverTestWidget.cpp` | 机动科目 UI |
| `DataSendDSU.cpp` | DSU 闭环 |
| `TestConditionWidget.cpp` | 40 条件 |
| `Common\ZmqHub\protocol.h` | ZMQ 协议 |

### 仿真侧（`<PROJECT_ROOT>`）

| 文件 | 内容 |
|---|---|
| 各服务 `src\*_main.cpp` | 框架/用户 topic 注册 |
| 各服务 `ModuleImpl\UserInit.cpp` | 订阅注册 |
| `src\NonService\DDS\topics.cpp` | 裸 topic 表 |
| `src\MacroId.h` | GBK 编码的服务/操作 ID |
| `docs\` | 说明 / 非DPU / 框架新功能 |

### 可复用资产清单

| 资产 | 作用 |
|---|---|
| `tests\harness.h` | `ADDTEST` 注册、`CHECK`、SEH 防崩（`CRASH` 不拖垮批次）、协议行 `RESULT\|<name>\|PASS\|FAIL\|CRASH\|<ms>\|<msg>` + `KV\|<caseId>\|<name>\|<value>`、`argv[1]` 单步过滤 |
| `.dsh\tmp-probe\baseline.cpp` | 22 主题计数基线探针（裸总线权威清单） |
| `session-3c776ebb\...\tests\dds_probe.cpp` | 协议版探针门面 |
| `it_dsu_inject.cpp`（732e654f） | `DSU_VMC_AP_DSU_DATA` 注入 + 环回断言 + 四服务存活（run-002 全绿，证据 `tests\bin\inj_out.txt`） |
| `it_frontend_msgs.cpp` | `put_dcmii(scene)` 场景注入（等效 POP 点场景按钮），解码断言 MM 下游 `IU_CMD`/`EXP_DIS_INFO` |
| `it_codec_{mm,ss,sar,tdm,sar2}.cpp` | 被测服务源码（ICDFT EN/DE、`recieve_rule` 分片重组、RingBuffer、FloatToFix）直接编入测试的白盒集成（37 code 步全绿证明可行） |
| `it_service.py` | 受控启停四服务 + probe 观测 + netstat 断言 |
| `run_all.py` / `run_all_v2.py` | channel（code/service/runner/cmd）分派 → junit + `ACTUAL_JSON` + `SUMMARY\|total=..\|passed=..\|failed=..` |
| `tools\run_tests_py39.py` | 面板执行链（解析 RESULT/KV/junit，退出码 0/1/2/3/130） |
| `headless_main.cpp`（94f20c0f） | 无 Qt 裸 DDS 仿真节点：DSU 25ms 运动学模型（默认初值 6000m/90°/185km/h/42°/123°，LSB 0.5m / 0.01° / 0.1km/h / 1e-7°），`--ack=on` 置 `Word6=0x60`，`--radar=on` 50ms 发 DF_AA；订阅 SAR SO 控制字回记 `node_log.jsonl` |
| `it_codec_*.cpp` 编译模板 | `cl /O2 /MD /EHsc /I <服务>\src\ICD /I <服务>\src\NonService\DDS xx.cpp <服务 ICD *.cpp> ^ /link /LIBPATH:<SAR>\SCF_INSTALL\lib\windows\x86_64 ACI_DDS.lib` |

### 历史文档对账

- `功能项清单_新版.md`（F 编号源）
- `TestCaseList_zzkz_sim.xml`（86 条）
- `TestCaseLibrary_v2.json`（45 条）