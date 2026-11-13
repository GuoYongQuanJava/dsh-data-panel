/**
 * dsh-data-panel — host half.
 *
 * Owns a small JSON record store and exposes it over one same-origin route:
 *   GET  /data-panel/api            → { ok, records, demoCount, seeded }
 *   POST /data-panel/api { op, … }  → create / update / delete / clearDemo
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
const MAX_BODY = 1024 * 1024
const MAX_TITLE = 200
const MAX_CATEGORY = 40
const MAX_OWNER = 80
const MAX_URL = 2000
const MAX_SUMMARY = 2000
const MAX_CONTENT = 20000
const STATUSES = new Set(['todo', 'doing', 'done', 'blocked'])
const PRIORITIES = new Set(['high', 'medium', 'low'])

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

function httpUrl(value) {
  const raw = text(value, MAX_URL)
  if (!raw) return ''
  const candidate = /^[a-z][a-z0-9+.-]*:/i.test(raw) ? raw : `https://${raw}`
  try {
    const parsed = new URL(candidate)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed.toString() : ''
  } catch {
    return ''
  }
}

function isoOrNow(value) {
  if (typeof value === 'string' && Number.isFinite(Date.parse(value))) return value
  return new Date().toISOString()
}

function isoAgo(hours) {
  return new Date(Date.now() - hours * 3600 * 1000).toISOString()
}

/** First-run records, marked `demo` so the UI can label them visibly. */
function seedRecords() {
  return [
    {
      id: 'demo-roadmap',
      title: 'Q4 产品路线图评审',
      category: '产品',
      status: 'doing',
      priority: 'high',
      owner: '林晓',
      url: 'https://example.com/roadmap',
      summary: '汇总三条产品线的 Q4 目标，确认优先级、依赖和验收口径。',
      content:
        '## 会议目标\n\n- 对齐 Q4 三条产品线的优先级\n- 确认跨团队依赖与负责人\n- 输出一页可签字的路线图\n\n## 待确认\n\n1. 数据中台版本窗口\n2. 移动端发版节奏',
      demo: true,
      createdAt: isoAgo(30),
      updatedAt: isoAgo(2),
    },
    {
      id: 'demo-perf',
      title: '登录页首屏性能优化',
      category: '研发',
      status: 'todo',
      priority: 'medium',
      owner: '陈默',
      url: '',
      summary: '把登录页 LCP 从 3.2s 压到 1.8s 以内，先做资源拆包和图片压缩。',
      content:
        '## 现状\n\n- LCP 3.2s（移动端 4G）\n- 首包 680 KB\n\n## 计划\n\n- [ ] 路由级拆包\n- [ ] 登录插画改 WebP\n- [ ] 字体子集化',
      demo: true,
      createdAt: isoAgo(26),
      updatedAt: isoAgo(8),
    },
    {
      id: 'demo-feedback',
      title: '客户反馈周报（第 45 周）',
      category: '运营',
      status: 'done',
      priority: 'low',
      owner: '王悦',
      url: '',
      summary: '本周共收集 37 条反馈，其中 6 条进入需求池，1 条需要本周回复。',
      content:
        '## 本周概览\n\n- 新增反馈 37 条\n- 进入需求池 6 条\n- 需本周回复 1 条\n\n## 高频关键词\n\n导出、权限、速度',
      demo: true,
      createdAt: isoAgo(20),
      updatedAt: isoAgo(20),
    },
  ]
}

function normalizeStored(input) {
  if (input === null || typeof input !== 'object' || typeof input.id !== 'string' || input.id === '') return null
  return {
    id: input.id.slice(0, 120),
    title: text(input.title, MAX_TITLE) || '未命名记录',
    category: text(input.category, MAX_CATEGORY) || '未分类',
    status: STATUSES.has(input.status) ? input.status : 'todo',
    priority: PRIORITIES.has(input.priority) ? input.priority : 'medium',
    owner: text(input.owner, MAX_OWNER),
    url: httpUrl(input.url),
    summary: text(input.summary, MAX_SUMMARY),
    content: text(input.content, MAX_CONTENT),
    demo: input.demo === true,
    createdAt: isoOrNow(input.createdAt),
    updatedAt: isoOrNow(input.updatedAt),
  }
}

function normalizePatch(input, existing) {
  const title = text(input.title, MAX_TITLE)
  if (!title) throw bad(400, '标题不能为空')
  return {
    ...existing,
    title,
    category: text(input.category, MAX_CATEGORY) || '未分类',
    status: STATUSES.has(input.status) ? input.status : existing.status,
    priority: PRIORITIES.has(input.priority) ? input.priority : existing.priority,
    owner: text(input.owner, MAX_OWNER),
    url: httpUrl(input.url),
    summary: text(input.summary, MAX_SUMMARY),
    content: text(input.content, MAX_CONTENT),
    updatedAt: new Date().toISOString(),
  }
}

async function quarantine() {
  try {
    await rename(dataFile(), `${dataFile()}.corrupt-${Date.now()}`)
  } catch {
    // Nothing to preserve.
  }
}

async function persist(records, seeded) {
  await mkdir(dataDir(), { recursive: true })
  const payload = JSON.stringify({ version: 1, seeded: seeded === true, records }, null, 2)
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
      await quarantine()
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
            title: '',
            category: '未分类',
            status: 'todo',
            priority: 'medium',
            owner: '',
            url: '',
            summary: '',
            content: '',
            createdAt: now,
          }),
          id: `rec_${randomUUID().replace(/-/g, '').slice(0, 12)}`,
          demo: false,
          createdAt: now,
        }
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
