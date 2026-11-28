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
import { copyFile, mkdir, open, readFile, readdir, rename, rm, stat, unlink, writeFile } from 'node:fs/promises'
import { existsSync, readFileSync } from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import { basename, dirname, isAbsolute, join, resolve, sep } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import {
  PRESET_TOOLS,
  PRESETS,
  describeCoveragePlan,
  detectPreset,
  loadProfile,
  renderRunnerSpec,
  resolveRunner,
  targetDeclareLocation,
  targetDeclared,
  targetOf,
  upgradeCoveragePreset,
} from './runners.js'
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
/** 真实测试名（框架注册名，如 `OrderAddLineTest.AddLine_Zero`）；跳转与执行共用。 */
const MAX_TEST_FUNC = 200
/** 函数内编号（T001）：只用于排序与报告，不当作 title。 */
const MAX_SEQUENCE = 20
/** 内置层级名：固定存在、含全部用例，不能改名/删除。 */
const DEFAULT_CATEGORY = '默认'

const TEST_TYPES = new Set(['functional', 'api', 'boundary', 'logic', 'performance'])

/** 测试类型的中文名：用例标题按「函数短名 + 中文类型」生成，面板与报告共用同一份映射。 */
const TEST_TYPE_LABELS = Object.freeze({
  functional: '功能测试',
  api: '接口测试',
  boundary: '边界测试',
  logic: '逻辑测试',
  performance: '性能测试',
})

/** 「函数短名」长度上限，避免超长函数名把用例标题撑爆。 */
const MAX_FUNCTION_SHORT = 80

/**
 * 从 `subjectFunction` 取函数短名。
 *
 * 值形如 `src/order.cpp::Order::addLine`、`Order.discount` 或 `src/pay.cpp::payable`；
 * 取最后一段标识符（类名/文件名之后的部分），去掉参数表和扩展名。
 * 取不到时返回空串，由调用方决定是否无法派生标准名。
 */
