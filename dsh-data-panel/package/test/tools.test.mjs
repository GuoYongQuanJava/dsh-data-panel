import test from 'node:test'
import assert from 'node:assert/strict'

import { __test } from '../lib/index.js'

/** 最小 res 桩：只记录状态码与响应体。 */
function fakeRes() {
  return {
    status: 0,
    body: '',
    headersSent: false,
    writeHead(status) {
      this.status = status
    },
    end(payload) {
      this.body = payload
    },
  }
}

function callTools(url) {
  const res = fakeRes()
  __test.handleTools({ method: 'GET', url }, res)
  return { status: res.status, data: JSON.parse(res.body) }
}

test('GET /data-panel/tools 按 preset 清单报告每种框架是否可用', () => {
  const { status, data } = callTools('/data-panel/tools')

  assert.equal(status, 200)
  assert.equal(data.ok, true)

  // 工具表：每个键都是字符串（找到给绝对路径，没找到给空串，不能是 undefined）。
  assert.equal(typeof data.tools, 'object')
  for (const [tool, value] of Object.entries(data.tools)) {
    assert.equal(typeof value, 'string', `tools.${tool} 必须是字符串`)
  }

  // 每个内置 preset 都要有一项，且 available / missing 自洽。
  const ids = Object.keys(__test.PRESETS)
  assert.ok(ids.length > 0)
  for (const id of ids) {
    const preset = data.presets[id]
    assert.ok(preset, `presets 缺少 ${id}`)
    assert.equal(typeof preset.available, 'boolean')
    assert.ok(Array.isArray(preset.missing))
    assert.equal(preset.available, preset.missing.length === 0)
    assert.equal(preset.buildAvailable, preset.buildMissing.length === 0)
    for (const label of preset.missing) {
      // 缺失项可能是单个工具名，也可能是「任选其一」的组（如 g++|clang++|cl）。
      // 组的每个成员都必须在扁平工具表里解析不到，否则就是判定和事实不一致。
      for (const tool of label.split('|')) {
        assert.equal(data.tools[tool] || '', '', `${id} 缺 ${tool}，工具表里却给了路径`)
      }
    }
  }
  assert.ok(Object.hasOwn(data.tools, 'cmake'))
  assert.ok(Object.hasOwn(data.tools, 'g++'))
  assert.deepEqual(data.presets.gtest.missing, [])
  assert.ok(Array.isArray(data.presets.gtest.buildMissing))

  // 搜索层级要露出来，方便排查“为什么没找到”。
  assert.ok(Array.isArray(data.searched))
  assert.ok(data.searched.length >= 3)
})

test('带 project 时返回框架自动识别结果', () => {
  const project = process.cwd()
  const { data } = callTools(`/data-panel/tools?project=${encodeURIComponent(project)}`)

  assert.equal(data.ok, true)
  assert.equal(data.project, project)
  // 没有标记文件的项目可能识别不出来，但字段必须是字符串，不能是 undefined。
  assert.equal(typeof data.detected, 'string')
  if (data.detected !== '') {
    assert.ok(Object.hasOwn(data.presets, data.detected))
    assert.equal(typeof data.detectedAvailable, 'boolean')
  } else {
    assert.equal(data.detectedAvailable, null)
  }
})

test('非 GET 请求返回 405', () => {
  const res = fakeRes()
  __test.handleTools({ method: 'POST', url: '/data-panel/tools' }, res)

  assert.equal(res.status, 405)
  assert.equal(JSON.parse(res.body).ok, false)
})

test('pythonPath / nodePath / npxPath 永远有兜底值', () => {
  for (const fn of ['pythonPath', 'nodePath', 'npxPath']) {
    const value = __test[fn]()
    assert.equal(typeof value, 'string')
    assert.ok(value.length > 0, `${fn} 不能返回空串`)
  }
})

test('describeToolchain 把缺的工具写进提示里', () => {
  const text = __test.describeToolchain({ tools: ['python', 'definitely-not-installed-tool'] }, '')
  assert.ok(text.includes('python='))
  assert.ok(text.includes('definitely-not-installed-tool'))
  assert.ok(text.includes('缺少'))
})
