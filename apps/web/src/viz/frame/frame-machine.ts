import { Effect, Schema } from 'effect'
import { createEffectLogic, setupEffect } from '@xstate/effect'

// The host owns one machine per frame. `timedOut` is the host's cue to replace the frame; it never retries in place.
// The limit is an input so the host and the tests choose it. The clock is Effect's, so a test can drive it.
const awaitAnswer = createEffectLogic({
  schemas: { input: Schema.Struct({ limitMs: Schema.Finite }) },
  effect: ({ input }) => Effect.sleep(input.limitMs),
})

const Input = Schema.Struct({ limitMs: Schema.Finite })

// A render request records its id. Only a report with that id settles it, so a late answer for an earlier render is ignored.
export const frameMachine = setupEffect({
  schemas: {
    input: Input,
    context: Schema.Struct({ limitMs: Schema.Finite, id: Schema.NullOr(Schema.String) }),
    events: {
      Ready: Schema.Struct({}),
      Render: Schema.Struct({ id: Schema.String }),
      Rendered: Schema.Struct({ id: Schema.String }),
      Failed: Schema.Struct({ id: Schema.String }),
    },
  },
  actors: { awaitAnswer },
}).createMachine({
  context: ({ input }) => ({ limitMs: input.limitMs, id: null }),
  initial: 'loading',
  states: {
    loading: {
      invoke: { src: 'awaitAnswer', input: ({ context }) => ({ limitMs: context.limitMs }), onDone: { target: 'timedOut' } },
      on: { Ready: { target: 'ready' } },
    },
    ready: { on: { Render: ({ context, event }) => ({ target: 'rendering', context: { limitMs: context.limitMs, id: event.id } }) } },
    rendering: {
      invoke: { src: 'awaitAnswer', input: ({ context }) => ({ limitMs: context.limitMs }), onDone: { target: 'timedOut' } },
      on: {
        // A newer request replaces the older one: re-entering restarts the time limit, so only the latest id can settle or time out.
        Render: ({ context, event }) => ({ target: 'rendering', reenter: true, context: { limitMs: context.limitMs, id: event.id } }),
        Rendered: ({ context, event }) => (event.id === context.id ? { target: 'rendered' } : {}),
        Failed: ({ context, event }) => (event.id === context.id ? { target: 'failed' } : {}),
      },
    },
    rendered: {
      on: {
        Render: ({ context, event }) => ({ target: 'rendering', context: { limitMs: context.limitMs, id: event.id } }),
        // The view can throw after first paint.
        Failed: ({ context, event }) => (event.id === context.id ? { target: 'failed' } : {}),
      },
    },
    failed: { on: { Render: ({ context, event }) => ({ target: 'rendering', context: { limitMs: context.limitMs, id: event.id } }) } },
    timedOut: {},
  },
})
