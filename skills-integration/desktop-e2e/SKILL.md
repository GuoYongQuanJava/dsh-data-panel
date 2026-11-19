---
name: integration-desktop-e2e
description: 集成测试中需要操作真实桌面界面或驱动浏览器取证时使用，经 CUA MCP 工具执行点击、输入、读控件树与断言验证。
---

# 桌面端 / 浏览器 E2E（CUA）

集成测试里**需要真实界面操作**的部分（功能测试、以及用浏览器跑的其余类型），都走这套流程。

**REQUIRED BACKGROUND:** 必须已加载主 Skill `ai-integration-test-workflow`。本文件不另起流程，只补充「怎么在真实界面上操作和取证」。

## 什么时候用

- `functional`（功能测试）——**必须用**，这是它的唯一执行方式
- 其余类型需要真实界面取证时（例如用浏览器跑 `api` 的端到端契约验证）
- 被测对象是桌面应用（WPF / WinForms / Electron / Qt）时

**不用**：纯代码级验证（`boundary` / `margin` 等能直接调函数或发请求的），走 `run_tests.py`。

## 工具在哪

CUA 是独立插件 `dsh-cua-mcp` 注册的 MCP 服务器，工具前缀 `mcp__cua__`，共 62 个。

**开始前先确认工具真的可用**：若模型侧一个 `mcp__cua__*` 工具都没有，说明插件没加载（插件页开关、`vendor/cua/` 二进制是否完整、`cua-driver.exe` 进程是否存在）。

> **缺工具时明确报错，不要静默降级成「读代码推断界面结果」。** 那会产生假证据。
> 修复方法：确认「已安装插件」页 `dsh-cua-mcp` 开关为开；若刚克隆仓库执行 `git lfs pull` 补齐 `vendor/cua/`（8 个文件约 81 MB）；重启 DSH。

## 常用工具（按用途）

| 用途 | 工具 |
|---|---|
| 点击元素 / 坐标 | `mcp__cua__click`、`double_click`、`right_click` |
| 输入文字 / 按键 / 组合键 | `mcp__cua__type_text`、`press_key`、`hotkey` |
| **读控件树（结构化，不是截图猜）** | `mcp__cua__get_window_state` |
| **确定性断言验证** | `mcp__cua__verify_state` |
| 一次执行多步动作，遇错即停 | `mcp__cua__run_steps` |
| 截图 / 局部放大 | `mcp__cua__get_desktop_state`、`zoom` |

完整 62 个工具以实际注册为准。

## 核心原则：读结构，不要猜截图

```
❌ 截图看到「有个按钮」，猜它叫「结算」然后点坐标
✅ get_window_state 读到 Name="结算" AutomationId="btnCheckout"，按 AutomationId 点击
```

- **优先按控件属性定位**（`AutomationId` / `Name` / `ControlType`），坐标只在前者不可用时作为兜底。
- **断言统一用 `verify_state`**，不要用「截图看起来对了」当通过。这是功能测试唯一能拿到的确定性证据。

## 步骤 → CUA 动作的映射

主 Skill 的每个步骤（`action` / `operation` / `expected`）落到 CUA 上：

| 步骤字段 | CUA 里对应 |
|---|---|
| `action`（动作，如「打开商品详情页」） | 定位要操作的窗口/控件 |
| `operation`（输入步骤，如「点击结算」） | `click` / `type_text` / `press_key` / `run_steps` |
| `expected`（预期结果） | `verify_state` 的断言条件 + `observed` 的记录内容 |

**一个步骤 = 一次独立的可执行单元**，并且**自带前置准备**：单独执行第 3 步也要能从干净状态跑通（重新登录、重置数据），不要依赖「第 2 步已经点过了」。

## 取证要求（回到证据链）

功能测试的证据来源**只能标 `model`**，不能标 `runner+model`。

```json
{
  "caseId": "V1-IT-001",
  "stepNo": 1,
  "outcome": "passed",
  "observed": "窗口「购物车 - 我的商城」；表格第 1 行 Name=无线蓝牙耳机，Qty=1，Subtotal=¥299.00",
  "evidence": ["runs/<runId>/shots/step-1.png"],
  "evidenceSource": "model"
}
```

- `observed` 写 `get_window_state` / `verify_state` 返回的**真实控件值**，不写「显示正常」「符合预期」。
- `outcome` 以 `verify_state` 的结果为准：断言成立才 `passed`，不成立就 `failed`，**不能因为「看起来差不多」改成通过**。
- 截图作为辅助证据放 `evidence[]`，不能替代 `verify_state`。

三条硬校验（完整性 / 有据可依 / 不许超纲）见 [证据链](../references/evidence-chain.md)。

## 浏览器场景

CUA 可以驱动浏览器（需注意版本行为），但有几条硬约束：

- **不要在浏览器最小化时快照后点击**：最小化窗口读到的元素在解析时有被判定为 stale 的风险，先恢复窗口再操作。
- **输入文字用 `type_text` 按序发送**，不要逐字符 `press_key` 拼长文本（易丢字符）。
- 按键按**目标键盘布局**解析，涉及特殊符号时先确认布局。

> 说明：本机实测可用的是 CUA 桌面驱动；独立的浏览器自动化驱动本轮未接入。用 CUA 驱浏览器时，上述约束必须遵守。

## 反模式（都会产生假证据）

| 反模式 | 后果 | 正确做法 |
|---|---|---|
| 截图人眼判断当断言 | 结论无法复现、无法校验 | `verify_state` |
| 按坐标硬点（不读控件树） | 布局一变就点错地方 | 优先 `AutomationId` / `Name` |
| 把「页面看起来对」写成 `observed` | 空证据，过不了「有据可依」 | 写真实控件值 |
| 功能测试标 `runner+model` | 抬高可信度 | 只能标 `model` |
| CUA 不可用就改读代码推断 | 制造假通过 | 明确报错并给修复方法 |
| 步骤依赖前一步的状态 | 单步执行跑不通 | 每个步骤函数自带前置准备 |
| 最小化窗口下快照点击 | 元素被判 stale，点错地方 | 先恢复窗口 |

## 结束条件

- 每个 `functional` 步骤都有 `verify_state` 的确定性结果，没有只靠截图的结论。
- 每个步骤的 `observed` 都是真实读到的控件值。
- `evidenceSource` 全部为 `model`。
- CUA 不可用的部分已明确报告，没有被记成通过。