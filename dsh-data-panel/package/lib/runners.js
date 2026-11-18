/**
 * 测试运行器（runner）适配层。
 *
 * 面板的「执行 / 全部执行」不直接认识 pytest、Jest、Go test……它只认一份
 * **运行器描述**：测试文件在哪、一次跑一条还是整批跑、命令怎么拼、逐条结果从哪来。
 *
 * 描述有两个来源：
 *   1. 项目在会话资产目录写的 `<root>/runner.json`（最可靠，Skill 知道项目语言）；
 *   2. 没有 runner.json 时按项目标记自动识别（内置 PRESETS）。
 *
 * 这样新增语言/框架 = 往 PRESETS 加一项，或让 Skill 写 runner.json；
 * 执行按钮、日志、结果、报告的链路一个字都不用改。
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { dirname, isAbsolute, join, resolve } from 'node:path'

export const RUNNER_PROFILE_FILE = 'runner.json'

/** 内置预设：常见框架的默认测试文件位置与命令。项目可用 runner.json 覆盖任意字段。 */
export const PRESETS = Object.freeze({
  pytest: {
    id: 'pytest',
    // 这个框架跑起来需要哪些可执行文件（由 lib/toolchain.js 通用解析，找不到会继续换层级找）。
    tools: ['python'],
    label: 'pytest',
    language: 'python',
    testFile: 'tests/test_generated.py',
    mode: 'batch',
    // {targets} 会被展开成每个用例的 targetArg；batch 模式一次进程跑完。
    command: [
      '{python}', '-m', 'pytest', '-s', '-v', '--tb=short', '--no-header', '-p', 'no:warnings',
      '--junitxml={junit}', '{targets}',
    ],
    targetArg: '{file}::{target}',
    junit: 'junit.xml',
    env: { PYTHONPATH: '{project}', PYTHONIOENCODING: 'utf-8', PYTHONUNBUFFERED: '1' },
    targetExtract: ['\\bdef\\s+(test_[A-Za-z0-9_]+)\\s*\\('],
    targetDeclare: '\\bdef\\s+{target}\\s*\\(',
    // 覆盖率：pytest-cov 产出 JSON（带行/分支统计）。没装 coverage.py 时 runner 会记下原因，不中断执行。
    coverage: {
      // cwd 已切到项目根，所以 `.` 就是被测源码范围；需要只测算某些目录就写 --cov=src。
      command: ['{python}', '-m', 'pytest', '-q', '--cov=.', '--cov-branch', '--cov-report=json:{coverageFile}', '{targets}'],
      format: 'coveragepy-json',
      file: 'coverage.json',
      hint: '需要 coverage.py 与 pytest-cov：python -m pip install coverage pytest-cov',
    },
  },
  vitest: {
    id: 'vitest',
    tools: ['node', 'npx'],
    label: 'Vitest',
    language: 'javascript',
    testFile: 'tests/test_generated.test.mjs',
    mode: 'per-case',
    command: ['{npx}', 'vitest', 'run', '{file}', '-t', '^{target}$'],
    shell: 'win32',
    targetEscape: true,
    targetExtract: [
      "\\b(?:it|test)(?:\\.(?:each|skip|only|concurrent|todo))?\\s*\\(\\s*['\"`]([^'\"`\\n]+)['\"`]",
    ],
    targetDeclare: '[\'"`]\\s*{target}\\s*[\'"`]',
    // 需要 @vitest/coverage-v8（或 istanbul）；未安装时降级为“未采集 + 原因”。
    coverage: {
      command: ['{npx}', 'vitest', 'run', '--coverage', '--coverage.reporter=json-summary', '--coverage.reportsDirectory={coverageDir}'],
      format: 'istanbul-summary',
      file: 'coverage/coverage-summary.json',
      hint: '需要 @vitest/coverage-v8：npm i -D @vitest/coverage-v8',
    },
  },
  jest: {
    id: 'jest',
    tools: ['node', 'npx'],
    label: 'Jest',
    language: 'javascript',
    testFile: 'tests/test_generated.test.js',
    mode: 'per-case',
    command: ['{npx}', 'jest', '{file}', '-t', '^{target}$'],
    shell: 'win32',
    targetEscape: true,
    targetExtract: [
      "\\b(?:it|test)(?:\\.(?:each|skip|only|concurrent|todo))?\\s*\\(\\s*['\"`]([^'\"`\\n]+)['\"`]",
    ],
    targetDeclare: '[\'"`]\\s*{target}\\s*[\'"`]',
    // 需要 @jest/coverage；未安装时降级为“未采集 + 原因”。
    coverage: {
      command: ['{npx}', 'jest', '--coverage', '--coverageReporters=json-summary', '--coverageDirectory={coverageDir}'],
      format: 'istanbul-summary',
      file: 'coverage/coverage-summary.json',
      hint: 'Jest 自带覆盖率，但项目里需要有可插桩的源码；也可以用 nyc',
    },
  },
  'node-test': {
    id: 'node-test',
    tools: ['node'],
    label: 'Node test runner',
    language: 'javascript',
    testFile: 'tests/test_generated.test.mjs',
    mode: 'per-case',
    command: ['{node}', '--test', '--test-name-pattern=^{target}$', '{file}'],
    targetEscape: true,
    // node --test 在没匹配到用例时退出码仍是 0，只能从汇总行判断。
    notRunPattern: '# pass 0\\b',
    targetExtract: [
      "\\b(?:it|test)(?:\\.(?:each|skip|only|concurrent|todo))?\\s*\\(\\s*['\"`]([^'\"`\\n]+)['\"`]",
    ],
    targetDeclare: '[\'"`]\\s*{target}\\s*[\'"`]',
  },
  go: {
    id: 'go',
    tools: ['go'],
    label: 'go test',
    language: 'go',
    testFile: 'project:tests/test_generated_test.go',
    mode: 'per-case',
    command: ['go', 'test', '-run', '^{target}$', '-v', './...'],
    targetEscape: true,
    targetExtract: ['\\bfunc\\s+(Test[A-Za-z0-9_]+)\\s*\\('],
    targetDeclare: '\\bfunc\\s+{target}\\s*\\(',
    // go 自带 -coverprofile，不需要插件；一次跑完全部包。
    coverage: {
      command: ['go', 'test', '-coverprofile={coverageFile}', './...'],
      format: 'go-cover',
      file: 'coverage.out',
      hint: 'go test 自带覆盖率，无需额外插件',
    },
  },
  cargo: {
    id: 'cargo',
    tools: ['cargo'],
    label: 'cargo test',
    language: 'rust',
    testFile: 'project:tests/generated.rs',
    mode: 'per-case',
    command: ['cargo', 'test', '{target}', '--', '--exact'],
    targetExtract: ['\\bfn\\s+(test_[A-Za-z0-9_]+)\\s*\\('],
    targetDeclare: '\\bfn\\s+{target}\\s*\\(',
  },
  dotnet: {
    id: 'dotnet',
    tools: ['dotnet'],
    label: 'dotnet test',
    language: 'csharp',
    testFile: 'project:GeneratedTests.cs',
    mode: 'per-case',
    command: ['dotnet', 'test', '--filter', 'Name~{target}', '--nologo'],
    targetExtract: ['\\b(?:void|Task)\\s+([A-Za-z_][A-Za-z0-9_]*)\\s*\\('],
    targetDeclare: '\\b{target}\\s*\\(',
    // coverlet.collector 产 cobertura XML（.NET 8 起需显式引用该包）。
    coverage: {
      command: ['dotnet', 'test', '--collect:XPlat Code Coverage', '--results-directory', '{coverageDir}'],
      format: 'cobertura',
      file: 'coverage/**/coverage.cobertura.xml',
      hint: '需要 coverlet.collector（dotnet add package coverlet.collector）',
    },
  },
  maven: {
    id: 'maven',
    tools: ['mvn'],
    label: 'Maven Surefire',
    language: 'java',
    testFile: 'project:src/test/java/GeneratedTest.java',
    mode: 'per-case',
    command: ['mvn', '-q', '-Dtest={target}', 'test'],
    shell: 'win32',
    targetExtract: ['\\bvoid\\s+([A-Za-z_][A-Za-z0-9_]*)\\s*\\('],
    targetDeclare: '\\b{target}\\s*\\(',
    // JaCoCo 需要 pom.xml 里已配置 jacoco-maven-plugin。
    coverage: {
      command: ['mvn', '-q', 'test', 'jacoco:report'],
      format: 'jacoco',
      file: 'project:target/site/jacoco/jacoco.xml',
      hint: '需要 pom.xml 配置 jacoco-maven-plugin',
    },
  },
  gradle: {
    id: 'gradle',
    tools: ['gradle'],
    label: 'Gradle Test',
    language: 'java',
    testFile: 'project:src/test/java/GeneratedTest.java',
    mode: 'per-case',
    command: ['{gradlew}', 'test', '--tests', '{target}'],
    shell: 'win32',
    targetExtract: ['\\bvoid\\s+([A-Za-z_][A-Za-z0-9_]*)\\s*\\('],
    targetDeclare: '\\b{target}\\s*\\(',
  },
  ctest: {
    id: 'ctest',
    // 已构建的项目只需 ctest；构建工具由实际 preCommand 决定。
    tools: ['ctest'],
    buildTools: ['cmake', ['g++', 'clang++', 'cl']],
    label: 'CTest',
    language: 'cpp',
    testFile: 'project:tests/generated_test.cpp',
    mode: 'per-case',
    command: ['ctest', '-R', '^{target}$', '--output-on-failure'],
    targetEscape: true,
    targetExtract: ['\\bTEST(?:_F)?\\s*\\(\\s*([A-Za-z0-9_]+)\\s*,'],
    targetDeclare: '\\bTEST(?:_F)?\\s*\\(\\s*{target}\\s*,',
  },
  gtest: {
    id: 'gtest',
    // 直接执行已构建的 binary；构建工具由实际 preCommand 决定。
    tools: [],
    buildTools: ['cmake', ['g++', 'clang++', 'cl']],
    label: 'GoogleTest',
    language: 'cpp',
    testFile: 'project:tests/generated_test.cpp',
    mode: 'per-case',
    // 需要项目先构建出测试可执行文件；实际路径用 runner.json 的 binary 覆盖。
    binary: 'project:build/tests/generated_test',
    command: ['{binary}', '--gtest_filter={target}', '--gtest_color=no'],
    // gtest 在“没有匹配到用例”时也返回 0，从汇总行判断。
    notRunPattern: '\\[==========\\] Running 0 tests?',
    // TEST / TEST_F / TEST_P(Suite, Name) → Suite.Name
    targetExtract: [
      '\\bTEST(?:_F|_P)?\\s*\\(\\s*([A-Za-z_][A-Za-z0-9_]*)\\s*,\\s*([A-Za-z_][A-Za-z0-9_]*)\\s*\\)',
    ],
    targetCompose: '{1}.{2}',
    targetDeclare: '\\bTEST(?:_F|_P)?\\s*\\(\\s*{target}\\s*\\)',
    targetDotted: true,
  },
  meson: {
    id: 'meson',
    // Meson 构建 + `meson test` 跑。测试名用 TEST(...) 提取（与 gtest 一致）。
    tools: ['meson', 'ninja'],
    label: 'Meson test',
    language: 'cpp',
    testFile: 'project:tests/generated_test.cpp',
    mode: 'per-case',
    // {project} 是占位符，cwd 已切到项目根，所以 build/ 指项目的构建目录。
    command: ['meson', 'test', '-C', 'build', '{target}'],
    targetExtract: ['\\bTEST(?:_F)?\\s*\\(\\s*([A-Za-z0-9_]+)\\s*,'],
    targetDeclare: '\\bTEST(?:_F)?\\s*\\(\\s*{target}\\s*,',
  },
})

