/**
 * 通用工具链发现（与具体语言无关）。
 *
 * 面板不假设项目用哪种语言：需要哪些可执行文件由 `lib/runners.js` 的 preset
 * 用 `tools: ['go', 'cargo', …]` 声明，这里只负责「把它找出来」。
 *
 * 搜索阶梯（命中即返回，越靠前越可信）：
 *   1. 显式选择      DSH_<TOOL>_PATH —— 宿主/用户说“就用这个”
 *   1.5 自定义目录    DSH_TOOL_SEARCH_DIRS（内网 / 非标准安装位置的逃生门）
 *   2. 项目内        项目自带 wrapper（mvnw / gradlew / npm）、node_modules/.bin、
 *                    venv / .venv / env 的 Scripts|bin —— 版本和项目一致时最准
 *   3. SDK 根变量    <TOOL>_HOME / <TOOL>_ROOT 下的 bin/（M2_HOME、JAVA_HOME、GOROOT …）
 *   4. DSH 自带运行时 $DSH_HOME/dsh-runtimes/*\/dependencies/**（限深扫描，不写死路径）
 *   5. PATH
 *   6. 常见安装目录  Windows / macOS / Linux 的安装根 + 版本管理器（pyenv、nvm、sdkman、
 *                    rustup、volta、scoop、chocolatey、Homebrew…），支持 `*` 通配一层
 *
 * 全部是纯文件系统探测，**不 spawn 子进程**：host 要快速响应，也不能被某个工具卡住。
 * 找不到一律返回空串 —— 调用方必须把「不在 PATH」和「项目不该用这个语言」分开判断，
 * 不能因为一次探测失败就跳过整门语言。
 */
import { readdirSync, statSync, readFileSync } from 'node:fs'
import { join, isAbsolute } from 'node:path'
import { homedir } from 'node:os'

const IS_WIN = process.platform === 'win32'

/** Windows 上可执行文件常见扩展名；Unix 上没有扩展名。 */
const EXE_EXTS = IS_WIN ? ['.exe', '.cmd', '.bat', ''] : ['']

/** 扫描预算：目录多的时候别把请求拖慢。 */
const MAX_DIRS_VISITED = 4000
const MAX_DEPTH = 5
const MAX_PATTERN_EXPANSION = 240

/**
 * 同一个概念在不同平台的命令名不同，统一在这里登记。
 * 只登记「就是同一个工具」的别名，不做语言专属逻辑。
 */
const TOOL_ALIASES = {
  python: ['python3', 'python'],
  npx: ['npx', 'npx.cmd'],
  ctest: ['ctest'],
  ruby: ['ruby', 'ruby3'],
  php: ['php'],
  gcc: ['gcc', 'cc'],
  // C/C++ 编译器三大家庭：GCC / Clang / MSVC。不同项目用哪个是不一定的，
  // 所以它们也可能作为一个「任选其一」组出现在 preset 的 tools 里。
  'g++': ['g++', 'c++'],
  'clang++': ['clang++'],
  cl: ['cl'],
  cc: ['cc', 'gcc'],
  make: ['make', 'gmake'],
  ninja: ['ninja'],
  msbuild: ['msbuild', 'MSBuild'],
  bazel: ['bazel'],
  meson: ['meson'],
  // 旧版 VS 动态代码覆盖率采集器（Enterprise 版才带），不在 PATH 上。
  codecoverage: ['CodeCoverage.exe', 'CodeCoverage'],
}

/** 别名列表：主名在最前，去重。 */
export function toolNames(tool) {
  const aliases = TOOL_ALIASES[tool] || []
  return [...new Set([tool, ...aliases])]
}

function safeStat(path) {
  try {
    return statSync(path)
  } catch {
    return null
  }
}

function isFile(path) {
  const info = safeStat(path)
  return info !== null && info.isFile()
}

function isDir(path) {
  const info = safeStat(path)
  return info !== null && info.isDirectory()
}

function safeReaddir(dir) {
  try {
    return readdirSync(dir)
  } catch {
    return []
  }
}

