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
import { join, isAbsolute, resolve } from 'node:path'

export const RUNNER_PROFILE_FILE = 'runner.json'

/** 内置预设：常见框架的默认测试文件位置与命令。项目可用 runner.json 覆盖任意字段。 */
export const PRESETS = Object.freeze({
  pytest: {
    id: 'pytest',
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
  },
  vitest: {
    id: 'vitest',
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
  },
  jest: {
    id: 'jest',
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
  },
  'node-test': {
    id: 'node-test',
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
    label: 'go test',
    language: 'go',
    testFile: 'project:tests/test_generated_test.go',
    mode: 'per-case',
    command: ['go', 'test', '-run', '^{target}$', '-v', './...'],
    targetEscape: true,
    targetExtract: ['\\bfunc\\s+(Test[A-Za-z0-9_]+)\\s*\\('],
    targetDeclare: '\\bfunc\\s+{target}\\s*\\(',
  },
  cargo: {
    id: 'cargo',
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
    label: 'dotnet test',
    language: 'csharp',
    testFile: 'project:GeneratedTests.cs',
    mode: 'per-case',
    command: ['dotnet', 'test', '--filter', 'Name~{target}', '--nologo'],
    targetExtract: ['\\b(?:void|Task)\\s+([A-Za-z_][A-Za-z0-9_]*)\\s*\\('],
    targetDeclare: '\\b{target}\\s*\\(',
  },
  maven: {
    id: 'maven',
    label: 'Maven Surefire',
    language: 'java',
    testFile: 'project:src/test/java/GeneratedTest.java',
    mode: 'per-case',
    command: ['mvn', '-q', '-Dtest={target}', 'test'],
    shell: 'win32',
    targetExtract: ['\\bvoid\\s+([A-Za-z_][A-Za-z0-9_]*)\\s*\\('],
    targetDeclare: '\\b{target}\\s*\\(',
  },
  gradle: {
    id: 'gradle',
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
})

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
    if (runner.targetCompose) {
      const composed = runner.targetCompose.replace(/\{(\d+)\}/g, (whole, index) => {
        const part = match[Number(index)]
        return typeof part === 'string' ? part.trim() : ''
      }).trim()
      if (composed !== '') return composed
      continue
    }
    if (typeof match[1] === 'string' && match[1].trim() !== '') return match[1].trim()
  }
  return ''
}

/** 测试文件里是否真的有这个目标；runner.json 没给规则时不做判断。 */
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
    /\{(python|node|npx|gradlew|binary|project|root|runId|runDir|file|junit)\}/g,
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
  let shell = runner.shell === true
  if (runner.shellOnlyWindows && process.platform !== 'win32') shell = false
  return {
    id: runner.id,
    label: runner.label,
    language: runner.language,
    mode: runner.mode,
    cwd: fillPlaceholders(runner.cwd, mergedCtx),
    command: fillList(runner.command, mergedCtx),
    targetArg: runner.targetArg,
    targetEscape: runner.targetEscape,
    junit,
    env: Object.fromEntries(Object.entries(runner.env || {}).map(([key, value]) => [key, fillPlaceholders(value, mergedCtx)])),
    shell,
    timeoutSec: runner.timeoutSec,
    notRunPattern: runner.notRunPattern,
    testFile: runner.testFile,
    binary,
    preCommand: fillList(runner.preCommand || [], mergedCtx),
    source: runner.source || '',
  }
}