// 防的漂移：同一份内容在本仓库里存了两三份，改一侧忘另一侧，而门禁全绿。
//
// 这份仓库的分发形状是「上游 → 基座 → 本仓库 → payload → 派生项目」。每段都是复制，不是引用：
//   · docs/规范/、templates/、scripts/ 在本仓库与 payload 各一份（payload 侧 Markdown 为 .md.tpl）
//   · test/ 有 8 个文件与 payload 逐字相同（e2e、init-project 是本仓库独有）
// 此前没有任何检查表达这件事：给 test/evals.test.mjs 加一行，npm test 仍 87 项全绿。
//
// 本文件只校验「本仓库 → payload」这一段。上游 → 基座 由基座的 standards/templates 测试守，
// payload → 派生项目 由基座的 pack/check-projects 守——那两段的上游不在本仓库里，无法在此断言。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { readdir } from 'node:fs/promises'
import { dirname, join, posix } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const repo = join(here, '..')
const payload = join(repo, 'skills', 'skill-starter', 'payload')

// 逐段声明：仓库内路径 → payload 内路径，以及该段的哪些 Markdown 被 pack 改名成 .md.tpl。
// 只列「必须逐字相等」的段；payload 独有的内容（SKILL.md、LICENSE、skills/）不在此表。
const SEGMENTS = [
  { dir: 'docs/规范', markdown: true },
  { dir: 'templates', markdown: true },
  { dir: 'scripts', markdown: false },
  // test/ 下：只有 fixtures 里的 .md 会转 .tpl（它们是派生项目的模板素材），
  // 测试文件本身是 .mjs，不转。这条规则此前没人写下来，所以两侧的形态差异只能靠猜。
  {
    dir: 'test',
    markdown: false,
    markdownUnder: ['fixtures/'],
    repoOnly: ['e2e.test.mjs', 'init-project.test.mjs', 'sync.test.mjs'],
  },
]

// 本仓库独有的目录：只在本仓库成立，不该出现在 payload，也不参与比对。
const REPO_ONLY_TOP = new Set(['.tmp'])

async function walk(dir, prefix = '') {
  const out = []
  for (const entry of await readdir(join(dir, prefix), { withFileTypes: true })) {
    const rel = prefix ? posix.join(prefix, entry.name) : entry.name
    if (entry.isDirectory()) {
      if (prefix === '' && REPO_ONLY_TOP.has(entry.name)) continue
      out.push(...(await walk(dir, rel)))
    } else {
      out.push(rel)
    }
  }
  return out.sort()
}

// payload 侧该文件的应有名字：Markdown 被 pack 改名成 .md.tpl（整段或指定子目录下），其余保持原名。
const inPayload = (rel, markdown, markdownUnder = []) => {
  const isMarkdown = rel.endsWith('.md') && (markdown || markdownUnder.some((p) => rel.startsWith(p)))
  return isMarkdown ? `${rel}.tpl` : rel
}

for (const segment of SEGMENTS) {
  const { dir, markdown, markdownUnder = [], repoOnly = [] } = segment

  test(`${dir}：本仓库的每个文件都在 payload 中有对应件，且无多余`, async () => {
    const repoFiles = (await walk(join(repo, dir))).filter((rel) => !repoOnly.includes(rel))
    const payloadFiles = new Set(await walk(join(payload, dir)))

    const missing = repoFiles.filter((rel) => !payloadFiles.has(inPayload(rel, markdown, markdownUnder)))
    assert.deepEqual(missing, [], `${dir}：这些文件在 payload 中缺失（Markdown 应为 .md.tpl）：${missing.join('、')}`)

    const expected = new Set(repoFiles.map((rel) => inPayload(rel, markdown, markdownUnder)))
    const extra = [...payloadFiles].filter((rel) => !expected.has(rel))
    assert.deepEqual(extra, [], `${dir}：payload 多出本仓库没有的文件：${extra.join('、')}`)
  })

  test(`${dir}：每个同名文件与 payload 逐字一致`, async () => {
    const repoFiles = (await walk(join(repo, dir))).filter((rel) => !repoOnly.includes(rel))
    for (const rel of repoFiles) {
      const payloadRel = inPayload(rel, markdown, markdownUnder)
      const target = join(payload, dir, payloadRel)
      assert.ok(existsSync(target), `${dir}/${rel} 在 payload 中缺失（期望 ${payloadRel}）`)
      assert.equal(
        readFileSync(join(repo, dir, rel), 'utf8'),
        readFileSync(target, 'utf8'),
        `${dir}/${rel} 与 payload 的 ${payloadRel} 不一致：改一侧须同次改另一侧`,
      )
    }
  })
}

// 上表只声明「必须相等」的段；payload 里多出来的东西要有归属说明，否则新增文件会悄悄逃过检查。
test('payload 的内容都在上表的覆盖范围内：没有未声明的新增内容', async () => {
  const declared = new Set()
  for (const { dir } of SEGMENTS) {
    for (const rel of await walk(join(payload, dir))) declared.add(posix.join(dir, rel))
  }
  // payload 根下这些不属于任何副本段：技能入口由 pack 生成，LICENSE 与 skills/ 是派生产物。
  const allowedTop = new Set(['SKILL.md', 'LICENSE', 'package.json', 'skills', 'docs', 'templates', 'scripts', 'test'])
  const payloadTop = (await readdir(payload)).filter((n) => !n.startsWith('.'))
  const undeclaredTop = payloadTop.filter((n) => !allowedTop.has(n))
  assert.deepEqual(undeclaredTop, [], `payload 根下出现未声明的条目：${undeclaredTop.join('、')}。请在上表登记或说明归属`)

  // 自证基线：声明的段至少覆盖 payload 里除 SKILL.md 之外的全部文件。
  // 数字变了说明 pack 的产物形状变了，这里要跟着更新——否则检查会静默缩小覆盖面。
  const allPayload = []
  for (const dir of ['docs', 'templates', 'scripts', 'test', 'skills']) {
    if (existsSync(join(payload, dir))) {
      for (const rel of await walk(join(payload, dir))) allPayload.push(posix.join(dir, rel))
    }
  }
  const uncovered = allPayload.filter((rel) => !declared.has(rel) && !rel.startsWith('skills/'))
  assert.deepEqual(uncovered, [], `payload 中有未被上表覆盖的文件：${uncovered.slice(0, 5).join('、')}`)
  assert.ok(declared.size >= 50, `已声明的 payload 文件仅 ${declared.size} 个，检查可能已失效`)
})

// 「跳过」与「验过」必须可区分：上游段不归本仓库校验，但要让读者看见本仓库实际守了几段。
test('覆盖范围自述：本文件只守本仓库→payload，其余两段在上游', () => {
  const self = readFileSync(fileURLToPath(import.meta.url), 'utf8')
  assert.match(self, /上游 → 基座/, '须写明上游段不在此处校验')
  assert.match(self, /pack\/check-projects/, '须写明 payload→项目 由基座的哪个脚本守')
})
