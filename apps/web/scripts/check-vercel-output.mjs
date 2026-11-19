import { logInfo } from '../../../lib/logger.mjs'
import assert from 'node:assert/strict'
import { cp, mkdtemp, readFile, rm, stat } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { Effect, Layer } from 'effect'
import { FetchHttpClient } from 'effect/http'
import { RpcClient, RpcSerialization } from 'effect/rpc'
import { HistoryRpcs } from '@nhl-reddit-stats/history/rpc'
import { SeasonSource, rpcSeasonSourceLayer } from '../src/season-source.ts'

const HISTORY_FILE = 'apps/web/history-data/nhl-serve.sqlite'
// Usage: check-vercel-output.mjs <output-dir> [--require-history]
// Without --require-history, a build with no bundled snapshot passes if /api/history answers HistoryUnavailable.
const args = process.argv.slice(2)
const requireHistory = args.includes('--require-history')
const outputArg = args.find((arg) => !arg.startsWith('--'))
assert.ok(outputArg, 'Pass the standalone Vercel build output directory')
const output = resolve(outputArg)
const routes = JSON.parse(await readFile(join(output, 'config.json'), 'utf8')).routes
assert.ok(routes.some((route) => route.status === 308 && new RegExp(route.src).test('/api/rpc/')), 'RPC trailing slash must preserve POST via HTTP 308')
const directory = await mkdtemp(join(tmpdir(), 'rinkside-vercel-'))

try {
  for (const route of ['rpc', 'games', 'poster', 'teams']) {
    const isolated = join(directory, route)
    await cp(join(output, `functions/api/${route}.func`), isolated, { recursive: true, dereference: true })
    const config = JSON.parse(await readFile(join(isolated, '.vc-config.json'), 'utf8'))
    assert.match(config.runtime, /^nodejs/)
    assert.equal(config.supportsCancellation, true)
    const entry = pathToFileURL(join(isolated, config.handler))
    const api = (await import(entry.href)).default
    const bundled = await import(pathToFileURL(createRequire(entry).resolve('@nhl-reddit-stats/api/web-handler')).href)
    try {
      if (route === 'rpc') {
        const fetch = FetchHttpClient.Fetch.of((input, init) => api.fetch(new Request(input, init)))
        const data = await Effect.runPromise(Effect.gen(function* () {
          const source = yield* SeasonSource
          return yield* source.load
        }).pipe(Effect.provide(rpcSeasonSourceLayer('https://rinkside.example/api/rpc').pipe(
          Layer.provide(Layer.succeed(FetchHttpClient.Fetch, fetch)),
        ))))
        assert.equal(data.poster.clubs.length, 32)
        assert.equal(data.season.games.length, 1344)
      } else {
        const url = `https://rinkside.example/api/${route}${route === 'games' ? '?team=ANA' : ''}`
        const response = await api.fetch(new Request(url))
        assert.equal(response.status, 200)
        const body = await response.json()
        if (route === 'games') assert.equal(body.count, 84)
        if (route === 'poster') assert.equal(body.clubs.length, 32)
        if (route === 'teams') assert.equal(body.teams.length, 32)
      }
    } finally {
      await bundled.webApi.dispose()
    }
  }
  logInfo('Isolated Vercel RPC and all three GET functions passed')

  // The history function must carry its serving file and run on a Node that has node:sqlite.
  const historyFunction = join(output, 'functions/api/history.func')
  const config = JSON.parse(await readFile(join(historyFunction, '.vc-config.json'), 'utf8'))
  const node = /^nodejs(\d+)/.exec(config.runtime)
  assert.ok(node && Number(node[1]) >= 22, `history runtime ${config.runtime} must be Node 22.5 or newer for node:sqlite`)
  const shipped = join(historyFunction, HISTORY_FILE)
  const size = await stat(shipped).then((file) => file.size, () => null)
  if (requireHistory) assert.ok(size !== null && size > 0, `${HISTORY_FILE} is missing or empty in the history function`)
  const isolated = join(directory, 'history')
  await cp(historyFunction, isolated, { recursive: true, dereference: true })
  const entry = pathToFileURL(join(isolated, config.handler))
  const previous = process.cwd()
  const previousHistoryDb = process.env.HISTORY_DB
  delete process.env.HISTORY_DB // An override would hide a missing bundled file.
  process.chdir(isolated) // Vercel runs the function with its own root as the working directory; the handler reads it at import.
  try {
    const history = (await import(entry.href)).default
    const fetch = FetchHttpClient.Fetch.of((input, init) => history.fetch(new Request(input, init)))
    const search = Effect.scoped(Effect.gen(function* () {
      const client = yield* RpcClient.make(HistoryRpcs)
      return yield* client.SearchPlayers({ query: 'a', limit: 3 })
    })).pipe(Effect.provide(RpcClient.layerProtocolHttp({ url: 'https://rinkside.example/api/history' }).pipe(
      Layer.provide([FetchHttpClient.layer, RpcSerialization.layerJson]),
      Layer.provide(Layer.succeed(FetchHttpClient.Fetch, fetch)),
    )))
    if (size === null) {
      const failure = await Effect.runPromise(Effect.flip(search))
      assert.equal(failure._tag, 'HistoryUnavailable', 'without a bundled snapshot /api/history must answer HistoryUnavailable')
      logInfo(`Packaged history function (${config.runtime}) has no snapshot and answered HistoryUnavailable`)
    } else {
      const found = await Effect.runPromise(search)
      assert.ok(found.snapshotId.length > 0)
      assert.ok(found.players.length > 0, 'SearchPlayers returned no rows from the packaged file')
      logInfo(`Packaged history function (${config.runtime}) served SearchPlayers from ${HISTORY_FILE} (${size} bytes)`)
    }
  } finally {
    process.chdir(previous)
    if (previousHistoryDb === undefined) delete process.env.HISTORY_DB
    else process.env.HISTORY_DB = previousHistoryDb
  }
} finally {
  await rm(directory, { recursive: true, force: true })
}
