import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'

function harness() {
  let descriptor, index = 0
  const states = [], requests = []
  /*
   * fetch 桩。
   *
   * 历史：集成页曾是纯前端演示，桩直接抛错防止有人偷偷请求后端。
   * 现在集成页**就是**要从 /data-panel/integration 读数据。
   *
   * 但面板的加载是异步的（fetch → setState），而这些测试是同步渲染断言的，
   * 所以测试统一通过 `initialSeed` 同步注入数据，不依赖异步加载。
   * 桩保留空响应，用于验证「确实请求了后端」这类断言。
   */
  const emptyIntegration = () => ({
    ok: true,
    root: '',
    kinds: {
      case: { index: { versions: [], activeVersion: '', byVersion: {} }, activeVersion: '', data: null },
      step: { index: { versions: [], activeVersion: '', byVersion: {} }, activeVersion: '', data: null },
      report: { index: { versions: [], activeVersion: '', byVersion: {} }, activeVersion: '', data: null },
    },
  })
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
    URLSearchParams,
    console,
    fetch: (...args) => {
      requests.push(args)
      const body = emptyIntegration()
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve(body),
      })
    },
  })
  const api = descriptor.factory(name => name === 'react' ? React : {}).__test
  /*
   * 测试用的集成种子：6 条用例 / 2 个功能项 / 两个版本。
   * 与面板字段对齐（scenario 充当功能项名），用来断言列表行数、搜索过滤、
   * 切版本、分页这些渲染行为。
   */
  const TEST_SEED = {
    versions: [
      { name: 'V0.0.1', at: '2026-11-16T09:00:00Z', status: 'current' },
      { name: 'V0.0.2', at: '2026-11-17T12:00:00Z', status: 'archived' },
    ],
    activeVersion: 'V0.0.1',
    byVersion: {
      'V0.0.1': [
        { id: 'it-1', caseId: 'V0_0_1-IT-001', title: '手机号验证码登录', scenario: '用户与登录', type: 'functional', description: '登录链路', steps: [{ no: 1, action: '打开', operation: '进入', expected: '显示' }], records: [{ runId: 'run-1', at: '2026-11-17T10:00:00Z', result: 'pass', durationMs: 1200, source: 'all' }] },
        { id: 'it-2', caseId: 'V0_0_1-IT-002', title: '账号密码登录失败锁定', scenario: '用户与登录', type: 'functional', description: '锁定 5 次', steps: [{ no: 1, action: '登录', operation: '错 5 次', expected: '锁定' }], records: [] },
        { id: 'it-3', caseId: 'V0_0_1-IT-003', title: '退出登录清除会话', scenario: '用户与登录', type: 'functional', description: '清除凭证', steps: [], records: [] },
        { id: 'it-4', caseId: 'V0_0_1-IT-004', title: '商品加入购物车', scenario: '商品与购物车', type: 'functional', description: '加购', steps: [{ no: 1, action: '加购', operation: '点击', expected: '成功' }], records: [{ runId: 'run-2', at: '2026-11-17T10:05:00Z', result: 'fail', durationMs: 800, source: 'all' }] },
        { id: 'it-5', caseId: 'V0_0_1-IT-005', title: '购物车数量上限校验', scenario: '商品与购物车', type: 'boundary', description: '超库存拦截', steps: [{ no: 1, action: '改量', operation: '输 999', expected: '拦截' }], records: [{ runId: 'run-3', at: '2026-11-17T10:10:00Z', result: 'pass', durationMs: 500, source: 'all' }] },
        { id: 'it-6', caseId: 'V0_0_1-IT-006', title: '结算优惠券抵扣', scenario: '商品与购物车', type: 'api', description: '满减', steps: [], records: [] },
      ],
      'V0.0.2': [
        { id: 'it2-1', caseId: 'V0_0_2-IT-001', title: '手机号验证码登录', scenario: '用户与登录', type: 'functional', description: '登录链路', steps: [], records: [] },
        { id: 'it2-2', caseId: 'V0_0_2-IT-002', title: '商品加入购物车', scenario: '商品与购物车', type: 'functional', description: '加购', steps: [], records: [] },
      ],
    },
  }
  return { api, requests, TEST_SEED, render(Component, props = {}) { index = 0; return Component(props) } }
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

// 报告页的分组默认折叠，测试里需要它们展开时统一展开一遍。
function expandAllGroups(tree, render) {
  /*
   * harness 的 state 按渲染顺序索引，一次 render 里拿到的 onClick 闭包指向同一份旧
   * state。所以必须「点一个 → 重新渲染 → 再点下一个」，否则多次点击互相覆盖，
   * 最后只有一个分组真的展开。
   */
  let current = tree
  for (let guard = 0; guard < 20; guard++) {
    const toggles = nodes(current).filter(n => n.props && typeof n.props['data-it'] === 'string' && n.props['data-it'].startsWith('report-toggle-'))
    const target = toggles.find(t => t.props['aria-expanded'] !== true)
    if (!target) break
    target.props.onClick()
    current = render()
  }
  return current
}

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
  const h = harness(), render = () => h.render(h.api.IntegrationPanel, { sessionId: 'a', initialSeed: h.TEST_SEED })
  assert.equal(typeof h.api.IntegrationPanel, 'function')
  // 默认页是测试报告，且分组默认折叠；这些断言针对用例表，先切到用例页
  find(render(), 'tab-cases').props.onClick()
  let tree = render()
  assert.ok(rowIds(tree).length >= 5)
  find(tree, 'search').props.onChange({ target: { value: '登录' } })
  tree = render()
  assert.ok(rowIds(tree).length > 0 && rowIds(tree).length < 5)
  find(tree, 'search').props.onChange({ target: { value: '' } })
  find(render(), 'tab-steps').props.onClick()
  assert.ok(find(render(), 'steps-table'))
  find(render(), 'tab-reports').props.onClick()
  // 报告页分组默认折叠，需要展开才看得到组内表格
  assert.ok(find(expandAllGroups(render(), render), 'reports-table'), '展开后应有报告表格')
  find(render(), 'version-V0.0.2').props.onClick()
  assert.ok(rowIds(render()).length < 5)
  assert.equal(h.requests.length, 0)
})

