import assert from 'node:assert/strict'
import { test } from 'node:test'
import { Effect, Schema } from 'effect'
import { createEffectActor, send, waitFor } from '@xstate/effect'
import { sendAndAwait } from '@xstate/effect/test'
import { posterFixture } from './team-fixture.ts'
import snapshotData from '../../../data/nhl-20262027.json' with { type: 'json' }
import { SeasonSnapshot, TeamData } from '../src/team-season.ts'
import { SeasonSource, SnapshotLoadError, teamMachine, httpSeasonSource } from '../src/team-machine.ts'

const season = Schema.decodeUnknownSync(SeasonSnapshot)(snapshotData)
const snapshot = { season, poster: posterFixture } satisfies TeamData

test('selection, rapid switching and returning to poster cancel obsolete loads', async () => {
  let cancelled = 0
  await Effect.runPromise(Effect.gen(function* () {
    const actor = yield* createEffectActor(teamMachine)
    yield* sendAndAwait(actor, { type: 'SELECT_TEAM', team: 'NJD' })
    yield* sendAndAwait(actor, { type: 'SELECT_TEAM', team: 'BOS' })
    const ready = yield* waitFor(actor, (state) => state.matches('ready'), { timeout: '2 seconds' })
    assert.equal(ready.context.team, 'BOS')
    assert.equal(ready.context.snapshot?.season.games.length, snapshot.season.games.length)
    yield* sendAndAwait(actor, { type: 'SELECT_TEAM', team: 'TOR' })
    yield* sendAndAwait(actor, { type: 'SHOW_POSTER' })
    const devils = yield* waitFor(actor, (state) => state.matches('ready'), { timeout: '2 seconds' })
    assert.equal(devils.context.team, 'NJD')
    assert.equal(devils.context.snapshot?.season.games.length, snapshot.season.games.length)
  }).pipe(Effect.scoped, Effect.provideService(SeasonSource, {
    load: Effect.sleep('10 millis').pipe(Effect.as(snapshot), Effect.onInterrupt(() => Effect.sync(() => { cancelled += 1 }))),
  })))
  assert.ok(cancelled >= 2)
})

test('failed snapshot loading has an explicit retry path', async () => {
  let attempts = 0
  await Effect.runPromise(Effect.gen(function* () {
    const actor = yield* createEffectActor(teamMachine)
    yield* waitFor(actor, (state) => state.matches('error'), { timeout: '2 seconds' })
    yield* send(actor, { type: 'RETRY' })
    const ready = yield* waitFor(actor, (state) => state.matches('ready'), { timeout: '2 seconds' })
    assert.equal(ready.context.team, 'NJD')
    assert.equal(attempts, 2)
  }).pipe(Effect.scoped, Effect.provideService(SeasonSource, {
    load: Effect.suspend(() => ++attempts === 1
      ? Effect.fail(new SnapshotLoadError({ message: 'Unavailable' }))
      : Effect.succeed(snapshot)),
  })))
})


test('the default route loads NJD from the same source', async () => {
  await Effect.runPromise(Effect.gen(function* () {
    const actor = yield* createEffectActor(teamMachine)
    const ready = yield* waitFor(actor, (state) => state.matches('ready'), { timeout: '2 seconds' })
    assert.equal(ready.context.team, 'NJD')
    assert.equal(ready.context.snapshot, snapshot)
  }).pipe(Effect.scoped, Effect.provideService(SeasonSource, { load: Effect.succeed(snapshot) })))
})

test('HTTP source requests both backend datasets and rejects incomplete data', async (t) => {
  const urls: string[] = []
  t.mock.method(globalThis, 'fetch', async (url: string) => {
    urls.push(url)
    return new Response(JSON.stringify(url === '/api/games' ? season : posterFixture))
  })
  const result = await Effect.runPromise(httpSeasonSource.load)
  assert.deepEqual(urls.sort(), ['/api/games', '/api/poster'])
  assert.equal(result.poster.clubs.length, 32)
  t.mock.method(globalThis, 'fetch', async () => new Response('{}'))
  await assert.rejects(Effect.runPromise(httpSeasonSource.load))
})
