/**
 * dsh-data-panel — host half.
 *
 * Owns a small JSON test-case store and exposes it over same-origin routes:
 *   GET  /data-panel/api             → { ok, records, demoCount, seeded }
 *   POST /data-panel/api { op, … }   → create / update / delete / clearDemo
 *   POST /data-panel/run/prepare     → 准备一次执行（导出用例 + 生成 runId + 返回命令）
 *   GET  /data-panel/run/latest      → 该会话/该用例最近一次执行
 *   GET  /data-panel/run/log         → 某次执行的原始日志
 *   GET  /data-panel/run/result      → 某次执行的结构化结果
 *
 * 会话资产（用例 / 测试代码 / 日志 / 报告）全部放在项目内：
 *   <项目>/.dsh/test-sessions/<sessionId>/
 * 面板记录本身仍在 DSH_HOME，执行前会把它导出成该目录的 cases.json，
 * 所以“你看到的用例”就是“这次跑的用例”。
 */
import { createHash, randomUUID } from 'node:crypto'
import { mkdir, readFile, readdir, rename, stat, unlink, writeFile } from 'node:fs/promises'
import { existsSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, isAbsolute, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'


export const name = 'dsh-data-panel'
export const inject = ['webServer', 'sessions']

const PLUGIN = 'dsh-data-panel'
const API_PATH = '/data-panel/api'

/** apply 时保存的宿主上下文（拿 workingDirectory 这类可选服务用）。 */
let ctxRef = null
/** 会话服务：用来自己确定会话的项目目录，不信任请求里的 cwd。 */
let sessions = null
const STORE_VERSION = 3
const MAX_BODY = 1024 * 1024
const MAX_CASE_ID = 80
const MAX_TITLE = 200
const MAX_DESCRIPTION = 2000
const MAX_INPUT = 4000
const MAX_EXPECTED = 4000
const MAX_CODE = 20000
/**
 * Where the case's subject lives in the repository, as `path:line`
 * (`path#L12`, `path#L12-20` also accepted). Read by the client's
 * "查看代码" action to jump straight to the covered source.
 */
const MAX_CODE_REF = 200

const TEST_TYPES = new Set(['functional', 'boundary', 'performance', 'exception', 'compat'])

/** 会话资产（用例 / 测试代码 / 日志 / 报告）在项目内的位置。 */
const SESSION_ASSET_DIR = join('.dsh', 'test-sessions')
const RUN_PREPARE_PATH = '/data-panel/run/prepare'
const RUN_LATEST_PATH = '/data-panel/run/latest'
const RUN_LOG_PATH = '/data-panel/run/log'
const RUN_RESULT_PATH = '/data-panel/run/result'
const RUN_REPORT_PATH = '/data-panel/run/report'
const MAX_RUN_LOG = 4 * 1024 * 1024
const RUNNER_ASSET = new URL('../assets/run_tests.py', import.meta.url)
const TEST_FILE_REL = join('tests', 'test_generated.py')

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

/**
 * 会话 ID → 文件名片段。
 *
 * 符合 DSH 实际格式（字母/数字/_/-）的 ID 原样使用；不合法时才清洗。
 * 清洗后**额外拼上原值的短哈希**：只说把非法字符替成 `_` 的话，
 * 两个不同的 ID 可能映射到同一个文件，而会话 ID 是唯一的数据归属依据，
 * 绝不能撞车。拼接哈希后一一对应，且不需要拒绝任何 ID。
 */
function sanitizeSessionId(id) {
  if (typeof id !== 'string') return ''
  const trimmed = id.trim()
  if (trimmed === '') return ''
  if (/^[A-Za-z0-9_-]{1,120}$/.test(trimmed)) return trimmed
  const slug = trimmed.replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 100)
  const digest = createHash('sha256').update(trimmed, 'utf8').digest('hex').slice(0, 12)
  return `${slug}-${digest}`
}

function dataFile(sessionId) {
  const sid = sanitizeSessionId(sessionId)
  if (sid) return join(dataDir(), `records-${sid}.json`)
  return join(dataDir(), 'records.json')
}

/**
 * 一个会话的资产根目录（在项目内）：
 *   <项目>/.dsh/test-sessions/<sessionId>/
 * 用例、测试代码、每次执行的日志与报告都在这里，跟着会话走。
 */
function sessionAssetRoot(cwd, sessionId) {
  return join(resolve(cwd), SESSION_ASSET_DIR, sanitizeSessionId(sessionId))
}



