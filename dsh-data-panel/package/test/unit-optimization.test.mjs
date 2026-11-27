/**
 * 单元测试改造的回归测试：用例标题、结构化变量类型、测试声明位置、覆盖率选择、执行记录口径。
 *
 * 对应验收点：
 *  4/5  title 是「函数名-测试类型」，caseId 里仍保留 T001；
 *  9    输入值 0 / false / null / 数组 / 对象不会在落库或导出时丢失；
 *  6/7  testLocation 能直接定位，定位失败不回退到第 1 行；
 *  1/2  本机有 VS 采集器时首跑就选带覆盖率的 preset，并冻结 coveragePlan；
 *  14/15/16 全部执行后每条用例都能查到同一次 run，重复刷新不重复。
 */

import test, { after } from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Readable } from 'node:stream'

const home = mkdtempSync(join(tmpdir(), 'dsh-unit-opt-'))
process.env.DSH_HOME = home
const { __test: api } = await import('../lib/index.js')
const runners = await import('../lib/runners.js')
after(() => rmSync(home, { recursive: true, force: true }))

const base = {
  id: 'r1',
  caseId: 'BJ-PKG-ADD_LINE-T001.CTD',
  title: 'addLine-边界测试',
  testType: 'boundary',
  subjectFunction: 'src/order.cpp::Order::addLine',
  description: '存量 0 时下单价校验',
  code: '',
  demo: false,
}

// ── 标题规则 ───────────────────────────────────────────────────────────

test('标题由「函数短名 + 中文测试类型」派生，不再是 T001', () => {
  const saved = api.normalizePatch({ ...base, title: 'T001' }, base)
  assert.equal(saved.title, 'addLine-边界测试')
  // caseId 里的函数内编号必须保留，面板、执行记录、报告都靠它关联。
  assert.equal(saved.caseId, 'BJ-PKG-ADD_LINE-T001.CTD')

  assert.equal(api.normalizePatch({ ...base, testType: 'functional' }, base).title, 'addLine-功能测试')
  assert.equal(api.normalizePatch({ ...base, testType: 'logic' }, base).title, 'addLine-逻辑测试')
  // 类::方法、类.方法、只有文件三种写法都要能取到函数短名。
  assert.equal(
    api.normalizePatch({ ...base, subjectFunction: 'Order.discount' }, base).title,
    'discount-边界测试',
  )
  assert.equal(
    api.normalizePatch({ ...base, subjectFunction: 'src/pay.cpp::payable' }, base).title,
    'payable-边界测试',
  )
})

test('无法派生标题时仍拒绝纯编号，并给出可执行的提示', () => {
  const noFn = { ...base, subjectFunction: '' }
  assert.throws(
    () => api.normalizePatch({ ...noFn, title: 'T002' }, noFn),
    /不能只用编号/,
  )
  // 有意义的自由标题仍然允许（无法确定被测函数时）。
  assert.equal(api.normalizePatch({ ...noFn, title: '手工补测：空购物车下单' }, noFn).title,
    '手工补测：空购物车下单')
})

// ── 结构化变量类型 ─────────────────────────────────────────────────────

test('输入/预期变量的 0 / false / null / 数组 / 对象都原样保存，不被当成空值丢掉', () => {
  const saved = api.normalizePatch({
    ...base,
    inputVariables: [
      { name: 'quantity', value: 0 },
      { name: 'enabled', value: false },
      { name: 'note', value: null },
      { name: 'items', value: [1, 2] },
      { name: 'meta', value: { k: 1 } },
      { name: 'text', value: 'hello' },
      { name: 'bad' },
    ],
    expectedOutputs: [{ name: 'total', value: 10.5 }],
  }, base)
  assert.deepEqual(saved.inputVariables, [
    { name: 'quantity', value: 0 },
    { name: 'enabled', value: false },
    { name: 'note', value: null },
    { name: 'items', value: [1, 2] },
    { name: 'meta', value: { k: 1 } },
    { name: 'text', value: 'hello' },
  ])
  assert.deepEqual(saved.expectedOutputs, [{ name: 'total', value: 10.5 }])
})