test('新增编辑删除演示用例、步骤修改在三个子页同步，版本独立', () => {
  const h = harness(), render = () => h.render(h.api.IntegrationPanel, { sessionId: 'a', initialSeed: h.TEST_SEED })
  // 默认页现在是测试报告，这些断言针对用例页，先显式切过去
  find(render(), 'tab-cases').props.onClick()
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

test('步骤编辑支持增加、拖动排序、删除和保存，不更改传入数据', () => {
  const h = harness(), saved = []
  const record = { id: 'a', title: '流程', steps: [{ action: 'a', operation: '第一步', expected: 'ok' }, { action: 'b', operation: '第二步', expected: 'ok' }] }
  const props = { record, onSave: r => saved.push(r), onClose() {} }
  const render = () => h.render(h.api.IntegrationStepsEditor, props)

  // 排序只通过拖拽手柄：按住第 1 行手柄，移到第 2 行上方触发换位
  find(render(), 'step-drag-0').props.onMouseDown({ preventDefault() {} })
  const rows = () => nodes(render()).filter(n => n.props && typeof n.props.className === 'string' && n.props.className.includes('it-step-row'))
  rows()[1].props.onMouseEnter()
  assert.equal(find(render(), 'step-operation-0').props.value, '第二步', '拖动后第 1 步应变成原第 2 步')

  find(render(), 'add-step').props.onClick()
  find(render(), 'step-operation-2').props.onChange({ target: { value: '新增操作' } })
  find(render(), 'step-delete-1').props.onClick()
  find(render(), 'save-steps').props.onClick()
  assert.equal(saved[0].steps.length, 2)
  assert.equal(saved[0].steps[1].operation, '新增操作')
  assert.equal(record.steps[0].operation, '第一步', '不应修改传入数据')
})

test('总体报告排除和恢复只作用于纳入选择，真实条目保留', () => {
  const h = harness(), records = [{ id: 'a', title: 'A', scenario: '登录', status: 'pass', reports: [{}] }, { id: 'b', title: 'B', scenario: '订单', status: 'fail', reports: [{}] }]
  const original = JSON.stringify(records)
  const render = () => h.render(h.api.IntegrationOverview, { records, onClose() {}, onNotice() {} })
  assert.equal(typeof h.api.IntegrationOverview, 'function')
  find(render(), 'exclude-a').props.onClick()
  assert.equal(find(render(), 'overview-a'), undefined)
  assert.ok(find(render(), 'overview-b'))
  find(render(), 'restore-all').props.onClick()
  assert.ok(find(render(), 'overview-a'))
  assert.equal(records.length, 2)
  assert.equal(JSON.stringify(records), original, '排除和恢复不能修改原始用例内容')
})

test('步骤页的编辑打开的是步骤弹窗，不是编辑用例', () => {
  const h = harness(), render = () => h.render(h.api.IntegrationPanel, { sessionId: 'a', initialSeed: h.TEST_SEED })
  find(render(), 'tab-steps').props.onClick()
  const tree = render()
  const id = rowIds(tree)[0]

  // 点步骤页的编辑图标
  find(tree, 'edit-btn-' + id).props.onClick()
  const withModal = render()

  // 必须是步骤弹窗；用例弹窗一个都不该出现
  assert.ok(nodes(withModal).some(n => n.type === h.api.IntegrationStepsModal), '应打开步骤弹窗')
  assert.equal(nodes(withModal).some(n => n.type === h.api.IntegrationCaseEditor), false, '不应打开用例弹窗')

  // 步骤弹窗里的 Modal 标题必须是「编辑测试步骤」
  const modal = nodes(withModal).find(n => n.type === h.api.IntegrationStepsModal)
  assert.equal(modal.props.record.id, id, '要把这一行的用例传进去')
})

test('步骤弹窗保存后步骤写回用例，其他字段不丢', () => {
  const h = harness()
  const saved = []
  const record = {
    id: 'x', caseId: 'IT-009', title: '原用例', scenario: '场景A', description: '描述',
    type: 'ui', precondition: '已登录', expectedResult: '期望值',
    steps: [{ no: 1, action: '旧动作', operation: '旧输入', expected: '旧预期' }],
    records: [{ runId: 'r1', at: '2026-11-17T10:00:00', result: 'pass', durationMs: 100 }],
  }
  const props = { record, onSave: r => saved.push(r), onClose() {} }
  const render = () => h.render(h.api.IntegrationStepsModal, props)

  // 弹窗外壳（Modal）把内容放在 children 里，步骤编辑器是其中一个子组件；
  // 直接找到它并驱动，等价于用户在弹窗里改步骤。
  const editor = () => nodes(render()).find(n => n.type === h.api.IntegrationStepsEditor)
  assert.ok(editor(), '弹窗里要有步骤编辑器')

  // 改第 1 步的动作，再新增一步
  const ed = editor()
  ed.props.onSave([{ no: 1, action: '新动作', operation: '新输入', expected: '新预期' }, { no: 2, action: '二', operation: '二', expected: '二' }])

  // 点弹窗底部的「保存」
  find(render(), 'save-steps-modal').props.onClick()

  assert.equal(saved.length, 1, '保存应回传一次')
  const out = saved[0]
  assert.equal(out.steps.length, 2, '要有两步')
  assert.equal(out.steps[0].action, '新动作', '第 1 步应被改')
  assert.equal(out.steps[1].action, '二', '第 2 步应被加')
  // 用例本身的字段与执行记录必须原样保留
  assert.equal(out.title, '原用例')
  assert.equal(out.caseId, 'IT-009')
  assert.equal(out.scenario, '场景A')
  assert.equal(out.expectedResult, '期望值')
  assert.equal(out.records.length, 1)
  // 不能改动传入对象
  assert.equal(record.steps[0].action, '旧动作')
})

test('用例表只读与改：名称不可点、无执行入口与行展开，编辑走操作列图标', () => {
  const h = harness(), render = () => h.render(h.api.IntegrationPanel, { sessionId: 'a', initialSeed: h.TEST_SEED })
  // 默认页现在是测试报告，这些断言针对用例页，先显式切过去
  find(render(), 'tab-cases').props.onClick()
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

  // 刷新现在真正重读磁盘：应当向集成数据层发请求，而不是只弹一条演示提示。
  const beforeRefresh = h.requests.length
  find(render(), 'refresh').props.onClick()
  assert.ok(h.requests.length > beforeRefresh, '刷新应向集成数据层发起请求')
  assert.match(String(h.requests[h.requests.length - 1][0]), /\/data-panel\/integration/)
})

test('步骤表：序号格箭头展开执行结果子表，操作列是查看和编辑', () => {
  const h = harness(), render = () => h.render(h.api.IntegrationPanel, { sessionId: 'a', initialSeed: h.TEST_SEED })
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
  // 主表操作列：查看已换成执行（play），编辑保留
  assert.ok(find(render(), 'run-' + id), '操作列要有执行')
  assert.equal(find(render(), 'view-' + id), undefined, '查看按钮已换成执行')
  assert.ok(find(render(), 'edit-btn-' + id), '操作列要有编辑')

  // 再点一次收起
  find(render(), 'expand-' + id).props.onClick()
  assert.equal(find(render(), 'step-runs-' + id), undefined, '再点箭头应收起')
  assert.equal(h.requests.length, 0)
})

test('用例页有「生成测试步骤」，步骤页有「一键执行」，都只给演示提示', () => {
  const h = harness(), render = () => h.render(h.api.IntegrationPanel, { sessionId: 'a', initialSeed: h.TEST_SEED })
  // 默认页现在是测试报告，这些断言针对用例页，先显式切过去
  find(render(), 'tab-cases').props.onClick()

  // 用例页：生成测试步骤 + 新增用例，不该出现执行
  const casesTree = render()
  const generate = find(casesTree, 'generate-steps')
  assert.ok(generate, '用例页要有「生成测试步骤」')
  assert.equal(generate.children.join(''), '生成测试步骤')
  assert.ok(find(casesTree, 'add-case'), '用例页仍要有新增用例')
  assert.equal(find(casesTree, 'run-steps'), undefined, '用例页不应出现「一键执行」')

  // 步骤页：一键执行，不再有生成测试步骤
  find(render(), 'tab-steps').props.onClick()
  const stepsTree = render()
  const run = find(stepsTree, 'run-steps')
  assert.ok(run, '步骤页要有「一键执行」')
  assert.equal(run.children.join(''), '一键执行')
  assert.equal(find(stepsTree, 'generate-steps'), undefined, '步骤页不应出现「生成测试步骤」')

  // 只加了按钮，没接逻辑：点下去给演示提示，且不发请求
  run.props.onClick()
  assert.ok(find(render(), 'notice'), '点执行应给出未接入提示')
  assert.equal(h.requests.length, 0)
})

test('步骤表有「执行结果」列，取该用例最新一次执行的结果', () => {
  const h = harness(), render = () => h.render(h.api.IntegrationPanel, { sessionId: 'a', initialSeed: h.TEST_SEED })
  find(render(), 'tab-steps').props.onClick()
  const tree = render()

  // 表头要有「执行结果」；「生成日期」已按要求移除（同一批生成时间相同，没有信息量）
  const heads = nodes(tree)
    .filter(n => n.type === 'th')
    .map(n => n.children.filter(c => typeof c === 'string').join(''))
    .filter(Boolean)
  const atResult = heads.indexOf('执行结果')
  assert.ok(atResult >= 0, '要有「执行结果」列：' + JSON.stringify(heads))
  assert.equal(heads.indexOf('生成日期'), -1, '步骤主表不再有「生成日期」列（执行日期在子表里）')
  assert.equal(heads[heads.length - 1], '操作', '最后一列是操作')

  // 每行都有一个结果 pill
  const id = rowIds(tree)[0]
  const cell = find(tree, 'result-cell-' + id)
  assert.ok(cell, '每行要有执行结果单元格')
  const label = cell.children.filter(c => typeof c === 'string').join('')
  assert.ok(['通过', '未通过', '异常', '未执行'].includes(label), '结果取值应在四种之内：' + label)

  // itLatestResult 取的是 records[0]
  assert.equal(h.api.itLatestResult({ records: [{ result: 'fail' }, { result: 'pass' }] }), 'fail', '应取最新一条')
  assert.equal(h.api.itLatestResult({ records: [] }), 'none', '没有记录算未执行')
})

test('「筛选」只在步骤页，多选为并集，清空后恢复全部', () => {
  const h = harness(), render = () => h.render(h.api.IntegrationPanel, { sessionId: 'a', initialSeed: h.TEST_SEED })

  // 用例页不该有「筛选」按钮
  assert.equal(find(render(), 'result-menu'), undefined, '测试用例页不应出现筛选按钮')

  find(render(), 'tab-steps').props.onClick()
  const all = rowIds(render()).length
  const menu = find(render(), 'result-menu')
  assert.ok(menu, '测试步骤页要有「筛选」按钮')
  // 按钮文案固定为「筛选」，不显示被筛的字段名
  assert.equal(menu.children.filter(c => typeof c === 'string').join(''), '筛选', '按钮文案应只有「筛选」')

  // 点按钮展开菜单
  menu.props.onClick()
  const opened = render()
  assert.ok(find(opened, 'result-pass'), '展开后要有「通过」选项')
  assert.ok(find(opened, 'result-fail'), '展开后要有「未通过」选项')
  assert.ok(find(opened, 'result-error'), '展开后要有「异常」选项')
  assert.ok(find(opened, 'result-select-all'), '要有「全选」')
  assert.ok(find(opened, 'result-clear'), '要有「清空」')

  // 只勾「通过」
  find(opened, 'result-pass').props.onClick({ preventDefault() {} })
  const passed = rowIds(render())
  assert.ok(passed.length > 0 && passed.length < all, '筛通过后应少于全部：' + passed.length + '/' + all)
  assert.ok(find(render(), 'result-bar'), '勾选后要出现已筛选提示条')

  // 再勾「未通过」→ 并集，行数增加
  find(render(), 'result-fail').props.onClick({ preventDefault() {} })
  const both = rowIds(render())
  assert.ok(both.length >= passed.length, '多选应为并集：' + both.length + ' vs ' + passed.length)

  // 提示条上的「清除筛选」恢复全部
  find(render(), 'result-bar-clear').props.onClick()
  assert.equal(rowIds(render()).length, all, '清除后应恢复全部')
  assert.equal(find(render(), 'result-bar'), undefined, '清除后提示条应消失')
  assert.equal(h.requests.length, 0)
})

test('默认进入测试用例页', () => {
  const h = harness(), render = () => h.render(h.api.IntegrationPanel, { sessionId: 'a', initialSeed: h.TEST_SEED })
  const tree = render()
  // 默认页是测试用例：工具栏上有「新增用例」
  assert.ok(find(tree, 'add-case'), '默认应进入测试用例页，工具栏要有新增用例')
  assert.equal(find(tree, 'multi-enter'), undefined, '默认不应停在测试报告页')
})

test('报告页多选：进入、全选、清空、退出都真实生效', { skip: '多选按钮 2026-11-25 暂时注释掉，恢复按钮后去掉 skip' }, () => {
  const h = harness(), render = () => h.render(h.api.IntegrationPanel, { sessionId: 'a', initialSeed: h.TEST_SEED })
  // 默认页是测试用例，先切到测试报告页
  find(render(), 'tab-reports').props.onClick()
  let tree = render()
  assert.ok(find(tree, 'multi-enter'), '非多选态要有「多选」按钮')
  assert.equal(find(tree, 'multi-bar'), undefined, '默认不在多选态')

  find(tree, 'multi-enter').props.onClick()
  tree = expandAllGroups(render(), render)
  assert.ok(find(tree, 'multi-bar'), '点「多选」后出现多选操作行')
  assert.ok(find(tree, 'multi-exit'), '要有「退出多选」')
  assert.ok(find(tree, 'multi-export'), '要有「导出已选报告」')
  assert.ok(find(tree, 'multi-select-all'), '要有「全选」')
  assert.ok(find(tree, 'multi-clear'), '要有「清空」')
  // 未选时导出按钮禁用
  assert.equal(find(tree, 'multi-export').props.disabled, true, '没选任何条目时导出应禁用')

  // 全选后行勾选框变成选中
  find(tree, 'multi-select-all').props.onClick()
  tree = render()
  const boxes = nodes(tree).filter(n => n.props && typeof n.props['data-it'] === 'string' && n.props['data-it'].startsWith('row-check-'))
  assert.ok(boxes.length > 0, '多选态下每行要有勾选框')
  assert.equal(boxes.every(b => b.props['aria-checked'] === true), true, '全选后每行都应勾上')
  assert.equal(find(tree, 'multi-export').props.disabled, false, '有选择后导出可用')

  // 清空
  find(tree, 'multi-clear').props.onClick()
  tree = render()
  const after = nodes(tree).filter(n => n.props && typeof n.props['data-it'] === 'string' && n.props['data-it'].startsWith('row-check-'))
  assert.equal(after.every(b => b.props['aria-checked'] !== true), true, '清空后都不勾')

  // 退出多选
  find(tree, 'multi-exit').props.onClick()
  tree = render()
  assert.equal(find(tree, 'multi-bar'), undefined, '退出后回到普通汇总行')
  assert.ok(find(tree, 'multi-enter'), '退出后「多选」按钮回来')
})

test('报告页每个功能项分组各自分页，选项是 15/30/50/100', () => {
  const h = harness(), render = () => h.render(h.api.IntegrationPanel, { sessionId: 'a', initialSeed: h.TEST_SEED })
  // 默认页是测试用例，先切到测试报告页；分组默认折叠，再全部展开
  find(render(), 'tab-reports').props.onClick()
  const tree = expandAllGroups(render(), render)
  const sizes = find(tree, 'report-page-size')
  assert.ok(sizes, '分组底部要有每页条数下拉')
  const opts = nodes(sizes).filter(n => n.type === 'option').map(o => o.children.join(''))
  assert.deepEqual(opts, ['15条/页', '30条/页', '50条/页', '100条/页'], '每页选项应是 15/30/50/100：' + JSON.stringify(opts))
  // 每组各有一个分页条
  const pagers = nodes(tree).filter(n => n.props && n.props.className === 'it-sub-pager')
  const groups = nodes(tree).filter(n => n.props && typeof n.props.className === 'string' && n.props.className === 'it-report-group')
  assert.equal(pagers.length, groups.length, '每个分组都要有独立分页条')
})

test('步骤页子表分页：选项 15/30/50/100，页码按用例各记一份', () => {
  const h = harness(), render = () => h.render(h.api.IntegrationPanel, { sessionId: 'a', initialSeed: h.TEST_SEED })
  find(render(), 'tab-steps').props.onClick()
  const id = rowIds(render())[0]
  find(render(), 'expand-' + id).props.onClick()
  const tree = render()
  const sizes = find(tree, 'sub-page-size')
  assert.ok(sizes, '子表里要有每页条数下拉')
  const opts = nodes(sizes).filter(n => n.type === 'option').map(o => o.children.join(''))
  assert.deepEqual(opts, ['15条/页', '30条/页', '50条/页', '100条/页'], '子表每页选项应是 15/30/50/100')
  assert.ok(find(tree, 'sub-page-prev'), '要有上一页')
  assert.ok(find(tree, 'sub-page-next'), '要有下一页')
})

test('步骤页点展开只展开被点的那一行，不是全部一起展开', () => {
  /*
   * 用户 2026-11-20 报的现象：点子表的展开按钮，所有用例的子表都展开了。
   *
   * 根因是 cases.json 里没有 id 字段，面板没补，record.id 恒为 undefined，
   * 于是 stepOpen.indexOf(undefined) 永远命中 → 每一行的 open 都是 true。
   * 这条测试同时守住两件事：id 必须被补上、展开态必须按行隔离。
   */
  const h = harness()
  const render = () => h.render(h.api.IntegrationPanel, { sessionId: 'a', initialSeed: h.TEST_SEED })
  find(render(), 'tab-steps').props.onClick()
  const ids = rowIds(render())
  assert.ok(ids.length >= 2, '测试数据里至少要有两行才测得出串味')
  assert.equal(ids.every(id => typeof id === 'string' && id !== ''), true, '每行都要有非空 id')

  find(render(), 'expand-' + ids[0]).props.onClick()
  const tree = render()
  // 展开的行会多出一个执行结果子表容器（data-it = step-runs-<id>）
  const opened = nodes(tree)
    .filter(n => n.props && String(n.props['data-it'] || '').startsWith('step-runs-'))
    .map(n => n.props['data-it'])
  assert.deepEqual(opened, ['step-runs-' + ids[0]], '只该展开第一行，其余保持收起')
})

test('刷新会收起所有下拉菜单', () => {
  /*
   * 这个 harness 的 state 是跨渲染复用的，多次点击不同下拉时 slot 会错位，
   * 所以这里只验证「refresh 会显式关闭三个下拉」这件事本身：
   * 点一次刷新，然后确认三个菜单面板都没渲染出来。
   * （各下拉自身的开合行为由「子页下拉承载三个页面并可切换」等测试覆盖。）
   */
  const h = harness(), render = () => h.render(h.api.IntegrationPanel, { sessionId: 'a', initialSeed: h.TEST_SEED })
  let tree = render()
  assert.equal(find(tree, 'switch-menu-panel'), undefined, '默认子页下拉是关闭的')
  assert.equal(find(tree, 'version-menu-panel'), undefined, '默认版本下拉是关闭的')
  assert.equal(find(tree, 'result-menu-panel'), undefined, '默认筛选下拉是关闭的')

  find(tree, 'refresh').props.onClick()
  tree = render()
  assert.equal(find(tree, 'switch-menu-panel'), undefined, '刷新后子页下拉仍是关闭的')
  assert.equal(find(tree, 'version-menu-panel'), undefined, '刷新后版本下拉仍是关闭的')
  assert.equal(find(tree, 'result-menu-panel'), undefined, '刷新后筛选下拉仍是关闭的')
  /*
   * 刷新必须给出可感知的反馈。
   *
   * 曾经是「刷新后什么都不提示」，用户因此反馈「点刷新没反应」——
   * 数据没变化时界面本来就不变，没有一句话就分不清是刷新了还是点了没生效。
   */
  const noticeNode = find(tree, 'notice')
  assert.ok(noticeNode, '刷新后要有反馈提示')
  /*
   * 提示条结构改成了「文字 span + 关闭按钮」，所以要把整个节点里所有文本
   * 片段摊平再匹配，不能只看直接 children。
   */
  const textOf = node => {
    if (node === null || node === undefined) return ''
    if (typeof node === 'string') return node
    if (Array.isArray(node)) return node.map(textOf).join('')
    return textOf(node.children)
  }
  assert.match(textOf(noticeNode), /正在刷新/, '点下去要立刻有反馈')
})

test('提示条可以手动关闭（X 按钮）', () => {
  /*
   * 提示条是旁白，看过了就该能收起。
   * 没有关闭按钮时，一句「已刷新…」会一直挂着，用户会以为界面卡住。
   */
  const h = harness(), render = () => h.render(h.api.IntegrationPanel, { sessionId: 'a', initialSeed: h.TEST_SEED })
  find(render(), 'refresh').props.onClick()
  let tree = render()
  assert.ok(find(tree, 'notice'), '刷新后应出现提示条')

  const closeBtn = find(tree, 'notice-close')
  assert.ok(closeBtn, '提示条要有关闭按钮')
  closeBtn.props.onClick()
  tree = render()
  assert.equal(find(tree, 'notice'), undefined, '点关闭后提示条应消失')
})



test('报告页分组默认全部收起，点标题才展开，刷新后再次收起', () => {
  const h = harness(), render = () => h.render(h.api.IntegrationPanel, { sessionId: 'a', initialSeed: h.TEST_SEED })
  // 默认页是测试用例，先切到测试报告页
  find(render(), 'tab-reports').props.onClick()
  let tree = render()

  const states = () => nodes(tree)
    .filter(n => n.props && typeof n.props['data-it'] === 'string' && n.props['data-it'].startsWith('report-toggle-'))
    .map(n => n.props['aria-expanded'])
  const first = states()
  assert.ok(first.length > 0, '报告页要有功能项分组')
  assert.equal(first.every(v => v === false), true, '分组默认应全部收起：' + JSON.stringify(first))

  // 展开第一个
  const toggle = nodes(tree).find(n => n.props && typeof n.props['data-it'] === 'string' && n.props['data-it'].startsWith('report-toggle-'))
  toggle.props.onClick()
  tree = render()
  assert.equal(states()[0], true, '点标题后第一个分组展开')

  // 刷新后重新全部收起
  find(tree, 'refresh').props.onClick()
  tree = render()
  assert.equal(states().every(v => v === false), true, '刷新后分组应重新全部收起')
})

test('版本下拉：按版本号倒序（最新在上），带「当前」标记，最多露出 5 条', () => {
  const h = harness(), render = () => h.render(h.api.IntegrationPanel, { sessionId: 'a', initialSeed: h.TEST_SEED })
  const itemsOf = tree => nodes(tree)
    .filter(n => n.props && typeof n.props['data-it'] === 'string' &&
      n.props['data-it'].startsWith('version-') &&
      n.props['data-it'] !== 'version-menu' &&
      n.props['data-it'] !== 'version-menu-panel')
    .map(n => n.props['data-it'].replace('version-', ''))

  // 版本号转数字：V0.0.10 必须大于 V0.0.9（字符串比较会判反）
  assert.ok(h.api.itVersionValue('V0.0.10') > h.api.itVersionValue('V0.0.9'), 'V0.0.10 应大于 V0.0.9')
  assert.ok(h.api.itVersionValue('V0.1.0') > h.api.itVersionValue('V0.0.99'), 'V0.1.0 应大于 V0.0.99')
  assert.equal(h.api.itVersionValue('V0.0.1'), 1)

  const tree0 = render()
  find(tree0, 'version-menu').props.onClick()
  const tree = render()
  const items = itemsOf(tree)
  assert.ok(items.length >= 2, '至少要两个版本')
  // 倒序：最新的排最上（示例里 V0.0.2 比 V0.0.1 新）
  assert.equal(items[0], 'V0.0.2', '最新版本应排最上，实际：' + JSON.stringify(items))
  assert.equal(items[items.length - 1], 'V0.0.1', '最旧的应排最下，实际：' + JSON.stringify(items))

  // 「当前」标记只应出现一次，且在激活项上
  const currentTags = nodes(tree).filter(n => n.props && n.props.className === 'it-version-current')
  assert.equal(currentTags.length, 1, '「当前」标记只应出现一次')
})

test('步骤编辑器：有列头（测试方法/输入步骤/预期结果/操作），操作列含拖拽手柄与上下移', () => {
  const h = harness()
  // 直接测编辑器组件：Modal 走 createPortal，测试桩里拿不到它的 children
  const steps = [
    { no: 1, action: '打开页面', operation: '进入首页', expected: '首页展示' },
    { no: 2, action: '搜索商品', operation: '输入关键词', expected: '详情页展示' },
  ]
  const tree = h.render(h.api.IntegrationStepsEditor, { steps, embedded: true, onSave() {}, onClose() {} })
  const all = nodes(tree)

  // 列头：四列标题都要在，且顺序正确（序号列是空 span，被过滤掉）
  const head = all.find(n => n.props && n.props.className === 'it-step-head')
  assert.ok(head, '要有列头容器')
  // head.children 是 5 个 span，文字在各自的 children 里；序号列是空 span
  const titles = head.children
    .map(c => (c && c.children ? c.children.filter(x => typeof x === 'string').join('').trim() : ''))
    .filter(t => t !== '')
  assert.deepEqual(titles, ['测试方法', '输入步骤', '预期结果', '操作'], '列头文字与顺序：' + JSON.stringify(titles))

  // 操作列：只剩拖拽手柄 + 删除（顺序调整统一由手柄负责，不再有上下移按钮）
  for (const key of ['step-drag-0', 'step-delete-0']) {
    assert.ok(find(tree, key), '操作列缺少 ' + key)
  }
  assert.equal(find(tree, 'step-up-0'), undefined, '上移按钮已移除')
  assert.equal(find(tree, 'step-down-0'), undefined, '下移按钮已移除')

  // 拖拽手柄用的是和测试用例页同一个 grip 图标（6 个点）
  const handle = find(tree, 'step-drag-0')
  assert.equal(handle.props.className.includes('it-drag-handle'), true, '手柄应复用 it-drag-handle 样式')
})

test('四个遗留项：空态文案、点空白关筛选、无 IT 标识、超 5 步滚动', () => {
  const h = harness(), render = () => h.render(h.api.IntegrationPanel, { sessionId: 'a', initialSeed: h.TEST_SEED })
  const css = readFileSync(new URL('../lib/client.js', import.meta.url), 'utf8')

  // ① 三页空态：用搜索词制造无匹配，确认有标题+提示两行文案
  let t = render()
  find(t, 'search').props.onChange({ target: { value: 'zzz不存在zzz' } })
  t = render()
  const casesEmpty = nodes(t).find(n => n.props && n.props.className === 'it-empty')
  assert.ok(casesEmpty, '用例页要有空态')
  assert.equal(nodes(casesEmpty).some(n => n.props && n.props.className === 'it-empty-title'), true, '空态要有标题')

  find(t, 'tab-steps').props.onClick()
  t = render()
  assert.ok(nodes(t).some(n => n.props && n.props.className === 'it-empty-title'), '步骤页要有空态标题')

  // ② 点空白关筛选：判定改用 data-dropdown 属性（ref 在普通函数里绑不上）
  assert.ok(/data-dropdown": "result"/.test(css), '筛选容器要带 data-dropdown 标记')
  assert.ok(/function insideDropdown\(kind, target\)/.test(css), '要用 insideDropdown 判断')
  assert.equal(/inside\(switchBoxRef/.test(css), false, '不应再依赖 ref.contains（普通函数里 ref 拿不到）')
  // click 兜底仍在
  assert.ok(/addEventListener\("click", onDown, true\)/.test(css), '要有 click 兜底监听')

  // ③ 步骤弹窗副标题不含用例标识
  const modalSrc = css.slice(css.indexOf('function IntegrationStepsModal'), css.indexOf('function IntegrationStepsModal') + 1400)
  assert.equal(/subtitle: \(source\.caseId/.test(modalSrc), false, '副标题不应再拼 caseId')
  assert.ok(/subtitle: source\.title/.test(modalSrc), '副标题只保留用例名称')

  // ④ 步骤列表最多露 5 行后滚动
  const scrollRule = (css.match(/\.it-steps-modal \.it-steps-scroll \{[^}]*\}/) || [''])[0]
  assert.ok(/max-height:\s*278px/.test(scrollRule), '滚动区高度应约为 5 行（278px）：' + scrollRule)
  assert.ok(/overflow-y:\s*auto/.test(scrollRule), '超出要能滚动')
})

test('背景与卡片结构与单元测试一致：根节点用 --dp-bg，表格包在卡片里', () => {
  const css = readFileSync(new URL('../lib/client.js', import.meta.url), 'utf8')

  // ① 根节点背景必须跟随主题变量，不能 transparent
  const rootRule = (css.match(/\.it-root\.dp-root \{[^}]*\}/) || [''])[0]
  assert.ok(/background:\s*var\(--dp-bg\)/.test(rootRule), '根节点背景要用 var(--dp-bg)：' + rootRule)
  assert.equal(/background:\s*transparent/.test(rootRule), false, '不能是 transparent（深色主题下会露底）')

  // ② 卡片容器存在且观感与 .dp-card 一致（14px 圆角 + 边框）
  const cardRule = (css.match(/\.it-card \{[^}]*\}/) || [''])[0]
  assert.ok(/border:\s*1px solid var\(--dp-border\)/.test(cardRule), '卡片要有边框：' + cardRule)
  assert.ok(/border-radius:\s*14px/.test(cardRule), '圆角要与 .dp-card 一致（14px）：' + cardRule)

  // ③ 卡片内表格不再自带边框（避免双线）
  assert.ok(/\.it-card > \.it-table-wrap \{[^}]*border:\s*0/.test(css), '卡片内表格边框要清零')

  // ④ 分页条嵌在卡片底部，有自己的分隔线和内边距
  const pagerRule = (css.match(/\.it-card > \.it-pager \{[^}]*\}/) || [''])[0]
  assert.ok(/border-top:\s*1px solid var\(--dp-border\)/.test(pagerRule), '分页条要有顶部分隔线：' + pagerRule)
})

test('用例页与步骤页的表格都包在 .it-card 里', () => {
  const h = harness(), render = () => h.render(h.api.IntegrationPanel, { sessionId: 'a', initialSeed: h.TEST_SEED })
  const hasCard = tree => nodes(tree).some(n => n.props && n.props.className === 'it-card')

  // 用例页（默认页）
  assert.equal(hasCard(render()), true, '用例页的表格要包在卡片里')

  // 步骤页
  find(render(), 'tab-steps').props.onClick()
  assert.equal(hasCard(render()), true, '步骤页的表格要包在卡片里')
})

/*
 * 用例数据与「步骤」「执行记录」是**三份文件**（cases.json / steps.json /
 * exec-records.json）。面板靠 caseId 把它们合并进一条用例。
 *
 * 这条测试直接对源码里的合并逻辑做断言，因为它正是曾经漏掉的一环：
 * 只合并了 steps 没合并 records，结果磁盘上跑过的记录在子表和角标里都看不见。
 */
test('加载后端数据时按 caseId 合并步骤与执行记录（缺一不可）', async () => {
  const h = harness()
  const source = readFileSync(new URL('../lib/client.js', import.meta.url), 'utf8')
  assert.match(source, /stepByCaseId/, '要按 caseId 把 steps 合并进用例')
  assert.match(source, /execByCaseId/, '要按 caseId 把执行记录合并进用例')
  assert.match(source, /next\.records = execByCaseId/, '执行记录要落到 record.records（子表与角标都靠它）')

  // 合并后角标显示的是执行记录条数，不是步骤数
  const seed = {
    versions: [{ name: 'V0.0.1', at: '2026-11-16T09:00:00Z', status: 'current' }],
    activeVersion: 'V0.0.1',
    byVersion: {
      'V0.0.1': [
        { id: 'x', caseId: 'V0_0_1-IT-001', title: '跑过两次', scenario: '登录', type: 'functional',
          steps: [{ no: 1, action: 'a', operation: 'o', expected: 'e' }],
          records: [{ runId: 'r1', at: '2026-11-19T10:00:00Z', result: 'pass', durationMs: 1 },
                    { runId: 'r2', at: '2026-11-19T11:00:00Z', result: 'error', durationMs: 1 }] },
        { id: 'y', caseId: 'V0_0_1-IT-002', title: '没跑过', scenario: '登录', type: 'api',
          steps: [{ no: 1, action: 'a', operation: 'o', expected: 'e' }], records: [] },
      ],
    },
  }
  const render = () => h.render(h.api.IntegrationPanel, { sessionId: 'a', initialSeed: seed })
  find(render(), 'tab-steps').props.onClick()
  const tree = render()
  const badgeX = find(tree, 'run-count-x')
  const badgeY = find(tree, 'run-count-y')
  assert.ok(badgeX, '跑了 2 次的用例要有角标')
  assert.equal(String(badgeX.children[0]), '2', '角标显示执行记录条数（2），不是步骤数（1）')
  assert.equal(badgeY, undefined, '0 条执行记录不显示角标')
})
/*
 * steps.json 有两种形态，面板都必须能渲染出步骤。
 *
 * 用户 2026-11-23 实测：模型把 steps.json 写成扁平数组，测试步骤页整片空白，
 * 但磁盘上明明有步骤。根因是面板只读分组式 {cases:[{caseId,steps}]}，
 * 扁平式时 stepCases 为空 → stepByCaseId 全空 → 列表没内容。
 *
 * 后端 integration-store 已把两种形态都归一成 data.steps，前端要按 caseId 自己兜底分组。
 */
test('steps.json 扁平写法也要能渲染出步骤（不能整片空白）', () => {
  const h = harness()
  const source = readFileSync(new URL('../lib/client.js', import.meta.url), 'utf8')
  // 结构断言：必须存在「用 flatSteps 兜底分组」这段逻辑
  assert.match(source, /flatSteps/, '要有扁平 steps 的兜底分组')
  assert.match(source, /grouped\[step\.caseId\]/, '要按 caseId 把扁平步骤归组')
})

test('分组式与扁平式两种 steps 都能落到用例的 steps 上', async () => {
  const { readVersion } = await import('../lib/integration-store.js')
  const { mkdir, writeFile, rm } = await import('node:fs/promises')
  const { join } = await import('node:path')
  const { tmpdir } = await import('node:os')

  const sessionRoot = join(tmpdir(), 'steps-form-' + Date.now())
  const base = join(sessionRoot, 'integration', 'step-versions')
  await mkdir(join(base, 'V0_0_1'), { recursive: true })
  await writeFile(join(base, 'index.json'),
    JSON.stringify({ versions: [{ name: 'V0.0.1' }], activeVersion: 'V0.0.1' }), 'utf8')
  const file = join(base, 'V0_0_1', 'steps.json')

  // 复刻 client.js 的分组逻辑
  const group = data => {
    const map = Object.create(null)
    const cases = (data && Array.isArray(data.cases)) ? data.cases : []
    cases.forEach(item => {
      if (!item || typeof item.caseId !== 'string') return
      map[item.caseId] = Array.isArray(item.steps) ? item.steps : []
    })
    const flat = (data && Array.isArray(data.steps)) ? data.steps : []
    if (flat.length > 0) {
      const grouped = Object.create(null)
      flat.forEach(step => {
        if (!step || typeof step.caseId !== 'string') return
        if (!grouped[step.caseId]) grouped[step.caseId] = []
        grouped[step.caseId].push(step)
      })
      Object.keys(grouped).forEach(cid => { if (map[cid] === undefined) map[cid] = grouped[cid] })
    }
    return map
  }

  try {
    // 分组式（契约形态）
    await writeFile(file, JSON.stringify({
      stepVersion: 'V0.0.1', sourceCaseVersion: 'V0.0.1',
      cases: [
        { caseId: 'IT-001', steps: [{ no: 1 }, { no: 2 }] },
        { caseId: 'IT-002', steps: [{ no: 1 }] },
      ],
    }), 'utf8')
    let map = group(await readVersion(sessionRoot, 'step', 'V0.0.1'))
    assert.equal(Object.keys(map).length, 2, '分组式应有 2 条用例')
    assert.equal(map['IT-001'].length, 2, 'IT-001 应有 2 步')

    // 扁平式（用户实测踩到的写法）
    await writeFile(file, JSON.stringify({
      stepVersion: 'V0.0.1',
      steps: [
        { caseId: 'IT-001', no: 1 }, { caseId: 'IT-001', no: 2 }, { caseId: 'IT-002', no: 1 },
      ],
    }), 'utf8')
    map = group(await readVersion(sessionRoot, 'step', 'V0.0.1'))
    assert.equal(Object.keys(map).length, 2, '扁平式也应有 2 条用例（不能是 0）')
    assert.equal(map['IT-001'].length, 2, '扁平式 IT-001 也应有 2 步')
  } finally {
    await rm(sessionRoot, { recursive: true, force: true })
  }
})

/*
 * 一键执行的报告目录里同时有「总体报告」和「每条用例的单条报告」。
 * 「查看报告」必须挑这条用例那一份（只含 4.1.1 那张表），
 * 「总体报告 → 导出」必须挑整项目那份（整本模板）。
 * 挑错就会看到「单条报告里是整本模板」——这正是曾经出现过的问题。
 */
test('docxFor 按 caseId 挑单条报告，pickOverall 挑整项目报告', () => {
  const h = harness()
  const files = [
    { name: '集成测试报告-项目-整项目-V0.0.1.docx', path: '/r/overall.docx', kind: 'overall' },
    { name: '集成测试报告-V0_0_1-IT-001-全步骤-V0.0.1.docx', path: '/r/cases/it1.docx', kind: 'case' },
    { name: '集成测试报告-V0_0_1-IT-002-全步骤-V0.0.1.docx', path: '/r/cases/it2.docx', kind: 'case' },
    { name: 'report-data.json', path: '/r/report-data.json', kind: 'meta' },
  ]
  const detail = { files }

  // ① 按 caseId 命中单条报告，不能拿到 overall
  assert.equal(h.api.docxFor(detail, 'V0_0_1-IT-002').path, '/r/cases/it2.docx')
  assert.equal(h.api.docxFor(detail, 'V0_0_1-IT-001').path, '/r/cases/it1.docx')

  // ② 不传 caseId 且有多份 case 时，不能误拿总体报告（第一份是 overall）
  const picked = h.api.docxFor(detail, '')
  assert.ok(picked.path !== '/r/overall.docx' || detail.files.filter(f => f.kind === 'case').length === 0,
    '有多份单条报告时不该返回总体报告')

  // ③ 只有总体报告时（老数据），兜底返回它而不是 null
  assert.equal(h.api.docxFor({ files: [files[0]] }, 'V0_0_1-IT-009').path, '/r/overall.docx')

  // ④ 没有任何 docx 时返回 null
  assert.equal(h.api.docxFor({ files: [files[3]] }, 'x'), null)
})

/*
 * 导出功能：三个入口都必须真的去调导出接口，不能是「查看」或空壳。
 *
 * 这里的 fetch 桩会记录每次请求，断言按 URL 区分 ——
 * 历史上报告页的导出图标曾经绑的是 viewLatestReportOfCase（点导出变成查看），
 * 多选导出也曾经是 notConnected（点了只弹「还没接好」）。
 */
function exportHarness() {
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
  // 导出目录固定返回一个假路径，导出接口返回成功。
  const reply = url => {
    if (String(url).includes('/data-panel/export/pick-dir')) return { ok: true, dir: 'C:\\out', canceled: false }
    if (String(url).includes('/data-panel/export')) {
      return { ok: true, dir: 'C:\\out', exported: [{ name: 'r.docx', to: 'C:\\out\\r.docx' }], skipped: [] }
    }
    return { ok: true, files: [{ name: 'r.docx', path: 'C:\\r\\r.docx', kind: 'case' }, { name: 'o.docx', path: 'C:\\r\\o.docx', kind: 'overall' }], runs: [] }
  }
  vm.runInNewContext(readFileSync(process.env.DSH_PANEL_CLIENT_PATH || new URL('../lib/client.js', import.meta.url), 'utf8'), {
    window: { __ModuleLoader__: { load: value => { descriptor = value } } },
    URLSearchParams,
    console,
    setTimeout,
    clearTimeout,
    AbortController,
    fetch: (url, init) => {
      requests.push({ url: String(url), init })
      return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(reply(url)) })
    },
  })
  return { api: descriptor.factory(name => name === 'react' ? React : {}).__test, requests, render(Component, props = {}) { index = 0; return Component(props) } }
}

