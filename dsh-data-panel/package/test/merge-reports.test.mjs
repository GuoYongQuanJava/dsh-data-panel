import test from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { __test, applySessions } from '../lib/index.js'

process.env.DSH_HOME = await mkdtemp(join(tmpdir(), 'dsh-data-panel-home-'))
applySessions(null)

const ASSETS = fileURLToPath(new URL('../assets/report/', import.meta.url))
const MERGE_SCRIPT = join(ASSETS, 'merge_reports.py')
const TEMPLATE = join(ASSETS, '配置项测试报告模板.docx')

function fakeRes() {
  return {
    status: 0,
    body: '',
    headersSent: false,
    writeHead(status) { this.status = status },
    end(payload) { this.body = payload },
  }
}

function fakeReq(body) {
  const text = JSON.stringify(body)
  return {
    method: 'POST',
    url: '/data-panel/export',
    async *[Symbol.asyncIterator]() { yield Buffer.from(text, 'utf8') },
  }
}

async function callExport(body) {
  const res = fakeRes()
  await __test.handleExport(fakeReq(body), res)
  return { status: res.status, data: JSON.parse(res.body) }
}

/** 造一个会话目录 + 若干份可导出的单条报告（真实 docx：从模板拷一份当表源）。 */
async function makeProject(count) {
  const root = await mkdtemp(join(tmpdir(), 'dsh-data-panel-merge-'))
  const sessionId = 'session-merge'
  const reports = join(root, '.dsh', 'test-sessions', sessionId, 'reports', 'run_1_all', 'cases')
  await mkdir(reports, { recursive: true })
  const out = join(root, 'out')
  await mkdir(out, { recursive: true })
  // 合并脚本要真正解析 docx，所以这里必须有合法 docx；模板本身就是合法 docx。
  const templateBytes = await readFile(TEMPLATE)
  const paths = []
  for (let i = 1; i <= count; i += 1) {
    const p = join(reports, `集成测试报告-用例${i}.docx`)
    await writeFile(p, templateBytes)
    paths.push(p)
  }
  return { root, sessionId, reports, out, paths }
}

async function hasPython() {
  const r = spawnSync(process.env.DSH_PYTHON_PATH || 'python', ['-c', 'import docx'], { encoding: 'utf8' })
  return r.status === 0
}

test('多选导出合并成一份 Word，不再是一堆散文件', async (t) => {
  if (!(await hasPython())) return t.skip('缺少 python-docx')
  const { root, sessionId, out, paths } = await makeProject(3)

  const { status, data } = await callExport({ sessionId, cwd: root, dir: out, paths })

  assert.equal(status, 200)
  assert.equal(data.ok, true)
  assert.equal(data.merged, true, '多选必须走合并分支')
  assert.equal(data.count, 3, '应合并 3 张表')
  assert.equal(data.exported.length, 1, '只产出 1 个文件')
  assert.equal(data.exported[0].name, '集成测试报告-选中用例汇总.docx')

  // 目录里只有合并件，没有残留的散文件
  const { readdir } = await import('node:fs/promises')
  const files = await readdir(out)
  assert.deepEqual(files, ['集成测试报告-选中用例汇总.docx'], '中间产物必须清理掉')
})

test('单条导出仍是单份文件，不走合并', async () => {
  const { root, sessionId, out, paths } = await makeProject(1)

  const { data } = await callExport({ sessionId, cwd: root, dir: out, paths })

  assert.equal(data.ok, true)
  assert.equal(data.merged, false, '单条不该合并')
  assert.equal(data.exported.length, 1)
  assert.equal(data.exported[0].name, '集成测试报告-用例1.docx', '保留原文件名')
})

test('合并件命名撞车时加序号，不覆盖已有汇总件', async (t) => {
  if (!(await hasPython())) return t.skip('缺少 python-docx')
  const { root, sessionId, out, paths } = await makeProject(2)
  await writeFile(join(out, '集成测试报告-选中用例汇总.docx'), 'old')

  const { data } = await callExport({ sessionId, cwd: root, dir: out, paths })

  assert.equal(data.merged, true)
  assert.equal(data.exported[0].name, '集成测试报告-选中用例汇总 (1).docx')
  assert.equal(await readFile(join(out, '集成测试报告-选中用例汇总.docx'), 'utf8'), 'old', '原文件不能被覆盖')
})

test('合并脚本本身：表数正确、标题只出现一次、表间有分页', async (t) => {
  if (!(await hasPython())) return t.skip('缺少 python-docx')
  const { paths, out } = await makeProject(3)
  const target = join(out, 'merged.docx')

  const result = spawnSync(
    process.env.DSH_PYTHON_PATH || 'python',
    [MERGE_SCRIPT, '--template', TEMPLATE, '--out', target, ...paths],
    { encoding: 'utf8' },
  )
  assert.equal(result.status, 0, result.stderr)
  assert.match(result.stdout, /^OK /)

  // 下到 XML 层核对：python-docx 的对象层看不到 pageBreakBefore 的真实位置。
  const { execFileSync } = await import('node:child_process')
  const probe = `
import sys, zipfile, re
import xml.etree.ElementTree as ET
W = '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}'
z = zipfile.ZipFile(sys.argv[1])
xml = z.read('word/document.xml').decode('utf-8')
body = re.search(r'<w:body>(.*)</w:body>', xml, re.S).group(1)
print('tbl=' + str(len(re.findall(r'<w:tbl>', body))))
print('pb=' + str(len(re.findall(r'<w:pageBreakBefore', body))))
print('title=' + str(len(re.findall(r'选中用例汇总', body))))
# 相邻表格之间必须有段落，否则 Word 会把它们并成一张表（真实踩过的坑）
root = ET.fromstring(xml)
seq = [c.tag.replace(W, '') for c in root.find(W + 'body')]
print('adjacent=' + str(sum(1 for i in range(len(seq)-1) if seq[i] == 'tbl' and seq[i+1] == 'tbl')))
`
  const probeFile = join(out, 'probe.py')
  await writeFile(probeFile, probe, 'utf8')
  const outText = execFileSync(process.env.DSH_PYTHON_PATH || 'python', [probeFile, target], { encoding: 'utf8' })
  assert.match(outText, /tbl=3/, '应有 3 张表')
  assert.match(outText, /pb=2/, '3 张表之间应有 2 个分页符')
  assert.match(outText, /title=1/, '文档标题只能出现一次')
  assert.match(outText, /adjacent=0/, '相邻表格之间必须有段落，否则 Word 会并成一张表')
})

test('合并脚本拒绝空输入', async () => {
  const r = spawnSync(process.env.DSH_PYTHON_PATH || 'python', [MERGE_SCRIPT, '--template', TEMPLATE, '--out', join(tmpdir(), 'x.docx')], { encoding: 'utf8' })
  assert.notEqual(r.status, 0)
  assert.match(r.stderr, /用法/)
})