async function writeTextFile(file, content) {
  await mkdir(dirname(file), { recursive: true })
  const temp = `${file}.${process.pid}.${Date.now()}.tmp`
  await writeFile(temp, content, 'utf8')
  try {
    await rename(temp, file)
  } catch {
    await writeFile(file, content, 'utf8')
    try {
      await unlink(temp)
    } catch {
      // 临时文件已经不在。
    }
  }
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

/**
 * Parse a store file, tolerating a UTF-8 BOM.
 *
 * `writeFile(..., 'utf8')` never emits a BOM, but a user who hand-edits a
 * store file in Notepad (or any editor that defaults to "UTF-8 with BOM")
 * produces one. `JSON.parse` then fails on the BOM character and the whole
 * file would be quarantined as corrupt — losing exactly the records someone
 * was trying to fix. Stripping it first keeps a hand-edited file readable.
 *
 * @param raw the file text.
 * @returns the parsed value.
 * @throws {SyntaxError} when the text is not valid JSON either way.
 */
function parseStore(raw) {
  return JSON.parse(raw.replace(/^\uFEFF/, ''))
}

/**
 * Covered source each demo case exercises, in the `path:line` shape the
 * client's "查看代码" parses. Kept beside the rows below so the fixtures stay
 * readable as plain case text.
 */
const DEMO_CODE_REFS = [
  'RingBuffer.h:24',
  'RingBuffer.h:31',
  'RingBuffer.h:48',
  'RingBuffer.h:52',
  'RingBuffer.h:71',
  'RingBuffer.h:63',
  'RingBuffer.h:88',
]

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
      'TEST(RingBufferTest, InitState) {\n  RingBuffer<int> buf(5);\n  EXPECT_EQ(buf.size(), 0);\n  EXPECT_EQ(buf.head(), 0);\n  EXPECT_EQ(buf.tail(), 0);\n}',
    ],
    [
      'BJ-ZZKZ-RINGBUFF-T001',
      'RingBuffer边界测试',
      'boundary',
      '容量取 0 初始化，验证边界条件下对象的处理策略是否给出明确报错。',
      'm_totalCapacity=0',
      'm_size=编译报错',
      'TEST(RingBufferTest, ZeroCapacityRejected) {\n  // 容量 0 在编译期或构造期即被拒绝\n  static_assert(RingBuffer<int>::minCapacity > 0);\n  EXPECT_THROW(RingBuffer<int> buf(0), std::invalid_argument);\n}',
    ],
    [
      'GN-ZZKZ-PUSH-T001',
      'push功能测试',
      'functional',
      '将元素存入缓冲区，验证插入后的状态变化和容量计数是否正确。',
      'm_totalCapacity=2, p_id=0, p_value=Test0',
      'm_size=1, m_head=2, m_tail=1',
      'TEST(RingBufferTest, PushOne) {\n  RingBuffer<std::string> buf(2);\n  buf.push(0, "Test0");\n  EXPECT_EQ(buf.size(), 1);\n  EXPECT_EQ(buf.head(), 2);\n  EXPECT_EQ(buf.tail(), 1);\n}',
    ],
    [
      'JK-ZZKZ-PUSH-T002',
      'push满容量测试',
      'boundary',
      '缓冲区已满后继续 push，验证满容量时的覆盖顺序与读写指针推进。',
      'm_totalCapacity=2，已存 2 个元素',
      'm_size=2, m_head=1, m_tail=1',
      'TEST(RingBufferTest, PushWhenFull) {\n  RingBuffer<std::string> buf(2);\n  buf.push(0, "A");\n  buf.push(1, "B");\n  buf.push(2, "C");  // 覆盖最旧的 A\n  EXPECT_EQ(buf.size(), 2);\n  EXPECT_EQ(buf.head(), 1);\n  EXPECT_EQ(buf.tail(), 1);\n}',
    ],
    [
      'GN-ZZKZ-CLEAR-T001',
      'clearAll功能测试',
      'functional',
      '清空缓冲区，验证头部、尾部与长度归零且内存不被释放。',
      'clearAll()',
      'm_size=0, m_head=0, m_tail=0',
      'TEST(RingBufferTest, ClearAll) {\n  RingBuffer<int> buf(4);\n  buf.push(0, 1);\n  buf.clearAll();\n  EXPECT_EQ(buf.size(), 0);\n  EXPECT_EQ(buf.head(), 0);\n  EXPECT_EQ(buf.tail(), 0);\n}',
    ],
    [
      'BJ-ZZKZ-POP-T001',
      'pop边界测试',
      'boundary',
      '空缓冲区执行 pop，验证下溢时不再修改状态。',
      'm_totalCapacity=3, m_size=0',
      '返回失败，m_size 保持 0',
      'TEST(RingBufferTest, PopEmpty) {\n  RingBuffer<int> buf(3);\n  EXPECT_FALSE(buf.pop());\n  EXPECT_EQ(buf.size(), 0);\n}',
    ],
    [
      'GN-ZZKZ-ITER-T001',
      '迭代器遍历测试',
      'functional',
      '遍历缓冲区中的全部元素，验证顺序与写入顺序一致。',
      'm_totalCapacity=4，依次 push A、B、C',
      '遍历输出 A → B → C',
      'TEST(RingBufferTest, IterateInPushOrder) {\n  RingBuffer<char> buf(4);\n  buf.push(0, \'A\');\n  buf.push(1, \'B\');\n  buf.push(2, \'C\');\n  std::string seen;\n  for (const auto& ch : buf) seen += ch;\n  EXPECT_EQ(seen, "ABC");\n}',
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
      code: row[6],
      // Covered source in the demo repository, in the `path:line` shape the
      // client's "查看代码" parses. Kept beside `rows` so the fixtures above
      // stay readable as plain case text.
      codeRef: DEMO_CODE_REFS[index] || '',
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
    code: text(input.code, MAX_CODE),
    codeRef: text(input.codeRef, MAX_CODE_REF),
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
    code: text(input.code, MAX_CODE),
    codeRef: text(input.codeRef, MAX_CODE_REF),
    updatedAt: new Date().toISOString(),
  }
}

