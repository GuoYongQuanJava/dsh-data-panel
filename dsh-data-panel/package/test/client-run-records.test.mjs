import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'

function harness() {
  let descriptor, slot = 0
  const states = [], refs = [], effects = [], requests = [], timers = new Set(), listeners = new Set()
  const React = {
    createElement: (type, props, ...children) => ({ type, props, children }),
    useState(initial) {
      const id = slot++
      if (!(id in states)) states[id] = typeof initial === 'function' ? initial() : initial
      return [states[id], value => { states[id] = typeof value === 'function' ? value(states[id]) : value }]
    },
    useRef(current) { const id = slot++; return refs[id] ||= { current } },
    useEffect(fn, deps) {
      const id = slot++, old = effects[id]
      if (!old || deps.some((value, i) => value !== old.deps[i])) {
        old?.cleanup?.()
        effects[id] = { deps, fn, dirty: true }
      }
    },
  }
  const source = { getSnapshot: () => ({ running: true }), subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn) } }
  vm.runInNewContext(readFileSync(process.env.DSH_PANEL_CLIENT_PATH || new URL('../lib/client.js', import.meta.url), 'utf8'), {
    window: { __ModuleLoader__: { load: x => { descriptor = x } } }, URLSearchParams, console,
    fetch: () => new Promise(resolve => requests.push(runs => resolve({ ok: true, json: async () => ({ ok: true, runs }) }))),
    setInterval(fn) { timers.add(fn); return fn }, clearInterval(fn) { timers.delete(fn) },
  })
  const api = descriptor.factory(name => name === 'react' ? React : {}).__test
  api.setCodeServices({ sessions: { binding: () => ({ session: source }) } })
  let props = { record: { caseId: 'TC-1' }, sessionId: 'session-a', awaiting: true, pendingRunId: 'new', refreshTick: 0 }
  return { requests, timers, listeners,
    render(patch) {
      props = { ...props, ...patch }; slot = 0
      const tree = api.RunRecords(props)
      effects.forEach(effect => { if (effect.dirty) { effect.dirty = false; effect.cleanup = effect.fn() } })
      return tree
    },
    get runs() { return states[0].runs },
    async answer(runs) { const queued = requests.splice(0); queued.forEach(fn => fn(runs)); await new Promise(setImmediate) },
    dispose() { effects.forEach(effect => effect.cleanup?.()) },
  }
}
function nodes(tree) {
  if (!tree || typeof tree !== 'object') return []
  if (Array.isArray(tree)) return tree.flatMap(nodes)
  return [tree, ...nodes(tree.children)]
}
const old = { runId: 'old', status: 'passed', durationMs: 1234 }
const complete = { runId: 'new', status: 'passed', finishedAt: '2026-11-17T00:00:00Z', durationMs: 2500 }
const active = { ...complete, status: 'running', finishedAt: '' }
const ids = h => Array.from(h.runs, run => run.runId)

test('执行等待期间：只读一次历史，不起会话订阅，只挂一个有界自动刷新定时器', async () => {
  const h = harness(); h.render()
  assert.equal(h.requests.length, 1)
  assert.equal(h.listeners.size, 0)
  // 改造成：执行结束后自动刷新，所以等待期间会有一个（且只有一个）轮询定时器；
  // 它不是无上限轮询，也不监听对话。
  assert.equal(h.timers.size, 1)
  await h.answer([complete, old])
  // 这次 run 还没落盘（pendingRunId='new' 不在结果里）→ 旧记录照常展示。
  assert.deepEqual(ids(h), ['old'])
  h.render()
  assert.equal(h.requests.length, 0)
  h.dispose()
})

test('轮询看到这次 run 已结束就自动刷新一次并停掉定时器', async () => {
  const h = harness(); h.render()
  const [timer] = Array.from(h.timers)
  assert.ok(timer)
  await h.answer([active, old])
  assert.deepEqual(ids(h), ['old'])
  // 模拟 3 秒后轮询：这次 run 已完成。
  // 模拟 3 秒后轮询：这次 run 已经结束。
  timer()
  await h.answer([complete, old])
  // 结束后自动重读一次记录（reloadTick +1 触发上面的读取 effect）。
  h.render()
  await h.answer([complete, old])
  assert.deepEqual(ids(h), ['new', 'old'])
  // 定时器被清掉，不会持续轮询。
  assert.equal(h.timers.size, 0)
  h.dispose()
})

test('点击表头刷新后读取最终结果；同一刷新版本不重复请求', async () => {
  const h = harness(); h.render(); await h.answer([active, old])
  assert.deepEqual(ids(h), ['old'])
  h.render({ awaiting: false, refreshTick: 1 })
  assert.equal(h.requests.length, 1)
  await h.answer([complete, old])
  assert.deepEqual(ids(h), ['new', 'old'])
  const tree = h.render()
  assert.equal(h.requests.length, 0)
  assert.equal(nodes(tree).some(n => n.props?.className === 'dp-run-wait'), false)
  assert.ok(nodes(tree).some(n => n.children?.includes('2.5s')))
  h.dispose()
})

test('刷新时还在运行的记录不展示，完成后再次手动刷新可显示', async () => {
  const h = harness(); h.render({ awaiting: false })
  await h.answer([active, old])
  assert.deepEqual(ids(h), ['old'])
  h.render({ refreshTick: 1 }); await h.answer([complete, old])
  assert.deepEqual(ids(h), ['new', 'old'])
  assert.equal(h.timers.size, 0)
  h.dispose()
})

test('手动刷新使旧请求过期，迟到响应不能覆盖新结果', async () => {
  const h = harness(); h.render()
  const initial = h.requests.shift()
  h.render({ awaiting: false, refreshTick: 1 })
  await h.answer([complete, old]); initial([old]); await new Promise(setImmediate)
  assert.deepEqual(ids(h), ['new', 'old'])
  h.dispose()
})

test('组件卸载后丢弃迟到响应', async () => {
  const h = harness(); h.render(); h.dispose()
  await h.answer([complete, old])
  assert.deepEqual(ids(h), [])
})

test('普通展开读取历史记录，最多五条的布局和操作保留', async () => {
  const h = harness(); h.render({ awaiting: false })
  await h.answer([complete, old])
  const tree = h.render()
  assert.deepEqual(ids(h), ['new', 'old'])
  assert.equal(nodes(tree).filter(n => n.props?.label === '报告').length, 2)
  assert.equal(nodes(tree).filter(n => n.props?.label === '日志').length, 2)
  assert.equal(nodes(tree).filter(n => n.props?.label === '删除').length, 2)
  assert.equal(h.listeners.size, 0); assert.equal(h.timers.size, 0)
  h.dispose()
})