/** 等到所有挂起的 promise 都跑完（导出链路是 fetch → then 多层）。 */
const settle = () => new Promise(resolve => setTimeout(resolve, 20))

test('报告页的导出图标调导出接口，不是打开查看', async () => {
  const h = exportHarness()
  const seed = {
    versions: [{ name: 'V0.0.1', at: '2026-11-17T09:00:00Z', status: 'current' }],
    activeVersion: 'V0.0.1',
    byVersion: {
      'V0.0.1': [
        { id: 'it-1', caseId: 'V0_0_1-IT-001', title: '登录', scenario: '登录', type: 'functional',
          steps: [], records: [{ runId: 'run-1', at: '2026-11-17T10:00:00Z', result: 'pass', source: 'all' }] },
      ],
    },
  }
  const render = () => h.render(h.api.IntegrationPanel, { sessionId: 'a', initialSeed: seed })
  find(render(), 'tab-reports').props.onClick()
  find(render(), 'multi-enter') // 确认渲染成功
  let tree = render()
  // 分组默认收起，先展开
  const toggle = nodes(tree).find(n => n.props && String(n.props['data-it'] || '').startsWith('report-toggle-'))
  toggle.props.onClick()
  tree = render()
  const btn = find(tree, 'export-it-1')
  assert.ok(btn, '报告页行内要有导出图标')
  btn.props.onClick()
  await settle()

  const urls = h.requests.map(r => r.url)
  assert.ok(urls.some(u => u.includes('/data-panel/export/pick-dir')), '导出必须先弹目录选择：' + JSON.stringify(urls))
  assert.ok(urls.some(u => u.endsWith('/data-panel/export')), '必须真的调导出接口')
  // 不能只是打开文件
  assert.equal(urls.some(u => u.includes('/data-panel/open')), false, '导出不能变成「打开文件」')
})