/** PATH 拆成目录列表（Windows 用分号，其他用冒号）。 */
export function pathDirs() {
  const raw = process.env.PATH || process.env.Path || ''
  return raw.split(IS_WIN ? ';' : ':').map((item) => item.trim()).filter(Boolean)
}

function envValue(name) {
  const value = process.env[name]
  return typeof value === 'string' ? value.trim() : ''
}

/**
 * 显式选择：`DSH_<TOOL>_PATH` 是用户/宿主直接指定的可执行文件（或目录），
 * 优先级最高 —— 它表达的意图就是“别自己找，就用这个”。
 */
function envExplicitCandidates(tool) {
  const upper = tool.toUpperCase().replace(/[^A-Z0-9]/g, '_')
  const out = []
  for (const name of [`DSH_${upper}_PATH`, `DSH_${tool.toUpperCase()}_PATH`]) {
    const value = envValue(name)
    if (value !== '') out.push(value)
  }
  return out
}

/**
 * SDK 根变量（`M2_HOME` / `JAVA_HOME` / `GOROOT` …）。
 *
 * 这只是“SDK 装在哪”的线索，不应当压过项目自带的 wrapper：
 * 项目里的 `./mvnw` 版本一定和项目匹配，而 `M2_HOME` 可能是个很旧的全新安装。
 */
function envHomeCandidates(tool) {
  const upper = tool.toUpperCase().replace(/[^A-Z0-9]/g, '_')
  const out = []
  for (const name of [`${upper}_HOME`, `DSH_${upper}_HOME`, `${upper}_ROOT`, `DSH_${upper}_ROOT`]) {
    const value = envValue(name)
    if (value === '') continue
    out.push(join(value, 'bin', tool), join(value, tool))
  }
  return out
}

/**
 * 自定义搜索目录：`DSH_TOOL_SEARCH_DIRS`（分号/冒号分隔）。
 *
 * 这是给内网 / 非标准安装位置的逃生门：工具装在 D:\tools\cmake\bin 这种地方时，
 * 不用改代码、也不用改 PATH 就能让面板找到（对它仍然只是“一个搜素目录”）。
 */
export function customSearchDirs() {
  const raw = process.env.DSH_TOOL_SEARCH_DIRS || process.env.DSH_TOOL_DIRS || ''
  // Windows 上只能按分号拆：`C:\...` 里的冒号是盘符，不是分隔符（这里曾因此拆坏）。
  const separator = IS_WIN ? /;/ : /[;:]/
  return raw.split(separator).map((item) => item.trim()).filter(Boolean)
}

/**
 * 项目内候选。项目自带的 wrapper 永远优先：`./gradlew` 的版本一定和项目匹配，
 * 而全局 `gradle` 可能差一个大版本。
 */
function projectCandidates(tool, project) {
  if (typeof project !== 'string' || project.trim() === '') return []
  const root = project.trim()
  const names = toolNames(tool)
  const out = []
  // 项目根的可执行入口：既可能是 <tool>（node、go…），也可能是 wrapper <tool>w
  // （gradlew / mvnw / npm — 这类是项目自带的固定版本，必须优先于全局安装）。
  for (const name of names) {
    out.push(...(IS_WIN
      ? [join(root, `${name}.exe`), join(root, `${name}.bat`), join(root, `${name}.cmd`),
          join(root, `${name}w.bat`), join(root, `${name}w.cmd`)]
      : [join(root, name), join(root, `${name}w`)]))
    out.push(join(root, 'bin', name))
  }
  // 语言各自的「项目内依赖目录」：都是约定俗成的名字，不是语言逻辑。
  const localDirs = [
    join(root, 'node_modules', '.bin'),
    join(root, '.venv', 'Scripts'),
    join(root, '.venv', 'bin'),
    join(root, 'venv', 'Scripts'),
    join(root, 'venv', 'bin'),
    join(root, 'env', 'Scripts'),
    join(root, 'env', 'bin'),
    join(root, 'build', 'install', 'bin'),
    join(root, 'target', 'debug'),
    join(root, 'target', 'release'),
  ]
  out.push(...localDirs)
  return out
}