/**
 * 所有 preset 声明过的工具名（去重）。
 *
 * 面板的 /data-panel/tools 按这个清单逐项探测，所以新增 preset 时只要写了
 * `tools: [...]`，探活接口就自动覆盖它 —— 不用再改探测代码。
 */
export const PRESET_TOOLS = Object.freeze(
  [...new Set(
    Object.values(PRESETS)
      .flatMap((preset) => [...(preset.tools || []), ...(preset.buildTools || [])])
      // tools 的每一项可能是名字，也可能是「任选其一」的组；这里展开成扁平的名字清单。
      .flatMap((spec) => (Array.isArray(spec) ? spec : [spec])),
  )].sort(),
)

/** 把正则里的字面量转义，用户写的用例名/函数名可以安全拼进 pattern。 */
export function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function readJsonFile(file) {
  const raw = readFileSync(file, 'utf8').replace(/^\uFEFF/, '')
  try {
    return JSON.parse(raw)
  } catch (error) {
    throw new Error(`${file} 不是合法 JSON：${error instanceof Error ? error.message : String(error)}`)
  }
}

function isFile(file) {
  try {
    return existsSync(file)
  } catch {
    return false
  }
}

const PYTHON_MARKERS = ['pyproject.toml', 'pytest.ini', 'tox.ini', 'setup.cfg', 'conftest.py', 'setup.py']

