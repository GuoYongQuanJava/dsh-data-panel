import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'

function harness() {
  let descriptor, index = 0
  const states = [], requests = []
  const React = {
    createElement: (type, props, ...children) => ({ type, props: props || {}, children }),
    useState(initial) {
      const slot = index++
      if (!(slot in states)) states[slot] = typeof initial === 'function' ? initial() : initial
      return [states[slot], value => { states[slot] = typeof value === 'function' ? value(states[slot]) : value }]
    },
    useRef: current => ({ current }), useMemo: fn => fn(), useEffect() {},
  }
  vm.runInNewContext(readFileSync(process.env.DSH_PANEL_CLIENT_PATH || new URL('../lib/client.js', import.meta.url), 'utf8'), {
    window: { __ModuleLoader__: { load: value => { descriptor = value } } },
    URLSearchParams, console, fetch: (...args) => { requests.push(args); throw new Error('集成演示不得请求后端') },
  })
  const api = descriptor.factory(name => name === 'react' ? React : {}).__test
  return { api, requests, render(Component, props = {}) { index = 0; return Component(props) } }
}
function nodes(tree) {
  if (!tree || typeof tree !== 'object') return []
  if (Array.isArray(tree)) return tree.flatMap(nodes)
  // 弹窗的按钮在 props.footer / props.header 里，不在 children 里，这里一并递归。
  const extra = []
  for (const key of ['footer', 'header', 'title']) {
    const value = tree.props ? tree.props[key] : undefined
    if (Array.isArray(value)) extra.push(...value.flatMap(nodes))
    else if (value && typeof value === 'object') extra.push(...nodes(value))
  }
  return [tree, ...nodes(tree.children), ...extra]
}
const find = (tree, key) => nodes(tree).find(n => n.props['data-it'] === key)
const rowIds = tree => nodes(tree).filter(n => n.props['data-case-row']).map(n => n.props['data-case-row'])

test('同一壳切换测试页面，保留单元组件及其原始 props，按会话隔离', () => {
  const h = harness(), props = { sessionId: 'a', dock: true, openDetail() {} }
  assert.equal(typeof h.api.TestPanelHost, 'function')
  let tree = h.render(h.api.TestPanelHost, props)
  let unit = nodes(tree).find(n => n.type === h.api.DataPanelView)
  assert.equal(unit.props.openDetail, props.openDetail)
  unit.props.onModeChange('integration')
  tree = h.render(h.api.TestPanelHost, props)
  assert.ok(nodes(tree).find(n => n.type === h.api.DataPanelView))
  const integration = nodes(tree).find(n => n.type === h.api.IntegrationPanel)
  assert.equal(integration.props.sessionId, 'a')
  integration.props.onModeChange('unit')
  tree = h.render(h.api.TestPanelHost, props)
  assert.equal(nodes(tree).find(n => n.type === h.api.IntegrationPanel).props.active, false)
  assert.notEqual(nodes(h.render(h.api.TestPanelHost, { ...props, sessionId: 'b' })).find(n => n.type === h.api.IntegrationPanel).props.key, integration.props.key)
})

test('集成三个子页、搜索、场景过滤、版本切换不调用单元后端', () => {
  const h = harness(), render = () => h.render(h.api.IntegrationPanel, { sessionId: 'a' })
  assert.equal(typeof h.api.IntegrationPanel, 'function')
  let tree = render()
  assert.ok(rowIds(tree).length >= 5)
  find(tree, 'search').props.onChange({ target: { value: '登录' } })
  tree = render()
  assert.ok(rowIds(tree).length > 0 && rowIds(tree).length < 5)
  find(tree, 'search').props.onChange({ target: { value: '' } })
  find(render(), 'tab-steps').props.onClick()
  assert.ok(find(render(), 'steps-table'))
  find(render(), 'tab-reports').props.onClick()
  assert.ok(find(render(), 'reports-table'))
  find(render(), 'version-V0.0.2').props.onClick()
  assert.ok(rowIds(render()).length < 5)
  assert.equal(h.requests.length, 0)
})

test('新增编辑删除演示用例、步骤修改在三个子页同步，版本独立', () => {
  const h = harness(), render = () => h.render(h.api.IntegrationPanel, { sessionId: 'a' })
  find(render(), 'add-case').props.onClick()
  let detail = nodes(render()).find(n => n.type === h.api.IntegrationCaseEditor)
  detail.props.onSave({ ...detail.props.record, title: '跨服务新流程', scenario: '自定义流程', steps: [{ action: '调用服务', operation: '提交输入', expected: '成功' }] })
  find(render(), 'search').props.onChange({ target: { value: '跨服务新流程' } })
  let tree = render(), id = rowIds(tree)[0]
  assert.ok(id)
  // 用例名称不再可点，编辑走操作列的图标按钮
  find(tree, 'edit-btn-' + id).props.onClick()
  detail = nodes(render()).find(n => n.type === h.api.IntegrationCaseEditor)
  detail.props.onSave({ ...detail.props.record, title: '跨服务新流程已编辑' })
  assert.ok(nodes(render()).some(n => n.children.includes('跨服务新流程已编辑')))
  find(render(), 'version-V0.0.2').props.onClick()
  assert.equal(rowIds(render()).includes(id), false)
  find(render(), 'version-V0.0.1').props.onClick()
  find(render(), 'search').props.onChange({ target: { value: '跨服务新流程' } })
  find(render(), 'delete-' + id).props.onClick()
  find(render(), 'confirm-delete').props.onClick()
  assert.equal(rowIds(render()).includes(id), false)
  assert.equal(h.requests.length, 0)
})

