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
import { fileURLToPath } from 'node:url'

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

/**
 * 回归：集成测试的报告放在 `<会话根>/integration/reports/<runId>/`，
 * 而不是单元测试那套 `<会话根>/reports/<runId>/`。
 *
 * 曾经踩过：报告文件明明在磁盘上（74 份单条 + 1 份总体，266KB），
 * 面板却提示「这次执行还没有生成 Word 报告」—— 因为 /data-panel/run/report
 * 只在会话根下找 reports/，从来没看过 integration/ 这一层。
 */
test('HTTP：/run/report 能在集成测试的 integration/reports 下找到报告', async () => {
  const base = mkdtempSync(join(tmpdir(), 'dsh-it-report-'))
  const sessionId = 'sid-integration-report'
  const project = join(base, 'proj')
  const sessionRoot = join(project, '.dsh', 'test-sessions', sessionId)
  const integrationRoot = join(sessionRoot, 'integration')
  const runId = 'run_20261120_1020_all'

  try {
    // 造出集成测试的真实布局：integration/{runs,reports}/<runId>/
    mkdirSync(join(integrationRoot, 'runs', runId), { recursive: true })
    writeJsonFile(join(integrationRoot, 'runs', runId, 'result.json'), {
      runId,
      stepVersion: 'V0.0.1',
      caseVersion: 'V0.0.1',
      steps: [],
    })
    const caseDir = join(integrationRoot, 'reports', runId, 'cases')
    mkdirSync(caseDir, { recursive: true })
    writeFileSync(join(integrationRoot, 'reports', runId, '集成测试报告-整项目-V0.0.1.docx'), 'overall')
    writeFileSync(join(caseDir, '集成测试报告-V0_0_1-IT-001-全步骤-V0.0.1.docx'), 'single')

    const res = makeRes()
    await panel.handleRunReport(
      makeReq(
        'GET',
        '/data-panel/run/report?sessionId=' + sessionId
          + '&cwd=' + encodeURIComponent(project)
          + '&runId=' + runId,
      ),
      res,
    )
    assert.equal(res.statusCode, 200)
    const body = JSON.parse(res.body)
    assert.equal(body.ok, true)
    assert.equal(body.exists, true, '集成测试的报告目录必须能被找到')

    const names = body.files.map((f) => f.name)
    assert.ok(
      names.includes('集成测试报告-整项目-V0.0.1.docx'),
      '总体报告应出现在文件列表里，实际：' + JSON.stringify(names),
    )
    assert.ok(
      names.includes('集成测试报告-V0_0_1-IT-001-全步骤-V0.0.1.docx'),
      'cases/ 下的单条报告也应被列出，实际：' + JSON.stringify(names),
    )
    // kind 要能区分总体报告与单条报告（报告页靠它挑文件）
    const overall = body.files.find((f) => f.name === '集成测试报告-整项目-V0.0.1.docx')
    const single = body.files.find((f) => f.name.includes('IT-001'))
    assert.equal(overall.kind, 'overall')
    assert.equal(single.kind, 'case')
  } finally {
    rmSync(base, { recursive: true, force: true })
  }
})

/**
 * 回归：集成测试面板也要把会话资产根写进映射文件。
 *
 * 与单元测试侧 prepareRun() → rememberAssetRoot() 保持一致。
 * 不写映射的话，读侧 resolveReadRoots() 只能靠客户端传来的 cwd 猜 ——
 * 一旦 cwd 与真实项目目录有偏差，报告/日志/结果全部找不到。
 */
test('集成接口调用后会把资产根记进映射文件（与单元测试一致）', async () => {
  const base = mkdtempSync(join(tmpdir(), 'dsh-it-assetmap-'))
  const sessionId = 'sid-assetmap-' + Math.random().toString(36).slice(2, 8)
  const project = join(base, 'proj')
  mkdirSync(join(project, 'package.json', '..'), { recursive: true })
  writeJsonFile(join(project, 'package.json'), { name: 'demo', version: '1.0.0' })

  try {
    const res = makeRes()
    await panel.handleIntegration(
      makeReq('GET', '/data-panel/integration?sessionId=' + sessionId + '&cwd=' + encodeURIComponent(project)),
      res,
    )
    assert.equal(res.statusCode, 200)

    // 映射文件写在插件数据目录下
    const mapFile = join(panel.dataDir(), `assets-${sessionId}.json`)
    assert.ok(existsSync(mapFile), '应写入资产根映射：' + mapFile)

    const parsed = JSON.parse(readFileSync(mapFile, 'utf8'))
    assert.ok(Array.isArray(parsed.roots) && parsed.roots.length > 0)
    // 存的是**标准会话资产根**（不含 /integration），报告侧再向下找 integration/
    const expected = join(project, '.dsh', 'test-sessions', sessionId)
    assert.ok(
      parsed.roots.some((item) => item && item.root === expected),
      '映射里应包含 ' + expected + '，实际：' + JSON.stringify(parsed.roots),
    )
  } finally {
    rmSync(base, { recursive: true, force: true })
    try {
      rmSync(join(panel.dataDir(), `assets-${sessionId}.json`), { force: true })
    } catch {
      // 清理失败不影响断言结果
    }
  }
})