/** 项目里有没有 Python 测试的迹象（只看浅层，避免扫整个仓库）。 */
function looksPython(project) {
  for (const marker of PYTHON_MARKERS) {
    if (isFile(join(project, marker))) return true
  }
  const dirs = [project, join(project, 'tests'), join(project, 'src'), join(project, 'test')]
  for (const dir of dirs) {
    try {
      const names = readdirSync(dir)
      if (names.some((name) => name.endsWith('.py'))) return true
    } catch {
      // 目录不存在就跳过。
    }
  }
  return false
}

function packageDeps(project) {
  const file = join(project, 'package.json')
  if (!isFile(file)) return null
  try {
    const pkg = readJsonFile(file)
    return { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) }
  } catch {
    return null
  }
}

function hasRootMatch(project, pattern) {
  try {
    return readdirSync(project).some((name) => pattern.test(name))
  } catch {
    return false
  }
}

/**
 * 按项目标记识别框架。只在没有 runner.json 时使用；
 * 识别不出来就返回空串，由调用方给出「请写 runner.json」的明确提示。
 */
export function detectPreset({ project }) {
  const has = (rel) => isFile(join(project, rel))

  if (has('go.mod')) return 'go'
  if (has('Cargo.toml')) return 'cargo'
  if (has('pom.xml')) return 'maven'
  if (has('build.gradle') || has('build.gradle.kts')) return 'gradle'
  if (hasRootMatch(project, /\.(csproj|sln)$/i)) return 'dotnet'
  if (has('CMakeLists.txt')) {
    // CMake 里显式引了 GoogleTest 就优先直接跑 gtest 可执行文件；
    // 否则交给 CTest（ctest 只负责运行已经注册的用例）。
    try {
      const cmake = readFileSync(join(project, 'CMakeLists.txt'), 'utf8')
      if (/\b(?:gtest|googletest)\b/i.test(cmake)) return 'gtest'
    } catch {
      // 读不到就按 CTest 处理。
    }
    return 'ctest'
  }
  if (has('meson.build')) return 'meson'

  const deps = packageDeps(project)
  if (deps !== null) {
    if (deps.vitest) return 'vitest'
    if (deps.jest || deps['@jest/core']) return 'jest'
    // package.json 但没有已知测试依赖：只有项目里没有 Python 迹象时才当 Node 项目。
    if (!looksPython(project)) return 'node-test'
  }

  if (looksPython(project)) return 'pytest'
  return ''
}