function functionShortName(subjectFunction) {
  let text = String(subjectFunction || '').trim()
  if (text === '') return ''
  if (text.includes('::')) {
    text = text.split('::').filter(Boolean).pop() || ''
  } else {
    // 没有 `::` 时可能是 `Order.discount`，也可能是文件路径；先去掉目录再判断。
    text = text.split(/[\\/]/).filter(Boolean).pop() || ''
    // `Order.discount` 是「类.方法」，`order.cpp` 是文件名：只对已知源码扩展名去后缀。
    text = text.replace(/\.(?:c|cc|cpp|cxx|h|hpp|hxx|py|js|ts|tsx|jsx|go|rs|java|cs|rb|php|swift|kt|m|mm)$/i, '')
  }
  text = text.replace(/\(.*$/, '').trim()
  const parts = text.split(/[.:>]/).filter(Boolean)
  const name = (parts.pop() || '').trim()
  return name.length > MAX_FUNCTION_SHORT ? name.slice(0, MAX_FUNCTION_SHORT) : name
}

/**
 * 用例标准名：`函数短名-中文测试类型`（如 `addLine-边界测试`）。
 *
 * 任一侧不可确定都返回空串 —— 那种情况无法校验，也不能编一个名字出来。
 */
function standardCaseTitle(subjectFunction, testType) {
  const short = functionShortName(subjectFunction)
  const label = TEST_TYPE_LABELS[testType] || ''
  if (short === '' || label === '') return ''
  const title = `${short}-${label}`
  return title.length > MAX_TITLE ? title.slice(0, MAX_TITLE) : title
}

/** 只由编号构成的标题（`T001`、`T0001`）是旧数据形态，新写入一律不接受。 */
const CODE_LIKE_TITLE = /^T\d+$/i

/**
 * 落库前定稿用例标题。
 *
 * 规则：能从 subjectFunction + testType 派生时**以规则为准**（派生名即标准名，忽略传入值，
 * 保证面板列表、执行记录、快照、报告里都是同一个名字）；派生不出来时才沿用传入值，
 * 但仍拒绝纯编号或直接拿 caseId 当名字 —— 那等于没写名字。
 */
function resolveCaseTitle({ title, caseId, subjectFunction, testType }) {
  const derived = standardCaseTitle(subjectFunction, testType)
  if (derived !== '') return derived
  const raw = text(title, MAX_TITLE)
  if (raw === '') throw bad(400, '用例名称不能为空')
  const normalizedId = text(caseId, MAX_CASE_ID)
  if (CODE_LIKE_TITLE.test(raw) || (normalizedId !== '' && raw === normalizedId)) {
    throw bad(
      400,
      `用例名称不能只用编号「${raw}」，请写成「函数名-测试类型」（如 addLine-边界测试）；`
      + '无法确定被测函数时，先填写被测函数再保存。',
    )
  }
  return raw
}

/**
 * 测试代码声明位置：`{ file, line, column, fileSha256 }`。
 *
 * 只在测试代码真的生成/核对过之后写入；`fileSha256` 用来在跳转前判断文件是否已被改过。
 * 不合法时返回 null（明确表示「没有可信位置」），而不是编一个第 1 行。
 */
function normalizeTestLocation(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return null
  const file = text(value.file, 400)
  if (file === '') return null
  const line = Number.isInteger(value.line) && value.line > 0 ? value.line : 0
  const column = Number.isInteger(value.column) && value.column > 0 ? value.column : 1
  const rawSha = typeof value.fileSha256 === 'string' ? value.fileSha256.trim().toLowerCase() : ''
  return {
    file,
    line,
    column,
    fileSha256: /^[0-9a-f]{64}$/.test(rawSha) ? rawSha : '',
  }
}

/** 会话资产（用例 / 测试代码 / 日志 / 报告）在项目内的位置。 */
const SESSION_ASSET_DIR = join('.dsh', 'test-sessions')
const RUN_PREPARE_PATH = '/data-panel/run/prepare'
const TEST_CODE_PATH = '/data-panel/test-code'
const RUN_LATEST_PATH = '/data-panel/run/latest'
const RUN_LIST_PATH = '/data-panel/run/list'
const RUN_SUMMARY_PATH = '/data-panel/run/summary'
const RUN_LOG_PATH = '/data-panel/run/log'
const RUN_RESULT_PATH = '/data-panel/run/result'
const RUN_REPORT_PATH = '/data-panel/run/report'
const RUN_DELETE_PATH = '/data-panel/run/delete'
const OPEN_PATH = '/data-panel/open'
const REPORT_PDF_PATH = '/data-panel/report/pdf'
/** PDF 转换总预算：Word 优先，剩余时间给 LibreOffice 兜底。 */
const REPORT_PDF_TIMEOUT_MS = 90 * 1000
/** 同一份 PDF 的并发转换共享一个 promise，避免重复拉起 Word。 */
const reportPdfJobs = new Map()
const RUN_REPORT_LATEST_PATH = '/data-panel/run/report/latest'
/** 选一个导出目录（宿主弹原生文件夹选择框）。 */
const PICK_DIR_PATH = '/data-panel/export/pick-dir'
/** 把报告复制到用户选定的目录。 */
const EXPORT_PATH = '/data-panel/export'
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

/**
 * 结构化变量值（inputVariables / expectedOutputs 的 value）。
 *
 * 字符串、数字、布尔、null、数组、对象都要原样保留：以前这里只收字符串，
 * 导致 0 / false / null 在落库时就被静默丢掉，报告里只能写「未提供」。
 * 显示转换（十进制文本 / true/false / null / JSON）交给报告侧统一处理。
 *
 * 返回 undefined 表示「不可保存」（undefined / 函数 / 循环引用对象）。
 */
function storeValue(value) {
  if (typeof value === 'string') return value.slice(0, 2000)
  if (typeof value === 'number' || typeof value === 'boolean') return value
  if (value === null) return null
  if (Array.isArray(value) || typeof value === 'object') {
    try {
      const json = JSON.stringify(value)
      // 序列化不了（循环引用、BigInt 等）就不存，避免落盘后变成坏数据。
      return typeof json === 'string' ? value : undefined
    } catch {
      return undefined
    }
  }
  return undefined
}

function namedValues(value, valueKey) {
  if (!Array.isArray(value)) return []
  return value.slice(0, 50).flatMap((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return []
    const name = text(item.name, 120)
    if (!name) return []
    const stored = storeValue(item[valueKey])
    if (stored === undefined) return []
    return [{ name, [valueKey]: stored }]
  })
}


/**
 * 构造要落盘的 `testLocation` 字段。
 *
 * 只有位置合法（有文件、有行号）时才带上这个键；`null` 表示「没有可信位置」，
 * 不写字段也不会伪造一个位置 —— 跳转侧会据此重新按 testFunc 定位或明确报错。
 */
function testLocationField(value) {
  const location = normalizeTestLocation(value)
  return location === null ? {} : { testLocation: location }
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
    // 测试代码声明位置（Step 3 生成后写入）；null/非法值不落库，绝不编造第 1 行。
    ...testLocationField(input.testLocation),
    code: text(input.code, MAX_CODE),
    codeRef: text(input.codeRef, MAX_CODE_REF),
    subjectFunction: text(input.subjectFunction, MAX_SUBJECT_FUNCTION),
    // 真实测试名与函数内编号：Skill 在 Step 3 写回后必须落库，不能只靠用例代码去猜。
    testFunc: text(input.testFunc, MAX_TEST_FUNC),
    sequence: text(input.sequence, MAX_SEQUENCE),
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
  // 标题不在这里取：它由「被测函数 + 测试类型」派生，见下方 resolveCaseTitle。
  if (!TEST_TYPES.has(input.testType)) throw bad(400, '测试类型只能是功能、接口、边界、逻辑或性能测试')
  const suppliedTypes = input.testTypes === undefined
    ? (existing?.testTypes || []).filter((type) => type !== existing?.testType || type === input.testType)
    : input.testTypes
  if (!Array.isArray(suppliedTypes) || suppliedTypes.some((type) => !TEST_TYPES.has(type))) {
    throw bad(400, 'testTypes 必须是五种有效测试类型组成的数组')
  }
  const testTypes = [...new Set([input.testType, ...suppliedTypes])]
  if (testTypes.length > 2) throw bad(400, '一条用例最多选择两种测试类型；独立场景请拆分')
  const subjectFunction = normalizeSubjectFunction(
    input.subjectFunction === undefined ? existing?.subjectFunction : input.subjectFunction,
  )
  const caseId = text(input.caseId, MAX_CASE_ID)
  // 标题由「被测函数 + 测试类型」定稿：能派生就以派生名为准，派生不出来才用传入值（仍拒绝纯编号）。
  const title = resolveCaseTitle({
    title: input.title,
    caseId: caseId || existing?.caseId || '',
    subjectFunction,
    testType: input.testType,
  })
  return {
    ...existing,
    subjectFunction,
    caseId,
    // 真实测试名与函数内编号：Skill 写回后必须落库（否则跳转只能靠代码文本猜）。
    testFunc: text(input.testFunc, MAX_TEST_FUNC),
    sequence: text(input.sequence, MAX_SEQUENCE),
    title,
    testType: input.testType,
    testTypes,
    description: text(input.description, MAX_DESCRIPTION),
    input: text(input.input, MAX_INPUT),
    expected: text(input.expected, MAX_EXPECTED),
    ...(Array.isArray(input.inputVariables) ? { inputVariables: namedValues(input.inputVariables, 'value') } : {}),
    ...(Array.isArray(input.expectedOutputs) ? { expectedOutputs: namedValues(input.expectedOutputs, 'value') } : {}),
    // 测试代码声明位置（Step 3 写入）：跳转与报告都读它。
    ...testLocationField(input.testLocation),
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

    /*
     * 删除「按被测函数」分组 = 连同它下面的用例一起删。
     *
     * 为什么需要单独的接口而不是前端循环调 delete：
     *   1. 前端逐条删是 N 次请求，中途失败会留下半删状态，界面上看着「删了一半」；
     *   2. 一次请求内改完再落盘，才不会出现「删了 3 条、剩 2 条」的中间态。
     *
     * 函数分组是 `subjectFunction` 字段自动聚合出来的，**没有显式清单可删**，
     * 所以「删除分组」的唯一实现就是删掉归到它下面的那些用例。
     */
    if (op === 'deleteFunction') {
      if (typeof body.subjectFunction !== 'string') throw bad(400, '请提供被测函数名')
      const target = normalizeSubjectFunction(body.subjectFunction)
      if (target === '') throw bad(400, '被测函数名不能为空')
      const removed = await serial(async () => {
        const store = await readStore(sessionId)
        const next = store.records.filter((item) => normalizeSubjectFunction(item.subjectFunction) !== target)
        const count = store.records.length - next.length
        if (count === 0) throw bad(404, `找不到被测函数「${target}」下的用例`)
        await persist(next, store.seeded, sessionId, store.categories)
        return count
      })
      send(res, 200, { ok: true, removed, subjectFunction: target })
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

    /*
     * 「按被测函数」分组重命名：把所有 subjectFunction === from 的用例批量改成 to。
     *
     * 与 renameCategory 的区别：层级名存在 store.categories 显式清单里，
     * 而「按被测函数」是记录字段自动聚合出来的分组，没有显式清单可改 ——
     * 只能逐条改字段。所以这里不做「空分组也能改名」，改不到就是 404。
     */
    if (op === 'renameFunction') {
      const from = normalizeSubjectFunction(body.from)
      const to = normalizeSubjectFunction(body.to)
      if (from === '') throw bad(400, '请提供原被测函数名')
      if (to === '') throw bad(400, '新函数名不能为空')
      if (from === to) {
        send(res, 200, { ok: true, moved: 0, from, to })
        return
      }
      const moved = await serial(async () => {
        const store = await readStore(sessionId)
        const updatedAt = new Date().toISOString()
        let count = 0
        const next = store.records.map((record) => {
          if (normalizeSubjectFunction(record.subjectFunction) !== from) return record
          count += 1
          return { ...record, subjectFunction: to, updatedAt }
        })
        if (count === 0) throw bad(404, `找不到被测函数「${from}」下的用例`)
        await persist(next, store.seeded, sessionId, store.categories)
        return count
      })
      send(res, 200, { ok: true, moved, from, to })
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
      // 测试代码声明位置：Step 3 生成测试代码后就有值，报告与“查看测试代码”都读它。
      ...testLocationField(record.testLocation),
      // 函数内编号（T001）：报告排序与序号列用它；title 不再携带序号。
      sequence: text(record.sequence, MAX_SEQUENCE),
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

/** Read one run's case identities once for the whole board, without retaining its full result. */
async function runCaseSummary(root, runId) {
  const dir = join(root, 'runs', runId)
  let result
  try {
    result = JSON.parse(await readFile(join(dir, 'result.json'), 'utf8'))
  } catch {
    return null
  }
  if (result === null || typeof result !== 'object') return null
  const outcomes = new Map()
  const ids = new Set()
  for (const test of Array.isArray(result.tests) ? result.tests : []) {
    const id = typeof test?.caseId === 'string' ? test.caseId : ''
    if (id === '') continue
    ids.add(id)
    if (!outcomes.has(id)) outcomes.set(id, typeof test.outcome === 'string' ? test.outcome : 'unknown')
  }
  for (const id of Array.isArray(result.cases) ? result.cases : []) {
    if (typeof id === 'string' && id !== '') ids.add(id)
  }
  for (const [file, key] of [['request.json', 'targets'], [join('snapshot', 'cases.json'), 'cases']]) {
    try {
      const data = JSON.parse(await readFile(join(dir, file), 'utf8'))
      for (const item of Array.isArray(data?.[key]) ? data[key] : []) {
        if (typeof item?.caseId === 'string' && item.caseId !== '') ids.add(item.caseId)
      }
    } catch { /* Older or interrupted runs may not have these files. */ }
  }
  return { ids, outcomes }
}

/** One board request: each run is parsed once, regardless of the number of cases. */
async function handleRunSummary(req, res) {
  try {
    if (req.method !== 'GET') {
      send(res, 405, { ok: false, error: '仅支持 GET' })
      return
    }
    const query = runQueryOf(req)
    if (query.sessionId === '') throw bad(400, '缺少会话 ID')
    const byCase = Object.create(null)
    const seen = new Map()
    for (const root of await resolveReadRoots(query.sessionId, query.cwd)) {
      let names
      try { names = await readdir(join(root, 'runs')) } catch { continue }
      for (const runId of names) {
        if (req.aborted || res.destroyed) return
        const run = await runCaseSummary(root, runId)
        if (run === null) continue
        for (const id of run.ids) {
          let seenRuns = seen.get(id)
          if (seenRuns === undefined) { seenRuns = new Set(); seen.set(id, seenRuns) }
          if (seenRuns.has(runId)) continue
          seenRuns.add(runId)
          const row = byCase[id] ?? { count: 0, latestOutcome: '', latestRunId: '' }
          row.count += 1
          if (runId > row.latestRunId) {
            row.latestRunId = runId
            row.latestOutcome = run.outcomes.get(id) || 'unknown'
          }
          byCase[id] = row
        }
      }
    }
    send(res, 200, { ok: true, byCase })
  } catch (error) {
    const status = Number.isInteger(error?.status) ? error.status : 500
    send(res, status, { ok: false, error: error instanceof Error ? error.message : '服务内部错误' })
  }
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

/** `result.cases`（本次真正跑到的 caseId 列表）里是否包含这条用例。 */
function containsCaseId(value, caseId) {
  if (!Array.isArray(value) || caseId === '') return false
  return value.some((item) => String(item || '') === String(caseId))
}

/**
 * 本次 run 冻结的目标里是否包含这条用例。
 *
 * 为什么要读 request.json：批量执行时如果逐条结果缺失（构建失败、中断、框架没产出 JUnit），
 * result.tests 可能是空的，但只要目标冻结过，这条用例就确实属于这次 run。
 */
async function runTargetsCase(root, runId, caseId) {
  try {
    const file = join(root, 'runs', runId, 'request.json')
    const parsed = JSON.parse(await readFile(file, 'utf8'))
    return Array.isArray(parsed?.targets)
      && parsed.targets.some((item) => item && String(item.caseId || '') === String(caseId))
  } catch {
    return false
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

/**
 * 本机真的探到 VS 覆盖率工具时，把普通 gtest 运行器升级成带覆盖率的 preset。
 *
 * 为什么必须在「选运行器」这一步做：以前首次执行只会跑普通 gtest，覆盖率要等模型在
 * 后续对话里发现没采到、再手改 runner.json 才采得到。现在条件满足就直接选对。
 * 升级只换 preset（mode / command / coverage 是一整套），不改用户文件；探不到工具就保持原样，
 * 降级而不硬失败，原因由覆盖率计划说明。
 */
function upgradeRunnerForCoverage({ project, root, runner }) {
  // 采集器必须**独立探测**，不能看当前运行器声明的 tools：
  // 普通 gtest / gtest-batch 根本没声明 codecoverage，靠它探就永远升不上去（首跑不采覆盖率的老问题）。
  // 显式路径 DSH_CODECOVERAGE_PATH 优先，其次才是 VS 安装目录/PATH/常见目录，全部在 resolveTool 里。
  // 显式「不采」优先：runner.json 里写了 "coverageRequired": false 就是明确关闭，不再自动升级
  // （用户或测试要固定跑普通 gtest 时用这个开关，而不是依赖本机恰好没装 VS）。
  let explicitOff = false
  try {
    const raw = loadProfile(root)
    explicitOff = raw !== null && Object.hasOwn(raw, 'coverageRequired') && raw.coverageRequired === false
  } catch {
    explicitOff = false
  }
  if (explicitOff) return runner
  const coverageTool = resolveTool('codecoverage', { project })
  if (coverageTool === '') return runner
  const upgraded = upgradeCoveragePreset({
    presetId: runner.id,
    language: runner.language,
    tools: { codecoverage: coverageTool },
  })
  if (upgraded === '') return runner
  try {
    const profile = loadProfile(root)
    const next = resolveRunner({ project, root, profile: { ...(profile || {}), preset: upgraded } })
    // 既然本机有采集器，本次就按「必须采」执行：采不到要明确报未完成，而不是静默当成功。
    return { ...next, coverageRequired: true }
  } catch {
    // 升级解析失败不阻断执行：保留原运行器，覆盖率计划里会写明原因。
    return runner
  }
}

/** 查看代码与执行准备共用同一个项目和运行器选择规则。 */
async function resolveProjectRunner({ sessionId, cwd, scope, caseId, store }) {
  const preferred = resolve(cwd)
  const normalized = (path) => process.platform === 'win32' ? resolve(path).toLowerCase() : resolve(path)
  let lastError = null
  const examine = (project) => {
    const root = sessionAssetRoot(project, sessionId)
    try {
      const base = resolveRunner({ project, root })
      const runner = upgradeRunnerForCoverage({ project, root, runner: base })
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

/**
 * 判断某一行是不是目标测试声明。
 *
 * 用运行器自己的 targetDeclare 判定，而不是「名字在本行出现过」：后者会把注册表、
 * 映射表、注释、字符串里的名字都当成命中，跳过去就是假的。
 */
function rowDeclaresTarget(row, target, runner) {
  if (!row || !target || !runner || !runner.targetDeclare) return false
  const escape = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const replacement = runner.targetDotted
    ? String(target).split('.').map((part) => escape(part)).join('\\s*,\\s*')
    : escape(target)
  const pattern = runner.targetDeclare.split('{target}').join(replacement)
  try {
    return new RegExp(pattern).test(row)
  } catch {
    return false
  }
}

/** 比较两个路径是否指向同一个文件（Windows 不区分大小写）。 */
function sameFileStrict(left, right) {
  const normalize = (value) => {
    const raw = String(value || '').trim()
    if (raw === '') return ''
    const full = resolve(raw)
    return process.platform === 'win32' ? full.toLowerCase() : full
  }
  const a = normalize(left)
  return a !== '' && a === normalize(right)
}

/**
 * 定位「查看测试代码」要打开的真实测试声明。
 *
 * 优先级（不跳级、不兜底）：
 *   ① 用例上已验证的 `testLocation` —— 同一文件且 SHA256 未变、行号仍指向真实声明；
 *   ② 用 `testFunc` + 运行器的 `targetDeclare` 在真实测试文件里重新定位；
 *   ③ 以上都失败 → 明确报「测试映射已失效」。
 *
 * 绝不回退到测试文件第 1 行、注册表、映射表或被测源码：那会让用户以为定位成功了。
 * 重新定位成功而旧位置已失效时，把新位置写回该用例（报告与下次跳转都受益）。
 */
async function resolveTestCode({ sessionId, cwd, caseId, store }) {
  const record = store.records.find((item) => item.caseId === caseId && item.demo !== true)
  if (!record) throw bad(404, `本会话找不到用例 ${caseId}`)
  const { project, root, runner } = await resolveProjectRunner({ sessionId, cwd, scope: 'case', caseId, store })
  if (!existsSyncSafe(runner.testFile)) {
    throw bad(400, `预期测试文件不存在：${runner.testFile}。请检查 runner.json 的 testFile。`)
  }
  const target = testFuncOf(record, runner) || await savedTestFunc(root, caseId)
  const testBytes = await readFile(runner.testFile)
  const testFileSha256 = createHash('sha256').update(testBytes).digest('hex')
  const testText = testBytes.toString('utf8')

  // ── ① 已验证的位置 ──
  const stored = normalizeTestLocation(record.testLocation)
  let location = null
  let locatedBy = ''
  if (stored !== null && stored.line > 0 && sameFileStrict(stored.file, runner.testFile)) {
    const fresh = stored.fileSha256 === '' || stored.fileSha256 === testFileSha256
    const row = testText.split('\n')[stored.line - 1] || ''
    if (fresh && rowDeclaresTarget(row, target, runner)) {
      location = { line: stored.line, column: stored.column || 1 }
      locatedBy = 'testLocation'
    }
  }

  // ── ② 按 testFunc 重新定位（不兜底到第 1 行） ──
  if (location === null) {
    if (target === '') {
      throw bad(400, `用例 ${caseId} 未关联测试函数或测试名，请补充 testFunc。`)
    }
    if (!targetDeclared(testText, target, runner)) {
      throw bad(
        400,
        `测试映射已失效：${runner.testFile} 里找不到测试声明 ${target}。`
        + '请重新生成测试代码（Step 3），或核对用例的 testFunc。',
      )
    }
    location = targetDeclareLocation(testText, target, runner)
    if (location === null) {
      throw bad(
        400,
        `测试映射已失效：能匹配声明规则但定位不到 ${target} 的具体行。请重新生成测试代码。`,
      )
    }
    locatedBy = 'testFunc'
  }

  // 位置变了就写回用例：下次直接命中 ①，报告也能引用。写失败不影响本次跳转。
  const moved = stored === null
    || stored.line !== location.line
    || stored.column !== (location.column || 1)
    || stored.fileSha256 !== testFileSha256
  if (moved) {
    try {
      await serial(async () => {
        const next = await readStore(sessionId)
        const index = next.records.findIndex((item) => item.id === record.id)
        if (index === -1) return
        const previous = next.records[index]
        next.records[index] = {
          ...previous,
          testLocation: {
            file: runner.testFile,
            line: location.line,
            column: location.column || 1,
            fileSha256: testFileSha256,
          },
          // 不改 updatedAt：刷新一个跳转位置不应该把用例顶到列表最前。
          updatedAt: previous.updatedAt,
        }
        await persist(next.records, next.seeded, sessionId, next.categories)
      })
    } catch {
      // 写回失败不影响定位结果。
    }
  }

  const refPath = String(record.codeRef || '').trim().replace(/#L\d+(?:[-~]\d+)?$/, '').replace(/:\d+(?::\d+)?$/, '')
  const refFile = refPath ? (isAbsolute(refPath) ? resolve(refPath) : resolve(project, refPath)) : ''
  return {
    caseId,
    testFile: runner.testFile,
    testFunc: target,
    line: location.line,
    column: location.column || 1,
    locatedBy,
    testLocation: {
      file: runner.testFile,
      line: location.line,
      column: location.column || 1,
      fileSha256: testFileSha256,
    },
    warning: refFile && !sameFileStrict(refFile, runner.testFile)
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

/**
 * 组装覆盖率计划，并把「东西齐不齐」检查集中在这里。
 *
 * 检查项：采集器、配置文件、测试程序、PDB。缺东西不让准备直接失败（否则本来能跑的项目
 * 会完全跑不动），而是把 available 置 false 并给出原因：执行仍会跑测试，结果标为
 * 「测试完成、覆盖率未完成」。
 */
function buildCoveragePlan({ runner, coverage, tools, targetCount }) {
  const plan = describeCoveragePlan({
    coverage,
    tools,
    targetCount,
    required: runner.coverageRequired === true,
    presetId: runner.id,
  })
  if (!plan.available) return plan
  const problems = []
  const configFile = String(plan.configFile || '')
  if (configFile === '' || !existsSyncSafe(configFile)) {
    problems.push(`覆盖率配置文件不存在或不可读：${configFile || '未配置'}`)
  }
  const binary = String(runner.binary || '')
  if (binary !== '' && !existsSyncSafe(binary)) {
    problems.push(`测试程序不存在：${binary}（构建后再执行）`)
  } else if (binary !== '' && !existsSyncSafe(binary.replace(/\.exe$/i, '.pdb'))) {
    problems.push(`测试程序缺少 PDB：${binary.replace(/\.exe$/i, '.pdb')}（无 PDB 时 VS 覆盖率拿不到函数级数据）`)
  }
  if (String(plan.format || '') === 'vs-codecoverage-xml' && (!plan.tool || !plan.tool.path)) {
    problems.push('覆盖率格式是 VS CodeCoverage XML，但本机没探到可用的 CodeCoverage.exe')
  }
  if (problems.length === 0) return { ...plan, warnings: [] }
  // 计划不完整：保留已经冻结的路径与命令（便于排查），但明确标不可用。
  return { ...plan, available: false, reason: problems[0], warnings: problems }
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
  // ── 覆盖率计划：首跑就在准备阶段冻结，写进 request.json 供 runner 与报告共用 ──
  const coveragePlan = buildCoveragePlan({
    runner,
    coverage: runnerSpec.coverage,
    tools: toolStatus.resolved,
    targetCount: targets.length,
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
    // 覆盖率采集计划（工具 / 配置 / 原始 .coverage / 导出 XML / 目标数 / 实际命令）。
    coveragePlan,
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
    coveragePlan,
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
        const result = run.result
        const tests = Array.isArray(result.tests) ? result.tests : []
        // ── 这条用例是否属于本次 run ──
        // 单条（case）、执行选中（cases）、全部执行（all）都要纳入。判定顺序：
        //   ① result.tests[].caseId  ② result.cases  ③ request.json targets[].caseId
        //   ④ 本次快照的 cases.json
        // 只有真实包含这条用例的 run 才生成记录；不属于的整条跳过。
        if (query.scope === 'case') {
          const belongs = tests.some((item) => item && String(item.caseId || '') === caseId)
            || containsCaseId(result.cases, caseId)
            || await runTargetsCase(root, run.runId, caseId)
            || (await readSnapshotCase(root, run.runId, caseId)) !== null
          if (!belongs) continue
        } else if (result.scope === 'case') {
          continue
        }
        seen.add(run.runId)
        const matchingTest = tests.find((item) => item && String(item.caseId || '') === caseId) || null
        // 逐条证据优先。找不到这条用例的逐条结果时**不得**用整体运行状态代替：
        // 整体通过不等于这条通过（可能压根没跑），统一记 unknown（面板显示「未确认」）。
        const notRunEntry = Array.isArray(result.notRun)
          ? result.notRun.find((item) => item && String(item.caseId || '') === caseId) || null
          : null
        let caseOutcome = ''
        if (matchingTest && typeof matchingTest.outcome === 'string') {
          caseOutcome = matchingTest.outcome
        } else if (query.scope === 'case') {
          caseOutcome = 'unknown'
        } else {
          // 工具栏的总记录列表不是“某条用例”的记录，这里才允许用整体状态。
          caseOutcome = result.status === 'passed' ? 'passed' : 'failed'
        }
        const caseMessage = matchingTest && typeof matchingTest.message === 'string'
          ? matchingTest.message
          : (notRunEntry && typeof notRunEntry.reason === 'string' ? notRunEntry.reason : '')
        // 耗时也只看这条用例自己的；没有逐条证据时写 0，不拿整个 run 的时间充数。
        const caseDuration = matchingTest && typeof matchingTest.durationMs === 'number'
          ? matchingTest.durationMs
          : (query.scope === 'case' ? 0 : (typeof result.durationMs === 'number' ? result.durationMs : 0))
        // 输入 / 预期输出取“那次执行冻结的快照”，不是用例当前值；批量 run 也一样。
        const snapshotCase = await readSnapshotCase(root, run.runId, caseId)
        const actualOutputs = matchingTest && Array.isArray(matchingTest.actualOutputs)
          ? matchingTest.actualOutputs
            .filter((item) => item && typeof item === 'object' && typeof item.name === 'string')
            .map((item) => ({ name: item.name, value: item.value }))
          : []
        runs.push({
          runId: run.runId,
          caseId,
          // 这条记录是哪一种执行产生的：单条 / 选中多选 / 全部。
          source: result.scope === 'case' ? 'case' : result.scope === 'cases' ? 'cases' : 'all',
          // 只回传列表需要的摘要字段；完整结果仍走 /result，避免列表过重。
          status: typeof result.status === 'string' ? result.status : '',
          passed: typeof result.passed === 'number' ? result.passed : 0,
          failed: typeof result.failed === 'number' ? result.failed : 0,
          errors: typeof result.errors === 'number' ? result.errors : 0,
          skipped: typeof result.skipped === 'number' ? result.skipped : 0,
          outcome: caseOutcome,
          caseOutcome,
          testFunc: matchingTest && typeof matchingTest.func === 'string' ? matchingTest.func : '',
          message: caseMessage,
          actual: matchingTest && typeof matchingTest.actual === 'string' ? matchingTest.actual : '',
          actualOutputs,
          // 执行当时的输入 / 预期输出（快照冻结值）。
          input: snapshotCase && typeof snapshotCase.input === 'string' ? snapshotCase.input : '',
          expected: snapshotCase && typeof snapshotCase.expected === 'string' ? snapshotCase.expected : '',
          durationMs: caseDuration,
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
    let truncated = false
    try {
      const handle = await open(file, 'r')
      try {
        logStat = await handle.stat()
        const bytes = Buffer.allocUnsafe(MAX_RUN_LOG)
        let offset = 0
        while (offset < bytes.length) {
          const read = await handle.read(bytes, offset, bytes.length - offset, offset)
          if (read.bytesRead === 0) break
          offset += read.bytesRead
        }
        content = bytes.subarray(0, offset).toString('utf8')
        truncated = logStat.size > offset
      } finally {
        await handle.close()
      }
    } catch {
      send(res, 200, { ok: true, exists: false })
      return
    }
    if (truncated) content += '\n\n…(日志过长，仅显示前 4 MB)'
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
            if (/\.pdf$/i.test(sub)) continue    // 同上：PDF 由查看时按需生成，不当独立报告列
            await pushFile(join(full, sub), sub, 'case')
          }
          continue
        }
        // Word 的锁文件形如 `~$xxx.docx`（打开文档时生成，关闭后自动消失）。
        // 必须排除：它只有 162 字节、内容不是 zip，混进列表会让用户点开报
        // 「文件可能已损坏」，而真正的报告明明就在旁边。
        if (name.startsWith('~$')) continue
        // PDF 是查看报告时由 /data-panel/report/pdf 生成的同目录同名文件，
        // 与 docx 是「一份报告两种载体」。列表里**不单独列它**：
        //   · 列出来用户会看到一排重复名（xxx.docx / xxx.pdf），要自己判断点哪个；
        //   · 归成 'meta' 的话，报告页按 kind 挑文件时可能挑到 PDF 去当总体报告。
        // 真正要看 PDF 时，前端点「查看报告」会自动转 + 打开（见 requestReportPdf）。
        if (/\.pdf$/i.test(name)) continue
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

/**
 * 校验一个「本会话 reports/ 下已存在」的报告文件。
 *
 * /data-panel/open 与 /data-panel/report/pdf 共用这份校验：两处各写一遍的话，
 * 任一处改漏都会变成“这个接口能读到别的会话的文件”。
 */
async function resolveReportFile(sessionId, rawPath, hintCwd) {
  const raw = typeof rawPath === 'string' ? rawPath.trim() : ''
  if (raw === '' || !isAbsolute(raw)) throw bad(400, '报告路径必须是绝对路径')
  const file = resolve(raw)
  let info = null
  try {
    info = await stat(file)
  } catch {
    throw bad(404, '报告文件不存在：' + file)
  }
  if (!info.isFile()) throw bad(400, '报告路径不是文件')
  const cwd = await resolveSessionCwd(sessionId, hintCwd)
  const roots = reportRoots(await resolveReadRoots(sessionId, cwd))
  const allowed = roots.some((root) => {
    const reports = resolve(root, 'reports')
    return file === reports || file.startsWith(reports + sep)
  })
  if (!allowed) throw bad(400, '只允许打开本会话 reports/ 下的文件')
  return { file, info, cwd, roots }
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
    const { file } = await resolveReportFile(sessionId, body.path, body.cwd)
    await openWithShell(file)
    send(res, 200, { ok: true })
  } catch (error) {
    const status = Number.isInteger(error?.status) ? error.status : 500
    send(res, status, { ok: false, error: error instanceof Error ? error.message : '服务内部错误' })
  }
}

/** 同名同目录的 PDF 路径。 */
function pdfPathOf(docx) {
  return docx.replace(/\.docx$/i, '.pdf')
}

/** PDF 存在、非空、且不比 docx 旧时才算可复用。 */
async function pdfUpToDate(pdf, docx) {
  try {
    const [pdfInfo, docxInfo] = await Promise.all([stat(pdf), stat(docx)])
    return pdfInfo.isFile() && pdfInfo.size > 0 && pdfInfo.mtimeMs >= docxInfo.mtimeMs
  } catch {
    return false
  }
}

/** 转换刚写完的 PDF 至少要是非空文件。 */
async function pdfWritten(pdf) {
  try {
    const info = await stat(pdf)
    return info.isFile() && info.size > 0
  } catch {
    return false
  }
}

/**
 * 跑一个子进程，带超时；失败/超时都返回原因，不向调用方抛异常。
 * 超时用 SIGKILL 结束 PowerShell / soffice，避免点击后永远挂在等结果。
 */
function runProcess(command, args, timeoutMs) {
  return new Promise((resolvePromise) => {
    let child = null
    try {
      child = spawn(command, args, { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] })
    } catch (error) {
      resolvePromise({ ok: false, reason: error instanceof Error ? error.message : String(error) })
      return
    }
    let stdout = ''
    let stderr = ''
    let settled = false
    let timer = null
    const finish = (result) => {
      if (settled) return
      settled = true
      if (timer !== null) clearTimeout(timer)
      resolvePromise(result)
    }
    child.stdout?.on('data', (chunk) => { stdout += chunk.toString('utf8') })
    child.stderr?.on('data', (chunk) => { stderr += chunk.toString('utf8') })
    child.once('error', (error) => {
      const reason = error?.code === 'ENOENT'
        ? `找不到 ${command}`
        : (error instanceof Error ? error.message : String(error))
      finish({ ok: false, reason })
    })
    child.once('close', (code) => finish({ ok: code === 0, code, stdout, stderr }))
    timer = setTimeout(() => {
      try { child.kill('SIGKILL') } catch { /* 进程可能已经退出 */ }
      finish({ ok: false, timedOut: true, reason: `转换超时（${Math.round(timeoutMs / 1000)} 秒）` })
    }, timeoutMs)
  })
}

/** PowerShell 单引号字符串里的单引号要写两遍。 */
function quotePowerShell(value) {
  return String(value).replace(/'/g, "''")
}

/**
 * 用 Word COM 把 docx 导出成 PDF。
 *
 * 做法对齐 testReport/report-tool/toc_refresh.py：隐藏 Word、关闭弹窗、
 * 只退出“本次由宿主启动”的实例，绝不碰用户已经开着的 Word。
 */
async function convertWithWord(docx, pdf, timeoutMs) {
  const scriptPath = join(tmpdir(), `dsh-data-panel-word-${process.pid}-${Date.now()}.ps1`)
  const script = `$ErrorActionPreference = 'Stop'
$src = '${quotePowerShell(docx)}'
$dst = '${quotePowerShell(pdf)}'
$word = $null
$doc = $null
$startedByUs = $false
try {
  $word = New-Object -ComObject Word.Application
  $startedByUs = ($word.Documents.Count -eq 0)
  $word.Visible = $false
  $word.DisplayAlerts = 0
  $word.AutomationSecurity = 3
  $word.Options.UpdateFieldsAtPrint = $false
  $doc = $word.Documents.Open($src, $false, $true, $false)
  $doc.ExportAsFixedFormat($dst, 17, $false)
  $doc.Close(0)
  $doc = $null
  Write-Output 'OK'
} catch {
  Write-Output ('FAIL ' + $_.Exception.Message)
} finally {
  if ($doc -ne $null) { try { $doc.Close(0) } catch {} }
  if ($word -ne $null) {
    if ($startedByUs) { try { $word.Quit() } catch {} }
    try { [void][System.Runtime.InteropServices.Marshal]::ReleaseComObject($word) } catch {}
  }
}
`
  try {
    // Windows PowerShell 5.1 不带 BOM 时按 ANSI 读脚本；报告路径常含中文，必须写 BOM。
    await writeFile(scriptPath, '\uFEFF' + script, 'utf8')
    const result = await runProcess(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', scriptPath],
      timeoutMs,
    )
    if (!result.ok) {
      const detail = result.reason || (result.stderr || '').trim() || `Word 退出码 ${result.code}`
      return { ok: false, reason: detail }
    }
    const output = (result.stdout || '').trim()
    if (!output.startsWith('OK')) {
      return { ok: false, reason: output.replace(/^FAIL\s*/, '') || 'Word 转换失败' }
    }
    if (!(await pdfWritten(pdf))) return { ok: false, reason: 'Word 没有生成 PDF' }
    return { ok: true, engine: 'word' }
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message : String(error) }
  } finally {
    try { await unlink(scriptPath) } catch { /* 临时脚本可能已不在 */ }
  }
}

/** 找一个可用的 soffice.exe（显式环境变量 → 常见安装目录 → PATH）。 */
function findSoffice() {
  const explicit = (process.env.DSH_SOFFICE_PATH || process.env.SOFFICE_PATH || '').trim()
  if (explicit !== '' && existsSync(explicit)) return explicit
  const candidates = []
  const programFiles = process.env.ProgramFiles || 'C:\\Program Files'
  const programFilesX86 = process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)'
  candidates.push(join(programFiles, 'LibreOffice', 'program', 'soffice.exe'))
  candidates.push(join(programFilesX86, 'LibreOffice', 'program', 'soffice.exe'))
  if (process.env.LOCALAPPDATA) {
    candidates.push(join(process.env.LOCALAPPDATA, 'Programs', 'LibreOffice', 'program', 'soffice.exe'))
  }
  const pathValue = process.env.PATH || ''
  const parts = pathValue.split(process.platform === 'win32' ? ';' : ':')
  for (const part of parts) {
    const dir = part.trim()
    if (dir === '') continue
    candidates.push(join(dir, 'soffice.exe'))
    candidates.push(join(dir, 'soffice'))
  }
  for (const candidate of candidates) {
    try {
      if (existsSync(candidate)) return candidate
    } catch {
      // 不可读的目录直接跳过。
    }
  }
  return ''
}

/** LibreOffice 兜底：只写同目录同名 PDF，并给独立的用户配置目录避免锁冲突。 */
async function convertWithSoffice(docx, pdf, timeoutMs) {
  const soffice = findSoffice()
  if (soffice === '') return { ok: false, reason: '未安装 LibreOffice（soffice.exe）' }
  const profileDir = join(tmpdir(), `dsh-data-panel-soffice-${process.pid}-${Date.now()}`)
  const result = await runProcess(
    soffice,
    [
      '--headless',
      '--norestore',
      `-env:UserInstallation=${pathToFileURL(profileDir).href}`,
      '--convert-to', 'pdf',
      '--outdir', dirname(pdf),
      docx,
    ],
    timeoutMs,
  )
  if (!result.ok) {
    const detail = result.reason || (result.stderr || '').trim() || `soffice 退出码 ${result.code}`
    return { ok: false, reason: detail }
  }
  if (!(await pdfWritten(pdf))) return { ok: false, reason: 'LibreOffice 没有生成 PDF' }
  return { ok: true, engine: 'libreoffice' }
}

/** Word 优先、LibreOffice 兜底；总预算 90 秒，任一成功即返回。 */
async function convertDocxToPdf(docx, pdf) {
  const deadline = Date.now() + REPORT_PDF_TIMEOUT_MS
  const reasons = []
  // 旧 PDF 在这里删：并发的第二个请求会复用一个 job，不会重复删刚写好的文件。
  try { await unlink(pdf) } catch { /* 没有旧 PDF */ }
  const word = await convertWithWord(docx, pdf, Math.min(60000, REPORT_PDF_TIMEOUT_MS))
  if (word.ok) return { ok: true, engine: word.engine }
  reasons.push('Word：' + word.reason)
  try { await unlink(pdf) } catch { /* Word 半途失败的残留 */ }
  const remaining = deadline - Date.now()
  if (remaining < 1000) {
    reasons.push('LibreOffice：没有剩余时间')
    return { ok: false, reason: reasons.join('；') }
  }
  const soffice = await convertWithSoffice(docx, pdf, remaining)
  if (soffice.ok) return { ok: true, engine: soffice.engine }
  reasons.push('LibreOffice：' + soffice.reason)
  return { ok: false, reason: reasons.join('；') }
}

/** 同一份 PDF 的并发转换共享同一个 promise。 */
function convertDocxToPdfOnce(docx, pdf) {
  const key = pdf.toLowerCase()
  const running = reportPdfJobs.get(key)
  if (running !== undefined) return running
  const job = convertDocxToPdf(docx, pdf).finally(() => {
    if (reportPdfJobs.get(key) === job) reportPdfJobs.delete(key)
  })
  reportPdfJobs.set(key, job)
  return job
}

/**
 * 给右侧栏准备 PDF：输入必须是本会话 reports/ 下的 .docx。
 *
 * 成功返回同目录同名 .pdf；转换器都不可用时返回 200 + { ok:false, reason }，
 * 让客户端无痛回退到原来的 docx 打开链路，而不是把点击变成报错。
 */
async function handleReportPdf(req, res) {
  try {
    if (req.method !== 'POST') {
      send(res, 405, { ok: false, error: '仅支持 POST' })
      return
    }
    const body = await readJson(req)
    const sessionId = extractSessionId(req, body)
    if (sessionId === '') throw bad(400, '缺少会话 ID')
    const { file } = await resolveReportFile(sessionId, body.path, body.cwd)
    if (!/\.docx$/i.test(file)) throw bad(400, '只支持 .docx 报告')
    const pdf = pdfPathOf(file)
    if (await pdfUpToDate(pdf, file)) {
      send(res, 200, { ok: true, path: pdf, cached: true, engine: 'cache' })
      return
    }
    const outcome = await convertDocxToPdfOnce(file, pdf)
    if (outcome.ok) {
      send(res, 200, { ok: true, path: pdf, cached: false, engine: outcome.engine })
      return
    }
    send(res, 200, { ok: false, error: outcome.reason, reason: outcome.reason, docx: file })
  } catch (error) {
    const status = Number.isInteger(error?.status) ? error.status : 500
    send(res, status, { ok: false, error: error instanceof Error ? error.message : '服务内部错误' })
  }
}

/**
 * 解析「选文件夹」脚本的 stdout。
 *
 * 为什么不让 PowerShell 直接 `Write-Output 'OK <路径>'`：PS 5.1 在 stdout
 * 被重定向时按**控制台代码页**编码（中文系统是 GBK），而 runProcess 按 UTF-8
 * 解码 —— 中文目录名必然乱码，随后 resolveExportDirectory 会拿着乱码路径
 * 找不到目录，导出直接失败。所以路径一律走 Base64（纯 ASCII）回传。
 */
function parsePickDirOutput(stdout) {
  const output = String(stdout || '').trim()
  const decodeB64 = (text) => Buffer.from(text, 'base64').toString('utf8')
  if (output.startsWith('OK64 ')) {
    const dir = decodeB64(output.slice(5).trim()).trim()
    if (dir === '') return { ok: false, reason: '选择目录失败：没有取到路径' }
    return { ok: true, dir }
  }
  // 兼容旧格式：脚本回退成纯文本时仍能用（中文路径可能乱码）。
  if (output.startsWith('OK ')) return { ok: true, dir: output.slice(3).trim() }
  if (output === 'CANCEL') return { ok: true, canceled: true, dir: '' }
  if (output.startsWith('FAIL64 ')) {
    return { ok: false, reason: decodeB64(output.slice(7).trim()) || '选择目录失败' }
  }
  return { ok: false, reason: output.replace(/^FAIL\s*/, '') || '选择目录失败' }
}

/**
 * 弹原生「选择文件夹」对话框，返回用户选的绝对路径。
 *
 * 为什么要宿主来做：面板跑在浏览器里，`<input webkitdirectory>` 与
 * Chromium 的 `showDirectoryPicker()` 都只给文件内容或 handle，**拿不到绝对路径**，
 * 而导出必须知道要往哪个盘哪个目录写。所以这里起一个 PowerShell 子进程，
 * 用 System.Windows.Forms.FolderBrowserDialog 弹系统原生目录框。
 *
 * 用户点取消时返回 200 + { ok:true, canceled:true }，不是错误 ——
 * 取消是正常操作，前端静默处理即可。
 */
async function pickExportDirectory(timeoutMs = 5 * 60 * 1000) {
  // 必须是 STA 线程：FolderBrowserDialog 在 MTA 下会直接抛异常。
  // -File 方式启动的 powershell.exe 默认就是 STA，这里显式再声明一次。
  const script = `$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Windows.Forms | Out-Null
# 中文路径不能用 Write-Output 直接输出：PS 5.1 重定向 stdout 时按控制台代码页（GBK）
# 编码，Node 侧按 UTF-8 解码就成乱码。Base64 是纯 ASCII，跨代码页安全。
function Write-B64([string]$prefix, [string]$text) {
  $bytes = [System.Text.Encoding]::UTF8.GetBytes($text)
  Write-Output ($prefix + ' ' + [System.Convert]::ToBase64String($bytes))
}
$dialog = New-Object System.Windows.Forms.FolderBrowserDialog
$dialog.Description = '选择报告导出到的文件夹'
$dialog.ShowNewFolderButton = $true
try {
  $result = $dialog.ShowDialog()
  if ($result -eq [System.Windows.Forms.DialogResult]::OK) {
    Write-B64 'OK64' $dialog.SelectedPath
  } else {
    Write-Output 'CANCEL'
  }
} catch {
  Write-B64 'FAIL64' $_.Exception.Message
} finally {
  if ($dialog -ne $null) { try { $dialog.Dispose() } catch {} }
}
`
  const scriptPath = join(tmpdir(), `dsh-data-panel-pickdir-${process.pid}-${Date.now()}.ps1`)
  try {
    // PowerShell 5.1 读无 BOM 的 UTF-8 会按 ANSI 解析；对话框说明是中文，必须写 BOM。
    await writeFile(scriptPath, '\uFEFF' + script, 'utf8')
    const result = await runProcess(
      'powershell.exe',
      ['-NoProfile', '-STA', '-ExecutionPolicy', 'Bypass', '-File', scriptPath],
      timeoutMs,
    )
    if (!result.ok) {
      const detail = result.reason || (result.stderr || '').trim() || `选择目录失败（退出码 ${result.code}）`
      return { ok: false, reason: detail }
    }
    return parsePickDirOutput(result.stdout)
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message : String(error) }
  } finally {
    try { await unlink(scriptPath) } catch { /* 脚本可能没写成功 */ }
  }
}

/** 导出目录必须已存在、是目录、且不是某个报告文件本身。 */
async function resolveExportDirectory(raw) {
  const value = typeof raw === 'string' ? raw.trim() : ''
  if (value === '') throw bad(400, '缺少导出目录')
  if (!isAbsolute(value)) throw bad(400, '导出目录必须是绝对路径')
  const dir = resolve(value)
  let info = null
  try {
    info = await stat(dir)
  } catch {
    throw bad(404, '导出目录不存在：' + dir)
  }
  if (!info.isDirectory()) throw bad(400, '导出目录不是文件夹：' + dir)
  return dir
}

/**
 * 目标目录里已经有同名文件时，给一个不冲突的名字：`名 (1).docx`、`名 (2).docx`…
 *
 * 用户明确要求「自动加序号后缀，不覆盖已有文件」—— 导出是往外拷，
 * 静默覆盖掉对方目录里原有的文件是不可接受的副作用。
 */
async function freeNameIn(dir, name) {
  const dot = name.lastIndexOf('.')
  const stem = dot > 0 ? name.slice(0, dot) : name
  const ext = dot > 0 ? name.slice(dot) : ''
  let candidate = name
  for (let index = 1; index < 1000; index += 1) {
    try {
      await stat(join(dir, candidate))
    } catch {
      return candidate   // 不存在，可以用
    }
    candidate = `${stem} (${index})${ext}`
  }
  // 极端情况：同名文件太多，退回带时间戳的名字，绝不覆盖。
  return `${stem} (${Date.now()})${ext}`
}

/** 多选合并用的脚本与模板（随插件资产分发，不依赖仓库外的路径）。 */
function mergeScriptPath() {
  return fileURLToPath(new URL('../assets/report/merge_reports.py', import.meta.url))
}

function mergeTemplatePath() {
  return fileURLToPath(new URL('../assets/report/配置项测试报告模板.docx', import.meta.url))
}

/**
 * 把多份单条报告合并成一份 Word（每张用例表一页）。
 *
 * 交给 assets/report/merge_reports.py 去做：插件是 Node.js，没有 python-docx，
 * 而「把已排好版的表格 XML 原样搬过来」正是 python-docx 最稳的用法。
 * 脚本失败时返回 null，调用方回退到「分别导出」——不能让用户点了导出却什么都没有。
 */
async function mergeReportsInto(targetDir, sources, skipped) {
  const script = mergeScriptPath()
  const template = mergeTemplatePath()
  const name = await freeNameIn(targetDir, '集成测试报告-选中用例汇总.docx')
  const out = join(targetDir, name)
  const result = await runProcess(
    pythonPath(),
    [script, '--template', template, '--out', out, ...sources],
    120000,
  )
  if (!result.ok) {
    const detail = result.reason || (result.stderr || '').trim() || `合并脚本退出码 ${result.code}`
    skipped.push({ path: '', reason: '合并失败：' + detail })
    return null
  }
  const output = String(result.stdout || '').trim()
  if (!output.startsWith('OK')) {
    skipped.push({ path: '', reason: '合并失败：' + (output || '脚本没有返回成功标记') })
    return null
  }
  // 脚本输出形如 `OK <路径> <表数>`；表数以脚本为准，别用输入数量冒充（可能有文件被跳过）。
  const count = Number(output.split(/\s+/).pop()) || sources.length
  return { path: out, name, count }
}

/**
 * 把若干份报告复制到用户选定的目录。
 *
 * 入参 `paths` 是报告文件路径。每一份都走 resolveReportFile 的校验，
 * **只允许复制本会话 reports/ 下的文件** —— 否则这个接口就成了
 * 「传任意路径就能把机器上任何文件拷出来」的漏洞。
 * 只接受 .docx：本次需求明确只支持 docx，PDF 由查看时按需生成。
 */
async function handleExport(req, res) {
  try {
    if (req.method !== 'POST') {
      send(res, 405, { ok: false, error: '仅支持 POST' })
      return
    }
    const body = await readJson(req)
    const sessionId = extractSessionId(req, body)
    if (sessionId === '') throw bad(400, '缺少会话 ID')
    const targetDir = await resolveExportDirectory(body.dir)
    const list = Array.isArray(body.paths) ? body.paths : (typeof body.path === 'string' ? [body.path] : [])
    if (list.length === 0) throw bad(400, '没有要导出的报告')

    const exported = []
    const skipped = []
    /** 通过校验的源文件（合并时的输入）。只有它们能进合并件。 */
    const resolvedFiles = []
    for (const rawPath of list) {
      let file = ''
      try {
        const resolved = await resolveReportFile(sessionId, rawPath, body.cwd)
        file = resolved.file
        if (!/\.docx$/i.test(file)) {
          skipped.push({ path: String(rawPath || ''), reason: '只支持导出 .docx' })
          continue
        }
        const name = await freeNameIn(targetDir, basename(file))
        await copyFile(file, join(targetDir, name))
        exported.push({ from: file, to: join(targetDir, name), name })
        resolvedFiles.push(file)
      } catch (error) {
        // 单份失败不影响其余：整批中断会让用户不知道到底导出成功了哪几份。
        skipped.push({
          path: String(rawPath || file || ''),
          reason: error instanceof Error ? error.message : String(error),
        })
      }
    }

    /*
     * 多选合并：勾了多条时导出的是**一份**拼好的 Word，不是 N 个散文件。
     *
     * 用户明确要求「多选导出是合在一起的一个 word 文档，单条报告的表拼接在一起」：
     *   · 单条 → 仍走上面的复制（点行内导出图标，一次就一份）
     *   · 多条 → 换成一份汇总件，每个用例一张表、一张表一页
     *
     * 上面那轮复制是「逐份校验」用的：合并只接受真正通过 resolveReportFile 的
     * 文件，否则合并接口就成了「传任意路径就能把机器上的文件读进 Word」。
     * 复制出去的单份文件随后删掉，目录里只留合并件。
     */
    if (resolvedFiles.length > 1) {
      const merged = await mergeReportsInto(targetDir, resolvedFiles, skipped)
      if (merged !== null) {
        for (const item of exported) {
          try { await unlink(item.to) } catch { /* 已经是合并件的输入，删不掉也不影响结果 */ }
        }
        send(res, 200, {
          ok: true,
          dir: targetDir,
          merged: true,
          count: merged.count,
          exported: [{ from: '', to: merged.path, name: merged.name }],
          skipped,
        })
        return
      }
      // 合并失败时保留上面复制好的单份文件，让用户至少拿到东西，同时说明原因。
      send(res, 200, {
        ok: true,
        dir: targetDir,
        merged: false,
        exported,
        skipped,
        warning: '合并失败，已改为分别导出 ' + exported.length + ' 份',
      })
      return
    }

    if (exported.length === 0) {
      send(res, 200, { ok: false, dir: targetDir, exported, skipped, error: '没有成功导出任何报告' })
      return
    }
    send(res, 200, { ok: true, dir: targetDir, merged: false, exported, skipped })
  } catch (error) {
    const status = Number.isInteger(error?.status) ? error.status : 500
    send(res, status, { ok: false, error: error instanceof Error ? error.message : '服务内部错误' })
  }
}

/** 选导出目录：宿主弹原生文件夹框，返回绝对路径。 */
async function handlePickDir(req, res) {
  try {
    if (req.method !== 'POST') {
      send(res, 405, { ok: false, error: '仅支持 POST' })
      return
    }
    const outcome = await pickExportDirectory()
    if (outcome.ok !== true) {
      send(res, 200, { ok: false, error: outcome.reason || '选择目录失败' })
      return
    }
    send(res, 200, { ok: true, canceled: outcome.canceled === true, dir: outcome.dir || '' })
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
    [RUN_SUMMARY_PATH, handleRunSummary, 'dsh-data-panel: run summary'],
    [RUN_LOG_PATH, handleRunLog, 'dsh-data-panel: run log'],
    [RUN_RESULT_PATH, handleRunResult, 'dsh-data-panel: run result'],
    [RUN_REPORT_PATH, handleRunReport, 'dsh-data-panel: run report'],
    [RUN_DELETE_PATH, handleRunDelete, 'dsh-data-panel: run delete'],
    [RUN_REPORT_LATEST_PATH, handleRunReportLatest, 'dsh-data-panel: run report latest'],
    [OPEN_PATH, handleOpenFile, 'dsh-data-panel: open file'],
    [REPORT_PDF_PATH, handleReportPdf, 'dsh-data-panel: report pdf'],
    [PICK_DIR_PATH, handlePickDir, 'dsh-data-panel: export pick dir'],
    [EXPORT_PATH, handleExport, 'dsh-data-panel: export reports'],
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
  handleReportPdf,
  handleExport,
  handlePickDir,
  pickExportDirectory,
  parsePickDirOutput,
  freeNameIn,
  resolveExportDirectory,
  listRuns,
  handleRunList,
  handleRunSummary,
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