// ── testLocation ──────────────────────────────────────────────────────

test('testLocation 落库并在导出 cases.json 时保留（含文件哈希）', async () => {
  const location = {
    file: 'C:/proj/tests/test_generated.cpp',
    line: 42,
    column: 1,
    fileSha256: 'a'.repeat(64),
  }
  const saved = api.normalizePatch({ ...base, testLocation: location }, base)
  assert.deepEqual(saved.testLocation, location)

  // 空/非法位置不落库，也不会被编造成第 1 行。
  assert.equal(api.normalizePatch({ ...base, testLocation: null }, base).testLocation, undefined)
  assert.equal(api.normalizePatch({ ...base, testLocation: { file: '' } }, base).testLocation, undefined)

  const file = join(home, 'cases-export.json')
  const cases = await api.exportCases({ records: [{ ...saved, testFunc: 'OrderAddLineTest.Zero' }] }, file)
  assert.deepEqual(cases[0].testLocation, location)
  assert.equal(cases[0].testFunc, 'OrderAddLineTest.Zero')
})

test('testLocation 的哈希与当前文件不一致时会重新定位', async () => {
  const project = mkdtempSync(join(tmpdir(), 'dsh-unit-loc-'))
  const asset = join(project, '.dsh', 'test-sessions', 's1')
  mkdirSync(join(asset, 'tests'), { recursive: true })
  const testFile = join(asset, 'tests', 'test_generated.cpp')
  const text = [
    '#include <gtest/gtest.h>',
    'TEST(OtherSuite, OtherCase) {',
    '}',
    'TEST(OrderAddLineTest, Zero) {',
    '}',
  ].join('\n')
  writeFileSync(testFile, text, 'utf8')
  writeFileSync(join(asset, 'runner.json'), JSON.stringify({
    preset: 'gtest',
    testFile: 'tests/test_generated.cpp',
  }), 'utf8')
  const sha = createHash('sha256').update(text, 'utf8').digest('hex')

  const record = {
    ...base,
    id: 'r9',
    testFunc: 'OrderAddLineTest.Zero',
    testLocation: { file: testFile, line: 1, column: 1, fileSha256: 'b'.repeat(64) },
  }
  const resolved = await api.resolveTestCode({
    sessionId: 's1', cwd: project, caseId: record.caseId, store: { records: [record] },
  })
  // 哈希不匹配 → 按 testFunc 重新定位到真实声明行（第 4 行），不是第 1 行。
  assert.equal(resolved.line, 4)
  assert.equal(resolved.locatedBy, 'testFunc')
  assert.equal(resolved.testLocation.line, 4)
  assert.equal(resolved.testLocation.fileSha256, sha)
})

// ── 覆盖率选择 ────────────────────────────────────────────────────────

test('本机有 VS 采集器时，普通 gtest 首跑就升级成 gtest-batch-cov', () => {
  const upgraded = runners.upgradeCoveragePreset({
    presetId: 'gtest',
    language: 'cpp',
    platform: 'win32',
    tools: { codecoverage: 'C:/VS/CodeCoverage.exe' },
  })
  assert.equal(upgraded, 'gtest-batch-cov')
  // gtest-batch 也升级（同样是 batch 语义）。
  assert.equal(runners.upgradeCoveragePreset({
    presetId: 'gtest-batch', language: 'cpp', platform: 'win32',
    tools: { codecoverage: 'C:/VS/CodeCoverage.exe' },
  }), 'gtest-batch-cov')
})

test('没有采集器 / 非 Windows / 非 C++ 时保持原 preset，不硬失败', () => {
  const keep = (over) => runners.upgradeCoveragePreset({
    presetId: 'gtest', language: 'cpp', platform: 'win32', tools: {}, ...over,
  })
  assert.equal(keep({}), '')
  assert.equal(keep({ tools: { codecoverage: '' } }), '')
  assert.equal(keep({ platform: 'linux', tools: { codecoverage: 'C:/x.exe' } }), '')
  assert.equal(keep({ language: 'python', tools: { codecoverage: 'C:/x.exe' } }), '')
})

