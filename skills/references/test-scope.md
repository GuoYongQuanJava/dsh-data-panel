# 全量测试范围与排除证据

开始生成用例前阅读。本清单用于暴露遗漏的文件、函数和场景，不等同于覆盖率收集器的行、块、语句或分支数据。

## 从磁盘盘点，不能只列模型决定测试的函数

用插件安装目录中的 `lib/scope.js` 枚举源码，使用本地 Node：

```text
node <插件安装目录>/lib/scope.js <项目绝对路径> [业务源码目录 ...] [--exclude <排除目录 ...>]
```

命令只向 stdout 输出 JSON。将输出审查后保存为会话资产目录中的 `scope.json`。优先按用户要求扫描整个业务工程；不指定目录时从项目根扫描。若明确指定 `src/include` 等目录，列出选取理由以及工程中其他源码目录的去向，不能靠缩小 sourceRoots 避开难测代码。
BK:使用 `--exclude` 排除不想纳入范围的目录（如演示界面、第三方代码），排除目录按完整路径段匹配，避免 `src/app` 误排除 `src/application`；排除的目录会记录在 `excludeDirs` 中。内置忽略的构建/缓存目录会记录在 omittedDirectories 中；源码若实际位于同名目录，必须显式将该目录作为扫描根，不能静默漏掉。符号链接不会递归进入，应检查其是否包含本次需要的源码，必要时将实际项目根作为独立测试项目盘点。

扫描器只负责文件和哈希，不自动证明文件包含哪些函数。逐文件读取源码（保留原编码），枚举函数、方法、模板和 inline 实现；有可靠语言解析器时优先利用它，不能仅凭头文件扩展名就当作“无逻辑”。枚举后对照目录和文件数，防止只看了几个易测文件。

## 清单格式（version 1）

保留扫描器生成的 sourceRoots、path 和 sha256；将每个文件的 status 更新为以下之一：

- `tested`：列出函数的 subjectFunction 与关联 caseIds；每个函数至少有一条真实面板用例。
- `excluded`：确实不在本轮范围中。reason 必填，proof 必须记录真实命令、退出码、非空日志路径，日志应位于项目内。不允许只写“依赖库所以不能测”；需要时先使用当前构建环境进行独立编译/语法探针，区分“能编译但业务决定排除”和“缺依赖确实无法编译”。探针通过仍排除的，要说明业务理由。探针只验证可编译性，不执行被测业务，也不修改被测源码。
- `declaration`：经逐文件检查确认只有声明、类型或宏，无需执行的逻辑。reason 说明检查位置及依据。模板/inline 有逻辑时不能选此项。
- `deferred`：尚未纳入或验证，写明理由，保留为缺口，不能在总结中隐去。

```json
{
  "version": 1,
  "sourceRoots": ["src"],
  "excludeDirs": ["src/app"],
  "files": [
    {
      "path": "src/order.cpp",
      "sha256": "<保留扫描器输出的实际哈希>",
      "status": "tested",
      "functions": [
        { "subjectFunction": "src/order.cpp::Order.total", "caseIds": ["GN-ZZKZ-ORDER-T001.CTD", "GN-ZZKZ-ORDER-T002.CTD"] }
    },
    {
      "path": "src/vendor_adapter.cpp",
      "sha256": "<实际哈希>",
      "status": "excluded",
      "reason": "独立编译缺少客户专用头文件；不以模拟成功冒充实际测试",
      "proof": { "command": "cl /c /Iinclude src/vendor_adapter.cpp", "exitCode": 2, "logFile": ".dsh/test-sessions/<SID>/probes/vendor_adapter.log" },
      "functions": []
    }
  ]
}
```

示例不是完整工程清单；实际文件必须全部登记。不使用示例哈希或退出码伪造证据。文件或用例变化后刷新哈希、函数和 caseIds，不能直接复用旧探针结论。

## 审查和执行

在原有人工审查阶段汇报扫描根、总文件数、纳入测试的函数/用例数、排除项及证据、未处理缺口。由用户在这一次原有审查中确认本轮范围；不要增加执行中途的确认弹窗。

prepare 会重新扫描这些根，核对遗漏文件、哈希、用例函数关联和排除日志。清单连同证据摘要冻结到 `runs/<runId>/snapshot/scope.json`，并写入 request/result 的 `testScope`。现有 `scope=all/case` 仍只表示执行选择，不用它代替业务源码范围。单条执行保留全工程清单及本次 selectedCaseIds，不把整份清单中所有函数宣称为已执行。

旧项目没有清单，或清单有缺口时，兼容执行仍继续，但日志和执行指令会明确告警；最终总结要列出缺口，不称“全工程全部通过”。`reviewed` 仅表示清单通过当前结构和关联检查，函数枚举及排除业务依据仍需人工审查。

第七项报告模板尚未适配范围字段，现阶段保留完整运行快照和最终对话中的范围声明，不声称 Word 已包含这些信息；后续报告取值应直接消费同一次 run 的 testScope，不能读取后来修改的根清单。
