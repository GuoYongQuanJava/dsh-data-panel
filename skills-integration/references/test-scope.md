# 功能项覆盖清单

Step 1 产出功能项时同步产出。本清单用于暴露**遗漏的功能项与遗漏的场景**，不等同于覆盖率收集器的行/分支数据。

## 为什么要单独做清单

只列出「我决定测的功能项」，事后没人能判断还有多少没测。清单的作用是把**没测的也写下来**，让缺口可见、可审。

## 与单元测试范围清单的关系

**借鉴思路，不共用实现。**

- 单元测试有 `lib/scope.js`（扫描源码文件、算哈希、`status: tested/excluded/declaration/deferred`）。
- 集成测试的度量单位是**功能项**，不是源码文件，所以**独立写一份**，语义从「源码文件」换成「功能项」。
- **不要 import 或修改 `scope.js`**，也不要把集成测试的清单塞进单元测试的 `testScope`，会污染单元测试行为。

## 清单格式（version 1）

```json
{
  "version": 1,
  "generatedAt": "2026-11-19T09:00:00+08:00",
  "caseVersion": "V0.0.1",
  "sourceBasis": "requirement | skill | code-derived",
  "items": [
    {
      "featureId": "ft_001",
      "name": "商品与购物车",
      "source": "requirement",
      "code": "F-001",
      "status": "covered",
      "caseIds": ["V0_0_1-IT-001", "V0_0_1-IT-002"],
      "typeCoverage": ["functional", "boundary", "api"]
    },
    {
      "featureId": "ft_002",
      "name": "订单退款",
      "source": "code-derived",
      "status": "excluded",
      "reason": "退款依赖第三方支付沙箱，本机无凭据，本轮不测",
      "proof": { "note": "项目 README 与 .env.example 中无支付沙箱配置项" },
      "caseIds": []
    },
    {
      "featureId": "ft_003",
      "name": "优惠券叠加",
      "source": "requirement",
      "status": "deferred",
      "reason": "需求文档标注「待确认」，规则未定稿，等用户确认后补",
      "caseIds": []
    }
  ]
}
```

## status 取值

| 值 | 含义 | 必填项 |
|---|---|---|
| `covered` | 本轮已生成用例 | `caseIds` 非空 |
| `excluded` | 明确不在本轮范围 | `reason` 必填，`proof` 建议填 |
| `deferred` | 尚未纳入或验证，保留为缺口 | `reason` 必填 |
| `declaration` | 只声明、无实际行为（如纯配置项、占位模块） | `reason` 说明依据 |

**不允许的状态**：功能项存在但清单里没有它——那就是隐藏缺口。

## excluded 的理由必须是真的

**不允许只写「太复杂所以不测」「依赖外部系统所以不测」。** 这类理由无法验证，等于没写。

理由要能被第三方复核，例如：

```
✅ "退款依赖第三方支付沙箱，本机无凭据（见 .env.example 无 PAY_SANDBOX_* 配置）"
✅ "该模块源码标注 @Deprecated 且构建时被 profile=legacy 排除"
❌ "依赖支付系统，无法测"
❌ "比较复杂"
```

有真实探针证据时记进 `proof`（命令、退出码、日志位置）。**不要伪造命令或退出码来充证据。**

## `typeCoverage` 的用处

记录每个功能项实际覆盖了哪几类。交付前用它回答：

- 有功能项 `typeCoverage` 为空，但状态是 `covered` → 数据矛盾，检查是否漏生成用例。
- 全体功能项的 `typeCoverage` 里 `margin` / `security` 出现 0 次 → 复核是否真不涉及，涉及就是漏了。
- 出现 `stress` → **错误**，本轮不测强度，必须移除。

## 审查时怎么汇报

在 Step 4 人工审查里，用这张清单汇报（**不新增额外的确认步骤**）：

```
覆盖清单：功能项 12 个
  已覆盖 covered   8 个（用例 26 条）
  已排除 excluded  2 个 ← 逐条给理由
  暂缓   deferred  2 个 ← 逐条给理由
类型分布：functional 14 / boundary 5 / api 4 / performance 2 / margin 1 / security 0
缺口提示：security 覆盖为 0，本系统有鉴权模块，需确认是否本轮补
```

## 冻结与消费

- 生成用例版本时，清单随 `case-versions/<V>/` 一起产出。
- 执行时，本次范围随 `runs/<runId>/snapshot/` 一起冻结。
- **报告取值应消费同一次 run 的快照**，不要读后来被改过的清单。

## 常见错误

| 错误 | 后果 | 正确做法 |
|---|---|---|
| 只登记要测的，不登记排除的 | 缺口被隐藏，无法审 | 排除项也要登记并给理由 |
| excluded 理由写成「依赖库/太复杂」 | 无法验证，等于没写 | 写可复核的具体依据 |
| 伪造探针命令和退出码 | 证据造假 | 没有真实证据就只写文字依据 |
| 把集成清单写进单元测试的 `scope.json` | 污染单元测试 | 独立文件，独立的语义 |
| 改了清单后拿旧 run 的报告 | 报告与数据不一致 | 报告只消费该 run 的快照 |
| 清单里出现 `stress` | 违反「本轮不测强度」 | 移除 |