test('步骤编辑支持增加、排序、删除和保存，不更改传入数据', () => {
  const h = harness(), saved = []
  const record = { id: 'a', title: '流程', steps: [{ action: 'a', operation: '第一步', expected: 'ok' }, { action: 'b', operation: '第二步', expected: 'ok' }] }
  const props = { record, onSave: r => saved.push(r), onClose() {} }
  const render = () => h.render(h.api.IntegrationStepsEditor, props)
  find(render(), 'step-down-0').props.onClick()
  assert.equal(find(render(), 'step-operation-0').props.value, '第二步')
  find(render(), 'add-step').props.onClick()
  find(render(), 'step-operation-2').props.onChange({ target: { value: '新增操作' } })
  find(render(), 'step-delete-1').props.onClick()
  find(render(), 'save-steps').props.onClick()
  assert.equal(saved[0].steps.length, 2)
  assert.equal(saved[0].steps[1].operation, '新增操作')
  assert.equal(record.steps[0].operation, '第一步')
})

test('总体报告排除和恢复只作用于纳入选择，真实条目保留', () => {
  const h = harness(), records = [{ id: 'a', title: 'A', scenario: '登录', status: 'pass', reports: [{}] }, { id: 'b', title: 'B', scenario: '订单', status: 'fail', reports: [{}] }]
  const render = () => h.render(h.api.IntegrationOverview, { records, onClose() {}, onNotice() {} })
  assert.equal(typeof h.api.IntegrationOverview, 'function')
  find(render(), 'exclude-a').props.onClick()
  assert.equal(find(render(), 'overview-a'), undefined)
  assert.ok(find(render(), 'overview-b'))
  find(render(), 'restore-all').props.onClick()
  assert.ok(find(render(), 'overview-a'))
  assert.equal(records.length, 2)
})

test('用例表只读与改：名称不可点、无执行入口与行展开，编辑走操作列图标', () => {
  const h = harness(), render = () => h.render(h.api.IntegrationPanel, { sessionId: 'a' })
  const id = rowIds(render())[0]

  // 用例名称只是内容，不能点出弹窗；入口统一收进操作列
  assert.equal(find(render(), 'edit-' + id), undefined, '点击用例名称不应再触发编辑')
  assert.equal(find(render(), 'run-' + id), undefined, '不应再有执行按钮')
  assert.equal(find(render(), 'expand-' + id), undefined, '用例表不应再有行展开')

  // 操作列只留编辑和删除
  assert.ok(find(render(), 'edit-btn-' + id), '操作列要有编辑')
  assert.ok(find(render(), 'delete-' + id), '操作列要有删除')

  // 编辑仍然走弹窗
  find(render(), 'edit-btn-' + id).props.onClick()
  assert.ok(nodes(render()).some(n => n.type === h.api.IntegrationCaseEditor), '点编辑图标应打开弹窗')

  find(render(), 'refresh').props.onClick()
  assert.ok(find(render(), 'notice'), '刷新只给演示提示')
  assert.equal(h.requests.length, 0)
})

test('步骤表：序号格箭头展开执行结果子表，操作列是查看和编辑', () => {
  const h = harness(), render = () => h.render(h.api.IntegrationPanel, { sessionId: 'a' })
  find(render(), 'tab-steps').props.onClick()
  const id = rowIds(render())[0]

  // 用例名称不可点，入口只有序号后的箭头
  assert.equal(find(render(), 'edit-' + id), undefined, '步骤表名称不应触发编辑')
  const toggle = find(render(), 'expand-' + id)
  assert.ok(toggle, '序号后要有下拉箭头')
  assert.equal(toggle.props['aria-expanded'], false)

  // 展开后有执行结果子表，含用例标识与三个操作图标
  toggle.props.onClick()
  const sub = find(render(), 'step-runs-' + id)
  assert.ok(sub, '展开后要有执行结果子表')
  assert.ok(find(render(), 'view-' + id), '操作列要有查看')
  assert.ok(find(render(), 'edit-btn-' + id), '操作列要有编辑')

  // 再点一次收起
  find(render(), 'expand-' + id).props.onClick()
  assert.equal(find(render(), 'step-runs-' + id), undefined, '再点箭头应收起')
  assert.equal(h.requests.length, 0)
})

test('用例页有「生成测试步骤」，步骤页有「执行」，都只给演示提示', () => {
  const h = harness(), render = () => h.render(h.api.IntegrationPanel, { sessionId: 'a' })

  // 用例页：生成测试步骤 + 新增用例，不该出现执行
  const casesTree = render()
  const generate = find(casesTree, 'generate-steps')
  assert.ok(generate, '用例页要有「生成测试步骤」')
  assert.equal(generate.children.join(''), '生成测试步骤')
  assert.ok(find(casesTree, 'add-case'), '用例页仍要有新增用例')
  assert.equal(find(casesTree, 'run-steps'), undefined, '用例页不应出现「执行」')

  // 步骤页：执行，不再有生成测试步骤
  find(render(), 'tab-steps').props.onClick()
  const stepsTree = render()
  const run = find(stepsTree, 'run-steps')
  assert.ok(run, '步骤页要有「执行」')
  assert.equal(run.children.join(''), '执行')
  assert.equal(find(stepsTree, 'generate-steps'), undefined, '步骤页不应出现「生成测试步骤」')

  // 只加了按钮，没接逻辑：点下去给演示提示，且不发请求
  run.props.onClick()
  assert.ok(find(render(), 'notice'), '点执行应给出未接入提示')
  assert.equal(h.requests.length, 0)
})
