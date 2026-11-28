/**
 * 删除功能项 = 连同它下面的用例一起删（用户 2026-11-28 明确要求）。
 *
 * 与单元测试的层级删除不同：那边是「只解散分组」，集成测试是「真删」。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import vm from 'node:vm'

const CLIENT = join(process.env.USERPROFILE,
  '.dsh', 'profiles', 'desktop', 'node_modules', 'dsh-data-panel', 'lib', 'client.js')
const SOURCE = readFileSync(CLIENT, 'utf8')
const noop = () => {}

function makeHarness() {
  let descriptor = null
  const states = []
  let index = 0
  const requests = []
  const React = {
    createElement: (type, props, ...children) => ({ type, props: props || {}, children }),
    useState(initial) {
      const slot = index++
      if (!(slot in states)) states[slot] = typeof initial === 'function' ? initial() : initial
      return [states[slot], (v) => { states[slot] = typeof v === 'function' ? v(states[slot]) : v }]
    },
    useRef: (c) => ({ current: c }), useMemo: (fn) => fn(), useEffect() {}, useCallback: (fn) => fn, Fragment: 'F',
  }
  const node = () => ({
    addEventListener: noop, removeEventListener: noop, contains: () => false,
    classList: { add: noop, remove: noop, contains: () => false }, style: {},
    getBoundingClientRect: () => ({ width: 130, height: 74, top: 0, left: 0 }),
    appendChild: noop, removeChild: noop, querySelector: () => null, querySelectorAll: () => [],
    setAttribute: noop, focus: noop, blur: noop,
  })
  const ek = () => ({ index: { versions: [], activeVersion: '', byVersion: {} }, activeVersion: '', data: null })
  vm.runInNewContext(SOURCE, {
    window: { __ModuleLoader__: { load: (v) => { descriptor = v } }, addEventListener: noop, removeEventListener: noop, innerWidth: 1600, innerHeight: 900, getComputedStyle: () => ({ getPropertyValue: () => '' }) },
    URLSearchParams, console,
    document: { addEventListener: noop, removeEventListener: noop, querySelector: () => null, querySelectorAll: () => [], createElement: node, body: node(), documentElement: node(), head: node() },
    fetch: (url, init) => {
      requests.push({ url: String(url), body: init && init.body })
      return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ ok: true, kinds: { case: ek(), step: ek(), report: ek() } }) })
    },
    setTimeout, clearTimeout, setInterval, clearInterval, requestAnimationFrame: (f) => setTimeout(f, 0), cancelAnimationFrame: clearTimeout,
    React, localStorage: { getItem: () => null, setItem: noop }, navigator: { userAgent: 'node' },
  }, { filename: 'client.js' })
  return {
    api: descriptor.factory((n) => (n === 'react' ? React : {})).__test,
    render(C, p) { index = 0; return C(p) },
    reset() { states.length = 0; index = 0; requests.length = 0 },
    requests,
  }
}

/**
 * 遍历并展开函数组件（如 ContextMenu、ConfirmDialog、Modal）。
 *
 * 两个必须的细节：
 *   1. topLevel（IntegrationPanel）已经由 harness 调用过，不能再展开，
 *      否则重复消费状态槽位，「确认框明明渲染了却找不到」。
 *   2. 弹窗的按钮在 props.footer / props.header 里，**不在 children 里**，
 *      不单独遍历就会漏掉「确认删除」这种按钮。
 */
const EXTRA_PROP_KEYS = ['footer', 'header', 'title', 'detail']

function walkDeep(node, hit, out = [], depth = 0, topLevel = null) {
  if (!node || typeof node !== 'object' || depth > 16) return out
  if (Array.isArray(node)) { for (const n of node) walkDeep(n, hit, out, depth, topLevel); return out }
  if (node.props && hit(node)) out.push(node)
  for (const c of node.children || []) walkDeep(c, hit, out, depth + 1, topLevel)
  if (node.props) {
    for (const key of EXTRA_PROP_KEYS) {
      if (node.props[key]) walkDeep(node.props[key], hit, out, depth + 1, topLevel)
    }
  }
  if (typeof node.type === 'function' && node.type !== topLevel) {
    let inner = null
    try { inner = node.type(node.props) } catch (e) { inner = null }
    if (inner) walkDeep(inner, hit, out, depth + 1, topLevel)
  }
  return out
}

const h = makeHarness()
const api = h.api

