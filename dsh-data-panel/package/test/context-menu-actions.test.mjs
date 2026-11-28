/**
 * 右键菜单的「点击后有没有反应」验证。
 *
 * 用户 2026-11-28 反馈两个真问题：
 *   1. 点「重命名」「删除」没反应 → 应该弹窗
 *   2. 单元测试侧完全没法右键（新建的 666 层级也点不动）
 *
 * 第 2 个的根因：onContextMenuRow 没传给 CategorySidebar，
 * 行上根本没挂 onContextMenu。这组测试专门盯住这两条。
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
    addEventListener: noop, removeEventListener: noop, contains: () => false,
    classList: { add: noop, remove: noop, contains: () => false },
    style: {}, getBoundingClientRect: () => ({ width: 120, height: 70, top: 0, left: 0 }),
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
  if (Array.isArray(node)) { for (const n of node) walk(n, hit, out); return out }
  if (node.props && hit(node)) out.push(node)
  for (const c of node.children || []) walk(c, hit, out)
  return out
}

const harness = makeHarness()
const api = harness.api

// ── 问题 2：单元测试侧有没有挂上 onContextMenu ──────────────

test('★ 单元测试侧：CategorySidebar 收到了 onContextMenuRow', () => {
  // 调用方必须传这个 prop，否则行上不挂 onContextMenu
  const start = SOURCE.indexOf('h(CategorySidebar, {')
  assert.ok(start > 0, '要能找到 CategorySidebar 的调用处')
  const block = SOURCE.slice(start, start + 2200)
  assert.match(block, /onContextMenuRow\s*:/,
    '★ 必须传 onContextMenuRow（缺了它右键完全没反应）')
})

test('★ 单元测试侧：666 这种空层级行能右键', () => {
  const tree = harness.render(api.CategorySidebar, {
    rows: [
      { key: '__all__', value: '', label: '全部用例', count: 6, kind: 'all' },
      { key: 'layer:666', value: '666', label: '666', count: 0, kind: 'layer' },
    ],
    activeCategory: '', activeLayer: '', pickedCount: 0,
    onSelect: noop, onCreate: noop, onRename: noop, onRenameRow: noop, onDelete: noop,
    onContextMenuRow: noop,
  })
  const ctxable = walk(tree, (n) => typeof n.props?.onContextMenu === 'function')
  assert.equal(ctxable.length, 1, '666 这一行必须能右键（全部用例不能）')
})

// ── 问题 1：点菜单项要真的触发动作 ─────────────────────────

test('★ ContextMenu：点菜单项会触发 onSelect，不会被"点别处关闭"吃掉', () => {
  const fired = []
  // 单独渲染 ContextMenu：共享的 harness 会复用状态槽位，导致 pos 取到 null。
  let descriptor = null
  let index = 0
  const states = []
  const React = {
    createElement: (type, props, ...children) => ({ type, props: props || {}, children }),
    useState(initial) {
      const slot = index++
      if (!(slot in states)) states[slot] = typeof initial === 'function' ? initial() : initial
      return [states[slot], (v) => { states[slot] = typeof v === 'function' ? v(states[slot]) : v }]
    },
    useRef: () => ({
      current: {
        getBoundingClientRect: () => ({ width: 120, height: 70 }),
        contains: () => false,
      },
    }),
    useMemo: (fn) => fn(),
    useEffect() {},
    Fragment: 'Fragment',
  }
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
      createElement: () => ({ style: {}, appendChild: noop, classList: { add: noop } }),
      body: { appendChild: noop }, documentElement: {}, head: { appendChild: noop },
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
  const ContextMenu = descriptor.factory((n) => (n === 'react' ? React : {})).__test.ContextMenu
  assert.ok(ContextMenu, 'ContextMenu 要导出到 __test')

  const tree = ContextMenu({
    x: 100, y: 100,
    testId: 't',
    onClose: noop,
    items: [
      { key: 'rename', label: '重命名', onSelect: () => fired.push('rename') },
      { key: 'delete', label: '删除', danger: true, onSelect: () => fired.push('delete') },
    ],
  })
  const buttons = walk(tree, (n) => n.type === 'button' && typeof n.props?.onClick === 'function')
  assert.equal(buttons.length, 2, '要渲染出两个菜单项')
  buttons[0].props.onClick({ stopPropagation: noop })
  assert.deepEqual(fired, ['rename'], '点「重命名」必须触发 onSelect')
  buttons[1].props.onClick({ stopPropagation: noop })
  assert.deepEqual(fired, ['rename', 'delete'], '点「删除」必须触发 onSelect')
})

test('★ ContextMenu：关闭逻辑按 target 判内外，不是"任何 mousedown 都关"', () => {
  // 旧实现会在捕获阶段无条件关闭，导致菜单先卸载、click 永远不触发
  assert.match(SOURCE, /function isInside\(target\)/, '要按 target 判断是否在菜单内')
  assert.match(SOURCE, /if \(isInside\(event && event\.target\)\) return/,
    '点在菜单内不能关，否则点菜单项没反应')
})

test('菜单项的 onClick 里先 onClose 再 onSelect，两个都要执行', () => {
  const start = SOURCE.indexOf('role: "menuitem"')
  assert.ok(start > 0)
  const body = SOURCE.slice(start, start + 400)
  const closeAt = body.indexOf('props.onClose')
  const selectAt = body.indexOf('item.onSelect')
  assert.ok(closeAt > 0 && selectAt > 0, '两个回调都要有')
  assert.ok(closeAt < selectAt, '先关菜单再执行动作')
})

// ── 集成测试侧：菜单项接到 rename / delete ─────────────────

test('★ 集成测试：菜单「重命名」接到 setFeaturePrompt(rename)', () => {
  const start = SOURCE.indexOf('featureCtx && featureCtx.name')
  const block = SOURCE.slice(start, start + 1400)
  assert.match(block, /testId: "feature-ctx-rename"/)
  assert.match(block, /setFeaturePrompt\(\{ mode: "rename"/,
    '「重命名」要打开 rename 弹窗')
})

test('★ 集成测试：菜单「删除」接到确认框', () => {
  const start = SOURCE.indexOf('featureCtx && featureCtx.name')
  const block = SOURCE.slice(start, start + 1400)
  assert.match(block, /testId: "feature-ctx-delete"/)
  assert.match(block, /setFeatureRemove\(/, '「删除」要打开确认框')
})

test('单元测试：菜单「重命名」接到 onRename，「删除」接到 onDelete', () => {
  const start = SOURCE.indexOf('ctxRow && ctxRow.row')
  const block = SOURCE.slice(start, start + 2000)
  // 用闭包捕获的 target（ContextMenu 的 onClick 会先 onClose 再 onSelect）
  assert.match(block, /props\.onRename\(target\.value\)/, '层级重命名要回传原值')
  assert.match(block, /props\.onDelete\(target\.value\)/, '删除要回传原值')
  assert.match(block, /props\.onRenameRow\(target\)/, '函数组重命名要走 onRenameRow')
  assert.match(block, /\}\)\(\s*ctxRow\.row\s*\)/, '要用参数按值捕获当前行')
})

test('删除确认框真的存在，且确认后调用 removeFeature', () => {
  assert.match(SOURCE, /featureRemove !== null/, '要有删除确认框')
  const start = SOURCE.indexOf('featureRemove !== null')
  const block = SOURCE.slice(start, start + 900)
  assert.match(block, /onConfirm: function \(\) \{ removeFeature\(featureRemove\.name\)/,
    '确认后要真的删')
  assert.match(block, /confirmTestId: "feature-remove-confirm"/)
})
