/**
 * dsh-cua-mcp — 把 CUA 桌面驱动注册成 MCP 服务器。
 *
 * 定位：这是一个**独立的 bundle 插件**，只做一件事 —— 让模型能用上
 * `mcp__cua__*` 那批工具（点击、输入、读 UIA 树、断言验证），
 * 供集成测试的「功能测试」用例在真实桌面上模拟人工操作。
 *
 * 为什么独立成插件而不是塞进 dsh-data-panel：
 *   1. 开关可控 —— DSH 的「已安装插件」页会列出本插件，右侧开关直接控制加载/卸载；
 *      关掉等于不注册 MCP 服务器，出问题不需要改代码。
 *   2. 故障隔离 —— 本插件注入失败只影响自己，不会连带面板起不来。
 *
 * 二进制随包分发在 `vendor/cua/`，路径由 import.meta.url 算出，
 * 换机器、换盘符、换安装目录都自动正确，不需要用户改配置。
 */
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

export const name = 'dsh-cua-mcp'

/**
 * 依赖 mcpManager 服务。
 *
 * 这里按官方文档的写法直接声明 inject（`dsh-mcp-manager` 的 README 给的示例就是
 * `export const inject = ['mcpManager']`）。宿主没有这个服务时本插件会停在注入阶段，
 * 但因为是独立插件，面板和其他功能完全不受影响。
 */
export const inject = ['mcpManager']

/** 注册用的服务器名，模型侧显示为 `mcp__<这个名字>__<工具名>`。 */
const SERVER_NAME = 'cua'

export function apply(ctx) {
  const cuaDir = join(dirname(dirname(fileURLToPath(import.meta.url))), 'vendor', 'cua')
  const cuaExe = join(cuaDir, 'cua-driver.exe')

  /*
   * 缺二进制时**明确报错，不静默降级**。
   *
   * 曾经的写法是 logger.warn 后 return —— 结果是插件出现在「已安装插件」里、
   * 开关也是开的，但模型那边一个 mcp__cua__* 工具都没有，界面上没有任何提示。
   * 用的人只能靠自己猜「是不是漏了什么」，实际排查成本很高。
   *
   * 现在：二进制是插件的组成部分，缺了就是包装坏了，直接把原因说清楚并抛出。
   * 抛出会让本插件加载失败（独立插件，不影响其他插件），错误进入宿主日志与插件页。
   */
  if (!existsSync(cuaExe)) {
    throw new Error(
      'dsh-cua-mcp: 缺少 CUA 驱动，无法注册 MCP 服务器。\n' +
      '期望路径：' + cuaExe + '\n' +
      'vendor/cua/ 是插件的组成部分，应随包一起分发（Git LFS 管理）。\n' +
      '若刚克隆仓库，请先执行：git lfs pull\n' +
      '若从离线包部署，请确认 vendor/cua/ 目录已完整拷贝（8 个文件，约 81 MB）。',
    )
  }

  /*
   * 注册绑定在本插件生命周期上：
   * 插件被卸载（UI 里关开关）时，mcpManager 自动撤销该服务器并撤走其工具，
   * 不需要我们自己管进程清理。
   *
   * cwd 指向二进制所在目录 —— 驱动要能找到同目录的 SDK / UIA 辅助文件。
   */
  ctx.effect(
    () => ctx.mcpManager.register(SERVER_NAME, {
      transport: 'stdio',
      command: cuaExe,
      args: ['mcp'],
      cwd: cuaDir,
    }),
    'dsh-cua-mcp: register cua server',
  )

  ctx.logger?.info?.('dsh-cua-mcp: 已注册 CUA MCP 服务器（%s）', cuaExe)
}