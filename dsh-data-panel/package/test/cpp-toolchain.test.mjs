import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { resolveSpecs, resolveTool, customSearchDirs } from '../lib/toolchain.js'

/** 造一个「假安装」目录树，返回根路径。 */
function makeTree(entries) {
  const root = mkdtempSync(join(tmpdir(), 'dsh-cpp-'))
  for (const rel of entries) {
    const file = join(root, rel)
    mkdirSync(join(file, '..'), { recursive: true })
    writeFileSync(file, 'fake', 'utf8')
  }
  return root
}

/** 临时设置/恢复环境变量。 */
function withEnv(name, value, fn) {
  const previous = process.env[name]
  process.env[name] = value
  try {
    return fn()
  } finally {
    if (previous === undefined) delete process.env[name]
    else process.env[name] = previous
  }
}

test('C++：只装了 clang++ 也算可用（编译器三选一）', () => {
  const root = makeTree(['llvm/bin/clang++.exe'])
  withEnv('DSH_TOOL_SEARCH_DIRS', join(root, 'llvm', 'bin'), () => {
    const { resolved, missing } = resolveSpecs([['g++', 'clang++', 'cl']])
    assert.deepEqual(missing, [], '任选其一命中就不该算缺')
    assert.equal(resolved['g++|clang++|cl'], join(root, 'llvm', 'bin', 'clang++.exe'))
  })
})

test('C++：三个编译器都没有时才报缺，且报的是整组', () => {
  const root = makeTree(['empty/.keep'])
  withEnv('DSH_TOOL_SEARCH_DIRS', join(root, 'empty'), () => {
    const { resolved, missing } = resolveSpecs([['g++', 'clang++', 'cl']])
    assert.deepEqual(Object.keys(resolved), [])
    assert.deepEqual(missing, ['g++|clang++|cl'])
  })
})

test('VS 那种多级通配目录能被搜到（MSVC 的 cl.exe / CMake 都在这类布局里）', () => {
  const root = makeTree([
    'Microsoft Visual Studio/2022/Community/VC/Tools/MSVC/14.40.33807/bin/Hostx64/x64/cl.exe',
    'Microsoft Visual Studio/2022/Community/Common7/IDE/CommonExtensions/Microsoft/CMake/CMake/bin/cmake.exe',
    'Microsoft Visual Studio/2022/Community/Common7/IDE/CommonExtensions/Microsoft/CMake/CMake/bin/ctest.exe',
  ])
  const dirs = [
    join(root, 'Microsoft Visual Studio', '*', '*', 'VC', 'Tools', 'MSVC', '*', 'bin', 'Hostx64', 'x64'),
    join(
      root,
      'Microsoft Visual Studio', '*', '*',
      'Common7', 'IDE', 'CommonExtensions', 'Microsoft', 'CMake', 'CMake', 'bin',
    ),
  ].join(';')

  withEnv('DSH_TOOL_SEARCH_DIRS', dirs, () => {
    assert.ok(resolveTool('cl').endsWith('Hostx64\\x64\\cl.exe') || resolveTool('cl').endsWith('Hostx64/x64/cl.exe'))
    assert.ok(resolveTool('cmake').endsWith('cmake.exe'))
    assert.ok(resolveTool('ctest').endsWith('ctest.exe'))
  })
})

test('MSYS2 布局（mingw64/bin 下的 g++）', () => {
  const root = makeTree(['msys64/mingw64/bin/g++.exe'])
  withEnv('DSH_TOOL_SEARCH_DIRS', join(root, 'msys64', 'mingw64', 'bin'), () => {
    assert.ok(resolveTool('g++').endsWith('g++.exe'))
  })
})

test('自定义搜索目录支持分号分隔的多目录', () => {
  const root = makeTree(['a/bin/one.exe', 'b/bin/two.exe'])
  const dirs = [join(root, 'a', 'bin'), join(root, 'b', 'bin')].join(';')

  withEnv('DSH_TOOL_SEARCH_DIRS', dirs, () => {
    assert.deepEqual(customSearchDirs(), [join(root, 'a', 'bin'), join(root, 'b', 'bin')])
    assert.ok(resolveTool('one').endsWith('one.exe'))
    assert.ok(resolveTool('two').endsWith('two.exe'))
  })
})

test('preset 的 tools 允许「任选其一」；纯字符串仍然工作', () => {
  const root = makeTree(['bin/go.exe'])
  withEnv('DSH_TOOL_SEARCH_DIRS', join(root, 'bin'), () => {
    const { resolved, missing } = resolveSpecs(['go', ['g++', 'clang++', 'cl']])
    assert.ok(resolved.go.endsWith('go.exe'))
    assert.deepEqual(missing, ['g++|clang++|cl'])
  })
})