/**
 * 用单元测试的真实会话数据（含空层级 666）验证右键菜单。
 * 数据：records-session-e386ac5c...json（6 条用例 + categories: ['666']）
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import vm from 'node:vm'

const CLIENT = join(process.env.USERPROFILE,
  '.dsh', 'profiles', 'desktop', 'node_modules', 'dsh-data-panel', 'lib', 'client.js')
const PD = join(process.env.USERPROFILE, '.dsh', 'plugin-data', 'dsh-data-panel')
const SID = 'session-e386ac5c-46da-4b99-91bb-2412141ef162'

const noop = () => {}
const readJson = (p) => JSON.parse(readFileSync(p, 'utf8').replace(/^\uFEFF/, ''))

const store = readJson(join(PD, 'records-' + SID + '.json'))
const records = Array.isArray(store) ? store : (store.records || [])
const categories = Array.isArray(store?.categories) ? store.categories : []

function makeHarness() {
  let descriptor
  let index = 0
  const states = []
  const React = {
    createElement: (type, props, ...children) => ({ type, props: props || {}, children }),
    useState(initial) {
      const slot = index++
      if (!(slot in states)) states[slot] = typeof initial === 'function' ? initial() : initial
      return [states[slot], (v) => { states[slot] = typeof v === 'function' ? v(states[slot]) : v }]
    },
    useRef: (current) => ({ current }),
    useMemo: (fn) => fn(),
    useEffect() {},
    useCallback: (fn) => fn,
    Fragment: 'Fragment',
  }
  const el = () => ({
    addEventListener: noop, removeEventListener: noop,
    classList: { add: noop, remove: noop, contains: () => false },
    style: {}, getBoundingClientRect: () => ({ width: 0, height: 0, top: 0, left: 0 }),
    appendChild: noop, removeChild: noop, querySelector: () => null, querySelectorAll: () => [],
    setAttribute: noop, focus: noop, blur: noop,
  })
  const emptyKinds = () => ({
    index: { versions: [], activeVersion: '', byVersion: {} }, activeVersion: '', data: null,
  })
  vm.runInNewContext(readFileSync(CLIENT, 'utf8'), {
    window: {
      __ModuleLoader__: { load: (v) => { descriptor = v } },
      addEventListener: noop, removeEventListener: noop,
      innerWidth: 1600, innerHeight: 900,
      getComputedStyle: () => ({ getPropertyValue: () => '' }),
    },
    URLSearchParams, console,
    document: {
      addEventListener: noop, removeEventListener: noop,
      querySelector: () => null, querySelectorAll: () => [],
      createElement: el, body: el(), documentElement: el(), head: el(),
    },
    fetch: () => Promise.resolve({
      ok: true, status: 200,
      json: () => Promise.resolve({ ok: true, root: '', kinds: { case: emptyKinds(), step: emptyKinds(), report: emptyKinds() } }),
    }),
    setTimeout, clearTimeout, setInterval, clearInterval,
    requestAnimationFrame: (fn) => setTimeout(fn, 0), cancelAnimationFrame: clearTimeout,
    React, localStorage: { getItem: () => null, setItem: noop },
    navigator: { userAgent: 'node' },
  }, { filename: 'client.js' })
  return {
    api: descriptor.factory((name) => (name === 'react' ? React : {})).__test,
    render(Component, props = {}) { index = 0; return Component(props) },
  }
}

function walk(node, hit, out = []) {
  if (!node || typeof node !== 'object') return out
  if (Array.isArray(node)) { for (const n of node) nodeWalk(n, hit, out); return out }
  if (node.props && hit(node)) out.push(node)
  for (const c of node.children || []) walk(c, hit, out)
  return out
}
function nodeWalk(n, hit, out) { walk(n, hit, out) }

const harness = makeHarness()
const api = harness.api

test('真实数据：6 条用例 + 显式层级 666', () => {
  console.log('  用例数:', records.length)
  console.log('  显式层级:', JSON.stringify(categories))
  assert.equal(records.length, 6)
  assert.ok(categories.includes('666'))
})

test('★ 空层级 666 出现在侧栏，且能右键', () => {
  // 复刻 RecordPanel 里构造 sidebarRows 的逻辑（client.js L4122 附近）
  const fnRows = api.functionRows ? api.functionRows(records) : null
  const sideRows = [
    { key: '__all__', value: '', label: '全部用例', count: records.length, kind: 'all' },
    ...categories.map((name) => ({ key: 'layer:' + name, value: name, label: name, count: 0, kind: 'layer' })),
  ]
  const tree = harness.render(api.CategorySidebar, {
    rows: sideRows, activeCategory: '', activeLayer: '', pickedCount: 0,
    onSelect: noop, onCreate: noop, onRename: noop, onRenameRow: noop, onDelete: noop,
    onContextMenuRow: noop,
  })
  const cats = walk(tree, (n) => typeof n.props?.className === 'string' && n.props.className.includes('dp-cat'))
  const rows2 = walk(tree, (n) => typeof n.props?.onClick === 'function' && n.children && n.children.length)
  // 找出所有可右键的行
  const ctxable = walk(tree, (n) => typeof n.props?.onContextMenu === 'function')
  console.log('  渲染出的可右键行数:', ctxable.length)
  console.log('  666 行是否在树里:', JSON.stringify(JSON.stringify(tree)).includes('666'))

  assert.ok(JSON.stringify(tree).includes('666'), '侧栏要显示 666 这一行')
  assert.ok(ctxable.length >= 1, '666 层级行必须能右键（空层级也要能改名）')
})

test('「全部用例」行不能右键', () => {
  const tree = harness.render(api.CategorySidebar, {
    rows: [
      { key: '__all__', value: '', label: '全部用例', count: 6, kind: 'all' },
      { key: 'layer:666', value: '666', label: '666', count: 0, kind: 'layer' },
    ],
    activeCategory: '', activeLayer: '', pickedCount: 0,
    onSelect: noop, onCreate: noop, onRename: noop, onRenameRow: noop, onDelete: noop,
    onContextMenuRow: noop,
  })
  // 找全部用例那一行：value 为空的 branch 渲染成 button（无 onContextMenu）
  const ctxable = walk(tree, (n) => typeof n.props?.onContextMenu === 'function')
  assert.equal(ctxable.length, 1, '只有 666 这一行能右键')
})

test('点 666 行的右键回调会带出该行', () => {
  let captured = null
  const tree = harness.render(api.CategorySidebar, {
    rows: [
      { key: '__all__', value: '', label: '全部用例', count: 6, kind: 'all' },
      { key: 'layer:666', value: '666', label: '666', count: 0, kind: 'layer' },
    ],
    activeCategory: '', activeLayer: '', pickedCount: 0,
    onSelect: noop, onCreate: noop, onRename: noop, onRenameRow: noop, onDelete: noop,
    onContextMenuRow: (row, x, y) => { captured = { row, x, y } },
  })
  const row = walk(tree, (n) => typeof n.props?.onContextMenu === 'function')[0]
  let prevented = false
  row.props.onContextMenu({ preventDefault: () => { prevented = true }, stopPropagation: noop, clientX: 300, clientY: 200 })
  assert.equal(prevented, true, '要阻止原生菜单')
  assert.ok(captured, '回调要触发')
  assert.equal(captured.row.value, '666')
  assert.equal(captured.row.kind, 'layer')
  console.log('  右键 666 → 回调拿到:', JSON.stringify(captured.row))
})