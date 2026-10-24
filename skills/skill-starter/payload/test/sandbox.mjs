// 测试用的临时工作区：建树、跑、保证删掉。
//
// 此前六个测试文件各写一套「给我一个临时目录、用完删掉」：位置有的在仓库内 test/.tmp/、
// 有的在系统临时目录；清理有的用 try/finally、有的靠 after()、有的只有一半。后果已经发生过两次：
//   · init-skill.test.mjs 建的是 .tmp/init-<hrtime>、after() 清的是 .tmp/init-skill，名字对不上，
//     每跑一次就在工作树里永久留一个目录；
//   · 三个文件各复制了一份「本环境能否 spawn 子进程」的探针，其中两处 skip 文案已经不一致。
// 清理写错不会被任何断言发现——它只会悄悄留下垃圾。所以这件事只该有一份实现。
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'

// 所有临时根都建在系统临时目录下，带前缀便于辨认来源；进程退出前由 withSandbox 删掉。
// 不用仓库内 test/.tmp/：那里会被 .gitignore 排除，失败时看不到，且容易与手写文件混在一起。
const PREFIX = 'skill-base-'

// 建一个临时根，跑 fn，无论成败都删掉。fn 拿到根路径与几个常用写文件助手。
//
//   await withSandbox(async (box) => {
//     await box.write('skills/demo/SKILL.md', text)
//     assert.deepEqual(await validateRepo(box.root), [])
//   })
//
// 需要多棵互不相干的树时，用 box.dir(name) 取子目录，仍归这一次清理管。
export async function withSandbox(run) {
  const root = await mkdtemp(join(tmpdir(), PREFIX))
  const box = {
    root,
    // 子目录路径，并在需要时创建。
    async dir(name) {
      const dir = join(root, name)
      await mkdir(dir, { recursive: true })
      return dir
    },
    // 写文件，父目录按需创建。写 JSON 传对象即可，自动序列化。
    async write(rel, content) {
      const file = join(root, rel)
      await mkdir(join(file, '..'), { recursive: true })
      const text = typeof content === 'string' ? content : `${JSON.stringify(content, null, 2)}\n`
      await writeFile(file, text, 'utf8')
      return file
    },
  }
  try {
    return await run(box)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
}

// 受限沙箱禁止子进程走管道（EPERM）：调用方拿到的 {skip} 交给 test() 的 options 即整组跳过。
// 探针只该有一个：三个文件各复制一份时，两处的 skip 文案已经漂移。
const probe = spawnSync(process.execPath, ['-e', "process.stdout.write('ok')"], { encoding: 'utf8' })

export const noSpawn =
  probe.stdout === 'ok'
    ? {}
    : { skip: '当前环境禁止子进程管道（EPERM），需要子进程的测试要在普通终端运行' }

