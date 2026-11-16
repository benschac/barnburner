import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { after, test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { Effect, Layer, Schema } from 'effect'
import { FetchHttpClient } from 'effect/http'
import { BoxscoreSource, SeasonSource, rpcBoxscoreSourceLayer, rpcSeasonSourceLayer } from '../../web/src/season-source.ts'
import api from '../../web/api/rpc.ts'
import { webApi } from '@nhl-reddit-stats/api/web-handler'

after(() => webApi.dispose())

test('the Vercel entrypoint serves a typed RPC response from bundled snapshots', async () => {
  const fetch = FetchHttpClient.Fetch.of((input, init) => api.fetch(new Request(input, init)))
  const data = await Effect.runPromise(Effect.gen(function* () {
    const source = yield* SeasonSource
    return yield* source.load
  }).pipe(Effect.provide(rpcSeasonSourceLayer('https://rinkside.example/api/rpc').pipe(
    Layer.provide(Layer.succeed(FetchHttpClient.Fetch, fetch)),
  ))))
  assert.equal(data.season.games.length, 1344)
  assert.equal(data.poster.clubs.length, 32)
})

test('the Vercel entrypoint keeps GET routes and rejects oversized RPC requests', async () => {
  const games = await api.fetch(new Request('https://rinkside.example/api/games?team=ANA'))
  assert.equal(games.status, 200)
  const body = Schema.decodeUnknownSync(Schema.Struct({ team: Schema.String, count: Schema.Int }))(await games.json())
  assert.equal(body.team, 'ANA')
  assert.equal(body.count, 84)
  const oversized = await api.fetch(new Request('https://rinkside.example/api/rpc', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: 'x'.repeat(16384),
  }))
  assert.equal(oversized.status, 413)
})

test('the Vercel entrypoint reads each box score from its own lazy chunk', async () => {
  const archive = fileURLToPath(new URL('../../../data/boxscores/20262027', import.meta.url))
  const dist = fileURLToPath(new URL('../dist', import.meta.url))
  const ids = readdirSync(archive).map((file) => Number(file.replace('.json', '')))
  const entry = readFileSync(`${dist}/web-handler.js`, 'utf8')
  // One chunk per archived game, none inlined into the entry module that every request loads.
  assert.equal(readdirSync(dist).filter((file) => file.startsWith('chunk-')).length, ids.length)
  assert.ok(!entry.includes('saveShotsAgainst'), 'box-score payloads must not be inlined into the entry bundle')
  const fetch = FetchHttpClient.Fetch.of((input, init) => api.fetch(new Request(input, init)))
  const box = await Effect.runPromise(Effect.gen(function* () {
    const source = yield* BoxscoreSource
    return yield* source.load(ids[0])
  }).pipe(Effect.provide(rpcBoxscoreSourceLayer('https://rinkside.example/api/rpc').pipe(
    Layer.provide(Layer.succeed(FetchHttpClient.Fetch, fetch)),
  ))))
  assert.equal(box.gameId, ids[0])
  assert.ok(box.awayTeam.shotsOnGoal > 0)
})