/** DSH 自带运行时的根：多个 runtime 目录都要看。 */
function dshRuntimesRoot() {
  const home = envValue('DSH_HOME') || join(homedir(), '.dsh')
  return join(home, 'dsh-runtimes')
}

/**
 * 在 DSH 自带的 runtime 目录里广度优先找同名可执行文件。
 *
 * 这里**不写死** `<runtime>/dependencies/python/python.exe` 这种路径：
 * 目录结构会随版本变化，写死等于又变成只支持某一种语言。
 */
function bundledCandidates(tool) {
  const root = dshRuntimesRoot()
  if (!isDir(root)) return []
  const names = toolNames(tool)
  const found = []
  const queue = [{ dir: root, depth: 0 }]
  let visited = 0
  while (queue.length > 0 && visited < MAX_DIRS_VISITED) {
    const { dir, depth } = queue.shift()
    visited += 1
    for (const ext of EXE_EXTS) {
      for (const name of names) {
        const file = join(dir, name + ext)
        if (isFile(file)) {
          found.push(file)
          if (found.length >= 8) return found
        }
      }
    }
    if (depth >= MAX_DEPTH) continue
    for (const entry of safeReaddir(dir)) {
      const child = join(dir, entry)
      if (isDir(child)) queue.push({ dir: child, depth: depth + 1 })
    }
  }
  return found
}

/** 按 `*` 通配展开一层目录（例如 `C:\Program Files\Java\*\bin`）。 */
function expandPattern(pattern) {
  const segments = String(pattern).split(/[\\/]+/).filter((item) => item !== '')
  let current = ['']
  for (const segment of segments) {
    const next = []
    for (const base of current) {
      if (segment === '*') {
        for (const entry of safeReaddir(base === '' ? '.' : base)) {
          const child = base === '' ? entry : join(base, entry)
          if (isDir(child)) next.push(child)
        }
      } else {
        next.push(base === '' ? segment : join(base, segment))
      }
    }
    current = next.slice(0, MAX_PATTERN_EXPANSION)
    if (current.length === 0) return []
  }
  return current
}

/** 环境变量形式的根（`%LOCALAPPDATA%` / `$HOME` 由 process.env 解析）。 */
function envRoot(name) {
  return envValue(name)
}

function home() {
  return homedir()
}

/**
 * 常见安装目录 + 版本管理器目录。
 *
 * 只放「公认的安装落点」，不猜任意目录；每个平台各自一份清单。
 */
