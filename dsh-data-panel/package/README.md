# dsh-data-panel

一个给 DeepSeek Harness 用的测试用例台账：

- **对话行新增「面板」按钮**，点击后在右侧栏打开测试用例看板；工作流也可调用 `window.__dshOpenDataPanel()` 自动打开。
- **表格列**：用例标识 / 用例名称 / 测试类型 / 测试说明 / 输入 / 预期输出 / 操作。
- **分页**：表格右下角有分页栏，可选每页 5 / 10 / 20 / 50 条，上一页 / 下一页 / 页码。
- **增删改查**：搜索（名称、标识、说明、输入、输出）、按测试类型筛选、新增、编辑、删除。
- **查看代码**：操作列最左侧的「</>」按钮打开用例代码弹窗，可一键复制。
- **点击用例名称 → 右侧栏详情**：右侧栏展示输入、预期输出与代码，可继续编辑或删除。
- **执行（一键就绪）**：工具栏「全部执行」和每行「执行」会先让宿主**准备这次执行**（导出当前面板用例 → 分配 runId → 生成命令），再把命令预填进**面板所属会话**的输入框。切到对话按回车即可。
- **日志由执行过程自己写**：命令跑的是本插件的 runner（`run_tests.py`），它边跑边把原始输出送到对话，同时写进 `runs/<runId>/run.log`，结束时写 `result.json`（退出码 / 通过失败数 / 耗时 / 超时或中断状态）。不靠模型事后回传，所以不会“对话里有、面板里没有”。
- **查看日志**：每行用例的「日志」按钮看这条用例**最近一次**执行；工具栏「日志」看本会话**最近一次整体**执行。弹窗里同时显示通过与失败数、耗时、runId。没跑过就明确显示「还没有执行过」。
- **查看报告（只读）**：工具栏「报告」列出本会话 `reports/<runId>/` 下已生成的报告与摘要（通过/失败/未执行/未确认），每个文件可**用系统默认程序打开**（Word）。面板只展示，不生成报告 —— 生成走 `bridge.py`，且默认读该次 run 的快照用例。
- **会话资产目录**（项目内，插件**不会**自动写 .gitignore，建议你自己忽略 `.dsh/`）：
  ```
  <项目>/.dsh/test-sessions/<sessionId>/
      cases.json                 本会话用例（执行前从面板导出，示例行不导出）
      tests/test_generated.py    本会话测试代码
      runs/<runId>/request.json  本次执行**冻结**的目标用例与测试函数
      runs/<runId>/run.log       原始输出（边跑边写，不是最后才写）
      runs/<runId>/junit.xml     pytest 结构化结果
      runs/<runId>/result.json   退出码 / 通过失败 / 耗时 / 逐条结果
      runs/<runId>/snapshot/     当次的用例与测试代码快照
      reports/<runId>/           绑定该次 run 的报告
  ```
  执行期间你再改面板，也不会影响已开始的这次执行与报告。
- **按会话持久化**：每个会话一份 `<DSH_HOME>/plugin-data/dsh-data-panel/records-<sessionId>.json`，切换会话各自看到自己的用例；刷新页面、重启应用都不丢。
- **示例数据**：首次启动写入 7 条示例用例，面板顶部有「示例数据」标识和「清空示例」按钮。

交互参考了 `dsh-genui` 的卡片式面板：克制的标题栏、工具栏、类型 pill、行 hover、右侧详情，不抢对话区的视觉重心。

## 安装

在插件目录执行（把路径换成你的实际路径）：

```powershell
dsh plugin --profile desktop add file:D:/1/dsh-data-panel/dsh-data-panel/package
```

安装完成后**刷新页面**（Ctrl/Cmd + Shift + R），对话行末尾会出现「面板」按钮。

> 跨盘安装（工作区在 D 盘、profile 在 C 盘）是复制而不是硬链接：改完 `lib/` 里的代码要重新装一次才生效。

## 使用

