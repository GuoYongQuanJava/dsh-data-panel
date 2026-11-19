/**
 * 集成测试数据层（host 侧）。
 *
 * 职责：把 `<项目>/.dsh/test-sessions/<sessionId>/integration/` 下的三套版本目录
 * 读成面板能用的结构，并把面板上的增删改写回磁盘。
 *
 * 为什么单独一个文件而不是塞进 index.js：
 *   index.js 已经 1900+ 行且全是单元测试的 store / runner / 报告逻辑。集成测试的
 *   数据模型完全不同（三套独立版本 + 功能项分层 + 步骤表），混在一起两边都难维护。
 *   这里只做「读写磁盘」，不碰 HTTP、不碰单元测试的任何常量。
 *
 * 目录约定（与集成测试 Skill 一致）：
 *   integration/
 *     case-versions/   index.json + V0_0_1/{features,cases}.json
 *     step-versions/   index.json + V0_0_1/{steps,cases.snapshot,exec-records}.json
 *     report-versions/ index.json + V0_0_1/report.json
 */
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'

/** 三个页面各自的版本目录名。 */
export const KINDS = ['case', 'step', 'report']

const KIND_DIRS = {
  case: 'case-versions',
  step: 'step-versions',
  report: 'report-versions',
}

/**
 * 版本号三段式（V0.0.1）。
 *
 * 面板按数字段比较，绝不能当字符串比：'V0.0.10' < 'V0.0.9' 是错的。
 * 与前端 `itVersionValue()` 使用同一套编码，保证两边排序一致。
 */
export function versionValue(name) {
  const text = typeof name === 'string' ? name.replace(/^[Vv]/, '') : ''
  const parts = text.split('.')
  const major = parseInt(parts[0], 10) || 0
  const minor = parseInt(parts[1], 10) || 0
  const patch = parseInt(parts[2], 10) || 0
  return major * 1000000 + minor * 1000 + patch
}

/** 新建版本的默认名：当前最大值 +1（patch 位递增）。 */
export function nextVersionName(versions) {
  const list = Array.isArray(versions) ? versions : []
  let max = -1
  for (const item of list) {
    const value = versionValue(item?.name)
    if (value > max) max = value
  }
  if (max < 0) return 'V0.0.1'
  const major = Math.floor(max / 1000000)
  const minor = Math.floor((max % 1000000) / 1000)
  const patch = max % 1000
  return `V${major}.${minor}.${patch + 1}`
}

/** 版本名 → 目录名：点换下划线，避免把点当扩展名分隔符的坑。 */
export function versionDir(name) {
  return String(name || '').replace(/\./g, '_')
}

/** 版本名合法性：只允许 V + 三段数字，防止路径穿越。 */
export function requireVersionName(raw) {
  const value = typeof raw === 'string' ? raw.trim() : ''
  if (!/^V\d{1,3}(\.\d{1,3}){0,2}$/.test(value)) {
    const error = new Error('版本号不合法：' + (value || '(空)'))
    error.status = 400
    throw error
  }
  return value
}

/** 集成测试的根目录（在会话资产目录下）。 */
export function integrationRoot(sessionRoot) {
  return join(sessionRoot, 'integration')
}

/** 某个页面（case/step/report）的版本根目录。 */
export function kindRoot(sessionRoot, kind) {
  const dir = KIND_DIRS[kind]
  if (!dir) {
    const error = new Error('未知的数据类别：' + kind)
    error.status = 400
    throw error
  }
  return join(integrationRoot(sessionRoot), dir)
}

async function readJsonSafe(file, fallback) {
  try {
    const raw = await readFile(file, 'utf8')
    const parsed = JSON.parse(raw)
    return parsed === null || parsed === undefined ? fallback : parsed
  } catch {
    return fallback
  }
}

/** 原子写：先写临时文件再 rename，避免半截 JSON 被读到。 */
async function writeJson(file, value) {
  await mkdir(dirname(file), { recursive: true })
  const temp = `${file}.${process.pid}.${Date.now()}.tmp`
  await writeFile(temp, JSON.stringify(value, null, 2), 'utf8')
  try {
    await rename(temp, file)
  } catch {
    await writeFile(file, JSON.stringify(value, null, 2), 'utf8')
  }
}

