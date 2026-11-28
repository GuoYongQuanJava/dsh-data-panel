/**
 * 用用户截图里的真实会话数据，验证右键菜单真的能渲染。
 *
 * 加载的是 **profile 里的 client.js**（DSH 实际运行的那份），
 * 数据是 session-c04f0be9 的真实 7 条用例 / 4 个功能项。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import vm from 'node:vm'

const PROFILE_CLIENT = join(process.env.USERPROFILE,
  '.dsh', 'profiles', 'desktop', 'node_modules', 'dsh-data-panel', 'lib', 'client.js')
const DATA_ROOT = 'F:\\yihuo\\.dsh\\test-sessions\\session-c04f0be9-c487-4578-bdaf-c32b37b0445d\\integration'

const noop = () => {}
const readJson = (p) => JSON.parse(readFileSync(p, 'utf8').replace(/^\uFEFF/, ''))

/** 真实磁盘数据 → loadIntegration 的后端响应形状。 */
function readBackend() {
  const cv = join(DATA_ROOT, 'case-versions')
  const sv = join(DATA_ROOT, 'step-versions')
  const caseIdx = readJson(join(cv, 'index.json'))
  const stepIdx = readJson(join(sv, 'index.json'))
  const ac = caseIdx.activeVersion
  const as = stepIdx.activeVersion
  const casesDoc = readJson(join(cv, ac.replace(/\./g, '_'), 'cases.json'))
  const featDoc = readJson(join(cv, ac.replace(/\./g, '_'), 'features.json'))
  const stepsDoc = readJson(join(sv, as.replace(/\./g, '_'), 'steps.json'))
  const cases = Array.isArray(casesDoc) ? casesDoc : (casesDoc.cases || [])
  const features = Array.isArray(featDoc) ? featDoc : (featDoc.features || [])
  const stepCases = stepsDoc.cases || []
  return {
    caseIdx, stepIdx, ac, as, cases, features, stepCases,
  }
}

/**
 * 构造 initialSeed。
 *
 * ★ initialSeed 是「已归一化」的 seed，**不经过** loadIntegration 里
 * featureId → features[].name → scenario 那段转换，所以要自己补 scenario。
 * 线上走 fetch 时由 loadIntegration 补，测试里必须复刻。
 */
function buildSeed() {
  const r = readBackend()
  const featureName = {}
  for (const f of r.features) featureName[f.id] = f.name || f.id
  const stepByCaseId = {}
  for (const item of r.stepCases) {
    if (item && typeof item.caseId === 'string') {
      stepByCaseId[item.caseId] = Array.isArray(item.steps) ? item.steps : []
    }
  }
  const records = r.cases.map((item, i) => Object.assign({}, item, {
    id: item.id || item.caseId || ('case-' + i),
    scenario: item.scenario || featureName[item.featureId] || '',
    steps: (Array.isArray(item.steps) && item.steps.length) ? item.steps : (stepByCaseId[item.caseId] || []),
    records: [],
    status: 'none',
    lastRunAt: '',
  }))
  return {
    versions: r.caseIdx.versions || [],
    activeVersion: r.ac,
    byVersion: { [r.ac]: records },
    features: r.features,
  }
}

function makeHarness(clientPath) {
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
  vm.runInNewContext(readFileSync(clientPath, 'utf8'), {
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

const harness = makeHarness(PROFILE_CLIENT)
const api = harness.api
const SEED = buildSeed()

test('profile 里的 client.js 是新版（含右键菜单）', () => {
  const src = readFileSync(PROFILE_CLIENT, 'utf8')
  assert.match(src, /dp-ctx-menu/)
  assert.match(src, /featureCtx && featureCtx\.name/)
  assert.match(src, /ctxRow && ctxRow\.row/)
})

test('真实数据：侧栏渲染出 4 个功能项', () => {
  console.log('  真实用例数:', SEED.byVersion[SEED.activeVersion].length)
  console.log('  真实功能项:', SEED.features.map((f) => f.name).join(' / '))
  const tree = harness.render(api.IntegrationPanel, { initialSeed: SEED, active: true, sessionId: 's' })
  const rows = walk(tree, (n) => typeof n.props?.['data-it'] === 'string' && n.props['data-it'].startsWith('scenario-'))
  const names = rows.map((r) => r.props['data-it'].replace('scenario-', ''))
  console.log('  侧栏渲染出:', names.join(' / '))
  assert.ok(rows.length >= 5, '要有「全部用例」+ 4 个功能项，实际: ' + names.join(','))
})

test('★ 真实数据：每个功能项都能右键，「全部用例」不能', () => {
  const tree = harness.render(api.IntegrationPanel, { initialSeed: SEED, active: true, sessionId: 's' })
  const rows = walk(tree, (n) => typeof n.props?.['data-it'] === 'string' && n.props['data-it'].startsWith('scenario-'))
  const results = rows.map((r) => ({
    name: r.props['data-it'].replace('scenario-', ''),
    hasCtx: typeof r.props.onContextMenu === 'function',
  }))
  console.log('  右键响应:', results.map((r) => r.name + '=' + (r.hasCtx ? '可右键' : '否')).join('  '))

  const all = results.find((r) => r.name === '全部用例')
  assert.ok(all, '要有「全部用例」')
  assert.equal(all.hasCtx, false, '「全部用例」不能右键')

  const real = results.filter((r) => r.name !== '全部用例')
  assert.equal(real.length, 4, '4 个功能项都要在')
  const broken = real.filter((r) => !r.hasCtx)
  assert.equal(broken.length, 0, '右键无效的功能项: ' + broken.map((r) => r.name).join('、'))
})

test('右键回调能拿到坐标并阻止原生菜单', () => {
  const tree = harness.render(api.IntegrationPanel, { initialSeed: SEED, active: true, sessionId: 's' })
  const rows = walk(tree, (n) => typeof n.props?.['data-it'] === 'string' && n.props['data-it'].startsWith('scenario-'))
  const target = rows.find((r) => typeof r.props.onContextMenu === 'function' && r.props['data-it'] !== 'scenario-全部用例')
  assert.ok(target, '要有可右键的功能项')
  let prevented = false
  target.props.onContextMenu({ preventDefault: () => { prevented = true }, stopPropagation: noop, clientX: 388, clientY: 266 })
  assert.equal(prevented, true, '必须 preventDefault')
  console.log('  右键目标:', target.props['data-it'], '已阻止原生菜单')
})

test('单元测试侧栏：层级行与函数组能右键，「全部用例」不能', () => {
  const tree = harness.render(api.CategorySidebar, {
    rows: [
      { key: '__all__', value: '', label: '全部用例', count: 3, kind: 'all' },
      { key: 'layer:正常', value: '正常', label: '正常', count: 2, kind: 'layer' },
      { key: 'function:x', value: 'src/a.js::f', label: 'src/a.js::f', count: 1, kind: 'function' },
    ],
    activeCategory: '', activeLayer: '', pickedCount: 0,
    onSelect: noop, onCreate: noop, onRename: noop, onRenameRow: noop, onDelete: noop,
    onContextMenuRow: noop,
  })
  const cats = walk(tree, (n) => typeof n.props?.className === 'string' && n.props.className.includes('dp-cat'))
  const ctxable = cats.filter((n) => typeof n.props.onContextMenu === 'function')
  console.log('  可右键行数:', ctxable.length)
  assert.equal(ctxable.length, 2, '层级行与函数组行都要能右键')
})