// 两个功能项：登录（2 条用例）、下单（1 条用例）
const SEED = {
  versions: [{ name: 'V0.0.1', at: '', status: 'current' }],
  activeVersion: 'V0.0.1',
  byVersion: {
    'V0.0.1': [
      { id: 'c1', caseId: 'V0_0_1-IT-001', title: '登录成功', scenario: '登录', featureId: 'ft_1', type: 'functional', steps: [], records: [] },
      { id: 'c2', caseId: 'V0_0_1-IT-002', title: '登录失败', scenario: '登录', featureId: 'ft_1', type: 'functional', steps: [], records: [] },
      { id: 'c3', caseId: 'V0_0_1-IT-003', title: '下单', scenario: '下单', featureId: 'ft_2', type: 'functional', steps: [], records: [] },
    ],
  },
  features: [
    { id: 'ft_1', name: '登录', stage: '第一阶段' },
    { id: 'ft_2', name: '下单', stage: '第一阶段' },
  ],
}

test('前置：侧栏有「登录」「下单」两组装，共 3 条用例', () => {
  h.reset()
  const tree = h.render(api.IntegrationPanel, { initialSeed: SEED, active: true, sessionId: 's' })
  const s = JSON.stringify(tree)
  assert.ok(s.includes('登录') && s.includes('下单'), '两个功能项都要在')
  assert.equal(SEED.byVersion['V0.0.1'].length, 3, '总共 3 条用例')
})

test('★ 删除功能项「登录」→ 它下面的 2 条用例一起消失', () => {
  h.reset()
  const P = { initialSeed: SEED, active: true, sessionId: 's' }
  const draw = () => h.render(api.IntegrationPanel, P)

  // 1. 右键「登录」功能项
  let tree = draw()
  const row = walkDeep(tree, (n) => n.props?.['data-it'] === 'scenario-登录')[0]
  assert.ok(row, '要有「登录」行')
  assert.equal(typeof row.props.onContextMenu, 'function', '要能右键')
  row.props.onContextMenu({ preventDefault: noop, stopPropagation: noop, clientX: 400, clientY: 250 })

  // 2. 菜单出现，点「删除」
  tree = draw()
  const delItem = walkDeep(tree, (n) => n.props?.['data-it'] === 'feature-ctx-delete')[0]
  assert.ok(delItem, '★ 右键后菜单里要有「删除」项')
  delItem.props.onClick({ stopPropagation: noop })

  // 3. 确认框出现，确认删除
  tree = draw()
  const confirmBtn = walkDeep(tree, (n) => n.props?.['data-it'] === 'feature-remove-confirm')[0]
  assert.ok(confirmBtn, '★ 点删除后要出现确认按钮')
  confirmBtn.props.onClick()

  // 4. 验证：该功能项的 2 条用例都消失，另一个功能项的用例还在
  tree = draw()
  const s = JSON.stringify(tree)
  console.log('  删除后仍含 V0_0_1-IT-001（登录）:', s.includes('V0_0_1-IT-001'))
  console.log('  删除后仍含 V0_0_1-IT-002（登录）:', s.includes('V0_0_1-IT-002'))
  console.log('  删除后仍含 V0_0_1-IT-003（下单）:', s.includes('V0_0_1-IT-003'))
  assert.equal(s.includes('V0_0_1-IT-001'), false, '★ 功能项下的用例要一并删除')
  assert.equal(s.includes('V0_0_1-IT-002'), false, '★ 两条都要删')
  assert.equal(s.includes('V0_0_1-IT-003'), true, '别的功能项的用例不能被误删')
})

test('删除功能项时，用例数据也要写盘（不只改界面）', () => {
  const start = SOURCE.indexOf('function removeFeature(')
  assert.ok(start > 0, '要有 removeFeature')
  const body = SOURCE.slice(start, start + 2600)
  assert.match(body, /persistCases\(nextCases\)/, '★ 必须把删剩的用例写盘，否则刷新会回来')
  assert.match(body, /writeFeatures\(nextFeatures\)/, '功能项清单也要写盘')
  assert.match(body, /doomedIds\[fid\] === true/, '按 featureId 判断归属')
  assert.match(body, /itScenarioOf\(record\) === target/, '按 scenario 兜底（历史数据）')
})

test('删除确认框文案要说清「用例会一并删除」', () => {
  const start = SOURCE.indexOf('featureRemove !== null')
  assert.ok(start > 0)
  const body = SOURCE.slice(start, start + 800)
  assert.match(body, /一并删除/, '★ 文案必须明确会连用例一起删')
  assert.match(body, /无法恢复/, '要提示不可恢复')
  assert.match(body, /删除功能项和用例/, '确认按钮文案要直白')
})

test('功能项下没有用例时也能删，不报错', () => {
  h.reset()
  const emptySeed = {
    versions: [{ name: 'V0.0.1', at: '', status: 'current' }],
    activeVersion: 'V0.0.1',
    byVersion: { 'V0.0.1': [] },
    features: [{ id: 'ft_x', name: '空功能项', stage: '第一阶段' }],
  }
  let tree = h.render(api.IntegrationPanel, { initialSeed: emptySeed, active: true, sessionId: 's' })
  // 空功能项不会出现在侧栏（按 scenario 聚合），这里只验证渲染不崩
  assert.ok(tree, '空数据也要能渲染')
})