function commonPatterns() {
  const patterns = []
  if (IS_WIN) {
    const programFiles = envRoot('ProgramFiles') || 'C:\\Program Files'
    const programFilesX86 = envRoot('ProgramFiles(x86)') || 'C:\\Program Files (x86)'
    const localAppData = envRoot('LOCALAPPDATA') || join(home(), 'AppData', 'Local')
    const appData = envRoot('APPDATA') || join(home(), 'AppData', 'Roaming')
    const programData = envRoot('ProgramData') || 'C:\\ProgramData'
    const user = home()

    patterns.push(
      localAppData + '\\Programs\\*',
      localAppData + '\\Programs\\*\\bin',
      appData + '\\npm',
      localAppData + '\\Yarn\\bin',
      localAppData + '\\pnpm',
      localAppData + '\\Microsoft\\WindowsApps',
      programData + '\\chocolatey\\bin',
      user + '\\.scoop\\shims',
      user + '\\scoop\\shims',
      user + '\\.cargo\\bin',
      user + '\\go\\bin',
      user + '\\.dotnet',
      user + '\\.dotnet\\tools',
      user + '\\.pyenv\\pyenv-win\\shims',
      user + '\\.pyenv\\pyenv-win\\versions\\*\\Scripts',
      user + '\\.volta\\bin',
      user + '\\.bun\\bin',
      user + '\\.deno\\bin',
      user + '\\.jdks\\*\\bin',
      user + '\\.sdkman\\candidates\\*\\current\\bin',
      user + '\\AppData\\Roaming\\nvm',
      envRoot('NVM_HOME'),
      envRoot('NVM_SYMLINK'),
      join(programFiles, 'dotnet'),
      join(programFilesX86, 'dotnet'),
      join(programFiles, 'Java', '*', 'bin'),
      join(programFiles, 'Eclipse Adoptium', '*', 'bin'),
      join(programFiles, 'Microsoft', 'jdk-*', 'bin'),
      join(programFiles, 'Go', 'bin'),
      join(programFiles, 'nodejs'),
      join(programFiles, 'Git', 'bin'),
      join(programFilesX86, 'nodejs'),
      localAppData + '\\Programs\\Python\\*',
      localAppData + '\\Programs\\Python\\*\\Scripts',
      // ── C / C++ 常见落点（内网机器大多装 GUI 安装包，不在 PATH 上）──
      join(programFiles, 'CMake', 'bin'),
      localAppData + '\\Programs\\CMake\\bin',
      join(programFiles, 'LLVM', 'bin'),
      join(programFiles, 'Microsoft Visual Studio', '*', '*', 'Common7', 'IDE', 'CommonExtensions', 'Microsoft', 'CMake', 'CMake', 'bin'),
      join(programFiles, 'Microsoft Visual Studio', '*', '*', 'Common7', 'IDE', 'CommonExtensions', 'Microsoft', 'CMake', 'Ninja'),
      join(programFilesX86, 'Microsoft Visual Studio', '*', '*', 'Common7', 'IDE', 'CommonExtensions', 'Microsoft', 'CMake', 'CMake', 'bin'),
      // VS 自带的 cl.exe / MSBuild（需要先 source 开发人员命令行，但目录是固定的）
      join(programFiles, 'Microsoft Visual Studio', '*', '*', 'MSBuild', 'Current', 'Bin'),
      join(programFiles, 'Microsoft Visual Studio', '*', '*', 'VC', 'Tools', 'MSVC', '*', 'bin', 'Hostx64', 'x64'),
      // MSYS2 / MinGW：内网常见的手动解压式安装
      'C:\\msys64\\mingw64\\bin',
      'C:\\msys64\\usr\\bin',
      'C:\\msys2\\mingw64\\bin',
      'C:\\MinGW\\bin',
      'C:\\mingw64\\bin',
      'C:\\Program Files\\mingw64\\bin',
      // vcpkg 解析出来的 cmake / ninja 工具
      envRoot('VCPKG_ROOT') ? join(envRoot('VCPKG_ROOT'), 'downloads', 'tools') : ''
    )
    // 各 SDK 的 _HOME 环境变量指到哪就用哪。
    // 各 SDK 的 _HOME / 安装根变量指到哪就用哪（含 VS 的 VCINSTALLDIR / VCToolsInstallDir）。
    for (const name of [
      'JAVA_HOME', 'M2_HOME', 'GRADLE_HOME', 'GOROOT', 'DOTNET_ROOT', 'GOPATH', 'RUSTUP_HOME', 'CARGO_HOME',
      'VCPKG_ROOT', 'VCINSTALLDIR', 'VCToolsInstallDir', 'VSINSTALLDIR', 'CMAKE_ROOT',
    ]) {
      const value = envRoot(name)
      if (value !== '') patterns.push(join(value, 'bin'), join(value, 'Bin'), join(value, 'Common7', 'IDE'), value)
    }
  } else {
    patterns.push(
      '/usr/local/bin',
      '/usr/bin',
      '/bin',
      '/usr/local/go/bin',
      '/opt/homebrew/bin',
      '/opt/homebrew/opt/*/bin',
      '/opt/local/bin',
      '/opt/*/bin',
      '/usr/lib/jvm/*/bin',
      home() + '/.local/bin',
      home() + '/.cargo/bin',
      home() + '/go/bin',
      home() + '/.pyenv/shims',
      home() + '/.pyenv/versions/*/bin',
      home() + '/.nvm/versions/node/*/bin',
      home() + '/.volta/bin',
      home() + '/.bun/bin',
      home() + '/.deno/bin',
      home() + '/.sdkman/candidates/*/current/bin',
      home() + '/.rustup/toolchains/*/bin',
      home() + '/.dotnet',
      home() + '/.dotnet/tools',
    )
    for (const name of ['JAVA_HOME', 'GRADLE_HOME', 'GOROOT', 'DOTNET_ROOT', 'GOPATH', 'RUSTUP_HOME', 'CARGO_HOME', 'NVM_DIR', 'PYENV_ROOT', 'SDKMAN_DIR']) {
      const value = envRoot(name)
      if (value === '') continue
      patterns.push(join(value, 'bin'), join(value, 'shims'), join(value, 'versions', '*', 'bin'), value)
    }
  }

  return patterns.filter((item) => typeof item === 'string' && item.trim() !== '')
}