/** 读 `<root>/runner.json`；不存在返回 null。 */
export function loadProfile(root) {
  const file = join(root, RUNNER_PROFILE_FILE)
  if (!isFile(file)) return null
  const parsed = readJsonFile(file)
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`${file} 必须是一个 JSON 对象`)
  }
  return parsed
}

/** `project:xxx` / `root:xxx` / 绝对路径 / 相对会话资产目录。 */
export function resolveSpecPath(value, { project, root }) {
  const raw = String(value)
  if (/^project:/i.test(raw)) return resolve(project, raw.slice('project:'.length))
  if (/^root:/i.test(raw)) return resolve(root, raw.slice('root:'.length))
  if (isAbsolute(raw)) return resolve(raw)
  return resolve(root, raw)
}
/**
 * `tools` 的校验：每项是工具名，或是「任选其一」的工具名数组。
 *
 * 为什么允许数组：C/C++ 编译器可能是 g++ / clang++ / cl 任一种，
 * 要求三个都装才是错的。runner.json 自定义时也能这样写。
 */
function toolSpecs(value, field) {
  if (value === undefined) return []
  if (!Array.isArray(value)) throw new Error(`runner.json 的 ${field} 必须是数组`)
  return value.map((item) => {
    if (typeof item === 'string') return item
    if (Array.isArray(item) && item.length > 0 && item.every((name) => typeof name === 'string')) {
      return item.slice()
    }
    throw new Error(`runner.json 的 ${field} 每项必须是工具名，或「任选其一」的工具名数组`)
  })
}

