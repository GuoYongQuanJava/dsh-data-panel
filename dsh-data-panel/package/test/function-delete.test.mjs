/**
 * 单元测试侧「按被测函数」分组的删除（用户 2026-11-28 要求）。
 *
 * 语义：连它下面的用例一起删 —— 与层级删除不同（层级只解散分组）。
 * 函数分组是 subjectFunction 字段自动聚合的，没有独立清单，所以删分组 = 删用例。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import vm from 'node:vm'

const CLIENT = join(process.env.USERPROFILE,
  '.dsh', 'profiles', 'desktop', 'node_modules', 'dsh-data-panel', 'lib', 'client.js')
const REPO = 'F:\\插件开发\\dsh-data-panel\\dsh-data-panel\\package\\lib\\client.js'
// 用仓库源码验证（profile 需重启 DSH 才更新，但两份内容一致）
const SOURCE = readFileSync(REPO, 'utf8')
const SERVER = readFileSync('F:\\插件开发\\dsh-data-panel\\dsh-data-panel\\package\\lib\\index.js', 'utf8')
const noop = () => {}

function makeHarness() {
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
    useRef: (c) => ({ current: c }), useMemo: (fn) => fn(), useEffect() {}, useCallback: (fn) => fn, Fragment: 'F',
  }
  const node = () => ({
    addEventListener: noop, removeEventListener: noop, contains: () => false,
    classList: { add: noop, remove: noop }, style: {},
    getBoundingClientRect: () => ({ width: 100, height: 40 }),
    appendChild: noop, removeChild: noop, querySelector: () => null, querySelectorAll: () => [], setAttribute: noop,
  })
  const ek = () => ({ index: { versions: [], activeVersion: '', byVersion: {} }, activeVersion: '', data: null })
  vm.runInNewContext(SOURCE, {
    window: { __ModuleLoader__: { load: (v) => { descriptor = v } }, addEventListener: noop, removeEventListener: noop, innerWidth: 1600, innerHeight: 900, getComputedStyle: () => ({ getPropertyValue: () => '' }) },
    URLSearchParams, console,
    document: { addEventListener: noop, removeEventListener: noop, querySelector: () => null, querySelectorAll: () => [], createElement: node, body: node(), documentElement: node(), head: node() },
    fetch: () => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ ok: true, kinds: { case: ek(), step: ek(), report: ek() } }) }),
    setTimeout, clearTimeout, setInterval, clearInterval, requestAnimationFrame: (f) => setTimeout(f, 0), cancelAnimationFrame: clearTimeout,
    React, localStorage: { getItem: () => null, setItem: noop }, navigator: { userAgent: 'node' },
  }, { filename: 'client.js' })
  return {
    api: descriptor.factory((n) => (n === 'react' ? React : {})).__test,
    render(C, p) { index = 0; return C(p) },
    reset() { states.length = 0; index = 0 },
  }
}

const EXTRA = ['footer', 'header', 'title', 'detail']
function walkDeep(n, hit, out = [], depth = 0) {
  if (!n || typeof n !== 'object' || depth > 18) return out
  if (Array.isArray(n)) { for (const x of n) walkDeep(x, hit, out, depth); return out }
  if (n.props && hit(n)) out.push(n)
  for (const c of n.children || []) walkDeep(c, hit, out, depth + 1)
  if (n.props) for (const k of EXTRA) if (n.props[k]) walkDeep(n.props[k], hit, out, depth + 1)
  if (typeof n.type === 'function' && n.type !== api.IntegrationPanel) {
    let inner = null
    try { inner = n.type(n.props) } catch (e) { inner = null }
    if (inner) walkDeep(inner, hit, out, depth + 1)
  }
  return out
}

const h = makeHarness()
const api = h.api

const ROWS = [
  { key: '__all__', value: '', label: '全部用例', count: 5, kind: 'all' },
  { key: 'layer:666', value: '666', label: '666', count: 1, kind: 'layer' },
  { key: 'function:Auth', value: 'src/auth.js::login', label: 'src/auth.js::login', count: 3, kind: 'function' },
]

function baseProps(extra) {
  return Object.assign({
    rows: ROWS, activeCategory: '', activeLayer: '', pickedCount: 0,
    onSelect: noop, onCreate: noop, onRename: noop, onRenameRow: noop, onDelete: noop,
    onContextMenuRow: noop, onDeleteRow: noop,
  }, extra || {})
}

test('源码：函数组菜单现在有「删除」', () => {
  const start = SOURCE.indexOf('ctxRow && ctxRow.row')
  const block = SOURCE.slice(start, start + 2400)
  assert.match(block, /props\.onDeleteRow\(target\)/, '函数组删除要回调 onDeleteRow')
  assert.match(block, /key: "delete", label: "删除"/, '菜单要有删除项')
})

test('★ 右键函数组 → 菜单出现「重命名」和「删除」两项', () => {
  h.reset()
  let tree = h.render(api.CategorySidebar, baseProps())
  const row = walkDeep(tree, (n) => typeof n.props?.onContextMenu === 'function' && n.props?.key === 'function:Auth')[0]
  assert.ok(row, '函数组行要能右键')
  row.props.onContextMenu({ preventDefault: noop, stopPropagation: noop, clientX: 500, clientY: 300 })

  tree = h.render(api.CategorySidebar, baseProps())
  const items = walkDeep(tree, (n) => n.type === 'button'
    && typeof n.props?.onClick === 'function'
    && n.props?.className && String(n.props.className).includes('dp-ctx-item'))
  console.log('  菜单项:', items.map((i) => JSON.stringify(i).includes('重命名') ? '重命名' : '删除').join(' / '))
  assert.equal(items.length, 2, '函数组要给两项（重命名 + 删除）')
})

test('★ 点「删除」→ 回调 onDeleteRow 拿到该函数组', () => {
  h.reset()
  const deleted = []
  const P = () => baseProps({ onDeleteRow: (row) => deleted.push(row.value) })
  let tree = h.render(api.CategorySidebar, P())
  const row = walkDeep(tree, (n) => typeof n.props?.onContextMenu === 'function' && n.props?.key === 'function:Auth')[0]
  row.props.onContextMenu({ preventDefault: noop, stopPropagation: noop, clientX: 500, clientY: 300 })

  tree = h.render(api.CategorySidebar, P())
  const items = walkDeep(tree, (n) => n.type === 'button'
    && typeof n.props?.onClick === 'function'
    && n.props?.className && String(n.props.className).includes('dp-ctx-item'))
  const delItem = items.find((i) => JSON.stringify(i).includes('删除'))
  assert.ok(delItem, '要有删除项')
  delItem.props.onClick({ stopPropagation: noop })
  assert.deepEqual(deleted, ['src/auth.js::login'], '要回调 onDeleteRow 并带上函数名')
})

test('层级行删除仍走 onDelete（语义不变）', () => {
  h.reset()
  const layers = []
  const P = () => baseProps({ onDelete: (name) => layers.push(name) })
  let tree = h.render(api.CategorySidebar, P())
  const row = walkDeep(tree, (n) => typeof n.props?.onContextMenu === 'function' && n.props?.key === 'layer:666')[0]
  row.props.onContextMenu({ preventDefault: noop, stopPropagation: noop, clientX: 500, clientY: 300 })

  tree = h.render(api.CategorySidebar, P())
  const items = walkDeep(tree, (n) => n.type === 'button'
    && typeof n.props?.onClick === 'function'
    && n.props?.className && String(n.props.className).includes('dp-ctx-item'))
  const delItem = items.find((i) => JSON.stringify(i).includes('删除'))
  delItem.props.onClick({ stopPropagation: noop })
  assert.deepEqual(layers, ['666'])
})

test('★ 后端有 deleteFunction，按 subjectFunction 批量删', () => {
  assert.match(SERVER, /op === 'deleteFunction'/, '要有 deleteFunction 接口')
  assert.match(SERVER, /normalizeSubjectFunction\(item\.subjectFunction\) !== target/,
    '按 subjectFunction 过滤要删的记录')
  assert.match(SERVER, /if \(count === 0\) throw bad\(404/, '一条都没删到要报 404')
  assert.match(SERVER, /await persist\(next, store\.seeded, sessionId, store\.categories\)/,
    '一次请求内改完再落盘，避免半删状态')
})

test('★ store.deleteFunction 只删该函数组的记录', () => {
  const start = SOURCE.indexOf('deleteFunction: function')
  assert.ok(start > 0, 'store 要有 deleteFunction')
  const block = SOURCE.slice(start, start + 800)
  assert.match(block, /op: "deleteFunction"/)
  assert.match(block, /subjectFunctionOf\(record\) !== target/, '按 subjectFunction 过滤')
})

test('确认框文案写明「用例会一并删除」并带条数', () => {
  // 文案在 RecordPanel 的 ConfirmDialog 渲染处，不在 confirmAction 里。
  // 定位「条用例会一并删除」这句本身，再确认它带 count。
  const msgIdx = SOURCE.indexOf('条用例会一并删除')
  assert.ok(msgIdx > 0, '★ 文案必须说清用例会被删')
  const around = SOURCE.slice(msgIdx - 400, msgIdx + 300)
  assert.match(around, /confirm\.count/, '要显示条数')
  assert.match(around, /confirm\.kind === "deleteFunction"/, '属于 deleteFunction 分支')
  assert.match(SOURCE, /删除函数分组和用例/, '确认按钮文案要直白')
})

test('删除后若正停在该分组，筛回全部用例', () => {
  const idx = SOURCE.indexOf('confirm.kind === "deleteFunction"')
  const block = SOURCE.slice(idx, idx + 1600)
  assert.match(block, /activeCategory === confirm\.subjectFunction/, '要判断当前是否停在该分组')
  assert.match(block, /setActiveCategory\(""\)/, '删完要切回全部用例')
})

test('onDeleteRow 已传给 CategorySidebar（否则菜单点了没反应）', () => {
  const start = SOURCE.indexOf('h(CategorySidebar, {')
  const block = SOURCE.slice(start, start + 2600)
  assert.match(block, /onDeleteRow:\s*function \(row\)/, '★ 必须传 onDeleteRow')
  assert.match(block, /setConfirm\(\{[\s\S]{0,120}?kind: "deleteFunction"/, '函数组要打开 deleteFunction 确认框')
})