#!/usr/bin/env node
// 把基座（或 --source 指定的基座内容目录）变成一个新项目：复制骨架、用模板替换根文件、把 .md.tpl 还原为 .md、删掉只在基座成立的文件。只用 Node 内置模块。
// 用法：init-project.mjs <目标目录> [--name <包名>] [--owner <owner>] [--repo <repo>] [--author <名>] [--source <目录>] [--dry-run] [--force] [--json] [--help]
// 退出码：0 成功，1 业务失败（目标已存在），2 参数错误，3 模板缺失。
import { existsSync } from 'node:fs'
import { cp, mkdir, readdir, readFile, rename, stat, writeFile } from 'node:fs/promises'
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

// 缺省源：脚本所在的基座根。--source 可换成随技能携带的基座内容目录。
// resolve() 剥掉 fileURLToPath 的尾分隔符（Windows 为 \，POSIX 为 /）：cp filter 里按
// sourceDir.length + 1 切相对路径，尾分隔符会让切片多切一位、filter 永不命中。
const SOURCE = resolve(fileURLToPath(new URL('..', import.meta.url)))
const USAGE = '用法：init-project.mjs <目标目录> [--name <包名>] [--owner <owner>] [--repo <repo>] [--author <名>] [--source <目录>] [--dry-run] [--force] [--json] [--help]'
const NAME_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
// owner/repo 会插进 package.json 的 url 与根 README 的表格：含引号会写出非法 JSON，含反斜杠会造出
// 非法转义，含换行与竖线会撕开 README 的表格行。GitHub 的 owner/repo 本就只允许这几种字符，按此收紧。
const OWNER_REPO_PATTERN = /^[A-Za-z0-9._-]+$/

// 只在基座成立的路径（相对基座根，正斜杠；pack.mjs 复用此清单）：VCS 与依赖目录、
// 示例、示例测试、评测示例、生成器、打包器与差距比对器及其测试。单一来源，改这里须同次跑 pack 测试。
export const DROP = [
  '.git',
  'node_modules',
  'examples',
  'evals',
  'scripts/init-project.mjs',
  'scripts/pack.mjs',
  'scripts/check-projects.mjs',
  'test/base-only.test.mjs',
  'test/examples.test.mjs',
  'test/init-project.test.mjs',
  'test/pack.test.mjs',
  'test/check-projects.test.mjs',
]

// 根文件：模板名 → 项目内名字。
const ROOT_FILES = [
  ['README.md', 'README.md'],
  ['AGENTS.md', 'AGENTS.md'],
  ['CHANGELOG.md', 'CHANGELOG.md'],
  ['package.json', 'package.json'],
  ['gitignore', '.gitignore'],
  ['gitattributes', '.gitattributes'],
  ['ci.yml', join('.github', 'workflows', 'ci.yml')],
]

// 源目录必须齐备的根模板：templates/root/ 下的八个文件（渲染用的七个之外还有 GLOSSARY.md）。
const REQUIRED_ROOT_TEMPLATES = ['README.md', 'AGENTS.md', 'CHANGELOG.md', 'GLOSSARY.md', 'package.json', 'gitignore', 'gitattributes', 'ci.yml']

export class UsageError extends Error {}
export class TemplateError extends Error {}
export class ExistsError extends Error {}

// 派生项目根的版本戳文件名：生成时写入，check-projects 读取。契约单一来源在此。
export const BASE_VERSION_FILE = '.base-version'

// 生成物行尾统一 LF：源模板可能来自 autocrlf 克隆（CRLF），下游按 \n 解析。
function render(text, { name, owner, repo }) {
  return text.replaceAll('\r\n', '\n')
    .replaceAll('{{项目名}}', () => name)
    .replaceAll('{{owner}}', () => owner)
    .replaceAll('{{repo}}', () => repo)
}

async function isEmptyDir(dir) {
  try {
    const st = await stat(dir)
    if (!st.isDirectory()) return false
    return (await readdir(dir)).length === 0
  } catch {
    return true
  }
}

async function isDirectory(dir) {
  try {
    return (await stat(dir)).isDirectory()
  } catch {
    return false
  }
}