/**
 * 覆盖率采集配置。
 *
 * 形状（runner.json 可覆盖）：
 *   { command: [...], format: 'cobertura', file: 'coverage.xml', timeoutSec: 900 }
 *
 * - command：跑一次全量测试并产出覆盖率报告；可用 {coverageFile} / {coverageDir} 占位符
 * - format ：解析器名，见 run_tests.py 的 COVERAGE_PARSERS
 * - file   ：报告文件（相对 runDir，或 project: / root: / 绝对路径；支持 `*` 通配）
 *
 * 声明了但工具没装时，runner 会把原因写进 result.json，报告里显示「未采集（原因）」，
 * 不会因为它失败就整个执行失败。
 */
function normalizeCoverage(value) {
  if (value === undefined || value === null) return null
  if (typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('runner.json 的 coverage 必须是对象')
  }
  const command = stringList(value.command, 'coverage.command')
  if (command.length === 0) throw new Error('coverage.command 不能为空')
  const format = typeof value.format === 'string' ? value.format.trim() : ''
  if (format === '') throw new Error('coverage.format 不能为空（如 cobertura / lcov / jacoco / coveragepy-json / go-cover / istanbul-summary）')
  const file = typeof value.file === 'string' ? value.file.trim() : ''
  if (file === '') throw new Error('coverage.file 不能为空（覆盖率报告文件路径）')
  const timeoutSec = Number.isFinite(value.timeoutSec) && value.timeoutSec > 0
    ? Math.floor(value.timeoutSec)
    : 900
  // 采不到时告诉用户“装什么”，比只说“没报告”有用。
  const hint = typeof value.hint === 'string' ? value.hint.trim() : ''
  return { command, format, file, timeoutSec, hint }
}

function stringList(value, field) {
  if (value === undefined) return []
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) {
    throw new Error(`runner.json 的 ${field} 必须是字符串数组`)
  }
  return value.slice()
}

function stringMap(value, field) {
  if (value === undefined) return {}
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`runner.json 的 ${field} 必须是对象`)
  }
  const out = {}
  for (const [key, item] of Object.entries(value)) {
    if (typeof item !== 'string') throw new Error(`runner.json 的 ${field}.${key} 必须是字符串`)
    out[key] = item
  }
  return out
}

/**
 * 解析本次执行要用的运行器。
 *
 * @returns 规范化后的描述；`testFile` 已是绝对路径。
 * @throws 没有可用运行器、或 runner.json 不合法时，抛出带中文说明的 Error。
 */
