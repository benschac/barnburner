import { Context, Effect, Schema } from 'effect'
import { createEffectLogic, setupEffect } from '@xstate/effect'
import { TeamData } from './team-season.ts'

export class SnapshotLoadError extends Schema.TaggedError<SnapshotLoadError>()('SnapshotLoadError', {
  message: Schema.String,
}) {}

export class SeasonSource extends Context.Service<SeasonSource, {
  readonly load: Effect.Effect<TeamData, SnapshotLoadError>
}>()('glanceboard/SeasonSource') {}

const fetchJson = (url: string) => Effect.tryPromise({
  try: async (signal) => {
    const response = await fetch(url, { signal })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    return response.json() as Promise<unknown>
  },
  catch: () => new SnapshotLoadError({ message: 'Team data could not be loaded. Try again.' }),
})

export const httpSeasonSource = SeasonSource.of({
  load: Effect.gen(function* () {
    const [season, poster] = yield* Effect.all([fetchJson('/api/games'), fetchJson('/api/poster')], { concurrency: 2 })
    return yield* Schema.decodeUnknownEffect(TeamData)({ season, poster }).pipe(
      Effect.mapError(() => new SnapshotLoadError({ message: 'The team data is incomplete or invalid. Refresh the data and try again.' })),
    )
  }),
})

const loadSeason = createEffectLogic({ effect: () => Effect.gen(function* () {
  const source = yield* SeasonSource
  return yield* source.load
}) })

export const teamMachine = setupEffect({
  schemas: {
    context: Schema.Struct({ team: Schema.String, snapshot: Schema.NullOr(TeamData) }),
    events: {
      SELECT_TEAM: Schema.Struct({ team: Schema.String }),
      SHOW_POSTER: Schema.Struct({}),
      RETRY: Schema.Struct({}),
    },
  },
  actors: { loadSeason },
}).createMachine({
  context: { team: 'NJD', snapshot: null },
  initial: 'loading',
  on: {
    SELECT_TEAM: ({ event }) => ({ target: '.loading', reenter: true, context: { team: event.team, snapshot: null } }),
    SHOW_POSTER: { target: '.loading', reenter: true, context: { team: 'NJD', snapshot: null } },
  },
  states: {
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
