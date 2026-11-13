/**
 * dsh-data-panel — host half.
 *
 * Owns a small JSON test-case store and exposes it over one same-origin route:
 *   GET  /data-panel/api            → { ok, records, demoCount, seeded }
 *   POST /data-panel/api { op, … }  → create / update / delete / clearDemo
 *
 * A record is one test case:
 *   caseId      用例标识 (e.g. GN-ZZKZ-RINGBUFF-T001)
 *   title       用例名称 (required)
 *   testType    功能测试 / 边界测试 / 性能测试 / 异常测试 / 兼容性测试
 *   description 测试说明
 *   input       输入
 *   expected    预期输出
 *
 * The store lives under <DSH_HOME>/plugin-data/dsh-data-panel/records.json so
 * it survives page reloads, plugin upgrades and app restarts without touching
 * the workspace.
 */
import { randomUUID } from 'node:crypto'
import { mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'

export const name = 'dsh-data-panel'
export const inject = ['webServer']

const PLUGIN = 'dsh-data-panel'
const API_PATH = '/data-panel/api'
const STORE_VERSION = 2
const MAX_BODY = 1024 * 1024
const MAX_CASE_ID = 80
const MAX_TITLE = 200
const MAX_DESCRIPTION = 2000
const MAX_INPUT = 4000
const MAX_EXPECTED = 4000
const TEST_TYPES = new Set(['functional', 'boundary', 'performance', 'exception', 'compat'])

/** Single write lane: read-modify-write operations never interleave. */
let lane = Promise.resolve()

function serial(task) {
  const next = lane.then(task, task)
  lane = next.then(() => undefined, () => undefined)
  return next
}

function dshHome() {
  return process.env.DSH_HOME || join(homedir(), '.dsh')
}

function dataDir() {
  return join(dshHome(), 'plugin-data', PLUGIN)
}

function dataFile() {
  return join(dataDir(), 'records.json')
}

function bad(status, message) {
  const error = new Error(message)
  error.status = status
  return error
}

function text(value, max) {
  return typeof value === 'string' ? value.trim().slice(0, max) : ''
}

function isoOrNow(value) {
  if (typeof value === 'string' && Number.isFinite(Date.parse(value))) return value
  return new Date().toISOString()
}

function isoAgo(hours) {
  return new Date(Date.now() - hours * 3600 * 1000).toISOString()
}

function newCaseId() {
  return `TC-${randomUUID().replace(/-/g, '').slice(0, 8).toUpperCase()}`
}

/** First-run test cases, marked `demo` so the UI can label them visibly. */
function seedRecords() {
  const rows = [
    [
      'GN-ZZKZ-RINGBUFF-T001',
      'RingBuffer功能测试',
      'functional',
      '初始化一个新的环形缓冲区对象，验证初始状态下 size、head、tail 是否符合预期。',
      'm_totalCapacity=5',
      'm_size=0',
    ],
    [
      'BJ-ZZKZ-RINGBUFF-T001',
      'RingBuffer边界测试',
      'boundary',
      '容量取 0 初始化，验证边界条件下对象的处理策略是否给出明确报错。',
      'm_totalCapacity=0',
      'm_size=编译报错',
    ],
    [
      'GN-ZZKZ-PUSH-T001',
      'push功能测试',
      'functional',
      '将元素存入缓冲区，验证插入后的状态变化和容量计数是否正确。',
      'm_totalCapacity=2, p_id=0, p_value=Test0',
      'm_size=1, m_head=2, m_tail=1',
    ],
    [
      'JK-ZZKZ-PUSH-T002',
      'push满容量测试',
      'boundary',
      '缓冲区已满后继续 push，验证满容量时的覆盖顺序与读写指针推进。',
      'm_totalCapacity=2，已存 2 个元素',
      'm_size=2, m_head=1, m_tail=1',
    ],
    [
      'GN-ZZKZ-CLEAR-T001',
      'clearAll功能测试',
      'functional',
      '清空缓冲区，验证头部、尾部与长度归零且内存不被释放。',
      'clearAll()',
      'm_size=0, m_head=0, m_tail=0',
    ],
    [
      'BJ-ZZKZ-POP-T001',
      'pop边界测试',
      'boundary',
      '空缓冲区执行 pop，验证下溢时不再修改状态。',
      'm_totalCapacity=3, m_size=0',
      '返回失败，m_size 保持 0',
    ],
    [
      'GN-ZZKZ-ITER-T001',
      '迭代器遍历测试',
      'functional',
      '遍历缓冲区中的全部元素，验证顺序与写入顺序一致。',
      'm_totalCapacity=4，依次 push A、B、C',
      '遍历输出 A → B → C',
    ],
  ]
  return rows.map(function (row, index) {
    return {
      id: `demo-${index + 1}`,
      caseId: row[0],
      title: row[1],
      testType: row[2],
      description: row[3],
      input: row[4],
      expected: row[5],
      demo: true,
      createdAt: isoAgo(36 + index * 2),
      updatedAt: isoAgo(8 + index * 2),
    }
  })
}

function normalizeStored(input) {
  if (input === null || typeof input !== 'object' || typeof input.id !== 'string' || input.id === '') return null
  return {
    id: input.id.slice(0, 120),
    caseId: text(input.caseId, MAX_CASE_ID),
    title: text(input.title, MAX_TITLE) || '未命名用例',
    testType: TEST_TYPES.has(input.testType) ? input.testType : 'functional',
    description: text(input.description, MAX_DESCRIPTION),
    input: text(input.input, MAX_INPUT),
    expected: text(input.expected, MAX_EXPECTED),
    demo: input.demo === true,
    createdAt: isoOrNow(input.createdAt),
    updatedAt: isoOrNow(input.updatedAt),
  }
}

function normalizePatch(input, existing) {
  const title = text(input.title, MAX_TITLE)
  if (!title) throw bad(400, '用例名称不能为空')
  return {
    ...existing,
    caseId: text(input.caseId, MAX_CASE_ID),
    title,
    testType: TEST_TYPES.has(input.testType) ? input.testType : existing.testType,
    description: text(input.description, MAX_DESCRIPTION),
    input: text(input.input, MAX_INPUT),
    expected: text(input.expected, MAX_EXPECTED),
    updatedAt: new Date().toISOString(),
  }
}

async function quarantine(suffix) {
  try {
    await rename(dataFile(), `${dataFile()}.${suffix}-${Date.now()}`)
  } catch {
    // Nothing to preserve.
  }
}

async function persist(records, seeded) {
  await mkdir(dataDir(), { recursive: true })
  const payload = JSON.stringify({ version: STORE_VERSION, seeded: seeded === true, records }, null, 2)
  const temp = join(dataDir(), `.records.${process.pid}.${Date.now()}.tmp`)
  await writeFile(temp, payload, 'utf8')
  try {
    await rename(temp, dataFile())
  } catch {
    await writeFile(dataFile(), payload, 'utf8')
    try {
      await unlink(temp)
    } catch {
      // Temp file already gone.
    }
  }
}

async function readStore() {
  try {
    const raw = await readFile(dataFile(), 'utf8')
    const parsed = JSON.parse(raw)
    // A store written by the previous record schema (v1) is kept aside instead
    // of being coerced: those records were notes, not test cases.
    if (parsed?.version !== STORE_VERSION) {
      await quarantine('v1')
      const records = seedRecords()
      await persist(records, true)
      return { records, seeded: true }
    }
    const source = Array.isArray(parsed?.records) ? parsed.records : []
    const records = source.map(normalizeStored).filter(Boolean)
    return { records, seeded: parsed?.seeded === true }
  } catch (error) {
    if (error?.code === 'ENOENT') {
      const records = seedRecords()
      await persist(records, true)
      return { records, seeded: true }
    }
    if (error instanceof SyntaxError) {
      await quarantine('corrupt')
      const records = seedRecords()
      await persist(records, true)
      return { records, seeded: true }
    }
    throw error
  }
}

async function readJson(req) {
  const chunks = []
  let total = 0
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    total += buffer.length
    if (total > MAX_BODY) throw bad(413, '请求体过大')
    chunks.push(buffer)
  }
  if (chunks.length === 0) return {}
  let parsed
  try {
    parsed = JSON.parse(Buffer.concat(chunks).toString('utf8'))
  } catch {
    throw bad(400, '请求体不是合法 JSON')
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw bad(400, '请求体必须是 JSON 对象')
  }
  return parsed
}

