import { execFile } from 'node:child_process'
import { existsSync } from 'node:fs'
import { readFile, realpath } from 'node:fs/promises'
import { homedir } from 'node:os'
import { isAbsolute, join, relative, resolve } from 'node:path'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)
const MAX_BODY = 64 * 1024

function send(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' })
  res.end(JSON.stringify(body))
}

async function readBody(req) {
  let body = ''
  for await (const chunk of req) {
    body += chunk
    if (body.length > MAX_BODY) throw new Error('请求过大')
  }
  return JSON.parse(body || '{}')
}

function pythonPath() {
  if (process.env.DSH_PYTHON_PATH) return process.env.DSH_PYTHON_PATH
  const home = process.env.DSH_HOME || join(homedir(), '.dsh')
  const bundled = join(home, 'dsh-runtimes', 'dsh-primary-runtime', 'dependencies', 'python', 'python.exe')
  return existsSync(bundled) ? bundled : 'python'
}

async function testFunction(cwd, caseId) {
  const path = join(cwd, '.dsh', 'testcases', 'cases.json')
  const parsed = JSON.parse((await readFile(path, 'utf8')).replace(/^\uFEFF/, ''))
  const cases = Array.isArray(parsed) ? parsed : parsed.cases
  const record = Array.isArray(cases) ? cases.find(item => item.caseId === caseId) : null
  if (!record) throw new Error(`找不到测试用例 ${caseId}`)
  if (typeof record.testFunc === 'string' && record.testFunc.trim()) return record.testFunc.trim()
  const match = typeof record.code === 'string' && record.code.match(/\bdef\s+(test_[A-Za-z0-9_]+)\s*\(/)
  if (match) return match[1]
  throw new Error(`用例 ${caseId} 没有关联的测试函数`)
}

export async function handleRun(req, res) {
  if (req.method !== 'POST') {
    send(res, 405, { ok: false, error: '仅支持 POST' })
    return
  }
  try {
    const { caseId, testFile, cwd } = await readBody(req)
    if (typeof caseId !== 'string' || !caseId || typeof testFile !== 'string' || !testFile || typeof cwd !== 'string' || !cwd) {
      send(res, 400, { ok: false, error: '缺少 caseId、testFile 或当前项目目录' })
      return
    }
    const workDir = await realpath(cwd)
    const file = await realpath(resolve(workDir, testFile))
    const rel = relative(workDir, file)
    if (rel.startsWith('..') || isAbsolute(rel)) {
      send(res, 400, { ok: false, error: '测试文件必须位于当前项目内' })
      return
    }
    const args = ['-m', 'pytest', file, '-v', '--tb=short', '--no-header', '-p', 'no:warnings']
    if (caseId !== '__ALL__') args.push('-k', await testFunction(workDir, caseId))
    let passed = false
    let output = ''
    try {
      const result = await execFileAsync(pythonPath(), args, {
        cwd: workDir,
        encoding: 'utf8',
        timeout: 120000,
        maxBuffer: 2 * 1024 * 1024,
        windowsHide: true,
        env: { ...process.env, PYTHONIOENCODING: 'utf-8', PYTHONUNBUFFERED: '1' },
      })
      passed = true
      output = result.stdout + result.stderr
    } catch (error) {
      output = String(error.stdout || '') + String(error.stderr || '') || error.message
    }
    send(res, 200, { ok: true, caseId, passed, output: output.trim().slice(-3000) })
  } catch (error) {
    send(res, 400, { ok: false, error: error.message })
  }
}
