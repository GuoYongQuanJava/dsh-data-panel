import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'

test('千条用例初次打开只请求一次摘要，切会话取消旧请求', async () => {
  let descriptor, slot = 0
  const states = [], effects = [], requests = []
  const records = Array.from({ length: 1000 }, (_, i) => ({ id: `r${i}`, caseId: `TC-${i}`, title: `case ${i}` }))
  const React = {
    createElement: (type, props, ...children) => ({ type, props, children }),
    useState(initial) {
      const id = slot++
      if (!(id in states)) states[id] = typeof initial === 'function' ? initial() : initial
      return [states[id], value => { states[id] = typeof value === 'function' ? value(states[id]) : value }]
    },
    useRef(value) { const id = slot++; return states[id] ||= { current: value } },
    useMemo: fn => fn(),
    useSyncExternalStore: () => ({ status: 'ready', records, categories: [], demoCount: 0, error: '' }),
    useEffect(fn, deps) {
      const id = slot++, old = effects[id]
      if (!old || deps.some((value, i) => value !== old.deps[i])) {
        old?.cleanup?.()
        effects[id] = { fn, deps, dirty: true }
      }
    },
  }
  vm.runInNewContext(readFileSync(new URL('../lib/client.js', import.meta.url), 'utf8'), {
    window: { __ModuleLoader__: { load: value => { descriptor = value } },
      addEventListener() {}, removeEventListener() {} },
    URLSearchParams, AbortController, clearTimeout, console,
    setTimeout(fn, delay) { const timer = setTimeout(fn, delay); timer.unref(); return timer },
    document: { body: {}, addEventListener() {}, removeEventListener() {}, getElementById: () => null,
      createElement: () => ({ style: {} }), head: { appendChild() {} } },
    fetch(url, init) {
      if (!url.startsWith('/data-panel/run/summary?')) {
        return Promise.resolve({ ok: true, json: async () => ({ ok: true, records }) })
      }
      return new Promise((resolve, reject) => {
        const request = { url, resolve, signal: init.signal }
        requests.push(request)
        init.signal?.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })), { once: true })
      })
    },
  })
  const api = descriptor.factory(name => name === 'react' ? React : {}).__test
  let sessionId = 'session-a'
  api.store.setSessionId(() => sessionId)
  function render() {
    slot = 0
    api.DataPanelView({ sessionId })
    effects.forEach(effect => {
      if (effect.dirty) { effect.dirty = false; effect.cleanup = effect.fn() }
    })
  }
  render()
  assert.equal(requests.length, 1)
  assert.match(requests[0].url, /session-a/)
  sessionId = 'session-b'
  render()
  assert.equal(requests.length, 2)
  assert.equal(requests[0].signal.aborted, true)
  assert.match(requests[1].url, /session-b/)
  requests[1].resolve({ ok: true, json: async () => ({ ok: true, byCase: { 'TC-0': { count: 2, latestOutcome: 'passed' } } }) })
  await new Promise(setImmediate)
  effects.forEach(effect => effect.cleanup?.())
})