/**
 * Visual Studio「动态代码覆盖率」采集器的落点。
 *
 * 它不在 PATH，也不在标准 bin 下，而是 `<VS>\Team Tools\Dynamic Code Coverage Tools\amd64`。
 * 只装 Professional 的机器没有这个目录（旧版覆盖率是 Enterprise 功能），所以逐实例探测。
 *
 * 纯文件读取：VS 安装器把每个实例记在
 *   %ProgramData%\Microsoft\VisualStudio\Packages\_Instances\<id>\state.json
 * 的 installationPath 里，不依赖 vswhere 子进程。
 */
function vsCoverageDirs() {
  if (!IS_WIN) return []
  const found = []
  const programData = envRoot('ProgramData') || 'C:\\ProgramData'
  const instances = join(programData, 'Microsoft', 'VisualStudio', 'Packages', '_Instances')
  for (const entry of safeReaddir(instances)) {
    const stateFile = join(instances, entry, 'state.json')
    if (!isFile(stateFile)) continue
    let installPath = ''
    try {
      const parsed = JSON.parse(readFileSync(stateFile, 'utf8'))
      installPath = typeof parsed?.installationPath === 'string' ? parsed.installationPath.trim() : ''
    } catch {
      continue
    }
    if (installPath === '') continue
    const tools = join(installPath, 'Team Tools', 'Dynamic Code Coverage Tools')
    found.push(join(tools, 'amd64'), tools)
  }
  // 标准安装位置兜底（state.json 读不到时）。
  const programFiles = envRoot('ProgramFiles') || 'C:\\Program Files'
  const programFilesX86 = envRoot('ProgramFiles(x86)') || 'C:\\Program Files (x86)'
  for (const root of [programFiles, programFilesX86]) {
    found.push(join(root, 'Microsoft Visual Studio', '*', '*', 'Team Tools', 'Dynamic Code Coverage Tools', 'amd64'))
    found.push(join(root, 'Microsoft Visual Studio', '*', '*', 'Team Tools', 'Dynamic Code Coverage Tools'))
  }
  // VSINSTALLDIR / VCINSTALLDIR 指到的安装根。
  for (const key of ['VSINSTALLDIR', 'VCINSTALLDIR']) {
    const value = envRoot(key)
    if (value !== '') found.push(join(value, 'Team Tools', 'Dynamic Code Coverage Tools', 'amd64'))
  }
  return found.filter((item) => typeof item === 'string' && item.trim() !== '')
}


/** 特殊工具的固定落点（不进 commonPatterns，避免每次请求都扫）。 */
function specialToolDirs(name) {
  if (name === 'codecoverage') return vsCoverageDirs()
  return []
}


/** Windows 固定盘符（不 spawn，逐个 stat 探测）。 */
function windowsDriveRoots() {
  const roots = []
  for (const letter of 'CDEFGHIJKLMNOPQRSTUVWXYZ') {
    const root = `${letter}:\\`
    try {
      if (statSync(root).isDirectory()) roots.push(root)
    } catch {
      // 盘不存在或不可读（如空光驱），跳过
    }
  }
  return roots
}


/**
 * 兜底：在固定盘上做限深扫描，找 `Dynamic Code Coverage Tools` 目录。
 *
 * 为什么需要：客户环境不固定 —— 可能是 VS2017 默认装法，也可能是绿色包或
 * 自定义安装根。state.json 只记 VS 安装器装过的实例，漏网的靠这层扇底。
 * 只对 codecoverage 用，且带目录预算与进程内缓存，不影响其他工具的探测速度。
 */