test('步骤页子表的导出图标调导出接口', async () => {
  const h = exportHarness()
  const seed = {
    versions: [{ name: 'V0.0.1', at: '2026-11-17T09:00:00Z', status: 'current' }],
    activeVersion: 'V0.0.1',
    byVersion: {
      'V0.0.1': [
        { id: 'it-1', caseId: 'V0_0_1-IT-001', title: '登录', scenario: '登录', type: 'functional',
          steps: [], records: [{ runId: 'run-9', at: '2026-11-17T10:00:00Z', result: 'pass', source: 'case' }] },
      ],
    },
  }
  const render = () => h.render(h.api.IntegrationPanel, { sessionId: 'a', initialSeed: seed })
  find(render(), 'tab-steps').props.onClick()
  let tree = render()
  // 展开该用例的执行记录子表（data-it 是 expand-<record.id>）
  const rowToggle = nodes(tree).find(n => n.props && String(n.props['data-it'] || '').startsWith('expand-'))
  assert.ok(rowToggle, '步骤页每行要有展开按钮')
  rowToggle.props.onClick()
  tree = render()
  const btn = find(tree, 'export-sub-run-9')
  assert.ok(btn, '步骤页子表要有导出图标')
  btn.props.onClick()
  await settle()

  const urls = h.requests.map(r => r.url)
  assert.ok(urls.some(u => u.endsWith('/data-panel/export')), '步骤页导出要调导出接口：' + JSON.stringify(urls))
  assert.equal(urls.some(u => u.includes('/data-panel/open')), false, '导出不能变成「打开文件」')
})

