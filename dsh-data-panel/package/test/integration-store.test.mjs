/**
 * 集成测试数据层（lib/integration-store.js）与 /data-panel/integration 接口的自动化测试。
 *
 * 覆盖四件事：
 *   1. 版本号三段式比较（V0.0.10 > V0.0.9，字符串比会错）
 *   2. 读写三个页面（case / step / report）的版本目录
 *   3. 新建版本永不覆盖旧版本；旧版本转 archived
 *   4. HTTP 接口：GET 一次拿三类、POST saveVersion / createVersion / setActive，
 *      sessionId 缺失一律 400
 *
 * 运行：node --test test
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Readable } from 'node:stream'

import {
  nextVersionName,
  readAll,
  readIndex,
  readVersion,
  requireVersionName,
  saveVersion,
  setActiveVersion,
  versionDir,
  versionValue,
  createVersion,
} from '../lib/integration-store.js'
import { __test as panel } from '../lib/index.js'

/** 造一个带 integration 目录的临时会话资产根。 */
function makeSessionRoot() {
  const base = mkdtempSync(join(tmpdir(), 'dsh-it-store-'))
  const sessionRoot = join(base, '.dsh', 'test-sessions', 'test-session-1')
  mkdirSync(sessionRoot, { recursive: true })
  return { base, sessionRoot }
}

function writeJsonFile(file, value) {
  mkdirSync(join(file, '..'), { recursive: true })
  writeFileSync(file, JSON.stringify(value, null, 2), 'utf8')
}

test('版本号按数字段比较：V0.0.10 晚于 V0.0.9，不是字符串序', () => {
  assert.equal(versionValue('V0.0.1'), 1)
  assert.equal(versionValue('V0.0.9'), 9)
  assert.equal(versionValue('V0.0.10'), 10)
  assert.ok(versionValue('V0.0.10') > versionValue('V0.0.9'), 'V0.0.10 必须比 V0.0.9 大')
  // 字符串比较会得出相反结论 —— 这正是不能用字符串比的原因
  assert.ok('V0.0.10' < 'V0.0.9')
  assert.equal(versionValue('V1.2.3'), 1 * 1000000 + 2 * 1000 + 3)
})

test('nextVersionName 在当前最大值上递增，空清单从 V0.0.1 起', () => {
  assert.equal(nextVersionName([]), 'V0.0.1')
  assert.equal(nextVersionName([{ name: 'V0.0.1' }]), 'V0.0.2')
  assert.equal(nextVersionName([{ name: 'V0.0.9' }]), 'V0.0.10')
  assert.equal(nextVersionName([{ name: 'V0.0.2' }, { name: 'V0.0.10' }]), 'V0.0.11')
})

test('versionDir 把点换成下划线；requireVersionName 拒绝路径穿越', () => {
  assert.equal(versionDir('V0.0.1'), 'V0_0_1')
  assert.equal(versionDir('V0.0.10'), 'V0_0_10')
  assert.equal(requireVersionName('V0.0.1'), 'V0.0.1')
  // 两段式也接受（V1.0），面板若给出这种写法不至于报错
  assert.equal(requireVersionName('V1.0'), 'V1.0')
  assert.throws(() => requireVersionName('../etc'), /版本号不合法/)
  assert.throws(() => requireVersionName('V0.0.1/../x'), /版本号不合法/)
  assert.throws(() => requireVersionName(''), /版本号不合法/)
  assert.throws(() => requireVersionName('v0.0.1'), /版本号不合法/)
})

test('空会话读到空索引，不报错（首次使用就是没有数据）', async () => {
  const { base, sessionRoot } = makeSessionRoot()
  try {
    const all = await readAll(sessionRoot)
    for (const kind of ['case', 'step', 'report']) {
      assert.deepEqual(all[kind].index.versions, [], kind + ' 应是空版本清单')
      assert.equal(all[kind].activeVersion, '', kind + ' 没有当前版本')
      assert.equal(all[kind].data, null, kind + ' 没有数据')
    }
  } finally {
    rmSync(base, { recursive: true, force: true })
  }
})

