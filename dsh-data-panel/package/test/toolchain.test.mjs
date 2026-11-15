import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { resolveTool, resolveTools, toolNames, pathDirs } from '../lib/toolchain.js'

test('能解析出 Python / Node（与它们装在哪无关）', () => {
  const python = resolveTool('python')
  const node = resolveTool('node')
  assert.equal(typeof python, 'string')
  assert.equal(typeof node, 'string')
  // 这台机器的测试环境一定有其中一个来源（DSH 自带运行时 / PATH / 常见安装目录）。
  // 断言“至少不是空串”，避免把测试绑死在某个绝对路径上。
  assert.ok(python.length > 0, '应该能在某个搜索层级里找到 python')
  assert.ok(node.length > 0, '应该能在某个搜索层级里找到 node')
})

test('完全不存在工具返回空串，而不是抛错或瞎猜', () => {
  assert.equal(resolveTool('dsh-definitely-not-a-tool-9f3a'), '')
  assert.equal(resolveTool(''), '')
})

test('项目内 wrapper 优先于全局工具（gradlew / mvnw 这类）', () => {
  const project = mkdtempSync(join(tmpdir(), 'dsh-toolchain-'))
  const wrapper = join(project, process.platform === 'win32' ? 'mvnw.cmd' : 'mvnw')
  writeFileSync(wrapper, '#!/bin/sh\n', 'utf8')

  const resolved = resolveTool('mvn', { project })
  assert.equal(resolved, wrapper, '项目带的 mvnw 应该先于全局 mvn 被选中')
})

test('不传 project 时不会去读项目目录（不会误命中 wrapper）', () => {
  const project = mkdtempSync(join(tmpdir(), 'dsh-toolchain-'))
  writeFileSync(join(project, 'gradlew'), '#!/bin/sh\n', 'utf8')

  // 没有 project 上下文时，wrapper 不在候选里；结果只能是空串或机器上的真 gradle。
  const resolved = resolveTool('gradle', {})
  assert.ok(resolved === '' || !resolved.startsWith(project))
})

test('别名：python 也会试 python3，gcc 也会试 cc', () => {
  assert.ok(toolNames('python').includes('python3'))
  assert.ok(toolNames('gcc').includes('cc'))
  // 主名永远排第一。
  assert.equal(toolNames('python')[0], 'python')
})

test('resolveTools 批量解析并对重复名去重', () => {
  const resolved = resolveTools(['node', 'node', 'dsh-definitely-not-a-tool-9f3a'])
  assert.deepEqual(Object.keys(resolved).sort(), ['dsh-definitely-not-a-tool-9f3a', 'node'])
  assert.ok(resolved.node.length > 0)
  assert.equal(resolved['dsh-definitely-not-a-tool-9f3a'], '')
})

test('PATH 能拆成目录列表', () => {
  const dirs = pathDirs()
  assert.ok(Array.isArray(dirs))
  assert.ok(dirs.length > 0)
})