/**
 * 回归：报告生成器路径必须**按插件包自身位置**解析，不能靠写死的绝对路径。
 *
 * 曾经踩过：SKILL.md / 面板话术里硬编码
 * `F:\插件开发\...\integration_report.py`，别人 clone 到别的盘就失效，
 * 而 Skill 又要求「缺失必须报错不许降级」，于是换台机器报告根本生成不出来。
 */
test('报告生成器路径按包位置解析，不含机器相关的绝对路径', () => {
  const resolved = panel.integrationReportScriptPath()
  assert.equal(typeof resolved, 'string')
  assert.ok(resolved !== '', '在本仓库内应能解析到 integration_report.py')
  assert.ok(existsSync(resolved), '解析出的路径必须真实存在：' + resolved)
  assert.match(resolved, /integration_report\.py$/)
  // 解析结果必须来自包自身的相对定位，而不是某台机器的固定前缀。
  // 层级：<仓库根>/dsh-data-panel/package/lib/index.js
  //   ..        → package/
  //   ../..     → dsh-data-panel/
  //   ../../..  → 仓库根
  const libIndex = new URL('../lib/index.js', import.meta.url)
  const pkgRoot = fileURLToPath(new URL('..', libIndex))
  const repoRoot = fileURLToPath(new URL('../../..', libIndex))
  const inside = resolved.startsWith(pkgRoot) || resolved.startsWith(repoRoot)
  assert.ok(inside, '生成器应位于插件包或仓库内，实际：' + resolved)
})

test('readAll 带上所有版本的内容，切版本不需要依赖对话', async () => {
  /*
   * 用户 2026-11-20 反馈：生成了 V0.0.2，面板里切过去是空的，
   * 必须在对话框让模型「切换到 V0.0.2」才会有数据。
   *
   * 根因是 readAll 只读 activeVersion 的内容，其他版本只有名字。
   * 切版本是面板的日常操作，不该依赖模型 —— 所以现在每个版本的内容都要给。
   */
  const { base, sessionRoot } = makeSessionRoot()
  try {
    const root = join(sessionRoot, 'integration', 'case-versions')
    // 两个版本各自有不同的用例
    for (const [dir, caseId, title] of [
      ['V0_0_1', 'V0_0_1-IT-001', '第一版用例'],
      ['V0_0_2', 'V0_0_2-IT-001', '第二版用例'],
    ]) {
      writeJsonFile(join(root, dir, 'features.json'), [{ id: 'ft_001', name: '功能项' }])
      writeJsonFile(join(root, dir, 'cases.json'), [{ caseId, featureId: 'ft_001', title }])
    }
    writeJsonFile(join(root, 'index.json'), {
      versions: [
        { name: 'V0.0.1', at: '2026-11-19T10:00:00Z', status: 'archived' },
        { name: 'V0.0.2', at: '2026-11-20T10:00:00Z', status: 'current' },
      ],
      activeVersion: 'V0.0.2',
      byVersion: {
        'V0.0.1': { features: 'V0_0_1/features.json', cases: 'V0_0_1/cases.json' },
        'V0.0.2': { features: 'V0_0_2/features.json', cases: 'V0_0_2/cases.json' },
      },
    })

    const all = await readAll(sessionRoot)
    assert.equal(all.case.activeVersion, 'V0.0.2')
    // 当前版本照旧
    assert.equal(all.case.data.cases[0].caseId, 'V0_0_2-IT-001')
    // ★ 关键：非当前版本也必须有内容
    assert.ok(all.case.byVersion, 'readAll 要返回 byVersion')
    assert.equal(all.case.byVersion['V0.0.1'].cases[0].caseId, 'V0_0_1-IT-001', 'V0.0.1 的内容也要带上来')
    assert.equal(all.case.byVersion['V0.0.2'].cases[0].caseId, 'V0_0_2-IT-001')
  } finally {
    rmSync(base, { recursive: true, force: true })
  }
})