test('读用例版本：features.json + cases.json 都吃下来', async () => {
  const { base, sessionRoot } = makeSessionRoot()
  try {
    const dir = join(sessionRoot, 'integration', 'case-versions', 'V0_0_1')
    writeJsonFile(join(dir, 'features.json'), [{ id: 'ft_001', name: '登录' }])
    writeJsonFile(join(dir, 'cases.json'), [
      { caseId: 'V0_0_1-IT-001', featureId: 'ft_001', type: 'functional' },
      { caseId: 'V0_0_1-IT-002', featureId: 'ft_001', type: 'api' },
    ])
    writeJsonFile(join(sessionRoot, 'integration', 'case-versions', 'index.json'), {
      versions: [{ name: 'V0.0.1', at: '2026-11-19T10:00:00Z', status: 'current' }],
      activeVersion: 'V0.0.1',
      byVersion: { 'V0.0.1': { features: 'V0_0_1/features.json', cases: 'V0_0_1/cases.json' } },
    })

    const all = await readAll(sessionRoot)
    assert.equal(all.case.activeVersion, 'V0.0.1')
    assert.equal(all.case.data.features.length, 1)
    assert.equal(all.case.data.cases.length, 2)
    assert.equal(all.case.data.cases[0].caseId, 'V0_0_1-IT-001')
  } finally {
    rmSync(base, { recursive: true, force: true })
  }
})

test('读步骤版本：steps.json 是对象形态时从 cases[] 摊平，execRecords 一并读回', async () => {
  const { base, sessionRoot } = makeSessionRoot()
  try {
    const dir = join(sessionRoot, 'integration', 'step-versions', 'V0_0_1')
    writeJsonFile(join(dir, 'steps.json'), {
      stepVersion: 'V0.0.1',
      sourceCaseVersion: 'V0.0.1',
      channelLegend: { cua: 'model', runner: 'runner+model' },
      cases: [
        { caseId: 'V0_0_1-IT-001', steps: [{ no: 1, action: '打开页面' }, { no: 2, action: '点登录' }] },
      ],
    })
    writeJsonFile(join(dir, 'exec-records.json'), {
      'V0.0.1': { 'V0_0_1-IT-001': [{ runId: 'run_1', at: '2026-11-19T10:00:00Z', result: 'pass', durationMs: 100 }] },
    })
    writeJsonFile(join(sessionRoot, 'integration', 'step-versions', 'index.json'), {
      versions: [{ name: 'V0.0.1', sourceCaseVersion: 'V0.0.1', status: 'current' }],
      activeVersion: 'V0.0.1',
      byVersion: {},
    })

    const all = await readAll(sessionRoot)
    assert.equal(all.step.data.cases.length, 1, '对象形态要能从 cases[] 取到用例')
    assert.equal(all.step.data.cases[0].steps.length, 2)
    assert.equal(all.step.data.meta.sourceCaseVersion, 'V0.0.1', '来源用例版本要保留')
    assert.ok(all.step.data.execRecords['V0.0.1'], '执行记录要读回')
  } finally {
    rmSync(base, { recursive: true, force: true })
  }
})

test('新建版本：旧版本转 archived、目录按 V0_0_x、绝不覆盖旧内容', async () => {
  const { base, sessionRoot } = makeSessionRoot()
  try {
    const first = await createVersion(sessionRoot, 'case', {
      cases: [{ caseId: 'V0_0_1-IT-001' }],
      features: [{ id: 'ft_001' }],
    })
    assert.equal(first.name, 'V0.0.1')
    assert.ok(existsSync(join(sessionRoot, 'integration', 'case-versions', 'V0_0_1', 'cases.json')))

    const second = await createVersion(sessionRoot, 'case', {
      cases: [{ caseId: 'V0_0_2-IT-001' }, { caseId: 'V0_0_2-IT-002' }],
    })
    assert.equal(second.name, 'V0.0.2')

    const index = await readIndex(sessionRoot, 'case')
    assert.equal(index.versions.length, 2, '两个版本都要在')
    assert.equal(index.activeVersion, 'V0.0.2', '新版本成为 current')
    const old = index.versions.find((item) => item.name === 'V0.0.1')
    assert.equal(old.status, 'archived', '旧版本转 archived')

    // 旧版本内容必须原样保留，没被新版本覆盖
    const oldData = await readVersion(sessionRoot, 'case', 'V0.0.1')
    assert.equal(oldData.cases.length, 1, '旧版本的 1 条用例不能被动到')
    const newData = await readVersion(sessionRoot, 'case', 'V0.0.2')
    assert.equal(newData.cases.length, 2)
  } finally {
    rmSync(base, { recursive: true, force: true })
  }
})

