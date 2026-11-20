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
import { spawn } from 'node:child_process'
import { mkdir, readFile, readdir, rename, rm, stat, unlink, writeFile } from 'node:fs/promises'
import { existsSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { basename, dirname, isAbsolute, join, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { PRESET_TOOLS, PRESETS, detectPreset, renderRunnerSpec, resolveRunner, targetDeclared, targetLine, targetOf } from './runners.js'
import { resolveSpecs, resolveTool, resolveTools, searchLayers } from './toolchain.js'
import { assessScope } from './scope.js'
import { KINDS, createVersion, integrationRoot, readAll, readIndex, readVersion, saveVersion, setActiveVersion, versionValue } from './integration-store.js'


export const name = 'dsh-data-panel'
export const inject = ['webServer', 'sessions']

const PLUGIN = 'dsh-data-panel'
const API_PATH = '/data-panel/api'
const TOOLS_PATH = '/data-panel/tools'

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
/** 用例层级（分类）名长度上限；空串表示「默认」层级。 */
const MAX_CATEGORY = 60
const MAX_SUBJECT_FUNCTION = 240
/** 内置层级名：固定存在、含全部用例，不能改名/删除。 */
const DEFAULT_CATEGORY = '默认'

const TEST_TYPES = new Set(['functional', 'api', 'boundary', 'logic', 'performance'])

/** 会话资产（用例 / 测试代码 / 日志 / 报告）在项目内的位置。 */
const SESSION_ASSET_DIR = join('.dsh', 'test-sessions')
const RUN_PREPARE_PATH = '/data-panel/run/prepare'
const TEST_CODE_PATH = '/data-panel/test-code'
const RUN_LATEST_PATH = '/data-panel/run/latest'
const RUN_LIST_PATH = '/data-panel/run/list'
const RUN_LOG_PATH = '/data-panel/run/log'
const RUN_RESULT_PATH = '/data-panel/run/result'
const RUN_REPORT_PATH = '/data-panel/run/report'
const RUN_DELETE_PATH = '/data-panel/run/delete'
const OPEN_PATH = '/data-panel/open'
const RUN_REPORT_LATEST_PATH = '/data-panel/run/report/latest'
/** 集成测试数据层：独立的路径，绝不复用单元的 /data-panel/api（那是 5 类硬校验的 store）。 */
const INTEGRATION_PATH = '/data-panel/integration'
const MAX_RUN_LOG = 4 * 1024 * 1024
const RUNNER_ASSET = new URL('../assets/run_tests.py', import.meta.url)

/*
 * 集成测试报告生成器的候选位置。
 *
 * ★ 这里刻意**不写死任何绝对路径**。
 *
 * 历史坑：这份路径原来写死在 SKILL.md 和面板话术里，是一个**本机仓库的绝对路径**。
 * 在那台机器上能用，别人 clone 到别的盘就直接失效 —— 而 Skill 又规定
 * 「生成器缺失要明确报错、不许降级」，于是换台机器报告根本生成不出来。
 *
 * 与单元测试的 RUNNER_ASSET 一样，按**插件包自身位置**定位
 * （`new URL(..., import.meta.url)`），跟仓库放在哪个盘、叫什么名字都无关：
 *
 *   1. `<包>/assets/integration_report.py`          —— 随插件分发，首选
 *   2. `<包>/../integrationReport/integration_report.py` —— 仓库内的开发态布局
 *      （`<仓库>/dsh-data-panel/package/` 的上一层就是 `<仓库>/`）
 *
 * 按顺序找第一个存在的；全都不存在时由调用方明确报错，绝不静默降级。
 */
const INTEGRATION_REPORT_CANDIDATES = [
  // ① 随插件分发：<包>/assets/
  new URL('../assets/integration_report.py', import.meta.url),
  // ② 开发态：仓库根下的 integrationReport/（lib → package → dsh-data-panel → 仓库根）
  new URL('../../../integrationReport/integration_report.py', import.meta.url),
  // ③ 万一有人把整个目录拷进包内
  new URL('../integrationReport/integration_report.py', import.meta.url),
]

/**
 * 解析集成测试报告生成器的实际路径。
 *
 * @returns 绝对路径；找不到时返回空串（调用方负责报错，不要在这里抛）。
 */
function integrationReportScriptPath() {
  // ③ 环境变量兜底：特殊情况（生成器放在共享盘 / 自定义位置）用
  const fromEnv = typeof process.env.INTEGRATION_REPORT_SCRIPT === 'string'
    ? process.env.INTEGRATION_REPORT_SCRIPT.trim()
    : ''
  if (fromEnv !== '' && existsSyncSafe(fromEnv)) return fromEnv

  for (const candidate of INTEGRATION_REPORT_CANDIDATES) {
    try {
      const file = fileURLToPath(candidate)
      if (existsSyncSafe(file)) return file
    } catch {
      // 非法 URL / 平台不支持 —— 继续试下一个候选
    }
  }
  return ''
}

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


/** First-run test cases, marked `demo` so the UI can label them visibly. */
function seedRecords() {
  return [];
}

function namedValues(value, valueKey) {
  if (!Array.isArray(value)) return []
  return value.slice(0, 50).flatMap((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return []
    const name = text(item.name, 120)
    if (!name || typeof item[valueKey] !== 'string') return []
    return [{ name, [valueKey]: item[valueKey].slice(0, 2000) }]
  })
}

function normalizeStored(input) {
  if (input === null || typeof input !== 'object' || typeof input.id !== 'string' || input.id === '') return null
  return {
    id: input.id.slice(0, 120),
    caseId: text(input.caseId, MAX_CASE_ID),
    title: text(input.title, MAX_TITLE) || '未命名用例',
    // 旧记录的原值只读保留；不在读取时悄悄改成「功能测试」。
    // 新建或编辑时由 normalizePatch 限定为当前五类。
    testType: typeof input.testType === 'string' ? input.testType : '',
    testTypes: [...new Set([input.testType, ...(Array.isArray(input.testTypes) ? input.testTypes : [])])].filter((type) => TEST_TYPES.has(type)),
    description: text(input.description, MAX_DESCRIPTION),
    input: text(input.input, MAX_INPUT),
    expected: text(input.expected, MAX_EXPECTED),
    ...(Array.isArray(input.inputVariables) ? { inputVariables: namedValues(input.inputVariables, 'value') } : {}),
    ...(Array.isArray(input.expectedOutputs) ? { expectedOutputs: namedValues(input.expectedOutputs, 'value') } : {}),
    code: text(input.code, MAX_CODE),
    codeRef: text(input.codeRef, MAX_CODE_REF),
    subjectFunction: text(input.subjectFunction, MAX_SUBJECT_FUNCTION),
    // 保留旧分类数据与兼容接口，不再用于函数层级。
    category: text(input.category, MAX_CATEGORY),
    demo: input.demo === true,
    createdAt: isoOrNow(input.createdAt),
    updatedAt: isoOrNow(input.updatedAt),
  }
}

function normalizeSubjectFunction(value) {
  if (value !== undefined && typeof value !== 'string') throw bad(400, '被测函数必须是字符串')
  const name = (value || '').trim()
  if (name.length > MAX_SUBJECT_FUNCTION) throw bad(400, '被测函数最多 240 个字符')
  return name
}

function normalizePatch(input, existing) {
  const title = text(input.title, MAX_TITLE)
  if (!title) throw bad(400, '用例名称不能为空')
  if (!TEST_TYPES.has(input.testType)) throw bad(400, '测试类型只能是功能、接口、边界、逻辑或性能测试')
  const suppliedTypes = input.testTypes === undefined
    ? (existing?.testTypes || []).filter((type) => type !== existing?.testType || type === input.testType)
    : input.testTypes
  if (!Array.isArray(suppliedTypes) || suppliedTypes.some((type) => !TEST_TYPES.has(type))) {
    throw bad(400, 'testTypes 必须是五种有效测试类型组成的数组')
  }
  const testTypes = [...new Set([input.testType, ...suppliedTypes])]
  if (testTypes.length > 2) throw bad(400, '一条用例最多选择两种测试类型；独立场景请拆分')
  return {
    ...existing,
    subjectFunction: normalizeSubjectFunction(input.subjectFunction === undefined ? existing?.subjectFunction : input.subjectFunction),
    caseId: text(input.caseId, MAX_CASE_ID),
    title,
    testType: input.testType,
    testTypes,
    description: text(input.description, MAX_DESCRIPTION),
    input: text(input.input, MAX_INPUT),
    expected: text(input.expected, MAX_EXPECTED),
    ...(Array.isArray(input.inputVariables) ? { inputVariables: namedValues(input.inputVariables, 'value') } : {}),
    ...(Array.isArray(input.expectedOutputs) ? { expectedOutputs: namedValues(input.expectedOutputs, 'value') } : {}),
    code: text(input.code, MAX_CODE),
    codeRef: text(input.codeRef, MAX_CODE_REF),
    category: text(input.category, MAX_CATEGORY),
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

/**
 * 落盘。
 *
 * `categories` 与 `records` 平级单独存：层级可以**先建后归**（空层级也要能存在），
 * 所以不能只靠 records[].category 去重推导。
 * 不升 STORE_VERSION —— 升版本会触发 quarantine 把用户用例重置成示例数据。
 */
async function persist(records, seeded, sessionId, categories) {
  const file = dataFile(sessionId)
  await mkdir(dataDir(), { recursive: true })
  const payload = JSON.stringify({
    version: STORE_VERSION,
    seeded: seeded === true,
    categories: categoryList(records, categories),
    records,
  }, null, 2)
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
      return { records, categories: categoryList(records), seeded: true }
    }
    const source = Array.isArray(parsed?.records) ? parsed.records : []
    const records = source.map(normalizeStored).filter(Boolean)
    // 显式层级 + 用例上实际用到的层级，取并集后排序。
    const categories = categoryList(records, parsed?.categories)
    return { records, categories, seeded: parsed?.seeded === true }
  } catch (error) {
    if (error?.code === 'ENOENT') {
      // 会话专属文件还没建过：直接从种子数据起步。
      const records = seedRecords()
      await persist(records, true, sessionId)
      return { records, categories: categoryList(records), seeded: true }
    }
    if (error instanceof SyntaxError) {
      await quarantine('corrupt', sessionId)
      const records = seedRecords()
      await persist(records, true, sessionId)
      return { records, categories: categoryList(records), seeded: true }
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

/**
 * 用例层级清单（去掉空串，空串代表「默认」层）。
 * 按名字排序，保证同一份数据每次渲染顺序稳定。
 */
/**
 * 层级清单 = 显式存下的层级 ∪ 用例上实际用到的层级。
 *
 * 两者取并集：
 *   - 显式清单让「空层级」能先建后归；
 *   - 用例上的 category 兜住旧数据（老文件没有 categories 字段时自动补齐）。
 */
function categoryList(records, explicit) {
  const seen = new Set()
  for (const name of (Array.isArray(explicit) ? explicit : [])) {
    if (typeof name === 'string' && name.trim() !== '') seen.add(name.trim())
  }
  for (const record of (Array.isArray(records) ? records : [])) {
    const name = typeof record?.category === 'string' ? record.category.trim() : ''
    if (name !== '') seen.add(name)
  }
  return Array.from(seen).sort((a, b) => a.localeCompare(b, 'zh-CN'))
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
        // 层级清单 = 显式层级 ∪ 用例上实际用到的（空串 = 默认层，不入列）。
        categories: store.categories,
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
            category: '',
            createdAt: now,
          }),
          id: `rec_${randomUUID().replace(/-/g, '').slice(0, 12)}`,
          demo: false,
          createdAt: now,
        }
        if (!created.caseId) created.caseId = newCaseId()
        store.records.push(created)
        await persist(store.records, store.seeded, sessionId, store.categories)
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
        const patch = body.patch || body.record || {}
        const next = { ...existing, ...patch }
        if (patch.testType !== undefined && patch.testTypes === undefined && patch.testType !== existing.testType) {
          next.testTypes = (existing.testTypes || []).filter((type) => type !== existing.testType)
        }
        const updated = {
          ...normalizePatch(next, existing),
          demo: false,
        }
        store.records[index] = updated
        await persist(store.records, store.seeded, sessionId, store.categories)
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
        await persist(next, store.seeded, sessionId, store.categories)
      })
      send(res, 200, { ok: true })
      return
    }

    if (op === 'clearDemo') {
      const removed = await serial(async () => {
        const store = await readStore(sessionId)
        const next = store.records.filter((item) => !item.demo)
        const count = store.records.length - next.length
        await persist(next, false, sessionId, store.categories)
        return count
      })
      send(res, 200, { ok: true, removed })
      return
    }

    // 所有生成 Skill 共用此接口，业务函数独立于 Skill 名称与测试入口。
    if (op === 'assignFunction') {
      const ids = Array.isArray(body.ids) ? [...new Set(body.ids.filter(id => typeof id === 'string' && id !== ''))] : []
      if (!ids.length) throw bad(400, '请先选择用例')
      if (typeof body.subjectFunction !== 'string') throw bad(400, '请提供被测函数；空字符串可解除关联')
      const subjectFunction = normalizeSubjectFunction(body.subjectFunction)
      const moved = await serial(async () => {
        const store = await readStore(sessionId)
        const wanted = new Set(ids)
        if (ids.some(id => !store.records.some(record => record.id === id))) throw bad(404, '选中的用例不存在，请刷新后重试')
        const updatedAt = new Date().toISOString()
        const next = store.records.map(record => wanted.has(record.id) ? { ...record, subjectFunction, updatedAt } : record)
        await persist(next, store.seeded, sessionId, store.categories)
        return ids.length
      })
      send(res, 200, { ok: true, moved, subjectFunction })
      return
    }

    // 旧分类兼容接口：保留已有 category/categories，不影响 subjectFunction。
    /* 先建层级、再归入用例：不要求此刻就有用例挂上去。 */
    if (op === 'createCategory') {
      const raw = typeof body.category === 'string' ? body.category.trim() : ''
      if (raw === '') throw bad(400, '层级名不能为空')
      if (raw === DEFAULT_CATEGORY) throw bad(400, '「' + DEFAULT_CATEGORY + '」是内置层级，不能作为自定义分类名')
      const name = raw.slice(0, MAX_CATEGORY)
      const created = await serial(async () => {
        const store = await readStore(sessionId)
        const existing = categoryList(store.records, store.categories)
        if (existing.includes(name)) throw bad(409, `层级「${name}」已存在`)
        const categories = existing.concat([name])
        await persist(store.records, store.seeded, sessionId, categories)
        return name
      })
      send(res, 200, { ok: true, category: created })
      return
    }

    if (op === 'assignCategory') {
      const ids = Array.isArray(body.ids) ? body.ids.filter((x) => typeof x === 'string' && x !== '') : []
      if (ids.length === 0) throw bad(400, '请先选择要归类的用例')
      const raw = typeof body.category === 'string' ? body.category.trim() : ''
      if (raw !== '' && raw === DEFAULT_CATEGORY) throw bad(400, '「' + DEFAULT_CATEGORY + '」是内置层级，不能作为自定义分类名')
      const category = raw.slice(0, MAX_CATEGORY)
      const moved = await serial(async () => {
        const store = await readStore(sessionId)
        const wanted = new Set(ids)
        let count = 0
        const next = store.records.map((item) => {
          if (!wanted.has(item.id)) return item
          count += 1
          return { ...item, category, updatedAt: new Date().toISOString() }
        })
        if (count === 0) throw bad(404, '选中的用例都不存在')
        await persist(next, store.seeded, sessionId, store.categories)
        return count
      })
      send(res, 200, { ok: true, moved, category })
      return
    }

    if (op === 'renameCategory') {
      const from = typeof body.from === 'string' ? body.from.trim().slice(0, MAX_CATEGORY) : ''
      const to = typeof body.to === 'string' ? body.to.trim().slice(0, MAX_CATEGORY) : ''
      if (from === '') throw bad(400, '「' + DEFAULT_CATEGORY + '」层级不能改名')
      if (to === '') throw bad(400, '新层级名不能为空')
      if (to === DEFAULT_CATEGORY) throw bad(400, '「' + DEFAULT_CATEGORY + '」是内置层级，不能作为自定义分类名')
      const moved = await serial(async () => {
        const store = await readStore(sessionId)
        let count = 0
        const next = store.records.map((item) => {
          if (item.category !== from) return item
          count += 1
          return { ...item, category: to, updatedAt: new Date().toISOString() }
        })
        // 空层级也要能改名，所以判定看显式清单而不是用例数。
        const known = categoryList(store.records, store.categories)
        if (!known.includes(from)) throw bad(404, `找不到名为「${from}」的层级`)
        const categories = known.filter((name) => name !== from).concat([to])
        await persist(next, store.seeded, sessionId, categories)
        return count
      })
      send(res, 200, { ok: true, moved, from, to })
      return
    }

    if (op === 'deleteCategory') {
      const name = typeof body.category === 'string' ? body.category.trim().slice(0, MAX_CATEGORY) : ''
      if (name === '') throw bad(400, '「' + DEFAULT_CATEGORY + '」层级不能删除')
      // 只解散层级：里面的用例退回默认层级，一条都不删。
      const moved = await serial(async () => {
        const store = await readStore(sessionId)
        let count = 0
        const next = store.records.map((item) => {
          if (item.category !== name) return item
          count += 1
          return { ...item, category: '', updatedAt: new Date().toISOString() }
        })
        const known = categoryList(store.records, store.categories)
        if (!known.includes(name)) throw bad(404, `找不到名为「${name}」的层级`)
        const categories = known.filter((item) => item !== name)
        await persist(next, store.seeded, sessionId, categories)
        return count
      })
      send(res, 200, { ok: true, moved, category: name })
      return
    }

    throw bad(400, `未知操作：${op || '(空)'}`)
  } catch (error) {
    const status = Number.isInteger(error?.status) ? error.status : 500
    send(res, status, { ok: false, error: error instanceof Error ? error.message : '服务内部错误' })
  }
}

