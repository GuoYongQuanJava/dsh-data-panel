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
    useSyncExternalStore: (subscribe, getSnapshot) => services.liveStore ? getSnapshot() : ({ status: 'ready', records: Array.isArray(record) ? record : [record], categories: [], demoCount: 0, error: '' }),
  }
  vm.runInNewContext(readFileSync(process.env.DSH_PANEL_CLIENT_PATH || new URL('../lib/client.js', import.meta.url), 'utf8'), {
    window: { __ModuleLoader__: { load: value => { descriptor = value } } },
    URLSearchParams, console,
    fetch: services.fetch || (async url => ({ ok: true, json: async () => url.startsWith('/data-panel/run/prepare')
      ? { ok: true, runId: 'new-run', command: 'test-command', framework: 'pytest' }
      : { ok: true, runs: [] } })),
  })
  const api = descriptor.factory(name => name === 'react' ? React : {}).__test
  api.setCodeServices(services)
  return { api, component(Component, props) { index = 0; return Component(props) }, render(props) { index = 0; return api.DataPanelView(props) } }
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

test('点击执行后展开记录并等待，点击表头刷新保持展开并通知重新读取', async () => {
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
  assert.equal(hint, undefined, '不再显示“正在执行…”提示，等待状态仍由执行记录维护')
  nodes(h.render(props)).find(node => node.children?.includes('刷新')).props.onClick()
  const finished = nodes(h.render(props)).find(node => node.type === h.api.RunRecords)
  assert.equal(finished.props.awaiting, false)
  assert.ok(finished.props.refreshTick > run.props.refreshTick)
  assert.equal(finished.props.pendingRunId, '')
})


test('用例按被测函数分组：无「未关联函数」行，点函数行即筛选', () => {
  const records = [
    { ...record, id: 'a', subjectFunction: 'src/a.js::discount', category: '正常' },
    { ...record, id: 'b', subjectFunction: 'src/a.js::discount', category: '边界' },
    { ...record, id: 'c', subjectFunction: 'src/b.js::discount' },
    { ...record, id: 'd', category: '旧分类', testFunc: 'test_discount' },
  ]
  const h = harness(records), props = { sessionId: 'session-a' }
  let tree = h.render(props)
  let sidebar = nodes(tree).find(n => n.type === h.api.CategorySidebar)
  // 数据源仍然带「未关联函数」，但左栏不渲染它。
  assert.deepEqual(Array.from(sidebar.props.rows, r => [r.label, r.count]), [['全部用例',4],['边界',1],['旧分类',1],['正常',1],['src/a.js::discount',2],['src/b.js::discount',1]])
  const all = nodes(h.component(h.api.CategorySidebar, sidebar.props))
  assert.equal(all.some(n => n.children?.includes('未关联函数')), false, '不应出现未关联函数行')
  assert.ok(all.some(n => n.children?.includes('全部用例')))
  assert.ok(all.some(n => n.children?.includes('src/a.js::discount')))
  // 点函数行 = 只看该函数的用例。
  sidebar.props.onSelect('src/a.js::discount')
  tree = h.render(props)
  assert.equal(nodes(tree).filter(n => n.props?.label === '执行').length, 2)
  assert.equal(nodes(tree).filter(n => n.props?.label === '删除').length, 2)
  // 清回全部。
  sidebar = nodes(tree).find(n => n.type === h.api.CategorySidebar)
  sidebar.props.onSelect('')
  assert.equal(nodes(h.render(props)).filter(n => n.props?.label === '执行').length, 4)
})

