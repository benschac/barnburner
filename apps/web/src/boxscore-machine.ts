import { Effect, Schema } from 'effect'
import { createEffectLogic, setupEffect } from '@xstate/effect'
import { GameBoxscore } from '@nhl-reddit-stats/season/rpc'
import { BoxscoreSource } from './season-source.ts'

// A missing archive entry is an expected answer, so it is a successful outcome and not a failure.
export const BoxscoreOutcome = Schema.Union([
  Schema.Struct({ kind: Schema.Literal('ready'), boxscore: GameBoxscore }),
  Schema.Struct({ kind: Schema.Literal('unavailable') }),
])

const loadBoxscore = createEffectLogic({
  schemas: { input: Schema.Struct({ gameId: Schema.Int }) },
  effect: ({ input }) => Effect.gen(function* () {
    const source = yield* BoxscoreSource
    return yield* source.load(input.gameId).pipe(
      Effect.map((boxscore) => ({ kind: 'ready', boxscore }) as const),
      Effect.catchTag('BoxscoreNotArchived', () => Effect.succeed({ kind: 'unavailable' } as const)),
    )
  }),
})

// The drawer mounts one machine per opened game. Closing unmounts the actor, which interrupts a pending request.
export const boxscoreMachine = setupEffect({
  schemas: {
    input: Schema.Struct({ gameId: Schema.Int }),
    context: Schema.Struct({ gameId: Schema.Int, outcome: Schema.NullOr(BoxscoreOutcome) }),
    events: { RETRY: Schema.Struct({}) },
  },
  actors: { loadBoxscore },
}).createMachine({
  context: ({ input }) => ({ gameId: input.gameId, outcome: null }),
  initial: 'loading',
  states: {
    loading: {
      invoke: {
        src: 'loadBoxscore',
        input: ({ context }) => ({ gameId: context.gameId }),
        onDone: ({ context, event }) => ({ target: 'shown', context: { gameId: context.gameId, outcome: event.output } }),
        onError: { target: 'failed' },
      },
    },
    shown: {},
    failed: { on: { RETRY: { target: 'loading' } } },
  },
})
