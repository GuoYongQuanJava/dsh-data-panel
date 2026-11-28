/**
 * 右键菜单的实际渲染验证（用项目自己的 harness 跑真渲染）。
 *
 * 用户 2026-11-28 反馈：
 *   · 集成测试功能项右键没反应 → 要能出菜单
 *   · 单元测试原来是鼠标移上去出现的图标，要改成右键菜单（重命名 + 删除文字）
 *   · 集成测试也要加删除
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'

/** 与 integration-panel.test.mjs 同款最小 React 桩。 */
function makeHarness() {
  let descriptor
  let index = 0
  const states = []
  const React = {
    createElement: (type, props, ...children) => ({ type, props: props || {}, children }),
    useState(initial) {
      const slot = index++
      if (!(slot in states)) states[slot] = typeof initial === 'function' ? initial() : initial
      return [states[slot], (value) => { states[slot] = typeof value === 'function' ? value(states[slot]) : value }]
    },
    useRef: (current) => ({ current }),
    useMemo: (fn) => fn(),
    useEffect() {},
    Fragment: 'Fragment',
  }
  const noop = () => {}
  const emptyKinds = () => ({
    index: { versions: [], activeVersion: '', byVersion: {} }, activeVersion: '', data: null,
  })
  vm.runInNewContext(
    readFileSync(new URL('../lib/client.js', import.meta.url), 'utf8'),
    {
      window: { __ModuleLoader__: { load: (v) => { descriptor = v } } },
      URLSearchParams,
      console,
      document: {
        addEventListener: noop, removeEventListener: noop,
        querySelector: () => null, querySelectorAll: () => [],
        body: { appendChild: noop, classList: { add: noop, remove: noop } },
      },
      fetch: () => Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ ok: true, root: '', kinds: { case: emptyKinds(), step: emptyKinds(), report: emptyKinds() } }),
      }),
      setTimeout, clearTimeout, setInterval, clearInterval,
      requestAnimationFrame: (fn) => setTimeout(fn, 0),
      cancelAnimationFrame: clearTimeout,
      React,
      localStorage: { getItem: () => null, setItem: noop },
    },
    { filename: 'client.js' }
  )
  const api = descriptor.factory((name) => (name === 'react' ? React : {})).__test
  return { api, render(Component, props = {}) { index = 0; return Component(props) } }
}

/** 深度遍历元素树，收集满足条件的节点。 */
function walk(node, hit, out = []) {
  if (!node || typeof node !== 'object') return out
  if (Array.isArray(node)) {
    for (const item of node) walk(item, hit, out)
    return out
  }
  if (node.props && hit(node)) out.push(node)
  for (const child of node.children || []) walk(child, hit, out)
  return out
}

function textOf(node) {
  if (node == null || node === false) return ''
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(textOf).join('')
  return (node.children || []).map(textOf).join('')
}

const harness = makeHarness()
const api = harness.api
const IntegrationPanel = api && api.IntegrationPanel

test('导出里能拿到 IntegrationPanel（harness 可用）', () => {
  assert.ok(IntegrationPanel, 'client.js 的 __test 要导出 IntegrationPanel')
})

test('集成测试：功能项行挂了 onContextMenu（右键有反应）', () => {
  const seed = {
    versions: [{ name: 'V0.0.1', at: '', status: 'current' }],
    activeVersion: 'V0.0.1',
    byVersion: {
      'V0.0.1': [
        { id: 'it-1', caseId: 'V0_0_1-IT-001', title: '用例A', scenario: '登录', type: 'functional', steps: [], records: [] },
      ],
    },
  }
  const tree = harness.render(IntegrationPanel, { initialSeed: seed, active: true, sessionId: 'sid-1' })
  const rows = walk(tree, (n) => typeof n.props?.['data-it'] === 'string' && n.props['data-it'].startsWith('scenario-'))
  assert.ok(rows.length > 0, '要渲染出功能项行：' + rows.map((r) => r.props['data-it']).join(','))
  const login = rows.find((n) => n.props['data-it'] === 'scenario-登录')
  assert.ok(login, '要有「登录」这一行')
  assert.equal(typeof login.props.onContextMenu, 'function',
    '功能项行必须有 onContextMenu，否则右键完全没反应')
  const all = rows.find((n) => n.props['data-it'] === 'scenario-全部用例')
  assert.ok(all, '要有「全部用例」行')
  assert.ok(!all.props.onContextMenu, '「全部用例」不该能右键改')
})

test('集成测试：右键菜单项包含「重命名」与「删除」文字', () => {
  const source = readFileSync(new URL('../lib/client.js', import.meta.url), 'utf8')
  const start = source.indexOf('featureCtx && featureCtx.name')
  assert.ok(start > 0, '要有 featureCtx 菜单渲染')
  const body = source.slice(start, start + 1600)
  assert.match(body, /label: "重命名"/, '菜单要有一项叫「重命名」')
  assert.match(body, /label: "删除"/, '菜单要有「删除」')
  assert.match(body, /testId: "feature-ctx-rename"/)
  assert.match(body, /testId: "feature-ctx-delete"/)
})

test('单元测试：常驻图标已移除，改由右键菜单承载', () => {
  const source = readFileSync(new URL('../lib/client.js', import.meta.url), 'utf8')
  // 旧的常驻图标块（hover 出图标）不应再存在
  assert.doesNotMatch(source, /data-it: "cat-rename-" \+ row\.value/,
    '常驻的重命名图标要移除')
  assert.doesNotMatch(source, /data-it: "cat-delete-" \+ row\.value/,
    '常驻的删除图标要移除')
  // 右键菜单承载重命名 + 删除
  const start = source.indexOf('ctxRow && ctxRow.row')
  assert.ok(start > 0, '要有 ctxRow 菜单渲染')
  const body = source.slice(start, start + 1800)
  assert.match(body, /label: "重命名"/)
  assert.match(body, /label: "删除"/)
  assert.match(body, /kind === "layer"/, '层级行要有删除，函数组没有')
})

test('ContextMenu 组件具备「关掉」的四种方式（点别处 / Esc / 滚动 / 改窗口大小）', () => {
  const source = readFileSync(new URL('../lib/client.js', import.meta.url), 'utf8')
  const start = source.indexOf('function ContextMenu(')
  assert.ok(start > 0, '要有 ContextMenu 组件')
  const body = source.slice(start, start + 3200)
  assert.match(body, /"mousedown"/, '点别处要关')
  assert.match(body, /"Escape"/, 'Esc 要关')
  assert.match(body, /"scroll"/, '滚动要关')
  assert.match(body, /"resize"/, '窗口变化要关')
  assert.match(body, /function isInside\(target\)/,
    '要按 target 判断菜单内外 —— 无条件关会把「点菜单项」也吃掉')
  assert.match(body, /dp-ctx-menu/, '用 fixed 定位，避免被 overflow 裁掉')
})

test('删除功能项与层级删除同语义：只说解散分组，不删用例', () => {
  const source = readFileSync(new URL('../lib/client.js', import.meta.url), 'utf8')
  const start = source.indexOf('function removeFeature(')
  assert.ok(start > 0, '要有 removeFeature')
  const body = source.slice(start, start + 1400)
  assert.match(body, /filter\(/, '从 features 清单里去掉该条目')
  assert.match(body, /IT_SCENARIOS_ALL/, '停在被删项上要退回「全部用例」')
  assert.doesNotMatch(body, /op: "deleteCase"|removeCase\(/, '不能顺手删用例')
})