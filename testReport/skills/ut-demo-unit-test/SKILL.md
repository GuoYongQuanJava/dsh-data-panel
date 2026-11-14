---
name: ut-demo-unit-test
description: ut-demo 订单金额计算模块单元测试流程：line_total / discount_rate / order_total 三个函数的 pytest 用例生成、执行与 Word 报告。
designer: 张三
reviewer: 李四
tester: 王五
---

# ut-demo 订单金额单元测试 Skill

本 Skill 覆盖 `src/order.py` 的 3 个函数：`line_total`、`discount_rate`、`order_total`。

## 业务规则（用例来源）

1. 行小计 = 单价 × 数量；数量、单价都不能为负数。
2. 会员折扣：normal 0、silver 0.05、gold 0.10；未知等级按 normal 处理。
3. 折扣后满 99 元免运费，否则收 8 元运费。
4. 优惠券抵扣后金额不低于 0。
5. 税率 6%，各字段保留两位小数。

## 职责

1. 分析 `src/order.py` 的函数签名与边界条件
2. 生成 pytest 用例（功能 / 边界 / 异常）
3. 生成测试代码写入会话资产目录 `<项目>/.dsh/test-sessions/<会话ID>/tests/test_generated.py`
4. 通过面板「执行 / 全部执行」冻结本次用例并运行 `run_tests.py`
5. 汇总真实执行结果，交给报告模块生成 Word

## 人员

| 角色 | 姓名 |
| --- | --- |
| 设计者 | 张三 |
| 校对者 | 李四 |
| 测试人员 | 王五 |

> 这三个人员字段来自本文件。单元标识、设计追溯、覆盖率等是本次执行的技术产出，由执行系统采集后写进执行结果 JSON。

## 执行命令

```powershell
& "C:\Users\YQ\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\python\python.exe" `
  "<会话资产>\run_tests.py" --project "<项目>" --root "<会话资产>" --run-id "<runId>"
```

## 已知缺陷

`order_total` 第 42 行按 `discounted - coupon + shipping` 计算应付金额，缺少 `max(0.0, …)` 保护；
优惠券大于应收金额时 payable 为负数（TC-ORDER-007 失败）。测试如实报告，未修改源码迁就测试。