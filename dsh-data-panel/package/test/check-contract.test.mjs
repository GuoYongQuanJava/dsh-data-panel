import test from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const SCRIPT = fileURLToPath(new URL('../assets/report/check_contract.py', import.meta.url))
const PY = process.env.DSH_PYTHON_PATH || 'python'

function run(root) {
  const r = spawnSync(PY, [SCRIPT, '--root', root], { encoding: 'utf8' })
  return { status: r.status, out: (r.stdout || '') + (r.stderr || '') }
}

async function writeJson(path, value) {
  await writeFile(path, JSON.stringify(value, null, 2), 'utf8')
}

/**
 * 造一份**完全合规**的集成目录。
 * 字段名全部照真实跑通的数据（case-versions/V0_0_1、runner.json、result.json）写，
 * 不是想象的 —— 契约本身就来自这些真实文件。
 */
async function makeValid() {
  const root = await mkdtemp(join(tmpdir(), 'contract-ok-'))
  await mkdir(join(root, 'case-versions', 'V0_0_1'), { recursive: true })
  await mkdir(join(root, 'step-versions', 'V0_0_1'), { recursive: true })
  await mkdir(join(root, 'runs', 'run_1', 'snapshot'), { recursive: true })
  await mkdir(join(root, 'report-versions'), { recursive: true })

  await writeJson(join(root, 'case-versions', 'V0_0_1', 'features.json'), [
    { id: 'ft_001', code: 'F-001', name: '功能项A', description: 'd', source: 'skill', stage: '阶段一' },
  ])
  await writeJson(join(root, 'case-versions', 'V0_0_1', 'cases.json'), [
    {
      id: 'it_1', caseId: 'V0_0_1-IT-001', caseCode: 'GN-1-T001.CTD', featureId: 'ft_001',
      title: '用例一', type: 'functional', description: 'd', precondition: 'p',
      expectedResult: 'e', steps: [],
    },
  ])
  await writeJson(join(root, 'step-versions', 'V0_0_1', 'steps.json'), {
    stepVersion: 'V0.0.1', sourceCaseVersion: 'V0.0.1', generatedAt: '2026-11-20T10:00:00Z',
    channelLegend: { cua: 'c', runner: 'r' },
    cases: [{
      id: 'it_1', caseId: 'V0_0_1-IT-001', caseCode: 'GN-1-T001.CTD', featureId: 'ft_001',
      featureName: '功能项A', title: '用例一', type: 'functional', createdAt: '2026-11-20T10:00:00Z',
      steps: [{ no: 1, action: 'a', operation: 'o', expected: 'e', target: 't1', channel: 'cua' }],
      records: [{ runId: 'run_1', at: '2026-11-20T11:00:00Z', result: 'pass', durationMs: 10, source: 'all' }],
    }],
  })
  await writeJson(join(root, 'runner.json'), {
    preset: 'pytest', testFile: 'root:integration/tests/test_x.py', mode: 'batch',
  })
  await writeJson(join(root, 'runs', 'run_1', 'snapshot', 'steps.json'), { cases: [] })
  await writeJson(join(root, 'runs', 'run_1', 'snapshot', 'cases.snapshot.json'), [])
  await writeJson(join(root, 'runs', 'run_1', 'result.json'), {
    runId: 'run_1', stepVersion: 'V0.0.1', caseVersion: 'V0.0.1',
    startedAt: '2026-11-20T11:00:00Z',
    steps: [{ caseId: 'V0_0_1-IT-001', stepNo: 1, target: 't1', channel: 'cua', outcome: 'passed' }],
  })
  await writeJson(join(root, 'report-versions', 'index.json'), {
    versions: [{ name: 'V0.0.1', sourceStepVersion: 'V0.0.1', runId: 'run_1' }],
    activeVersion: 'V0.0.1',
  })
  return root
}

test('合规数据校验通过（PASS + 退出码 0）', async () => {
  const root = await makeValid()
  const { status, out } = run(root)
  assert.equal(status, 0, out)
  assert.match(out, /结果：PASS/)
})

test('抓出自拟字段：featureId 写成 moduleEn（真实踩过的坑）', async () => {
  const root = await makeValid()
  await writeJson(join(root, 'case-versions', 'V0_0_1', 'cases.json'), [
    { caseId: 'V0_0_1-IT-001', title: 'x', type: 'functional', moduleEn: '自拟', purpose: '自拟' },
  ])
  const { status, out } = run(root)
  assert.equal(status, 1, out)
  assert.match(out, /缺少必填字段.*featureId/)
  assert.match(out, /契约外字段.*moduleEn/)
})

