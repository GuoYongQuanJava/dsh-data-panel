---
name: integration-desktop-uia
description: 集成测试里「必须断言界面」时使用（channel: uia）。用 Windows UIAutomation 读控件树、按 AutomationId/Name 定位、做确定性属性断言。不是桌面应用的唯一测试方式——主力通道是 runner（工装测试函数）。
---

# 界面断言（Windows UIAutomation）

集成测试里**步骤的 `channel` 标 `uia`** 时，走这套做法。

**REQUIRED BACKGROUND:** 必须已加载主 Skill `ai-integration-test-workflow`。本文件**不另起流程**——
六步流程、版本模型、用例与步骤的数据契约、报告生成全部由主 Skill 决定。
本文件只补充「`channel: uia` 这一步具体怎么操作、怎么取证」。

> **定位先摆正**：`uia` 是**三个 channel 里的第三个**，不是默认选择。
> 主力通道是 `runner`（调工装 exe 里的测试函数）。只有**结论必须从界面上读**的时候才用 `uia`。
> 总线形态的完整方法（工装三件套、构建门、RESULT/KV 协议）见 [bus-backend](../bus-backend/SKILL.md)。

## 什么时候用（`channel: uia`）

| 断言依据 | 用 `uia` 吗 |
|---|---|
| 界面上某个控件的文本/状态/是否可用 | ✅ 用 |
| 界面布局与显示逻辑（表格行列、列表内容、提示条） | ✅ 用 |
| 总线上的帧、字段值、帧率 | ❌ 用 `runner`（工装观察者） |
| 接口返回、错误码、耗时 | ❌ 用 `runner`（测试代码） |
| 构建能不能过、环境齐不齐 | ❌ 用 `cmd` |

**能在总线或接口上验的，就不要用界面验** —— 界面断言布局敏感、脆、慢，是最后手段。

## 工具在哪

UIAutomation 是 **Windows 原生**能力（.NET `UIAutomationClient`），不需要任何 MCP 插件。
标准做法是写一个 PowerShell 脚本，随会话走：

```
<SESSION_ROOT>\tests\uia_probe.ps1
```

脚本内部**不落绝对路径**，根目录从参数或环境变量传入（见 [bus-backend 的路径约定](../bus-backend/SKILL.md)）。

**开始前先确认环境真的可用**：

```powershell
Add-Type -AssemblyName UIAutomationClient, UIAutomationTypes
[System.Windows.Automation.AutomationElement]::RootElement.Current.Name
```

能打印出桌面根元素名字（通常是空串或窗口名）就是可用的。
**不可用时明确报错，不要静默降级成「读代码推断界面结果」** —— 那会产生假证据。

## 常用能力（按用途）

| 用途 | UIA 对应 |
|---|---|
| 找窗口 / 找控件（按属性定位） | `AutomationElement.FindFirst(TreeScope, PropertyCondition)` |
| 一次找一组同类控件 | `FindAll(TreeScope, Condition)` |
| 点按钮 | `InvokePattern.Invoke()` |
| 输入文字 / 读输入框值 | `ValuePattern.SetValue()` / `.Current.Value` |
| 勾选 | `TogglePattern.Toggle()` / `.Current.ToggleState` |
| 展开下拉 / 选择项 | `ExpandCollapsePattern` / `SelectionItemPattern.Select()` |
| 读表格行列 | 遍历 `ControlType.DataItem` / `ControlType.Text` 子元素 |
| 等控件出现 / 等使能 | 轮询 `FindFirst` + `.Current.IsEnabled`（带超时，别死等） |

## 核心原则：读控件树，不要猜截图

```
❌ 截图看到「有个按钮」，猜它叫「结算」然后点坐标
✅ FindFirst 读到 Name="结算" AutomationId="btnCheckout"，按 AutomationId 定位并 Invoke
```

- **优先按控件属性定位**（`AutomationId` / `Name` / `ControlType`），坐标只在前者不可用时作为兜底。
- **断言一律读控件属性**（`Current.Name` / `Current.Value` / `Current.IsEnabled` / `ToggleState`），
  不要用「截图看起来对了」当通过。这是 `uia` 通道唯一能拿到的确定性证据。