test('测试类型多选：新增和详情编辑都能勾选/取消，提交带全部选中项', () => {
  for (const editor of ['RecordFormModal', 'DetailEditor']) {
    const h = harness(record), saved = []
    const props = { mode: 'edit', record: { ...record, testTypes: ['functional', 'api'] }, onSubmit: value => saved.push(value), onSave: value => saved.push(value) }
    const render = () => h.component(h.api[editor], props)
    const checksNode = () => nodes(render()).find(n => n.type === h.api.TestTypeChecks)
    const boxes = () => nodes(h.component(h.api.TestTypeChecks, checksNode().props)).filter(n => n.type === 'input' && n.props?.type === 'checkbox')
    let list = boxes()
    assert.equal(list.length, 5, '五类测试类型都铺开成复选框')
    assert.deepEqual(list.filter(n => n.props.checked).map(n => n.props.value), ['functional', 'api'])
    assert.equal(nodes(render()).some(n => JSON.stringify(n.children || []).includes('附加测试类型')), false)
    assert.equal(nodes(render()).some(n => n.type === 'select' && n.props?.className === 'dp-select' && JSON.stringify(n.children).includes('功能测试')), false, '不再有测试类型下拉')
    // 取消 functional
    list.find(n => n.props.value === 'functional').props.onChange()
    list = boxes()
    assert.deepEqual(list.filter(n => n.props.checked).map(n => n.props.value), ['api'])
    // 再勾上 logic
    list.find(n => n.props.value === 'logic').props.onChange()
    nodes(render()).find(n => n.type === 'form').props.onSubmit({ preventDefault() {} })
    assert.deepEqual(Array.from(saved[saved.length - 1].testTypes), ['api', 'logic'])
    assert.equal(saved[saved.length - 1].testType, 'api', '主类型取第一个选中项')
  }
})

test('双类型筛选包含附加类型，同一用例仍只有一个执行入口', () => {
  const h = harness([{ ...record, testTypes: ['functional', 'api'] }, { ...record, id: 'r2', caseId: 'TC-2', testType: 'logic' }])
  const props = { sessionId: 'session-a' }
  const tree = h.render(props)
  const tabs = nodes(tree).find(n => n.props?.onChange && n.props?.value === 'all')
  assert.ok(tabs)
  tabs.props.onChange({ target: { value: 'api' } })
  const filtered = h.render(props)
  assert.equal(nodes(filtered).filter(n => n.props?.label === '执行').length, 1)
})

test('原始日志与模型异常分析明确区分，缺分析时不改变原文', () => {
  const h = harness(record)
  assert.equal(h.api.displayRunLog({ exists: true, content: 'raw\n' }), 'raw\n')
  assert.equal(h.api.displayRunLog({ exists: false }), '')
  const text = h.api.displayRunLog({ exists: true, content: 'raw\n', analysis: 'cause' })
  assert.ok(text.startsWith('raw\n'))
  assert.ok(text.includes('非执行器原始输出'))
  assert.ok(text.endsWith('cause'))
})

test('执行摘要在用例标识变化时刷新，最后一条记录删除后清空旧状态', () => {
  const h = harness(record)
  const firstKey = h.api.runSummaryKey([{ id: 'rec1', caseId: 'TC-1' }])
  const renamedKey = h.api.runSummaryKey([{ id: 'rec1', caseId: 'TC-2' }])
  assert.notEqual(firstKey, renamedKey)
  assert.equal(JSON.stringify(h.api.updateCaseStatus({ rec1: 'passed' }, 'rec1', 'failed')), '{"rec1":"failed"}')
  assert.equal(JSON.stringify(h.api.updateCaseStatus({ rec1: 'passed' }, 'rec1', '')), '{}')
})

test('详情显示被测函数，旧数据明确未关联', () => {
  const h = harness(record)
  assert.ok(nodes(h.api.DetailView({ record: { ...record, subjectFunction: 'Order.discount' } })).some(n => n.children?.includes('Order.discount')))
  assert.ok(nodes(h.api.DetailView({ record })).some(n => n.children?.includes('未关联函数')))
})


test('新增和详情编辑都能修改被测函数并提交，支持清空', () => {
  for (const editor of ['RecordFormModal', 'DetailEditor']) {
    const h = harness(record), saved = []
    const props = { mode: 'edit', record: { ...record, subjectFunction: 'old' }, onSubmit: value => saved.push(value), onSave: value => saved.push(value) }
    const render = () => h.component(h.api[editor], props)
    nodes(render()).find(n => n.type === h.api.FunctionField).props.onChange('Order.discount')
    nodes(render()).find(n => n.type === 'form').props.onSubmit({ preventDefault() {} })
    assert.equal(saved[0].subjectFunction, 'Order.discount')
    nodes(render()).find(n => n.type === h.api.FunctionField).props.onChange('')
    nodes(render()).find(n => n.type === 'form').props.onSubmit({ preventDefault() {} })
    assert.equal(saved[1].subjectFunction, '')
  }
})