function scanDrivesForCoverageTools() {
  if (!IS_WIN) return []
  const target = 'dynamic code coverage tools'
  const skipTop = new Set([
    'windows', '$recycle.bin', 'system volume information', 'recovery', 'perflogs',
    'users', 'programdata', 'program files', 'program files (x86)', 'temp', 'tmp',
  ])
  const found = []
  let budget = 2500
  const maxDepth = 4
  for (const root of windowsDriveRoots()) {
    const queue = [{ dir: root, depth: 0 }]
    while (queue.length > 0 && budget > 0) {
      const item = queue.shift()
      budget -= 1
      if (budget <= 0) break
      let entries = []
      try {
        entries = readdirSync(item.dir, { withFileTypes: true })
      } catch {
        continue
      }
      for (const entry of entries) {
        if (!entry.isDirectory()) continue
        const lower = entry.name.toLowerCase()
        if (item.depth === 0 && skipTop.has(lower)) continue
        const child = join(item.dir, entry.name)
        if (lower === target) {
          // 优先 64 位采集器：拿 32 位的去采 64 位进程会失败。
          const amd64 = join(child, 'amd64')
          if (isDir(amd64)) found.push(amd64)
          found.push(child)
          continue
        }
        if (item.depth < maxDepth && lower !== 'node_modules') {
          queue.push({ dir: child, depth: item.depth + 1 })
        }
      }
    }
  }
  return found
}


const deepScanCache = new Map()

/** 需要全盘兜底扫描的工具（目前只有 VS 覆盖率采集器）。 */
function deepToolDirs(name) {
  if (name !== 'codecoverage') return []
  if (!deepScanCache.has(name)) deepScanCache.set(name, scanDrivesForCoverageTools())
  return deepScanCache.get(name)
}

/**
 * 从一个候选（文件或目录）里取可执行文件。
 * 目录就用 <dir>/<name><ext> 拼；文件则要求名字对得上（显式覆盖时放宽）。
 */
function pickFrom(candidate, tool, { strict = false } = {}) {
  if (typeof candidate !== 'string' || candidate.trim() === '') return ''
  const value = candidate.trim()
  const names = toolNames(tool)
  if (isFile(value)) {
    if (!strict) return value
    const base = value.split(/[\\/]/).pop() || ''
    const lowered = base.toLowerCase()
    return names.some((name) => lowered === name.toLowerCase() || lowered === `${name.toLowerCase()}.exe`) ? value : ''
  }
  if (!isDir(value)) return ''
  for (const name of names) {
    for (const ext of EXE_EXTS) {
      const file = join(value, name + ext)
      if (isFile(file)) return file
    }
  }
  return ''
}

/**
 * 通用解析：返回可执行文件绝对路径，找不到返回空串。
 *
 * @param {string} tool - 工具名，如 `go` / `cargo` / `python`
 * @param {{ project?: string, extraDirs?: string[] }} [options]
 * @returns {string}
 */
