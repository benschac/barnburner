import { Context, Effect, Schema } from 'effect'
import { createEffectLogic, setupEffect } from '@xstate/effect'
import { SeasonSnapshot } from './team-season.ts'

export class SnapshotLoadError extends Schema.TaggedError<SnapshotLoadError>()('SnapshotLoadError', {
  message: Schema.String,
}) {}

export class SeasonSource extends Context.Service<SeasonSource, {
  readonly load: Effect.Effect<SeasonSnapshot, SnapshotLoadError>
}>()('glanceboard/SeasonSource') {}

export const bundledSeasonSource = SeasonSource.of({
  load: Effect.gen(function* () {
    const module = yield* Effect.tryPromise({
      try: () => import('../../../data/nhl-20262027.json'),
      catch: () => new SnapshotLoadError({ message: 'The season snapshot could not be loaded. Try again.' }),
    })
    return yield* Schema.decodeUnknownEffect(SeasonSnapshot)(module.default).pipe(
      Effect.mapError(() => new SnapshotLoadError({ message: 'The season snapshot is invalid. Refresh the snapshot and try again.' })),
    )
  }),
})

const loadSeason = createEffectLogic({ effect: () => Effect.gen(function* () {
  const source = yield* SeasonSource
  return yield* source.load
}) })

export const teamMachine = setupEffect({
  schemas: {
    context: Schema.Struct({ team: Schema.String, snapshot: Schema.NullOr(SeasonSnapshot) }),
    events: {
      SELECT_TEAM: Schema.Struct({ team: Schema.String }),
      SHOW_POSTER: Schema.Struct({}),
      RETRY: Schema.Struct({}),
    },
  },
  actors: { loadSeason },
}).createMachine({
  context: { team: '', snapshot: null },
  initial: 'poster',
  on: {
    SELECT_TEAM: ({ event }) => ({ target: '.loading', reenter: true, context: { team: event.team, snapshot: null } }),
    SHOW_POSTER: { target: '.poster', context: { team: '', snapshot: null } },
  },
  states: {
    poster: {},
    loading: {
      invoke: {
        src: 'loadSeason',
        onDone: ({ context, event }) => ({ target: 'ready', context: { team: context.team, snapshot: event.output } }),
        onError: { target: 'error' },
      },
    },
    ready: {},
    error: { on: { RETRY: { target: 'loading' } } },
  },
})
