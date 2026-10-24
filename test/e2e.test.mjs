// 防的漂移：技能安装到宿主（只带走 SKILL.md、scripts/、payload/，不带仓库其余部分）后生成器跑不起来，
// 或生成的项目过不了自身门禁——发布形态与在仓库里直接运行的行为不一致。
// 模拟安装：把 skills/skill-starter 整体复制到临时宿主目录，只用复制件驱动全流程。
import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import { cp, mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { spawnSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { noSpawn } from './sandbox.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const repo = join(here, '..')

// 整组 e2e 共用一棵临时树，根在系统临时目录、名字唯一。
//
// 这里曾用仓库内固定路径 test/.tmp/e2e，且在文件末尾 rmdir 整个 test/.tmp —— 而
// init-skill.test.mjs 的树也在那个父目录下。两个文件同时跑，谁先结束谁把对方的树删掉：
// 并行实测 e2e 报 EBUSY 或退出码 null。改用 mkdtemp 后各拿各的目录，谁也不碰别人。
// （本文件的树要跨三条测试存活，故不套 withSandbox 的单回调形态，只借用它的 noSpawn。）
let base
let hosted

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
  base = await mkdtemp(join(tmpdir(), 'skill-e2e-'))
  hosted = join(base, 'skills', 'skill-starter')
  await mkdir(join(base, 'skills'), { recursive: true })
  await cp(join(repo, 'skills', 'skill-starter'), hosted, { recursive: true })
})

after(async () => {
  await rm(base, { recursive: true, force: true })
})

// 生成一次、三条测试共用：整个文件只 spawn 一次生成器。依赖写在每条测试的第一行（await demoProject()），
// 不靠模块级 let 传递——那样单独跑其中一条会拿到 undefined，且测试顺序变成隐含契约。
let projectPromise
function demoProject() {
  projectPromise ??= (async () => {
    const project = join(base, 'demo-project')
    const r = generate(project)
    assert.equal(r.status, 0, `生成器退出码 ${r.status}\nstdout:\n${r.stdout}\nstderr:\n${r.stderr}`)
    return { project, stdout: r.stdout }
  })()
  return projectPromise
}

e2eTest('安装模拟：宿主复制件从 payload 生成项目，退出码 0，stdout 含生成路径与下一步指引', async () => {
  const { project, stdout } = await demoProject()
  assert.match(stdout, /已生成/)
  assert.ok(stdout.includes(project), 'stdout 未含生成路径')
  // 六条下一步指引（SKILL.md「输出」小节）逐条出现在 stdout；漏掉一条，用户就少做一步
  // （典型的是忘了改 LICENSE 版权行或补根文件的 TODO，两者都没有门禁能发现）。
  const nextSteps = ['未提供 --author 时', 'LICENSE 的版权行', '补全 README.md', 'init-skill', 'git init', 'install-hooks', 'npm run validate && npm test']
  for (const kw of nextSteps) {
    assert.ok(stdout.includes(kw), `stdout 缺下一步指引关键词「${kw}」`)
  }
  // 基座版本号：生成器 stdout 本身不带版本号，按 SKILL.md「输出」小节，版本号由技能声明的
  // metadata.base-version 报告给用户；断言声明存在且与 payload 及本仓库的版本一致，报告才有据可依。
  const skillText = await readFile(join(hosted, 'SKILL.md'), 'utf8')
  const declared = /^  base-version: (\S+)$/m.exec(skillText)?.[1]
  const payloadVersion = JSON.parse(await readFile(join(hosted, 'payload', 'package.json'), 'utf8')).version
  const repoVersion = JSON.parse(await readFile(join(repo, 'package.json'), 'utf8')).version
  assert.ok(declared, 'SKILL.md 缺 metadata.base-version')
  assert.equal(payloadVersion, declared, 'payload 的版本号与 SKILL.md 的 base-version 不一致')
  assert.equal(repoVersion, declared, '本仓库版本号与 SKILL.md 的 base-version 不一致')
  // 生成项目根的 .base-version 是 check-projects 判断派生项目落后几版的唯一依据；
  // 没写或写错，项目侧不会报错，要等回基座比对时才发现。
  assert.equal((await readFile(join(project, '.base-version'), 'utf8')).trim(), declared, '生成项目的 .base-version 与 SKILL.md 的 base-version 不一致')
})

// 本仓库自己也是基座的派生仓库，根 .base-version 记录我们派生自哪一版。
// pack --refresh 不写它（既不在 DROP 也不在 ROOT_FILES），只能人工跟版本——于是它会悄悄过期：
// 曾停在 0.4.0 而代码已是 0.5.1，check-projects 据此报「落后 2 版」并退出码 1，
// 而同步范围内 38 个文件逐字一致。陈旧的值比没有值更坏：它看起来有权威。
e2eTest('仓库根 .base-version 与当前版本一致（否则 check-projects 会误报落后）', async () => {
  const declared = /^  base-version: (\S+)$/m.exec(await readFile(join(hosted, 'SKILL.md'), 'utf8'))?.[1]
  const rootStamped = (await readFile(join(repo, '.base-version'), 'utf8')).trim()
  assert.equal(rootStamped, declared, `仓库根 .base-version 是 ${rootStamped}，应为 ${declared}。pack --refresh 不会更新它，须人工跟`)
})

e2eTest('生成的项目：npm run validate 与 npm test 退出码 0，且无 .md.tpl 残留', async () => {
  const { project } = await demoProject()
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
