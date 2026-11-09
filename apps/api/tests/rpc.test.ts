import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { NodeHttpServer, NodeServices } from '@effect/platform-node'
import { Deferred, Effect, Fiber, Layer, Schema } from 'effect'
import { HttpRouter, HttpServer } from 'effect/http'
import { TeamData } from '@nhl-reddit-stats/season'
import { SnapshotLoadError } from '@nhl-reddit-stats/season/rpc'
import { SeasonSource, rpcSeasonSourceLayer } from '../../web/src/season-source.ts'
import { ApiRoutes } from '../src/routes.ts'
import { makeSnapshots, Snapshots } from '../src/snapshots.ts'
import season from '../../../data/nhl-20262027.json' with { type: 'json' }
import poster from '../../../data/nhl-poster-20262027.json' with { type: 'json' }

const apiLayer = (snapshots: typeof Snapshots.Service) => HttpRouter.serve(ApiRoutes, { disableLogger: true, disableListenLog: true }).pipe(
  Layer.provide(Layer.succeed(Snapshots, snapshots)),
  Layer.provideMerge(NodeHttpServer.layer(() => createServer(), { host: '127.0.0.1', port: 0 })),
)

const sourceLoad = (path = '/api/rpc') => Effect.gen(function* () {
  const server = yield* HttpServer.HttpServer
  return yield* Effect.gen(function* () {
    const source = yield* SeasonSource
    return yield* source.load
  }).pipe(Effect.provide(rpcSeasonSourceLayer(`${HttpServer.formatAddress(server.address)}${path}`)))
})

test('the browser SeasonSource decodes a real HTTP RPC response using the shared contract', async () => {
  const snapshots = await Effect.runPromise(makeSnapshots({ season, poster }))
  const result = await Effect.runPromise(sourceLoad().pipe(Effect.provide(apiLayer(snapshots))))
  assert.equal(result.season.games.length, season.games.length)
  assert.equal(result.poster.clubs.length, 32)
  assert.deepEqual(result, Schema.decodeUnknownSync(TeamData)({ season, poster }))
})

test('missing poster returns the declared RPC error while games remain readable', async () => {
  const snapshots = await Effect.runPromise(makeSnapshots({ season, poster: null }))
  await Effect.runPromise(Effect.gen(function* () {
    const error = yield* Effect.flip(sourceLoad())
    assert.ok(error instanceof SnapshotLoadError)
    assert.match(error.message, /Poster data is unavailable/)
    const server = yield* HttpServer.HttpServer
    const base = HttpServer.formatAddress(server.address)
    const response = yield* Effect.promise(() => fetch(`${base}/api/games?team=NJD`))
    assert.equal(response.status, 200)
    yield* Effect.promise(() => response.arrayBuffer())
  }).pipe(Effect.provide(apiLayer(snapshots))))
})

test('RPC transport failures are translated into the SeasonSource error type', async () => {
  const snapshots = await Effect.runPromise(makeSnapshots({ season, poster }))
  const error = await Effect.runPromise(Effect.flip(sourceLoad('/missing')).pipe(Effect.provide(apiLayer(snapshots))))
  assert.ok(error instanceof SnapshotLoadError)
  assert.match(error.message, /could not be loaded/)
})

test('interrupting a browser load aborts the HTTP request and server handler', { timeout: 10000 }, async () => {
  await Effect.runPromise(Effect.gen(function* () {
    const started = yield* Deferred.make<void>()
    const interrupted = yield* Deferred.make<void>()
    const snapshots = yield* makeSnapshots({ season, poster })
    const load = Deferred.succeed(started, undefined).pipe(
      Effect.andThen(Effect.never),
      Effect.onInterrupt(() => Deferred.succeed(interrupted, undefined)),
    )
    yield* Effect.gen(function* () {
      const request = yield* Effect.forkChild(sourceLoad())
      yield* Deferred.await(started)
      yield* Fiber.interrupt(request)
      yield* Deferred.await(interrupted)
    }).pipe(Effect.provide(apiLayer({ ...snapshots, load })))
  }).pipe(Effect.scoped, Effect.timeout('5 seconds')))
})

test('the file-backed service allows a missing supplement and rejects malformed saved data', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'nhl-snapshots-'))
  const posterSnapshot = join(directory, 'poster.json')
  const read = () => Effect.runPromise(Effect.gen(function* () {
    return yield* Snapshots
  }).pipe(Effect.provide(Snapshots.layer({
    snapshot: fileURLToPath(new URL('../../../data/nhl-20262027.json', import.meta.url)),
    posterSnapshot,
  }).pipe(Layer.provide(NodeServices.layer)))))
  try {
    assert.equal((await read()).poster, null)
    await writeFile(posterSnapshot, '{')
    await assert.rejects(read())
    await writeFile(posterSnapshot, JSON.stringify({ ...poster, clubs: [] }))
    await assert.rejects(read())
    await assert.rejects(Effect.runPromise(makeSnapshots({ season: { ...season, games: [] }, poster })))
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})
