# 项目配置文件说明

## 文件位置

```
testReport/skills/<工作区名称>.md
```

- 工作区名称 = 当前项目根目录名（如 `ringbuffer`、`paygate`）
- 文件名必须与工作区目录名完全一致
- 文件编码：UTF-8
- 格式：YAML frontmatter

## 字段说明

### 基本信息
| 字段 | 示例 | 报告对应位置 |
|------|------|-------------|
| projectName | "RingBuffer 缓冲管理软件" | 封面标题、1.1 标识 |
| projectPackage | "ZZKZ" | caseId 第二段（见下方规则） |
| softwareVersion | "V1.0.1" | 1.2 软件信息表 |
| devUnit | "XXX研究所" | 1.2 软件信息表 |
| importance | "A级" | 1.2 软件信息表 |
| language | "C++" | 1.2 软件信息表 |

### 人员
| 字段 | 报告对应位置 |
|------|-------------|
| designer | 每条用例表"设计者"列 |
| reviewer | 每条用例表"校对者"列 |
| tester | 每条用例表"测试人员"列 |

### 引用文档
| 字段 | 报告对应位置 |
|------|-------------|
| reqDocName + reqDocVersion | 第2章 引用文档 |
| designDocName + designDocVersion | 第2章 引用文档 |

## caseId 生成规则

格式：`<类型缩写>-<项目包名>-<函数分类名>-T<序号>.CTD`

| 段 | 来源 | 示例 |
|----|------|------|
| 类型缩写 | 测试类型首字母：功能→GN, 接口→JK, 边界→BJ, 逻辑→LJ, 性能→XN | BJ |
| 项目包名 | 配置 projectPackage | ZZKZ |
| 函数分类名 | Step 1 分析源码时确定，大写的函数分组名 | RINGBUFFER |
| 序号 | 该函数分类下用例序号，T001 起 | T002 |
| 固定后缀 | 常量 | .CTD |

完整示例：`BJ-ZZKZ-RINGBUFFER-T002.CTD`

## 使用流程

1. 用户在 Step 1 之前创建 `<工作区>.md` 并填写
2. 主 Skill Step 2 读取此文件
3. caseId 在 Step 2 生成用例时按规则组合
4. Step 6 报告生成时使用配置中的全部字段

## 模板文件

复制 `_project-template.md` 并重命名为 `<工作区名称>.md` 即可开始填写。