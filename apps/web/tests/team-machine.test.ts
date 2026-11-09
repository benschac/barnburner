import assert from 'node:assert/strict'
import { test } from 'node:test'
import { Effect, Schema } from 'effect'
import { createEffectActor, send, waitFor } from '@xstate/effect'
import { sendAndAwait } from '@xstate/effect/test'
import snapshotData from '../../../data/nhl-20262027.json' with { type: 'json' }
import { SeasonSnapshot } from '../src/team-season.ts'
import { SeasonSource, SnapshotLoadError, teamMachine } from '../src/team-machine.ts'

const snapshot = Schema.decodeUnknownSync(SeasonSnapshot)(snapshotData)

test('selection, rapid switching and returning to poster cancel obsolete loads', async () => {
  let cancelled = 0
  await Effect.runPromise(Effect.gen(function* () {
    const actor = yield* createEffectActor(teamMachine)
    yield* sendAndAwait(actor, { type: 'SELECT_TEAM', team: 'NJD' })
    yield* sendAndAwait(actor, { type: 'SELECT_TEAM', team: 'BOS' })
    const ready = yield* waitFor(actor, (state) => state.matches('ready'), { timeout: '2 seconds' })
    assert.equal(ready.context.team, 'BOS')
    assert.equal(ready.context.snapshot?.games.length, snapshot.games.length)
    yield* sendAndAwait(actor, { type: 'SELECT_TEAM', team: 'TOR' })
    yield* sendAndAwait(actor, { type: 'SHOW_POSTER' })
    assert.ok(actor.getSnapshot().matches('poster'))
    assert.equal(actor.getSnapshot().context.snapshot, null)
  }).pipe(Effect.scoped, Effect.provideService(SeasonSource, {
    load: Effect.sleep('10 millis').pipe(Effect.as(snapshot), Effect.onInterrupt(() => Effect.sync(() => { cancelled += 1 }))),
  })))
  assert.ok(cancelled >= 2)
})

test('failed snapshot loading has an explicit retry path', async () => {
  let attempts = 0
  await Effect.runPromise(Effect.gen(function* () {
    const actor = yield* createEffectActor(teamMachine)
    yield* send(actor, { type: 'SELECT_TEAM', team: 'SEA' })
    yield* waitFor(actor, (state) => state.matches('error'), { timeout: '2 seconds' })
    yield* send(actor, { type: 'RETRY' })
    const ready = yield* waitFor(actor, (state) => state.matches('ready'), { timeout: '2 seconds' })
    assert.equal(ready.context.team, 'SEA')
    assert.equal(attempts, 2)
  }).pipe(Effect.scoped, Effect.provideService(SeasonSource, {
    load: Effect.suspend(() => ++attempts === 1
      ? Effect.fail(new SnapshotLoadError({ message: 'Unavailable' }))
      : Effect.succeed(snapshot)),
  })))
})
