// 防的漂移：本仓库唯一的交付物是生成器（skills/skill-starter/scripts/init-project.mjs，由基座逐字复制而来），
// 它的行为缺陷只能在这里暴露。此前本仓库只有 e2e 的三条用例覆盖它，--force 的两个致命问题
// （删用户数据、重跑必失败）都漏了过去。
// 直接 import 宿主复制件，不起子进程：受限沙箱禁止进程管道，而生成器的错误路径恰好要逐个验。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ExistsError, UsageError, initProject } from '../skills/skill-starter/scripts/init-project.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const repo = resolve(here, '..')
const payload = join(repo, 'skills', 'skill-starter', 'payload')
const generator = join(repo, 'skills', 'skill-starter', 'scripts', 'init-project.mjs')

async function makeTarget(name) {
  const root = await mkdtemp(join(tmpdir(), 'starter-init-'))
  return { root, target: join(root, name) }
}

async function put(root, rel, text) {
  const dest = join(root, rel)
  await mkdir(dirname(dest), { recursive: true })
  await writeFile(dest, text, 'utf8')
}

// 用随技能携带的 payload 生成：这就是用户实际走的路径。
const generate = (target, extra = {}) =>
  initProject({ target, source: payload, name: 'demo', owner: 'o', repo: 'r', ...extra })

