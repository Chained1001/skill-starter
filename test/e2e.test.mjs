// 防的漂移：技能安装到宿主（只带走 SKILL.md、scripts/、payload/，不带仓库其余部分）后生成器跑不起来，
// 或生成的项目过不了自身门禁——发布形态与在仓库里直接运行的行为不一致。
// 模拟安装：把 skills/skill-starter 整体复制到临时宿主目录，只用复制件驱动全流程。
import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import { cp, mkdir, readdir, readFile, rm, rmdir, writeFile } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const repo = join(here, '..')
const base = join(here, '.tmp', 'e2e')
// 宿主把技能装在自己的 skills/ 下，模拟同样的层级。
const hosted = join(base, 'skills', 'skill-starter')

// 受限沙箱禁止子进程走管道（EPERM）。此时跳过整组 e2e 测试，并写明恢复条件（写法同 cli.test.mjs）。
const probe = spawnSync(process.execPath, ['-e', "process.stdout.write('ok')"], { encoding: 'utf8' })
const noSpawn = probe.stdout === 'ok' ? {} : { skip: '当前环境禁止子进程管道（EPERM），e2e 测试需在普通终端运行' }
const e2eTest = (name, fn) => test(name, noSpawn, fn)

// 按 SKILL.md「步骤」小节的约定：在技能目录下运行生成器，--source 指向随技能携带的 payload。
const generate = (target, extra = []) =>
  spawnSync(
    process.execPath,
    [join('scripts', 'init-project.mjs'), target, '--source', 'payload', '--owner', 't', '--repo', 't', '--author', 't', ...extra],
    { cwd: hosted, encoding: 'utf8' },
  )
// npm 在 Windows 上是 .cmd 垫片，须经 shell 解析；退出码由 spawnSync 原样带回。
const npmRun = (args, cwd) => spawnSync('npm', args, { cwd, encoding: 'utf8', shell: true })

before(async () => {
  await rm(base, { recursive: true, force: true })
  await mkdir(join(base, 'skills'), { recursive: true })
  await cp(join(repo, 'skills', 'skill-starter'), hosted, { recursive: true })
})

after(async () => {
  await rm(base, { recursive: true, force: true })
  try {
    await rmdir(join(here, '.tmp'))
  } catch (error) {
    if (error.code !== 'ENOTEMPTY' && error.code !== 'ENOENT') throw error
  }
})

let project // 由第一个测试生成，后续断言复用同一产物；npm test 只 spawn 一次

e2eTest('安装模拟：宿主复制件从 payload 生成项目，退出码 0，stdout 含生成路径与下一步指引', async () => {
  project = join(base, 'demo-project')
  const r = generate(project)
  assert.equal(r.status, 0, `生成器退出码 ${r.status}\nstdout:\n${r.stdout}\nstderr:\n${r.stderr}`)
  assert.match(r.stdout, /已生成/)
  assert.ok(r.stdout.includes(project), 'stdout 未含生成路径')
  // 五条下一步指引（SKILL.md「输出」小节）逐条出现在 stdout。
  for (const kw of ['接下来', 'init-skill', 'git init', 'install-hooks', 'npm run validate && npm test']) {
    assert.ok(r.stdout.includes(kw), `stdout 缺下一步指引关键词「${kw}」`)
  }
  // 基座版本号 0.2.0：生成器 stdout 本身不带版本号，按 SKILL.md「输出」小节，版本号由技能声明的
  // metadata.base-version 报告给用户；断言声明存在且与 payload 的版本一致，报告才有据可依。
  const skillText = await readFile(join(hosted, 'SKILL.md'), 'utf8')
  const declared = /^  base-version: (\S+)$/m.exec(skillText)?.[1]
  assert.equal(declared, '0.2.0', 'SKILL.md 声明的基座版本号应为 0.2.0')
  const payloadVersion = JSON.parse(await readFile(join(hosted, 'payload', 'package.json'), 'utf8')).version
  assert.equal(payloadVersion, declared, 'payload 的版本号与 SKILL.md 的 base-version 不一致')
})

e2eTest('生成的项目：npm run validate 与 npm test 退出码 0，且无 .md.tpl 残留', async () => {
  const residue = (await readdir(project, { recursive: true })).filter((f) => f.endsWith('.md.tpl'))
  assert.deepEqual(residue, [], `生成目标仍残留 .md.tpl，还原不完整：${residue.join('、')}`)
  const v = npmRun(['run', 'validate'], project)
  assert.equal(v.status, 0, `目标内 npm run validate 退出码 ${v.status}\nstdout:\n${v.stdout}\nstderr:\n${v.stderr}`)
  const t = npmRun(['test'], project)
  assert.equal(t.status, 0, `目标内 npm test 退出码 ${t.status}\nstdout:\n${t.stdout}\nstderr:\n${t.stderr}`)
})

e2eTest('冲突保护：目标非空时退出码 1 且零写入；--force 后退出码 0', async () => {
  const target = join(base, 'occupied')
  await mkdir(target)
  await writeFile(join(target, 'keep.txt'), 'marker', 'utf8')
  const refused = generate(target)
  assert.equal(refused.status, 1, `非空目标应拒绝，实际退出码 ${refused.status}\nstdout:\n${refused.stdout}\nstderr:\n${refused.stderr}`)
  assert.match(refused.stderr, /目标已存在且非空/)
  assert.deepEqual((await readdir(target)).sort(), ['keep.txt'], '拒绝时不得写入任何文件')
  assert.equal(await readFile(join(target, 'keep.txt'), 'utf8'), 'marker', '原有文件被改动')
  assert.equal(generate(target, ['--force']).status, 0, '--force 后应生成成功')
})
