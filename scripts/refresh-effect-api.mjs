/* oxlint-disable no-restricted-imports, no-restricted-properties -- legacy: port to the Effect platform services, see "Node scripts" in AGENTS.md */
// Index the public API of the installed Effect packages.
// Each package already ships its declarations with JSDoc, its source, and its
// agent guides at the pinned version, so this writes one module index and
// copies nothing. It reads only local files.
//
//   node scripts/refresh-effect-api.mjs           write .agent-sources/effect/index.md
//   node scripts/refresh-effect-api.mjs --check   fail when that file does not match the installed packages

import { existsSync } from 'node:fs'
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { logError, logInfo } from '../lib/logger.mjs'

const args = process.argv.slice(2)
if (args.length > 1 || (args.length === 1 && args[0] !== '--check')) {
  throw new Error('Usage: node scripts/refresh-effect-api.mjs [--check]')
}
const repo = fileURLToPath(new URL('../', import.meta.url))
const indexPath = join(repo, '.agent-sources/effect/index.md')
const readJson = async (path) => JSON.parse(await readFile(path, 'utf8'))
const byCodeUnit = (a, b) => (a < b ? -1 : a > b ? 1 : 0)

// The workspaces that can declare an Effect dependency: the root and each folder a workspace glob names.
const workspaceDirs = async () => {
  const dirs = [repo]
  for (const pattern of (await readJson(join(repo, 'package.json'))).workspaces) {
    if (!pattern.endsWith('/*')) throw new Error(`Unsupported workspace pattern "${pattern}"`)
    const parent = join(repo, pattern.slice(0, -2))
    for (const entry of await readdir(parent, { withFileTypes: true })) {
      if (entry.isDirectory() && existsSync(join(parent, entry.name, 'package.json'))) dirs.push(join(parent, entry.name))
    }
  }
  return dirs
}

// Finds the copy of a package that a workspace resolves, by walking up to the repository root.
const installedDir = (name, from) => {
  for (let dir = from; ; dir = dirname(dir)) {
    const candidate = join(dir, 'node_modules', name)
    if (existsSync(join(candidate, 'package.json'))) return candidate
    if (relative(repo, dir) === '') throw new Error(`${name} is not installed for ${relative(repo, from) || '.'}; run bun install`)
  }
}

// Every Effect package a workspace depends on, with the one installed copy all of them resolve.
const effectPackages = async () => {
  const found = new Map()
  for (const dir of await workspaceDirs()) {
    const manifest = await readJson(join(dir, 'package.json'))
    for (const [name, pin] of Object.entries({ ...manifest.dependencies, ...manifest.devDependencies })) {
      if (name !== 'effect' && !name.startsWith('@effect/')) continue
      const installed = installedDir(name, dir)
      const { version } = await readJson(join(installed, 'package.json'))
      const where = relative(repo, dir) || '.'
      if (version !== pin) throw new Error(`${where} pins ${name}@${pin} but ${version} is installed; run bun install`)
      const known = found.get(name)
      if (known && known.dir !== installed) throw new Error(`${name} resolves to two copies: ${relative(repo, known.dir)} and ${relative(repo, installed)}`)
      found.set(name, { name, version, dir: installed })
    }
  }
  // The core package leads; the scoped packages follow by name.
  return [...found.values()].sort((a, b) => (b.name === 'effect') - (a.name === 'effect') || byCodeUnit(a.name, b.name))
}

// Public declaration files under dist: every module the package's "./*" export exposes.
const declarationFiles = async (dir) => {
  if (!existsSync(dir)) return []
  const nested = await Promise.all((await readdir(dir, { withFileTypes: true })).map((entry) => {
    if (entry.isDirectory()) return entry.name === 'internal' ? [] : declarationFiles(join(dir, entry.name))
    return entry.name.endsWith('.d.ts') && entry.name !== 'index.d.ts' ? [join(dir, entry.name)] : []
  }))
  return nested.flat()
}