export function resolveRunner({ project, root }) {
  const profile = loadProfile(root)
  let presetId = ''
  if (profile !== null) {
    if (profile.preset !== undefined) {
      presetId = String(profile.preset)
      if (!PRESETS[presetId]) {
        throw new Error(`runner.json 的 preset "${presetId}" 不是内置框架；可用：${Object.keys(PRESETS).join(' / ')}`)
      }
    }
  } else {
    const detected = detectPreset({ project })
    // 没有识别出框架时，用本会话已生成的测试文件兜底（避免“明明有测试却报无法识别”）。
    const order = detected ? [detected] : Object.keys(PRESETS)
    const withFile = order.find((id) => isFile(resolveSpecPath(PRESETS[id].testFile, { project, root })))
    if (withFile && (detected === '' || withFile === detected)) {
      presetId = withFile
    } else if (detected !== '') {
      presetId = detected
    } else {
      throw new Error(
        '无法识别项目的测试框架。请在会话资产目录写 runner.json 声明测试文件与命令'
        + '（见插件的 README「runner.json」一节），或先生成测试代码。',
      )
    }
  }

  const base = presetId ? PRESETS[presetId] : null
  const merged = {
    ...(base || {}),
    ...(profile || {}),
    env: { ...((base && base.env) || {}), ...((profile && profile.env) || {}) },
  }
  const id = String(merged.id || presetId || 'custom')
  const label = String(merged.label || id)
  const language = String(merged.language || 'unknown')

  const mode = merged.mode === undefined ? 'per-case' : String(merged.mode)
  if (mode !== 'batch' && mode !== 'per-case') {
    throw new Error(`runner.json 的 mode 只能是 "batch" 或 "per-case"，收到 "${mode}"`)
  }

  const testFileRaw = merged.testFile
  if (typeof testFileRaw !== 'string' || testFileRaw.trim() === '') {
    throw new Error('runner.json 缺少 testFile：需要指向本会话生成的测试代码文件')
  }
  const testFile = resolveSpecPath(testFileRaw.trim(), { project, root })

  const command = stringList(merged.command, 'command')
  if (command.length === 0) {
    throw new Error('runner.json 缺少 command：需要一个字符串数组（{file} / {target} / {targets} 会被替换）')
  }
  if (mode === 'batch' && !command.some((token) => token.includes('{targets}'))) {
    throw new Error('batch 模式的 command 必须包含 {targets}：它会展开成本次所有用例的目标')
  }
  if (mode === 'per-case' && !command.some((token) => token.includes('{target}'))) {
    throw new Error('per-case 模式的 command 必须包含 {target}：它会替换成单条用例的测试函数/测试名')
  }

  const targetArg = String(merged.targetArg || '{file}::{target}')
  if (mode === 'batch' && targetArg.trim() === '') {
    throw new Error('batch 模式的 targetArg 不能为空')
  }

  let binary = typeof merged.binary === 'string' ? merged.binary.trim() : ''
  if (binary !== '') {
    binary = resolveSpecPath(binary, { project, root })
    // Windows 上可执行文件通常带 .exe，未写扩展名时补上。
    if (process.platform === 'win32' && !/\.[A-Za-z0-9]+$/.test(binary)) binary += '.exe'
  }
  const preCommand = stringList(merged.preCommand, 'preCommand')

  return {
    id,
    label,
    language,
    mode,
    testFile,
    command,
    targetArg,
    targetsSeparator: typeof merged.targetsSeparator === 'string' ? merged.targetsSeparator : ' ',
    binary,
    preCommand,
    targetCompose: typeof merged.targetCompose === 'string' ? merged.targetCompose : '',
    targetDotted: merged.targetDotted === true,
    junit: typeof merged.junit === 'string' ? merged.junit.trim() : '',
    cwd: typeof merged.cwd === 'string' && merged.cwd.trim() !== '' ? merged.cwd.trim() : '{project}',
    env: stringMap(merged.env, 'env'),
    shell: merged.shell === true || merged.shell === 'win32',
    shellOnlyWindows: merged.shell === 'win32',
    timeoutSec: Number.isFinite(merged.timeoutSec) && merged.timeoutSec > 0 ? Math.floor(merged.timeoutSec) : 1800,
    targetEscape: merged.targetEscape === true,
    targetExtract: Array.isArray(merged.targetExtract)
      ? stringList(merged.targetExtract, 'targetExtract')
      : (typeof merged.targetExtract === 'string' ? [merged.targetExtract] : []),
    targetDeclare: typeof merged.targetDeclare === 'string' ? merged.targetDeclare : '',
    notRunPattern: typeof merged.notRunPattern === 'string' ? merged.notRunPattern : '',
    // 这个运行器需要哪些可执行文件；找不到时面板要能说清楚缺哪个（而不是笼统地说“环境不对”）。
    tools: toolSpecs(merged.tools, 'tools'),
    // 覆盖率采集（可选）：一条命令 + 一个报告文件 + 解析格式。没有就是“不采集”。
    coverage: normalizeCoverage(merged.coverage),
    source: profile !== null ? 'runner.json' : (`auto:${presetId}`),
  }
}

