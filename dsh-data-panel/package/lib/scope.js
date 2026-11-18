/** Source inventory and run-bound scope evidence. No source code is executed here. */
import { createHash } from 'node:crypto'
import { readFileSync, readdirSync, realpathSync, statSync } from 'node:fs'
import { resolve, relative, isAbsolute, extname } from 'node:path'
import { fileURLToPath } from 'node:url'

const SOURCE_EXTENSIONS = new Set(['.c', '.cc', '.cpp', '.cxx', '.h', '.hpp', '.hxx', '.inl', '.py', '.js', '.jsx', '.mjs', '.cjs', '.ts', '.tsx', '.go', '.rs', '.java', '.cs', '.rb', '.php'])
const OMIT_DIRECTORIES = new Set(['.git', '.dsh', '.codex-tmp', 'node_modules', '__pycache__', '.venv', 'venv', 'bin', 'obj', 'build', 'dist', 'target'])
const inside = (root, file) => { const path = relative(root, file); return path !== '..' && !path.startsWith('../') && !path.startsWith('..\\') && !isAbsolute(path) }
const key = (path) => path.replace(/\\/g, '/')

export function scanSourceFiles(project, sourceRoots = ['.']) {
  const base = realpathSync(project)
  if (!Array.isArray(sourceRoots) || sourceRoots.length === 0 || sourceRoots.some((root) => typeof root !== 'string')) throw new Error('sourceRoots 必须是非空路径数组')
  const files = new Map()
  const visited = new Set()
  function walk(path) {
    const real = realpathSync(path)
    if (!inside(base, real)) throw new Error('扫描路径必须位于项目内')
    if (visited.has(real)) return
    visited.add(real)
    if (visited.size > 50000) throw new Error('扫描超过 50000 个路径，请明确业务源码目录后重试，不得将截断扫描当作全量')
    const info = statSync(real)
    if (info.isDirectory()) {
      for (const entry of readdirSync(real, { withFileTypes: true })) {
        if (entry.isSymbolicLink()) continue
        if (entry.isDirectory() && OMIT_DIRECTORIES.has(entry.name)) continue
        walk(resolve(real, entry.name))
      }
    } else if (SOURCE_EXTENSIONS.has(extname(real).toLowerCase())) {
      const bytes = readFileSync(real)
      files.set(key(relative(base, real)), { path: key(relative(base, real)), sha256: createHash('sha256').update(bytes).digest('hex'), status: 'deferred', reason: '待逐文件审查与函数枚举', functions: [] })
    }
  }
  for (const root of sourceRoots) walk(resolve(base, root))
  return [...files.values()].sort((a, b) => a.path.localeCompare(b.path))
}

export function scopeInventory(project, sourceRoots = ['.']) {
  return { version: 1, sourceRoots, omittedDirectories: [...OMIT_DIRECTORIES], files: scanSourceFiles(project, sourceRoots) }
}

