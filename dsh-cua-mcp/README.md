# dsh-cua-mcp

把 [CUA 桌面驱动](https://github.com/trycua/cua) 注册成 DeepSeek Harness 的 MCP 服务器。

装上之后，模型可以直接调用这些工具在**真实桌面**上操作应用：

| 工具 | 用途 |
|---|---|
| `mcp__cua__click` / `double_click` / `right_click` | 点击窗口内元素或坐标 |
| `mcp__cua__type_text` / `press_key` / `hotkey` | 输入文字、按键、组合键 |
| `mcp__cua__get_window_state` | 读 UIA 控件树（结构化，不是截图猜） |
| `mcp__cua__verify_state` | 对窗口做确定性断言验证 |
| `mcp__cua__run_steps` | 一次调用执行多步动作，遇错即停 |
| `mcp__cua__get_desktop_state` / `zoom` | 截图与局部放大 |

完整清单 62 个工具，`mcp__cua__` 前缀。

## 用途

供 `dsh-data-panel` 的**集成测试**里「功能测试」类型使用 —— 这类用例要模拟真人
点界面，光靠测试框架跑不了。

## 安装

和 `dsh-data-panel` / `dsh-better-sidebar` 一样走 profile 的 `file:` 依赖，
由 pnpm 装进 `node_modules`。

### 完整步骤

```powershell
# 1. 拉取代码
cd <仓库根目录>
git pull

# 2. 拉取二进制（Git LFS）
git lfs install          # 每台机器只需一次
git lfs pull

# 3. 登记到 profile（只改 package.json，避免手改出错）
powershell -ExecutionPolicy Bypass -File .\install-cua-plugin.ps1

# 4. 完全退出 DeepSeek Harness，然后安装文件
cd $env:USERPROFILE\.dsh\profiles\desktop
node "$env:USERPROFILE\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\pnpm\bin\pnpm.mjs" install

# 5. 重启 DeepSeek Harness
```

> **第 4 步必须在 DSH 关闭时执行**：pnpm 要替换 `node_modules\dsh-cua-mcp` 整个目录，
> 驱动进程占用 `cua-driver.exe` 时会报 `EPERM`。

装好后在 **插件 → 已安装插件** 里能看到 `dsh-cua-mcp`，右侧开关控制启用/停用。

### ⚠️ 二进制走 Git LFS，克隆后必须拉全

`vendor/cua/` 下的 8 个文件（约 81 MB）由 **Git LFS** 管理。普通 `git clone` /
`git pull` 只拿到指针文件，**插件会因缺少驱动而加载失败**。

```powershell
git lfs install        # 只需一次
git lfs pull           # 拉取实体二进制

# 验证：8 个文件都在，总计约 81 MB
Get-ChildItem dsh-cua-mcp\vendor\cua | Measure-Object Length -Sum
```

如果 `git lfs pull` 拉不到（网络受限），从离线包直接拷贝整个 `vendor/cua/` 目录覆盖即可。

> 缺驱动时插件会**明确报错**并指出期望路径，不会静默失效 —— 见下一节。

## 缺驱动时的表现

`vendor/cua/` 是插件的组成部分，缺了就无法工作。此时插件加载失败并抛出：

```
dsh-cua-mcp: 缺少 CUA 驱动，无法注册 MCP 服务器。
期望路径：<...>\dsh-cua-mcp\vendor\cua\cua-driver.exe
vendor/cua/ 是插件的组成部分，应随包一起分发（Git LFS 管理）。
若刚克隆仓库，请先执行：git lfs pull
若从离线包部署，请确认 vendor/cua/ 目录已完整拷贝（8 个文件，约 81 MB）。
```

这是独立插件，加载失败**不影响其他插件**（面板、侧栏照常）。

## 停用

在插件页关掉开关即可 —— 关掉后不注册 MCP 服务器，模型也就看不到那批工具。

## 断网说明

CUA 驱动随包分发（`vendor/cua/`，约 81 MB），**不联网也能用**。已关闭其遥测。

离线部署时把整个仓库（含 `vendor/cua/`）拷过去即可。若对方用的是 `git clone`
拿到指针文件，需在有网环境先 `git lfs pull` 再打包，或者直接拷贝实体目录。

## 注意

CUA 会**真实操作鼠标键盘**并抢占焦点。执行期间不要同时使用电脑，
否则可能干扰被测应用的状态。

## 更新 CUA

从 [trycua/cua releases](https://github.com/trycua/cua/releases) 下载对应平台的 zip，
解压覆盖 `vendor/cua/` 即可。当前版本 0.53.0。

## 许可

插件本体 MIT。`vendor/cua/` 下的二进制遵循其自带 LICENSE（见该目录）。