---
name: ringbuffer-unit-test
description: RingBuffer 模块单元测试流程：生成用例、生成 gtest 代码、执行并输出报告。
designer: 庞江
reviewer: 陈冠旭
tester: 庞江
---

# RingBuffer 单元测试 Skill

本 Skill 负责 `RingBuffer` 模板类的单元测试全流程。

## 职责

1. 分析 `RingBuffer.h` / `RingBuffer.cpp`，提取公开接口与边界条件
2. 生成 gtest 用例（功能 / 边界 / 逻辑）
3. 生成对应测试代码并写入工作区
4. 调用本地 CMake + ctest 执行
5. 汇总真实执行结果，交给报告模块生成 Word

## 人员

| 角色 | 姓名 |
| --- | --- |
| 设计者 | 庞江 |
| 校对者 | 陈冠旭 |
| 测试人员 | 庞江 |

> **这三个人员字段来自本文件**——谁设计、谁校对、谁执行是流程属性，项目定一次就固定。
>
> 单元标识、设计追溯、驱动模块、覆盖率都是**本次执行的技术产出**，
> 由执行系统采集后写进执行结果 JSON，不从本文件读。

## 执行命令

```powershell
cmake -B build -S . -DCMAKE_BUILD_TYPE=Debug
cmake --build build
ctest --test-dir build --output-on-failure
```

## 输出约定

执行结果需整理成 `report-data.json`，字段见 `report-tool/README.md`。
`tester` 可省略（由本文件提供）；`designer` / `reviewer` / `unitId` / `trace` /
`driver` / `coverage` 必须由执行系统写入 JSON。