test('coveragePlan 冻结工具、配置、原始与导出文件、目标数量和实际命令', () => {
  const plan = runners.describeCoveragePlan({
    coverage: {
      command: ['C:/VS/CodeCoverage.exe', 'collect', '/output:{coverageRaw}'],
      postCommand: ['C:/VS/CodeCoverage.exe', 'analyze', '/output:{coverageFile}'],
      format: 'vs-codecoverage-xml',
      file: 'C:/run/coverage/coverage.xml',
      rawFile: 'C:/run/coverage/run.coverage',
      configFile: 'C:/run/coverage.config',
    },
    tools: { codecoverage: 'C:/VS/CodeCoverage.exe' },
    targetCount: 5,
    required: true,
    presetId: 'gtest-batch-cov',
  })
  assert.equal(plan.available, true)
  assert.equal(plan.required, true)
  assert.equal(plan.source, 'vs-codecoverage')
  assert.deepEqual(plan.tool, { id: 'codecoverage', path: 'C:/VS/CodeCoverage.exe' })
  assert.equal(plan.configFile, 'C:/run/coverage.config')
  assert.equal(plan.rawFile, 'C:/run/coverage/run.coverage')
  assert.equal(plan.reportFile, 'C:/run/coverage/coverage.xml')
  assert.equal(plan.targetCount, 5)
  assert.equal(plan.command.length, 3)
  assert.equal(plan.postCommand.length, 3)
})

test('没有覆盖率配置时 plan 明确不可用，且说明原因（覆盖率必需时也一样）', () => {
  const plan = runners.describeCoveragePlan({
    coverage: null, tools: {}, targetCount: 3, required: true, presetId: 'gtest-batch-cov',
  })
  assert.equal(plan.available, false)
  assert.equal(plan.required, true)
  assert.match(plan.reason, /要求采集覆盖率/)
})

// ── 执行记录口径 ──────────────────────────────────────────────────────

function makeRoot(sessionId, project) {
  const root = join(project, '.dsh', 'test-sessions', sessionId)
  mkdirSync(join(root, 'runs'), { recursive: true })
  return root
}

function writeRun(root, runId, result, targets, snapshotCaseIds) {
  const dir = join(root, 'runs', runId)
  mkdirSync(join(dir, 'snapshot'), { recursive: true })
  writeFileSync(join(dir, 'request.json'), JSON.stringify({ targets }), 'utf8')
  writeFileSync(join(dir, 'result.json'), JSON.stringify(result), 'utf8')
  writeFileSync(join(dir, 'snapshot', 'cases.json'), JSON.stringify({
    cases: (snapshotCaseIds || []).map((caseId) => ({ caseId, input: 'q=0', expected: '异常' })),
  }), 'utf8')
}

async function runList({ sessionId, cwd, caseId }) {
  const req = Readable.from([])
  req.method = 'GET'
  req.url = `/data-panel/run/list?sessionId=${sessionId}&scope=case&caseId=${encodeURIComponent(caseId)}&cwd=${encodeURIComponent(cwd)}`
  req.headers = {}
  let body = null
  await api.handleRunList(req, {
    writeHead() {},
    end(raw) { body = JSON.parse(raw) },
  })
  assert.equal(body.ok, true, body.error)
  return body.runs
}

async function runSummary({ sessionId, cwd }) {
  const req = Readable.from([])
  req.method = 'GET'
  req.url = `/data-panel/run/summary?sessionId=${sessionId}&cwd=${encodeURIComponent(cwd)}`
  let body = null
  await api.handleRunSummary(req, { writeHead() {}, end(raw) { body = JSON.parse(raw) } })
  assert.equal(body.ok, true, body.error)
  return body.byCase
}

