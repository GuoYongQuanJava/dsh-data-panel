import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdir, mkdtemp, utimes, writeFile } from 'node:fs/promises'
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

function fakeReq(body) {
  const text = JSON.stringify(body)
  return {
    method: 'POST',
    url: '/data-panel/report/pdf',
    async *[Symbol.asyncIterator]() {
      yield Buffer.from(text, 'utf8')
    },
  }
}

async function call(body) {
  const res = fakeRes()
  await __test.handleReportPdf(fakeReq(body), res)
  return { status: res.status, data: JSON.parse(res.body) }
}

async function makeProject() {
  const root = await mkdtemp(join(tmpdir(), 'dsh-data-panel-pdf-'))
  const sessionId = 'session-report-pdf'
  const reports = join(root, '.dsh', 'test-sessions', sessionId, 'reports', '20261120-000000-abc')
  await mkdir(reports, { recursive: true })
  return { root, sessionId, reports }
}

test('同目录 PDF 比 docx 新时直接复用，不触发转换', async () => {
  const { root, sessionId, reports } = await makeProject()
  const docx = join(reports, 'report.docx')
  const pdf = join(reports, 'report.pdf')
  await writeFile(docx, 'fake docx')
  await writeFile(pdf, '%PDF-1.4 fake')
  const old = new Date(Date.now() - 60_000)
  await utimes(docx, old, old)

  const { status, data } = await call({ sessionId, cwd: root, path: docx })

  assert.equal(status, 200)
  assert.equal(data.ok, true)
  assert.equal(data.cached, true)
  assert.equal(data.engine, 'cache')
  assert.equal(data.path, pdf)
})

test('缺少会话 ID 返回 400', async () => {
  const { root, reports } = await makeProject()
  const docx = join(reports, 'report.docx')
  await writeFile(docx, 'fake docx')

  const { status, data } = await call({ cwd: root, path: docx })

  assert.equal(status, 400)
  assert.equal(data.ok, false)
  assert.match(data.error, /缺少会话 ID/)
})

test('相对路径返回 400，不做任何转换', async () => {
  const { root, sessionId, reports } = await makeProject()
  const docx = join(reports, 'report.docx')
  await writeFile(docx, 'fake docx')

  const { status, data } = await call({ sessionId, cwd: root, path: 'report.docx' })

  assert.equal(status, 400)
  assert.equal(data.ok, false)
  assert.match(data.error, /必须是绝对路径/)
})

test('reports/ 之外的文件（含 ../ 穿越）被拒绝', async () => {
  const { root, sessionId, reports } = await makeProject()
  const outside = join(root, 'outside.docx')
  await writeFile(outside, 'fake docx')

  // 直接给外部绝对路径。
  const direct = await call({ sessionId, cwd: root, path: outside })
  assert.equal(direct.status, 400)
  assert.match(direct.data.error, /只允许打开本会话 reports\/ 下的文件/)

  // 从 reports/ 里用 ../ 指到外部，解析后仍必须被拦住。
  const traversal = await call({ sessionId, cwd: root, path: join(reports, '..', '..', '..', '..', '..', 'outside.docx') })
  assert.equal(traversal.status, 400)
  assert.match(traversal.data.error, /只允许打开本会话 reports\/ 下的文件/)
})

test('reports/ 下的非 .docx 文件返回 400', async () => {
  const { root, sessionId, reports } = await makeProject()
  const note = join(reports, 'note.txt')
  await writeFile(note, 'not a report')

  const { status, data } = await call({ sessionId, cwd: root, path: note })

  assert.equal(status, 400)
  assert.equal(data.ok, false)
  assert.match(data.error, /只支持 \.docx 报告/)
})

test('文件不存在返回 404', async () => {
  const { root, sessionId, reports } = await makeProject()

  const { status, data } = await call({ sessionId, cwd: root, path: join(reports, 'missing.docx') })

  assert.equal(status, 404)
  assert.equal(data.ok, false)
  assert.match(data.error, /报告文件不存在/)
})