function send(res, status, body) {
  if (res.headersSent) {
    res.end()
    return
  }
  const payload = JSON.stringify(body)
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'content-length': Buffer.byteLength(payload),
  })
  res.end(payload)
}

function demoCount(records) {
  return records.reduce((total, record) => total + (record.demo ? 1 : 0), 0)
}

function sortRecords(records) {
  return records.slice().sort((left, right) => String(right.updatedAt).localeCompare(String(left.updatedAt)))
}

async function handle(req, res) {
  try {
    if (req.method === 'GET') {
      const store = await serial(readStore)
      send(res, 200, {
        ok: true,
        records: sortRecords(store.records),
        demoCount: demoCount(store.records),
        seeded: store.seeded,
      })
      return
    }

    if (req.method !== 'POST') {
      send(res, 405, { ok: false, error: '只支持 GET 和 POST' })
      return
    }

    const body = await readJson(req)
    const op = typeof body.op === 'string' ? body.op : ''

    if (op === 'create') {
      const record = await serial(async () => {
        const store = await readStore()
        const now = new Date().toISOString()
        const created = {
          ...normalizePatch({ ...(body.record || {}), title: body.record?.title }, {
            caseId: '',
            title: '',
            testType: 'functional',
            description: '',
            input: '',
            expected: '',
            createdAt: now,
          }),
          id: `rec_${randomUUID().replace(/-/g, '').slice(0, 12)}`,
          demo: false,
          createdAt: now,
        }
        if (!created.caseId) created.caseId = newCaseId()
        store.records.push(created)
        await persist(store.records, store.seeded)
        return created
      })
      send(res, 200, { ok: true, record })
      return
    }

    if (op === 'update') {
      const id = text(body.id, 120)
      if (!id) throw bad(400, '缺少记录 id')
      const record = await serial(async () => {
        const store = await readStore()
        const index = store.records.findIndex((item) => item.id === id)
        if (index === -1) throw bad(404, '记录不存在')
        const existing = store.records[index]
        const updated = {
          ...normalizePatch({ ...existing, ...(body.patch || body.record || {}) }, existing),
          demo: false,
        }
        store.records[index] = updated
        await persist(store.records, store.seeded)
        return updated
      })
      send(res, 200, { ok: true, record })
      return
    }

    if (op === 'delete') {
      const id = text(body.id, 120)
      if (!id) throw bad(400, '缺少记录 id')
      await serial(async () => {
        const store = await readStore()
        const next = store.records.filter((item) => item.id !== id)
        if (next.length === store.records.length) throw bad(404, '记录不存在')
        await persist(next, store.seeded)
      })
      send(res, 200, { ok: true })
      return
    }

    if (op === 'clearDemo') {
      const removed = await serial(async () => {
        const store = await readStore()
        const next = store.records.filter((item) => !item.demo)
        const count = store.records.length - next.length
        await persist(next, false)
        return count
      })
      send(res, 200, { ok: true, removed })
      return
    }

    throw bad(400, `未知操作：${op || '(空)'}`)
  } catch (error) {
    const status = Number.isInteger(error?.status) ? error.status : 500
    send(res, status, { ok: false, error: error instanceof Error ? error.message : '服务内部错误' })
  }
}

export function apply(ctx) {
  ctx.effect(
    () =>
      ctx.webServer.register({
        kind: 'exact',
        path: API_PATH,
        handler: handle,
      }),
    'dsh-data-panel: records api',
  )
  try {
    ctx.logger?.info?.('dsh-data-panel: records at %s', dataFile())
  } catch {
    // Logger is optional.
  }
}

/** Test-only surface (not part of the plugin contract). */
export const __test = {
  seedRecords,
  normalizeStored,
  dataDir,
  dataFile,
  readStore,
  persist,
}