export function resolveTool(tool, options = {}) {
  if (typeof tool !== 'string' || tool.trim() === '') return ''
  const name = tool.trim()
  const project = typeof options.project === 'string' ? options.project : ''

  // 1. 显式指定（人的意图最优先）。
  for (const candidate of envExplicitCandidates(name)) {
    const hit = pickFrom(candidate, name)
    if (hit !== '') return hit
  }

  // 1.5 自定义搜索目录（内网 / 非标准安装位置的逃生门，支持 `*` 通配）。
  for (const entry of customSearchDirs()) {
    for (const dir of entry.includes('*') ? expandPattern(entry) : [entry]) {
      const hit = pickFrom(dir, name)
      if (hit !== '') return hit
    }
  }

  // 1.6 特殊工具的固定落点（如 VS 覆盖率采集器，不在 PATH / 标准 bin 下）。
  for (const pattern of specialToolDirs(name)) {
    for (const dir of pattern.includes('*') ? expandPattern(pattern) : [pattern]) {
      const hit = pickFrom(dir, name)
      if (hit !== '') return hit
    }
  }
  // 2. 项目内 wrapper / 本地依赖：版本和项目一致时最准。
  for (const candidate of projectCandidates(name, project)) {
    const hit = pickFrom(candidate, name)
    if (hit !== '') return hit
  }

  // 3. SDK 根变量指到的 bin/。
  for (const candidate of envHomeCandidates(name)) {
    const hit = pickFrom(candidate, name)
    if (hit !== '') return hit
  }

  // 4. DSH 自带运行时（限深扫描，不写死结构）。
  for (const candidate of bundledCandidates(name)) {
    const hit = pickFrom(candidate, name)
    if (hit !== '') return hit
  }

  // 5. PATH。
  for (const dir of pathDirs()) {
    const hit = pickFrom(dir, name)
    if (hit !== '') return hit
  }

  // 6. 常见安装目录 + 版本管理器。
  for (const pattern of commonPatterns()) {
    for (const dir of pattern.includes('*') ? expandPattern(pattern) : [pattern]) {
      const hit = pickFrom(dir, name)
      if (hit !== '') return hit
    }
  }

  // 7. 兜底：固定盘限深扫描（仅极少数工具需要，带预算与进程内缓存）。
  for (const pattern of deepToolDirs(name)) {
    for (const dir of pattern.includes('*') ? expandPattern(pattern) : [pattern]) {
      const hit = pickFrom(dir, name)
      if (hit !== '') return hit
    }
  }

  return ''
}

/** 批量解析：`{ python: 'C:\\…', go: '' }`。 */
export function resolveTools(tools, options = {}) {
  const out = {}
  for (const tool of tools || []) {
    if (typeof tool !== 'string' || tool.trim() === '') continue
    const name = tool.trim()
    if (Object.hasOwn(out, name)) continue
    out[name] = resolveTool(name, options)
  }
  return out
}

/**
 * 解析一组工具需求，支持「任选其一」。
 *
 * spec 既可以是单个名字（`'go'`），也可以是一组等价实现（`['g++', 'clang++', 'cl']`）。
 * C/C++ 编译器官网装哪个都有可能，不能把某一个写死成必需的。
 *
 * @returns {{ resolved: Record<string, string>, missing: string[] }}
 *   resolved 的键：单名 -> 同名；组 -> `'g++|clang++|cl'`（命中时值是绝对路径）。
 */
export function resolveSpecs(specs, options = {}) {
  const resolved = {}
  const missing = []
  for (const spec of specs || []) {
    const names = (Array.isArray(spec) ? spec : [spec])
      .filter((item) => typeof item === 'string' && item.trim() !== '')
      .map((item) => item.trim())
    if (names.length === 0) continue
    const label = names.join('|')
    if (Object.hasOwn(resolved, label) || missing.includes(label)) continue
    let hit = ''
    for (const name of names) {
      hit = resolveTool(name, options)
      if (hit !== '') break
    }
    if (hit !== '') resolved[label] = hit
    else missing.push(label)
  }
  return { resolved, missing }
}

/** 把 spec 展开成所有候选工具名（供探活接口汇总用）。 */
export function specToolNames(spec) {
  const names = Array.isArray(spec) ? spec : [spec]
  return names
    .filter((item) => typeof item === 'string' && item.trim() !== '')
    .map((item) => item.trim())
}

/** 该工具在哪些「层级」里找过（写进接口响应，便于排查“为什么没找到”）。 */
export function searchLayers() {
  // 顺序与 resolveTool 的搜索阶梯一致：越靠前越可信。
  return ['env', 'custom-dirs', 'special-dirs', 'project', 'sdk-home', 'dsh-runtimes', 'path', 'common-install-dirs', 'drive-scan']
}

/** 是否是绝对路径（调用方拿到 runner.json 里的自定义工具路径时用得上）。 */
export function looksLikePath(value) {
  return typeof value === 'string' && value.trim() !== '' && isAbsolute(value.trim())
}
