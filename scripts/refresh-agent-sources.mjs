import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'

const root = new URL('../', import.meta.url)
const sourceUrl = 'https://tamagui.dev/llms.txt'
const args = process.argv.slice(2)
if (args.length && (args.length !== 4 || args[0] !== '--from-file' || args[2] !== '--fetched-at')) {
  throw new Error('Usage: node scripts/refresh-agent-sources.mjs [--from-file FILE --fetched-at ISO_TIMESTAMP]')
}
const fetchedAt = args.length ? new Date(args[3]).toISOString() : new Date().toISOString()
let bytes
if (args.length) {
  bytes = await readFile(args[1])
} else {
  const response = await fetch(sourceUrl, { signal: AbortSignal.timeout(30_000) })
  if (!response.ok) throw new Error(`Download failed: HTTP ${response.status}`)
  bytes = Buffer.from(await response.arrayBuffer())
}
const document = bytes.toString('utf8')
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
  const match = /^## ([a-z0-9-]+\/[a-z0-9/.-]+)\r?$/.exec(lines[i])
  if (match) topics.push({ name: match[1], start: i + 1 })
}
if (!document.startsWith('# Tamagui Complete Documentation\n') || topics.length < 10) {
  throw new Error('Unexpected documentation format; existing cache was not changed')
}
const packageJson = JSON.parse(await readFile(new URL('apps/web/package.json', root), 'utf8'))
let sources = {}
try {
  sources = JSON.parse(await readFile(new URL('.agent-sources/sources.json', root), 'utf8'))
} catch (error) {
  if (error.code !== 'ENOENT') throw error
}
const source = {
  url: sourceUrl,
  fetchedAt,
  retrieval: args.length ? 'imported-download; timestamp supplied by caller' : 'https',
  sha256: createHash('sha256').update(bytes).digest('hex'),
  bytes: bytes.length,
  package: 'tamagui',
  targetPackageVersion: packageJson.dependencies.tamagui,
  upstreamVersion: null,
  upstreamRevision: null,
  compatibility: 'Unversioned website snapshot; compatibility with the target package version is not established.',
  document: 'tamagui/docs.txt',
  index: 'tamagui/index.md',
}
const index = [
  '# Tamagui topic index',
  '',
  'Generated from the official download. Line ranges refer to [docs.txt](docs.txt).',
  'Read [../README.md](../README.md) for version checks and refresh instructions.',
  'Search this index first, then read only the relevant line range.',
  '',
  '| Topic | Start line | End line |',
  '| --- | ---: | ---: |',
  ...topics.map((topic, i) => `| ${topic.name} | ${topic.start} | ${topics[i + 1]?.start - 1 || lines.length} |`),
  '',
].join('\n')
await mkdir(new URL('.agent-sources/tamagui/', root), { recursive: true })
await writeFile(new URL('.agent-sources/tamagui/docs.txt', root), bytes)
await writeFile(new URL('.agent-sources/tamagui/index.md', root), index)
await writeFile(new URL('.agent-sources/sources.json', root), `${JSON.stringify({ ...sources, tamagui: source }, null, 2)}\n`)
console.log(`Cached ${bytes.length} bytes and indexed ${topics.length} Tamagui topics`)
