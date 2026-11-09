import assert from 'node:assert/strict'
import { test } from 'node:test'
import { Effect, Schema } from 'effect'
import { createEffectActor, send, waitFor } from '@xstate/effect'
import { sendAndAwait } from '@xstate/effect/test'
import { posterFixture } from './team-fixture.ts'
import snapshotData from '../../../data/nhl-20262027.json' with { type: 'json' }
import { SeasonSnapshot, TeamData } from '@nhl-reddit-stats/season'
import { teamMachine } from '../src/team-machine.ts'
import { SeasonSource } from '../src/season-source.ts'
import { SnapshotLoadError } from '@nhl-reddit-stats/season/rpc'

const season = Schema.decodeUnknownSync(SeasonSnapshot)(snapshotData)
const snapshot = { season, poster: posterFixture } satisfies TeamData

test('rapid switching shares the initial load and ready navigation reuses its snapshot', async () => {
  let attempts = 0
  let cancelled = 0
  await Effect.runPromise(Effect.gen(function* () {
    const actor = yield* createEffectActor(teamMachine)
    yield* sendAndAwait(actor, { type: 'SELECT_TEAM', team: 'NJD' })
    yield* sendAndAwait(actor, { type: 'SELECT_TEAM', team: 'BOS' })
    const ready = yield* waitFor(actor, (state) => state.matches('ready'), { timeout: '2 seconds' })
    assert.equal(ready.context.team, 'BOS')
    assert.equal(ready.context.snapshot, snapshot)
    const loadingStates: boolean[] = []
    const subscription = actor.subscribe((state) => loadingStates.push(state.matches('loading')))
    yield* sendAndAwait(actor, { type: 'SELECT_TEAM', team: 'TOR' })
    const toronto = yield* waitFor(actor, (state) => state.matches('ready'), { timeout: '2 seconds' })
    assert.equal(toronto.context.team, 'TOR')
    assert.equal(toronto.context.snapshot, snapshot)
    yield* sendAndAwait(actor, { type: 'SHOW_POSTER' })
    const devils = yield* waitFor(actor, (state) => state.matches('ready'), { timeout: '2 seconds' })
    assert.equal(devils.context.team, 'NJD')
    assert.equal(devils.context.snapshot, snapshot)
    subscription.unsubscribe()
    assert.ok(loadingStates.every((loading) => !loading))
  }).pipe(Effect.scoped, Effect.provideService(SeasonSource, {
    load: Effect.sync(() => { attempts += 1 }).pipe(
      Effect.andThen(Effect.sleep('10 millis')), Effect.as(snapshot),
      Effect.onInterrupt(() => Effect.sync(() => { cancelled += 1 })),
    ),
  })))
  assert.equal(attempts, 1)
  assert.equal(cancelled, 0)
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