test('从 payload 生成：根文件替换占位符、写入 .base-version、无 .md.tpl 残留', async () => {
  const { root, target } = await makeTarget('demo')
  try {
    const result = await generate(target)
    assert.equal(result.action, 'created')

    const declared = /^  base-version: (\S+)$/m.exec(
      await readFile(join(repo, 'skills', 'skill-starter', 'SKILL.md'), 'utf8'),
    )?.[1]
    const stamped = (await readFile(join(target, '.base-version'), 'utf8')).trim()
    assert.equal(stamped, declared, '.base-version 应与 SKILL.md 的 base-version 一致')

    const residue = (await readdir(target, { recursive: true })).filter((f) => f.endsWith('.md.tpl'))
    assert.deepEqual(residue, [], `残留 .md.tpl：${residue.join('、')}`)

    const pkg = JSON.parse(await readFile(join(target, 'package.json'), 'utf8'))
    assert.equal(pkg.name, 'demo')
    assert.ok(!pkg.repository.url.includes('{{'), 'package.json 仍含占位符')
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

// --force 的语义是「同名文件按源覆盖」，不是「把目标清成源的样子」。
// 曾经的实现按 DROP 清单在目标侧再删一遍，会连带删掉用户的 .git（提交历史）、
// node_modules 与 evals/（手写用例），且删完才继续，失败也不回滚。
test('--force 不删目标里属于用户的内容：.git、node_modules、evals/、docs/产品 原样保留', async () => {
  const { root, target } = await makeTarget('force-keep')
  try {
    await generate(target)
    await put(target, join('.git', 'HEAD'), 'ref: refs/heads/main\n')
    await put(target, join('node_modules', 'dep', 'index.js'), 'module.exports = 1\n')
    await put(target, join('evals', 'cases', 'my.md'), '# 手写用例\n\nC-99 必须保留\n')
    await put(target, join('docs', '产品', 'PRD.md'), '# 我的 PRD\n')

    await generate(target, { force: true })

    assert.equal(await readFile(join(target, '.git', 'HEAD'), 'utf8'), 'ref: refs/heads/main\n', '.git 被删，提交历史丢失')
    assert.ok(existsSync(join(target, 'node_modules', 'dep', 'index.js')), 'node_modules 被删')
    assert.match(await readFile(join(target, 'evals', 'cases', 'my.md'), 'utf8'), /C-99 必须保留/, '手写用例被删')
    assert.match(await readFile(join(target, 'docs', '产品', 'PRD.md'), 'utf8'), /我的 PRD/, '用户文档被删')
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

// payload 里 Markdown 全是 .md.tpl 形态，第一次生成会把它们还原成 .md。用户按 SKILL.md 的停止条件
// 加 --force 重跑时，还原步骤若把「同名 .md 已存在」当冲突抛错，--force 在这个场景就永远失败，
// 而且抛错时目录已被改了一半。这曾是退出码 3 的稳定复现路径。
test('--force 重跑已生成过的项目：不报冲突、无残留、内容仍是源的', async () => {
  const { root, target } = await makeTarget('force-twice')
  try {
    await generate(target)
    const second = await generate(target, { force: true })
    assert.equal(second.action, 'created')

    const residue = (await readdir(target, { recursive: true })).filter((f) => f.endsWith('.md.tpl'))
    assert.deepEqual(residue, [], `残留 .md.tpl：${residue.join('、')}`)
    assert.ok(existsSync(join(target, 'docs', '规范', '00-总则.md')), '还原后的 .md 应仍在')
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

// LICENSE 版权行曾以字符串形式进 String.replace，$& 被当成「插入整个匹配」，
// 写出 "Copyright (c) 2026 ACopyright (c) 2026 Chained1001B"，且没有任何门禁能发现。
test('--author 含 $& 与 $1 时按字面写入，不被当成替换模式', async () => {
  const { root, target } = await makeTarget('author')
  try {
    await generate(target, { author: 'A$&B' })
    const license = await readFile(join(target, 'LICENSE'), 'utf8')
    assert.ok(license.includes('A$&B'), `$& 未被按字面写入：${license}`)
    assert.ok(!license.includes('Chained1001'), '原版权行未被替换，$& 被当成了替换模式')
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

// owner/repo 会插进 package.json 的 url 与根 README 的表格：含引号产出非法 JSON，
// 含换行撕开表格行。此前生成器一律退出码 0，坏产物要到用户 npm run validate 才暴露。
test('--owner / --repo 含引号、反斜杠、换行或空格时拒绝生成', async () => {
  const { root, target } = await makeTarget('bad-owner')
  try {
    for (const bad of ['x"y', 'x\\y', 'x\ny', 'a b', 'a&b', '']) {
      await assert.rejects(
        () => generate(join(root, `t-${Math.abs(bad.length * 31 + bad.charCodeAt(0) || 7)}`), { owner: bad }),
        UsageError,
        `owner "${bad}" 应被拒绝`,
      )
    }
    await assert.rejects(() => generate(join(root, 'bad-repo'), { repo: 'r"x' }), UsageError)
    assert.equal(existsSync(join(root, 'bad-repo')), false, '拒绝时不得落盘')
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('目标已存在且非空时拒绝生成（不加 --force），目标内容不变', async () => {
  const { root, target } = await makeTarget('occupied')
  try {
    await mkdir(target)
    await writeFile(join(target, 'keep.txt'), 'marker', 'utf8')
    await assert.rejects(() => generate(target), ExistsError)
    assert.deepEqual((await readdir(target)).sort(), ['keep.txt'], '拒绝时不得写入任何文件')
    assert.equal(await readFile(join(target, 'keep.txt'), 'utf8'), 'marker')
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('项目名不合法时拒绝生成', async () => {
  const { root } = await makeTarget('whatever')
  try {
    // 不传 --name：项目名取目录名，Bad_Name 不合 NAME_PATTERN。
    await assert.rejects(() => initProject({ target: join(root, 'Bad_Name'), source: payload, owner: 'o', repo: 'r' }), UsageError)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

// 目标落在源目录内部会被 cp 在复制中读写自身。守卫存在，且必须在落盘前抛出。
test('目标在源目录内部时拒绝生成：自拷贝守卫', async () => {
  await assert.rejects(() => generate(join(payload, 'inside')), UsageError)
  assert.equal(existsSync(join(payload, 'inside')), false, '守卫应在落盘前生效')
})

// ── 以下三条走真实子进程：CLI 外壳（退出码、--json 结构、--dry-run 计划文本）只能从进程外到达。
// 生成器随技能交付，宿主调的就是这层壳；此前它零断言，参数错与业务错能否同构无人验过。
const runCli = (args) =>
  spawnSync(process.execPath, [generator, ...args], { encoding: 'utf8' })

test('CLI：--dry-run 只输出计划，不落盘，计划里写明要写 .base-version 与还原哪些 .md.tpl', async () => {
  const { root, target } = await makeTarget('planned')
  try {
    const r = runCli([target, '--source', payload, '--name', 'demo', '--owner', 'o', '--repo', 'r', '--dry-run', '--json'])
    assert.equal(r.status, 0, `--dry-run 应成功\nstderr:\n${r.stderr}`)
    assert.equal(existsSync(target), false, '--dry-run 不得创建目标目录')

    const out = JSON.parse(r.stdout)
    assert.equal(out.ok, true)
    assert.equal(out.data.action, 'dry-run')
    const planned = out.data.planned.join('\n')
    assert.match(planned, /写入 \.base-version/, '计划应写明写 .base-version')
    assert.match(planned, /还原 .*SKILL\.md/, '计划应写明还原哪些 .md.tpl')
    assert.match(planned, /跳过/, '计划应列出被跳过的条目')
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

// 参数错与业务错必须同构：调用方按 exit code 区分，靠 errors[0].code 分流。
// 两种错误走的是 reportError 的同一出口，这条把它们钉在一起。
test('CLI：--json 下参数错与业务错结构相同，只差退出码与 code', async () => {
  const { root, target } = await makeTarget('occupied')
  try {
    const bad = runCli(['--bogus', '--json'])
    assert.equal(bad.status, 2, '未知参数应退出码 2')
    const badObj = JSON.parse(bad.stdout)
    assert.equal(badObj.ok, false)
    assert.equal(badObj.errors[0].code, 'E_ARGS')
    assert.equal(typeof badObj.errors[0].message, 'string')

    // 业务错：目标非空且未加 --force。
    await mkdir(target)
    await writeFile(join(target, 'keep.txt'), 'marker', 'utf8')
    const biz = runCli([target, '--source', payload, '--name', 'demo', '--owner', 'o', '--repo', 'r', '--json'])
    assert.equal(biz.status, 1, '目标非空应退出码 1')
    const bizObj = JSON.parse(biz.stdout)
    assert.equal(bizObj.ok, false)
    assert.deepEqual(Object.keys(bizObj).sort(), Object.keys(badObj).sort(), '两种错误的顶层结构必须相同')
    assert.deepEqual(Object.keys(bizObj.errors[0]).sort(), Object.keys(badObj.errors[0]).sort(), 'errors 项结构必须相同')
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('CLI：--help 退出码 0 且打印用法，不落盘', async () => {
  const { root, target } = await makeTarget('helped')
  try {
    const r = runCli(['--help'])
    assert.equal(r.status, 0)
    assert.match(r.stdout, /用法/)
    assert.equal(existsSync(target), false)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