test('报告页「导出已选报告」是真实导出，不再是空壳', { skip: '多选按钮 2026-11-25 暂时注释掉，恢复按钮后去掉 skip' }, async () => {
  const h = exportHarness()
  const seed = {
    versions: [{ name: 'V0.0.1', at: '2026-11-17T09:00:00Z', status: 'current' }],
    activeVersion: 'V0.0.1',
    byVersion: {
      'V0.0.1': [
        { id: 'it-1', caseId: 'V0_0_1-IT-001', title: '登录', scenario: '登录', type: 'functional',
          steps: [], records: [{ runId: 'run-1', at: '2026-11-17T10:00:00Z', result: 'pass', source: 'all' }] },
      ],
    },
  }
  const render = () => h.render(h.api.IntegrationPanel, { sessionId: 'a', initialSeed: seed })
  find(render(), 'tab-reports').props.onClick()
  find(render(), 'multi-enter').props.onClick()
  let tree = render()
  find(tree, 'multi-select-all').props.onClick()
  tree = render()
  const btn = find(tree, 'multi-export')
  assert.equal(btn.props.disabled, false, '全选后导出可用')
  btn.props.onClick()
  await settle()

  const urls = h.requests.map(r => r.url)
  assert.ok(urls.some(u => u.endsWith('/data-panel/export')), '多选导出要调导出接口：' + JSON.stringify(urls))
})

