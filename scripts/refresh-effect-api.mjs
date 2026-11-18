// Cache Effect API reference from the installed package's type declarations.
// The declarations carry the same JSDoc the effect.website API pages render,
// and they match the installed version exactly. Nothing is fetched.
//
//   node scripts/refresh-effect-api.mjs [module ...]   (default: cli)
import { createHash } from 'node:crypto'
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises'

const repo = new URL('../', import.meta.url)
const root = new URL('.agent-sources/', repo)
const pkgDir = new URL('node_modules/effect/', repo)
const modules = process.argv.slice(2).length ? process.argv.slice(2) : ['cli']
for (const name of modules) {
  if (!/^[a-z]+$/.test(name)) throw new Error(`Usage: node scripts/refresh-effect-api.mjs [module ...] (got "${name}")`)
}

const pkg = JSON.parse(await readFile(new URL('package.json', pkgDir), 'utf8'))
const sources = JSON.parse(await readFile(new URL('sources.json', root), 'utf8'))
const declaration = /^export (?:declare )?(?:const|function|type|interface|class|namespace|enum) ([A-Za-z_$][\w$]*)/

for (const name of modules) {
  if (!pkg.exports[`./${name}`]) throw new Error(`effect@${pkg.version} has no "effect/${name}" export`)
  const dir = new URL(`dist/${name}/`, pkgDir)
  const files = (await readdir(dir)).filter((f) => f.endsWith('.d.ts') && f !== 'index.d.ts').sort()
  if (!files.length) throw new Error(`effect/${name}: no declaration files in ${dir.pathname}`)

  const out = []
  const rows = []
  for (const file of files) {
    const moduleName = file.slice(0, -'.d.ts'.length)
    const text = (await readFile(new URL(file, dir), 'utf8')).replace(/\n?\/\/# sourceMappingURL=.*\n?$/, '\n')
    const lines = text.split('\n')
    const offset = out.length + 2
    out.push(`# effect/${name}/${moduleName}`, '', ...lines)
    const exports = []
    for (let i = 0; i < lines.length; i++) {
      const match = declaration.exec(lines[i])
      if (!match) continue
      let start = i
      if (lines[i - 1]?.trim() === '*/') while (start > 0 && !lines[start].trimStart().startsWith('/**')) start--
      exports.push({ name: match[1], start: offset + start + 1 })
    }
    const moduleEnd = out.length
    rows.push({ module: moduleName, name: '(module overview)', start: offset - 1, end: (exports[0]?.start ?? moduleEnd + 1) - 1 })
    exports.forEach((e, i) => rows.push({ module: moduleName, name: e.name, start: e.start, end: (exports[i + 1]?.start ?? moduleEnd + 1) - 1 }))
  }

  const document = `${out.join('\n')}\n`
  const bytes = Buffer.from(document, 'utf8')
  const docPath = `effect-api/${name}.txt`
  const indexPath = `effect-api/${name}-index.md`
  const index = [
    `# effect/${name} API index`, '',
    `Generated from the type declarations of the installed \`effect@${pkg.version}\` by \`scripts/refresh-effect-api.mjs\`.`, '',
    `Line ranges refer to [${name}.txt](${name}.txt). Read [the source guide](../README.md) before applying examples.`, '',
    '| Module | Export | Start line | End line |', '| --- | --- | ---: | ---: |',
    ...rows.map((r) => `| ${r.module} | ${r.name} | ${r.start} | ${r.end} |`), '',
  ].join('\n')

  await mkdir(new URL('effect-api/', root), { recursive: true })
  await writeFile(new URL(docPath, root), bytes)
  await writeFile(new URL(indexPath, root), index)
  sources[`effect-api-${name}`] = {
    url: `node_modules/effect/dist/${name}/*.d.ts`,
    fetchedAt: new Date().toISOString(),
    retrieval: 'installed-package',
    sha256: createHash('sha256').update(bytes).digest('hex'), bytes: bytes.length,
    package: 'effect', targetPackageVersion: pkg.version, upstreamVersion: pkg.version, upstreamRevision: null,
    compatibility: `Generated from the installed effect@${pkg.version} declarations; matches that version exactly. Regenerate after an effect upgrade.`,
    document: docPath, index: indexPath,
  }
  console.log(`effect/${name}: ${files.length} modules, ${rows.length} entries from effect@${pkg.version}`)
}
await writeFile(new URL('sources.json', root), `${JSON.stringify(sources, null, 2)}\n`)