/**
 * 读某个页面的版本索引。
 *
 * 目录不存在时返回空索引而不是报错 —— 集成测试在用户第一次生成用例之前
 * 就是没有数据的，这不是错误。
 */
export async function readIndex(sessionRoot, kind) {
  const dir = kindRoot(sessionRoot, kind)
  const index = await readJsonSafe(join(dir, 'index.json'), null)
  if (index && Array.isArray(index.versions)) {
    return {
      versions: index.versions,
      activeVersion: typeof index.activeVersion === 'string' ? index.activeVersion : (index.versions[0]?.name || ''),
      byVersion: index.byVersion && typeof index.byVersion === 'object' ? index.byVersion : {},
    }
  }
  return { versions: [], activeVersion: '', byVersion: {} }
}

/**
 * 读一个版本里的实际内容。
 *
 * 返回结构直接把文件里的数组/对象透传，字段名沿用 Skill 约定：
 *   case   → { features: [...], cases: [...] }
 *   step   → { steps: [...], execRecords: {...}, snapshot: {...} }
 *   report → { report: {...} }
 */
export async function readVersion(sessionRoot, kind, version) {
  const name = requireVersionName(version)
  const dir = join(kindRoot(sessionRoot, kind), versionDir(name))

  if (kind === 'case') {
    const features = await readJsonSafe(join(dir, 'features.json'), [])
    const cases = await readJsonSafe(join(dir, 'cases.json'), [])
    return {
      version: name,
      features: Array.isArray(features) ? features : (features.features || []),
      cases: Array.isArray(cases) ? cases : (cases.cases || []),
    }
  }

  if (kind === 'step') {
    const steps = await readJsonSafe(join(dir, 'steps.json'), [])
    const records = await readJsonSafe(join(dir, 'exec-records.json'), {})
    const snapshot = await readJsonSafe(join(dir, 'cases.snapshot.json'), null)
    // steps.json 有两种写法：数组（纯步骤列表）或对象（含 cases[]，每条挂自己的步骤）。
    // 两种都要吃下来，不能只认数组。对象形态下把 cases 里的步骤摊平成 steps。
    let list = []
    let cases = []
    if (Array.isArray(steps)) {
      list = steps
    } else if (steps && typeof steps === 'object') {
      if (Array.isArray(steps.cases)) {
        cases = steps.cases
        list = steps.cases
      } else if (Array.isArray(steps.steps)) {
        list = steps.steps
      }
    }
    return {
      version: name,
      steps: list,
      cases,
      meta: steps && !Array.isArray(steps) ? {
        stepVersion: steps.stepVersion,
        sourceCaseVersion: steps.sourceCaseVersion,
        generatedAt: steps.generatedAt,
        channelLegend: steps.channelLegend,
      } : null,
      execRecords: records && typeof records === 'object' && !Array.isArray(records) ? records : {},
      snapshot,
    }
  }

  const report = await readJsonSafe(join(dir, 'report.json'), null)
  return { version: name, report }
}

/**
 * 面板一次性要的全部数据。
 *
 * 三个页面各自有「当前版本」，各自读自己的。某个页面还没数据时给空数组，
 * 不要抛错 —— 首次使用时三个页面都是空的。
 */
export async function readAll(sessionRoot) {
  const result = {}
  for (const kind of KINDS) {
    const index = await readIndex(sessionRoot, kind)
    const active = index.activeVersion || index.versions[index.versions.length - 1]?.name || ''
    const data = active ? await readVersion(sessionRoot, kind, active) : null
    result[kind] = { index, activeVersion: active, data }
  }
  return result
}

/**
 * 新建一个版本（每次生成动作都新建，绝不覆盖旧版本）。
 *
 * `seed` 提供该版本的初始内容；不传就是空。
 */
