import assert from 'node:assert/strict'
import { test } from 'node:test'
import { Effect, Layer, Schema } from 'effect'
import { FetchHttpClient, HttpRouter } from 'effect/http'
import { RpcClient, RpcClientError, RpcSerialization } from 'effect/rpc'
import { UnknownPlayer } from '@nhl-reddit-stats/history'
import { HistoryRpcs } from '@nhl-reddit-stats/history/rpc'
import { MINI_SNAPSHOT_ID, makeMiniStore } from '../../../packages/history/tests/fakes.ts'
import { History, HistoryRoutes } from '../src/history-routes.ts'

const fake = makeMiniStore()

type Client = RpcClient.FromGroup<typeof HistoryRpcs, RpcClientError.RpcClientError>

const withFake = async (use: (client: Client) => Promise<void>) => {
  const web = HttpRouter.toWebHandler(HistoryRoutes.pipe(Layer.provide(History.fromStore(fake))), { disableLogger: true })
  const fetch = FetchHttpClient.Fetch.of((input, init) => web.handler(new Request(input, init)))
  try {
    await Effect.runPromise(Effect.scoped(Effect.gen(function* () {
      const client = yield* RpcClient.make(HistoryRpcs)
      yield* Effect.promise(() => use(client))
    })).pipe(Effect.provide(RpcClient.layerProtocolHttp({ url: 'https://rinkside.example/api/history' }).pipe(
      Layer.provide([FetchHttpClient.layer, RpcSerialization.layerJson]),
      Layer.provide(Layer.succeed(FetchHttpClient.Fetch, fetch)),
    ))))
  } finally { await web.dispose() }
}

test('GetFinalsCoverage hits 1952 for player 13 via teammate 14 and carries the rule', () => withFake(async (client) => {
  const result = await Effect.runPromise(client.GetFinalsCoverage({ playerId: 13, fromYear: 1952, toYear: 1952 }))
  assert.equal(result.snapshotId, MINI_SNAPSHOT_ID)
  assert.equal(result.years.length, 1)
  const [year] = result.years
  assert.equal(year._tag, 'Hit')
  if (year._tag === 'Hit') {
    assert.equal(year.year, 1952)
    assert.equal(year.playerId, 14)
  }
  assert.match(result.rule, /NHL/)
  assert.match(result.rule, /1927/)
}))

test('GetFinalsCoverage reports a miss for a player with no teammate in the Final', () => withFake(async (client) => {
  const result = await Effect.runPromise(client.GetFinalsCoverage({ playerId: 20, fromYear: 1952, toYear: 1952 }))
  assert.deepEqual(result.years.map((y) => y._tag), ['Miss'])
}))

test('GetFinalsCoverage honors the year range', () => withFake(async (client) => {
  const outside = await Effect.runPromise(client.GetFinalsCoverage({ playerId: 13, fromYear: 1960, toYear: 1970 }))
  assert.deepEqual(outside.years, [])
  const inside = await Effect.runPromise(client.GetFinalsCoverage({ playerId: 13, fromYear: 1900, toYear: 2000 }))
  assert.deepEqual(inside.years.map((y) => y.year), [1952])
}))

test('GetFinalsCoverage on an unknown player is UnknownPlayer', () => withFake(async (client) => {
  const error = await Effect.runPromise(Effect.flip(client.GetFinalsCoverage({ playerId: 999, fromYear: 1952, toYear: 1952 })))
  assert.ok(Schema.is(UnknownPlayer)(error))
  assert.equal(error.playerId, 999)
}))