test('三套版本各自独立：用例 10 个版本、步骤 1 个、报告 1 个，互不牵连', async () => {
  const { base, sessionRoot } = makeSessionRoot()
  try {
    for (let i = 0; i < 10; i += 1) await createVersion(sessionRoot, 'case', { cases: [] })
    await createVersion(sessionRoot, 'step', { steps: [] })
    await createVersion(sessionRoot, 'report', { report: { ok: true } })

    const cases = await readIndex(sessionRoot, 'case')
    const steps = await readIndex(sessionRoot, 'step')
    const reports = await readIndex(sessionRoot, 'report')
    assert.equal(cases.versions.length, 10, '用例页 10 个版本')
    assert.equal(steps.versions.length, 1, '步骤页只有 1 个版本 —— 不因用例多而生版本')
    assert.equal(reports.versions.length, 1, '报告页只有 1 个版本')

    assert.equal(steps.versions[0].name, 'V0.0.1', '步骤页从自己的 V0.0.1 起算')
  } finally {
    rmSync(base, { recursive: true, force: true })
  }
})

test('saveVersion 只改目标版本，不动其他版本', async () => {
  const { base, sessionRoot } = makeSessionRoot()
  try {
    await createVersion(sessionRoot, 'case', { cases: [{ caseId: 'V0_0_1-IT-001' }] })
    await createVersion(sessionRoot, 'case', { cases: [{ caseId: 'V0_0_2-IT-001' }] })

    await saveVersion(sessionRoot, 'case', 'V0.0.1', {
      cases: [{ caseId: 'V0_0_1-IT-001' }, { caseId: 'V0_0_1-IT-002' }],
    })

    const v1 = await readVersion(sessionRoot, 'case', 'V0.0.1')
    const v2 = await readVersion(sessionRoot, 'case', 'V0.0.2')
    assert.equal(v1.cases.length, 2, 'V0.0.1 被改成 2 条')
    assert.equal(v2.cases.length, 1, 'V0.0.2 不受影响')
  } finally {
    rmSync(base, { recursive: true, force: true })
  }
})

test('setActiveVersion 切换当前版本，版本不存在时报 404', async () => {
  const { base, sessionRoot } = makeSessionRoot()
  try {
    await createVersion(sessionRoot, 'case', { cases: [] })
    await createVersion(sessionRoot, 'case', { cases: [] })

    const index = await setActiveVersion(sessionRoot, 'case', 'V0.0.1')
    assert.equal(index.activeVersion, 'V0.0.1')
    assert.equal(index.versions.find((item) => item.name === 'V0.0.1').status, 'current')
    assert.equal(index.versions.find((item) => item.name === 'V0.0.2').status, 'archived')

    await assert.rejects(() => setActiveVersion(sessionRoot, 'case', 'V9.9.9'), (error) => {
      assert.equal(error.status, 404)
      return true
    })
  } finally {
    rmSync(base, { recursive: true, force: true })
  }
})

/** 造一个最小的 req 对象（满足 handler 读 method / url / async 迭代）。 */
function makeReq(method, url, body) {
  const chunks = body === undefined ? [] : [Buffer.from(JSON.stringify(body), 'utf8')]
  const req = Readable.from(chunks)
  req.method = method
  req.url = url
  return req
}

/** 收集 res 的写出结果。 */
function makeRes() {
  const res = {
    statusCode: 0,
    headers: {},
    body: '',
    headersSent: false,
    writeHead(status, headers) {
      this.statusCode = status
      this.headers = headers || {}
    },
    end(chunk) {
      if (chunk !== undefined) this.body += String(chunk)
      this.headersSent = true
    },
  }
  return res
}

test('HTTP：缺 sessionId 一律 400，不静默写到别处', async () => {
  const res = makeRes()
  await panel.handleIntegration(makeReq('GET', '/data-panel/integration'), res)
  assert.equal(res.statusCode, 400)
  assert.match(JSON.parse(res.body).error, /缺少会话 ID/)
})