1. 打开任意会话，点对话行末尾的「面板」。
2. 点「新增用例」填写用例标识、用例名称、测试类型、测试说明、输入、预期输出、代码。
3. 点表格里的用例名称，在右侧栏查看详情；详情页可以「编辑」「删除」。
4. 操作列：「</>」查看代码、「铅笔」编辑、「垃圾桶」删除（有二次确认）。
5. 表格右下角分页栏可切换每页条数（5 / 10 / 20 / 50）并翻页。
6. 顶部「清空示例」只删除标记为示例的用例，你自己新建/编辑过的内容会保留。

## 数据模型

```ts
type TestCase = {
  id: string                                          // rec_xxxxxxxxxxxx
  caseId: string                                      // 用例标识（≤80，留空时后端生成 TC-xxxxxxxx）
  title: string                                       // 用例名称（必填，≤200）
  testType: 'functional' | 'boundary' | 'performance' | 'exception' | 'compat'
  description: string                                 // 测试说明（≤2000）
  input: string                                       // 输入（≤4000，按换行原样展示）
  expected: string                                    // 预期输出（≤4000，按换行原样展示）
  code: string                                        // 代码（≤20000，代码弹窗里按原样展示）
  demo: boolean                                       // 是否示例数据
  createdAt: string                                   // ISO
  updatedAt: string                                   // ISO
}
```

测试类型的中文标签：功能测试 / 边界测试 / 性能测试 / 异常测试 / 兼容性测试。

## 数据存储

```
<DSH_HOME>/plugin-data/dsh-data-panel/records-<sessionId>.json   每个会话一份（唯一在用）
<DSH_HOME>/plugin-data/dsh-data-panel/logs/<sessionId>/         该会话的执行日志
<DSH_HOME>/plugin-data/dsh-data-panel/records.json                 旧版全局文件（已弃用，仅保留在磁盘）
```

- 默认 `DSH_HOME` 是 `C:\Users\<你>\.dsh`（Windows）或 `~/.dsh`。
- **按会话隔离**：每个会话读写自己的 `records-<sessionId>.json`，文件名里的会话 ID 只保留 `[A-Za-z0-9_-]` 并截断到 120 字符。切换会话看到的就是该会话自己的用例。
- **旧全局文件已弃用**：不再迁移、也不再读取。文件本身留在磁盘上作为历史备份，可以随时手动删除。
- **不带 `sessionId` 的请求会被拒绝**（400），不再回退到任何共享文件。
- **会话 ID 一律可区分**：符合 DSH 格式的直接用；不合法字符会被清洗并**额外拼上原值哈希**，两个不同会话绝不会指向同一个文件。
- 首次读取不存在时自动创建，并写入 7 条示例用例。
- 写入走「临时文件 + rename」；读到损坏 JSON 时会把原文件改名为 `<文件名>.corrupt-<时间戳>`，再重建示例数据。
- 旧版本数据文件会改名为 `.v<旧版本>-<时间戳>` 保留（如记录面板 v1、无代码字段的 v2），然后重建用例数据。
- 读取时容忍 UTF-8 BOM，避免用记事本手改过文件后被当成损坏而隔离。
- 所有写操作在 Host 进程内串行化，避免并发覆盖。

## HTTP 接口

Host 半在 `ctx.webServer` 上注册一个同源路由：

```
GET  /data-panel/api?sessionId=<会话ID>
POST /data-panel/api   { "sessionId": "<会话ID>", "op": "create" | "update" | "delete" | "clearDemo", … }

POST /data-panel/run/prepare  { "sessionId": "<会话ID>", "scope": "case"|"all", "caseId": "TC-001" }
  → { ok, runId, root, command, targetCount, testFileExists, missingTestFunc }
GET  /data-panel/run/latest?sessionId=<会话ID>&cwd=<项目>&scope=case&caseId=TC-001
GET  /data-panel/run/log?sessionId=<会话ID>&cwd=<项目>&runId=<runId>
GET  /data-panel/run/result?…&runId=<runId>
GET  /data-panel/run/report?…[&runId=<runId>]
```

