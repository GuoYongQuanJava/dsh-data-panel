/**
 * 侧边栏右键重命名：单元测试「用例层级」与集成测试「功能项」。
 *
 * 用户 2026-11-28 需求：
 *   · 两个侧边栏里，除了「全部用例」那一行，其余层级/功能项右键可重命名
 *   · 集成测试改名后，用例页与步骤页要同时生效
 *
 * 这一组测试盯的是「行为」而不是「实现细节」：
 * 改名的关键风险是把 id 改掉（用例靠 featureId 挂靠），所以专门盯住这一点。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const SOURCE = readFileSync(
  fileURLToPath(new URL('../lib/client.js', import.meta.url)), 'utf8')
const SERVER = readFileSync(
  fileURLToPath(new URL('../lib/index.js', import.meta.url)), 'utf8')

// ── 单元测试侧：用例层级 ────────────────────────────────

test('单元测试侧栏：层级行与函数组行都挂了右键菜单', () => {
  // 「全部用例」分支先行 return，右键只挂在其余行上
  assert.match(SOURCE, /onContextMenu:\s*menuable/,
    '侧栏行要有 onContextMenu')
  assert.match(SOURCE, /var menuable = row\.value !== "" && row\.value !== null/,
    '「全部用例」的 value 是空串，必须被排除在右键外')
  assert.match(SOURCE, /props\.onContextMenuRow\(row, event\.clientX, event\.clientY\)/,
    '右键要带上鼠标坐标，菜单按坐标定位')
})

test('单元测试侧栏：onRenameRow 按 kind 区分层级与函数组', () => {
  assert.match(SOURCE, /onRenameRow:\s*function \(row\)/,
    '要传 onRenameRow 给 CategorySidebar')
  assert.match(SOURCE, /kind:\s*row\.kind === "function"\s*\?\s*"function"\s*:\s*"layer"/,
    '必须区分函数组与自定义层级，二者改名调用不同接口')
})

test('单元测试侧栏：函数组改名走 renameFunction，层级走 renameCategory', () => {
  assert.match(SOURCE, /pending\.kind === "function"[\s\S]{0,220}?store\.renameFunction/,
    '函数组要调 store.renameFunction')
  assert.match(SOURCE, /store\.renameCategory\(pending\.from, name\)/,
    '层级仍走 renameCategory')
})

test('单元测试侧栏：函数组不被「默认」这个层级名限制拦住', () => {
  assert.match(SOURCE, /skipLayerChecks/,
    '要有 skipLayerChecks 开关')
  assert.match(SOURCE, /!props\.skipLayerChecks && name === "默认"/,
    '函数组重命名不该被「默认」拦住（那是层级的保留名）')
})

test('store.renameFunction 只改 subjectFunction，不动其它字段', () => {
  assert.match(SOURCE, /renameFunction:\s*function \(from, to, forcedSessionId\)/,
    'store 要有 renameFunction')
  assert.match(
    SOURCE,
    /subjectFunctionOf\(record\) === from[\s\S]{0,120}?Object\.assign\(\{\}, record, \{ subjectFunction: target \}\)/,
    '只替换 subjectFunction，保留记录其它字段')
})

test('后端有 renameFunction，且按 subjectFunction 批量改', () => {
  assert.match(SERVER, /op === 'renameFunction'/, '要有 renameFunction 接口')
  assert.match(SERVER, /normalizeSubjectFunction\(record\.subjectFunction\) !== from/,
    '按 subjectFunction 匹配要改的记录')
  assert.match(SERVER, /if \(count === 0\) throw bad\(404/,
    '一条都没改到要报 404，不能静默成功')
})

// ── 集成测试侧：功能项 ──────────────────────────────────

test('集成测试侧栏：功能项挂了右键菜单，且排除「全部用例」', () => {
  assert.match(SOURCE, /var menuable = row\.name !== IT_SCENARIOS_ALL/,
    '「全部用例」必须排除')
  assert.match(SOURCE, /setFeatureCtx\(\{ name: row\.name, count: row\.count, x: event\.clientX/,
    '右键要打开功能项菜单（带坐标）')
})

test('功能项改名只换 name，绝不动 id（否则用例全断链）', () => {
  // 定位 renameFeature 函数体
  const start = SOURCE.indexOf('function renameFeature(')
  assert.ok(start > 0, '要有 renameFeature')
  const body = SOURCE.slice(start, start + 3000)
  assert.match(body, /Object\.assign\(\{\}, item, \{ name: newName \}\)/,
    '改名要保留条目其它字段（id / code / stage），只覆盖 name')
  assert.doesNotMatch(body, /id:\s*newId,\s*name:\s*newName/,
    '不能给要改名的条目重新分配 id')
  assert.match(body, /writeFeatures\(nextFeatures\)/,
    '要走 writeFeatures 落盘，不能按名字重建（重建会重分配 id）')
})

test('功能项改名后重新拉一次数据，让两个页面同时换名', () => {
  const start = SOURCE.indexOf('function writeFeatures(')
  assert.ok(start > 0, '要有 writeFeatures')
  const body = SOURCE.slice(start, start + 2000)
  assert.match(body, /loadIntegration\(true\)/,
    '写盘后必须重新拉，featureId→name 映射变了，用例页与步骤页才会同步换名')
})

test('改名时当前停在该功能项上要跟着切到新名字', () => {
  const start = SOURCE.indexOf('function renameFeature(')
  const body = SOURCE.slice(start, start + 3000)
  assert.match(body, /previous === oldName \? newName : previous/,
    '不跟着切会把列表筛成空')
})

test('用例页与步骤页的分组名都是派生的，所以改 features[].name 即可同步', () => {
  assert.match(SOURCE, /next\.scenario = featureName\[next\.featureId\]/,
    'scenario 由 featureId 查 features 得到，不是存死在用例里')
})

test('功能项弹窗支持 rename 模式', () => {
  assert.match(SOURCE, /var renaming = props\.mode === "rename"/,
    'FeaturePrompt 要识别 rename 模式')
  assert.match(SOURCE, /renaming \? "重命名功能项" : "新建功能项"/,
    '标题要区分')
})

test('右键改名时先拦重名，避免出现两个同名功能项', () => {
  const start = SOURCE.indexOf('function renameFeature(')
  const body = SOURCE.slice(start, start + 3000)
  assert.match(body, /featureNames\.indexOf\(newName\) !== -1/,
    '重名要拦下')
})