async function quarantine(suffix, sessionId) {
  try {
    const file = dataFile(sessionId)
    await rename(file, `${file}.${suffix}-${Date.now()}`)
  } catch {
    // Nothing to preserve.
  }
}

async function persist(records, seeded, sessionId) {
  const file = dataFile(sessionId)
  await mkdir(dataDir(), { recursive: true })
  const payload = JSON.stringify({ version: STORE_VERSION, seeded: seeded === true, records }, null, 2)
  const temp = join(dataDir(), `.records.${process.pid}.${Date.now()}.tmp`)
  await writeFile(temp, payload, 'utf8')
  try {
    await rename(temp, file)
  } catch {
    await writeFile(file, payload, 'utf8')
    try {
      await unlink(temp)
    } catch {
      // Temp file already gone.
    }
  }
}


async function readStore(sessionId) {
  try {
    const raw = await readFile(dataFile(sessionId), 'utf8')
    const parsed = parseStore(raw)
    if (parsed?.version !== STORE_VERSION) {
      await quarantine(`v${parsed?.version ?? 0}`, sessionId)
      const records = seedRecords()
      await persist(records, true, sessionId)
      return { records, seeded: true }
    }
    const source = Array.isArray(parsed?.records) ? parsed.records : []
    const records = source.map(normalizeStored).filter(Boolean)
    return { records, seeded: parsed?.seeded === true }
  } catch (error) {
    if (error?.code === 'ENOENT') {
      // 会话专属文件还没建过：直接从种子数据起步。
      const records = seedRecords()
      await persist(records, true, sessionId)
      return { records, seeded: true }
    }
    if (error instanceof SyntaxError) {
      await quarantine('corrupt', sessionId)
      const records = seedRecords()
      await persist(records, true, sessionId)
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
function extractSessionId(req, body) {
  // GET: from query string
  if (req.method === 'GET') {
    try {
      const url = new URL(req.url, 'http://localhost')
      const sid = url.searchParams.get('sessionId')
      return typeof sid === 'string' ? sid.trim() : ''
    } catch {
      return ''
    }
  }
  // POST: from body
  if (body && typeof body.sessionId === 'string') {
    return body.sessionId.trim()
  }
  return ''
}

async function handle(req, res) {
  try {
    // Read body early for POST (needed to extract sessionId before the ops)
    let body = {}
    if (req.method === 'POST') {
      try {
        body = await readJson(req)
      } catch (e) {
        send(res, e.status || 400, { ok: false, error: e.message })
        return
      }
    }
    const sessionId = extractSessionId(req, body)
    // 数据按会话归属：没带会话 ID 的请求一律拒绝，不再静默落到旧全局文件。
    // 宁可明确报错，也不要把用例写到没人看得见的地方。
    if (sessionId === '') {
      throw bad(400, '缺少会话 ID：面板数据按会话存储，请带上 sessionId 再请求')
    }


    if (req.method === 'GET') {
      const store = await serial(() => readStore(sessionId))
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

    const op = typeof body.op === 'string' ? body.op : ''

    if (op === 'create') {
      const record = await serial(async () => {
        const store = await readStore(sessionId)
        const now = new Date().toISOString()
        const created = {
          ...normalizePatch({ ...(body.record || {}), title: body.record?.title }, {
            caseId: '',
            title: '',
            testType: 'functional',
            description: '',
            input: '',
            expected: '',
            code: '',
            createdAt: now,
          }),
          id: `rec_${randomUUID().replace(/-/g, '').slice(0, 12)}`,
          demo: false,
          createdAt: now,
        }
        if (!created.caseId) created.caseId = newCaseId()
        store.records.push(created)
        await persist(store.records, store.seeded, sessionId)
        return created
      })
      send(res, 200, { ok: true, record })
      return
    }

    if (op === 'update') {
      const id = text(body.id, 120)
      if (!id) throw bad(400, '缺少记录 id')
      const record = await serial(async () => {
        const store = await readStore(sessionId)
        const index = store.records.findIndex((item) => item.id === id)
        if (index === -1) throw bad(404, '记录不存在')
        const existing = store.records[index]
        const updated = {
          ...normalizePatch({ ...existing, ...(body.patch || body.record || {}) }, existing),
          demo: false,
        }
        store.records[index] = updated
        await persist(store.records, store.seeded, sessionId)
        return updated
      })
      send(res, 200, { ok: true, record })
      return
    }

    if (op === 'delete') {
      const id = text(body.id, 120)
      if (!id) throw bad(400, '缺少记录 id')
      await serial(async () => {
        const store = await readStore(sessionId)
        const next = store.records.filter((item) => item.id !== id)
        if (next.length === store.records.length) throw bad(404, '记录不存在')
        await persist(next, store.seeded, sessionId)
      })
      send(res, 200, { ok: true })
      return
    }

    if (op === 'clearDemo') {
      const removed = await serial(async () => {
        const store = await readStore(sessionId)
        const next = store.records.filter((item) => !item.demo)
        const count = store.records.length - next.length
        await persist(next, false, sessionId)
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

/** 当前可用的 Python 解释器（DSH 自带优先）。 */
function pythonPath() {
  if (process.env.DSH_PYTHON_PATH) return process.env.DSH_PYTHON_PATH
  const bundled = join(dshHome(), 'dsh-runtimes', 'dsh-primary-runtime', 'dependencies', 'python', 'python.exe')
  return existsSyncSafe(bundled) ? bundled : 'python'
}

function existsSyncSafe(file) {
  try {
    return existsSync(file)
  } catch {
    return false
  }
}

/**
 * 把当前面板的用例导出成会话目录里的 cases.json（执行器与报告读它）。
 *
 * **合并**而不是覆盖：Skill 会在 cases.json 里写 `testFunc`，面板没这个字段。
 * 如果直接拿面板记录重写，Skill 写的 testFunc 就没了，后面靠代码推断函数名，
 * 而面板里的代码不一定是最终测试代码。所以按 caseId 保留已有 testFunc。
 */
async function exportCases(store, file) {
  const previous = new Map()
  try {
    const parsed = JSON.parse((await readFile(file, 'utf8')).replace(/^\uFEFF/, ''))
    const list = Array.isArray(parsed) ? parsed : (Array.isArray(parsed?.cases) ? parsed.cases : [])
    for (const item of list) {
      if (item && typeof item.caseId === 'string' && item.caseId !== '') previous.set(item.caseId, item)
    }
  } catch {
    // 还没有旧文件：正常情况。
  }
  // 示例（demo）行是占位数据，不进执行：它们是给人看的面板内容，
  // 一旦编辑过就会被标成 demo: false，自然又进队列了。
  const cases = store.records.filter((record) => record.demo !== true).map((record) => {
    const old = previous.get(record.caseId)
    return {
      caseId: record.caseId,
      title: record.title,
      testType: record.testType,
      description: record.description,
      input: record.input,
      expected: record.expected,
      code: record.code,
      codeRef: record.codeRef,
      // 测试函数名：**当前用例代码推导优先**，推导不出才用旧值。
      // 反过来的话，把 test_old 改名成 test_new 后，仍会去跑已经不存在的 test_old。
      testFunc: testFuncOf(record) || ((old && typeof old.testFunc === 'string') ? old.testFunc.trim() : ''),
    }
  })
  const payload = {
    version: 1,
    exportedAt: new Date().toISOString(),
    cases,
  }
  await writeTextFile(file, JSON.stringify(payload, null, 2))
  return cases
}

/** 从用例代码里认测试函数名（面板没存 testFunc，靠这里推导）。 */
function testFuncOf(record) {
  const explicit = typeof record.testFunc === 'string' ? record.testFunc.trim() : ''
  if (explicit) return explicit
  const match = typeof record.code === 'string' ? record.code.match(/\bdef\s+(test_[A-Za-z0-9_]+)\s*\(/) : null
  return match ? match[1] : ''
}

/** 每个会话记一份“资产根”列表：切了 working directory 后，旧 run 仍能找回来。 */
function assetMapFile(sessionId) {
  return join(dataDir(), `assets-${sanitizeSessionId(sessionId)}.json`)
}

/** 记住一个会话用过的资产根（最近的排在最前，最多 10 个）。 */
async function rememberAssetRoot(sessionId, root, project) {
  const file = assetMapFile(sessionId)
  let roots = []
  try {
    const parsed = JSON.parse(await readFile(file, 'utf8'))
    if (Array.isArray(parsed?.roots)) roots = parsed.roots
  } catch {
    // 还没有映射：正常。
  }
  // 不设上限：历史 run 不该因为“用过的目录太多”而静默失联。
  // 这个映射只是一个目录列表，体积很小，逐个小文件探测的成本可忽略。
  const next = [{ root, project, updatedAt: new Date().toISOString() }]
    .concat(roots.filter((item) => item && item.root !== root))
  try {
    await mkdir(dataDir(), { recursive: true })
    await writeTextFile(file, JSON.stringify({ sessionId, roots: next }, null, 2))
  } catch {
    // 映射写失败不影响本次执行。
  }
}

/** 读该会话已知的资产根（可能为空）。 */
async function knownAssetRoots(sessionId) {
  try {
    const parsed = JSON.parse(await readFile(assetMapFile(sessionId), 'utf8'))
    return (Array.isArray(parsed?.roots) ? parsed.roots : [])
      .map((item) => (item && typeof item.root === 'string' ? item.root : ''))
      .filter((root) => root !== '')
  } catch {
    return []
  }
}

/**
 * 读取侧解析资产根。
 *
 * 优先用 prepare 时记下的映射（切了工作目录也不会丢）；
 * 只有从没执行过时，才退回“会话当前目录 + 客户端提示”。
 */
async function resolveReadRoots(sessionId, hintCwd) {
  const roots = await knownAssetRoots(sessionId)
  if (roots.length > 0) return roots
  const hint = typeof hintCwd === 'string' ? hintCwd.trim() : ''
  if (hint === '') return []
  return [sessionAssetRoot(hint, sessionId)]
}

/** 在所有已知根里按相对路径找一个存在的文件，返回绝对路径或空串。 */
async function findInRoots(roots, ...segments) {
  for (const root of roots) {
    const file = join(root, ...segments)
    if (existsSyncSafe(file)) return file
  }
  return ''
}

function newRunId() {
  const now = new Date()
  const pad = (n, w) => String(n).padStart(w || 2, '0')
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-`
    + `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}-`
    + `${pad(now.getMilliseconds(), 3)}-${randomUUID().replace(/-/g, '').slice(0, 6)}`
}

/** 读某个会话资产目录下的所有执行记录（按 runId 倒序，最新的在前）。 */
async function listRuns(root) {
  const runsDir = join(root, 'runs')
  let names = []
  try {
    names = await readdir(runsDir)
  } catch {
    return []
  }
  names.sort()
  names.reverse()
  const runs = []
  for (const name of names) {
    const resultFile = join(runsDir, name, 'result.json')
    let result = null
    try {
      result = JSON.parse(await readFile(resultFile, 'utf8'))
    } catch {
      result = null
    }
    runs.push({ runId: name, result })
  }
  return runs
}

function runQueryOf(req) {
  const url = new URL(req.url, 'http://localhost')
  return {
    sessionId: (url.searchParams.get('sessionId') || '').trim(),
    cwd: (url.searchParams.get('cwd') || '').trim(),
    runId: (url.searchParams.get('runId') || '').trim(),
    scope: url.searchParams.get('scope') === 'all' ? 'all' : 'case',
    caseId: (url.searchParams.get('caseId') || '').trim(),
  }
}

/**
 * 由宿主自己确定会话的项目目录。
 *
 * 不信任请求里传来的 cwd：会话的真实目录是会话自身的属性（`header.cwd`），
 * 运行中可能被 working_directory 改掉，所以优先取活值。
 * 客户端传的值只在宿主拿不到会话时当兜底，且必须校验是绝对且存在的目录。
 *
 * @returns 绝对路径；确定不了就抛 400。
 */
async function resolveSessionCwd(sessionId, hint) {
  let resolved = ''
  if (sessions !== null && typeof sessions.get === 'function') {
    try {
      const session = sessions.get(sessionId)
      if (session) {
        const live = workingDirectoryService()
        const liveCwd = typeof live?.get === 'function' ? live.get(session) : undefined
        resolved = typeof liveCwd === 'string' && liveCwd !== ''
          ? liveCwd
          : (typeof session.header?.cwd === 'string' ? session.header.cwd : '')
      }
    } catch {
      resolved = ''
    }
  }
  if (resolved === '') {
    const fallback = typeof hint === 'string' ? hint.trim() : ''
    if (fallback === '') throw bad(400, '无法确定会话的项目目录')
    resolved = fallback
  }
  const absolute = resolve(resolved)
  if (!isAbsolute(resolved)) throw bad(400, '会话项目目录不是绝对路径：' + resolved)
  let info = null
  try {
    info = await stat(absolute)
  } catch {
    throw bad(400, '会话项目目录不存在：' + absolute)
  }
  if (!info.isDirectory()) throw bad(400, '会话项目目录不是目录：' + absolute)
  return absolute
}

/** workingDirectory 是可选服务，取不到就算了。 */
function workingDirectoryService() {
  try {
    return typeof ctxRef !== 'undefined' && ctxRef && typeof ctxRef.get === 'function' ? ctxRef.get('workingDirectory') : null
  } catch {
    return null
  }
}

/** 校验运行编号：不允许穿越、不允许怪异字符。 */
function requireRunId(raw) {
  const value = typeof raw === 'string' ? raw.trim() : ''
  if (value === '') throw bad(400, '缺少 runId')
  if (!/^[A-Za-z0-9_-]{1,80}$/.test(value) || value === '.' || value === '..') {
    throw bad(400, 'runId 不合法')
  }
  return value
}

/**
 * 准备一次执行。
 *
 * 冻结当次输入：把要跑的目标用例（含已解析的测试函数）写进
 * `runs/<runId>/request.json`，并从面板导出 `cases.json`、快照测试代码。
 * 这样“点了执行、发送前又改了用例”不会让执行和报告拿到不同版本。
 *
 * 命令里**不拼任何用户内容**（用例标识等全在 request.json 里），只含宿主生成的路径与 runId。
 */
async function handleRunPrepare(req, res) {
  try {
    if (req.method !== 'POST') {
      send(res, 405, { ok: false, error: '仅支持 POST' })
      return
    }
    const body = await readJson(req)
    const sessionId = extractSessionId(req, body)
    if (sessionId === '') throw bad(400, '缺少会话 ID')
    const scope = body.scope === 'all' ? 'all' : 'case'
    const caseId = typeof body.caseId === 'string' ? body.caseId.trim() : ''
    if (scope === 'case' && caseId === '') throw bad(400, '单条执行需要 caseId')

    const cwd = await resolveSessionCwd(sessionId, body.cwd)
    const store = await serial(() => readStore(sessionId))
    if (scope === 'case' && !store.records.some((r) => r.caseId === caseId)) {
      throw bad(404, `本会话找不到用例 ${caseId}`)
    }

    const root = sessionAssetRoot(cwd, sessionId)
    await mkdir(join(root, 'tests'), { recursive: true })
    await mkdir(join(root, 'runs'), { recursive: true })
    await mkdir(join(root, 'reports'), { recursive: true })

    // runner 每次覆盖成包内最新版，避免旧会话目录里的副本过期。
    let runnerSource = ''
    try {
      runnerSource = await readFile(fileURLToPath(RUNNER_ASSET), 'utf8')
    } catch (error) {
      throw bad(500, '找不到 runner 脚本：' + (error instanceof Error ? error.message : String(error)))
    }
    const runnerPath = join(root, 'run_tests.py')
    await writeTextFile(runnerPath, runnerSource)

    const casesFile = join(root, 'cases.json')
    const cases = await exportCases(store, casesFile)

    const runId = newRunId()
    const runDir = join(root, 'runs', runId)
    await mkdir(runDir, { recursive: true })
    const snapshotDir = join(runDir, 'snapshot')
    await mkdir(snapshotDir, { recursive: true })

    // ── 先取内容、算哈希，再冻结请求 ──
    // 执行**仍在原位置跑**：把测试文件换到快照目录会让 conftest、__file__、
    // sys.path 的推导都变样，可能测到不同内容。所以改为“内容校验”：
    // 准备时记 SHA256，runner 执行前重算，不一致就拒绝执行。
    const liveTestFile = join(root, TEST_FILE_REL)
    if (!existsSyncSafe(liveTestFile)) {
      throw bad(400, `本会话还没有测试代码（${liveTestFile}）。请先生成测试代码，再点执行。`)
    }
    const liveTestBytes = await readFile(liveTestFile)
    const testFileSha256 = createHash('sha256').update(liveTestBytes).digest('hex')
    const liveTestText = liveTestBytes.toString('utf8')

    // 快照仍然存一份：报告与事后复查都读它，但不作为执行输入。
    const snapshotTestFile = join(snapshotDir, 'test_generated.py')
    const snapshotCasesFile = join(snapshotDir, 'cases.json')
    await writeTextFile(snapshotTestFile, liveTestText)
    await writeTextFile(snapshotCasesFile, await readFile(casesFile, 'utf8'))

    // 本次要跑的目标；缺函数、或函数在快照里根本不存在的，都单独记账。
    const targets = []
    const notRun = []
    const selected = scope === 'case' ? cases.filter((c) => c.caseId === caseId) : cases
    for (const item of selected) {
      const func = testFuncOf(item)
      if (func === '') {
        notRun.push({ caseId: item.caseId, reason: '用例没有关联测试函数' })
        continue
      }
      // 用例代码改了函数名、但测试文件里没有对应函数时，不能拿着旧名字去跑。
      const declared = new RegExp(`\\bdef\\s+${func.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\(`).test(liveTestText)
      if (!declared) {
        notRun.push({ caseId: item.caseId, reason: `测试文件里找不到函数 ${func}` })
        continue
      }
      targets.push({ caseId: item.caseId, func })
    }
    if (targets.length === 0) {
      const why = notRun.length > 0
        ? '（' + notRun.map((n) => `${n.caseId}：${n.reason}`).join('；') + '）'
        : ''
      throw bad(400, '这次没有可执行的用例' + why + '。请先补上测试代码或修正测试函数名。')
    }

    // 冻结本次输入：执行与报告都只看 snapshot/ 里的副本。
    const request = {
      runId,
      sessionId,
      scope,
      caseId: scope === 'case' ? caseId : '',
      project: cwd,
      root,
      // testFile 指向**原位置**（执行用）；casesFile 指向快照（报告用）。
      // 执行前 runner 会用 testFileSha256 校验原文件没被改过。
      testFile: liveTestFile,
      testFileSha256,
      snapshotTestFile,
      casesFile: snapshotCasesFile,
      testFileExists: true,
      targets,
      notRun,
      createdAt: new Date().toISOString(),
    }
    await writeTextFile(join(runDir, 'request.json'), JSON.stringify(request, null, 2))

    // 记下这个会话的资产根：切了 working directory 后，旧 run 仍能按 runId 找回来。
    await rememberAssetRoot(sessionId, root, cwd)

    const python = pythonPath()
    const command = `"${python}" "${runnerPath}" --project "${cwd}" --root "${root}" --run-id "${runId}"`

    send(res, 200, {
      ok: true,
      runId,
      root,
      command,
      scope,
      caseId: scope === 'case' ? caseId : '',
      caseCount: cases.length,
      targetCount: targets.length,
      testFile: liveTestFile,
      testFileExists: true,
      missingTestFunc: notRun.map((n) => n.caseId),
    })
  } catch (error) {
    const status = Number.isInteger(error?.status) ? error.status : 500
    send(res, status, { ok: false, error: error instanceof Error ? error.message : '服务内部错误' })
  }
}

/** 某会话/某用例最近一次执行（含结果摘要）。 */
async function handleRunLatest(req, res) {
  try {
    if (req.method !== 'GET') {
      send(res, 405, { ok: false, error: '仅支持 GET' })
      return
    }
    const query = runQueryOf(req)
    if (query.sessionId === '') throw bad(400, '缺少会话 ID')
    // 目录以 prepare 时记下的资产根为准；cwd 只是“从没执行过”时的兜底。
    const roots = await resolveReadRoots(query.sessionId, query.cwd)
    const allRuns = []
    for (const root of roots) {
      for (const run of await listRuns(root)) allRuns.push(run)
    }
    allRuns.sort((a, b) => String(b.runId).localeCompare(String(a.runId)))
    const hit = allRuns.find((run) => {
      if (query.scope === 'all') return run.result !== null && run.result.scope === 'all'
      return run.result !== null
        && run.result.scope === 'case'
        && String(run.result.caseId || '') === query.caseId
    })
    if (hit === undefined) {
      send(res, 200, { ok: true, exists: false })
      return
    }
    send(res, 200, { ok: true, exists: true, runId: hit.runId, result: hit.result })
  } catch (error) {
    const status = Number.isInteger(error?.status) ? error.status : 500
    send(res, status, { ok: false, error: error instanceof Error ? error.message : '服务内部错误' })
  }
}

/** 某次执行的原始日志。 */
async function handleRunLog(req, res) {
  try {
    if (req.method !== 'GET') {
      send(res, 405, { ok: false, error: '仅支持 GET' })
      return
    }
    const query = runQueryOf(req)
    if (query.sessionId === '') throw bad(400, '缺少会话 ID')
    const runId = requireRunId(query.runId)
    const roots = await resolveReadRoots(query.sessionId, query.cwd)
    const file = await findInRoots(roots, 'runs', runId, 'run.log')
    let content = ''
    let logStat = null
    try {
      content = await readFile(file, 'utf8')
      logStat = await stat(file)
    } catch {
      send(res, 200, { ok: true, exists: false })
      return
    }
    const truncated = content.length > MAX_RUN_LOG
    if (truncated) content = content.slice(0, MAX_RUN_LOG) + '\n\n…(日志过长，仅显示前 4 MB)'
    send(res, 200, {
      ok: true,
      exists: true,
      content,
      truncated,
      updatedAt: logStat ? logStat.mtime.toISOString() : undefined,
    })
  } catch (error) {
    const status = Number.isInteger(error?.status) ? error.status : 500
    send(res, status, { ok: false, error: error instanceof Error ? error.message : '服务内部错误' })
  }
}

/** 某次执行的结构化结果。 */
async function handleRunResult(req, res) {
  try {
    if (req.method !== 'GET') {
      send(res, 405, { ok: false, error: '仅支持 GET' })
      return
    }
    const query = runQueryOf(req)
    if (query.sessionId === '') throw bad(400, '缺少会话 ID')
    const runId = requireRunId(query.runId)
    const roots = await resolveReadRoots(query.sessionId, query.cwd)
    const file = await findInRoots(roots, 'runs', runId, 'result.json')
    if (file === '') {
      send(res, 200, { ok: true, exists: false })
      return
    }
    try {
      const result = JSON.parse(await readFile(file, 'utf8'))
      send(res, 200, { ok: true, exists: true, result })
    } catch {
      send(res, 200, { ok: true, exists: false })
    }
  } catch (error) {
    const status = Number.isInteger(error?.status) ? error.status : 500
    send(res, status, { ok: false, error: error instanceof Error ? error.message : '服务内部错误' })
  }
}

/**
 * 只读的报告入口：列出本会话各 runId 下的报告文件，或读某次 run 的报告数据。
 *
 * 面板只负责展示，不生成报告（生成走 Skill / 命令行 + bridge.py）。
 * 报告中间文件约定放在 `reports/<runId>/`，避免下次生成覆盖上一次。
 */
async function handleRunReport(req, res) {
  try {
    if (req.method !== 'GET') {
      send(res, 405, { ok: false, error: '仅支持 GET' })
      return
    }
    const query = runQueryOf(req)
    if (query.sessionId === '') throw bad(400, '缺少会话 ID')
    // 报告目录也按“会话资产根映射”找，切了工作目录也不会丢。
    const roots = await resolveReadRoots(query.sessionId, query.cwd)
    const reportsDirs = roots.map((root) => join(root, 'reports'))

    if (query.runId !== '') {
      const runId = requireRunId(query.runId)
      const dir = await findInRoots(roots, 'reports', runId)
      if (dir === '') {
        send(res, 200, { ok: true, exists: false, runId })
        return
      }
      let entries = []
      try {
        entries = await readdir(dir)
      } catch {
        send(res, 200, { ok: true, exists: false, runId })
        return
      }
      const files = []
      for (const name of entries.sort()) {
        try {
          const info = await stat(join(dir, name))
          files.push({ name, size: info.size, updatedAt: info.mtime.toISOString(), path: join(dir, name) })
        } catch {
          // 单个文件读不到就跳过。
        }
      }
      let data = null
      try {
        data = JSON.parse(await readFile(join(dir, 'report-data.json'), 'utf8'))
      } catch {
        data = null
      }
      send(res, 200, { ok: true, exists: true, runId, dir, files, data })
      return
    }

    // 不带 runId：跨所有已知根，列出有报告的 run（按 runId 倒序）。
    const seen = new Set()
    const runs = []
    for (const reportsDir of reportsDirs) {
      let names = []
      try {
        names = await readdir(reportsDir)
      } catch {
        names = []
      }
      for (const name of names) {
        if (seen.has(name)) continue
        if (!/^[A-Za-z0-9_-]{1,80}$/.test(name)) continue
        const dir = join(reportsDir, name)
        let entries = []
        try {
          entries = await readdir(dir)
        } catch {
          continue
        }
        const files = []
        for (const file of entries.sort()) {
          try {
            const info = await stat(join(dir, file))
            files.push({ name: file, size: info.size, updatedAt: info.mtime.toISOString(), path: join(dir, file) })
          } catch {
            // 跳过读不到的。
          }
        }
        if (files.length === 0) continue
        seen.add(name)
        runs.push({ runId: name, files, dir })
      }
    }
    runs.sort((a, b) => String(b.runId).localeCompare(String(a.runId)))
    send(res, 200, { ok: true, runs })
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
  const runRoutes = [
    [RUN_PREPARE_PATH, handleRunPrepare, 'dsh-data-panel: run prepare'],
    [RUN_LATEST_PATH, handleRunLatest, 'dsh-data-panel: run latest'],
    [RUN_LOG_PATH, handleRunLog, 'dsh-data-panel: run log'],
    [RUN_RESULT_PATH, handleRunResult, 'dsh-data-panel: run result'],
    [RUN_REPORT_PATH, handleRunReport, 'dsh-data-panel: run report'],
  ]
  for (const [path, handler, label] of runRoutes) {
    ctx.effect(
      () => ctx.webServer.register({ kind: 'exact', path, handler }),
      label,
    )
  }
  // 旧的 /data-panel/run 已移除：执行统一交给对话里的模型（面板只负责预填指令）。
  // 它当时接受调用方给的 cwd 和测试文件就启动 pytest，容易跑错用例，也没人会校验会话归属。
  try {
    ctx.logger?.info?.('dsh-data-panel: records at %s', dataDir())
  } catch {
    // Logger is optional.
  }
  ctxRef = ctx
  // sessions 用来自己解析会话的项目目录；不可用时退回请求里的 cwd（仍会校验）。
  try {
    sessions = ctx.sessions || null
  } catch {
    sessions = null
  }
  try {
    ctx.logger?.info?.('dsh-data-panel: records at %s', dataDir())
  } catch {
    // Logger is optional.
  }
}

/** 会话服务：用来自己确定会话的项目目录（变了也能跟上）。 */
export function applySessions(service) {
  sessions = service || null
}

/** Test-only surface (not part of the plugin contract). */
export const __test = {
  seedRecords,
  normalizeStored,
  normalizePatch,
  dataDir,
  dataFile,
  readStore,
  persist,
  sessionAssetRoot,
  exportCases,
  testFuncOf,
  listRuns,
}