test('勾选用例后打开批量关联，提交到当前会话，取消选择后仍可渲染', async () => {
  const sent = []
  const h = harness(record, { fetch: async (url, init) => {
    const body = JSON.parse(init.body); sent.push(body)
    return { ok: true, json: async () => ({ ok: true, subjectFunction: body.subjectFunction }) }
  } })
  const props = { sessionId: 'session-a' }
  nodes(h.render(props)).find(n => n.type === 'input' && n.props?.type === 'checkbox' && !n.props['aria-label']?.includes('全选')).props.onChange({ target: { checked: true } })
  nodes(h.render(props)).find(n => n.children?.includes('关联被测函数')).props.onClick()
  const prompt = nodes(h.render(props)).find(n => n.type === h.api.CategoryPrompt)
  assert.equal(prompt.props.title, '关联被测函数')
  prompt.props.onSubmit('Order.discount')
  await new Promise(setImmediate)
  assert.equal(sent[0].op, 'assignFunction')
  assert.equal(sent[0].sessionId, 'session-a')
  assert.deepEqual(Array.from(sent[0].ids), ['rec1'])
  assert.equal(sent[0].subjectFunction, 'Order.discount')
  assert.equal(nodes(h.render(props)).some(n => n.props?.className === 'dp-pick-bar'), false)
})

test('函数关联弹窗允许清空，侧栏保留分页且层级入口可用', () => {
  const h = harness(record), results = []
  const promptProps = { initialValue: 'Order.discount', onSubmit: x => results.push(x) }
  let tree = h.component(h.api.CategoryPrompt, promptProps)
  nodes(tree).find(n => n.type === h.api.FunctionField).props.onChange('')
  tree = h.component(h.api.CategoryPrompt, promptProps)
  tree.props.footer.find(n => n.props.key === 'ok').props.onClick()
  assert.deepEqual(results, [''])
  const side = harness(record)
  const fnRows = [{ key: '__all__', value: '', label: '全部用例', count: 24 },
    ...Array.from({ length: 12 }, (_, i) => ({ key: 'function:F' + i, value: 'F' + i, label: 'F' + i, count: 2 }))]
  const props = { rows: fnRows, activeCategory: '', boardHeight: 160, onSelect() {} }
  let sidebar = side.component(side.api.CategorySidebar, props)
  // 首行是分组标题（全部用例），下面才是可点的函数行。
  assert.ok(nodes(sidebar).some(n => n.children?.includes('全部用例')), '首行要是全部用例')
  assert.ok(nodes(sidebar).some(n => n.children?.includes('F0')))
  // 已取消分页：所有行一次渲染完（靠滚动查看）
  assert.equal(nodes(sidebar).some(n => n.props?.title === '下一页层级'), false)
  assert.ok(nodes(sidebar).some(n => n.children?.includes('F3')))
  assert.ok(nodes(sidebar).some(n => n.children?.includes('F11')))
})

