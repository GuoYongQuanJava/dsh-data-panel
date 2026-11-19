---
# 项目配置文件
# 文件名规则：<工作区名称>.md（工作区名 = 当前项目根目录名）
# 主 Skill 在 Step 2（生成测试用例）时读取此文件
# 所有字段均为必填（除非标注可选），填写后保存即可生效

# ── 基本信息 ──
projectName: ""
projectPackage: ""       # 项目包名（caseId 第二段，如 ZZKZ、PAYGATE）
softwareVersion: ""
devUnit: ""              # 研制单位全称
importance: ""           # 如 A级、B级、C级
language: ""             # 如 C++、Python、Java

# ── 人员 ──
designer: ""             # 测试设计者
reviewer: ""             # 测试校对者
tester: ""               # 测试执行者

# ── 引用文档 ──
reqDocName: ""           # 需求文档名称
reqDocVersion: ""        # 需求文档版本号
designDocName: ""        # 设计文档名称
designDocVersion: ""     # 设计文档版本号

# ── 测试范围（可选，Step 1 分析源码后由 Skill 自动填充）──
# sourceFiles: []
# functionCount: 0
# excludedFunctions: []