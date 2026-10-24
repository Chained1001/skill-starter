// 防的漂移：钩子内容与命令脱节，或装到非 git 仓库里。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { rm, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { HookExistsError, NotGitRepoError, UsageError, installHooks, parseArgs } from '../scripts/install-hooks.mjs'
import { noSpawn, withSandbox } from './sandbox.mjs'

const hookScript = join(dirname(fileURLToPath(import.meta.url)), '..', 'scripts', 'install-hooks.mjs')

const cliTest = (name, fn) => test(name, noSpawn, fn)

// 装钩子的用例都要一个带 .git/hooks 的仓库，这是本文件特有的布局，包一层省得每处重复。
async function withRepo(run) {
  await withSandbox(async (box) => {
    await box.dir(join('.git', 'hooks'))
    await run(box.root, box)
  })
}

test('安装后钩子存在且调用 validate 与 test', async () => {
  await withRepo(async (root) => {
    const result = await installHooks({ root })
    assert.equal(result.action, 'installed')
    const text = readFileSync(join(root, '.git', 'hooks', 'pre-commit'), 'utf8')
    assert.match(text, /npm run validate/)
    assert.match(text, /npm test/)
  })
})

test('--package-dir 让钩子切到子目录', async () => {
  await withRepo(async (root) => {
    await installHooks({ root, packageDir: '基座' })
    const text = readFileSync(join(root, '.git', 'hooks', 'pre-commit'), 'utf8')
    assert.match(text, /cd "\$root\/基座"/)
  })
})

test('已有钩子时拒绝覆盖，--force 可覆盖', async () => {
  await withRepo(async (root) => {
    await installHooks({ root })
    await assert.rejects(() => installHooks({ root }), HookExistsError)
    const result = await installHooks({ root, force: true })
    assert.equal(result.overwrite, true)
  })
})

test('非 git 仓库时拒绝安装', async () => {
  await withSandbox(async (box) => {
    await assert.rejects(() => installHooks({ root: box.root }), NotGitRepoError)
  })
})

test('--dry-run 不写文件', async () => {
  await withRepo(async (root) => {
    const result = await installHooks({ root, dryRun: true })
    assert.equal(result.action, 'dry-run')
    assert.equal(existsSync(join(root, '.git', 'hooks', 'pre-commit')), false)
  })
})

test('--package-dir 为绝对路径时拒绝', async () => {
  await withRepo(async (root) => {
    await assert.rejects(
      () => installHooks({ root, packageDir: resolve('some', 'pkg') }),
      (error) => error instanceof UsageError && error.message.includes('相对'),
    )
  })
})

test('--package-dir 含 " ` $ 或反斜杠时拒绝，并提示用 /', async () => {
  await withRepo(async (root) => {
    for (const bad of ['a\\b', 'a"b', 'a`b', 'a$b']) {
      await assert.rejects(
        () => installHooks({ root, packageDir: bad }),
        (error) => error instanceof UsageError && error.message.includes('/'),
        `${bad} 应被拒绝并提示用 /`,
      )
    }
    await installHooks({ root, packageDir: '基座/sub-dir' })
    assert.match(readFileSync(join(root, '.git', 'hooks', 'pre-commit'), 'utf8'), /cd "\$root\/基座\/sub-dir"/)
  })
})

test('第二个位置参数报「多余的参数」而不是静默覆盖 root', () => {
  const one = parseArgs(['some/repo'])
  assert.equal(one.root, 'some/repo')
  assert.throws(() => parseArgs(['a', 'b']), (error) => error instanceof UsageError && error.message.includes('多余的参数'))
})

cliTest('CLI：--help 退出码 0，未知参数退出码 2，非 git 仓库退出码 1', async () => {
  const help = spawnSync(process.execPath, [hookScript, '--help'], { encoding: 'utf8' })
  assert.equal(help.status, 0)
  assert.match(help.stdout, /用法/)

  assert.equal(spawnSync(process.execPath, [hookScript, '--bogus'], { encoding: 'utf8' }).status, 2)

  await withSandbox(async (box) => {
    const r = spawnSync(process.execPath, [hookScript, box.root], { encoding: 'utf8' })
    assert.equal(r.status, 1, `非 git 仓库应退出码 1，实际 ${r.status}：${r.stdout}\n${r.stderr}`)
    assert.match(r.stderr, /不是 git 仓库/)
  })
})

// --json 是给调用方解析的契约：参数错误与业务错误必须是同一种结构，只差退出码。
cliTest('CLI：--json 下参数错误也输出 E_ARGS（退出码 2）', async () => {
  for (const args of [['--bogus', '--json'], ['--package-dir', '--json'], ['a', 'b', '--json']]) {
    const r = spawnSync(process.execPath, [hookScript, ...args], { encoding: 'utf8' })
    assert.equal(r.status, 2, `参数错应退出码 2（${args.join(' ')}），实际 ${r.status}：${r.stdout}\n${r.stderr}`)
    const obj = JSON.parse(r.stdout)
    assert.equal(obj.ok, false, `--json 应输出 ok:false（${args.join(' ')}）`)
    assert.equal(obj.errors[0].code, 'E_ARGS', `参数错应报 E_ARGS（${args.join(' ')}）`)
  }
})

cliTest('CLI：--json 下 --package-dir 取值被拒也输出 E_ARGS（退出码 2）', async () => {
  await withSandbox(async (box) => {
    await box.dir(join('.git', 'hooks'))
    const r = spawnSync(process.execPath, [hookScript, box.root, '--package-dir', 'a\\b', '--json'], { encoding: 'utf8' })
    assert.equal(r.status, 2, `被拒的取值应退出码 2，实际 ${r.status}：${r.stdout}\n${r.stderr}`)
    assert.equal(JSON.parse(r.stdout).errors[0].code, 'E_ARGS')
  })
})

// core.hooksPath 一旦设了（husky、lefthook、monorepo 常见），<git dir>/hooks 下的钩子永不执行。
// 那时仍往 .git/hooks 写并报「已安装」，等于静默失效。
test('设置了 core.hooksPath 时装到该目录，而不是静默写进 .git/hooks', async () => {
  await withSandbox(async (box) => {
    const { root } = box
    await box.dir(join('.git', 'hooks'))
    await box.write(join('.git', 'config'), '[core]\n\trepositoryformatversion = 0\n\thooksPath = .husky\n')

    const result = await installHooks({ root })
    assert.equal(result.path, join(root, '.husky', 'pre-commit'), `钩子应装到 core.hooksPath 指定的 .husky/，实际 ${result.path}`)
    assert.ok(existsSync(join(root, '.husky', 'pre-commit')))
    assert.equal(existsSync(join(root, '.git', 'hooks', 'pre-commit')), false, '不得再往永不执行的位置写')

    // 相对路径按仓库根解释；绝对路径原样使用。
    await rm(join(root, '.git', 'config'))
    const abs = join(root, 'abs-hooks')
    await writeFile(join(root, '.git', 'config'), `[core]\n\thooksPath = ${abs}\n`, 'utf8')
    const second = await installHooks({ root, force: true })
    assert.equal(second.path, join(abs, 'pre-commit'))
  })
})