`sessionId` 必填。缺失或为空时接口返回 `400`，不会再回退到任何共享文件。

`sessionId` 决定读写哪个会话的数据文件，它是唯一的数据归属依据。

返回统一为 `{ ok: true, … }` 或 `{ ok: false, error }`。
`run/prepare` 关键行为：

- **项目目录由宿主确定**：使用会话自身的 `header.cwd` / 活跃工作目录，客户端传的 `cwd` 只作为兜底，并校验必须是绝对且存在的目录。
- **命令里不拼用户内容**：用例标识等全部写进 `runs/<runId>/request.json`；命令只含宿主生成的路径与 runId。
- **真正幂等**：测试文件**在原位执行**（不变路径，conftest / `__file__` / `sys.path` 行为不变）；prepare 会记下它的 SHA256，runner 执行前重算，**不一致就拒绝执行**并提示重跑 —— 不会默默跑成另一个版本。用例快照 `runs/<runId>/snapshot/` 仍存一份，供报告与事后复查。
- **快速失败**：本会话没有测试代码、或没有任何可执行目标时直接 `400`，不会再给你自相矛盾的指令。
- **精确执行**：runner 按 ``<测试文件>::<函数名>`` 逐个传，不用 `-k` 名称匹配，不会多跑名称相近的测试。
- **函数存在性校验**：prepare 会检查每个目标函数确实在测试文件里；认不出或找不到的用例计入 `notRun` 并说明原因，不会拿着旧函数名去跑。
- **runId 严格校验**：只允许 `[A-Za-z0-9_-]`，拒绝 `.` / `..` 与路径穿越。
- **资产根不淘汰**：prepare 会把这个会话用过的每个资产目录都记进 `assets-<sessionId>.json`（无上限），切了 working directory 后旧 run 仍能按 runId 找回来。
- **导出用例**：同时把当前面板用例写到 `<会话资产>/cases.json`（示例行不导出）。面板自己不跑 pytest，模型也不回传日志 —— 一切由 runner 边跑边写。
## 目录

```
lib/index.js          Host 半：会话存储 + API + 执行准备/日志读取
lib/client.js         Client 半：「面板」按钮 + 右侧栏看板和详情
assets/run_tests.py   执行器：一次 run 的日志与结果由它产生
cordis.patch.yml      Bundle 挂载行
```
> 旧的 `lib/run.js`（HTTP 触发 pytest 的 `/data-panel/run`）已移除：执行改由 runner 脚本完成，每次执行有独立 runId。

## 扩展点

- 对话行按钮：客户端在会话标签行挂载「面板」入口
- 右侧栏详情类型：`ctx.sidebarRightTabs.register({ id: 'data-panel-detail', kind: 'data-panel-detail' })`
- 详情正文：`ctx.slots.register({ name: 'sidebar.right.pane.tab', key: 'data-panel-detail' })`
- 打开详情：`ctx.sidebarRight.openTab('data-panel-detail', { params: { id } })`

## 已知边界（v2）

- 表格列和表单字段是固定的；要加列（例如「执行结果」「负责人」）需要同步改 `lib/index.js` 的校验和 `lib/client.js` 的表格与表单。
- 客户端在切换会话时会作废仍在飞行中的旧请求（epoch 令牌），旧会话的响应不会覆盖新会话的列表。
- 写入响应回到界面时会核对会话（`mutate`）：如果用户已经切走，就不改当前列表，但数据已经写进它自己的文件。
- 详情页会记住自己属于哪个会话；即使右侧栏保留着旧详情、主区已经切走，它也只读写自己那个会话的记录。
- 会话 ID 还没就绪时面板不发请求，显示「正在取得当前会话」，避免误读共享数据。
- 执行按钮只负责**预填指令**，不自动发送、也不回写执行结果；实际执行与结果由会话里的模型完成。
- 没有多用户/权限控制；它运行在本机 DSH 进程里，路由绑定在本地 web server 上。