test('左栏按被测函数分组：无切换标题、无未关联函数、保留新建层级按钮', () => {
  const h = harness(record)
  const fnRows = [{ key: '__all__', value: '', label: '全部用例', count: 3 },
    { key: '__unassigned__', value: null, label: '未关联函数', count: 1 },
    { key: 'function:A', value: 'A', label: 'A', count: 2 }]
  const calls = []
  const props = {
    rows: fnRows,
    axis: 'function',
    activeCategory: '',
    boardHeight: 400,
    onSelect(v) { calls.push(['select', v]) },
    onAxisChange(v) { calls.push(['axis', v]) },
    onCreate() { calls.push(['create']) },
    onRename(v) { calls.push(['rename', v]) },
    onDelete(v) { calls.push(['delete', v]) }
  }

  const all = nodes(h.component(h.api.CategorySidebar, props))

  // 两个可点标题都没了。
  assert.equal(all.some(n => n.props?.['data-it'] === 'cat-section-layer'), false)
  assert.equal(all.some(n => n.props?.['data-it'] === 'cat-section-function'), false)
  // 未关联函数行不渲染。
  assert.equal(all.some(n => n.children?.includes('未关联函数')), false)
  // 首行是「全部用例」，函数行可点。
  assert.ok(all.some(n => n.children?.includes('全部用例')), '首行要是全部用例')
  assert.ok(all.some(n => n.children?.includes('A')))
  // 函数行没有改名/删除；「+ 新建层级」按钮保留。
  assert.equal(all.some(n => String(n.props?.['data-it'] || '').startsWith('cat-rename-')), false)
  assert.equal(all.some(n => String(n.props?.['data-it'] || '').startsWith('cat-delete-')), false)
  assert.ok(all.some(n => n.props?.['data-it'] === 'cat-create'), '应保留新建层级按钮')
  // 点函数行只回传 select。
  all.find(n => n.props?.['title'] === 'A').props.onClick()
  all.find(n => n.props?.['data-it'] === 'cat-create').props.onClick()
  assert.deepEqual(calls, [['select', 'A'], ['create']])
})

test('层级弹窗与函数弹窗分流：层级走纯文本并禁用内置名', () => {
  const h = harness(record), out = []
  const layerProps = { mode: 'layer', title: '新建层级', initialValue: '', onSubmit: x => out.push(x) }
  // 弹窗底部的「确定」在 props.footer 里，不在 children 里。
  const okBtn = tree => tree.props.footer.find(n => n.props['data-it'] === 'layer-name-ok')
  const input = tree => nodes(tree).find(n => n.props?.['data-it'] === 'layer-name-input')

  let tree = h.component(h.api.CategoryPrompt, layerProps)
  // 层级模式下不该出现被测函数的 datalist 输入
  assert.equal(nodes(tree).some(n => n.type === h.api.FunctionField), false, '层级弹窗不应复用被测函数输入')
  assert.ok(input(tree), '层级弹窗要有独立输入框')

  // 空名不应提交
  okBtn(tree).props.onClick()
  assert.deepEqual(out, [])

  // 内置名「默认」也不应提交
  input(tree).props.onChange({ target: { value: '默认' } })
  tree = h.component(h.api.CategoryPrompt, layerProps)
  okBtn(tree).props.onClick()
  assert.deepEqual(out, [])

  // 正常名字可以提交
  input(tree).props.onChange({ target: { value: '订单模块' } })
  tree = h.component(h.api.CategoryPrompt, layerProps)
  okBtn(tree).props.onClick()
  assert.deepEqual(out, ['订单模块'])
})

test('批量关联和解除后立即更新真实 store 的层级计数，迟到响应不串会话', async () => {
  let sessionId = 'session-a', resolvePost
  const h = harness(record, { liveStore: true, fetch: async (url, init) => {
    if (!init?.body) return { ok: true, json: async () => ({ ok: true, records: [{ ...record, id: sessionId }] }) }
    const body = JSON.parse(init.body)
    return new Promise(resolve => { resolvePost = () => resolve({ ok: true, json: async () => ({ ok: true, subjectFunction: body.subjectFunction }) }) })
  } })
  h.api.store.setSessionId(() => sessionId)
  await h.api.store.load()
  let pending = h.api.store.assignFunction(['session-a'], 'Order.discount', sessionId)
  resolvePost(); await pending
  const rows = () => nodes(h.render({ sessionId })).find(n => n.type === h.api.CategorySidebar).props.rows
  assert.equal(rows().length, 2)
  assert.equal(rows()[1].label, 'Order.discount')
  assert.equal(rows()[1].count, 1)
  pending = h.api.store.assignFunction(['session-a'], '', sessionId)
  resolvePost(); await pending
  assert.equal(rows().length, 1)
  assert.equal(rows()[0].count, 1)
  pending = h.api.store.assignFunction(['session-a'], 'late-function', sessionId)
  sessionId = 'session-b'; await h.api.store.load()
  resolvePost(); await pending
  assert.equal(h.api.store.getSnapshot().records[0].id, 'session-b')
  assert.equal(rows().length, 1)
})
