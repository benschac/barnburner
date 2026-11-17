import assert from 'node:assert/strict'
import { test } from 'node:test'
import { Effect, Layer } from 'effect'
import { FetchHttpClient, HttpRouter } from 'effect/http'
import { RpcClient, RpcClientError, RpcSerialization } from 'effect/rpc'
import { NoPath, UnknownPlayer, UnsupportedFilter } from '@nhl-reddit-stats/history'
import { HistoryRpcs } from '@nhl-reddit-stats/history/rpc'
import { MINI_SNAPSHOT_ID, makeMiniStore } from '../../../packages/history/tests/fakes.ts'
import { History, HistoryRoutes } from '../src/history-routes.ts'

type Client = RpcClient.FromGroup<typeof HistoryRpcs, RpcClientError.RpcClientError>

const DEFAULT = { competition: 'all', fromSeason: null, toSeason: null, goaliePartners: true } as const
const NO_PARTNERS = { ...DEFAULT, goaliePartners: false } as const

/** Serves the in-memory fake store through the real handlers. */
const withFake = async (use: (client: Client) => Promise<void>) => {
  const web = HttpRouter.toWebHandler(HistoryRoutes.pipe(Layer.provide(History.fromStore(makeMiniStore()))), { disableLogger: true })
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

const flip = <A, E>(effect: Effect.Effect<A, E>) => Effect.runPromise(Effect.flip(effect))

test('FindPath returns tied chains in order with the full count', () => withFake(async (client) => {
  const result = await Effect.runPromise(client.FindPath({ from: 11, to: 14, filter: DEFAULT, relation: 'with', limit: 2 }))
  assert.equal(result.snapshotId, MINI_SNAPSHOT_ID)
  assert.equal(result.distance, 2)
  assert.equal(result.pathCount, 2)
  assert.deepEqual(result.paths.map((chain) => chain.map((hop) => [hop.from, hop.to])), [[[11, 12], [12, 14]], [[11, 13], [13, 14]]])
}))

test('FindPath fails with UnknownPlayer and NoPath', () => withFake(async (client) => {
  const unknown = await flip(client.FindPath({ from: 99, to: 11, filter: DEFAULT, relation: 'with', limit: 1 }))
  assert.ok(unknown instanceof UnknownPlayer)
  assert.equal(unknown.playerId, 99)
  const none = await flip(client.FindPath({ from: 11, to: 19, filter: DEFAULT, relation: 'with', limit: 1 }))
  assert.ok(none instanceof NoPath)
  assert.deepEqual([none.from, none.to], [11, 19])
  assert.ok((await flip(client.FindPath({ from: 11, to: 18, filter: NO_PARTNERS, relation: 'with', limit: 1 }))) instanceof NoPath)
}))

test('FindPath rejects the opponent relations for now', () => withFake(async (client) => {
  const error = await flip(client.FindPath({ from: 11, to: 14, filter: DEFAULT, relation: 'against', limit: 1 }))
  assert.ok(error instanceof UnsupportedFilter)
  assert.equal(error.relation, 'against')
  assert.ok((await flip(client.FindPath({ from: 11, to: 14, filter: DEFAULT, relation: 'either', limit: 1 }))) instanceof UnsupportedFilter)
}))

test('GetFarthest reports the farthest teammates and an example chain', () => withFake(async (client) => {
  const result = await Effect.runPromise(client.GetFarthest({ playerId: 11, filter: DEFAULT }))
  assert.equal(result.snapshotId, MINI_SNAPSHOT_ID)
  assert.equal(result.distance, 6)
  assert.equal(result.example.length, 6)
  assert.equal(result.example[0]?.from, 11)
  assert.ok(result.atDistance >= 1)
  assert.ok(result.unreachable >= 2)
  assert.ok((await flip(client.GetFarthest({ playerId: 99, filter: DEFAULT }))) instanceof UnknownPlayer)
}))
