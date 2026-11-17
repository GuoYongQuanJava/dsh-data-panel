// 回归：集成测试与单元测试之间的切换入口。
//
// 曾经的 bug：页签只长在 DataPanelView 的 header 里，切到集成测试后
// 整个 DataPanelView 被 display:none 隐藏，页签跟着藏了，
// 结果没有任何入口能从集成测试切回单元测试。
//
// 这里锁三件事：
//   1. 集成视图自己必须渲染「单元测试 / 集成测试」页签；
//   2. 点页签要把目标模式回调出去；
//   3. 隐藏时只 display:none，不卸载（保住搜索/筛选状态）。
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'

const CLIENT = process.env.DSH_PANEL_CLIENT_PATH || new URL('../lib/client.js', import.meta.url)

function harness() {
  let descriptor, index = 0
  const states = []
  const React = {
    createElement: (type, props, ...children) => ({
      type,
      props: props || {},
      children: children.flat(Infinity).filter(c => c !== null && c !== undefined && c !== false && c !== true),
    }),
    Fragment: 'Fragment',
    useState(initial) {
      const slot = index++
      if (!(slot in states)) states[slot] = typeof initial === 'function' ? initial() : initial
      return [states[slot], value => { states[slot] = typeof value === 'function' ? value(states[slot]) : value }]
    },
    useRef: current => ({ current }), useMemo: fn => fn(), useEffect() {},
    useSyncExternalStore: (_s, get) => get(),
  }
  vm.runInNewContext(readFileSync(CLIENT, 'utf8'), {
    window: { __ModuleLoader__: { load: value => { descriptor = value } } },
    URLSearchParams, console,
    // Modal 通过 ReactDOM.createPortal 挂到 body；给个最小 document 让它能跑。
    document: {
      body: {}, addEventListener() {}, removeEventListener() {},
      getElementById: () => null,
      createElement: () => ({ style: {} }),
      head: { appendChild() {} },
    },
    fetch: () => { throw new Error('集成演示不得请求后端') },
  })
  const api = descriptor.factory(name => (name === 'react' ? React : name === 'react-dom' ? { createPortal: x => x } : {})).__test
  return { api, reset() { index = 0; states.length = 0 } }
}

function nodes(tree) {
  if (!tree || typeof tree !== 'object') return []
  return Array.isArray(tree) ? tree.flatMap(nodes) : [tree, ...nodes(tree.children)]
}
function deepNodes(tree) {
  const out = []
  for (const node of nodes(tree)) {
    out.push(node)
    if (typeof node.type === 'function' && node.type !== 'Fragment') {
      try {
        out.push(...nodes(node.type(node.props)))
      } catch {}
    }
  }
  return out
}
const find = (tree, key) => deepNodes(tree).find(n => n.props && n.props['data-it'] === key)

test('集成视图自带切换页签，点击能回到单元测试', () => {
  const h = harness()
  h.reset()
  let picked = null
  const tree = h.api.IntegrationPanel({ sessionId: 'a', active: true, onModeChange: mode => { picked = mode } })

  const unitTab = find(tree, 'mode-unit')
  const integTab = find(tree, 'mode-integration')
  assert.ok(unitTab, '集成视图必须渲染「单元测试」页签，否则切过去就回不来')
  assert.ok(integTab, '集成视图也要有「集成测试」页签以显示当前选中态')
  assert.equal(integTab.props['aria-selected'], true)
  assert.equal(unitTab.props['aria-selected'], false)

  unitTab.props.onClick()
  assert.equal(picked, 'unit')
})

test('页签位于内容之上，隐藏时仍保留挂载', () => {
  const h = harness()
  h.reset()
  const tree = h.api.IntegrationPanel({ sessionId: 'a', active: true, onModeChange() {} })
  const all = deepNodes(tree)
  const tabAt = all.findIndex(n => n.props && n.props['data-it'] === 'mode-unit')
  const searchAt = all.findIndex(n => n.props && n.props['data-it'] === 'search')
  assert.ok(tabAt >= 0 && searchAt > tabAt, '页签要在工具栏之前')

  h.reset()
  const hidden = h.api.IntegrationPanel({ sessionId: 'a', active: false, onModeChange() {} })
  const root = nodes(hidden).find(n => n.props && n.props['data-it'] === 'integration-root')
  assert.equal(root.props.style.display, 'none')
  assert.ok(find(hidden, 'mode-unit'), '隐藏只是 display:none，内部页签仍在')
})