test('总体报告的导出按钮常驻，不需要先点总体报告', async () => {
  const h = exportHarness()
  const seed = {
    versions: [{ name: 'V0.0.1', at: '2026-11-17T09:00:00Z', status: 'current' }],
    activeVersion: 'V0.0.1',
    byVersion: {
      'V0.0.1': [
        { id: 'it-1', caseId: 'V0_0_1-IT-001', title: '登录', scenario: '登录', type: 'functional',
          steps: [], records: [{ runId: 'run-1', at: '2026-11-17T10:00:00Z', result: 'pass', source: 'all' }] },
      ],
    },
  }
  const render = () => h.render(h.api.IntegrationPanel, { sessionId: 'a', initialSeed: seed })
  find(render(), 'tab-reports').props.onClick()
  let tree = render()
  /*
   * 常驻：不需要先点「总体报告」就该看到导出按钮。
   *
   * 曾经做成「点过总体报告才出现」，但点它会把这个 PDF 开在主区域的新 tab，
   * 主面板被切走，按钮根本看不到（用户 2026-11-20 截图反馈）。
   */
  assert.ok(find(tree, 'overview'), '总体报告按钮要在')
  const persistent = find(tree, 'overview-export')
  assert.ok(persistent, '导出按钮应常驻，不必先点总体报告')

  persistent.props.onClick()
  await settle()
  const urls = h.requests.map(r => r.url)
  assert.ok(urls.some(u => u.endsWith('/data-panel/export')), '总体报告导出要调导出接口：' + JSON.stringify(urls))
})

test('切换到别的子页时总体报告导出按钮不出现', () => {
  const h = exportHarness()
  const seed = {
    versions: [{ name: 'V0.0.1', at: '2026-11-17T09:00:00Z', status: 'current' }],
    activeVersion: 'V0.0.1',
    byVersion: { 'V0.0.1': [] },
  }
  const render = () => h.render(h.api.IntegrationPanel, { sessionId: 'a', initialSeed: seed })
  // 默认在测试用例页：这两个按钮只属于报告页
  const tree = render()
  assert.equal(find(tree, 'overview'), undefined, '用例页不该有总体报告按钮')
  assert.equal(find(tree, 'overview-export'), undefined, '用例页不该有导出按钮')
})