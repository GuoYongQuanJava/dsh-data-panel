# dsh-data-panel

一个给 DeepSeek Harness 用的测试用例台账：

- **对话行新增「面板」标签**，和「对话 / 轨迹 / 工作流」并排。
- **表格列**：用例标识 / 用例名称 / 测试类型 / 测试说明 / 输入 / 预期输出 / 操作。
- **分页**：表格右下角有分页栏，可选每页 5 / 10 / 20 / 50 条，上一页 / 下一页 / 页码。
- **增删改查**：搜索（名称、标识、说明、输入、输出）、按测试类型筛选、新增、编辑、删除。
- **查看代码**：操作列最左侧的「</>」按钮打开用例代码弹窗，可一键复制。
- **点击用例名称 → 右侧栏详情**：右侧栏展示输入、预期输出与代码，可继续编辑或删除。
- **本地持久化**：数据写入 `<DSH_HOME>/plugin-data/dsh-data-panel/records.json`，刷新页面、重启应用都不丢。
- **示例数据**：首次启动写入 7 条示例用例，面板顶部有「示例数据」标识和「清空示例」按钮。

交互参考了 `dsh-genui` 的卡片式面板：克制的标题栏、工具栏、类型 pill、行 hover、右侧详情，不抢对话区的视觉重心。

## 安装

在插件目录执行（把路径换成你的实际路径）：

```powershell
dsh plugin --profile desktop add file:D:/1/dsh-data-panel/dsh-data-panel/package
```

安装完成后**刷新页面**（Ctrl/Cmd + Shift + R），对话行末尾会出现「面板」。

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
<DSH_HOME>/plugin-data/dsh-data-panel/records.json
```

- 默认 `DSH_HOME` 是 `C:\Users\<你>\.dsh`（Windows）或 `~/.dsh`。
- 首次读取不存在时自动创建，并写入 7 条示例用例。
- 写入走「临时文件 + rename」；读到损坏 JSON 时会把原文件改名为 `records.json.corrupt-<时间戳>`，再重建示例数据。
- 旧版本数据文件会改名为 `records.json.v<旧版本>-<时间戳>` 保留（例如记录面板 v1、无代码字段的 v2），然后重建用例数据。
- 所有写操作在 Host 进程内串行化，避免并发覆盖。

## HTTP 接口

Host 半在 `ctx.webServer` 上注册一个同源路由：

```
GET  /data-panel/api
POST /data-panel/api   { "op": "create", "record": { ... } }
POST /data-panel/api   { "op": "update", "id": "rec_…", "patch": { ... } }
POST /data-panel/api   { "op": "delete", "id": "rec_…" }
POST /data-panel/api   { "op": "clearDemo" }
```

返回统一为 `{ ok: true, … }` 或 `{ ok: false, error }`。

## 目录

```
lib/index.js      Host 半：JSON 存储 + /data-panel/api
lib/client.js     Client 半：conversation.view「面板」+ 右侧栏详情
cordis.patch.yml  Bundle 挂载行
```

## 扩展点

- 对话行标签：`ctx.slots.register({ name: 'conversation.view', id: 'data-panel', order: 30 })`
- 右侧栏详情类型：`ctx.sidebarRightTabs.register({ id: 'data-panel-detail', kind: 'data-panel-detail' })`
- 详情正文：`ctx.slots.register({ name: 'sidebar.right.pane.tab', key: 'data-panel-detail' })`
- 打开详情：`ctx.sidebarRight.openTab('data-panel-detail', { params: { id } })`

## 已知边界（v2）

- 表格列和表单字段是固定的；要加列（例如「执行结果」「负责人」）需要同步改 `lib/index.js` 的校验和 `lib/client.js` 的表格与表单。
- 数据是全局一份，不按会话隔离；如果希望每个会话一份，把存储 key 换成 `sessionId` 即可。
- 没有多用户/权限控制；它运行在本机 DSH 进程里，路由绑定在本地 web server 上。
