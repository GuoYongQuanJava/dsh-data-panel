---
name: auth-service-unit-test
description: 用户认证服务单元测试流程：密码校验、令牌签发、权限判定三个模块的用例生成、gtest 代码生成与执行。
designer: 张伟
reviewer: 刘洋
tester: 王芳
---

# 用户认证服务单元测试 Skill

本 Skill 覆盖 `AuthService` 的三个子模块：密码校验、令牌签发、权限判定。

## 职责

1. 分析 `AuthService.h` 与三个子模块实现，提取输入域与状态机
2. 生成 gtest 用例（功能 / 边界 / 逻辑 / 接口）
3. 生成测试代码写入工作区 `test/auth/`
4. 调用本地 CMake + ctest 执行并采集覆盖率
5. 汇总真实执行结果，交给报告模块生成 Word

## 人员

| 角色 | 姓名 |
| --- | --- |
| 设计者 | 张伟 |
| 校对者 | 刘洋 |
| 测试人员 | 王芳 |

> **这三个人员字段来自本文件**——谁设计、谁校对、谁执行是流程属性，项目定一次就固定。
>
> 单元标识、设计追溯、驱动模块、覆盖率、问题描述都是**本次执行的技术产出**，
> 由执行系统采集后写进执行结果 JSON，不从本文件读。

## 覆盖率采集

```powershell
gcovr --root . --xml-pretty -o coverage.xml --txt -o coverage.txt
# 采集结果写入执行结果 JSON 的模块级 coverage 字段
```

## 执行命令

```powershell
cmake -B build -S . -DCMAKE_BUILD_TYPE=Debug -DCOVERAGE=ON
cmake --build build
ctest --test-dir build --output-on-failure
```

## 输出约定

执行结果整理为 `auth-report-data.json`，交给：

```powershell
python cmd.py --template <客户模板>.docx `
              --data auth-report-data.json `
              --skill skills/auth-service-unit-test `
              -o auth-report.docx
```