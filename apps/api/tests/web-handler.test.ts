import assert from 'node:assert/strict'
import { after, test } from 'node:test'
import { Effect, Layer, Schema } from 'effect'
import { FetchHttpClient } from 'effect/http'
import { SeasonSource, rpcSeasonSourceLayer } from '../../web/src/season-source.ts'
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