test('全部执行 / 执行选中产生的 run 都会回写到每条用例，且刷新不重复', async () => {
  const project = mkdtempSync(join(tmpdir(), 'dsh-unit-runs-'))
  const root = makeRoot('s1', project)
  const caseA = 'BJ-PKG-A-T001.CTD'
  const caseB = 'GN-PKG-B-T002.CTD'
  const caseC = 'LJ-PKG-C-T003.CTD'

  // 全部执行：3 条都在，逐条结果齐全。
  writeRun(root, '20261123-100000-000-aaaaaa', {
    runId: '20261123-100000-000-aaaaaa',
    scope: 'all',
    status: 'passed',
    startedAt: '2026-11-23T10:00:00Z',
    finishedAt: '2026-11-23T10:00:02Z',
    cases: [caseA, caseB, caseC],
    tests: [
      { caseId: caseA, func: 'A.Test', outcome: 'passed', durationMs: 10 },
      { caseId: caseB, func: 'B.Test', outcome: 'failed', durationMs: 20, message: '断言失败' },
      { caseId: caseC, func: 'C.Test', outcome: 'passed', durationMs: 30 },
    ],
  }, [{ caseId: caseA }, { caseId: caseB }, { caseId: caseC }], [caseA, caseB, caseC])

  // 执行选中 2 条：只有 B、C。
  writeRun(root, '20261123-110000-000-bbbbbb', {
    runId: '20261123-110000-000-bbbbbb',
    scope: 'cases',
    status: 'passed',
    startedAt: '2026-11-23T11:00:00Z',
    finishedAt: '2026-11-23T11:00:01Z',
    cases: [caseB, caseC],
    tests: [
      { caseId: caseB, func: 'B.Test', outcome: 'passed', durationMs: 11 },
      { caseId: caseC, func: 'C.Test', outcome: 'passed', durationMs: 12 },
    ],
  }, [{ caseId: caseB }, { caseId: caseC }], [caseB, caseC])

  // 单条执行：只有 A。
  writeRun(root, '20261123-120000-000-cccccc', {
    runId: '20261123-120000-000-cccccc',
    scope: 'case',
    caseId: caseA,
    status: 'passed',
    startedAt: '2026-11-23T12:00:00Z',
    finishedAt: '2026-11-23T12:00:01Z',
    cases: [caseA],
    tests: [{ caseId: caseA, func: 'A.Test', outcome: 'passed', durationMs: 9 }],
  }, [{ caseId: caseA }], [caseA])

  const aRuns = await runList({ sessionId: 's1', cwd: project, caseId: caseA })
  assert.deepEqual(aRuns.map((run) => run.runId), [
    '20261123-120000-000-cccccc', '20261123-100000-000-aaaaaa'])
  assert.deepEqual(aRuns.map((run) => run.source), ['case', 'all'])

  const bRuns = await runList({ sessionId: 's1', cwd: project, caseId: caseB })
  // 选中执行 + 全部执行；不含单条 A 的那次。
  assert.deepEqual(bRuns.map((run) => run.runId), [
    '20261123-110000-000-bbbbbb', '20261123-100000-000-aaaaaa'])
  assert.deepEqual(bRuns.map((run) => run.source), ['cases', 'all'])
  assert.equal(bRuns[1].outcome, 'failed')
  assert.equal(bRuns[1].message, '断言失败')

  // 重复刷新不会重复生成记录（同一 runId + caseId 只出现一次）。
  const again = await runList({ sessionId: 's1', cwd: project, caseId: caseB })
  assert.deepEqual(again.map((run) => run.runId), bRuns.map((run) => run.runId))
  const unique = new Set(again.map((run) => `${run.runId}|${run.caseId}`))
  assert.equal(unique.size, again.length)

  const summary = await runSummary({ sessionId: 's1', cwd: project })
  for (const [caseId, runs] of [[caseA, aRuns], [caseB, bRuns],
    [caseC, await runList({ sessionId: 's1', cwd: project, caseId: caseC })]]) {
    assert.equal(summary[caseId].count, runs.length)
    assert.equal(summary[caseId].latestOutcome, runs[0].caseOutcome)
  }
})

