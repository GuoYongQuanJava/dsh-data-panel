import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'

function harness({ running = true, listRunning = false, bound = true, awaiting = true } = {}) {
  let descriptor
  let state
  const effects = []
  const requests = []
  const timers = new Set()
  const listeners = new Set()
  const settled = []
  let snapshot = { running }
  let summary = { running: listRunning }
  const source = {
    getSnapshot: () => snapshot,
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener) },
  }
  const React = {
    createElement: (type, props, ...children) => ({ type, props, children }),
    useState(initial) {
      const value = typeof initial === 'function' ? initial() : initial
      const first = state === undefined
      if (first) state = value
      return [first ? state : value, next => { if (first) state = typeof next === 'function' ? next(state) : next }]
    },
    useRef: current => ({ current }),
    useEffect: effect => effects.push(effect),
  }
  const context = {
    window: { __ModuleLoader__: { load: value => { descriptor = value } } },
    URLSearchParams, console,
    fetch: () => new Promise(resolve => requests.push(runs => resolve({ ok: true, json: async () => ({ ok: true, runs }) }))),
    setInterval: fn => { timers.add(fn); return fn },
    clearInterval: fn => timers.delete(fn),
  }
  vm.runInNewContext(readFileSync(process.env.DSH_PANEL_CLIENT_PATH || new URL('../lib/client.js', import.meta.url), 'utf8'), context)
  const api = descriptor.factory(name => name === 'react' ? React : {}).__test
  api.setCodeServices({ sessions: {
    binding: id => bound && id === 'session-a' ? { session: source } : undefined,
    list: { getSnapshot: () => ({ byId: { 'session-a': summary } }) },
  } })
  api.RunRecords({
    record: { caseId: 'TC-1' }, sessionId: 'session-a', awaiting,
    pendingRunId: 'new', baselineRunId: 'old', clickedAt: Date.now(),
    onSettled: (...args) => settled.push(args),
  })
  const cleanups = effects.map(effect => effect()).filter(value => typeof value === 'function')
  return {
    get state() { return state },
    settled, listeners, timers, requests,
    async flush() { await new Promise(setImmediate) },
    async answer(runs) {
      const pending = requests.splice(0)
      pending.forEach(resolve => resolve(runs))
      await new Promise(setImmediate)
    },
    change(value) { snapshot = { running: value }; listeners.forEach(listener => listener()) },
    changeSummary(value) { summary = { running: value } },
    poll() { [...timers].forEach(fn => fn()) },
    dispose() { cleanups.forEach(cleanup => cleanup()) },
  }
}
const old = { runId: 'old', status: 'passed', finishedAt: '2026-11-15T00:00:00Z' }
const complete = { runId: 'new', status: 'passed', finishedAt: '2026-11-16T00:00:00Z' }
const active = { ...complete, status: 'running', finishedAt: '' }
const ids = h => Array.from(h.state.runs, run => run.runId)

test('分析期间初次加载和轮询都只显示旧记录，对话结束后发布本次结果', async () => {
  const h = harness()
  await h.answer([active, old])
  assert.deepEqual(ids(h), ['old'])
  assert.equal(h.settled.length, 0)
  h.poll()
  await h.answer([complete, old])
  assert.deepEqual(ids(h), ['old'])
  h.change(false)
  h.poll()
  await h.answer([complete, old])
  assert.deepEqual(ids(h), ['new', 'old'])
  assert.equal(h.settled.length, 1)
  h.dispose()
  assert.equal(h.listeners.size, 0)
  assert.equal(h.timers.size, 0)
})

test('对话已停止但本次结果仍在运行时继续等，不能把旧记录当成本次结果', async () => {
  const h = harness({ running: false })
  await h.answer([active, old])
  assert.deepEqual(ids(h), ['old'])
  assert.equal(h.settled.length, 0)
  h.poll()
  await h.answer([old])
  assert.equal(h.settled.length, 0)
  h.poll()
  await h.answer([complete, old])
  assert.equal(h.settled.length, 1)
  h.dispose()
})

test('没有历史记录时保持空列表，不能因为运行状态未知提前展示', async () => {
  const h = harness({ running: undefined, listRunning: undefined })
  h.change(undefined)
  h.changeSummary(undefined)
  await h.answer([complete])
  assert.deepEqual(ids(h), [])
  assert.equal(h.settled.length, 0)
  h.dispose()
})

test('绑定暂不可用时使用会话摘要，响应返回前重新检查运行状态', async () => {
  const h = harness({ bound: false, listRunning: true })
  await h.answer([complete, old])
  assert.deepEqual(ids(h), ['old'])
  h.changeSummary(false)
  h.poll()
  h.changeSummary(true)
  await h.answer([complete, old])
  assert.equal(h.settled.length, 0)
  h.changeSummary(false)
  h.poll()
  await h.answer([complete, old])
  assert.equal(h.settled.length, 1)
  h.dispose()
})

test('组件卸载后丢弃迟到响应', async () => {
  const h = harness({ running: false })
  h.dispose()
  await h.answer([complete, old])
  assert.equal(h.settled.length, 0)
})

test('最终结果发布后，迟到的初次请求不能覆盖新记录', async () => {
  const h = harness({ running: false })
  assert.equal(h.requests.length, 2)
  const initial = h.requests.shift()
  await h.answer([complete, old])
  assert.deepEqual(ids(h), ['new', 'old'])
  initial([old])
  await h.flush()
  assert.deepEqual(ids(h), ['new', 'old'])
  h.dispose()
})

test('历史记录正常读取，无待执行任务时不订阅或轮询', async () => {
  const h = harness({ awaiting: false })
  await h.answer([complete, old])
  assert.deepEqual(ids(h), ['new', 'old'])
  assert.equal(h.listeners.size, 0)
  assert.equal(h.timers.size, 0)
  h.dispose()
})

test('中断标记只取本次执行，不受历史中断记录影响', async () => {
  const h = harness({ running: false })
  await h.answer([complete, { ...old, status: 'interrupted' }])
  assert.equal(h.settled.length, 1)
  assert.equal(h.settled[0][2], false)
  h.dispose()
})
