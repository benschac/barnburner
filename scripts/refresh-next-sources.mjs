import { NodeRuntime, NodeServices } from '@effect/platform-node'
import { Effect, FileSystem, Path, Predicate, Schema } from 'effect'
import { Command } from 'effect/cli'
import { loggerLayer } from '../lib/logger.mjs'
import { createHash } from 'node:crypto'

// Caches the Next.js 16.4.6 App Router documentation (route handlers, metadata and image routes,
// next.config.js headers / serverExternalPackages / outputFileTracingIncludes, webpack builds).
// Pages come from the docs/ folder of vercel/next.js at the v16.4.6 tag's commit, not the live
// site, so the cache matches the installed version and reproduces. Nothing is written until every
// download has succeeded and parsed.
class SourceRefreshFailed extends Schema.TaggedError()('SourceRefreshFailed', {
  message: Schema.String,
  cause: Schema.Defect,
}) {}

const Sources = Schema.fromJsonString(Schema.Record(Schema.String, Schema.Any))

const repo = 'vercel/next.js'
const tag = 'v16.4.6'
const revision = '54b876b6b161b0ecda19562eb264bec637e60d6d'
const pinned = '16.4.6'
const base = 'docs/01-app/'
const pages = [
  "01-getting-started/01-installation.mdx",
  "01-getting-started/02-project-structure.mdx",
  "01-getting-started/03-layouts-and-pages.mdx",
  "01-getting-started/14-metadata-and-og-images.mdx",
  "01-getting-started/15-route-handlers.mdx",
  "02-guides/building.mdx",
  "02-guides/package-bundling.mdx",
  "02-guides/production-checklist.mdx",
  "03-api-reference/03-file-conventions/index.mdx",
  "03-api-reference/03-file-conventions/layout.mdx",
  "03-api-reference/03-file-conventions/page.mdx",
  "03-api-reference/03-file-conventions/route.mdx",
  "03-api-reference/03-file-conventions/dynamic-routes.mdx",
  "03-api-reference/03-file-conventions/route-groups.mdx",
  "03-api-reference/03-file-conventions/loading.mdx",
  "03-api-reference/03-file-conventions/error.mdx",
  "03-api-reference/03-file-conventions/not-found.mdx",
  "03-api-reference/03-file-conventions/template.mdx",
  "03-api-reference/03-file-conventions/default.mdx",
  "03-api-reference/03-file-conventions/01-metadata/index.mdx",
  "03-api-reference/03-file-conventions/01-metadata/app-icons.mdx",
  "03-api-reference/03-file-conventions/01-metadata/manifest.mdx",
  "03-api-reference/03-file-conventions/01-metadata/opengraph-image.mdx",
  "03-api-reference/03-file-conventions/01-metadata/robots.mdx",
  "03-api-reference/03-file-conventions/01-metadata/sitemap.mdx",
  "03-api-reference/03-file-conventions/02-route-segment-config/index.mdx",
  "03-api-reference/03-file-conventions/02-route-segment-config/runtime.mdx",
  "03-api-reference/03-file-conventions/02-route-segment-config/maxDuration.mdx",
  "03-api-reference/03-file-conventions/02-route-segment-config/dynamicParams.mdx",
  "03-api-reference/03-file-conventions/02-route-segment-config/preferredRegion.mdx",
  "03-api-reference/04-functions/generate-metadata.mdx",
  "03-api-reference/04-functions/generate-image-metadata.mdx",
  "03-api-reference/04-functions/generate-sitemaps.mdx",
  "03-api-reference/04-functions/generate-static-params.mdx",
  "03-api-reference/04-functions/generate-viewport.mdx",
  "03-api-reference/04-functions/image-response.mdx",
  "03-api-reference/04-functions/next-request.mdx",
  "03-api-reference/04-functions/next-response.mdx",
  "03-api-reference/04-functions/headers.mdx",
  "03-api-reference/04-functions/cookies.mdx",
  "03-api-reference/04-functions/after.mdx",
  "03-api-reference/04-functions/connection.mdx",
  "03-api-reference/04-functions/redirect.mdx",
  "03-api-reference/04-functions/not-found.mdx",
  "03-api-reference/05-config/01-next-config-js/index.mdx",
  "03-api-reference/05-config/01-next-config-js/headers.mdx",
  "03-api-reference/05-config/01-next-config-js/serverExternalPackages.mdx",
  "03-api-reference/05-config/01-next-config-js/output.mdx",
  "03-api-reference/05-config/01-next-config-js/webpack.mdx",
  "03-api-reference/05-config/01-next-config-js/turbopack.mdx",
  "03-api-reference/05-config/01-next-config-js/images.mdx",
  "03-api-reference/05-config/01-next-config-js/redirects.mdx",
  "03-api-reference/05-config/01-next-config-js/rewrites.mdx",
  "03-api-reference/05-config/01-next-config-js/transpilePackages.mdx",
  "03-api-reference/05-config/01-next-config-js/typescript.mdx",
  "03-api-reference/05-config/01-next-config-js/env.mdx",
  "03-api-reference/05-config/01-next-config-js/distDir.mdx",
  "03-api-reference/05-config/01-next-config-js/basePath.mdx",
  "03-api-reference/05-config/01-next-config-js/optimizePackageImports.mdx",
  "03-api-reference/05-config/01-next-config-js/productionBrowserSourceMaps.mdx",
  "03-api-reference/06-cli/next.mdx",
  "03-api-reference/08-turbopack.mdx"
  ]