/**
 * 运行时工具的统一解释。
 *
 * 具体怎么找交给 lib/toolchain.js（任意工具名都走同一条搜索阶梯），这里只负责
 * “面板自己的约定”：DSH_*_PATH 优先，最后退回命令名让 shell 自己找。
 */
function pythonPath() {
  return process.env.DSH_PYTHON_PATH || resolveTool('python') || 'python'
}

/** 当前进程自己就是 node 时直接用 process.execPath，避免又去扫目录。 */
function nodePath() {
  if (process.env.DSH_NODE_PATH) return process.env.DSH_NODE_PATH
  const exec = typeof process.execPath === 'string' ? process.execPath : ''
  if (/(^|[\\/])node(\.exe)?$/i.test(exec)) return exec
  return resolveTool('node') || 'node'
}

/** npx 在 Windows 上是 npx.cmd，需要由 shell 启动。 */
function npxPath() {
  return process.env.DSH_NPX_PATH || resolveTool('npx') || (process.platform === 'win32' ? 'npx.cmd' : 'npx')
}

/**
 * 某个运行器缺哪些工具（用来把错误说清楚，而不是笼统地说“环境不对”）。
 * 与语言无关：需要什么全看 runner.tools（来自 preset 或 runner.json）。
 */
function missingTools(runner, project) {
  const need = Array.isArray(runner?.tools) ? runner.tools.slice() : []
  // 已构建的测试不需要编译器；只有声明了预执行命令才检查它的入口。
  const buildExecutable = Array.isArray(runner?.preCommand) ? runner.preCommand[0] : ''
  if (typeof buildExecutable === 'string' && buildExecutable !== '' && !buildExecutable.includes('{')) {
    if (isAbsolute(buildExecutable)) {
      if (!existsSyncSafe(buildExecutable)) return { need, resolved: {}, missing: [buildExecutable] }
    } else if (!buildExecutable.includes('/') && !buildExecutable.includes('\\')) {
      need.push(buildExecutable.replace(/\.(exe|cmd|bat)$/i, ''))
    } else if (!existsSyncSafe(resolve(project, buildExecutable))) {
      return { need, resolved: {}, missing: [buildExecutable] }
    }
  }
  if (need.length === 0) return { need, resolved: {}, missing: [] }
  // resolveSpecs 支持「任选其一」的组（如 g++|clang++|cl）。
  const { resolved, missing } = resolveSpecs(need, { project })
  return { need, resolved, missing }
}