test('不属于该用例的 run 不会产生记录', async () => {
  const project = mkdtempSync(join(tmpdir(), 'dsh-unit-runs2-'))
  const root = makeRoot('s2', project)
  const caseA = 'BJ-PKG-A-T001.CTD'
  const caseX = 'GN-PKG-X-T001.CTD'
  writeRun(root, '20261123-100000-000-dddddd', {
    runId: '20261123-100000-000-dddddd',
    scope: 'cases',
    status: 'passed',
    cases: [caseX],
    tests: [{ caseId: caseX, func: 'X.Test', outcome: 'passed' }],
  }, [{ caseId: caseX }], [caseX])

  const runs = await runList({ sessionId: 's2', cwd: project, caseId: caseA })
  assert.deepEqual(runs, [])
})

test('批量 run 整体通过、但这条用例没有逐条结果时，记为未知而不是通过', async () => {
  const project = mkdtempSync(join(tmpdir(), 'dsh-unit-runs3-'))
  const root = makeRoot('s3', project)
  const caseA = 'BJ-PKG-A-T001.CTD'
  const caseB = 'GN-PKG-B-T002.CTD'
  // 整体 passed、cases/targets 都包含 A，但 tests 里只有 B 的逐条结果：
  // 不能因为“整批通过”就把 A 也显示成通过。
  writeRun(root, '20261123-100000-000-eeeeee', {
    runId: '20261123-100000-000-eeeeee',
    scope: 'all',
    status: 'passed',
    durationMs: 9000,
    cases: [caseA, caseB],
    notRun: [{ caseId: caseA, reason: '用例没有关联测试函数/测试名' }],
    tests: [{ caseId: caseB, func: 'B.Test', outcome: 'passed', durationMs: 5 }],
  }, [{ caseId: caseA }, { caseId: caseB }], [caseA, caseB])

  const runs = await runList({ sessionId: 's3', cwd: project, caseId: caseA })
  assert.equal(runs.length, 1)
  assert.equal(runs[0].outcome, 'unknown')
  // 未执行原因透传出来，而不是把整批的耗时/通过状态当成本条结果。
  assert.match(runs[0].message, /没有关联测试函数/)
  assert.equal(runs[0].durationMs, 0)
  const summary = await runSummary({ sessionId: 's3', cwd: project })
  assert.deepEqual(summary[caseA], {
    count: 1, latestOutcome: 'unknown', latestRunId: '20261123-100000-000-eeeeee',
  })
})

test('千条用例八次执行通过一次摘要请求得到计数和最新状态', async () => {
  const project = mkdtempSync(join(tmpdir(), 'dsh-unit-summary-'))
  try {
    const root = makeRoot('large-summary', project)
    const ids = Array.from({ length: 1000 }, (_, i) => `TC-${i}`)
    for (let run = 0; run < 8; run++) {
      writeRun(root, `run-${run}`, {
        scope: 'all', status: 'passed', cases: ids,
        note: 'x'.repeat(800 * 1024),
        tests: ids.map((caseId) => ({ caseId, outcome: run === 7 && caseId === 'TC-3' ? 'failed' : 'passed' })),
      }, ids.map((caseId) => ({ caseId })), ids)
    }
    const summary = await runSummary({ sessionId: 'large-summary', cwd: project })
    assert.equal(Object.keys(summary).length, 1000)
    assert.equal(summary['TC-3'].count, 8)
    assert.equal(summary['TC-3'].latestOutcome, 'failed')
    assert.equal(summary['TC-999'].latestOutcome, 'passed')
  } finally {
    rmSync(project, { recursive: true, force: true })
  }
})

// ── 通过真实面板 API 写入 → 读取 → 精确跳转 ──────────────────────────

const API_SESSION = 'unit-api-s1'