// rel 可能来自 cp filter（平台分隔符）也可能来自 walkFiles（join 生成），统一按正斜杠与 DROP 比较。
function isDropped(rel) {
  const relPosix = rel.split(sep).join('/')
  return DROP.some((p) => relPosix === p || relPosix.startsWith(`${p}/`))
}

// parent 是否包含 child（或两者相同）。不同盘符等无法比较时按不包含处理。
function contains(parent, child) {
  const rel = relative(parent, child)
  if (rel === '') return true
  if (isAbsolute(rel)) return false
  return rel.split(sep)[0] !== '..'
}

async function walkFiles(dir, prefix = '') {
  const files = []
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const rel = prefix ? join(prefix, entry.name) : entry.name
    if (entry.isDirectory()) files.push(...(await walkFiles(join(dir, entry.name), rel)))
    else if (entry.isFile()) files.push(rel)
  }
  return files
}

// 把生成目录里以 .md.tpl 结尾的文件重命名为去掉 .tpl 的 .md，内容不动。源里没有 .tpl 文件时是空操作。
// 目标里已有同名 .md 时直接覆盖：--force 重跑已生成过的项目必然命中（上一轮还原出的 .md 还在），
// 此处若报冲突，等于 --force 在该场景永远失败，且失败时目录已被改了一半。rename 覆盖在 Windows 与 POSIX 上都成立。
async function restoreMarkdownTemplates(root) {
  for (const rel of await walkFiles(root)) {
    if (!rel.endsWith('.md.tpl')) continue
    await rename(join(root, rel), join(root, rel.slice(0, -'.tpl'.length)))
  }
}

// 读根模板：打包产物里 Markdown 模板是 .md.tpl 形态，读不到原名时读 .tpl 变体（齐备性已在上文检查过）。
async function readRootTemplate(rootTemplates, from) {
  try {
    return await readFile(join(rootTemplates, from), 'utf8')
  } catch (error) {
    if (from.endsWith('.md') && error.code === 'ENOENT') {
      return readFile(join(rootTemplates, `${from}.tpl`), 'utf8')
    }
    throw error
  }
}

// 版本号来自源目录的 package.json：--source 模式即随技能携带 payload 的版本，缺省即基座版本。
// 自备的 --source 目录可能没有 package.json，读不到时不输出版本行，不算失败。
async function readSourceVersion(dir) {
  try {
    const pkg = JSON.parse(await readFile(join(dir, 'package.json'), 'utf8'))
    return typeof pkg.version === 'string' && pkg.version !== '' ? pkg.version : undefined
  } catch {
    return undefined
  }
}