/**
 * 用例 → 测试函数/测试名。
 * 面板里没有 testFunc 字段时，从用例代码里按当前框架的规则推断。
 */
export function targetOf(record, runner) {
  const explicit = typeof record?.testFunc === 'string' ? record.testFunc.trim() : ''
  if (explicit !== '') return explicit
  const code = typeof record?.code === 'string' ? record.code : ''
  if (code === '') return ''
  for (const source of runner.targetExtract) {
    let match = null
    try {
      match = new RegExp(source, 'm').exec(code)
    } catch {
      continue
    }
    if (!match) continue
    const target = targetFromMatch(match, runner)
    if (target !== '') return target
  }
  return ''
}

/** 提取与定位共用同一套捕获组和组合规则，避免测试名漂移。 */
function targetFromMatch(match, runner) {
  if (runner.targetCompose) {
    return runner.targetCompose.replace(/\{(\d+)\}/g, (whole, index) => {
      const part = match[Number(index)]
      return typeof part === 'string' ? part.trim() : ''
    }).trim()
  }
  return typeof match[1] === 'string' ? match[1].trim() : ''
}

/** 优先定位同名测试声明；无法提取时沿用原有声明规则。 */
export function targetLine(testText, target, runner) {
  for (const source of runner.targetExtract || []) {
    try {
      for (const match of testText.matchAll(new RegExp(source, 'gm'))) {
        if (targetFromMatch(match, runner) === target) {
          return testText.slice(0, match.index).split('\n').length
        }
      }
    } catch {
      // 自定义提取规则无效时继续尝试其他规则及原有定位方式。
    }
  }
  if (!runner.targetDeclare) return 0
  const replacement = runner.targetDotted
    ? String(target).split('.').map((part) => escapeRegExp(part)).join('\\s*,\\s*')
    : escapeRegExp(target)
  const pattern = runner.targetDeclare.split('{target}').join(replacement)
  try {
    const match = new RegExp(pattern, 'm').exec(testText)
    return match ? testText.slice(0, match.index).split('\n').length : 0
  } catch {
    return 0
  }
}

export function targetDeclared(testText, target, runner) {
  if (!runner.targetDeclare) return true
  const replacement = runner.targetDotted
    ? String(target).split('.').map((part) => escapeRegExp(part)).join('\\s*,\\s*')
    : escapeRegExp(target)
  const pattern = runner.targetDeclare.split('{target}').join(replacement)
  try {
    return new RegExp(pattern, 'm').test(testText)
  } catch {
    return true
  }
}

function fillPlaceholders(value, ctx) {
  return String(value).replace(
    /\{(python|node|npx|gradlew|binary|project|root|runId|runDir|file|junit|coverageFile|coverageDir)\}/g,
    (whole, key) => (typeof ctx[key] === 'string' ? ctx[key] : whole),
  )
}

