import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'

const DOCX = 'C:/project/.dsh/test-sessions/session-a/reports/20261120-000000-abc/report.docx'
const PDF = 'C:/project/.dsh/test-sessions/session-a/reports/20261120-000000-abc/report.pdf'

/**
 * 最小的 client.js 加载器：只提供 openReportFile 需要的全局（fetch / 定时器 /
 * AbortController），不渲染 React 组件。
 */
function harness(options = {}) {
  let descriptor = null
  const fetchCalls = []
  const opened = []
  const sidebar = options.sidebar === undefined
    ? {
      openFile(scope, path) {
        opened.push(path)
      },
      openTab() {},
      subscribeState() {
        return () => {}
      },
      getSnapshot() {
        return { sessionId: 'session-a' }
      },
    }
    : options.sidebar

  const sandbox = {
    window: { __ModuleLoader__: { load: (mod) => { descriptor = mod } } },
    console: { info() {}, warn() {}, error() {}, log() {} },
    URLSearchParams,
    AbortController,
    setTimeout,
    clearTimeout,
    fetch(url, init) {
      fetchCalls.push({ url: String(url), init })
      if (typeof options.fetch === 'function') return options.fetch(String(url), init)
      return Promise.resolve({ ok: true, json: async () => ({ ok: true }) })
    },
  }
  vm.runInNewContext(readFileSync(new URL('../lib/client.js', import.meta.url), 'utf8'), sandbox)

  const React = {
    createElement: (type, props, ...children) => ({ type, props, children }),
    useState: (value) => [value, () => {}],
    useRef: (value) => ({ current: value }),
    useEffect() {},
  }
  const api = descriptor.factory((name) => (name === 'react' ? React : {})).__test
  api.setCodeServices({
    betterSidebar: sidebar,
    sessions: {
      list: {
        getSnapshot: () => ({ byId: { 'session-a': { cwd: 'C:/project' } } }),
      },
    },
  })
  return { api, fetchCalls, opened }
}

test('PDF 接口成功时，右侧栏打开 PDF 而不是 docx', async () => {
  const h = harness({
    fetch: (url) => {
      if (url.includes('/data-panel/report/pdf')) {
        return Promise.resolve({ ok: true, json: async () => ({ ok: true, path: PDF, cached: false }) })
      }
      return Promise.resolve({ ok: true, json: async () => ({ ok: true }) })
    },
  })

  await h.api.openReportFile(DOCX, 'session-a')

  assert.deepEqual(h.opened, [PDF])
  assert.equal(h.fetchCalls[0].url, '/data-panel/report/pdf')
})

test('PDF 转换失败（ok:false）时回退到原来的 docx 打开链路', async () => {
  const h = harness({
    fetch: (url) => {
      if (url.includes('/data-panel/report/pdf')) {
        return Promise.resolve({ ok: true, json: async () => ({ ok: false, error: 'Word：未安装' }) })
      }
      return Promise.resolve({ ok: true, json: async () => ({ ok: true }) })
    },
  })

  await h.api.openReportFile(DOCX, 'session-a')

  assert.deepEqual(h.opened, [DOCX])
})

test('PDF 打开时抛错也回退到 docx，不让报告点不开', async () => {
  const h = harness({
    sidebar: {
      openFile(scope, path) {
        if (path.endsWith('.pdf')) throw new Error('PDF 预览不可用')
        h.opened.push(path)
      },
      openTab() {},
      subscribeState() {
        return () => {}
      },
      getSnapshot() {
        return { sessionId: 'session-a' }
      },
    },
    fetch: (url) => {
      if (url.includes('/data-panel/report/pdf')) {
        return Promise.resolve({ ok: true, json: async () => ({ ok: true, path: PDF }) })
      }
      return Promise.resolve({ ok: true, json: async () => ({ ok: true }) })
    },
  })

  await h.api.openReportFile(DOCX, 'session-a')

  assert.deepEqual(h.opened, [DOCX])
})

test('没有 better-sidebar 时不请求转换，直接走宿主的系统默认程序', async () => {
  const h = harness({ sidebar: null })

  await h.api.openReportFile(DOCX, 'session-a')

  assert.deepEqual(h.opened, [])
  assert.equal(h.fetchCalls.length, 1)
  assert.equal(h.fetchCalls[0].url, '/data-panel/open')
})