export async function initProject({ target, name, owner = 'TODO-owner', repo = 'TODO-repo', author, source, dryRun = false, force = false }) {
  const projectName = name ?? basename(target)
  if (!NAME_PATTERN.test(projectName) || projectName.length > 64) {
    throw new UsageError(`项目名 "${projectName}" 不合法：须为 1–64 位小写英文、数字与单连字符。用 --name 指定合法名，或换一个目录名`)
  }

  const sourceDir = resolve(source === undefined ? SOURCE : source)
  if (source !== undefined && !(await isDirectory(sourceDir))) {
    throw new TemplateError(`--source 指向的目录不存在：${source}。请改为包含 templates/root/ 的基座内容目录`)
  }
  // 自拷贝守卫：目标在源目录内部（或源在目标内部）时，cp 会在复制过程中读写自身，直接拒绝。
  if (contains(sourceDir, target) || contains(target, sourceDir)) {
    throw new UsageError(`目标不能在基座内部：${target} 与源目录 ${sourceDir} 相互包含，复制会把基座拷进自己。请把目标目录放到源目录之外`)
  }

  const exists = existsSync(target)
  if (exists && !force && !(await isEmptyDir(target))) {
    throw new ExistsError(`目标已存在且非空：${target}。换一个目录，或加 --force`)
  }

  for (const [flag, value] of [['--owner', owner], ['--repo', repo]]) {
    if (!OWNER_REPO_PATTERN.test(value)) {
      throw new UsageError(`${flag} "${value}" 不合法：只允许英文字母、数字与 . _ -。该值会写进 package.json 的仓库地址与根 README 的表格，含引号、反斜杠或换行会产出非法 JSON 或撕开表格`)
    }
  }

  const rootTemplates = join(sourceDir, 'templates', 'root')
  for (const from of REQUIRED_ROOT_TEMPLATES) {
    // 打包产物里根 Markdown 模板是 .md.tpl 形态，两种名字都算齐备；生成时先还原再渲染。
    const names = from.endsWith('.md') ? [from, `${from}.tpl`] : [from]
    if (!names.some((n) => existsSync(join(rootTemplates, n)))) {
      const fix = source === undefined
        ? '请确认基座的 templates/root/ 未被删除'
        : '请确认 --source 目录包含 templates/root/ 全部八个根模板（README、AGENTS、CHANGELOG、GLOSSARY、package.json、gitignore、gitattributes、ci.yml，Markdown 模板可为 .md.tpl 形态）'
      throw new TemplateError(`模板缺失：${join(rootTemplates, from)}。${fix}`)
    }
  }

  const tplFiles = (await walkFiles(sourceDir)).filter((rel) => rel.endsWith('.md.tpl') && !isDropped(rel))
  const baseVersion = await readSourceVersion(sourceDir)
  const planned = [
    `复制 ${sourceDir} 到 ${target}${exists ? '（--force：同名文件按源覆盖，目标其余文件保留不删）' : ''}`,
    ...DROP.map((p) => `跳过 ${p}（只在基座成立，不复制）`),
    ...ROOT_FILES.map(([, to]) => `写入 ${to}`),
    ...(baseVersion !== undefined ? [`写入 .base-version（源版本 ${baseVersion}）`] : []),
    ...tplFiles.map((rel) => `还原 ${rel} 为 ${rel.slice(0, -'.tpl'.length)}`),
  ]
  if (dryRun) return { action: 'dry-run', target, name: projectName, baseVersion, planned }

  await cp(sourceDir, target, {
    recursive: true,
    force: true,
    filter: (src) => {
      // sourceDir 已无尾分隔符，slice 恰好剥掉前缀与分隔符，rel 是真实相对路径。
      const rel = src.slice(sourceDir.length + 1)
      return !isDropped(rel)
    },
  })

  // 这里不按 DROP 清单删目标侧的任何东西。DROP 的语义是「源目录里只在基座成立的路径」，
  // cp 的 filter 已经在复制时把它们挡在门外；再对 target 删一遍会连带删掉目标里本属于用户的
  // .git（提交历史）、node_modules 与 evals/（手写用例），--force 重跑已生成的项目时尤其致命。
  // 覆盖语义只到「同名文件按源覆盖」，不扩大到「删掉源里没有的」。

  // 先还原 .md.tpl 再渲染根文件：打包产物里 templates/root/ 的 Markdown 模板也是 .tpl 形态，
  // 还原之后 ROOT_FILES 才读得到；本机基座没有 .tpl 文件，此步对它是空操作，先后无影响。
  await restoreMarkdownTemplates(target)

  for (const [from, to] of ROOT_FILES) {
    const template = await readRootTemplate(rootTemplates, from)
    const dest = join(target, to)
    await mkdir(dirname(dest), { recursive: true })
    await writeFile(dest, render(template, { name: projectName, owner, repo }), 'utf8')
  }

  // 版本戳：把源版本写进目标根 .base-version（单行版本号加换行），基座的 check-projects.mjs 靠它算派生项目落后几版。
  // 与「基座版本」输出行同策略：读不到源版本（自备 --source 无 package.json）时省略此文件，不算失败。
  if (baseVersion !== undefined) {
    await writeFile(join(target, BASE_VERSION_FILE), `${baseVersion}\n`, 'utf8')
  }

  const license = join(target, 'LICENSE')
  if (author && existsSync(license)) {
    const text = await readFile(license, 'utf8')
    // 用回调而不是模板串：author 里的 $&、$1 在字符串形式下是替换模式，会插回原版权行，
    // 写出「Copyright (c) 2026 ACopyright (c) 2026 Chained1001B」这类坏内容且无人能发现。
    await writeFile(license, text.replace(/Copyright \(c\) .*/, () => `Copyright (c) ${new Date().getFullYear()} ${author}`), 'utf8')
  }

  return {
    action: 'created',
    target,
    name: projectName,
    baseVersion,
    files: ROOT_FILES.map(([, to]) => to),
    next: [
      '未提供 --author 时，把 LICENSE 的版权行改为自己',
      '补全 README.md、AGENTS.md、CHANGELOG.md、package.json 里的 TODO',
      'node scripts/init-skill.mjs <技能名> 生成第一个技能',
      'git init',
      'node scripts/install-hooks.mjs 安装提交前校验',
      'npm run validate && npm test',
    ],
  }
}

