import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

const root = new URL('../.agent-sources/', import.meta.url)
const registry = [
  { id: 'ratstack-guide', title: 'Ratstack agent guide', url: 'https://ratstack.sh/llms.txt', file: 'ratstack-llms.txt', document: 'ratstack/guide.txt', index: 'ratstack/guide-index.md', package: null },
  { id: 'ratstack', title: 'Ratstack patterns and guidelines', url: 'https://ratstack.sh/llms-full.txt', file: 'ratstack-full.txt', document: 'ratstack/docs.txt', index: 'ratstack/index.md', package: null },
  { id: 'effect', title: 'Effect official overview', url: 'https://raw.githubusercontent.com/Effect-TS/effect/main/README.md', file: 'effect-readme.md', document: 'effect/docs.txt', index: 'effect/index.md', package: 'effect' },
  { id: 'xstate', title: 'XState documentation map', url: 'https://stately.ai/llms.txt', file: 'xstate-llms.txt', document: 'xstate/docs.txt', index: 'xstate/index.md', package: 'xstate' },
  { id: 'xstate-effect', title: 'XState Effect quick start', url: 'https://stately.ai/docs/xstate/v6/effect/quick-start.mdx', file: 'xstate-effect.md', document: 'xstate-effect/docs.txt', index: 'xstate-effect/index.md', package: '@xstate/effect' },
]
const args = process.argv.slice(2)
if (args.length && (args.length !== 4 || args[0] !== '--from-dir' || args[2] !== '--fetched-at')) {
  throw new Error('Usage: node scripts/refresh-pattern-sources.mjs [--from-dir DIR --fetched-at ISO_TIMESTAMP]')
}
const fetchedAt = args.length ? new Date(args[3]).toISOString() : new Date().toISOString()
const prepared = []
for (const source of registry) {
  let bytes
  if (args.length) bytes = await readFile(join(args[1], source.file))
  else {
    const response = await fetch(source.url, { signal: AbortSignal.timeout(30_000) })
    if (!response.ok) throw new Error(`${source.id}: HTTP ${response.status}`)
    bytes = Buffer.from(await response.arrayBuffer())
  }
  const document = bytes.toString('utf8')
  if (!document.trim() || /<!doctype html|<html[\s>]/i.test(document)) {
    throw new Error(`${source.id}: expected Markdown, received empty content or HTML`)
  }
  const lines = document.split('\n')
  const topics = []
  let fence
  for (let i = 0; i < lines.length; i++) {
    const marker = /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(lines[i])
    if (marker) {
      if (!fence) fence = marker[1]
      else if (marker[1][0] === fence[0] && marker[1].length >= fence.length && !marker[2].trim()) fence = undefined
      continue
    }
    if (fence) continue
    const heading = /^#{1,6} (.+?)\r?$/.exec(lines[i])
    if (heading) topics.push({ name: heading[1].replaceAll('|', '\\|'), start: i + 1 })
  }
  if (!topics.length) throw new Error(`${source.id}: no Markdown headings found`)
  const filename = source.document.split('/').at(-1)
  const index = [
    `# ${source.title} index`, '',
    `Source: ${source.url}`, '',
    `Line ranges refer to [${filename}](${filename}). Read [the source guide](../README.md) before applying examples.`, '',
    '| Topic | Start line | End line |', '| --- | ---: | ---: |',
    ...topics.map((topic, i) => `| ${topic.name} | ${topic.start} | ${topics[i + 1] ? topics[i + 1].start - 1 : lines.length} |`), '',
  ].join('\n')
  prepared.push({ source, bytes, index })
}
const sources = JSON.parse(await readFile(new URL('sources.json', root), 'utf8'))
for (const { source, bytes, index } of prepared) {
  await mkdir(new URL(`${source.document.split('/')[0]}/`, root), { recursive: true })
  await writeFile(new URL(source.document, root), bytes)
  await writeFile(new URL(source.index, root), index)
  sources[source.id] = {
    url: source.url, fetchedAt,
    retrieval: args.length ? 'imported-download; timestamp supplied by caller' : 'https',
    sha256: createHash('sha256').update(bytes).digest('hex'), bytes: bytes.length,
    package: source.package, targetPackageVersion: null, upstreamVersion: null, upstreamRevision: null,
    compatibility: 'Unversioned reference snapshot. These packages are not installed in this project at initial import. Verify current dependencies and upstream API versions before use.',
    document: source.document, index: source.index,
  }
}
await writeFile(new URL('sources.json', root), `${JSON.stringify(sources, null, 2)}\n`)
console.log(`Cached and indexed ${prepared.length} pattern references`)