async function apiPost(body) {
  const req = Readable.from([JSON.stringify({ sessionId: API_SESSION, ...body })])
  req.method = 'POST'
  req.url = '/data-panel/api'
  req.headers = {}
  let status = 0, data = null
  await api.handle(req, {
    writeHead(code) { status = code },
    end(raw) { data = JSON.parse(raw) },
  })
  return { status, ...(data || {}) }
}

async function apiGet() {
  const req = Readable.from([])
  req.method = 'GET'
  req.url = `/data-panel/api?sessionId=${API_SESSION}`
  req.headers = {}
  let status = 0, data = null
  await api.handle(req, {
    writeHead(code) { status = code },
    end(raw) { data = JSON.parse(raw) },
  })
  return { status, ...(data || {}) }
}

test('面板 API 保存 testFunc / sequence / testLocation，读回后用它们精确跳转', async () => {
  const project = mkdtempSync(join(tmpdir(), 'dsh-unit-api-'))
  const asset = join(project, '.dsh', 'test-sessions', API_SESSION)
  mkdirSync(join(asset, 'tests'), { recursive: true })
  const testFile = join(asset, 'tests', 'test_generated.cpp')
  const text = [
    '#include <gtest/gtest.h>',
    'TEST(OtherSuite, OtherCase) {',
    '}',
    'TEST(OrderAddLineTest, Zero) {',
    '}',
  ].join('\n')
  writeFileSync(testFile, text, 'utf8')
  writeFileSync(join(asset, 'runner.json'), JSON.stringify({
    preset: 'gtest', testFile: 'tests/test_generated.cpp',
  }), 'utf8')
  const sha = createHash('sha256').update(text, 'utf8').digest('hex')

  // 走真实 HTTP 入口创建（不是直接调 normalizePatch）。
  const created = await apiPost({
    op: 'create',
    record: {
      caseId: 'BJ-PKG-ADD_LINE-T001.CTD',
      title: 'addLine-边界测试',
      testType: 'boundary',
      subjectFunction: 'src/order.cpp::Order::addLine',
      testFunc: 'OrderAddLineTest.Zero',
      sequence: 'T001',
      testLocation: { file: testFile, line: 1, column: 1, fileSha256: 'c'.repeat(64) },
    },
  })
  assert.equal(created.status, 200, created.error)
  assert.equal(created.record.testFunc, 'OrderAddLineTest.Zero')
  assert.equal(created.record.sequence, 'T001')
  assert.equal(created.record.testLocation.line, 1)

  // 再走一次读接口：字段必须从磁盘回来，不是靠内存对象。
  const list = await apiGet()
  assert.equal(list.status, 200, list.error)
  const stored = list.records.find((item) => item.caseId === 'BJ-PKG-ADD_LINE-T001.CTD')
  assert.ok(stored, '读取结果里找不到刚创建的用例')
  assert.equal(stored.testFunc, 'OrderAddLineTest.Zero')
  assert.equal(stored.sequence, 'T001')
  assert.equal(stored.testLocation.file, testFile)

  // 用磁盘上的 store 精确跳转：哈希不匹配（'c'*64）→ 按 testFunc 重新定位到第 4 行。
  const store = await api.readStore(API_SESSION)
  const resolved = await api.resolveTestCode({
    sessionId: API_SESSION, cwd: project, caseId: 'BJ-PKG-ADD_LINE-T001.CTD', store,
  })
  assert.equal(resolved.line, 4)
  assert.equal(resolved.testFunc, 'OrderAddLineTest.Zero')
  assert.equal(resolved.testLocation.fileSha256, sha)

  // 重新定位后写回用例：再读一次已是正确位置。
  const after = await api.readStore(API_SESSION)
  const refreshed = after.records.find((item) => item.caseId === 'BJ-PKG-ADD_LINE-T001.CTD')
  assert.equal(refreshed.testLocation.line, 4)
  assert.equal(refreshed.testLocation.fileSha256, sha)
})