/** 工具链一句话总结，拼进报错里。 */
function describeToolchain(runner, project) {
  const { resolved, missing } = missingTools(runner, project)
  const names = Object.keys(resolved)
  if (names.length === 0) return ''
  const parts = names.map((tool) => `${tool}=${resolved[tool] || '未找到'}`)
  if (missing.length === 0) return `运行器需要的工具：${parts.join('，')}。`
  return `运行器需要的工具：${parts.join('，')}。`
    + `缺少 ${missing.join(' / ')}：它可能装在非 PATH 目录 —— 请检查环境变量、项目内 wrapper（mvnw/gradlew）`
    + '或版本管理器（pyenv/nvm/sdkman/rustup/volta），或用 DSH_<TOOL>_PATH 显式指定。'
}

/** Gradle 包一层 wrapper：优先用项目自带的 gradlew / gradlew.bat。 */
function gradlewPath(project) {
  const wrapper = join(project, process.platform === 'win32' ? 'gradlew.bat' : 'gradlew')
  return existsSyncSafe(wrapper) ? wrapper : (resolveTool('gradle', { project }) || wrapper)
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
async function exportCases(store, file, runner) {
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
      testTypes: record.testTypes || [record.testType],
      description: record.description,
      input: record.input,
      expected: record.expected,
      inputVariables: record.inputVariables === undefined ? namedValues(old?.inputVariables, 'value') : record.inputVariables,
      expectedOutputs: record.expectedOutputs === undefined ? namedValues(old?.expectedOutputs, 'value') : record.expectedOutputs,
      code: record.code,
      codeRef: record.codeRef,
      subjectFunction: text(record.subjectFunction, MAX_SUBJECT_FUNCTION),
      // 测试函数名：**当前用例代码推导优先**，推导不出才用旧值。
      // 反过来的话，把 test_old 改名成 test_new 后，仍会去跑已经不存在的 test_old。
      testFunc: testFuncOf(record, runner) || ((old && typeof old.testFunc === 'string') ? old.testFunc.trim() : ''),
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
function testFuncOf(record, runner) {
  return targetOf(record, runner || { targetExtract: PRESETS.pytest.targetExtract })
}

async function savedTestFunc(root, caseId) {
  try {
    const parsed = JSON.parse((await readFile(join(root, 'cases.json'), 'utf8')).replace(/^\uFEFF/, ''))
    const cases = Array.isArray(parsed) ? parsed : parsed?.cases
    const match = Array.isArray(cases) ? cases.find((item) => item?.caseId === caseId) : null
    return typeof match?.testFunc === 'string' ? match.testFunc.trim() : ''
  } catch {
    return ''
  }
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

/**
 * 读某次执行快照里冻结的用例（输入 / 预期输出）。
 * 为什么要看快照：用例事后被改过时，历史记录必须显示“当时跑的那份”，
 * 否则会出现“预期 -2 / 实际 -1 / 结果 通过”这种自相矛盾的行。
 * 拿不到（旧版本没写快照）就返回 null，由上层给空值。
 */
async function readSnapshotCase(root, runId, caseId) {
  try {
    const file = join(root, 'runs', runId, 'snapshot', 'cases.json')
    const parsed = JSON.parse(await readFile(file, 'utf8'))
    const cases = Array.isArray(parsed?.cases) ? parsed.cases : []
    const hit = cases.find((item) => item && String(item.caseId || '') === String(caseId))
    return hit || null
  } catch {
    return null
  }
}


/**
 * 报告目录的候选根。
 *
 * 为什么需要多套：本插件有两套完全不同的资产布局。
 *
 *   单元测试（run/prepare 那一套）          集成测试（integration-store 那一套）
 *   <项目>/.dsh/test-sessions/<sid>/        <项目>/.dsh/test-sessions/<sid>/integration/
 *     runs/<runId>/                           runs/<runId>/
 *     reports/<runId>/                        reports/<runId>/
 *
 * 集成测试的报告落在**后者**（Skill 约定的目录），而 `/data-panel/run/report`
 * 原来只在前者里找 —— 于是报告文件明明就在磁盘上，面板却提示
 * 「这次执行还没有生成 Word 报告」。这里把两套根都列出来。
 *
 * 顺序上集成根优先：集成页的 runId 形如 `run_20261120_1020_all`，
 * 与单元测试的 runId（带毫秒+随机后缀）不会撞车，先查集成根也更省事。
 */
function reportRoots(roots) {
  const candidates = []
  for (const root of roots) {
    candidates.push(join(root, 'integration'))
  }
  for (const root of roots) {
    candidates.push(root)
  }
  // 去重，避免同一个目录被查两遍
  return candidates.filter((item, index) => candidates.indexOf(item) === index)
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
 * 准备一次执行（不启动进程）。
 *
 * 冻结当次输入：把要跑的目标用例（含已解析的测试函数/测试名）写进
 * `runs/<runId>/request.json`，并从面板导出 `cases.json`、快照测试代码。
 * 这样“点了执行、发送前又改了用例”不会让执行和报告拿到不同版本。
 *
 * 命令里**不拼任何用户内容**（用例标识等全在 request.json 里），只含宿主生成的路径与 runId。
 */

/** 从用例 codeRef 反推项目目录：codeRef 通常指向 <project>/.dsh/test-sessions/<sid>/tests/... */
function projectFromCodeRef(store, scope, caseId, sessionId) {
  const records = store && Array.isArray(store.records) ? store.records : []
  const record = scope === 'case'
    ? records.find((item) => item && item.caseId === caseId)
    : records.find((item) => item && typeof item.codeRef === 'string' && item.codeRef.trim() !== '')
  const raw = record && typeof record.codeRef === 'string' ? record.codeRef.trim() : ''
  if (raw === '') return ''
  const path = raw.replace(/#L\d+(?:[-~]\d+)?$/, '').replace(/:\d+(?::\d+)?$/, '')
  const normalized = path.replace(/\\/g, '/')
  const marker = '/.dsh/test-sessions/'
  const index = normalized.toLowerCase().indexOf(marker)
  if (index <= 0) return ''
  if (normalized.slice(index + marker.length).split('/')[0] !== sanitizeSessionId(sessionId)) return ''
  const project = normalized.slice(0, index)
  return isAbsolute(project) ? resolve(project) : ''
}

/** 在会话 cwd 的近邻项目中找同一个 sessionId 的资产目录，不依赖用例 codeRef。 */
async function nearbySessionProjects(cwd, sessionId) {
  const found = []
  const queue = [{ dir: cwd, depth: 0 }]
  let visited = 0
  while (queue.length > 0 && visited < 200) {
    const { dir, depth } = queue.shift()
    visited += 1
    if (existsSyncSafe(sessionAssetRoot(dir, sessionId))) found.push(dir)
    if (depth >= 2) continue
    let entries = []
    try { entries = await readdir(dir, { withFileTypes: true }) } catch { continue }
    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name.startsWith('.') || entry.name === 'node_modules') continue
      queue.push({ dir: join(dir, entry.name), depth: depth + 1 })
    }
  }
  return found
}

/** 查看代码与执行准备共用同一个项目和运行器选择规则。 */
async function resolveProjectRunner({ sessionId, cwd, scope, caseId, store }) {
  const preferred = resolve(cwd)
  const normalized = (path) => process.platform === 'win32' ? resolve(path).toLowerCase() : resolve(path)
  let lastError = null
  const examine = (project) => {
    const root = sessionAssetRoot(project, sessionId)
    try {
      const runner = resolveRunner({ project, root })
      if (!existsSyncSafe(runner.testFile)) throw new Error(`预期测试文件不存在：${runner.testFile}。请检查 runner.json 的 testFile。`)
      return { project, root, runner }
    } catch (error) {
      lastError = error
      return null
    }
  }
  const direct = examine(preferred)
  if (direct !== null) return direct

  const candidates = []
  for (const root of await knownAssetRoots(sessionId)) {
    const project = dirname(dirname(dirname(root)))
    if (normalized(sessionAssetRoot(project, sessionId)) === normalized(root)) candidates.push(project)
  }
  candidates.push(...await nearbySessionProjects(preferred, sessionId))
  const codeProject = projectFromCodeRef(store, scope, caseId, sessionId)
  if (codeProject !== '') candidates.push(codeProject)

  const seen = new Set([normalized(preferred)])
  const matches = []
  for (const project of candidates) {
    const key = normalized(project)
    if (seen.has(key)) continue
    seen.add(key)
    const match = examine(project)
    if (match !== null) matches.push(match)
  }
  if (matches.length === 1) return matches[0]
  if (matches.length > 1) {
    throw bad(400, `本会话找到多个可执行项目：${matches.map((item) => item.project).join('；')}。请切换到目标项目的工作目录后重试。`)
  }
  throw bad(400, lastError instanceof Error ? lastError.message : '无法识别本会话的测试框架')
}

/** 与执行准备使用同一运行器来定位真实测试文件和目标。只读，不导出或改写用例。 */
async function resolveTestCode({ sessionId, cwd, caseId, store }) {
  const record = store.records.find((item) => item.caseId === caseId && item.demo !== true)
  if (!record) throw bad(404, `本会话找不到用例 ${caseId}`)
  const { project, root, runner } = await resolveProjectRunner({ sessionId, cwd, scope: 'case', caseId, store })
  if (!existsSyncSafe(runner.testFile)) {
    throw bad(400, `预期测试文件不存在：${runner.testFile}。请检查 runner.json 的 testFile。`)
  }
  const target = testFuncOf(record, runner) || await savedTestFunc(root, caseId)
  if (!target) throw bad(400, `用例 ${caseId} 未关联测试函数或测试名，请补充 testFunc。`)
  const testText = await readFile(runner.testFile, 'utf8')
  if (!targetDeclared(testText, target, runner)) {
    throw bad(400, `测试文件 ${runner.testFile} 中找不到目标 ${target}。请核对用例与测试代码的关联。`)
  }
  const line = targetLine(testText, target, runner) || 1
  const refPath = String(record.codeRef || '').trim().replace(/#L\d+(?:[-~]\d+)?$/, '').replace(/:\d+(?::\d+)?$/, '')
  const refFile = refPath ? (isAbsolute(refPath) ? resolve(refPath) : resolve(project, refPath)) : ''
  return {
    caseId,
    testFile: runner.testFile,
    testFunc: target,
    line,
    warning: refFile && refFile !== runner.testFile
      ? `原 codeRef 指向 ${refPath}；已按实际测试文件打开。`
      : '',
  }
}

async function handleTestCode(req, res) {
  try {
    if (req.method !== 'GET') throw bad(405, '仅支持 GET')
    const query = runQueryOf(req)
    if (!query.sessionId || !query.caseId) throw bad(400, '缺少会话 ID 或用例 ID')
    const cwd = await resolveSessionCwd(query.sessionId, query.cwd)
    const store = await serial(() => readStore(query.sessionId))
    const result = await resolveTestCode({ sessionId: query.sessionId, cwd, caseId: query.caseId, store })
    send(res, 200, { ok: true, ...result })
  } catch (error) {
    send(res, Number.isInteger(error?.status) ? error.status : 500,
      { ok: false, error: error instanceof Error ? error.message : '服务内部错误' })
  }
}

async function prepareRun({ sessionId, cwd, scope, caseId, caseIds, store }) {
  const preferred = await resolveSessionCwd(sessionId, cwd)
  const { project, root, runner } = await resolveProjectRunner({ sessionId, cwd: preferred, scope, caseId, store })
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
  const cases = await exportCases(store, casesFile, runner)

  const runId = newRunId()
  const runDir = join(root, 'runs', runId)
  await mkdir(runDir, { recursive: true })
  const snapshotDir = join(runDir, 'snapshot')
  await mkdir(snapshotDir, { recursive: true })

  // ── 先取内容、算哈希，再冻结请求 ──
  // 执行**仍在原位置跑**：把测试文件换到快照目录会让 conftest、__file__、
  // sys.path（以及其他框架的导入推导）都变样，可能测到不同内容。所以改为“内容校验”：
  // 准备时记 SHA256，runner 执行前重算，不一致就拒绝执行。
  const liveTestFile = runner.testFile
  if (!existsSyncSafe(liveTestFile)) {
    // 缺测试代码时顺带把工具链情况说清楚：模型接下来要么补代码，要么发现工具不在手上。
    const toolHint = describeToolchain(runner, project)
    throw bad(
      400,
      `本会话还没有测试代码（${liveTestFile}）。当前测试框架：${runner.label}（${runner.language}）。`
      + '请先生成测试代码，或在会话资产目录的 runner.json 里用 testFile 指向实际测试文件。'
      + toolHint,
    )
  }

  // 框架的工具都没在手上时，早报错：等拼好命令再让子进程报 spawn 失败，
  // 模型只会看到一句“找不到命令”，不知道去找什么。这里直接说清楚缺哪个、去哪找。
  const toolStatus = missingTools(runner, project)
  if (toolStatus.missing.length > 0) {
    throw bad(
      400,
      `当前测试框架 ${runner.label}（${runner.language}）需要的工具没找到：${toolStatus.missing.join(' / ')}。`
      + '已按 env / 项目内 wrapper / SDK 根变量 / DSH 自带运行时 / PATH / 常见安装目录 逐层找过。'
      + '请安装该工具，或用 DSH_<TOOL>_PATH 指向它的可执行文件；项目自带 wrapper（mvnw / gradlew）也会被优先使用。',
    )
  }
  if (runner.command[0] === '{binary}' && (!runner.binary || (runner.preCommand.length === 0 && !existsSyncSafe(runner.binary)))) {
    throw bad(400, `测试可执行文件不存在：${runner.binary || 'runner.json 未配置 binary'}。请先构建，或修正 runner.json 的 binary。`)
  }
  const liveTestBytes = await readFile(liveTestFile)
  const testFileSha256 = createHash('sha256').update(liveTestBytes).digest('hex')
  const liveTestText = liveTestBytes.toString('utf8')

  // 快照仍然存一份：报告与事后复查都读它，但不作为执行输入。
  const snapshotTestFile = join(snapshotDir, basename(liveTestFile))
  const snapshotCasesFile = join(snapshotDir, 'cases.json')
  await writeTextFile(snapshotTestFile, liveTestText)
  // 单条执行的快照只保留这一条：报告只应该覆盖本次真正执行的用例，
  // 执行范围：单条 / 多条选中 / 全部。快照、targets、报告都只覆盖这个范围，
  // 否则 bridge.py 会把本次没跑的用例也写成“未执行”。
  const pickedIds = Array.isArray(caseIds) ? caseIds.map((id) => String(id)) : []
  // 多选里若夹了已被删的用例，要早报，而不是静默少跑几条。
  if (scope === 'cases') {
    const known = new Set(store.records.map((r) => String(r.caseId)))
    const missing = pickedIds.filter((id) => !known.has(id))
    if (missing.length > 0) {
      throw bad(404, `本会话找不到这些用例：${missing.slice(0, 5).join('、')}${missing.length > 5 ? ' 等' : ''}`)
    }
  }
  const selectedCases =
    scope === 'case' ? cases.filter((item) => item.caseId === caseId)
      : scope === 'cases' ? cases.filter((item) => pickedIds.includes(String(item.caseId)))
        : cases
  const snapshotCases = selectedCases
  await writeTextFile(snapshotCasesFile, JSON.stringify({
    version: 1,
    exportedAt: new Date().toISOString(),
    cases: snapshotCases,
  }, null, 2))

  // 本次要跑的目标；缺目标、或目标在测试文件里根本不存在的，都单独记账。
  const targets = []
  const notRun = []
  const selected = selectedCases
  for (const item of selected) {
    const func = testFuncOf(item, runner)
    if (func === '') {
      notRun.push({ caseId: item.caseId, reason: '用例没有关联测试函数/测试名' })
      continue
    }
    if (!targetDeclared(liveTestText, func, runner)) {
      notRun.push({ caseId: item.caseId, reason: `测试文件里找不到 ${func}` })
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

  // 把「怎么跑」冻结进 request.json：命令由宿主拼好，runner 只负责执行与记录。
  let scopeDocument = null
  let scopeReadError = ''
  try { scopeDocument = JSON.parse(await readFile(join(root, 'scope.json'), 'utf8')) }
  catch (error) { if (error.code !== 'ENOENT') scopeReadError = 'scope.json 无法读取或 JSON 无效' }
  const testScope = assessScope(project, scopeDocument, cases, selected.map((item) => item.caseId))
  if (scopeReadError) { testScope.status = 'invalid'; testScope.warnings.unshift(scopeReadError) }
  await writeTextFile(join(snapshotDir, 'scope.json'), JSON.stringify(testScope, null, 2))
  const runnerSpec = renderRunnerSpec(runner, {
    python: pythonPath(),
    node: nodePath(),
    npx: npxPath(),
    gradlew: gradlewPath(project),
    binary: runner.binary,
    project,
    root,
    runId,
    runDir,
    tools: toolStatus.resolved,
  })
  // 冻结本次输入：执行与报告都只看 snapshot/ 里的副本。
  const request = {
    runId,
    sessionId,
    scope,
    caseId: scope === 'case' ? caseId : '',
    // 多选执行时 runner 会把实际跑到的 caseId 写进 result.cases，这里再记一份方便回溯。
    caseIds: scope === 'cases' ? selectedCases.map((item) => item.caseId) : undefined,
    project,
    root,
    // testFile 指向**原位置**（执行用）；casesFile 指向快照（报告用）。
    // 执行前 runner 会用 testFileSha256 校验原文件没被改过。
    testFile: liveTestFile,
    testFileSha256,
    snapshotTestFile,
    testScope,
    casesFile: snapshotCasesFile,
    testFileExists: true,
    targets,
    notRun,
    runner: runnerSpec,
    createdAt: new Date().toISOString(),
  }
  await writeTextFile(join(runDir, 'request.json'), JSON.stringify(request, null, 2))

  // 记下这个会话的资产根：切了 working directory 后，旧 run 仍能按 runId 找回来。
  await rememberAssetRoot(sessionId, root, project)

  const python = pythonPath()
  // PowerShell 里以引号开头的 token 不会当成命令（会被当成字符串表达式），
  // 路径含空格必须带引号，而带引号就必须用 & 调用运算符。cmd 下 & 是分隔符，所以只对 Windows 加。
  const callOperator = process.platform === 'win32' ? '& ' : ''
  const command = `${callOperator}"${python}" "${runnerPath}" --project "${project}" --root "${root}" --run-id "${runId}"`

  return {
    runId,
    root,
    command,
    scope,
    caseId: scope === 'case' ? caseId : '',
    caseIds: scope === 'cases' ? selectedCases.map((item) => item.caseId) : undefined,
    caseCount: cases.length,
    targetCount: targets.length,
    testFile: liveTestFile,
    testFileExists: true,
    missingTestFunc: notRun.map((n) => n.caseId),
    notRun,
    framework: runner.label,
    frameworkId: runner.id,
    runnerMode: runner.mode,
    scopeWarnings: testScope.warnings,
    language: runner.language,
    // 本次执行用到的工具（绝对路径），面板/日志里能看出到底用哪个运行时跑的。
    tools: toolStatus.resolved,
  }
}

/** HTTP 入口：参数与会话解析，真正干活的是 prepareRun（便于测试直接调用）。 */
async function handleRunPrepare(req, res) {
  try {
    if (req.method !== 'POST') {
      send(res, 405, { ok: false, error: '仅支持 POST' })
      return
    }
    const body = await readJson(req)
    const sessionId = extractSessionId(req, body)
    if (sessionId === '') throw bad(400, '缺少会话 ID')
    const scope = body.scope === 'all' ? 'all'
      : body.scope === 'cases' ? 'cases'
        : 'case'
    const caseId = typeof body.caseId === 'string' ? body.caseId.trim() : ''
    const caseIds = Array.isArray(body.caseIds)
      ? body.caseIds.map((id) => String(id).trim()).filter((id) => id !== '')
      : []
    if (scope === 'case' && caseId === '') throw bad(400, '单条执行需要 caseId')
    if (scope === 'cases' && caseIds.length === 0) throw bad(400, '多选执行需要 caseIds')

    const cwd = await resolveSessionCwd(sessionId, body.cwd)
    const store = await serial(() => readStore(sessionId))
    if (scope === 'case' && !store.records.some((r) => r.caseId === caseId)) {
      throw bad(404, `本会话找不到用例 ${caseId}`)
    }
    if (scope === 'cases') {
      // 逐个核对：选中后被删的用例要紧早报，而不是静默少跑几条。
      const known = new Set(store.records.map((r) => String(r.caseId)))
      const missing = caseIds.filter((id) => !known.has(id))
      if (missing.length > 0) {
        throw bad(404, `本会话找不到这些用例：${missing.slice(0, 5).join('、')}${missing.length > 5 ? ' 等' : ''}`)
      }
    }
    const result = await prepareRun({ sessionId, cwd, scope, caseId, caseIds, store })
    send(res, 200, { ok: true, ...result })
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
      if (run.result === null) return false
      // 整体执行：全部用例(all) / 选中的多条(cases) 都算，工具栏「日志」读这个。
      if (query.scope === 'all') return run.result.scope === 'all' || run.result.scope === 'cases'
      // 单条用例只看单条执行，不和批量执行混。
      return run.result.scope === 'case' && String(run.result.caseId || '') === query.caseId
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

/**
 * 某条用例的历史执行列表（按 runId 倒序，最新在前）。
 *
 * 只读取已有的 runs/ 目录，不新增任何落盘内容；查询口径与 handleRunLatest 一致：
 * scope=case + caseId 精确匹配。用来支撑表格里那一行的展开记录。
 */
async function handleRunList(req, res) {
  try {
    if (req.method !== 'GET') {
      send(res, 405, { ok: false, error: '仅支持 GET' })
      return
    }
    const query = runQueryOf(req)
    if (query.sessionId === '') throw bad(400, '缺少会话 ID')
    const caseId = typeof query.caseId === 'string' ? query.caseId.trim() : ''
    if (query.scope === 'case' && caseId === '') throw bad(400, '单条用例的列表需要 caseId')

    const roots = await resolveReadRoots(query.sessionId, query.cwd)
    const runs = []
    const seen = new Set()
    for (const root of roots) {
      for (const run of await listRuns(root)) {
        if (run.result === null) continue
        // 同一个 runId 可能在多个资产根里都能看到，只取一份。
        if (seen.has(run.runId)) continue
        if (query.scope === 'case') {
          // 单条用例的执行记录只收单条执行；批量执行只在工具栏的总报告 / 总日志里看。
          if (run.result.scope !== 'case') continue
          if (String(run.result.caseId || '') !== caseId) continue
        } else if (run.result.scope === 'case') {
          continue
        }
        seen.add(run.runId)
        const result = run.result
        const tests = Array.isArray(result.tests) ? result.tests : []
        const matchingTest = query.scope === 'case'
          ? tests.find((item) => item && String(item.caseId || '') === caseId)
          : null
        const caseOutcome = matchingTest && typeof matchingTest.outcome === 'string'
          ? matchingTest.outcome
          : (result.status === 'passed' ? 'passed' : 'failed')
        const caseDuration = matchingTest && typeof matchingTest.durationMs === 'number'
          ? matchingTest.durationMs
          : (typeof result.durationMs === 'number' ? result.durationMs : 0)
        // 输入 / 预期输出取“那次执行冻结的快照”，不是用例当前值。
        const snapshotCase = query.scope === 'case'
          ? await readSnapshotCase(root, run.runId, caseId)
          : null
        runs.push({
          runId: run.runId,
          // 只回传列表需要的摘要字段；完整结果仍走 /result，避免列表过重。
          status: typeof result.status === 'string' ? result.status : '',
          passed: typeof result.passed === 'number' ? result.passed : 0,
          failed: typeof result.failed === 'number' ? result.failed : 0,
          errors: typeof result.errors === 'number' ? result.errors : 0,
          skipped: typeof result.skipped === 'number' ? result.skipped : 0,
          caseOutcome,
          message: matchingTest && typeof matchingTest.message === 'string' ? matchingTest.message : '',
          actual: matchingTest && typeof matchingTest.actual === 'string' ? matchingTest.actual : '',
          // 执行当时的输入 / 预期输出（快照冻结值）。
          input: snapshotCase && typeof snapshotCase.input === 'string' ? snapshotCase.input : '',
          expected: snapshotCase && typeof snapshotCase.expected === 'string' ? snapshotCase.expected : '',
          durationMs: query.scope === 'case' ? caseDuration : (typeof result.durationMs === 'number' ? result.durationMs : 0),
          startedAt: typeof result.startedAt === 'string' ? result.startedAt : '',
          finishedAt: typeof result.finishedAt === 'string' ? result.finishedAt : '',
          note: typeof result.note === 'string' ? result.note : '',
        })
      }
    }
    runs.sort((a, b) => String(b.runId).localeCompare(String(a.runId)))
    send(res, 200, { ok: true, runs })
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
    // 模型分析是旁注，绝不改写执行器的原始日志或结构化结果。
    let analysis = ''
    try {
      analysis = (await readFile(join(dirname(file), 'analysis.md'), 'utf8')).slice(0, 100000)
    } catch { /* 尚未分析时仍正常返回原始日志。 */ }
    send(res, 200, {
      ok: true,
      exists: true,
      content,
      analysis,
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
 * 删除一次执行记录。
 *
 * 只删 `runs/<runId>/` 这一层目录（request.json / result.json / run.log / snapshot/），
 * 不动用例、不动 reports/<runId>/（报告是独立产物，删记录不代表删报告）。
 * runId 走 requireRunId 校验，目录也限定在已知资产根的 runs/ 下，防路径穿越。
 */
async function handleRunDelete(req, res) {
  try {
    if (req.method !== 'POST') {
      send(res, 405, { ok: false, error: '仅支持 POST' })
      return
    }
    const body = await readJson(req)
    const sessionId = extractSessionId(req, body)
    if (sessionId === '') throw bad(400, '缺少会话 ID')
    const runId = requireRunId(body.runId)
    const hint = typeof body.cwd === 'string' ? body.cwd : ''
    const roots = await resolveReadRoots(sessionId, hint)

    // 先在已知资产根里定位这次 run；找不到就明确报 404，不猜路径。
    let dir = ''
    for (const root of roots) {
      const candidate = join(root, 'runs', runId)
      if (existsSyncSafe(candidate)) { dir = candidate; break }
    }
    if (dir === '') throw bad(404, '找不到这次执行记录（可能已被删除）')

    await rm(dir, { recursive: true, force: true })
    send(res, 200, { ok: true, runId })
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
    // reportRoots() 会把集成测试那套根（<root>/integration）也纳入候选。
    const roots = reportRoots(await resolveReadRoots(query.sessionId, query.cwd))
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
      /*
       * 递归读一层子目录。
       *
       * 一键执行的报告目录长这样：
       *   reports/<runId>/
       *     集成测试报告-<项目>-整项目-V0.0.1.docx   ← 总体报告（整本模板）
       *     cases/集成测试报告-<caseId>-全步骤-….docx  ← 每条用例一份（只含 4.1.1 那张表）
       *
       * 面板要能区分「总体报告」和「某条用例的单条报告」，所以子目录里的文件
       * 也要列出来，并在 `kind` 上标明：'overall' | 'case'。
       */
      const pushFile = async (filePath, name, kind) => {
        try {
          const info = await stat(filePath)
          files.push({ name, size: info.size, updatedAt: info.mtime.toISOString(), path: filePath, kind })
        } catch {
          // 单个文件读不到就跳过。
        }
      }
      for (const name of entries.sort()) {
        const full = join(dir, name)
        let info = null
        try {
          info = await stat(full)
        } catch {
          continue
        }
        if (info.isDirectory()) {
          // 子目录（目前只有 cases/）：里面的都是单条用例报告。
          let subEntries = []
          try {
            subEntries = await readdir(full)
          } catch {
            continue
          }
          for (const sub of subEntries.sort()) {
            if (sub.startsWith('~$')) continue   // 同上：跳过 Word 锁文件
            await pushFile(join(full, sub), sub, 'case')
          }
          continue
        }
        // Word 的锁文件形如 `~$xxx.docx`（打开文档时生成，关闭后自动消失）。
        // 必须排除：它只有 162 字节、内容不是 zip，混进列表会让用户点开报
        // 「文件可能已损坏」，而真正的报告明明就在旁边。
        if (name.startsWith('~$')) continue
        await pushFile(full, name, /\.docx$/i.test(name) ? 'overall' : 'meta')
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
        // 让面板区分整体执行与单条执行：工具栏「报告」只打开总报告。
        let scope = 'all'
        let caseId = ''
        try {
          const resultMeta = JSON.parse(await readFile(join(dirname(reportsDir), 'runs', name, 'result.json'), 'utf8'))
          // 范围原样透出（case / cases / all），工具栏「报告」只认 all。
          scope = resultMeta.scope === 'case' ? 'case' : resultMeta.scope === 'cases' ? 'cases' : 'all'
          caseId = typeof resultMeta.caseId === 'string' ? resultMeta.caseId : ''
        } catch {
          // 旧 run 没有 result.json 就按总报告处理。
        }
        seen.add(name)
        runs.push({ runId: name, files, dir, scope, caseId })
      }
    }
    runs.sort((a, b) => String(b.runId).localeCompare(String(a.runId)))
    send(res, 200, { ok: true, runs })
  } catch (error) {
    const status = Number.isInteger(error?.status) ? error.status : 500
    send(res, status, { ok: false, error: error instanceof Error ? error.message : '服务内部错误' })
  }
}

/** 用系统默认程序打开一个文件（报告）。Windows 走 cmd start，不依赖前端 service。 */
function openWithShell(file) {
  return new Promise((resolvePromise, reject) => {
    const platform = process.platform
    const windir = process.env.SystemRoot || process.env.windir || 'C:\\Windows'
    const command = platform === 'win32'
      ? (process.env.ComSpec || join(windir, 'System32', 'cmd.exe'))
      : (platform === 'darwin' ? 'open' : 'xdg-open')
    const args = platform === 'win32' ? ['/c', 'start', '', file] : [file]
    try {
      const child = spawn(command, args, { detached: true, stdio: 'ignore', windowsHide: true })
      child.once('error', reject)
      child.once('spawn', () => {
        child.unref()
        resolvePromise()
      })
    } catch (error) {
      reject(error)
    }
  })
}

/** 打开本会话 reports/ 下的报告文件。 */
async function handleOpenFile(req, res) {
  try {
    if (req.method !== 'POST') {
      send(res, 405, { ok: false, error: '仅支持 POST' })
      return
    }
    const body = await readJson(req)
    const sessionId = extractSessionId(req, body)
    if (sessionId === '') throw bad(400, '缺少会话 ID')
    const raw = typeof body.path === 'string' ? body.path.trim() : ''
    if (raw === '' || !isAbsolute(raw)) throw bad(400, '报告路径必须是绝对路径')
    const file = resolve(raw)
    let info = null
    try {
      info = await stat(file)
    } catch {
      throw bad(404, '报告文件不存在：' + file)
    }
    if (!info.isFile()) throw bad(400, '报告路径不是文件')
    const cwd = await resolveSessionCwd(sessionId, body.cwd)
    const roots = reportRoots(await resolveReadRoots(sessionId, cwd))
    const allowed = roots.some((root) => {
      const reports = resolve(root, 'reports')
      return file === reports || file.startsWith(reports + sep)
    })
    if (!allowed) throw bad(400, '只允许打开本会话 reports/ 下的文件')
    await openWithShell(file)
    send(res, 200, { ok: true })
  } catch (error) {
    const status = Number.isInteger(error?.status) ? error.status : 500
    send(res, status, { ok: false, error: error instanceof Error ? error.message : '服务内部错误' })
  }
}

/**
 * 最近一次执行的报告（一次请求直接给出 docx），供面板「报告」按钮使用：
 * 不用先列全部 run 再查详情，避免多一步请求挂住。
 */
async function handleRunReportLatest(req, res) {
  try {
    if (req.method !== 'GET') {
      send(res, 405, { ok: false, error: '仅支持 GET' })
      return
    }
    const query = runQueryOf(req)
    if (query.sessionId === '') throw bad(400, '缺少会话 ID')
    const scope = query.scope === 'case' ? 'case' : 'all'
    if (scope === 'case' && query.caseId === '') throw bad(400, '单条报告需要 caseId')

    const roots = reportRoots(await resolveReadRoots(query.sessionId, query.cwd))
    let best = null
    for (const root of roots) {
      let names = []
      try {
        names = await readdir(join(root, 'runs'))
      } catch {
        continue
      }
      names.sort()
      names.reverse()
      for (const name of names) {
        if (!/^[A-Za-z0-9_-]{1,80}$/.test(name)) continue
        let meta = null
        try {
          meta = JSON.parse(await readFile(join(root, 'runs', name, 'result.json'), 'utf8'))
        } catch {
          meta = null
        }
        if (meta === null) continue
        if (scope === 'case') {
          // 单条用例的报告只认单条执行；批量执行的汇总报告在工具栏「报告」里。
          if (meta.scope !== 'case') continue
          if (String(meta.caseId || '') !== query.caseId) continue
        } else if (meta.scope === 'case') {
          continue
        }
        if (best === null || name > best.runId) best = { runId: name, root }
        break
      }
    }

    if (best === null) {
      send(res, 200, { ok: true, exists: false })
      return
    }

    const dir = join(best.root, 'reports', best.runId)
    let names = []
    try {
      names = await readdir(dir)
    } catch {
      names = []
    }
    names.sort()
    let docx = null
    const files = []
    for (const name of names) {
      // 跳过 Word 锁文件（`~$xxx.docx`）：它 sort 后排在很前面，
      // 不排除的话下面「取第一个 .docx」会稳定选中这个 162 字节的临时文件。
      if (name.startsWith('~$')) continue
      const file = join(dir, name)
      try {
        const info = await stat(file)
        files.push({ name, size: info.size, updatedAt: info.mtime.toISOString(), path: file })
        if (docx === null && /\.docx$/i.test(name)) {
          docx = { name, size: info.size, updatedAt: info.mtime.toISOString(), path: file }
        }
      } catch {
        // 读不到的文件跳过。
      }
    }
    send(res, 200, { ok: true, exists: true, runId: best.runId, dir, docx, files })
  } catch (error) {
    const status = Number.isInteger(error?.status) ? error.status : 500
    send(res, status, { ok: false, error: error instanceof Error ? error.message : '服务内部错误' })
  }
}

/**
 * 工具探活入口（与语言无关）。
 *
 * 模型在生成用例前用它确认「这台机器能跑哪些测试框架」。
 * 每个 preset 需要哪些工具是 `lib/runners.js` 声明的（`tools: [...]`），
 * 这里只负责按预设清单逐个解析并报告缺什么 —— 新增语言不需要改这个接口。
 *
 * 查询参数：
 *   project=<项目绝对路径>  可选。给了就把项目内 wrapper / venv / node_modules/.bin
 *                            也纳入搜索，并跑一遍框架自动识别。
 */
function handleTools(req, res) {
  try {
    if (req.method !== 'GET') {
      send(res, 405, { ok: false, error: '仅支持 GET' })
      return
    }
    let project = ''
    try {
      const url = new URL(req.url || '/', 'http://localhost')
      const raw = url.searchParams.get('project')
      project = typeof raw === 'string' ? raw.trim() : ''
    } catch {
      project = ''
    }

    // 所有 preset 声明过的工具一次解析完：同一份清单同时服务“逐个 preset 判断”和“列出全部工具”。
    const resolved = resolveTools(PRESET_TOOLS, { project })
    const fromResolved = (specs) => {
      const found = {}
      const missing = []
      for (const spec of specs) {
        const names = Array.isArray(spec) ? spec : [spec]
        const label = names.join('|')
        const hit = names.map((name) => resolved[name] || '').find(Boolean) || ''
        if (hit) found[label] = hit
        else missing.push(label)
      }
      return { resolved: found, missing }
    }

    const presets = {}
    for (const [id, preset] of Object.entries(PRESETS)) {
      const need = Array.isArray(preset.tools) ? preset.tools : []
      // 支持「任选其一」的组：C++ 编译器装 g++ / clang++ / cl 任一个都算可用。
      const specResult = fromResolved(need)
      const buildResult = fromResolved(preset.buildTools || [])
      presets[id] = {
        label: preset.label,
        language: preset.language,
        // 没有任何工具要求（纯自定义命令）也算可用，不能因为没声明 tools 就报不可用。
        available: specResult.missing.length === 0,
        tools: specResult.resolved,
        missing: specResult.missing,
        buildAvailable: buildResult.missing.length === 0,
        buildTools: buildResult.resolved,
        buildMissing: buildResult.missing,
      }
    }

    // 项目给了才自动识别，避免对空路径做无意义的目录扫描。
    let detected = ''
    if (project !== '') {
      try {
        detected = detectPreset({ project })
      } catch {
        detected = ''
      }
    }

    send(res, 200, {
      ok: true,
      project,
      detected,
      detectedAvailable: detected !== '' && presets[detected] ? presets[detected].available : null,
      tools: resolved,
      presets,
      // 解释“为什么没找到”——这些层级都找过了，再找不到就是真不在机器上。
      searched: searchLayers(),
    })
  } catch (error) {
    send(res, 500, { ok: false, error: error instanceof Error ? error.message : '服务内部错误' })
  }
}

/**
 * 集成测试数据层接口。
 *
 * GET  ?sessionId=…&cwd=…&kind=case|step|report[&version=…]
 *      → { ok, kinds: { kind: { index, activeVersion, data } } }
 *      不带 kind 时一次返回三类页面的数据，面板打开一次就够。
 *
 * POST { sessionId, cwd, kind, op, … }
 *      op=createVersion  新建一个版本（每次生成动作都新建，不覆盖）
 *      op=saveVersion    覆盖写某版本内容（面板编辑后保存）
 *      op=setActive      切换当前查看的版本
 *
 * 与单元测试保持一致的两点：
 *   1. 项目目录由宿主自己解析（resolveSessionCwd），不信任请求里的 cwd；
 *   2. 没带 sessionId 一律 400，绝不静默写到别处。
 */
async function handleIntegration(req, res) {
  try {
    let body = {}
    if (req.method === 'POST') {
      try {
        body = await readJson(req)
      } catch (error) {
        send(res, error.status || 400, { ok: false, error: error.message })
        return
      }
    }

    const sessionId = extractSessionId(req, body)
    if (sessionId === '') {
      throw bad(400, '缺少会话 ID：集成测试数据按会话存储，请带上 sessionId 再请求')
    }

    const url = new URL(req.url, 'http://localhost')
    const query = (name) => {
      const fromQuery = url.searchParams.get(name)
      if (typeof fromQuery === 'string' && fromQuery !== '') return fromQuery.trim()
      const fromBody = body?.[name]
      return typeof fromBody === 'string' ? fromBody.trim() : ''
    }

    const project = await resolveSessionCwd(sessionId, query('cwd'))
    const sessionRoot = sessionAssetRoot(project, sessionId)
    const root = integrationRoot(sessionRoot)

    /*
     * 记住这个会话的资产根 —— 与单元测试侧 prepareRun() 的做法完全一致。
     *
     * 为什么必须在这里也记一次：resolveReadRoots() 优先读这份映射
     * （`~/.dsh/plugin-data/dsh-data-panel/assets-<sid>.json`），只有从没执行过
     * 的会话才退回「客户端传的 cwd」。
     *
     * 集成测试面板从来不调 prepareRun()（那是单元测试的执行链路），所以如果这里
     * 不记，集成会话就永远没有映射文件，读侧只能靠 cwd 猜 —— 一旦客户端 cwd 与
     * 真实项目目录有任何偏差（切过工作目录、从别的入口进来），报告/日志/结果
     * 全都找不到。2026-11-20 的「报告明明在磁盘上，面板却说没生成」就是这条引发。
     *
     * 传 sessionRoot（`<项目>/.dsh/test-sessions/<sid>`）而不是 root（带
     * `/integration`）：映射里存的是**标准资产根**，报告侧统一用
     * reportRoots() 在此基础上向下找 integration/，两边口径一致。
     */
    await rememberAssetRoot(sessionId, sessionRoot, project)

    if (req.method === 'GET') {
      const kind = query('kind')
      const version = query('version')
      if (kind !== '') {
        if (!KINDS.includes(kind)) throw bad(400, 'kind 只能是 case / step / report')
        const index = await readIndex(sessionRoot, kind)
        const target = version !== '' ? version : index.activeVersion
        const data = target === '' ? null : await readVersion(sessionRoot, kind, target)
        send(res, 200, { ok: true, root, kind, index, activeVersion: target, data, reportScript: integrationReportScriptPath() })
        return
      }
      const all = await readAll(sessionRoot)
      // reportScript：宿主按插件包自身位置解析出的生成器路径（可能为空）。
      // 面板把它写进话术里，替代过去写死的 `F:\插件开发\...` —— 换机器就失效。
      send(res, 200, { ok: true, root, kinds: all, reportScript: integrationReportScriptPath() })
      return
    }

    if (req.method !== 'POST') {
      send(res, 405, { ok: false, error: '只支持 GET 和 POST' })
      return
    }

    const kind = query('kind')
    if (!KINDS.includes(kind)) throw bad(400, 'kind 只能是 case / step / report')
    const op = typeof body.op === 'string' ? body.op : ''

    if (op === 'createVersion') {
      const created = await createVersion(sessionRoot, kind, {
        name: query('version') || undefined,
        sourceCaseVersion: query('sourceCaseVersion') || undefined,
        sourceStepVersion: query('sourceStepVersion') || undefined,
        runId: query('runId') || undefined,
        features: body.features,
        cases: body.cases,
        steps: body.steps,
        snapshot: body.snapshot,
        report: body.report,
      })
      send(res, 200, { ok: true, ...created })
      return
    }

    if (op === 'saveVersion') {
      const version = query('version')
      if (version === '') throw bad(400, '缺少 version')
      const saved = await saveVersion(sessionRoot, kind, version, body)
      send(res, 200, { ok: true, ...saved })
      return
    }

    if (op === 'setActive') {
      const version = query('version')
      if (version === '') throw bad(400, '缺少 version')
      const index = await setActiveVersion(sessionRoot, kind, version)
      send(res, 200, { ok: true, index })
      return
    }

    throw bad(400, '不支持的 op：' + (op || '(空)'))
  } catch (error) {
    send(res, error.status || 500, { ok: false, error: error instanceof Error ? error.message : '服务内部错误' })
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
    [TEST_CODE_PATH, handleTestCode, 'dsh-data-panel: test code'],
    [RUN_PREPARE_PATH, handleRunPrepare, 'dsh-data-panel: run prepare'],
    [RUN_LATEST_PATH, handleRunLatest, 'dsh-data-panel: run latest'],
    [RUN_LIST_PATH, handleRunList, 'dsh-data-panel: run list'],
    [RUN_LOG_PATH, handleRunLog, 'dsh-data-panel: run log'],
    [RUN_RESULT_PATH, handleRunResult, 'dsh-data-panel: run result'],
    [RUN_REPORT_PATH, handleRunReport, 'dsh-data-panel: run report'],
    [RUN_DELETE_PATH, handleRunDelete, 'dsh-data-panel: run delete'],
    [RUN_REPORT_LATEST_PATH, handleRunReportLatest, 'dsh-data-panel: run report latest'],
    [OPEN_PATH, handleOpenFile, 'dsh-data-panel: open file'],
    [TOOLS_PATH, handleTools, 'dsh-data-panel: tools'],
    [INTEGRATION_PATH, handleIntegration, 'dsh-data-panel: integration store'],
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
  handle,
  handleTools,
  pythonPath,
  nodePath,
  npxPath,
  describeToolchain,
  missingTools,
  PRESETS,
  seedRecords,
  normalizeStored,
  categoryList,
  normalizePatch,
  dataDir,
  dataFile,
  readStore,
  persist,
  sessionAssetRoot,
  integrationReportScriptPath,
  exportCases,
  testFuncOf,
  prepareRun,
  resolveTestCode,
  handleTestCode,
  handleRunReportLatest,
  handleOpenFile,
  listRuns,
  handleRunList,
  handleRunLog,
  handleRunDelete,
  handleIntegration,
  handleRunReport,
  handleRunReportLatest,
  docxForTest: null,
  readIntegration: readAll,
  integrationRoot,
  createIntegrationVersion: createVersion,
  saveIntegrationVersion: saveVersion,
  setIntegrationActive: setActiveVersion,
  readIntegrationIndex: readIndex,
  integrationVersionValue: versionValue,
}
