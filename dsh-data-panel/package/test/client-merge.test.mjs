import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'

function harness(record, services = {}) {
  let descriptor
  let index = 0
  const states = []
  const React = {
    createElement: (type, props, ...children) => ({ type, props, children }),
    useState(initial) {
      const slot = index++
      if (!(slot in states)) states[slot] = typeof initial === 'function' ? initial() : initial
      return [states[slot], value => { states[slot] = typeof value === 'function' ? value(states[slot]) : value }]
    },
    useRef: current => ({ current }),
    useMemo: fn => fn(),
    useEffect() {},
    useSyncExternalStore: () => ({ status: 'ready', records: [record], categories: [], demoCount: 0, error: '' }),
  }
  vm.runInNewContext(readFileSync(process.env.DSH_PANEL_CLIENT_PATH || new URL('../lib/client.js', import.meta.url), 'utf8'), {
    window: { __ModuleLoader__: { load: value => { descriptor = value } } },
    URLSearchParams, console,
    fetch: async url => ({ ok: true, json: async () => url.startsWith('/data-panel/run/prepare')
      ? { ok: true, runId: 'new-run', command: 'test-command', framework: 'pytest' }
      : { ok: true, runs: [] } }),
  })
  const api = descriptor.factory(name => name === 'react' ? React : {}).__test
  api.setCodeServices(services)
  return { api, render(props) { index = 0; return api.DataPanelView(props) } }
}

function nodes(tree) {
  if (!tree || typeof tree !== 'object') return []
  if (Array.isArray(tree)) return tree.flatMap(nodes)
  return [tree, ...nodes(tree.children)]
}

const record = { id: 'rec1', caseId: 'TC-1', title: '保留双方的代码查看能力', testType: 'functional', codeRef: 'src/main.js:12', code: 'test example' }

test('操作列只保留一个测试代码入口，不恢复旧源码准星图标', () => {
  const h = harness(record)
  const calls = []
  const tree = h.render({ sessionId: 'session-a', openTestCode: (...args) => calls.push(['test', ...args]), openCode: (...args) => calls.push(['source', ...args]) })
  const actions = nodes(tree).filter(node => node.props?.label)
  actions.find(node => node.props.label === '查看测试代码').props.onClick()
  assert.equal(actions.filter(node => node.props.label === '查看测试代码').length, 1)
  assert.equal(actions.some(node => node.props.name === 'location'), false)
  assert.deepEqual(calls, [['test', 'TC-1', 'session-a']])
  assert.ok(actions.some(node => node.props.label === '执行'))
  assert.ok(actions.some(node => node.props.label === '编辑'))
  assert.ok(actions.some(node => node.props.label === '删除'))
})

test('没有旧源码位置时仍按测试用例定位测试文件', () => {
  const plain = { ...record, codeRef: '' }
  const h = harness(plain)
  const calls = []
  const props = { sessionId: 'session-a', openTestCode: (...args) => calls.push(args) }
  nodes(h.render(props)).find(node => node.props?.label === '查看测试代码').props.onClick()
  assert.deepEqual(calls, [['TC-1', 'session-a']])
})

test('右侧详情使用测试文件定位入口，不恢复旧源码入口', () => {
  const h = harness(record)
  const calls = []
  const tree = h.api.DetailView({ record, onOpenCode: () => calls.push('test'), onOpenSource: () => calls.push('source') })
  nodes(tree).find(node => node.children?.includes('查看测试代码')).props.onClick()
  assert.equal(nodes(tree).some(node => node.children?.includes('查看源码')), false)
  assert.deepEqual(calls, ['test'])
})

test('点击展开和收起执行记录均可重新渲染，不因已移除的计时变量白屏', () => {
  const h = harness(record)
  const props = { sessionId: 'session-a' }
  nodes(h.render(props)).find(node => node.props?.className === 'dp-expand-btn').props.onClick()
  const expanded = h.render(props)
  assert.ok(nodes(expanded).some(node => node.type === h.api.RunRecords))
  nodes(expanded).find(node => node.props?.className === 'dp-expand-btn').props.onClick()
  assert.equal(nodes(h.render(props)).some(node => node.type === h.api.RunRecords), false)
})

test('点击执行后可展开记录，等待提示仅显示正在执行，结束后记录耗时', async () => {
  const drafts = []
  const h = harness(record, {
    sessions: {
      list: { getSnapshot: () => ({ byId: { 'session-a': { cwd: 'F:/project' } } }) },
      binding: () => ({}),
    },
    conversation: { input: { requestDraftInitialization: (binding, { prompt }) => { drafts.push(prompt); return 'applied' } } },
  })
  const props = { sessionId: 'session-a' }
  nodes(h.render(props)).find(node => node.props?.label === '执行').props.onClick()
  await new Promise(setImmediate)
  const run = nodes(h.render(props)).find(node => node.type === h.api.RunRecords)
  assert.ok(run)
  assert.equal(run.props.awaiting, true)
  assert.equal(run.props.pendingRunId, 'new-run')
  assert.equal(drafts.length, 1)
  const waiting = h.api.RunRecords(run.props)
  const hint = nodes(waiting).find(node => node.props?.className === 'dp-run-wait')
  assert.deepEqual(nodes(hint).flatMap(node => node.children || []).filter(value => typeof value === 'string'), ['正在执行…'])
  run.props.onSettled('new-run', 12000, false)
  const finished = nodes(h.render(props)).find(node => node.type === h.api.RunRecords)
  assert.equal(finished.props.awaiting, false)
  assert.equal(finished.props.roundCost['new-run'], 12000)
})
