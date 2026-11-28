# Qt 5.14 无障碍（UIA）修复指南

> **什么时候读这份**：`get_window_state` 读出来的元素数只有个位数（5-8 个），
> 菜单按钮/页面控件全部读不到 → 说明这个构建没做过 UIA 修复。
>
> **不要在这种情况下退回截图猜坐标** —— 那会产出无法复现的假证据。
> 正确做法：明确报告构建未修复，给出修复方法，把相关用例标 `blocked`。

## 1. 问题与根因

### 现象

被测程序进入布局（如 `MFD_WM`）后，Windows 无障碍树（UIA）里只有窗口标题栏和
`CMainWindow → QGraphicsView → 空 Group`，共 **5-8 个元素**；
所有菜单按钮、翻页按钮、返回按钮对 UIA / 屏幕阅读器 / CUA **完全隐形**，
自动化只能靠截图找坐标点击（慢、不准、丢点）。

### 根因

**Qt 5.14.2 的 UIA 桥不枚举 `QGraphicsView` 下的子 `QWidget`。**

而 `MainWindow.cpp` 的 `switchToLayout()` 把整个布局树创建在 `ui->graphicsView` 之下：

```cpp
mp_view_layout = new CViewLayoutMfdWM(ui->graphicsView);  // ← 挂错父级
```

### 对照证据（为什么能确定是这个原因）

同一程序里首页 `HomeScreen` 挂在 `CMainWindow` 下（`new QWidget(this)`），
它的 7 个按钮在 UIA 里**完整暴露**（18 元素树）
—— **同一个 Qt 桥，挂对父级就全部可见。**

### 已排除的路线

- **`QT_ACCESSIBILITY=1` 无效**：该 exe 的无障碍桥本就激活，A/B 实测带不带完全一致
- **不需要任何 `setAccessibleName` 代码**：`Name` 来自 `QPushButton` 的 `text()`

## 2. 改动内容（唯一改动点）

**文件**：`View/MainWindow/MainWindow.cpp`，函数 `switchToLayout()`

把所有创建布局分支的 `parent` 从 `ui->graphicsView` 改为 `this`（`CMainWindow`）：

```cpp
// 改前（本工程共 10 处，每个版本分支一处）
mp_view_layout = new CViewLayoutHud(ui->graphicsView);
mp_view_layout = new CViewLayoutMfd(ui->graphicsView);
mp_view_layout = new CViewLayoutMfdWM(ui->graphicsView);
mp_view_layout = new CViewLayoutUFCP(ui->graphicsView);
mp_view_layout = new CViewLayoutMfdWM(ui->graphicsView);   // 176_WM
mp_view_layout = new CViewLayoutUFCP(ui->graphicsView);   // GC_MFD
mp_view_layout = new CViewLayoutMfd176Down(ui->graphicsView);
mp_view_layout = new CViewLayoutMfd2XXBiCe(ui->graphicsView);
mp_view_layout = new CViewLayoutMfdWMBiCe(ui->graphicsView);
mp_view_layout = new CViewLayoutMfdCommon(ui->graphicsView); // default

// 改后
mp_view_layout = new CViewLayoutHud(this);
...（同样 10 处，只换第二个参数）
```

**定位方法**：在工程里 `grep -n "new CViewLayout"` 或 `grep -n "ui->graphicsView"`，
改到的应当**恰好**是这些创建行。

### 不要动的东西

| 不要动 | 为什么 |
|---|---|
| `ViewArea` 内部自建的 `mp_graphicsView`（`ViewAreaViewHud.cpp` / `ViewAreaMfd.cpp` 里的 `new QGraphicsView(this)`） | 那是每块显示区域的**背景画布**，parent 本来就是 `ViewArea`，保持原样 |
| 按钮自己的 parent 链（`m_btn_menu → CMenuButton → CViewMenu → CViewArea → CViewLayout`） | **一概不碰** |

> 只改 `ViewLayout ↔ CMainWindow` 这**一条父子边**。

## 3. 改前安全检查（3 条 grep，其他工程必做）

| 检查 | 命令意图 | 本工程结果 |
|---|---|---|
| 有没有代码依赖「布局在 `graphicsView` 下面」 | `grep "graphicsView->children\|graphicsView->findChild"` | **0 处** |
| 有没有代码往主窗口 scene 放交互项 | `grep "ui->graphicsView->setScene\|graphicsView->scene()->addItem"` | **0 处**（scene 恒空，`graphicsView` 只是背景） |
| MainWindow 里 `graphicsView` 还有没有别的用法 | `grep "graphicsView" MainWindow.cpp` | **仅这 10 处创建行** |

**三条都干净** → 移走布局子树不改变任何事件路径，**行为零损失**。
**任何一条不干净** → **单独评估该处逻辑再改**。

## 4. 对原有逻辑的影响评估（逐项核过）