function fillList(list, ctx) {
  return list.map((item) => fillPlaceholders(item, ctx))
}

/**
 * 把运行器描述渲染成 request.json 里的 `runner` 字段。
 * 只解析路径/运行时等宿主已知的占位符，{target} / {targets} 留给 runner 展开。
 */
export function renderRunnerSpec(runner, ctx) {
  let junit = ''
  if (runner.junit) {
    if (/^project:/i.test(runner.junit)) junit = resolve(ctx.project, runner.junit.slice('project:'.length))
    else if (/^root:/i.test(runner.junit)) junit = resolve(ctx.root, runner.junit.slice('root:'.length))
    else if (isAbsolute(runner.junit)) junit = resolve(runner.junit)
    else junit = resolve(ctx.runDir, runner.junit)
  }
  const binary = typeof ctx.binary === 'string' && ctx.binary !== '' ? ctx.binary : (runner.binary || '')
  const mergedCtx = { ...ctx, binary, file: runner.testFile, junit }
  const command = fillList(runner.command, mergedCtx)
  const preCommand = fillList(runner.preCommand || [], mergedCtx)
  // 探测到的工具必须真正用于执行；只替换 argv 的可执行文件，不改参数文本。
  const useResolvedExecutable = (argv) => {
    if (argv.length === 0) return argv
    const found = ctx.tools && ctx.tools[argv[0]]
    return found ? [found, ...argv.slice(1)] : argv
  }
  const renderedCommand = useResolvedExecutable(command)
  const renderedPreCommand = useResolvedExecutable(preCommand)
  let shell = runner.shell === true
  if (runner.shellOnlyWindows && process.platform !== 'win32') shell = false
  if (process.platform === 'win32' && [renderedCommand[0], renderedPreCommand[0]].some((file) => /\.(?:cmd|bat)$/i.test(file || ''))) shell = true

  // ── 覆盖率：把报告路径先落到 runDir 下，再渲染命令 ──
  let coverage = null
  if (runner.coverage !== null && runner.coverage !== undefined) {
    const raw = String(runner.coverage.file || '').trim()
    let coverageFile = ''
    if (raw !== '') {
      if (/^project:/i.test(raw)) coverageFile = resolve(ctx.project, raw.slice('project:'.length))
      else if (/^root:/i.test(raw)) coverageFile = resolve(ctx.root, raw.slice('root:'.length))
      else if (isAbsolute(raw)) coverageFile = resolve(raw)
      else coverageFile = resolve(ctx.runDir, raw)
    }
    const coverageCtx = { ...mergedCtx, coverageFile, coverageDir: coverageFile === '' ? '' : dirname(coverageFile) }
    const coverageCommand = useResolvedExecutable(fillList(runner.coverage.command || [], coverageCtx))
    // 通配符不展开：由 runner 在报告生成后再去找文件（不同框架落盘时间不同）。
    coverage = {
      command: coverageCommand,
      format: String(runner.coverage.format || ''),
      file: coverageFile,
      timeoutSec: runner.coverage.timeoutSec,
      hint: runner.coverage.hint || '',
    }
  }
  return {
    id: runner.id,
    label: runner.label,
    language: runner.language,
    mode: runner.mode,
    cwd: fillPlaceholders(runner.cwd, mergedCtx),
    command: renderedCommand,
    targetArg: runner.targetArg,
    targetsSeparator: runner.targetsSeparator,
    targetEscape: runner.targetEscape,
    junit,
    env: Object.fromEntries(Object.entries(runner.env || {}).map(([key, value]) => [key, fillPlaceholders(value, mergedCtx)])),
    shell,
    timeoutSec: runner.timeoutSec,
    notRunPattern: runner.notRunPattern,
    testFile: runner.testFile,
    binary,
    preCommand: renderedPreCommand,
    coverage,
    source: runner.source || '',
  }
}
