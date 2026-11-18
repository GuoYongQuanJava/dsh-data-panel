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

```powershell
dsh plugin --profile desktop add dsh-cua-mcp
```

或者把本目录放到 profile 的 `node_modules` 下并在 `package.json` 的
`dsh.profile.bundles` 里追加 `dsh-cua-mcp`。

装好后在 **插件 → 已安装插件** 里能看到 `dsh-cua-mcp`，右侧开关控制启用/停用。

## 停用

在插件页关掉开关即可 —— 关掉后不注册 MCP 服务器，模型也就看不到那批工具。

## 断网说明

CUA 驱动随包分发（`vendor/cua/`，约 81 MB），不联网也能用。已关闭其遥测。

## 注意

CUA 会**真实操作鼠标键盘**并抢占焦点。执行期间不要同时使用电脑，
否则可能干扰被测应用的状态。

## 更新 CUA

从 [trycua/cua releases](https://github.com/trycua/cua/releases) 下载对应平台的 zip，
解压覆盖 `vendor/cua/` 即可。当前版本 0.53.0。

## 许可

插件本体 MIT。`vendor/cua/` 下的二进制遵循其自带 LICENSE（见该目录）。