const attempts = 3
const concurrency = 8

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex')
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const raw = (path) => `https://raw.githubusercontent.com/${repo}/${revision}/${path}`

const download = async (url) => {
  let failure
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(60_000) })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      return Buffer.from(await response.arrayBuffer())
    } catch (error) {
      failure = error
      await sleep(500 * attempt)
    }
  }
  throw new Error(`Download failed for ${url}: ${failure.message}`)
}

const parsePage = (path, bytes) => {
  const match = /^---\n([\s\S]*?)\n---\n/.exec(bytes.toString('utf8'))
  if (!match) throw new Error(`${path} has no front matter; existing cache was not changed`)
  const field = (name) => new RegExp(`^${name}: (.*)$`, 'm').exec(match[1])?.[1]?.replace(/^(["'])(.*)\1$/, '$2')
  const title = field('title')
  if (!title) throw new Error(`${path} has no title; existing cache was not changed`)
  return { title, description: field('description') ?? '', body: bytes.toString('utf8').slice(match[0].length).trim() }
}

const mapLimit = async (items, limit, fn) => {
  const results = new Array(items.length)
  let next = 0
  const worker = async () => {
    while (next < items.length) {
      const i = next++
      results[i] = await fn(items[i])
    }
  }
  await Promise.all(Array.from({ length: limit }, worker))
  return results
}

// Downloads and parses every page; resolves the files to write and the sources.json entry.
const collect = async () => {
  const fetchedAt = new Date().toISOString()
  const downloaded = await mapLimit(pages, concurrency, async (path) => parsePage(path, await download(raw(base + path))))
  const licence = await download(raw('license.md'))
  if (!/^The MIT License/.test(licence.toString('utf8'))) throw new Error('Unexpected licence; existing cache was not changed')

  const lines = ['# Next.js 16 App Router — Documentation', '', `- Source: https://github.com/${repo}/tree/${tag}/docs/01-app (commit ${revision})`, `- Version: ${pinned}`, '']
  const rows = []
  downloaded.forEach((page, i) => {
    const start = lines.length + 1
    lines.push(`#### ${page.title}`, `<!-- ${raw(base + pages[i])} -->`, '', ...page.body.split('\n'), '')
    const segments = pages[i].split('/').map((part) => part.replace(/^\d+-/, '').replace(/\.mdx$/, ''))
    rows.push({ category: segments.length > 1 ? segments.slice(0, segments[0] === 'api-reference' ? 2 : 1).join('/') : segments[0], title: page.title.replaceAll('|', '/'), path: pages[i], start, end: lines.length - 1 })
  })
  const document = Buffer.from(`${lines.join('\n')}\n`)
  const index = [
    '# Next.js 16 App Router topic index',
    '',
    'Generated from the official pages. Line ranges refer to [docs.txt](docs.txt).',
    'Read [../README.md](../README.md) for version checks and refresh instructions.',
    'Search this index first, then read only the relevant line range.',
    '',
    '| Category | Topic | Path | Start line | End line |',
    '| --- | --- | --- | ---: | ---: |',
    ...rows.map((row) => `| ${row.category} | ${row.title} | ${row.path} | ${row.start} | ${row.end} |`),
    '',
  ].join('\n')

  const entry = {
    url: `https://github.com/${repo}/tree/${tag}/docs/01-app`,
    fetchedAt,
    retrieval: 'https',
    sha256: sha256(document),
    bytes: document.length,
    package: 'next',
    targetPackageVersion: pinned,
    upstreamVersion: pinned,
    upstreamRevision: revision,
    pages: downloaded.length,
    licence: { spdx: 'MIT', url: raw('license.md'), file: 'next/LICENSE', sha256: sha256(licence) },
    compatibility: `Pinned to the ${tag} tag, which matches the planned next@${pinned}.`,
    document: 'next/docs.txt',
    index: 'next/index.md',
  }

  const files = new Map([['next/docs.txt', document], ['next/index.md', Buffer.from(index)], ['next/LICENSE', licence]])
  return { files, entry, count: downloaded.length }
}

const program = Effect.fn('refreshNextSources')(function* () {
  const fs = yield* FileSystem.FileSystem
  const path = yield* Path.Path
  const root = path.resolve(yield* path.fromFileUrl(new URL('../', import.meta.url)))
  const sourcesFile = path.join(root, '.agent-sources', 'sources.json')
  const sources = (yield* fs.exists(sourcesFile))
    ? yield* Schema.decodeUnknownEffect(Sources)(yield* fs.readFileString(sourcesFile))
    : {}
  const { files, entry, count } = yield* Effect.tryPromise({
    try: collect,
    catch: (cause) => new SourceRefreshFailed({ message: Predicate.isError(cause) ? cause.message : 'Refresh failed', cause }),
  })
  yield* Effect.forEach([...files], ([file, content]) => {
    const target = path.join(root, '.agent-sources', file)
    return fs.makeDirectory(path.dirname(target), { recursive: true }).pipe(Effect.andThen(fs.writeFile(target, content)))
  }, { discard: true })
  yield* fs.writeFileString(sourcesFile, `${JSON.stringify({ ...sources, next: entry }, null, 2)}\n`)
  yield* Effect.logInfo(`Cached Next.js ${pinned} (${count} pages) at ${revision.slice(0, 12)}`)
})

const command = Command.make('refresh-next-sources', {}, program).pipe(
  Command.withDescription('Cache the Next.js 16.4.6 App Router documentation'),
)

command.pipe(
  Command.run({ version: '1.0.0' }),
  Effect.provide([NodeServices.layer, loggerLayer]),
  NodeRuntime.runMain,
)
