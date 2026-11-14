---
name: calculator-unit-test
description: Calculator 模块单元测试流程：基础运算函数与 Calculator 类的 pytest 用例生成、执行与报告。
designer: 张三
reviewer: 李四
tester: 王五
---

# Calculator 单元测试 Skill

本 Skill 覆盖 `calculator.py` 的 4 个独立函数和 1 个 Calculator 类。

## 职责

1. 分析 `src/calculator.py` 的函数签名与边界条件
2. 生成 pytest 用例（功能 / 边界 / 异常）
3. 生成测试代码写入 `tests/test_generated.py`
4. 执行 `python -m pytest tests/ -v` 采集结果
5. 汇总真实执行结果，交给报告模块生成 Word

## 人员

| 角色 | 姓名 |
| --- | --- |
| 设计者 | 张三 |
| 校对者 | 李四 |
| 测试人员 | 王五 |

> 这三个人员字段来自本文件。单元标识、设计追溯、覆盖率等是本次执行的技术产出，由执行系统采集后写进执行结果 JSON。

## 覆盖率采集

```powershell
python -m pytest tests/ -v --cov=src --cov-report=term
```

## 执行命令

```powershell
cd demo-project
python -m pytest tests/ -v
```