export function assessScope(project, document, cases, selectedCaseIds = cases.map((item) => item.caseId)) {
  const warnings = []
  const proofEvidence = []
  const summary = { scannedFiles: 0, testedFiles: 0, excludedFiles: 0, declarationFiles: 0, deferredFiles: 0, declaredFunctions: 0, linkedFunctions: 0 }
  if (!document) return { status: 'missing', warnings: ['未提供 scope.json，不能据此认定本次覆盖整个项目'], summary, selectedCaseIds }
  try {
    if (document.version !== 1 || !Array.isArray(document.files)) throw new Error('范围清单需要 version=1 和 files 数组')
    const scanned = scanSourceFiles(project, document.sourceRoots)
    summary.scannedFiles = scanned.length
    if (scanned.length === 0) warnings.push('源码扫描为空，请核对 sourceRoots')
    const records = new Map(cases.map((item) => [item.caseId, item]))
    const declared = new Map()
    for (const item of document.files) {
      if (!item || typeof item.path !== 'string') { warnings.push('范围清单存在缺少 path 的条目'); continue }
      const path = key(item.path)
      if (declared.has(path)) warnings.push(`范围文件重复：${path}`)
      declared.set(path, item)
    }
    const seenSymbols = new Set()
    const selected = new Set(selectedCaseIds)
    const linkedCaseIds = new Set()
    for (const source of scanned) {
      const item = declared.get(source.path)
      if (!item) { summary.deferredFiles++; warnings.push(`扫描到的源码未列入清单：${source.path}`); continue }
      declared.delete(source.path)
      if (item.sha256 !== source.sha256) warnings.push(`源码已变化或未记录 SHA256：${source.path}`)
      if (item.status === 'tested') summary.testedFiles++
      else if (item.status === 'excluded') {
        summary.excludedFiles++
        const proof = item.proof
        let hasLog = false
        if (typeof proof?.logFile === 'string') {
          const log = resolve(project, proof.logFile)
          try {
            hasLog = inside(realpathSync(project), realpathSync(log)) && statSync(log).isFile() && statSync(log).size > 0
            if (hasLog) {
              const bytes = readFileSync(log)
              proofEvidence.push({ file: source.path, logFile: key(relative(project, log)), sha256: createHash('sha256').update(bytes).digest('hex'), command: proof.command, exitCode: proof.exitCode, content: bytes.toString('utf8').slice(0, 16000), truncated: bytes.length > 16000 })
            }
          } catch { /* 缺证据不能当作已验证。 */ }
        }
        if (!item.reason || !proof?.command || !Number.isInteger(proof.exitCode) || !hasLog) warnings.push(`排除项缺少理由或可核对的命令/退出码/日志证据：${source.path}`)
        if (proof?.exitCode === 0 && !item.reason) warnings.push(`编译探针通过却被排除：${source.path}`)
      } else if (item.status === 'declaration') {
        summary.declarationFiles++
        if (!item.reason) warnings.push(`声明文件缺少审查说明：${source.path}`)
      } else { summary.deferredFiles++; warnings.push(`源码尚未纳入或排除：${source.path}（${item.reason || '未说明原因'}）`) }
      const functions = Array.isArray(item.functions) ? item.functions : []
      if (item.status === 'tested' && functions.length === 0) warnings.push(`已测文件未枚举业务函数：${source.path}`)
      for (const fn of functions) {
        summary.declaredFunctions++
        if (!fn || typeof fn.subjectFunction !== 'string' || !fn.subjectFunction.trim()) { warnings.push(`函数字段无效：${source.path}`); continue }
        if (seenSymbols.has(fn.subjectFunction)) warnings.push(`函数重复：${fn.subjectFunction}`)
        seenSymbols.add(fn.subjectFunction)
        const ids = Array.isArray(fn.caseIds) ? [...new Set(fn.caseIds)] : []
        const matches = ids.filter((id) => records.get(id)?.subjectFunction === fn.subjectFunction)
        if (matches.length === 0) warnings.push(`函数没有匹配的面板用例：${fn.subjectFunction}`)
        else { summary.linkedFunctions++; matches.forEach((id) => linkedCaseIds.add(id)) }
        for (const id of ids) if (!matches.includes(id)) warnings.push(`用例与函数关联不一致：${fn.subjectFunction} / ${id}`)
      }
    }
    for (const path of declared.keys()) warnings.push(`范围条目不在当前源码扫描中：${path}`)
    for (const id of selected) if (!linkedCaseIds.has(id)) warnings.push(`本次用例未关联范围清单中的函数：${id}`)
    return { status: warnings.length ? 'warning' : 'reviewed', warnings, summary, selectedCaseIds, inventory: document, proofEvidence, note: '文件清单由磁盘校验；函数枚举和排除结论仍需审查。此统计不是语句/分支覆盖率。' }
  } catch (error) {
    return { status: 'invalid', warnings: [error.message], summary, selectedCaseIds }
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const [, , project, ...roots] = process.argv
    if (!project) throw new Error('用法：node scope.js <项目绝对路径> [源码目录 ...]；只输出清单，不写项目文件')
    process.stdout.write(JSON.stringify(scopeInventory(project, roots.length ? roots : ['.']), null, 2) + '\n')
  } catch (error) { process.stderr.write(error.message + '\n'); process.exitCode = 1 }
}
