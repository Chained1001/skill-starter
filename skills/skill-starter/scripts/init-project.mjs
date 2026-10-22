#!/usr/bin/env node
// 把基座（或 --source 指定的基座内容目录）变成一个新项目：复制骨架、用模板替换根文件、把 .md.tpl 还原为 .md、删掉只在基座成立的文件。只用 Node 内置模块。
// 用法：init-project.mjs <目标目录> [--name <包名>] [--owner <owner>] [--repo <repo>] [--author <名>] [--source <目录>] [--dry-run] [--force] [--json] [--help]
// 退出码：0 成功，1 业务失败（目标已存在），2 参数错误，3 模板缺失。
import { existsSync } from 'node:fs'
import { cp, mkdir, readdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises'
import { basename, dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

// 缺省源：脚本所在的基座根。--source 可换成随技能携带的基座内容目录。
const SOURCE = fileURLToPath(new URL('..', import.meta.url))
const USAGE = '用法：init-project.mjs <目标目录> [--name <包名>] [--owner <owner>] [--repo <repo>] [--author <名>] [--source <目录>] [--dry-run] [--force] [--json] [--help]'
const NAME_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

// 只在基座成立的路径：示例、示例测试、评测示例、生成器与打包器及其测试。
const DROP = [
  'examples',
  'evals',
  join('scripts', 'init-project.mjs'),
  join('scripts', 'pack.mjs'),
  join('test', 'base-only.test.mjs'),
  join('test', 'examples.test.mjs'),
  join('test', 'init-project.test.mjs'),
  join('test', 'pack.test.mjs'),
]

// 根文件：模板名 → 项目内名字。
const ROOT_FILES = [
  ['README.md', 'README.md'],
  ['AGENTS.md', 'AGENTS.md'],
  ['CHANGELOG.md', 'CHANGELOG.md'],
  ['package.json', 'package.json'],
  ['gitignore', '.gitignore'],
  ['ci.yml', join('.github', 'workflows', 'ci.yml')],
]

// 源目录必须齐备的根模板：templates/root/ 下的七个文件（渲染用的六个之外还有 GLOSSARY.md）。
const REQUIRED_ROOT_TEMPLATES = ['README.md', 'AGENTS.md', 'CHANGELOG.md', 'GLOSSARY.md', 'package.json', 'gitignore', 'ci.yml']

export class UsageError extends Error {}
export class TemplateError extends Error {}
export class ExistsError extends Error {}

function render(text, { name, owner, repo }) {
  return text
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

function isDropped(rel) {
  return DROP.some((p) => rel === p || rel.startsWith(`${p}\\`) || rel.startsWith(`${p}/`))
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
async function restoreMarkdownTemplates(root) {
  for (const rel of await walkFiles(root)) {
    if (!rel.endsWith('.md.tpl')) continue
    const dest = rel.slice(0, -'.tpl'.length)
    if (existsSync(join(root, dest))) {
      throw new TemplateError(`还原 ${rel} 时与已存在的 ${dest} 冲突。源目录不应同时保留同一文件的 .md 与 .md.tpl`)
    }
    await rename(join(root, rel), join(root, dest))
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

export async function initProject({ target, name, owner = 'TODO-owner', repo = 'TODO-repo', author, source, dryRun = false, force = false }) {
  const projectName = name ?? basename(target)
  if (!NAME_PATTERN.test(projectName) || projectName.length > 64) {
    throw new UsageError(`项目名 "${projectName}" 不合法：须为 1–64 位小写英文、数字与单连字符。用 --name 指定合法名，或换一个目录名`)
  }

  const exists = existsSync(target)
  if (exists && !force && !(await isEmptyDir(target))) {
    throw new ExistsError(`目标已存在且非空：${target}。换一个目录，或加 --force`)
  }

  const sourceDir = source === undefined ? SOURCE : resolve(source)
  if (source !== undefined && !(await isDirectory(sourceDir))) {
    throw new TemplateError(`--source 指向的目录不存在：${source}。请改为包含 templates/root/ 的基座内容目录`)
  }
  const rootTemplates = join(sourceDir, 'templates', 'root')
  for (const from of REQUIRED_ROOT_TEMPLATES) {
    // 打包产物里根 Markdown 模板是 .md.tpl 形态，两种名字都算齐备；生成时先还原再渲染。
    const names = from.endsWith('.md') ? [from, `${from}.tpl`] : [from]
    if (!names.some((n) => existsSync(join(rootTemplates, n)))) {
      const fix = source === undefined
        ? '请确认基座的 templates/root/ 未被删除'
        : '请确认 --source 目录包含 templates/root/ 全部七个根模板（README、AGENTS、CHANGELOG、GLOSSARY、package.json、gitignore、ci.yml，Markdown 模板可为 .md.tpl 形态）'
      throw new TemplateError(`模板缺失：${join(rootTemplates, from)}。${fix}`)
    }
  }

  const tplFiles = (await walkFiles(sourceDir)).filter((rel) => rel.endsWith('.md.tpl') && !isDropped(rel))
  const planned = [
    `复制 ${sourceDir} 到 ${target}`,
    ...DROP.map((p) => `删除 ${p}`),
    ...ROOT_FILES.map(([, to]) => `写入 ${to}`),
    ...tplFiles.map((rel) => `还原 ${rel} 为 ${rel.slice(0, -'.tpl'.length)}`),
  ]
  if (dryRun) return { action: 'dry-run', target, name: projectName, planned }

  await cp(sourceDir, target, {
    recursive: true,
    force: true,
    filter: (src) => {
      const rel = src.slice(sourceDir.length + 1)
      return !isDropped(rel)
    },
  })

  for (const p of DROP) await rm(join(target, p), { recursive: true, force: true })

  // 先还原 .md.tpl 再渲染根文件：打包产物里 templates/root/ 的 Markdown 模板也是 .tpl 形态，
  // 还原之后 ROOT_FILES 才读得到；本机基座没有 .tpl 文件，此步对它是空操作，先后无影响。
  await restoreMarkdownTemplates(target)

  for (const [from, to] of ROOT_FILES) {
    const template = await readRootTemplate(rootTemplates, from)
    const dest = join(target, to)
    await mkdir(dirname(dest), { recursive: true })
    await writeFile(dest, render(template, { name: projectName, owner, repo }), 'utf8')
  }

  const license = join(target, 'LICENSE')
  if (author && existsSync(license)) {
    const text = await readFile(license, 'utf8')
    await writeFile(license, text.replace(/Copyright \(c\) .*/, `Copyright (c) ${new Date().getFullYear()} ${author}`), 'utf8')
  }

  return {
    action: 'created',
    target,
    name: projectName,
    files: ROOT_FILES.map(([, to]) => to),
    next: [
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

async function main() {
  let options
  try {
    options = parseArgs(process.argv.slice(2))
  } catch (error) {
    console.error(error.message)
    process.exitCode = 2
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
      console.log('接下来：')
      for (const line of result.next) console.log(`- ${line}`)
    }
  } catch (error) {
    if (error instanceof UsageError) {
      console.error(error.message)
      process.exitCode = 2
      return
    }
    const code = error instanceof TemplateError ? 'E_TEMPLATE' : 'E_EXISTS'
    if (options.json) {
      console.log(JSON.stringify({ ok: false, errors: [{ code, message: error.message }], data: {} }, null, 2))
    } else {
      console.error(error.message)
    }
    process.exitCode = error instanceof TemplateError ? 3 : 1
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await main()
}