test('HTTP：GET 带 kind 读单个页面，不带 kind 一次返回三类', async () => {
  const { base, sessionRoot } = makeSessionRoot()
  const project = join(base, 'proj')
  mkdirSync(join(project, '.dsh', 'test-sessions', 'sid-1', 'integration', 'case-versions', 'V0_0_1'), { recursive: true })
  writeJsonFile(join(project, '.dsh', 'test-sessions', 'sid-1', 'integration', 'case-versions', 'V0_0_1', 'cases.json'), [
    { caseId: 'V0_0_1-IT-001' },
  ])
  writeJsonFile(join(project, '.dsh', 'test-sessions', 'sid-1', 'integration', 'case-versions', 'index.json'), {
    versions: [{ name: 'V0.0.1', status: 'current' }],
    activeVersion: 'V0.0.1',
    byVersion: {},
  })
  try {
    const single = makeRes()
    await panel.handleIntegration(
      makeReq('GET', '/data-panel/integration?sessionId=sid-1&cwd=' + encodeURIComponent(project) + '&kind=case'),
      single,
    )
    assert.equal(single.statusCode, 200)
    const singleBody = JSON.parse(single.body)
    assert.equal(singleBody.kind, 'case')
    assert.equal(singleBody.data.cases.length, 1)

    const all = makeRes()
    await panel.handleIntegration(
      makeReq('GET', '/data-panel/integration?sessionId=sid-1&cwd=' + encodeURIComponent(project)),
      all,
    )
    assert.equal(all.statusCode, 200)
    const allBody = JSON.parse(all.body)
    assert.ok(allBody.kinds.case, '三类里至少有 case')
    assert.equal(allBody.kinds.case.data.cases.length, 1)
  } finally {
    rmSync(base, { recursive: true, force: true })
  }
  void sessionRoot
})

test('HTTP：POST saveVersion 把用例写回磁盘', async () => {
  const base = mkdtempSync(join(tmpdir(), 'dsh-it-http-'))
  const project = join(base, 'proj')
  mkdirSync(project, { recursive: true })
  try {
    const created = makeRes()
    await panel.handleIntegration(
      makeReq('POST', '/data-panel/integration?sessionId=sid-2&cwd=' + encodeURIComponent(project), {
        sessionId: 'sid-2',
        cwd: project,
        kind: 'case',
        op: 'createVersion',
        cases: [{ caseId: 'V0_0_1-IT-001' }],
      }),
      created,
    )
    assert.equal(created.statusCode, 200, created.body)
    assert.equal(JSON.parse(created.body).name, 'V0.0.1')

    const saved = makeRes()
    await panel.handleIntegration(
      makeReq('POST', '/data-panel/integration?sessionId=sid-2&cwd=' + encodeURIComponent(project), {
        sessionId: 'sid-2',
        cwd: project,
        kind: 'case',
        op: 'saveVersion',
        version: 'V0.0.1',
        cases: [{ caseId: 'V0_0_1-IT-001' }, { caseId: 'V0_0_1-IT-002' }],
      }),
      saved,
    )
    assert.equal(saved.statusCode, 200, saved.body)

    const file = join(project, '.dsh', 'test-sessions', 'sid-2', 'integration', 'case-versions', 'V0_0_1', 'cases.json')
    const onDisk = JSON.parse(readFileSync(file, 'utf8'))
    assert.equal(onDisk.length, 2, '磁盘上要有 2 条用例')
    assert.equal(onDisk[1].caseId, 'V0_0_1-IT-002')
  } finally {
    rmSync(base, { recursive: true, force: true })
  }
})

test('HTTP：不认识的 op 与非法 kind 都明确报 400', async () => {
  const base = mkdtempSync(join(tmpdir(), 'dsh-it-bad-'))
  const project = join(base, 'proj')
  mkdirSync(project, { recursive: true })
  try {
    const badOp = makeRes()
    await panel.handleIntegration(
      makeReq('POST', '/data-panel/integration?sessionId=sid-3&cwd=' + encodeURIComponent(project), {
        sessionId: 'sid-3',
        cwd: project,
        kind: 'case',
        op: 'nope',
      }),
      badOp,
    )
    assert.equal(badOp.statusCode, 400)
    assert.match(JSON.parse(badOp.body).error, /不支持的 op/)

    const badKind = makeRes()
    await panel.handleIntegration(
      makeReq('GET', '/data-panel/integration?sessionId=sid-3&cwd=' + encodeURIComponent(project) + '&kind=whatever'),
      badKind,
    )
    assert.equal(badKind.statusCode, 400)
    assert.match(JSON.parse(badKind.body).error, /kind 只能是/)
  } finally {
    rmSync(base, { recursive: true, force: true })
  }
})