export function parseArgs(argv) {
  const options = { target: undefined, name: undefined, owner: 'TODO-owner', repo: 'TODO-repo', author: undefined, source: undefined, dryRun: false, force: false, json: false, help: false }
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--name') options.name = requireValue(argv, ++i, arg)
    else if (arg === '--owner') options.owner = requireValue(argv, ++i, arg)
    else if (arg === '--repo') options.repo = requireValue(argv, ++i, arg)
    else if (arg === '--author') options.author = requireValue(argv, ++i, arg)
    else if (arg === '--source') options.source = requireValue(argv, ++i, arg)
    else if (arg === '--dry-run') options.dryRun = true
    else if (arg === '--force') options.force = true
    else if (arg === '--json') options.json = true
    else if (arg === '--help' || arg === '-h') options.help = true
    else if (arg.startsWith('--')) throw new UsageError(`未知参数 ${arg}。${USAGE}`)
    else if (options.target === undefined) options.target = arg
    else throw new UsageError(`多余的参数 ${arg}。${USAGE}`)
  }
  if (!options.help && !options.target) throw new UsageError(USAGE)
  return options
}

function requireValue(argv, index, flag) {
  if (index >= argv.length || argv[index].startsWith('--')) throw new UsageError(`${flag} 缺少取值。${USAGE}`)
  return argv[index]
}

// 错误出口唯一化：--json 时一律输出 {ok:false, errors:[{code,message}], data:{}}，否则写 stderr。
// 用法错误（UsageError）与文件路径错误必须走同一出口，只差退出码；漏掉一处，调用方就会在
// 「参数错」与「业务错」上拿到两种格式，无法统一解析。
function reportError(error, { json, code, exitCode }) {
  if (json) {
    console.log(JSON.stringify({ ok: false, errors: [{ code, message: error.message }], data: {} }, null, 2))
  } else {
    console.error(error.message)
  }
  process.exitCode = exitCode
}

async function main() {
  let options
  try {
    options = parseArgs(process.argv.slice(2))
  } catch (error) {
    // parseArgs 抛错时 options 还不存在，只能从 argv 里找 --json。
    reportError(error, { json: process.argv.includes('--json'), code: 'E_ARGS', exitCode: 2 })
    return
  }
  if (options.help) {
    console.log(USAGE)
    return
  }

  const target = resolve(options.target)
  try {
    const result = await initProject({
      target,
      name: options.name,
      owner: options.owner,
      repo: options.repo,
      author: options.author,
      source: options.source,
      dryRun: options.dryRun,
      force: options.force,
    })
    if (options.json) {
      console.log(JSON.stringify({ ok: true, errors: [], data: result }, null, 2))
    } else if (result.action === 'dry-run') {
      console.log('将执行：')
      for (const line of result.planned) console.log(`- ${line}`)
    } else {
      console.log(`已生成 ${result.target}`)
      if (result.baseVersion) console.log(`基座版本 ${result.baseVersion}`)
      console.log('接下来：')
      for (const line of result.next) console.log(`- ${line}`)
    }
  } catch (error) {
    if (error instanceof UsageError) {
      reportError(error, { json: options.json, code: 'E_ARGS', exitCode: 2 })
      return
    }
    // 未知错误（如 EACCES/ENOTDIR 等底层 IO 失败）不再误标 E_EXISTS，统一报 E_IO。
    const code = error instanceof TemplateError ? 'E_TEMPLATE' : error instanceof ExistsError ? 'E_EXISTS' : 'E_IO'
    reportError(error, { json: options.json, code, exitCode: error instanceof TemplateError ? 3 : 1 })
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await main()
}
