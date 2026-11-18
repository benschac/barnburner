import assert from 'node:assert/strict'
import { type ChildProcess, spawn } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, readdirSync } from 'node:fs'
import { createServer } from 'node:net'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { after, before, test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { Effect, Layer, Schema } from 'effect'
import { FetchHttpClient } from 'effect/http'
import { BoxscoreSource, rpcBoxscoreSourceLayer } from '../src/season-source.ts'

// This test exercises the production build Next emits, not the route TypeScript. Build first:
//   bun run --cwd ../api build && bun run next:build
const web = fileURLToPath(new URL('..', import.meta.url))
const apiDist = fileURLToPath(new URL('../../api/dist/', import.meta.url))
const archive = fileURLToPath(new URL('../../../data/boxscores/20262027/', import.meta.url))
const next = join(web, '.next')
const missingBuild = [
  [join(apiDist, 'web-handler.js'), 'the built API (run `bun run --cwd ../api build`)'],
  [join(next, 'BUILD_ID'), 'the Next production build (run `bun run next:build`)'],
].flatMap(([path, what]) => existsSync(path) ? [] : [what])
assert.deepEqual(missingBuild, [], `api-routes.test.ts needs a prior build; missing: ${missingBuild.join(', ')}`)

const gameIds = readdirSync(archive).flatMap((file) => /^\d+\.json$/.test(file) ? [Number(file.slice(0, -5))] : []).sort((a, b) => a - b)
const apiChunks = readdirSync(apiDist).filter((file) => /^chunk-.*\.js$/.test(file))

// What only the API handler or an archived box score contains. The compiled route must hold none of it.
const handlerMarkers = ['Unsupported query parameters', 'api-web.nhle.com/v1/gamecenter', 'saveShotsAgainst', 'boxscoreArchive']

const filesUnder = (directory: string): string[] => readdirSync(directory, { withFileTypes: true }).flatMap((entry) =>
  entry.isDirectory() ? filesUnder(join(directory, entry.name)) : [join(directory, entry.name)])
const compiledJs = [...filesUnder(join(next, 'server')), ...filesUnder(join(next, 'static'))].filter((file) => file.endsWith('.js'))

test('the API routes were compiled with the handler left external', () => {
  const routes = ['rpc', 'games', 'poster', 'teams', 'history', '[[...path]]']
  for (const route of routes) {
    const compiled = readFileSync(join(next, 'server/app/api', route, 'route.js'), 'utf8')
    const handler = route === 'history' ? 'history-handler' : 'web-handler'
    assert.ok(compiled.includes(`import("@nhl-reddit-stats/api/${handler}")`), `${route} must import the built API at runtime`)
    for (const marker of handlerMarkers) assert.ok(!compiled.includes(marker), `${route} route bundles the handler (found "${marker}")`)
  }
})

test('no webpack output holds handler code or box-score data', () => {
  assert.ok(compiledJs.length > 0)
  for (const file of compiledJs) {
    const text = readFileSync(file, 'utf8')
    for (const marker of handlerMarkers) assert.ok(!text.includes(marker), `${file} contains "${marker}"`)
  }
  assert.equal(filesUnder(next).filter((file) => /[\\/]chunk-[0-9a-z]+\.js$/.test(file)).length, 0, 'Next must not emit its own copy of the box-score chunks')
})

test('the API stays one chunk file per archived game, traced as files', () => {
  assert.equal(apiChunks.length, gameIds.length)
  const trace = Schema.decodeUnknownSync(Schema.fromJsonString(Schema.Struct({ files: Schema.Array(Schema.String) })))(
    readFileSync(join(next, 'server/app/api/rpc/route.js.nft.json'), 'utf8'),
  )
  const traced = trace.files.filter((file) => /api\/dist\/(chunk-[^/]*|web-handler)\.js$/.test(file))
  assert.ok(traced.some((file) => file.endsWith('web-handler.js')))
  assert.equal(traced.filter((file) => /chunk-[^/]*\.js$/.test(file)).length, apiChunks.length)
})

// Run the built server with a loader hook that records every API chunk Node loads.
const freePort = () => new Promise<number>((resolve, reject) => {
  const server = createServer()
  server.once('error', reject)
  server.listen(0, '127.0.0.1', () => {
    const address = server.address()
    server.close(() => resolve(typeof address === 'object' && address !== null ? address.port : 0))
  })
})
const recorder = `import { registerHooks } from 'node:module'
import { appendFileSync } from 'node:fs'
registerHooks({ load(url, context, nextLoad) {
  if (/\\/api\\/dist\\/[^/]*\\.js$/.test(url)) appendFileSync(process.env.API_LOAD_LOG, url + '\\n')
  return nextLoad(url, context)
} })`
const loaded = (log: string) => (existsSync(log) ? readFileSync(log, 'utf8') : '').split('\n').filter((url) => url !== '')

let server: ChildProcess | undefined
let origin = ''
let log = ''
let serverOutput = ''

before(async () => {
  const port = await freePort()
  origin = `http://127.0.0.1:${port}`
  log = join(mkdtempSync(join(tmpdir(), 'api-routes-')), 'api-loads.log')
  const nextBin = createRequire(import.meta.url).resolve('next/dist/bin/next')
  server = spawn(process.execPath, [nextBin, 'start', '-p', String(port), '-H', '127.0.0.1'], {
    cwd: web,
    env: { ...process.env, API_LOAD_LOG: log, NODE_OPTIONS: `--import=data:text/javascript,${encodeURIComponent(recorder)}` },
  })
  server.stdout?.on('data', (chunk: Buffer) => { serverOutput += chunk.toString() })
  server.stderr?.on('data', (chunk: Buffer) => { serverOutput += chunk.toString() })
  for (let attempt = 0; attempt < 100; attempt++) {
    if (server.exitCode !== null) assert.fail(`next start exited early:\n${serverOutput}`)
    try { await fetch(`${origin}/api/games?team=ANA`); return } catch { await new Promise((resolve) => setTimeout(resolve, 100)) }
  }
  assert.fail(`next start did not answer:\n${serverOutput}`)
})

after(() => { server?.kill() })

test('under next start, GET /api/games answers JSON', async () => {
  const response = await fetch(`${origin}/api/games?team=ANA`)
  assert.equal(response.status, 200)
  assert.match(response.headers.get('content-type') ?? '', /application\/json/)
  const body = Schema.decodeUnknownSync(Schema.Struct({ team: Schema.String, count: Schema.Int }))(await response.json())
  assert.equal(body.team, 'ANA')
  assert.ok(body.count > 0)
})

test('unknown API paths answer the API JSON error, not the poster page', async () => {
  const missing = await fetch(`${origin}/api/missing`)
  assert.equal(missing.status, 404)
  assert.match(missing.headers.get('content-type') ?? '', /application\/json/)
  assert.deepEqual(await missing.json(), { error: 'Not found' })
  const post = await fetch(`${origin}/api/missing`, { method: 'POST', body: '{}' })
  assert.equal(post.status, 405)
  assert.match(post.headers.get('content-type') ?? '', /application\/json/)
})

test('the rpc route rejects oversized POSTs', async () => {
  const oversized = await fetch(`${origin}/api/rpc`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: 'x'.repeat(16384) })
  assert.equal(oversized.status, 413)
})

