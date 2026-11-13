# dsh-data-panel

一个给 DeepSeek Harness 用的轻量记录面板：

- **对话行新增「面板」标签**，和「对话 / 轨迹 / 工作流」并排。
- **表格增删改查**：搜索、状态筛选、新建、编辑、删除。
- **点击标题 → 右侧栏详情**：右侧栏打开一条记录详情，可继续编辑或删除。
- **本地持久化**：数据写入 `<DSH_HOME>/plugin-data/dsh-data-panel/records.json`，刷新页面、重启应用都不丢。
- **示例数据**：首次启动写入 3 条示例记录，面板顶部有「示例数据」标识和「清空示例」按钮。

交互参考了 `dsh-genui` 的卡片式面板：克制的标题栏、工具栏、状态 pill、行 hover、右侧详情，不抢对话区的视觉重心。

## 安装

在插件目录执行（把路径换成你的实际路径）：

```powershell
dsh plugin --profile desktop add file:C:\Users\雷宇轩\Desktop\ceshi\dsh-data-panel
```

或者直接让 DSH 从本地目录安装：

```powershell
dsh plugin --profile desktop add "file:C:/Users/雷宇轩/Desktop/ceshi/dsh-data-panel"
```

安装完成后**刷新页面**（Ctrl/Cmd + Shift + R），对话行末尾会出现「面板」。

> 本地 `file:` 安装会以硬链接/符号链接方式引用这个目录；移动或删除目录前先 `dsh plugin remove dsh-data-panel`。

## 使用

1. 打开任意会话，点对话行末尾的「面板」。
2. 点「新建」填写标题、分类、负责人、状态、优先级、链接、摘要、内容。
3. 点表格里的标题，在右侧栏查看详情；详情页可以「编辑」「删除」「打开链接」。
4. 表格行右侧的铅笔/垃圾桶可以直接编辑或删除；删除有二次确认。
5. 顶部「清空示例」只删除标记为示例的记录，你自己新建/编辑过的内容会保留。

## 数据模型

```ts
type Record = {
  id: string          // rec_xxxxxxxxxxxx
  title: string       // 标题（必填，≤200）
  category: string    // 分类（≤40，默认「未分类」）
  status: 'todo' | 'doing' | 'done' | 'blocked'
  priority: 'high' | 'medium' | 'low'
  owner: string       // 负责人（≤80）
  url: string         // 可选，仅允许 http/https
  summary: string     // 摘要（≤2000）
  content: string     // 内容（≤20000，按换行原样展示）
  demo: boolean       // 是否示例数据
  createdAt: string   // ISO
  updatedAt: string   // ISO
}
```

分类是自由文本，表单里给了「产品 / 研发 / 设计 / 运营 / 数据 / 市场 / 其他」的候选项。

## 数据存储

```
<DSH_HOME>/plugin-data/dsh-data-panel/records.json
```

- 默认 `DSH_HOME` 是 `C:\Users\<你>\.dsh`（Windows）或 `~/.dsh`。
- 首次读取不存在时自动创建，并写入 3 条示例记录。
- 写入走「临时文件 + rename」；读到损坏 JSON 时会把原文件改名为 `records.json.corrupt-<时间戳>`，再重建示例数据。
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

## 开发与测试

```powershell
# host 存储/接口单测（临时 DSH_HOME，不碰真实数据）
node test/host.test.mjs

# 客户端注册点单测（不渲染）
node test/client-registration.test.mjs

# UI 渲染测试（需要先安装 React）
npm install --prefix .testdeps react@18.3.1 react-dom@18.3.1
node test/render.test.mjs
```

目录：

```
lib/index.js      Host 半：JSON 存储 + /data-panel/api
lib/client.js     Client 半：conversation.view「面板」+ 右侧栏详情
cordis.patch.yml  Bundle 挂载行
test/             单测与渲染测试
```

## 扩展点

- 对话行标签：`ctx.slots.register({ name: 'conversation.view', id: 'data-panel', order: 30 })`
- 右侧栏详情类型：`ctx.sidebarRightTabs.register({ id: 'data-panel-detail', kind: 'data-panel-detail' })`
- 详情正文：`ctx.slots.register({ name: 'sidebar.right.pane.tab', key: 'data-panel-detail' })`
- 打开详情：`ctx.sidebarRight.openTab('data-panel-detail', { params: { id } })`

## 已知边界（v1）

- 表格列和表单字段是固定的；如果要做「列可配置」或换成测试用例/项目字段，需要改 `lib/index.js` 的校验和 `lib/client.js` 的 `RecordFormModal` / `DetailEditor`。
- 数据是全局一份，不按会话隔离；如果希望每个会话一份，把存储 key 换成 `sessionId` 即可。
- 没有多用户/权限控制；它运行在本机 DSH 进程里，路由绑定在本地 web server 上。
- 不做外部数据库连接；如果数据在 SQLite/MySQL 等，优先考虑 `dsh-database-explorer`。