export async function createVersion(sessionRoot, kind, options = {}) {
  const dirRoot = kindRoot(sessionRoot, kind)
  const index = await readIndex(sessionRoot, kind)
  const name = options.name ? requireVersionName(options.name) : nextVersionName(index.versions)
  const now = options.at || new Date().toISOString()

  const entry = {
    name,
    at: now,
    status: 'current',
    ...(options.sourceCaseVersion ? { sourceCaseVersion: options.sourceCaseVersion } : {}),
    ...(options.sourceStepVersion ? { sourceStepVersion: options.sourceStepVersion } : {}),
    ...(options.runId ? { runId: options.runId } : {}),
  }

  // 旧版本一律转为 archived，新的成为 current；旧版本目录保留不删。
  const versions = index.versions.map((item) => ({
    ...item,
    status: item?.name === name ? 'current' : 'archived',
  }))
  if (!versions.some((item) => item.name === name)) versions.push(entry)

  const byVersion = { ...index.byVersion }
  const rel = versionDir(name)
  if (kind === 'case') {
    byVersion[name] = {
      features: `${rel}/features.json`,
      cases: `${rel}/cases.json`,
      generatedAt: now,
    }
  } else if (kind === 'step') {
    byVersion[name] = {
      steps: `${rel}/steps.json`,
      snapshot: `${rel}/cases.snapshot.json`,
      execRecords: `${rel}/exec-records.json`,
      sourceCaseVersion: options.sourceCaseVersion || '',
      generatedAt: now,
    }
  } else {
    byVersion[name] = {
      report: `${rel}/report.json`,
      runId: options.runId || '',
      sourceStepVersion: options.sourceStepVersion || '',
    }
  }

  // 目录与空文件先落地，后面的写入才有落点。
  const dir = join(dirRoot, rel)
  await mkdir(dir, { recursive: true })

  const nextIndex = { versions, activeVersion: name, byVersion }
  await writeJson(join(dirRoot, 'index.json'), nextIndex)

  if (kind === 'case') {
    if (!existsSync(join(dir, 'features.json'))) await writeJson(join(dir, 'features.json'), options.features || [])
    if (!existsSync(join(dir, 'cases.json'))) await writeJson(join(dir, 'cases.json'), options.cases || [])
  } else if (kind === 'step') {
    if (!existsSync(join(dir, 'steps.json'))) await writeJson(join(dir, 'steps.json'), options.steps || [])
    if (!existsSync(join(dir, 'cases.snapshot.json'))) await writeJson(join(dir, 'cases.snapshot.json'), options.snapshot || [])
    if (!existsSync(join(dir, 'exec-records.json'))) await writeJson(join(dir, 'exec-records.json'), options.execRecords || {})
  } else if (options.report) {
    await writeJson(join(dir, 'report.json'), options.report)
  }

  return { name, index: nextIndex }
}

/**
 * 覆盖写某个版本的内容（面板编辑后保存走这里）。
 *
 * 只写该版本自己目录下的文件，不动 index.json，也不碰其他版本。
 */
export async function saveVersion(sessionRoot, kind, version, payload = {}) {
  const name = requireVersionName(version)
  const dir = join(kindRoot(sessionRoot, kind), versionDir(name))

  if (kind === 'case') {
    if (Array.isArray(payload.features)) await writeJson(join(dir, 'features.json'), payload.features)
    if (Array.isArray(payload.cases)) await writeJson(join(dir, 'cases.json'), payload.cases)
    return { version: name }
  }
  if (kind === 'step') {
    if (Array.isArray(payload.steps)) await writeJson(join(dir, 'steps.json'), payload.steps)
    if (payload.execRecords && typeof payload.execRecords === 'object') {
      await writeJson(join(dir, 'exec-records.json'), payload.execRecords)
    }
    return { version: name }
  }
  if (payload.report !== undefined) await writeJson(join(dir, 'report.json'), payload.report)
  return { version: name }
}

/** 切换某页面当前查看的版本。 */
export async function setActiveVersion(sessionRoot, kind, version) {
  const name = requireVersionName(version)
  const dirRoot = kindRoot(sessionRoot, kind)
  const index = await readIndex(sessionRoot, kind)
  if (!index.versions.some((item) => item?.name === name)) {
    const error = new Error('版本不存在：' + name)
    error.status = 404
    throw error
  }
  const versions = index.versions.map((item) => ({
    ...item,
    status: item?.name === name ? 'current' : 'archived',
  }))
  const nextIndex = { ...index, versions, activeVersion: name }
  await writeJson(join(dirRoot, 'index.json'), nextIndex)
  return nextIndex
}