import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { noSpawn, withSandbox } from './sandbox.mjs'

const here = dirname(fileURLToPath(import.meta.url))

const validate = join(here, '..', 'scripts', 'validate.mjs')
const init = join(here, '..', 'scripts', 'init-skill.mjs')
const fixtures = join(here, 'fixtures')

const run = (script, args) => spawnSync(process.execPath, [script, ...args], { encoding: 'utf8' })

const cliTest = (name, fn) => test(name, noSpawn, fn)

cliTest('未知参数退出码为 2', () => {
  const r = run(validate, ['--bogus', join(fixtures, 'valid')])
  assert.equal(r.status, 2)
})

cliTest('以 - 开头的参数（含单独的 -）退出码为 2', () => {
  assert.equal(run(validate, ['-x', join(fixtures, 'valid')]).status, 2)
  assert.equal(run(validate, ['-']).status, 2)
})

cliTest('--help 输出用法且退出码为 0', () => {
  const r = run(validate, ['--help'])
  assert.equal(r.status, 0)
  assert.match(r.stdout, /用法/)
})

cliTest('校验失败退出码为 1', () => {
  const r = run(validate, [join(fixtures, 'invalid', 'broken-link')])
  assert.equal(r.status, 1)
})

cliTest('--json 输出单个对象，结构为 ok、errors、data', () => {
  const r = run(validate, ['--json', join(fixtures, 'valid')])
  assert.equal(r.status, 0)
  const obj = JSON.parse(r.stdout)
  assert.equal(obj.ok, true)
  assert.deepEqual(obj.errors, [])
  assert.ok('data' in obj)
})

cliTest('--json 失败时 errors 每项含 code、file、message', () => {
  const r = run(validate, ['--json', join(fixtures, 'invalid', 'broken-link')])
  assert.equal(r.status, 1)
  const obj = JSON.parse(r.stdout)
  assert.equal(obj.ok, false)
  assert.equal(obj.errors[0].code, 'E_LINK')
  assert.ok(obj.errors[0].file && obj.errors[0].message)
})

cliTest('init-skill 未知参数退出码为 2', () => {
  const r = run(init, ['x', '--bogus'])
  assert.equal(r.status, 2)
})

cliTest('init-skill 缺少 name 退出码为 2', () => {
  const r = run(init, [])
  assert.equal(r.status, 2)
})

cliTest('init-skill --dry-run 只输出动作，不落盘', async () => {
  await withSandbox(async (box) => {
    const r = run(init, ['demo-skill', '--root', box.root, '--dry-run'])
    assert.equal(r.status, 0)
    assert.equal(existsSync(join(box.root, 'skills', 'demo-skill')), false)
    assert.match(r.stdout, /将生成/)
  })
})

cliTest('init-skill 目录已存在时退出码为 1，--force 可覆盖', async () => {
  await withSandbox(async (box) => {
    await box.dir(join('skills', 'taken'))
    assert.equal(run(init, ['taken', '--root', box.root]).status, 1)
    assert.equal(run(init, ['taken', '--root', box.root, '--force']).status, 0)
  })
})

cliTest('init-skill 底层 IO 错误报 E_IO（退出码 1），不再误标 E_EXISTS', async () => {
  await withSandbox(async (box) => {
    // skills 被普通文件占位：建 skills/<name> 目录必失败（ENOTDIR 一类底层 IO 错误）。
    await box.write('skills', '不是目录')
    const r = run(init, ['io-skill', '--root', box.root, '--json'])
    assert.equal(r.status, 1, `底层 IO 失败应退出码 1，实际 ${r.status}：${r.stdout}\n${r.stderr}`)
    const obj = JSON.parse(r.stdout)
    assert.equal(obj.ok, false)
    assert.equal(obj.errors[0].code, 'E_IO', '未知错误应报 E_IO，不得误标 E_EXISTS')
  })
})
