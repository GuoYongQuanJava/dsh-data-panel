import test, { after } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { scopeInventory, assessScope, scanSourceFiles } from '../lib/scope.js'

const root = mkdtempSync(join(tmpdir(), 'dsh-scope-'))
after(() => rmSync(root, { recursive: true, force: true }))
function fixture() {
  const project = mkdtempSync(join(root, 'project-'))
  mkdirSync(join(project, 'src'))
  writeFileSync(join(project, 'src/a.cpp'), 'int foo() { return 1; }\n')
  return project
}
const cases = [{ caseId: 'TC-1', subjectFunction: 'src/a.cpp::foo' }]

test('清单扫描真实源码，不因模型未纳入就漏掉整个文件', () => {
  const project = fixture()
  const inventory = scopeInventory(project, ['src'])
  assert.equal(inventory.files.length, 1)
  assert.equal(inventory.files[0].status, 'deferred')
  writeFileSync(join(project, 'src/new.cpp'), 'int omitted() { return 2; }')
  const result = assessScope(project, inventory, cases)
  assert.equal(result.summary.scannedFiles, 2)
  assert.ok(result.warnings.some((text) => text.includes('源码未列入清单：src/new.cpp')))
})

test('文件/函数/用例关联与源码哈希核验；单条范围不冒充全量执行', () => {
  const project = fixture()
  const inventory = scopeInventory(project, ['src'])
  inventory.files[0] = { ...inventory.files[0], status: 'tested', functions: [{ subjectFunction: cases[0].subjectFunction, caseIds: ['TC-1'] }] }
  const result = assessScope(project, inventory, cases, ['TC-1'])
  assert.equal(result.status, 'reviewed')
  assert.equal(result.summary.linkedFunctions, 1)
  assert.deepEqual(result.selectedCaseIds, ['TC-1'])
  writeFileSync(join(project, 'src/a.cpp'), 'int foo() { return 3; }')
  assert.ok(assessScope(project, inventory, cases).warnings.some((text) => text.includes('SHA256')))
  inventory.files[0].functions[0].caseIds = ['unknown']
  assert.ok(assessScope(project, inventory, cases).warnings.some((text) => text.includes('关联不一致')))
})

test('排除须有命令、退出码、日志证据；将证据摘要绑定本次快照', () => {
  const project = fixture()
  const inventory = scopeInventory(project, ['src'])
  inventory.files[0].status = 'excluded'
  inventory.files[0].reason = '独立编译缺少客户专用依赖'
  assert.ok(assessScope(project, inventory, []).warnings.some((text) => text.includes('排除项缺少')))
  writeFileSync(join(project, 'compile.log'), 'fatal error: vendor.h not found')
  inventory.files[0].proof = { command: 'cl /c src/a.cpp', exitCode: 2, logFile: 'compile.log' }
  const result = assessScope(project, inventory, [])
  assert.equal(result.status, 'reviewed')
  assert.match(result.proofEvidence[0].content, /vendor.h/)
  assert.equal(result.proofEvidence[0].sha256.length, 64)
  writeFileSync(join(project, 'compile.log'), 'later change')
  assert.match(result.proofEvidence[0].content, /vendor.h/)
})

test('缺少清单、错误格式、越界扫描均明确告警', () => {
  const project = fixture()
  assert.equal(assessScope(project, null, cases).status, 'missing')
  assert.equal(assessScope(project, {}, cases).status, 'invalid')
  assert.throws(() => scanSourceFiles(project, ['..']), /项目内/)
})

test('排除目录按完整路径段匹配，避免 src/app 误排除 src/application', () => {
  const project = fixture()
  mkdirSync(join(project, 'src/app'))
  mkdirSync(join(project, 'src/application'))
  writeFileSync(join(project, 'src/app/a.cpp'), 'int bar() { return 1; }')
  writeFileSync(join(project, 'src/application/b.cpp'), 'int baz() { return 2; }')
  const inventory = scopeInventory(project, ['src'], ['src/app'])
  assert.equal(inventory.excludeDirs.length, 1)
  assert.equal(inventory.excludeDirs[0], 'src/app')
  const paths = inventory.files.map(f => f.path)
  // src/app 被排除，不应出现
  assert.ok(!paths.some(p => p.startsWith('src/app/')))
  // src/application 不应被误排除
  assert.ok(paths.some(p => p.startsWith('src/application/')))
})

test('被排除目录本身就是 sourceRoots 时也不得扫描', () => {
  const project = fixture()
  mkdirSync(join(project, 'lib'))
  writeFileSync(join(project, 'lib/x.cpp'), 'int x() { return 1; }')
  // 根与排除完全相同：整棵跳过
  assert.deepEqual(scopeInventory(project, ['lib'], ['lib']).files, [])
  // 根就是排除的上级目录：子目录被跳，兄弟目录保留
  writeFileSync(join(project, 'src/keep.cpp'), 'int k() { return 1; }')
  const kept = scopeInventory(project, ['.'], ['lib']).files.map(f => f.path)
  assert.ok(!kept.some(p => p.startsWith('lib/')))
  assert.ok(kept.includes('src/keep.cpp'))
})

test('多个扫描根中命中排除的那个整棵跳过', () => {
  const project = fixture()
  mkdirSync(join(project, 'lib'))
  writeFileSync(join(project, 'lib/y.cpp'), 'int y() { return 1; }')
  const paths = scopeInventory(project, ['lib', 'src'], ['lib']).files.map(f => f.path)
  assert.ok(!paths.some(p => p.startsWith('lib/')))
  assert.ok(paths.includes('src/a.cpp'))
})

test('排除目录必须在项目内，越界拒绝', () => {
  const project = fixture()
  assert.throws(() => scanSourceFiles(project, ['src'], ['..']), /项目内/)
})

test('assessScope 返回 rawWarnings 保留完整告警', () => {
  const project = fixture()
  writeFileSync(join(project, 'src/unlisted.cpp'), 'int orphan() { return 1; }')
  const inventory = scopeInventory(project, ['src'])
  const result = assessScope(project, inventory, cases)
  assert.ok(Array.isArray(result.rawWarnings), 'rawWarnings 必须是数组')
  assert.ok(result.rawWarnings.length >= result.warnings.length, 'rawWarnings 不少于折叠后的 warnings')
})

test('scopeInventory 记录 excludeDirs 到输出', () => {
  const project = fixture()
  const inventory = scopeInventory(project, ['src'], ['src/app', 'third_party'])
  assert.deepEqual(inventory.excludeDirs, ['src/app', 'third_party'])
  assert.ok(inventory.sourceRoots.includes('src'))
})