test('each box-score request through next start loads exactly one chunk file', async () => {
  // The handler is already loaded by the requests above, so only box-score chunks can appear from here.
  const handlerLoads = loaded(log)
  assert.ok(handlerLoads.some((url) => url.endsWith('/web-handler.js')), 'the route must load the built web-handler.js')
  assert.equal(handlerLoads.filter((url) => /\/chunk-[^/]*\.js$/.test(url)).length, 0)
  const fetchRpc = FetchHttpClient.Fetch.of((input, init) => fetch(input, init))
  const loadBox = (gameId: number) => Effect.runPromise(Effect.gen(function* () {
    const source = yield* BoxscoreSource
    return yield* source.load(gameId)
  }).pipe(Effect.provide(rpcBoxscoreSourceLayer(`${origin}/api/rpc`).pipe(Layer.provide(Layer.succeed(FetchHttpClient.Fetch, fetchRpc))))))
  for (const [index, gameId] of [gameIds[0], gameIds[1]].entries()) {
    const box = await loadBox(gameId)
    assert.equal(box.gameId, gameId)
    const chunks = loaded(log).filter((url) => /\/chunk-[^/]*\.js$/.test(url))
    assert.equal(chunks.length, index + 1)
    const chunk = readFileSync(fileURLToPath(chunks[index]), 'utf8')
    assert.ok(chunk.includes(`/${gameId}.json`), 'the loaded chunk must be that game')
  }
})
