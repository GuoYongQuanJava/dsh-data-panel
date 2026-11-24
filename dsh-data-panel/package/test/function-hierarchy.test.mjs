import test, { after } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Readable } from 'node:stream'
const home = await mkdtemp(join(tmpdir(), 'dsh-function-'))
process.env.DSH_HOME = home
const { __test: api } = await import('../lib/index.js')
after(() => rm(home, { recursive: true, force: true }))
const base = { id: 'r1', caseId: 'TC-1', title: '折扣正常值', testType: 'functional', category: '旧分类', code: '', demo: false }

test('双类型兼容旧主类型，限制无效/过多类型，修改主类型不残留旧主类型', () => {
  assert.deepEqual(api.normalizeStored(base).testTypes, ['functional'])
  const saved = api.normalizePatch({ ...base, testTypes: ['functional', 'api', 'api'] }, base)
  assert.deepEqual(saved.testTypes, ['functional', 'api'])
  assert.equal(saved.testType, 'functional')
  // 纯编号（T001）已不再接受；标题由「被测函数+类型」派生，这里只验证类型合并。
  assert.deepEqual(api.normalizePatch({ ...base, title: '边界输入' }, saved).testTypes, ['functional', 'api'])
  assert.deepEqual(api.normalizePatch({ ...base, testType: 'boundary' }, base).testTypes, ['boundary'])
  assert.deepEqual(api.normalizePatch({ ...base, testTypes: ['functional'] }, saved).testTypes, ['functional'])
  assert.throws(() => api.normalizePatch({ ...base, testTypes: ['functional', 'api', 'boundary'] }, base), /最多选择两种/)
  assert.throws(() => api.normalizePatch({ ...base, testTypes: ['bad'] }, base), /有效测试类型/)
  assert.throws(() => api.normalizePatch({ ...base, testTypes: 'api' }, base), /有效测试类型/)
})
async function post(body) {
  const req = Readable.from([JSON.stringify({ sessionId: 'functions-test', ...body })])
  req.method = 'POST'; req.url = '/data-panel/api'; req.headers = {}
  let status, data
  await api.handle(req, { writeHead(code) { status = code }, end(raw) { data = JSON.parse(raw) } })
  return { status, ...data }
}
test('业务函数持久化，局部编辑不丢失，空值可解除，不从旧分类猜测', () => {
  assert.equal(api.normalizeStored(base).subjectFunction, '')
  const saved = api.normalizeStored({ ...base, subjectFunction: ' src/order.ts::Order.discount ' })
  assert.equal(saved.subjectFunction, 'src/order.ts::Order.discount')
  assert.equal(api.normalizePatch({ title: '编辑', testType: 'functional' }, saved).subjectFunction, saved.subjectFunction)
  assert.equal(api.normalizePatch({ ...saved, subjectFunction: '' }, saved).subjectFunction, '')
})
test('任意 skill 创建的用例按统一字段保存，批量关联原子写入并保留旧数据', async () => {
  await api.persist([base], false, 'functions-test', ['旧分类'])
  const created = await post({ op: 'create', record: { title: 'VIP折扣', testType: 'boundary', testTypes: ['boundary', 'api'], subjectFunction: 'Order.discount' } })
  assert.equal(created.status, 200)
  assert.equal(created.record.subjectFunction, 'Order.discount')
  assert.deepEqual(created.record.testTypes, ['boundary', 'api'])
  const changedType = await post({ op: 'update', id: created.record.id, patch: { testType: 'logic' } })
  assert.deepEqual(changedType.record.testTypes, ['logic', 'api'])
  const invalid = await post({ op: 'assignFunction', ids: ['r1', 'missing'], subjectFunction: 'bad' })
  assert.equal(invalid.status, 404)
  assert.equal((await api.readStore('functions-test')).records[0].subjectFunction, '')
  const result = await post({ op: 'assignFunction', ids: ['r1', created.record.id], subjectFunction: ' Order.discount ' })
  assert.equal(result.status, 200)
  assert.equal(result.moved, 2)
  let store = await api.readStore('functions-test')
  assert.ok(store.records.every(r => r.subjectFunction === 'Order.discount'))
  assert.equal(store.records[0].category, '旧分类')
  assert.deepEqual(store.categories, ['旧分类'])
  assert.equal((await post({ op: 'assignFunction', ids: ['r1'] })).status, 400)
  assert.equal((await api.readStore('functions-test')).records[0].subjectFunction, 'Order.discount')
  await post({ op: 'update', id: 'r1', patch: { title: '修改名称' } })
  assert.equal((await api.readStore('functions-test')).records[0].subjectFunction, 'Order.discount')
  const tooLong = await post({ op: 'assignFunction', ids: ['r1'], subjectFunction: 'x'.repeat(241) })
  assert.equal(tooLong.status, 400)
  await post({ op: 'assignFunction', ids: ['r1'], subjectFunction: '' })
  store = await api.readStore('functions-test')
  assert.equal(store.records[0].subjectFunction, '')
})
test('导出业务函数不覆盖测试入口，清空关联不复活旧导出值', async () => {
  const file = join(home, 'cases.json')
  const cases = await api.exportCases({ records: [{ ...base, testTypes: ['functional', 'api'], subjectFunction: 'Order.discount', code: 'def test_discount(): pass' }] }, file)
  assert.equal(cases[0].subjectFunction, 'Order.discount')
  assert.equal(cases[0].testFunc, 'test_discount')
  assert.deepEqual(cases[0].testTypes, ['functional', 'api'])
  await api.exportCases({ records: [{ ...base, subjectFunction: '' }] }, file)
  const exported = JSON.parse(await readFile(file, 'utf8'))
  assert.equal(exported.cases[0].subjectFunction, '')
  assert.equal(exported.cases[0].testFunc, 'test_discount')
})