| 关注面 | 结论 | 依据 |
|---|---|---|
| 按钮点击逻辑 | **零影响** | 按钮 parent 链不变；`connect` 与 parent 无关；UIA Invoke 触发的是按钮真实 `clicked` 信号，走原处理函数 |
| 场景 / graphicsView | **零影响** | 主窗口 scene 从未被 `addItem`/`setScene`，`graphicsView` 只是背景画布 |
| 几何/位置 | **不变** | `screenScale()` 用 `this->width()/height()`（主窗口客户区）做父相对居中；`graphicsView` 在铺满主窗口的 `gridLayout` 中（无 menuBar/statusBar），**两个参照系重合**。实测截图布局位置完全一致 |
| 键盘 ESC/F11 | **不变** | 处理器在 `CMainWindow::keyPressEvent`；原来按键沿 `layout→graphicsView→(空 scene 转发、无聚焦项即 ignore)→CMainWindow` 上传，现在**少一跳直达** |
| 鼠标事件冒泡 | **等价** | 布局空白处未接收的事件：原来到 `graphicsView`（空 scene 无交互项→无操作），现在到 `CMainWindow`（无处理器→忽略） |
| z-order / 生命周期 | **不变** | 代码显式 `show()`/`raise()`/`delete`（切布局 `hide` 首页、返回 `delete` 布局 + `show`/`raise` 首页），与 parent 无关 |
| Tab 焦点顺序 | 理论上有轻微变化 | POP 全程鼠标/Invoke 操作，无 Tab 使用，**可忽略** |

**回归实测（改版实例）**：

- 返回钮回首页 ✅
- ESC 回首页 ✅
- HUD 分支进入并暴露 ✅
- 外观截图与原版一致 ✅
- 三区域 17 菜单按钮灰/亮状态与界面一致 ✅

## 5. 编译

**用 Debug 配置**（原版 exe 即 Debug 构建）：

```bat
:: build-uia.bat（工程根目录）
call "C:\Program Files (x86)\Microsoft Visual Studio\2017\Enterprise\VC\Auxiliary\Build\vcvars64.bat"
cd /d <工程目录>
set PATH=C:\Qt5.14.2\Tools\QtCreator\bin;%PATH%
jom -f Makefile.Debug
```

**产物**：`Exe\POP.exe`（约 3.2MB）

> ⚠️ **不要用 Release**：该工程 `jom -f Makefile.Release` 能链接成功（产物约 975KB）
> 但**启动即崩（0xC0000005）**——这是工程既有问题，**与本改动无关**。
> 若必须修 Release，另行排查。

## 6. 验证成功判据

启动 POP → 首页点「WM下显」（或任意布局）→ 用 CUA `get_window_state`（**无需截图**）读树：

| 判据 | 期望 |
|---|---|
| 元素数 | **8 → 118~142**（按变体菜单数；实测 `D:\net` 版 118、`dshtest` 版 142=3 区域×21 钮+外壳） |
| AutomationId 链 | 出现 `CMainWindow.CViewLayout.CViewArea.CViewMenu.CMenuButton.m_btn_menu` 这样的**逐级链** |
| 每个按钮有中文 `Name` | 如「传感器测试」 |
| `actions` | 含 `invoke` |
| 灰按钮带 `enabled=false` | 未连服务时：机动/传感器/自主探测/自主飞行/自主攻击 = `false` |

> **最后一条是关键**：`enabled` 就是「按钮灰不灰」的**机器可读断言**，
> 可以直接用 `verify_state` 断言，不用看颜色。

**此后的自动化标准路**：

```
get_window_state（无截图）→ element_token / AutomationId Invoke
   → verify_state 断言 enabled
```

**坐标点击降级为应急后备。**

## 7. 实施记录（可对照的两工程）

| 工程 | 源码备份 | exe 备份 | 状态 |
|---|---|---|---|
| `D:\net\pop_ui_test` | `View\MainWindow\MainWindow.cpp.bak-uia` | `Exe\POP.exe.bak-uia`（3240KB 原版） | 已改+已编+**已实测（树 118）** |
| `D:\net\dshtest\pop_ui_test` | 同上 | `Exe\POP.exe.bak-uia`（3735KB 原版） | 已改+已编（3728KB）+**已实测（树 142）** |

> **两版门控不同（重要）**：
> `dshtest` 版每区域 21 钮（含全流程 json / 导弹告警 / 模型参数 / 仿真信息），
> 且**此变体未连服务时「传感器测试」已 `enabled=true`**，与 `D:\net` 版门控不同。
> → **换构建必须重新确认门控基线，不能照抄另一版的预期。**

**回滚**：把 `.bak-uia` 复制回原名重编即可。

## 8. 换项目时的做法（这份指南的复用方式）

本指南针对的是「**Qt + `QGraphicsView` 背景画布 + 布局树挂在画布下**」这个特定结构。
换项目时按这个顺序查：

1. **先确认是不是同一类问题**：读树只有个位数元素，但首页（挂在主窗口下的普通 `QWidget`）
   的按钮能读出来 → **同一个根因**
2. **找出布局树挂在哪个父级**：`grep "new CViewLayout\|new QXxxLayout"` 看第二个参数
3. **做 3 条安全检查**（见 §3）—— **这一步不能跳**
4. **只改那条父子边**，别碰子树内部的 parent 链
5. **改完必须做回归**：返回/ESC/外观/按钮灰亮四项（见 §4 末）

> **不是 Qt 的项目**：这套方法不适用。但「**先让控件树可读，再谈自动化**」这条原则通用。
> 遇到 Web/Electron 项目，对应的是「确保 DOM 可查询 / 无障碍树完整」。