test('抓出 steps.json 暴露测试函数名（铁律违反）', async () => {
  const root = await makeValid()
  const p = join(root, 'step-versions', 'V0_0_1', 'steps.json')
  const doc = JSON.parse(await (await import('node:fs/promises')).readFile(p, 'utf8'))
  doc.cases[0].func = 'test_leaked'
  doc.cases[0].steps[0].codeFile = 'tests/test_x.py'
  await writeJson(p, doc)
  const { status, out } = run(root)
  assert.equal(status, 1, out)
  assert.match(out, /铁律违反/)
  assert.match(out, /func/)
})

test('抓出执行记录按步骤粒度写多条（应每 run 一条）', async () => {
  const root = await makeValid()
  const p = join(root, 'step-versions', 'V0_0_1', 'steps.json')
  const doc = JSON.parse(await (await import('node:fs/promises')).readFile(p, 'utf8'))
  doc.cases[0].records = [
    { runId: 'run_1', at: 'a', result: 'pass', durationMs: 1, source: 'all' },
    { runId: 'run_1', at: 'b', result: 'pass', durationMs: 1, source: 'all' },
  ]
  await writeJson(p, doc)
  const { status, out } = run(root)
  assert.equal(status, 1, out)
  assert.match(out, /同一 runId 有多条记录/)
})

test('抓出 result.json 用 tests[] 冒充 steps[]（最高价值的坑）', async () => {
  const root = await makeValid()
  await writeJson(join(root, 'runs', 'run_1', 'result.json'), {
    runId: 'run_1', tests: [{ name: 'test_x', status: 'passed' }],
  })
  const { status, out } = run(root)
  assert.equal(status, 1, out)
  assert.match(out, /缺少 steps\[\]/)
  assert.match(out, /发现 tests\[\].*bridge\.py 要的是 steps\[\]/)
})

test('抓出 outcome 写成 pass（应为 passed）', async () => {
  const root = await makeValid()
  await writeJson(join(root, 'runs', 'run_1', 'result.json'), {
    runId: 'run_1', stepVersion: 'V0.0.1',
    steps: [{ caseId: 'V0_0_1-IT-001', stepNo: 1, channel: 'cua', outcome: 'pass' }],
  })
  const { status, out } = run(root)
  assert.equal(status, 1, out)
  assert.match(out, /outcome 非法：pass/)
})

test('抓出快照没冻结（缺 cases.snapshot.json）', async () => {
  const root = await makeValid()
  const { rm } = await import('node:fs/promises')
  await rm(join(root, 'runs', 'run_1', 'snapshot', 'cases.snapshot.json'))
  const { status, out } = run(root)
  assert.equal(status, 1, out)
  assert.match(out, /缺少快照文件 cases\.snapshot\.json/)
})

test('抓出报告版本手写而非面板分配', async () => {
  const root = await makeValid()
  await writeJson(join(root, 'report-versions', 'index.json'), {
    versions: [{ name: 'V0.0.1', sourceStepVersion: 'V0.0.1' }], // 没有 runId
  })
  const { status, out } = run(root)
  assert.equal(status, 1, out)
  assert.match(out, /报告版本必须由面板分配/)
})

test('抓出 caseId 格式不对与孤儿 featureId', async () => {
  const root = await makeValid()
  await writeJson(join(root, 'case-versions', 'V0_0_1', 'cases.json'), [
    { id: 'x', caseId: 'BAD-ID', featureId: 'ft_nope', title: 't', type: 'functional' },
  ])
  const { status, out } = run(root)
  assert.equal(status, 1, out)
  assert.match(out, /caseId 格式不对/)
  assert.match(out, /featureId 在 features\.json 里找不到/)
})

test('抓出 stress 类型（本轮禁止）', async () => {
  const root = await makeValid()
  const p = join(root, 'case-versions', 'V0_0_1', 'cases.json')
  const doc = JSON.parse(await (await import('node:fs/promises')).readFile(p, 'utf8'))
  doc[0].type = 'stress'
  await writeJson(p, doc)
  const { status, out } = run(root)
  assert.equal(status, 1, out)
  assert.match(out, /测试类型非法.*stress/)
})

test('抓出 steps.json 写成扁平数组（面板会整片空白）', async () => {
  /*
   * 用户 2026-11-23 实测：模型把 steps.json 写成扁平数组，测试步骤页什么都不显示。
   * 面板已加兼容兜底，但契约仍要求分组式 —— 校验器要直接 FAIL 并给出正确写法。
   */
  const root = await makeValid()
  const p = join(root, 'step-versions', 'V0_0_1', 'steps.json')
  await writeJson(p, {
    stepVersion: 'V0.0.1',
    steps: [{ caseId: 'V0_0_1-IT-001', stepNo: 1, action: 'a' }],
  })
  const { status, out } = run(root)
  assert.equal(status, 1, out)
  assert.match(out, /缺少 cases\[\] 分组结构/)
  assert.match(out, /扁平写法.*必须改成 cases/)
})