- **截图只作辅助证据**，放 `evidence[]`，不能替代属性断言。

## 步骤 → UIA 动作的映射

主 Skill 的每个步骤（`action` / `operation` / `expected`）落到 UIA 上：

| 步骤字段 | UIA 里对应 |
|---|---|
| `action`（动作，如「打开商品详情页」） | 定位要操作的窗口/控件 |
| `operation`（输入步骤，如「点击结算」） | `Invoke()` / `SetValue()` / `Toggle()` |
| `expected`（预期结果） | 读控件属性做断言 + `observed` 的记录内容 |

**一个步骤 = 一次独立的可执行单元**，并且**自带前置准备**：单独执行第 3 步也要能从干净状态跑通（重新登录、重置数据），不要依赖「第 2 步已经点过了」。

## 取证要求（回到证据链）

界面断言拿到的控件属性是**可复现的脚本级证据**，比肉眼描述硬得多：

```json
{
  "caseId": "V0_0_1-IT-001",
  "stepNo": 1,
  "outcome": "passed",
  "observed": "窗口「购物车 - 我的商城」；表格第 1 行 Name=无线蓝牙耳机，Qty=1，Subtotal=¥299.00",
  "evidence": ["runs/<runId>/shots/step-1.png"],
  "evidenceSource": "runner+model"
}
```

- `observed` 写 UIA 读到的**真实控件文本/属性值**，不写「显示正常」「符合预期」。
- `outcome` 以属性断言结果为准：断言成立才 `passed`，不成立就 `failed`，**不能因为「看起来差不多」改成通过**。
- `evidenceSource` 默认 `runner+model`（脚本读到的值可复现）；
  只有纯肉眼补充的描述性观察才标 `model`。取值规则见 [证据链](../references/evidence-chain.md)。
- **读不到控件**（自绘控件、非标准布局、窗口最小化）→ 记 `blocked`，写明原因，**不算通过也不造假**。

三条硬校验（完整性 / 有据可依 / 不许超纲）见 [证据链](../references/evidence-chain.md)。

## 浏览器场景

UIA 能读 Edge / Chrome 的控件树（走 Accessibility Tree），但有硬约束：

- **不要在浏览器窗口最小化时读控件树**：最小化后元素可能读不到或判为失效，先恢复窗口再操作。
- **输入长文本用 `ValuePattern.SetValue()` 一次性设值**，不要逐字符模拟按键（易丢字符）。
- 浏览器 UI 更新频繁，**优先按 `AutomationId` / `Name` 定位**，不要依赖坐标或层级索引。
- 页面内容若在 iframe / 跨进程渲染里，控件树可能不完整；读不到就记 `blocked`，不要猜。

## 反模式（都会产生假证据）

| 反模式 | 后果 | 正确做法 |
|---|---|---|
| 截图人眼判断当断言 | 结论无法复现、无法校验 | 读控件属性做断言 |
| 按坐标硬点（不读控件树） | 布局一变就点错地方 | 优先 `AutomationId` / `Name` |
| 把「界面看起来对」写成 `observed` | 空证据，过不了「有据可依」 | 写真实控件属性值 |
| 界面步也标 `model` 却不说是脚本读的 | 无谓降低可信度 | 脚本读到的标 `runner+model` |
| UIA 读不到就改读代码推断 | 制造假通过 | 明确报错或记 `blocked` |
| 步骤依赖前一步的状态 | 单步执行跑不通 | 每个步骤自带前置准备 |
| 最小化窗口下读控件树 | 元素失效，读到空值 | 先恢复窗口 |
| 能在总线上验的偏要读界面 | 脆、慢、易误判 | 优先 `runner` 通道 |

## 结束条件

- 每个 `channel: uia` 的步骤都有**控件属性断言**的确定性结果，没有只靠截图的结论。
- 每个步骤的 `observed` 都是真实读到的控件属性值。
- `evidenceSource` 按实际证据强度标注（脚本读到 = `runner+model`）。
- 读不到控件的步骤已记 `blocked` 并写明原因，没有被记成通过。
- 能用 `runner` 通道验的步骤，没有为了省事改走界面。