// The first sentence of a file's leading JSDoc block, or '' when it has none. Reference directives may precede the block.
const summaryOf = (text) => {
  const head = text.replace(/^(?:[ \t]*(?:\/\/\/[^\n]*)?\n)*/, '')
  if (!head.startsWith('/**')) return ''
  const paragraph = []
  for (const raw of head.slice(3, head.indexOf('*/')).split('\n')) {
    const line = raw.replace(/^\s*\*?\s?/, '').trim()
    if (line.startsWith('@') || (!line && paragraph.length)) break
    if (line) paragraph.push(line)
  }
  const sentence = /^.*?[.!?](?=\s|$)/.exec(paragraph.join(' '))?.[0] ?? paragraph.join(' ')
  return sentence.replaceAll('|', '\\|')
}

const exported = /^export (?:declare )?(?:abstract )?(?:const|function|type|interface|class|namespace|enum) /
const sections = []
const totals = []
for (const pkg of await effectPackages()) {
  const dist = join(pkg.dir, 'dist')
  const files = (await declarationFiles(dist)).sort(byCodeUnit)
  if (!files.length) continue
  const location = relative(repo, pkg.dir)
  const rows = []
  let exportCount = 0
  for (const file of files) {
    const module = relative(dist, file).slice(0, -'.d.ts'.length)
    const declarations = await readFile(file, 'utf8')
    const lines = declarations.split('\n')
    const count = lines.filter((line) => exported.test(line)).length
    exportCount += count
    // The compiler drops a module's leading JSDoc when imports follow it, so read the shipped source first.
    const source = join(pkg.dir, 'src', `${module}.ts`)
    // A module that only forwards another one has no declarations of its own; name where they live.
    const forwarded = [...declarations.matchAll(/^export \* from "([^"]+)"/gm)].map((match) => `\`${match[1]}\``)
    const summary = (existsSync(source) ? summaryOf(await readFile(source, 'utf8')) : '') || summaryOf(declarations)
      || (forwarded.length ? `Re-exports ${forwarded.join(', ')}.` : '')
    rows.push(`| ${pkg.name}/${module} | ${count} | ${lines.length} | ${summary} |`)
  }
  const guides = ['AGENTS.md', 'ai-docs', 'README.md'].filter((guide) => existsSync(join(pkg.dir, guide))).map((guide) => `\`${location}/${guide}\``)
  totals.push(`| ${pkg.name} | ${pkg.version} | ${rows.length} | ${exportCount} | \`${location}/dist\` |`)
  sections.push(
    `## ${pkg.name}@${pkg.version}`, '',
    `Declarations: \`${location}/dist/<module>.d.ts\`. Guides: ${guides.join(', ')}.`, '',
    '| Module | Exports | Lines | Summary |', '| --- | ---: | ---: | --- |', ...rows, '',
  )
}
if (!sections.length) throw new Error('No installed Effect package has declaration files')

const index = [
  '# Effect API index', '',
  'Generated by `scripts/refresh-effect-api.mjs` from the installed packages. Do not edit it; `bun run check:effect-api` fails when it is stale.', '',
  'Each row is one public module, named by its import path. Drop the package name to get its file under the package\'s declarations folder, then list its exports:', '',
  '```sh', "rg -n '^export ' node_modules/effect/dist/Logger.d.ts", '```', '',
  'Read [the source guide](../README.md) before applying examples.', '',
  '| Package | Version | Modules | Exports | Declarations |', '| --- | --- | ---: | ---: | --- |', ...totals, '',
  ...sections,
].join('\n')

if (args[0] === '--check') {
  const current = existsSync(indexPath) ? await readFile(indexPath, 'utf8') : ''
  if (current !== index) {
    logError('.agent-sources/effect/index.md does not match the installed Effect packages; run node scripts/refresh-effect-api.mjs')
    process.exitCode = 1
  }
} else {
  await mkdir(dirname(indexPath), { recursive: true })
  await writeFile(indexPath, index)
  logInfo(`Indexed ${totals.length} Effect packages in .agent-sources/effect/index.md`)
}
