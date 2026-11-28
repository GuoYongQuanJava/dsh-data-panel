/**
 * 单元测试侧栏右键的**完整链路**验证（这次不再只断言"挂没挂 handler"）。
 *
 * 教训（2026-11-28）：前两轮测试都只断言 `typeof onContextMenu === 'function'`，
 * 但代码里 `setCtxRow` 从来没在右键时被调用 —— handler 挂上了，菜单永不出现。
 * 所以这组测试全程模拟「右键 → 状态变化 → 重新渲染 → 菜单在树里 → 点菜单项 → 回调」。
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

/**
 * 带「状态持久 + 可重渲染」的 harness。
 *
 * 关键差别：useState 的值跨 render 调用保留（同一个 slot 数组），
 * 这样「右键改状态 → 再渲染一次」才能看到菜单出现。
 * 之前那套每次 render 重置 index 的状态会丢，测不出真实行为。
 */
function makeLiveHarness() {
  let descriptor = null
  const states = []
  let index = 0
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
  const node = () => ({
    addEventListener: noop, removeEventListener: noop,
    contains: () => false, classList: { add: noop, remove: noop, contains: () => false },
    style: {}, getBoundingClientRect: () => ({ width: 130, height: 74, top: 0, left: 0 }),
    appendChild: noop, removeChild: noop, querySelector: () => null, querySelectorAll: () => [],
    setAttribute: noop, focus: noop, blur: noop,
  })
  const emptyKinds = () => ({
    index: { versions: [], activeVersion: '', byVersion: {} }, activeVersion: '', data: null,
  })
  vm.runInNewContext(SOURCE, {
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
      createElement: node, body: node(), documentElement: node(), head: node(),
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

  const api = descriptor.factory((n) => (n === 'react' ? React : {})).__test
  return {
    api,
    /**
     * 渲染。**不清空 states**：模拟 React 的同一组件重渲染，
     * 否则右键写入的状态在下一帧就丢了，测不出「菜单出现」。
     */
    render(Component, props) { index = 0; return Component(props) },
    /** 只在新用例开始时调：清掉上个用例残留的状态槽。 */
    reset() { states.length = 0; index = 0 },
  }
}

function walk(node, hit, out = []) {
  if (!node || typeof node !== 'object') return out
  if (Array.isArray(node)) { for (const n of node) walk(n, hit, out); return out }
  if (node.props && hit(node)) out.push(node)
  for (const c of node.children || []) walk(c, hit, out)
  return out
}

/**
 * 遍历时**展开函数组件**。
 *
 * 关键：`h(ContextMenu, {...})` 只是元素描述，children 是空的 ——
 * 真正的菜单项在调用 ContextMenu(props) 之后才有。
 * 不展开就会误判成「菜单没渲染」（2026-11-28 我自己踩了这个坑）。
 */
function walkDeep(node, hit, out = [], api = null) {
  if (!node || typeof node !== 'object') return out
  if (Array.isArray(node)) { for (const n of node) walkDeep(n, hit, out, api); return out }
  if (node.props && hit(node)) out.push(node)
  for (const c of node.children || []) walkDeep(c, hit, out, api)
  // 函数组件（如 ContextMenu）要调用一次才能拿到真正的子节点
  if (typeof node.type === 'function' && node.type !== api?.CategorySidebar) {
    let inner = null
    try { inner = node.type(node.props) } catch (e) { inner = null }
    if (inner) walkDeep(inner, hit, out, api)
  }
  return out
}
const textIn = (tree) => JSON.stringify(tree)

const h = makeLiveHarness()
const api = h.api

const ROWS = [
  { key: '__all__', value: '', label: '全部用例', count: 2314, kind: 'all' },
  { key: 'layer:666', value: '666', label: '666', count: 0, kind: 'layer' },
  { key: 'function:Auth', value: 'src/auth.js::login', label: 'src/auth.js::login', count: 468, kind: 'function' },
]

function baseProps(extra) {
  return Object.assign({
    rows: ROWS, activeCategory: '', activeLayer: '', pickedCount: 0,
    onSelect: noop, onCreate: noop, onRename: noop, onRenameRow: noop, onDelete: noop,
    onContextMenuRow: noop,
  }, extra || {})
}

test('★ 右键立即出菜单：右键后重新渲染，树里要有菜单节点', () => {
  h.reset()
  let tree = h.render(api.CategorySidebar, baseProps())
  assert.ok(!textIn(tree).includes('cat-ctx-menu'), '初始不该有菜单')

  // 找到 666 那行并触发右键
  const row = walk(tree, (n) => typeof n.props?.onContextMenu === 'function' && n.props?.key === 'layer:666')[0]
  assert.ok(row, '666 行要挂 onContextMenu')
  row.props.onContextMenu({ preventDefault: noop, stopPropagation: noop, clientX: 700, clientY: 300 })

  // 重新渲染（模拟 React 因 setState 重渲染）
  tree = h.render(api.CategorySidebar, baseProps())
  assert.ok(textIn(tree).includes('cat-ctx-menu'),
    '★ 右键后菜单必须出现（这正是之前漏掉 setCtxRow 导致的 bug）')
  assert.ok(textIn(tree).includes('重命名'), '菜单里要有「重命名」')
  assert.ok(textIn(tree).includes('删除'), '菜单里要有「删除」')
})

test('★ 点菜单「重命名」→ 回调拿到 666，可以弹窗', () => {
  h.reset()
  const renamed = []
  let tree = h.render(api.CategorySidebar, baseProps({
    onRename: (name) => renamed.push(name),
  }))
  const row = walk(tree, (n) => typeof n.props?.onContextMenu === 'function' && n.props?.key === 'layer:666')[0]
  row.props.onContextMenu({ preventDefault: noop, stopPropagation: noop, clientX: 700, clientY: 300 })

  tree = h.render(api.CategorySidebar, baseProps({ onRename: (name) => renamed.push(name) }))
  const items = walkDeep(tree, (n) => n.type === 'button' && typeof n.props?.onClick === 'function' && n.props?.className && String(n.props.className).includes('dp-ctx-item'), [], api)
  assert.equal(items.length, 2, '菜单要有两项')
  const renameItem = items.find((n) => textIn(n).includes('重命名'))
  assert.ok(renameItem, '要有「重命名」项')
  renameItem.props.onClick({ stopPropagation: noop })
  assert.deepEqual(renamed, ['666'], '点「重命名」要回调 onRename("666")')
})

test('★ 点菜单「删除」→ 回调拿到 666，可以弹确认框', () => {
  h.reset()
  const deleted = []
  let tree = h.render(api.CategorySidebar, baseProps({ onDelete: (name) => deleted.push(name) }))
  const row = walk(tree, (n) => typeof n.props?.onContextMenu === 'function' && n.props?.key === 'layer:666')[0]
  row.props.onContextMenu({ preventDefault: noop, stopPropagation: noop, clientX: 700, clientY: 300 })

  tree = h.render(api.CategorySidebar, baseProps({ onDelete: (name) => deleted.push(name) }))
  const items = walkDeep(tree, (n) => n.type === 'button' && typeof n.props?.onClick === 'function' && n.props?.className && String(n.props.className).includes('dp-ctx-item'), [], api)
  const delItem = items.find((n) => textIn(n).includes('删除'))
  assert.ok(delItem, '要有「删除」项')
  delItem.props.onClick({ stopPropagation: noop })
  assert.deepEqual(deleted, ['666'], '点「删除」要回调 onDelete("666")')
})

test('★ 函数组右键只有「重命名」，没有「删除」', () => {
  h.reset()
  let tree = h.render(api.CategorySidebar, baseProps())
  const row = walk(tree, (n) => typeof n.props?.onContextMenu === 'function'
    && n.props?.key === 'function:Auth')[0]
  assert.ok(row, '函数组行要能右键')
  row.props.onContextMenu({ preventDefault: noop, stopPropagation: noop, clientX: 700, clientY: 400 })
  tree = h.render(api.CategorySidebar, baseProps())
  const items = walkDeep(tree, (n) => n.type === 'button' && typeof n.props?.onClick === 'function' && n.props?.className && String(n.props.className).includes('dp-ctx-item'), [], api)
  assert.equal(items.length, 1, '函数组只给重命名')
  assert.ok(textIn(items[0]).includes('重命名'))
})

test('★ 「全部用例」不能右键（不挂 handler）', () => {
  h.reset()
  const tree = h.render(api.CategorySidebar, baseProps())
  const allRow = walk(tree, (n) => n.props?.['data-it'] === undefined
    && n.type === 'button' && textIn(n).includes('全部用例'))
  // 全部用例走 button 分支，没有 onContextMenu
  const ctxRows = walk(tree, (n) => typeof n.props?.onContextMenu === 'function')
  assert.equal(ctxRows.length, 2, '只有 666 与函数组两行能右键')
})

test('源码必须有 setCtxRow 的「设置点」，不能只有读取', () => {
  // 这是本次 bug 的直接防线：漏掉这句，右键就完全没反应
  const start = SOURCE.indexOf('function CategorySidebar')
  const end = SOURCE.indexOf('function RecordFormModal', start)
  const body = SOURCE.slice(start, end)
  const sets = body.match(/setCtxRow\(/g) || []
  assert.ok(sets.length >= 2,
    '要有「设置」(右键时) 和「清空」(onClose) 两处 setCtxRow，实际 ' + sets.length + ' 处')
  assert.match(body, /setCtxRow\(\{ row: row, x: event\.clientX, y: event\.clientY \}\)/,
    '右键时必须把行与坐标写进状态')
})


