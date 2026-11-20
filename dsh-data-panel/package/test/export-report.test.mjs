import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { __test, applySessions } from '../lib/index.js'

// 每个测试文件是独立进程：把 DSH_HOME 指到临时目录，别碰真实会话的 assets 映射。
process.env.DSH_HOME = await mkdtemp(join(tmpdir(), 'dsh-data-panel-home-'))
applySessions(null)

/** 最小 res 桩：只记录状态码与响应体。 */
function fakeRes() {
  return {
    status: 0,
    body: '',
    headersSent: false,
    writeHead(status) {
      this.status = status
    },
    end(payload) {
      this.body = payload
    },
  }
}

function fakeReq(body, url = '/data-panel/export') {
  const text = JSON.stringify(body)
  return {
    method: 'POST',
    url,
    async *[Symbol.asyncIterator]() {
      yield Buffer.from(text, 'utf8')
    },
  }
}

async function callExport(body) {
  const res = fakeRes()
  await __test.handleExport(fakeReq(body), res)
  return { status: res.status, data: JSON.parse(res.body) }
}

/**
 * 造一个带 reports/ 的会话目录，并给一份可导出的 docx。
 * 报告路径必须落在会话的 reports/ 下 —— 导出接口只认这里。
 */
async function makeProject() {
  const root = await mkdtemp(join(tmpdir(), 'dsh-data-panel-export-'))
  const sessionId = 'session-export'
  const reports = join(root, '.dsh', 'test-sessions', sessionId, 'reports', 'run_20261120_1000_all')
  await mkdir(reports, { recursive: true })
  const out = join(root, 'out')
  await mkdir(out, { recursive: true })
  return { root, sessionId, reports, out }
}

test('导出 docx 到选定目录，内容与源文件一致', async () => {
  const { root, sessionId, reports, out } = await makeProject()
  const docx = join(reports, '集成测试报告-整项目.docx')
  await writeFile(docx, 'fake docx body')

  const { status, data } = await callExport({ sessionId, cwd: root, dir: out, paths: [docx] })

  assert.equal(status, 200)
  assert.equal(data.ok, true)
  assert.equal(data.exported.length, 1)
  assert.equal(data.exported[0].name, '集成测试报告-整项目.docx')
  assert.equal(await readFile(join(out, '集成测试报告-整项目.docx'), 'utf8'), 'fake docx body')
})

test('目标目录已有同名文件时自动加序号，不覆盖原文件', async () => {
  const { root, sessionId, reports, out } = await makeProject()
  const docx = join(reports, 'report.docx')
  await writeFile(docx, 'new body')
  // 目标目录里先放一份同名的旧文件
  await writeFile(join(out, 'report.docx'), 'old body')

  const { data } = await callExport({ sessionId, cwd: root, dir: out, paths: [docx] })

  assert.equal(data.ok, true)
  assert.equal(data.exported[0].name, 'report (1).docx')
  // 原文件必须原样保留
  assert.equal(await readFile(join(out, 'report.docx'), 'utf8'), 'old body')
  assert.equal(await readFile(join(out, 'report (1).docx'), 'utf8'), 'new body')
})

test('批量导出多份报告，只弹一次目录框（一次请求全部复制）', async () => {
  const { root, sessionId, reports, out } = await makeProject()
  const a = join(reports, '集成测试报告-V1-IT-001.docx')
  const b = join(reports, '集成测试报告-V1-IT-002.docx')
  await writeFile(a, 'body-a')
  await writeFile(b, 'body-b')

  const { data } = await callExport({ sessionId, cwd: root, dir: out, paths: [a, b] })

  assert.equal(data.ok, true)
  assert.equal(data.exported.length, 2)
  assert.equal(await readFile(join(out, '集成测试报告-V1-IT-001.docx'), 'utf8'), 'body-a')
  assert.equal(await readFile(join(out, '集成测试报告-V1-IT-002.docx'), 'utf8'), 'body-b')
})

test('reports/ 之外的路径被拒绝，一份也不复制', async () => {
  const { root, sessionId, out } = await makeProject()
  const outside = join(root, 'secret.docx')
  await writeFile(outside, 'must not leak')

  const { data } = await callExport({ sessionId, cwd: root, dir: out, paths: [outside] })

  // 全部失败时返回 ok:false（前端据此提示「没有成功导出任何报告」）
  assert.equal(data.ok, false)
  assert.equal(data.exported.length, 0)
  assert.match(data.skipped[0].reason, /只允许打开本会话 reports\/ 下的文件/)
})

test('非 docx 文件被跳过，但同批里的 docx 照常导出', async () => {
  const { root, sessionId, reports, out } = await makeProject()
  const docx = join(reports, 'report.docx')
  const pdf = join(reports, 'report.pdf')
  await writeFile(docx, 'docx body')
  await writeFile(pdf, '%PDF fake')

  const { data } = await callExport({ sessionId, cwd: root, dir: out, paths: [pdf, docx] })

  assert.equal(data.ok, true)
  assert.equal(data.exported.length, 1)
  assert.equal(data.exported[0].name, 'report.docx')
  assert.equal(data.skipped.length, 1)
  assert.match(data.skipped[0].reason, /只支持导出 \.docx/)
})

test('导出目录不存在返回 404', async () => {
  const { root, sessionId, reports } = await makeProject()
  const docx = join(reports, 'report.docx')
  await writeFile(docx, 'body')

  const { status, data } = await callExport({ sessionId, cwd: root, dir: join(root, 'nope'), paths: [docx] })

  assert.equal(status, 404)
  assert.equal(data.ok, false)
  assert.match(data.error, /导出目录不存在/)
})

test('相对导出目录返回 400', async () => {
  const { root, sessionId, reports } = await makeProject()
  const docx = join(reports, 'report.docx')
  await writeFile(docx, 'body')

  const { status, data } = await callExport({ sessionId, cwd: root, dir: 'out', paths: [docx] })

  assert.equal(status, 400)
  assert.match(data.error, /必须是绝对路径/)
})

test('缺少会话 ID 返回 400', async () => {
  const { root, reports, out } = await makeProject()
  const docx = join(reports, 'report.docx')
  await writeFile(docx, 'body')

  const { status, data } = await callExport({ cwd: root, dir: out, paths: [docx] })

  assert.equal(status, 400)
  assert.match(data.error, /缺少会话 ID/)
})

test('没有要导出的报告返回 400', async () => {
  const { root, sessionId, out } = await makeProject()

  const { status, data } = await callExport({ sessionId, cwd: root, dir: out, paths: [] })

  assert.equal(status, 400)
  assert.match(data.error, /没有要导出的报告/)
})

test('freeNameIn 连续撞名时序号递增', async () => {
  const { out } = await makeProject()
  await writeFile(join(out, 'a.docx'), 'x')
  await writeFile(join(out, 'a (1).docx'), 'x')

  assert.equal(await __test.freeNameIn(out, 'a.docx'), 'a (2).docx')
  assert.equal(await __test.freeNameIn(out, 'never.docx'), 'never.docx')
})