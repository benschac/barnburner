import { Effect, Schema } from 'effect'
import { createEffectLogic, setupEffect } from '@xstate/effect'
import { TeamData } from '@nhl-reddit-stats/season'
import { SeasonSource } from './season-source.ts'

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
    SELECT_TEAM: ({ event }) => ({ context: { team: event.team } }),
    SHOW_POSTER: { context: { team: 'NJD' } },
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
    error: {
      on: {
        RETRY: { target: 'loading' },
        SELECT_TEAM: ({ event }) => ({ target: 'loading', context: { team: event.team } }),
        SHOW_POSTER: { target: 'loading', context: { team: 'NJD' } },
      },
    },
  },
})