test('页签组件只在目标模式不同时回调', () => {
  const h = harness()
  h.reset()
  let picked = null
  const tabs = h.api.TestModeTabs({ mode: 'integration', onChange: m => { picked = m } })
  find(tabs, 'mode-unit').props.onClick()
  assert.equal(picked, 'unit')

  h.reset()
  let count = 0
  const current = h.api.TestModeTabs({ mode: 'unit', onChange: () => { count += 1 } })
  find(current, 'mode-unit').props.onClick()
  assert.equal(count, 0, '点已经激活的页签不应重复回调')
})

test('壳同时渲染两个视图并共享同一个 onModeChange', () => {
  const h = harness()
  h.reset()
  const tree = h.api.TestPanelHost({ sessionId: 'a', dock: true })
  const unit = nodes(tree).find(n => n.type === h.api.DataPanelView)
  const integ = nodes(tree).find(n => n.type === h.api.IntegrationPanel)
  assert.ok(unit && integ, '两个视图都要挂载，切换才不丢状态')
  assert.equal(typeof unit.props.onModeChange, 'function')
  assert.equal(unit.props.onModeChange, integ.props.onModeChange)
})

test('集成页与单元页共用同一套骨架，工具栏保持一行', () => {
  const h = harness()
  h.reset()
  const tree = h.api.IntegrationPanel({ sessionId: 'a', active: true, onModeChange() {} })
  const all = deepNodes(tree)

  // 骨架：dp-shell → dp-header（eyebrow + 页签 + 右侧看板）→ 工具栏
  const classNames = all.filter(n => n.props && typeof n.props.className === 'string').map(n => n.props.className)
  const hasClass = name => classNames.some(c => c.split(' ').includes(name))
  assert.ok(hasClass('dp-shell'), '集成页要套 .dp-shell，留白才和单元页一致')
  assert.ok(hasClass('dp-header'), '要有 .dp-header 承载标题与看板')
  assert.ok(hasClass('it-toolbar'), '要有工具栏')
  // 工具栏同时挂 .dp-toolbar：间距、docked 收紧、搜索框与下拉的尺寸全部继承单元测试，
  // 不再自己维护一份度量（自己维护那套曾让搜索框比单元测试更窄）。
  assert.ok(hasClass('dp-toolbar'), '工具栏要复用 .dp-toolbar，尺寸才和单元测试一致')
  assert.ok(hasClass('dp-stats'), '看板复用 dp-stats 才同视觉')

  // 看板与工具栏都在，且工具栏里同时有子页下拉、搜索、类型筛选、刷新、主操作
  for (const key of ['switch-menu', 'search', 'refresh', 'add-case']) {
    assert.ok(find(tree, key), '工具栏缺少 ' + key)
  }

  // 搜索框必须是工具栏的第一个控件，位置与单元测试逐位对齐（子页下拉不能占第一位）
  const toolbar = all.find(n => n.props && typeof n.props.className === 'string' &&
    n.props.className.split(' ').includes('it-toolbar'))
  assert.ok(toolbar, '要找到工具栏节点')
  const firstChild = (toolbar.children || [])[0]
  assert.ok(firstChild, '工具栏要有子节点')
  // 第一个控件渲染出来必须是搜索框（SearchBox 是组件，className 在它的渲染结果里）
  const firstRendered = deepNodes(firstChild)
    .filter(n => n.props && typeof n.props.className === 'string')
    .map(n => n.props.className)
  assert.ok(firstRendered.some(c => c.split(' ').includes('dp-search')),
    '搜索框要排在工具栏第一位，和单元测试一致')
  // 搜索框用 .dp-search 原生度量：不能出现覆盖尺寸的 flex/min-width 规则
  const searchRule = readFileSync(CLIENT, 'utf8').match(/\.it-toolbar \.dp-search \{[^}]*\}/g) || []
  assert.equal(searchRule.some(r => /flex:\s*1 1 auto/.test(r)), false,
    '不要用 flex:1 1 auto 覆盖 .dp-search 的原生基准宽度')

  // 子页横排页签已收成下拉：不应再有 it-subtab 按钮
  assert.equal(find(tree, 'tab-cases') && find(tree, 'tab-cases').props.className.includes('it-switch-item'), true,
    '子页应作为下拉项存在')
})

