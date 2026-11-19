/* oxlint-disable no-restricted-imports, no-restricted-properties -- legacy: port to the Effect platform services, see "Node scripts" in AGENTS.md */
// Index the core `effect` modules (Array, Order, Effect, Schema, ...) for agents.
// Each row names one export, the first sentence of its JSDoc, and its line range in the
// installed declaration file, so a search by name or intent leads straight to the source.
// Nothing is copied or fetched: the declarations stay in node_modules.
//
//   node scripts/index-effect-core.mjs          write .agent-sources/effect/core-index.md
//   node scripts/index-effect-core.mjs --check  fail when the index does not match the installed effect
import { readdir, readFile, writeFile } from 'node:fs/promises'
import { logError, logInfo } from '../lib/logger.mjs'

const repo = new URL('../', import.meta.url)
const dist = new URL('node_modules/effect/dist/', repo)
const target = new URL('.agent-sources/effect/core-index.md', repo)
const declaration = /^export (?:declare )?(?:const|function|type|interface|class|namespace|enum) ([A-Za-z_$][\w$]*)/

// The first sentence of a JSDoc block, flattened to one line and safe inside a table cell.
const summarize = (block) => {
  const prose = []
  for (const raw of block) {
    const line = raw.replace(/^\s*\/?\*+\/?\s?/, '').trim()
    if (line.startsWith('@') || line.startsWith('**')) break
    if (line === '' && prose.length) break
    if (line) prose.push(line)
  }
  const text = prose.join(' ').replace(/\|/g, '\\|')
  const end = text.search(/\.(\s|$)/)
  const sentence = end === -1 ? text : text.slice(0, end + 1)
  return sentence.length > 140 ? `${sentence.slice(0, 137)}...` : sentence
}

const { version } = JSON.parse(await readFile(new URL('package.json', new URL('node_modules/effect/', repo)), 'utf8'))
const files = (await readdir(dist)).filter((f) => f.endsWith('.d.ts') && f !== 'index.d.ts').sort()
const rows = []
for (const file of files) {
  const module = file.slice(0, -'.d.ts'.length)
  const lines = (await readFile(new URL(file, dist), 'utf8')).split('\n')
  const exports = []
  for (let i = 0; i < lines.length; i++) {
    const match = declaration.exec(lines[i])
    if (!match) continue
    let start = i
    if (lines[i - 1]?.trim() === '*/') while (start > 0 && !lines[start].trimStart().startsWith('/**')) start--
    exports.push({ name: match[1], start: start + 1, doc: start < i ? lines.slice(start, i) : [] })
  }
  // A name that is a reserved word (try, catch, void) is declared as `try_` and exported in an
  // `export { /** doc */ try_ as try }` block, with its JSDoc inside the block.
  for (let i = 0; i < lines.length; i++) {
    if (!/^export \{\s*$/.test(lines[i])) continue
    let close = i + 1
    while (close < lines.length && !/\bas ([A-Za-z_$][\w$]*)\s*\};?\s*$/.test(lines[close])) close++
    const [, local, name] = /([A-Za-z_$][\w$]*) as ([A-Za-z_$][\w$]*)/.exec(lines[close]) ?? []
    if (!name) continue
    let start = i
    while (start > 0 && !new RegExp(`^declare (?:const|function|class) ${local.replace('$', '\\$')}\\b`).test(lines[start])) start--
    exports.push({ name, start: start + 1, doc: lines.slice(i + 1, close) })
  }
  exports.sort((x, y) => x.start - y.start)
  exports.forEach((e, i) => {
    const end = (exports[i + 1]?.start ?? lines.length + 1) - 1
    rows.push(`| ${module} | ${e.name} | ${e.start} | ${end} | ${summarize(e.doc)} |`)
  })
}

const index = [
  '# effect core API index', '',
  `Generated from the type declarations of the installed \`effect@${version}\` by \`scripts/index-effect-core.mjs\`. Run \`bun install\` first.`, '',
  'Each row is one export of `import { <Module> } from \'effect\'`. Its JSDoc, examples, and signature are lines Start to End of `node_modules/effect/dist/<Module>.d.ts`.', '',
  'Search by name or by intent, then read that range:', '',
  '```sh',
  "rg -n '^\\| Array \\| (sort|dedupe|groupBy) \\|' .agent-sources/effect/core-index.md",
  "rg -in 'duplicate|sorts' .agent-sources/effect/core-index.md",
  "sed -n '<Start>,<End>p' node_modules/effect/dist/<Module>.d.ts",
  '```', '',
  'For a native pattern and its Effect replacement, start with [native-to-effect.md](native-to-effect.md).', '',
  '| Module | Export | Start | End | Summary |', '| --- | --- | ---: | ---: | --- |',
  ...rows, '',
].join('\n')

if (process.argv.includes('--check')) {
  const current = await readFile(target, 'utf8').catch(() => '')
  if (current !== index) {
    logError(`.agent-sources/effect/core-index.md does not match effect@${version}. Fix: node scripts/index-effect-core.mjs`)
    process.exitCode = 1
  } else logInfo(`effect core index matches effect@${version} (${rows.length} exports)`)
} else {
  await writeFile(target, index)
  logInfo(`wrote the effect@${version} core index: ${files.length} modules, ${rows.length} exports`)
}