/*
 * ★ index.json 缺失 / 写坏时，必须按目录扫描兜底。
 *
 * 用户 2026-11-28 实测：对话框里已经把测试步骤写完了，测试步骤页
 * 「输入步骤 / 预期结果」两列全是「—」，点刷新也不出来；而用例页正常。
 *
 * 根因：模型只写了 step-versions/V0_0_1/steps.json，没写
 * step-versions/index.json（Skill 里写着「不要手写 index.json，
 * 面板自己会建版本」，但面板三个按钮只往对话框填话术，从不建版本）。
 * readIndex 只认 index.json → activeVersion='' → data=null → 步骤全丢。
 *
 * 契约文件写全了就该显示，不能因为少一个索引就整页「—」。
 */
test('step-versions/index.json 缺失时，按目录扫描兜底，步骤照样能读到', async () => {
  const { base, sessionRoot } = makeSessionRoot()
  try {
    const dir = join(sessionRoot, 'integration', 'step-versions', 'V0_0_1')
    mkdirSync(dir, { recursive: true })
    // 只写 steps.json，故意不写 index.json
    writeJsonFile(join(dir, 'steps.json'), {
      stepVersion: 'V0.0.1',
      cases: [{ caseId: 'V0_0_1-IT-001', steps: [{ no: 1, action: 'A', operation: 'O', expected: 'E' }] }],
    })

    const index = await readIndex(sessionRoot, 'step')
    assert.deepEqual(index.versions.map((item) => item.name), ['V0.0.1'], '目录要能被扫成版本')
    assert.equal(index.activeVersion, 'V0.0.1', '扫出来的最大版本当 activeVersion')

    const data = await readVersion(sessionRoot, 'step', 'V0.0.1')
    assert.equal(data.cases.length, 1, 'scanned 之后步骤内容要读得出来')
    assert.equal(data.cases[0].steps.length, 1)
  } finally {
    rmSync(base, { recursive: true, force: true })
  }
})

test('index.json 字段名写错（version / active）也要兜底，不能整页空白', async () => {
  const { base, sessionRoot } = makeSessionRoot()
  try {
    const root = join(sessionRoot, 'integration', 'step-versions')
    const dir = join(root, 'V0_0_1')
    mkdirSync(dir, { recursive: true })
    writeJsonFile(join(dir, 'steps.json'), {
      stepVersion: 'V0.0.1',
      cases: [{ caseId: 'V0_0_1-IT-001', steps: [{ no: 1, action: 'A', operation: 'O', expected: 'E' }] }],
    })
    // 两种实测踩过的写错方式
    for (const bad of [
      { versions: [{ version: 'V0.0.1' }], activeVersion: 'V0.0.1' },
      { versions: [{ name: 'V0.0.1' }], active: 'V0.0.1' },
      { versions: [], activeVersion: 'V0.0.1' },
      { versions: 'V0.0.1', activeVersion: 'V0.0.1' },
    ]) {
      writeJsonFile(join(root, 'index.json'), bad)
      const all = await readAll(sessionRoot)
      assert.equal(all.step.activeVersion, 'V0.0.1',
        'index 写坏时要扫目录兜底，实际拿到 ' + JSON.stringify(bad))
      assert.ok(all.step.data && all.step.data.cases.length === 1,
        '写坏的 index 不能导致步骤页空白')
    }
  } finally {
    rmSync(base, { recursive: true, force: true })
  }
})

test('扫目录兜底不会把非法目录名当版本', async () => {
  const { base, sessionRoot } = makeSessionRoot()
  try {
    const root = join(sessionRoot, 'integration', 'step-versions')
    mkdirSync(join(root, 'V0_0_1'), { recursive: true })
    mkdirSync(join(root, 'backup-temp'), { recursive: true })
    mkdirSync(join(root, '__pycache__'), { recursive: true })
    const index = await readIndex(sessionRoot, 'step')
    assert.deepEqual(index.versions.map((item) => item.name), ['V0.0.1'], '垃圾目录要被忽略')
  } finally {
    rmSync(base, { recursive: true, force: true })
  }
})

test('扫目录兜底按数字段排序：V0.0.10 是 active，不是 V0.0.9', async () => {
  const { base, sessionRoot } = makeSessionRoot()
  try {
    const root = join(sessionRoot, 'integration', 'step-versions')
    for (const name of ['V0_0_9', 'V0_0_10', 'V0_0_2']) {
      mkdirSync(join(root, name), { recursive: true })
      writeJsonFile(join(root, name, 'steps.json'), { cases: [] })
    }
    const index = await readIndex(sessionRoot, 'step')
    assert.equal(index.activeVersion, 'V0.0.10', '按数字段比，不是字符串序')
  } finally {
    rmSync(base, { recursive: true, force: true })
  }
})