test('子页下拉承载三个页面并可切换', () => {
  const h = harness()
  h.reset()
  const tree = h.api.IntegrationPanel({ sessionId: 'a', active: true, onModeChange() {} })
  const btn = find(tree, 'switch-menu')
  assert.ok(btn, '要有子页下拉按钮')
  assert.equal(typeof btn.props.onClick, 'function')
  // 三个子页都能从下拉里找到
  for (const key of ['cases', 'steps', 'reports']) {
    assert.ok(find(tree, 'tab-' + key), '下拉里缺少子页 ' + key)
  }
})
test('新增用例、编辑和总体报告都是弹窗，不会把表格顶掉', () => {
  const h = harness()

  h.reset()
  const editor = h.api.IntegrationCaseEditor({ mode: 'edit', record: { id: '', steps: [], records: [] }, onSave() {}, onClose() {} })
  const classes = deepNodes(editor)
    .filter(n => n.props && typeof n.props.className === 'string')
    .map(n => n.props.className)
  assert.ok(classes.some(c => c.includes('dp-mask')), '编辑用例应是弹窗（dp-mask）')
  assert.ok(classes.some(c => c.includes('dp-modal')), '弹窗本体要存在')

  h.reset()
  const overview = h.api.IntegrationOverview({ records: [{ id: 'a', title: 'A', scenario: 'S', status: 'pass', reports: [{}] }], onClose() {}, onNotice() {} })
  const ovClasses = deepNodes(overview)
    .filter(n => n.props && typeof n.props.className === 'string')
    .map(n => n.props.className)
  assert.ok(ovClasses.some(c => c.includes('dp-mask')), '总体报告应是弹窗')
})

test('下拉菜单有不透明背景，不会透出下方内容', () => {
  const h = harness()
  const css = readFileSync(CLIENT, 'utf8').match(/var CSS = `([\s\S]*?)`;/)[1]
  const rule = (css.match(/\.it-switch-menu,[^{]*\{[^}]*\}/) || css.match(/\.it-switch-menu[^{]*\{[^}]*\}/) || [''])[0]
  assert.ok(/background:\s*var\(--dp-bg\)/.test(rule), '下拉菜单必须给不透明背景：' + rule)
  assert.ok(/z-index/.test(rule), '下拉菜单要盖在表格之上')
})
test('集成根节点带 dp-root，否则 --dp-bg 等变量取不到值（菜单会透明）', () => {
  const h = harness()
  h.reset()
  const tree = h.api.IntegrationPanel({ sessionId: 'a', active: true, dock: true, onModeChange() {} })
  const root = nodes(tree).find(n => n.props && n.props['data-it'] === 'integration-root')
  assert.ok(root, '要找得到集成根节点')
  const cls = root.props.className || ''
  assert.ok(cls.includes('dp-root'), '集成分支必须带 dp-root：CSS 变量只定义在 .dp-root 上')
  assert.ok(cls.includes('it-root'), '仍要保留 it-root 供自身样式使用')
  assert.ok(cls.includes('dp-docked'), 'dock 时套 dp-docked，留白才和单元测试一致')

  // 复位 .dp-root 的 height/overflow，避免多出一层滚动条或裁掉菜单
  const css = readFileSync(CLIENT, 'utf8')
  const rule = (css.match(/\.it-root\.dp-root \{[^}]*\}/) || [''])[0]
  assert.ok(/height:\s*auto/.test(rule), '要复位 height: ' + rule)
  assert.ok(/overflow:\s*visible/.test(rule), '要复位 overflow，否则菜单被裁: ' + rule)
})