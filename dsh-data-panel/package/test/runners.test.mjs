/**
 * dsh-data-panel 运行器适配层 + 执行准备/执行的自动化测试。
 *
 * 覆盖三件事：
 *   1. 框架识别、目标提取、runner.json 合并与命令渲染（纯函数）；
 *   2. Python/pytest 的完整链路（prepare → run_tests.py → result.json）；
 *   3. Node test runner 的完整链路，证明执行链路不依赖 Python 项目。
 *
 * 运行：node --test test
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { Readable } from 'node:stream'

// 测试不能写用户真实的 DSH_HOME；但先用它找到 DSH 自带的 Python。
const REAL_DSH_HOME = process.env.DSH_HOME || join(homedir(), '.dsh')
const BUNDLED_PYTHON = join(
  REAL_DSH_HOME, 'dsh-runtimes', 'dsh-primary-runtime', 'dependencies', 'python',
  process.platform === 'win32' ? 'python.exe' : 'python3',
)
const TEST_HOME = mkdtempSync(join(tmpdir(), 'dsh-panel-home-'))
process.env.DSH_HOME = TEST_HOME
process.env.DSH_PYTHON_PATH = existsSync(BUNDLED_PYTHON)
  ? BUNDLED_PYTHON
  : (process.env.DSH_PYTHON_PATH || (process.platform === 'win32' ? 'python' : 'python3'))

const { __test } = await import('../lib/index.js')
const { PRESETS, detectPreset, targetOf, targetDeclared, targetLine, resolveRunner, renderRunnerSpec, escapeRegExp } =
  await import('../lib/runners.js')
const { scopeInventory } = await import('../lib/scope.js')

const tempDirs = []
test('结构化变量在面板保存和导出时保持真实名称及取值', async () => {
  const record = __test.normalizeStored(makeRecord({
    inputVariables: [{ name: 'member_level', value: 'Platinum' }],
    expectedOutputs: [{ name: 'discount', value: '50.0' }],
  }))
  const patched = __test.normalizePatch({ ...record, title: '更新后的用例' }, record)
  const file = join(makeDir('dsh-report-vars-'), 'cases.json')
  const cases = await __test.exportCases({ records: [patched] }, file)
  assert.deepEqual(cases[0].inputVariables, [{ name: 'member_level', value: 'Platinum' }])
  assert.deepEqual(cases[0].expectedOutputs, [{ name: 'discount', value: '50.0' }])
})
function makeDir(prefix) {
  const dir = mkdtempSync(join(tmpdir(), prefix))
  tempDirs.push(dir)
  return dir
}

function write(file, content) {
  mkdirSync(join(file, '..'), { recursive: true })
  writeFileSync(file, content, 'utf8')
}

function makeRecord(overrides) {
  return {
    id: 'rec_test',
    caseId: 'TC-1',
    title: '用例',
    testType: 'functional',
    description: '',
    input: '',
    expected: '',
    code: '',
    codeRef: '',
    demo: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  }
}

function runPrepared(prep) {
  // 直接跑面板给出的整条命令，顺带验证它对 shell 是可直接执行的。
  // 注意：面板生成的命令面向 DSH 的 PowerShell（带引号的路径必须用 & 调用运算符），
  // 所以这里用 PowerShell 跑；用 cmd 会报 “& was unexpected at this time.”。
  // 测试进程本身在 node --test 下，子进程要清掉 NODE_TEST_CONTEXT，否则 node --test 会认为自己在递归。
  const env = { ...process.env }
  delete env.NODE_TEST_CONTEXT
  if (process.platform === 'win32') {
    // PowerShell 不会自动透传子进程退出码（非零会变成 1），所以显式 exit $LASTEXITCODE，
    // 否则测退出码的用例会误报。
    const script = `${prep.command}\nexit $LASTEXITCODE`
    return spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], {
      encoding: 'utf8',
      timeout: 120000,
      env,
    })
  }
  return spawnSync(prep.command, { shell: true, encoding: 'utf8', timeout: 120000, env })
}

test.after(() => {
  for (const dir of tempDirs) {
    try {
      rmSync(dir, { recursive: true, force: true })
    } catch {
      // 清理失败不影响结论。
    }
  }
  try {
    rmSync(TEST_HOME, { recursive: true, force: true })
  } catch {
    // 同上。
  }
})

test('detectPreset：按项目标记识别常见框架', () => {
  const go = makeDir('panel-go-')
  write(join(go, 'go.mod'), 'module demo\n')
  assert.equal(detectPreset({ project: go }), 'go')

  const py = makeDir('panel-py-')
  write(join(py, 'pyproject.toml'), '[tool.pytest.ini_options]\n')
  assert.equal(detectPreset({ project: py }), 'pytest')

  const js = makeDir('panel-js-')
  write(join(js, 'package.json'), JSON.stringify({ devDependencies: { vitest: '^1.0.0' } }))
  assert.equal(detectPreset({ project: js }), 'vitest')

  const node = makeDir('panel-node-')
  write(join(node, 'package.json'), JSON.stringify({ type: 'module' }))
  assert.equal(detectPreset({ project: node }), 'node-test')

  const empty = makeDir('panel-empty-')
  assert.equal(detectPreset({ project: empty }), '')

  const gtestCmake = makeDir('panel-cmake-gtest-')
  write(join(gtestCmake, 'CMakeLists.txt'), 'cmake_minimum_required(VERSION 3.20)\nfind_package(GTest REQUIRED)\n')
  assert.equal(detectPreset({ project: gtestCmake }), 'gtest')

  const plainCmake = makeDir('panel-cmake-plain-')
  write(join(plainCmake, 'CMakeLists.txt'), 'cmake_minimum_required(VERSION 3.20)\nproject(demo)\n')
  assert.equal(detectPreset({ project: plainCmake }), 'ctest')
})

test('targetOf：按框架规则从用例代码里提取目标，显式 testFunc 优先', () => {
  const pytest = { targetExtract: PRESETS.pytest.targetExtract }
  assert.equal(targetOf({ code: 'def test_add():\n    pass' }, pytest), 'test_add')
  assert.equal(targetOf({ code: 'def helper():\n    pass' }, pytest), '')
  assert.equal(targetOf({ code: '', testFunc: 'explicit' }, pytest), 'explicit')

  const node = { targetExtract: PRESETS['node-test'].targetExtract }
  assert.equal(targetOf({ code: "it('adds two numbers', () => {})" }, node), 'adds two numbers')
  assert.equal(targetOf({ code: "test(`模板名`, () => {})" }, node), '模板名')

  const go = { targetExtract: PRESETS.go.targetExtract }
  assert.equal(targetOf({ code: 'func TestAdd(t *testing.T) {}' }, go), 'TestAdd')
})

test('targetDeclared：按框架规则校验测试文件里确实有该目标', () => {
  const pytest = { targetDeclare: PRESETS.pytest.targetDeclare }
  assert.equal(targetDeclared('def test_a():\n    pass\n', 'test_a', pytest), true)
  assert.equal(targetDeclared('def test_b():\n    pass\n', 'test_a', pytest), false)

  const node = { targetDeclare: PRESETS['node-test'].targetDeclare }
  assert.equal(targetDeclared("it('adds', () => {})", 'adds', node), true)
  assert.equal(targetDeclared("it('adds', () => {})", 'subs', node), false)
})

test('gtest：TEST(Suite, Name) 组合成 Suite.Name，并按逗号形式校验', () => {
  const gtest = { ...PRESETS.gtest }
  assert.equal(targetOf({ code: 'TEST(Suite, Pass) { EXPECT_EQ(1, 1); }' }, gtest), 'Suite.Pass')
  assert.equal(targetOf({ code: 'TEST_F(Fixture, Works) {}' }, gtest), 'Fixture.Works')
  assert.equal(targetDeclared('TEST(Suite, Pass) {}', 'Suite.Pass', gtest), true)
  assert.equal(targetDeclared('TEST(Suite, Pass) {}', 'Suite.Other', gtest), false)
  assert.equal(targetLine('// generated\nTEST(Suite, Pass) {}', 'Suite.Pass', gtest), 2)
  assert.equal(targetLine('TEST(Suite, Other) {}\nTEST_F(Suite, Pass) {}', 'Suite.Pass', gtest), 2)
})

test('查看 JS 测试：跳过注册表并按完整测试名找到后续声明', () => {
  const text = [
    'const cases = ["adds", "adds [1]+", "subs"];',
    'test("adds", () => {});',
    'test.only("subs", () => {});',
    'it.skip("adds [1]+", () => {});',
  ].join('\r\n')
  for (const preset of ['vitest', 'jest', 'node-test']) {
    const runner = PRESETS[preset]
    assert.equal(targetLine(text, 'adds', runner), 2)
    assert.equal(targetLine(text, 'subs', runner), 3)
    assert.equal(targetLine(text, 'adds [1]+', runner), 4)
    assert.equal(targetDeclared(text, 'adds [1]+', runner), true)
  }
})

test('查看测试：缺少、无效或未命中的提取规则沿用原定位方式', () => {
  const text = '// header\nregister("custom");'
  const targetDeclare = '[\'"]{target}[\'"]'
  for (const targetExtract of [undefined, [], ['['], PRESETS.pytest.targetExtract, ['(?=.)']]) {
    assert.equal(targetLine(text, 'custom', { targetDeclare, targetExtract }), 2)
  }
  assert.equal(targetLine(text, 'missing', { targetDeclare }), 0)
  assert.equal(targetLine(text, 'custom', {}), 0)
})

test('查看测试：忽略无效规则并按捕获组组合目标名', () => {
  const runner = { ...PRESETS.gtest, targetExtract: ['[', ...PRESETS.gtest.targetExtract] }
  assert.equal(targetLine('TEST(Suite, Other) {}\nTEST(Suite, Pass) {}', 'Suite.Pass', runner), 2)
  assert.equal(targetOf({ code: 'TEST(Suite, Pass) {}' }, runner), 'Suite.Pass')
})

test('resolveRunner：runner.json 可以覆盖预置，也可以完全自定义', () => {
  const project = makeDir('panel-custom-')
  const root = join(project, '.dsh', 'test-sessions', 's1')
  mkdirSync(root, { recursive: true })

  assert.throws(() => resolveRunner({ project, root }), /无法识别项目的测试框架/)

  write(join(root, 'runner.json'), JSON.stringify({
    label: 'RSpec',
    language: 'ruby',
    testFile: 'tests/generated_spec.rb',
    mode: 'per-case',
    command: ['rspec', '{file}', '-e', '{target}'],
    targetExtract: ['it\\s+[\'"]([^\'"]+)[\'"]'],
    targetDeclare: '[\'"]{target}[\'"]',
  }))
  const custom = resolveRunner({ project, root })
  assert.equal(custom.id, 'custom')
  assert.equal(custom.label, 'RSpec')
  assert.equal(custom.testFile, join(root, 'tests', 'generated_spec.rb'))
  assert.equal(custom.source, 'runner.json')

  assert.throws(() => resolveRunner({ project, root: join(project, 'missing') }), /无法识别/)
})

test('renderRunnerSpec：占位符与 junit 路径在宿主侧解析', () => {
  const project = makeDir('panel-render-')
  const root = join(project, '.dsh', 'test-sessions', 's1')
  const runDir = join(root, 'runs', 'run-1')
  mkdirSync(runDir, { recursive: true })
  const spec = {
    ...PRESETS.pytest,
    testFile: join(root, 'tests', 'test_generated.py'),
    source: 'auto:pytest',
  }
  const rendered = renderRunnerSpec(spec, {
    python: 'PYTHON', node: 'NODE', npx: 'NPX', gradlew: 'GRADLEW', binary: 'BINARY',
    project, root, runId: 'run-1', runDir,
  })
  assert.equal(rendered.mode, 'batch')
  assert.equal(rendered.command[0], 'PYTHON')
  assert.equal(rendered.command[rendered.command.length - 1], '{targets}')
  assert.equal(rendered.junit, join(runDir, 'junit.xml'))
  assert.equal(rendered.env.PYTHONPATH, project)
  assert.equal(rendered.testFile, join(root, 'tests', 'test_generated.py'))

  const perCase = renderRunnerSpec(PRESETS['node-test'], {
    python: 'PYTHON', node: 'NODE', npx: 'NPX', gradlew: 'GRADLEW', binary: 'BINARY',
    project, root, runId: 'run-1', runDir,
  })
  assert.equal(perCase.mode, 'per-case')
  assert.equal(perCase.shell, false)
  assert.match(perCase.command.join(' '), /\{target\}/)
})

test('内置 preset：每条命令都能渲染，不留未解析的宿主占位符', () => {
  const project = makeDir('panel-presets-')
  const root = join(project, '.dsh', 'test-sessions', 's1')
  const runDir = join(root, 'runs', 'run-1')
  mkdirSync(runDir, { recursive: true })
  const ctx = {
    python: 'PYTHON', node: 'NODE', npx: 'NPX', gradlew: 'GRADLEW', binary: 'BINARY',
    project, root, runId: 'run-1', runDir,
  }
  for (const [id, preset] of Object.entries(PRESETS)) {
    const rendered = renderRunnerSpec({ ...preset, source: `auto:${id}` }, ctx)
    assert.ok(rendered.testFile, `${id} 没有 testFile`)
    const placeholder = preset.mode === 'batch' ? '{targets}' : '{target}'
    assert.ok(preset.command.some((token) => token.includes(placeholder)), `${id} 缺少 ${placeholder}`)
    for (const token of rendered.command) {
      const rest = token.replace(/\{targets?\}/g, '')
      assert.doesNotMatch(rest, /\{(python|node|npx|gradlew|project|root|runId|runDir|file|junit)\}/, `${id} 还有未解析占位符: ${token}`)
    }
  }
})

function writePytestProject(project) {
  const root = join(project, '.dsh', 'test-sessions', 'test-session-1')
  write(join(project, 'calc.py'), 'def add(a, b):\n    return a + b\n')
  write(join(root, 'tests', 'test_generated.py'), [
    'import sys',
    'from pathlib import Path',
    'sys.path.insert(0, str(Path(__file__).resolve().parents[4]))',
    'from calc import add',
    '',
    'def test_add_ok():',
    '    actual = add(1, 2)',
    '    print(f"ACTUAL[TC-1]: {actual!r}")',
    '    assert actual == 3',
    '',
    'def test_add_bad():',
    '    actual = add(1, 2)',
    '    print(f"ACTUAL[TC-2]: {actual!r}")',
    '    assert actual == 4',
    '',
  ].join('\n'))
  return root
}

test('pytest 链路：prepare 冻结请求，runner 写出逐条结果', async () => {
  const project = makeDir('panel-e2e-py-')
  const root = writePytestProject(project)
  const store = {
    records: [
      makeRecord({ caseId: 'TC-1', title: '加法通过', code: 'def test_add_ok():\n    assert add(1, 2) == 3' }),
      makeRecord({ caseId: 'TC-2', title: '加法失败', code: 'def test_add_bad():\n    assert add(1, 2) == 4' }),
    ],
  }

  const prep = await __test.prepareRun({ sessionId: 'test-session-1', cwd: project, scope: 'all', caseId: '', store })
  assert.equal(prep.framework, 'pytest')
  assert.equal(prep.runnerMode, 'batch')
  assert.equal(prep.targetCount, 2)
  assert.equal(prep.testFile, join(root, 'tests', 'test_generated.py'))

  const request = JSON.parse(readFileSync(join(root, 'runs', prep.runId, 'request.json'), 'utf8'))
  assert.equal(request.runner.mode, 'batch')
  assert.deepEqual(request.targets.map((item) => item.func), ['test_add_ok', 'test_add_bad'])

  const run = runPrepared(prep)
  assert.equal(run.status, 1, run.stdout + run.stderr)

  const result = JSON.parse(readFileSync(join(root, 'runs', prep.runId, 'result.json'), 'utf8'))
  assert.equal(result.status, 'failed')
  assert.equal(result.passed, 1)
  assert.equal(result.failed, 1)
  const byFunc = Object.fromEntries(result.tests.map((item) => [item.func, item.outcome]))
  assert.equal(byFunc.test_add_ok, 'passed')
  assert.equal(byFunc.test_add_bad, 'failed')
  assert.equal(result.tests.find((item) => item.func === 'test_add_ok').actual, '3')
  assert.equal(result.tests.find((item) => item.func === 'test_add_bad').actual, '3')
  assert.equal(result.runner.id, 'pytest')
  assert.ok(existsSync(join(root, 'runs', prep.runId, 'run.log')))
  assert.ok(readFileSync(join(root, 'runs', prep.runId, 'run.log'), 'utf8').includes('test_add_ok'))

  // 单条执行：快照只应包含这一条，报告才不会把其他用例标成“未执行”。
  const single = await __test.prepareRun({ sessionId: 'test-session-1', cwd: project, scope: 'case', caseId: 'TC-2', store })
  assert.equal(single.targetCount, 1)
  const snapshot = JSON.parse(readFileSync(join(single.root, 'runs', single.runId, 'snapshot', 'cases.json'), 'utf8'))
  assert.equal(snapshot.cases.length, 1)
  assert.equal(snapshot.cases[0].caseId, 'TC-2')
  const singleRun = runPrepared(single)
  assert.equal(singleRun.status, 1, singleRun.stdout + singleRun.stderr)
  const singleResult = JSON.parse(readFileSync(join(single.root, 'runs', single.runId, 'result.json'), 'utf8'))
  assert.deepEqual(singleResult.cases, ['TC-2'])
  assert.equal(singleResult.passed, 0)
  assert.equal(singleResult.failed, 1)
})

test('Node test runner 链路：不依赖 Python 项目，per-case 逐条记录结果', async () => {
  const project = makeDir('panel-e2e-js-')
  const root = join(project, '.dsh', 'test-sessions', 'test-session-2')
  write(join(project, 'package.json'), JSON.stringify({ name: 'demo', type: 'module' }))
  write(join(root, 'runner.json'), JSON.stringify({
    preset: 'node-test',
    testFile: 'tests/test_generated.test.mjs',
  }))
  write(join(root, 'tests', 'test_generated.test.mjs'), [
    "import test from 'node:test'",
    "import assert from 'node:assert/strict'",
    '',
    "test('alpha adds', () => { assert.equal(1 + 1, 2) })",
    "test('beta fails', () => { assert.equal(1 + 1, 3) })",
    '',
  ].join('\n'))

  const store = {
    records: [
      makeRecord({ caseId: 'TC-A', title: 'alpha', code: "test('alpha adds', () => { assert.equal(1 + 1, 2) })" }),
      makeRecord({ caseId: 'TC-B', title: 'beta', code: "test('beta fails', () => { assert.equal(1 + 1, 3) })" }),
    ],
  }

  const prep = await __test.prepareRun({ sessionId: 'test-session-2', cwd: project, scope: 'all', caseId: '', store })
  assert.equal(prep.framework, 'Node test runner')
  assert.equal(prep.runnerMode, 'per-case')
  assert.equal(prep.language, 'javascript')
  assert.equal(prep.testFile, join(root, 'tests', 'test_generated.test.mjs'))

  const run = runPrepared(prep)
  assert.equal(run.status, 1, run.stdout + run.stderr)

  const result = JSON.parse(readFileSync(join(root, 'runs', prep.runId, 'result.json'), 'utf8'))
  assert.equal(result.status, 'failed')
  assert.equal(result.passed, 1)
  assert.equal(result.failed, 1)
  const byFunc = Object.fromEntries(result.tests.map((item) => [item.func, item.outcome]))
  assert.equal(byFunc['alpha adds'], 'passed')
  assert.equal(byFunc['beta fails'], 'failed')
  assert.equal(result.runner.mode, 'per-case')
})

test('准备阶段：测试文件缺失时给出框架相关的可操作错误', async () => {
  const project = makeDir('panel-missing-')
  write(join(project, 'go.mod'), 'module demo\n')
  const store = { records: [makeRecord({ caseId: 'TC-1', code: 'func TestX(t *testing.T) {}' })] }
  await assert.rejects(
    () => __test.prepareRun({ sessionId: 's1', cwd: project, scope: 'all', caseId: '', store }),
    /go test|test_generated_test\.go/,
  )
})

test('单条执行：scope=case 只冻结这一条目标', async () => {
  const project = makeDir('panel-single-')
  writePytestProject(project)
  const store = {
    records: [
      makeRecord({ caseId: 'TC-1', code: 'def test_add_ok():\n    pass' }),
      makeRecord({ caseId: 'TC-2', code: 'def test_add_bad():\n    pass' }),
    ],
  }
  const prep = await __test.prepareRun({ sessionId: 'test-session-1', cwd: project, scope: 'case', caseId: 'TC-2', store })
  assert.equal(prep.targetCount, 1)
  const request = JSON.parse(readFileSync(join(prep.root, 'runs', prep.runId, 'request.json'), 'utf8'))
  assert.deepEqual(request.targets.map((item) => item.caseId), ['TC-2'])
  assert.equal(request.scope, 'case')
})

test('查看测试代码与执行使用同一测试文件和目标，忽略指向源码的旧 codeRef', async () => {
  const project = makeDir('panel-test-code-')
  const root = writePytestProject(project)
  const store = { records: [makeRecord({
    caseId: 'TC-2',
    code: 'def test_add_bad():\n    pass',
    codeRef: join(project, 'calc.py') + '#L1',
  })] }
  const view = await __test.resolveTestCode({ sessionId: 'test-session-1', cwd: project, caseId: 'TC-2', store })
  assert.equal(view.testFile, join(root, 'tests', 'test_generated.py'))
  assert.equal(view.testFunc, 'test_add_bad')
  assert.equal(view.line, 11)
  assert.match(view.warning, /codeRef/)
  const prep = await __test.prepareRun({ sessionId: 'test-session-1', cwd: project, scope: 'case', caseId: 'TC-2', store })
  const request = JSON.parse(readFileSync(join(root, 'runs', prep.runId, 'request.json'), 'utf8'))
  assert.equal(request.testFile, view.testFile)
  assert.deepEqual(request.targets, [{ caseId: 'TC-2', func: view.testFunc }])
})

test('查看 JS 测试代码接口按已保存测试名定位函数声明，忽略注册表和旧源码链接', async () => {
  const project = makeDir('panel-js-test-code-')
  const sessionId = 'js-test-code'
  const root = join(project, '.dsh', 'test-sessions', sessionId)
  write(join(root, 'runner.json'), JSON.stringify({ preset: 'node-test' }))
  write(join(root, 'cases.json'), JSON.stringify({ cases: [{ caseId: 'TC-1', testFunc: 'subs' }] }))
  const file = join(root, 'tests', 'test_generated.test.mjs')
  write(file, 'const cases = ["subs"];\ntest("adds", () => {});\ntest("subs", () => {});\n')
  const store = { records: [makeRecord({ caseId: 'TC-1', code: '', codeRef: join(project, 'src.js') + '#L1' })] }
  const view = await __test.resolveTestCode({ sessionId, cwd: project, caseId: 'TC-1', store })
  assert.equal(view.testFile, file)
  assert.equal(view.testFunc, 'subs')
  assert.equal(view.line, 3)
  assert.match(view.warning, /codeRef/)
})

test('日志读取分离模型分析，保留真实异常原文，缺分析时仍可读取', async () => {
  const project = makeDir('panel-analysis-')
  const root = writePytestProject(project)
  const prep = await __test.prepareRun({ sessionId: 'test-session-1', cwd: project, scope: 'case', caseId: 'TC-1', store: { records: [makeRecord({ caseId: 'TC-1', code: 'def test_add_ok(): pass' })] } })
  const runDir = join(root, 'runs', prep.runId)
  const original = 'AssertionError: expected 6, got 5\n'
  write(join(runDir, 'run.log'), original)
  const readLog = async () => {
    let status, data
    const req = Readable.from([])
    req.method = 'GET'; req.url = '/data-panel/run/log?sessionId=test-session-1&runId=' + prep.runId; req.headers = {}
    await __test.handleRunLog(req, { writeHead(value) { status = value }, end(value) { data = JSON.parse(value) } })
    assert.equal(status, 200)
    return data
  }
  assert.equal((await readLog()).analysis, '')
  write(join(runDir, 'analysis.md'), 'TC-1：预期与断言可能不一致；证据 run.log:1，原因尚未确认。')
  const response = await readLog()
  assert.equal(response.content, original)
  assert.match(response.analysis, /原因尚未确认/)
  assert.equal(readFileSync(join(runDir, 'run.log'), 'utf8'), original)
})

test('gtest batch 与覆盖率重放共用本次筛选，VS Cobertura 解析不冒充 MC/DC', () => {
  const project = makeDir('panel-vs-coverage-')
  const root = join(project, '.dsh', 'test-sessions', 'vs')
  write(join(root, 'runner.json'), JSON.stringify({
    preset: 'gtest-batch',
    coverage: { command: ['C:/VS/Microsoft.CodeCoverage.Console.exe', 'collect', '--output-format', 'cobertura', '--output', '{coverageFile}', '{binary}', '--gtest_filter={targets}'], format: 'cobertura', file: 'coverage/coverage.xml' },
  }))
  const runner = resolveRunner({ project, root })
  const spec = renderRunnerSpec(runner, { project, root, runId: 'run-vs', runDir: join(root, 'runs', 'run-vs'), binary: runner.binary })
  assert.equal(spec.targetsSeparator, ':')
  const report = join(project, 'coverage.xml')
  write(report, '<coverage lines-valid="10" lines-covered="7" branches-valid="4" branches-covered="2"/>')
  const script = [
    'import runpy,json,sys,pathlib',
    'api=runpy.run_path(sys.argv[1]); spec=json.loads(sys.argv[2])',
    'targets=[{"func":"Suite.One"},{"func":"Suite.Two"}]',
    'prepare=api["prepare_argv"]',
    'assert "--gtest_filter=Suite.One:Suite.Two" in prepare(spec,targets,"")',
    'coverage={**spec,"command":spec["coverage"]["command"]}',
    'assert "--gtest_filter=Suite.One:Suite.Two" in prepare(coverage,targets,"")',
    'assert "--gtest_filter=Suite.One" in prepare(coverage,targets[:1],"")',
    'stats=api["parse_coverage_report"](pathlib.Path(sys.argv[3]),"cobertura")',
    'assert stats["line"]["percent"]==70.0 and stats["branch"]["percent"]==50.0',
    'assert "mcdc" not in stats and "statement" not in stats',
  ].join('\n')
  const result = spawnSync(process.env.DSH_PYTHON_PATH, ['-c', script, new URL('../assets/run_tests.py', import.meta.url).pathname.replace(/^\/(\w:)/, '$1'), JSON.stringify(spec), report], { encoding: 'utf8' })
  assert.equal(result.status, 0, result.stdout + result.stderr)
})

test('prepare 固定范围清单和排除证据，runner 结果保留范围，不改变 scope=case', async () => {
  const project = makeDir('panel-scope-run-')
  const root = writePytestProject(project)
  write(join(project, 'src/calc.py'), 'def add(a, b): return a + b\n')
  const inventory = scopeInventory(project, ['src'])
  inventory.files[0].status = 'tested'
  inventory.files[0].functions = [{ subjectFunction: 'src/calc.py::add', caseIds: ['TC-1'] }]
  write(join(root, 'scope.json'), JSON.stringify(inventory))
  const store = { records: [makeRecord({ caseId: 'TC-1', code: 'def test_add_ok(): pass', subjectFunction: 'src/calc.py::add' })] }
  const prep = await __test.prepareRun({ sessionId: 'test-session-1', cwd: project, scope: 'case', caseId: 'TC-1', store })
  const runDir = join(root, 'runs', prep.runId)
  const request = JSON.parse(readFileSync(join(runDir, 'request.json'), 'utf8'))
  assert.equal(request.scope, 'case')
  assert.equal(request.testScope.status, 'reviewed')
  assert.deepEqual(request.testScope.selectedCaseIds, ['TC-1'])
  write(join(root, 'scope.json'), '{}')
  assert.equal(JSON.parse(readFileSync(join(runDir, 'snapshot/scope.json'), 'utf8')).status, 'reviewed')
  const run = runPrepared(prep)
  assert.equal(run.status, 0, run.stdout + run.stderr)
  const result = JSON.parse(readFileSync(join(runDir, 'result.json'), 'utf8'))
  assert.equal(result.testScope.status, 'reviewed')
  assert.equal(result.scope, 'case')
})

test('实际 JSON 生成后检查拒绝缺括号、非法数值、重复字段及编号/字段遗漏', () => {
  const project = makeDir('panel-json-check-')
  const log = join(project, 'serialization-selfcheck.log')
  const cases = join(project, 'cases.json')
  const runner = new URL('../assets/run_tests.py', import.meta.url).pathname.replace(/^\/(\w:)/, '$1')
  write(cases, JSON.stringify({ cases: [{ caseId: 'TC-1', expectedOutputs: [{ name: 'result', value: '5' }] }] }))
  const execute = (text) => {
    write(log, text)
    return spawnSync(process.env.DSH_PYTHON_PATH, [runner, '--check-actual-json', log, '--cases', cases], { encoding: 'utf8' })
  }
  for (const text of ['ACTUAL_JSON[TC-1]: {"result":5', 'ACTUAL_JSON[TC-1]: {"result":NaN}', 'ACTUAL_JSON[TC-1]: {"result":1e999}', 'ACTUAL_JSON[TC-1]: {"result":5,"result":6}', 'ACTUAL_JSON[TC-1]: []', 'ACTUAL_JSON[TC-2]: {"result":5}', 'ACTUAL_JSON[TC-1]: {}']) {
    const result = execute(text)
    assert.equal(result.status, 2, text + result.stderr)
    assert.equal(JSON.parse(result.stdout).valid, false)
  }
  const result = execute('ACTUAL_JSON[TC-1]: {"result":5,"text":"引号\\\"与反斜杠\\\\","ok":true,"empty":null}\n')
  assert.equal(result.status, 0, result.stderr + result.stdout)
  assert.equal(JSON.parse(result.stdout).valid, true)
})

test('正式执行中非法实际 JSON 只告警，后续用例照常执行，断言结论不变', async () => {
  const project = makeDir('panel-json-run-')
  const root = join(project, '.dsh/test-sessions/json-run')
  write(join(root, 'runner.json'), JSON.stringify({ preset: 'node-test' }))
  const code = 'import test from "node:test";\ntest("one", () => console.log(\'ACTUAL_JSON[TC-1]: {"result":5\'));\ntest("two", () => console.log(\'ACTUAL_JSON[TC-2]: {"result":6}\'));\n'
  write(join(root, 'tests/test_generated.test.mjs'), code)
  const store = { records: [makeRecord({ caseId: 'TC-1', code: 'test("one", () => {})', expectedOutputs: [{ name: 'result', value: '5' }] }), makeRecord({ id: 'r2', caseId: 'TC-2', code: 'test("two", () => {})', expectedOutputs: [{ name: 'result', value: '6' }] })] }
  const prep = await __test.prepareRun({ sessionId: 'json-run', cwd: project, scope: 'all', caseId: '', store })
  const run = runPrepared(prep)
  assert.equal(run.status, 0, run.stdout + run.stderr)
  const runDir = join(root, 'runs', prep.runId)
  const result = JSON.parse(readFileSync(join(runDir, 'result.json'), 'utf8'))
  assert.equal(result.passed, 2)
  assert.equal(result.actualOutputValidation.valid, false)
  assert.ok(result.actualOutputValidation.issues.some((issue) => issue.caseId === 'TC-1'))
  // actualOutputs 现在与 expectedOutputs 同为 [{name, value}] 列表
  const tc2 = result.tests.find((item) => item.caseId === 'TC-2')
  assert.deepEqual(tc2.actualOutputs, [{ name: 'result', value: '6' }])
  assert.match(readFileSync(join(runDir, 'run.log'), 'utf8'), /实际输出 JSON 告警/)
})

test('查看测试代码明确区分缺测试文件与缺目标', async () => {
  const project = makeDir('panel-test-code-missing-')
  write(join(project, 'pyproject.toml'), '[tool.pytest.ini_options]\n')
  const store = { records: [makeRecord({ caseId: 'TC-1', code: 'def test_real():\n    pass' })] }
  await assert.rejects(
    () => __test.resolveTestCode({ sessionId: 's1', cwd: project, caseId: 'TC-1', store }),
    /预期测试文件不存在/,
  )
  write(join(project, '.dsh', 'test-sessions', 's1', 'tests', 'test_generated.py'), 'def test_other():\n    pass\n')
  await assert.rejects(
    () => __test.resolveTestCode({ sessionId: 's1', cwd: project, caseId: 'TC-1', store }),
    // 新口径：定位失败要明说「测试映射已失效」，且不得回退到第 1 行/注册表。
    /测试映射已失效：.*找不到测试声明 test_real/,
  )
})

test('面板代码文本为空时，查看测试代码沿用 cases.json 的 testFunc', async () => {
  const project = makeDir('panel-test-code-saved-')
  const root = writePytestProject(project)
  write(join(root, 'cases.json'), JSON.stringify({ cases: [{ caseId: 'TC-1', testFunc: 'test_add_ok' }] }))
  const store = { records: [makeRecord({ caseId: 'TC-1', code: '', codeRef: '' })] }
  const view = await __test.resolveTestCode({ sessionId: 'test-session-1', cwd: project, caseId: 'TC-1', store })
  assert.equal(view.testFunc, 'test_add_ok')
  assert.equal(view.line, 6)
  assert.equal(view.warning, '')
})

test('父工作区下首次执行：codeRef 留空仍找到嵌套项目的同会话资产', async () => {
  const workspace = makeDir('panel-nested-workspace-')
  const project = join(workspace, 'test', 'ut-demo')
  const sessionId = 'nested-first-run'
  const root = join(project, '.dsh', 'test-sessions', sessionId)
  write(join(root, 'runner.json'), JSON.stringify({ preset: 'pytest' }))
  write(join(root, 'tests', 'test_generated.py'), 'def test_nested():\n    assert True\n')
  const store = { records: [makeRecord({ code: 'def test_nested():\n    assert True', codeRef: '' })] }
  const view = await __test.resolveTestCode({ sessionId, cwd: workspace, caseId: 'TC-1', store })
  assert.equal(view.testFile, join(root, 'tests', 'test_generated.py'))
  const prep = await __test.prepareRun({ sessionId, cwd: workspace, scope: 'case', caseId: 'TC-1', store })
  assert.equal(prep.root, root)
  assert.equal(prep.frameworkId, 'pytest')
})

test('同会话对应多个有效项目时拒绝猜测执行目录', async () => {
  const workspace = makeDir('panel-ambiguous-workspace-')
  const sessionId = 'ambiguous-first-run'
  for (const name of ['first', 'second']) {
    const root = join(workspace, name, '.dsh', 'test-sessions', sessionId)
    write(join(root, 'runner.json'), JSON.stringify({ preset: 'pytest' }))
    write(join(root, 'tests', 'test_generated.py'), 'def test_shared():\n    assert True\n')
  }
  const store = { records: [makeRecord({ code: 'def test_shared():\n    assert True', codeRef: '' })] }
  await assert.rejects(
    () => __test.resolveTestCode({ sessionId, cwd: workspace, caseId: 'TC-1', store }),
    /多个可执行项目/,
  )
})

test('非 PATH 的 Go 工具路径写入本次执行命令', async () => {
  const project = makeDir('panel-go-path-')
  const root = join(project, '.dsh', 'test-sessions', 'go-path-test')
  const tool = join(project, process.platform === 'win32' ? 'go.exe' : 'go')
  write(tool, 'fake tool')
  write(join(root, 'runner.json'), JSON.stringify({ preset: 'go' }))
  write(join(project, 'tests', 'test_generated_test.go'), 'func TestThing(t *testing.T) {}\n')
  const previous = process.env.DSH_GO_PATH
  process.env.DSH_GO_PATH = tool
  try {
    const store = { records: [makeRecord({ code: 'func TestThing(t *testing.T) {}' })] }
    const prep = await __test.prepareRun({ sessionId: 'go-path-test', cwd: project, scope: 'case', caseId: 'TC-1', store })
    const request = JSON.parse(readFileSync(join(root, 'runs', prep.runId, 'request.json'), 'utf8'))
    assert.equal(request.runner.command[0], tool)
  } finally {
    if (previous === undefined) delete process.env.DSH_GO_PATH
    else process.env.DSH_GO_PATH = previous
  }
})

test('GoogleTest 允许 preCommand 先生成 binary，未配置构建时要求 binary 已存在', async () => {
  const project = makeDir('panel-gtest-build-')
  const root = join(project, '.dsh', 'test-sessions', 'gtest-build-test')
  // coverageRequired:false 显式关掉覆盖率自动升级：这个用例只验证 preCommand 与 binary 规则，
  // 不能因为本机恰好装了 VS 采集器就变成 batch+cov。
  const profile = { preset: 'gtest', coverageRequired: false, binary: 'project:build/generated_test', preCommand: [process.execPath, '--version'] }
  write(join(root, 'runner.json'), JSON.stringify(profile))
  write(join(project, 'tests', 'generated_test.cpp'), 'TEST(Suite, Works) {}\n')
  const store = { records: [makeRecord({ code: 'TEST(Suite, Works) {}' })] }
  const args = { sessionId: 'gtest-build-test', cwd: project, scope: 'case', caseId: 'TC-1', store }
  const prep = await __test.prepareRun(args)
  assert.equal(prep.frameworkId, 'gtest')
  write(join(root, 'runner.json'), JSON.stringify({ ...profile, preCommand: [] }))
  await assert.rejects(() => __test.prepareRun(args), /测试可执行文件不存在/)
})

test('目标缺失：没有 testFunc 且代码认不出时计入 notRun', async () => {
  const project = makeDir('panel-notrun-')
  writePytestProject(project)
  const store = {
    records: [
      makeRecord({ caseId: 'TC-1', code: 'def test_add_ok():\n    pass' }),
      makeRecord({ caseId: 'TC-2', code: 'print("no test here")' }),
    ],
  }
  const prep = await __test.prepareRun({ sessionId: 'test-session-1', cwd: project, scope: 'all', caseId: '', store })
  assert.equal(prep.targetCount, 1)
  assert.deepEqual(prep.missingTestFunc, ['TC-2'])
})

test('escapeRegExp 不会让特殊字符逃出 pattern', () => {
  assert.equal(escapeRegExp('a.b(c)'), 'a\\.b\\(c\\)')
})

test('resolveRunner：项目没标记但已有本会话测试文件时，按文件兜底识别', () => {
  const project = makeDir('panel-fallback-')
  const root = join(project, '.dsh', 'test-sessions', 's1')
  write(join(root, 'tests', 'test_generated.py'), 'def test_a():\n    pass\n')
  const runner = resolveRunner({ project, root })
  assert.equal(runner.id, 'pytest')
  assert.equal(runner.source, 'auto:pytest')
})

test('gtest 链路：per-case 用 --gtest_filter 逐条执行', { skip: process.platform !== 'win32' }, async () => {
  const project = makeDir('panel-gtest-')
  const root = join(project, '.dsh', 'test-sessions', 'session-gtest')
  // 本用例验证 per-case 的 --gtest_filter 行为，显式关掉覆盖率自动升级。
  write(join(root, 'runner.json'), JSON.stringify({
    preset: 'gtest',
    coverageRequired: false,
    testFile: 'tests/test_generated.cpp',
    binary: 'project:fake_gtest.cmd',
    shell: true,
    preCommand: [process.execPath, '-e', 'console.log("prebuild-ok")'],
  }))
  write(join(root, 'tests', 'test_generated.cpp'), [
    'TEST(Suite, Pass) { EXPECT_EQ(1, 1); }',
    'TEST(Suite, Fail) { EXPECT_EQ(1, 2); }',
    '',
  ].join('\n'))
  write(join(project, 'fake_gtest.cmd'), [
    '@echo off',
    'echo [==========] Running 1 test from 1 test suite.',
    'echo [ RUN      ] %*',
    'if "%*"=="--gtest_filter=Suite.Pass --gtest_color=no" (',
    '  echo [       OK ] Suite.Pass',
    '  exit /b 0',
    ')',
    'echo [  FAILED  ] Suite.Fail',
    'exit /b 1',
  ].join('\r\n'))
  const store = {
    records: [
      makeRecord({ caseId: 'TC-G1', code: 'TEST(Suite, Pass) { EXPECT_EQ(1, 1); }' }),
      makeRecord({ caseId: 'TC-G2', code: 'TEST(Suite, Fail) { EXPECT_EQ(1, 2); }' }),
    ],
  }
  const prep = await __test.prepareRun({ sessionId: 'session-gtest', cwd: project, scope: 'all', caseId: '', store })
  assert.equal(prep.framework, 'GoogleTest')
  assert.equal(prep.runnerMode, 'per-case')
  assert.equal(prep.targetCount, 2)
  assert.ok(prep.testFile.endsWith('test_generated.cpp'))
  const run = runPrepared(prep)
  assert.equal(run.status, 1, run.stdout + run.stderr)
  assert.ok(readFileSync(join(root, 'runs', prep.runId, 'run.log'), 'utf8').includes('prebuild-ok'))
  const result = JSON.parse(readFileSync(join(root, 'runs', prep.runId, 'result.json'), 'utf8'))
  assert.equal(result.failed, 1)
  assert.equal(result.passed, 1)
  const byFunc = Object.fromEntries(result.tests.map((item) => [item.func, item.outcome]))
  assert.equal(byFunc['Suite.Pass'], 'passed')
  assert.equal(byFunc['Suite.Fail'], 'failed')
})

test('batch 退出码为 0 但缺少逐条证据时标记未确认', async () => {
  const project = makeDir('panel-batch-unknown-')
  const root = join(project, '.dsh', 'test-sessions', 'batch-unknown')
  write(join(project, 'package.json'), JSON.stringify({ type: 'module' }))
  write(join(root, 'tests', 'test_generated.test.mjs'), "test('alpha', () => {})\n")
  // 自定义运行器（不写 preset）：mode 与 command 由本文件自己配对。
  write(join(root, 'runner.json'), JSON.stringify({
    id: 'node-test-batch', label: 'Node test (batch)', language: 'javascript',
    testFile: 'tests/test_generated.test.mjs',
    mode: 'batch',
    command: [process.execPath, '-e', 'process.exit(0)', '{targets}'],
    targetArg: '{target}', junit: 'junit.xml',
    targetExtract: ["\\b(?:it|test)\\s*\\(\\s*['\"`]([^'\"`\\n]+)['\"`]"],
  }))
  const store = { records: [makeRecord({ code: "test('alpha', () => {})" })] }
  const prep = await __test.prepareRun({ sessionId: 'batch-unknown', cwd: project, scope: 'all', caseId: '', store })
  const run = runPrepared(prep)
  assert.equal(run.status, 0, run.stdout + run.stderr)
  const result = JSON.parse(readFileSync(join(root, 'runs', prep.runId, 'result.json'), 'utf8'))
  assert.equal(result.status, 'partial')
  assert.equal(result.unconfirmed, 1)
  assert.equal(result.tests[0].outcome, 'unknown')
})

test('runner.json 的 timeoutSec 限制执行时长', async () => {
  const project = makeDir('panel-run-timeout-')
  const root = join(project, '.dsh', 'test-sessions', 'run-timeout')
  write(join(project, 'package.json'), JSON.stringify({ type: 'module' }))
  write(join(root, 'tests', 'test_generated.test.mjs'), "test('slow', () => {})\n")
  write(join(root, 'runner.json'), JSON.stringify({
    preset: 'node-test', timeoutSec: 1,
    command: [process.execPath, '-e', 'setTimeout(() => {}, 5000)', '{target}'],
  }))
  const store = { records: [makeRecord({ code: "test('slow', () => {})" })] }
  const prep = await __test.prepareRun({ sessionId: 'run-timeout', cwd: project, scope: 'all', caseId: '', store })
  const run = runPrepared(prep)
  assert.equal(run.status, 3, run.stdout + run.stderr)
  const result = JSON.parse(readFileSync(join(root, 'runs', prep.runId, 'result.json'), 'utf8'))
  assert.equal(result.status, 'timeout')
  assert.match(result.note, /超过 1 秒/)
})

test('C++/GoogleTest：本机有 VS 采集器时，第一次 prepareRun 就升级成 gtest-batch-cov', async () => {
  const project = makeDir('panel-e2e-cov-')
  const sessionId = 'test-session-cov'
  const root = join(project, '.dsh', 'test-sessions', sessionId)
  mkdirSync(join(root, 'tests'), { recursive: true })
  const testFile = join(root, 'tests', 'test_generated.cpp')
  write(testFile, 'TEST(AddTest, Zero) {\n}\n')
  // 故意用普通 gtest：它**不声明** codecoverage，正是「首跑不采覆盖率」的根因。
  write(join(root, 'runner.json'), JSON.stringify({
    preset: 'gtest',
    testFile: 'tests/test_generated.cpp',
    binary: 'project:build/test_generated',
  }, null, 2))
  write(join(project, 'build', 'test_generated.exe'), 'stub')
  write(join(project, 'build', 'test_generated.pdb'), 'stub')
  // 项目自维护的覆盖率配置（面板会优先用它，而不是采集器自带配置）。
  write(join(project, 'testReport', 'coverage.config'), '<Results/>')
  const tool = join(project, 'CodeCoverage.exe')
  write(tool, 'stub')

  const previous = process.env.DSH_CODECOVERAGE_PATH
  process.env.DSH_CODECOVERAGE_PATH = tool
  try {
    const store = {
      records: [makeRecord({
        caseId: 'TC-C1',
        title: 'addLine-边界测试',
        testFunc: 'AddTest.Zero',
        testLocation: { file: testFile, line: 1, column: 1, fileSha256: '' },
      })],
    }
    const prep = await __test.prepareRun({
      sessionId, cwd: project, scope: 'case', caseId: 'TC-C1', store,
    })

    // 关键断言：一次就选对 preset，不需要后续对话手改 runner.json。
    assert.equal(prep.frameworkId, 'gtest-batch-cov')
    assert.equal(prep.runnerMode, 'batch')
    assert.equal(prep.coveragePlan.presetId, 'gtest-batch-cov')
    assert.equal(prep.coveragePlan.required, true)
    assert.equal(prep.coveragePlan.available, true, prep.coveragePlan.reason)
    assert.equal(prep.coveragePlan.targetCount, 1)
    assert.equal(prep.coveragePlan.tool.path, tool)

    const request = JSON.parse(readFileSync(join(root, 'runs', prep.runId, 'request.json'), 'utf8'))
    // request.json 第一轮就必须带完整覆盖率配置与命令。
    assert.equal(request.runner.coverageRequired, true)
    assert.equal(request.runner.coverage.format, 'vs-codecoverage-xml')
    const collect = request.runner.coverage.command.join(' ')
    const analyze = request.runner.coverage.postCommand.join(' ')
    assert.ok(collect.includes('collect'), collect)
    assert.ok(collect.includes(tool), collect)
    // 目标筛选保留占位符：执行时 runner 会用它自己那批目标展开（与 targets 完全一致）。
    assert.ok(collect.includes('--gtest_filter={targets}'), collect)
    assert.ok(analyze.includes('analyze'), analyze)
    assert.match(request.coveragePlan.rawFile, /run\.coverage$/)
    assert.match(request.coveragePlan.reportFile, /coverage\.xml$/)
    assert.equal(request.coveragePlan.targetCount, request.targets.length)
  } finally {
    if (previous === undefined) delete process.env.DSH_CODECOVERAGE_PATH
    else process.env.DSH_CODECOVERAGE_PATH = previous
  }
})
