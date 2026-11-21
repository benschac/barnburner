import { VizTheme } from "@nhl-reddit-stats/viz/contracts";
import type { BenchData } from "@nhl-reddit-stats/viz/contracts";
import { samples } from "@nhl-reddit-stats/viz/samples";
import { createEffectLogic, setupEffect } from "@xstate/effect";
import {
  Array as Arr,
  Context,
  Effect,
  Option,
  Predicate,
  Result,
  Schema,
} from "effect";

import {
  BenchResult,
  BenchRunError,
  loadRenderer,
  readBenchFile,
  runBench,
} from "./harness.ts";
import type { RendererLoader } from "./renderer-loaders.ts";
import { BenchDataSchema, benchDataFromTables } from "./stats.ts";

export const BenchSource = Schema.Literals(["ego", "league", "file"]);
export type BenchSource = typeof BenchSource.Type;

const BenchContext = Schema.Struct({
  renderer: Schema.String,
  source: BenchSource,
  loaded: Schema.NullOr(BenchDataSchema),
  results: Schema.Array(BenchResult),
  note: Schema.String,
});
export type BenchContext = typeof BenchContext.Type;

/**
 * What the invoked logic needs from the page and cannot keep in context: the element the renderer draws in
 * and the lazy imports of the renderers. The hook provides it where the actor is created.
 * `root` is read when a run starts, so it names the element as it is then.
 */
export class BenchHost extends Context.Service<
  BenchHost,
  {
    readonly root: () => Option.Option<HTMLElement>;
    readonly loaders: readonly RendererLoader[];
  }
>()("glanceboard/BenchHost") {}

const egoData: BenchData = benchDataFromTables(samples.ego.tables);
const leagueData: BenchData = benchDataFromTables(samples.league.tables);

/** The dataset the chosen source names; none for `file` until a file has loaded. */
export function selectedData(context: BenchContext): Option.Option<BenchData> {
  switch (context.source) {
    case "ego": {
      return Option.some(egoData);
    }
    case "league": {
      return Option.some(leagueData);
    }
    case "file": {
      return Option.fromNullishOr(context.loaded);
    }
  }
}

/** Run is allowed once a renderer is chosen and the chosen source has a dataset. */
export const runnableData = (context: BenchContext): Option.Option<BenchData> =>
  context.renderer === "" ? Option.none() : selectedData(context);
export const canRun = (context: BenchContext): boolean =>
  Option.isSome(runnableData(context));

export const pickFirstNote = "Pick a renderer and a dataset first.";

const readFile = createEffectLogic({
  schemas: { input: Schema.Struct({ file: Schema.instanceOf(File) }) },
  effect: ({ input }) =>
    readBenchFile(input.file).pipe(
      Effect.result,
      Effect.map((outcome) => ({ name: input.file.name, outcome }))
    ),
});

// Loads and drives one renderer. A run's own failure is an answer (a Result); only a defect reaches the machine's onError.
const runRenderer = createEffectLogic({
  schemas: {
    input: Schema.Struct({
      renderer: Schema.String,
      data: BenchDataSchema,
      theme: VizTheme,
    }),
  },
  effect: ({ input }) =>
    Effect.gen(function* () {
      const host = yield* BenchHost;
      const loader = yield* Option.match(
        Arr.findFirst(host.loaders, ({ id }) => id === input.renderer),
        {
          onNone: () =>
            Effect.fail(
              new BenchRunError({
                renderer: input.renderer,
                stage: "load",
                message: "no such renderer",
              })
            ),
          onSome: Effect.succeed,
        }
      );
      const element = yield* Option.match(host.root(), {
        onNone: () =>
          Effect.fail(
            new BenchRunError({
              renderer: input.renderer,
              stage: "mount",
              message: "the page has no element to draw in",
            })
          ),
        onSome: Effect.succeed,
      });
      const renderer = yield* loadRenderer(loader.id, loader.load);
      return yield* runBench(renderer, input.data, input.theme, element);
    }).pipe(Effect.result),
});

const selectRenderer = ({
  event,
}: {
  readonly event: { readonly renderer: string };
}) => ({
  context: { renderer: event.renderer },
});
// The "file" source needs a loaded file.
const selectSource = ({
  context,
  event,
}: {
  readonly context: BenchContext;
  readonly event: { readonly source: BenchSource };
}) =>
  event.source === "file" && context.loaded === null
    ? {}
    : { context: { source: event.source } };

// One state per kind of work in flight. `reading` and `running` own their invoked logic, so leaving a state, or
// stopping the actor, interrupts it: a newer pick replaces an unfinished read, and a run's renderer is destroyed.
// While `running`, no event changes the selection or starts more work.
export const benchMachine = setupEffect({
  schemas: {
    input: Schema.Struct({ renderer: Schema.String }),
    context: BenchContext,
    events: {
      SelectRenderer: Schema.Struct({ renderer: Schema.String }),
      SelectSource: Schema.Struct({ source: BenchSource }),
      PickFile: Schema.Struct({ file: Schema.instanceOf(File) }),
      Run: Schema.Struct({ theme: VizTheme }),
    },
  },
  states: {
    reading: {
      schemas: { input: Schema.Struct({ file: Schema.instanceOf(File) }) },
    },
    running: {
      schemas: {
        input: Schema.Struct({ data: BenchDataSchema, theme: VizTheme }),
      },
    },
  },
  actors: { readFile, runRenderer },
}).createMachine({
  context: ({ input }) => ({
    renderer: input.renderer,
    source: "league",
    loaded: null,
    results: [],
    note: "",
  }),
  initial: "idle",
  states: {
    idle: {
      on: {
        SelectRenderer: selectRenderer,
        SelectSource: selectSource,
        PickFile: ({ event }) => ({
          target: "reading",
          input: { file: event.file },
          context: { note: `Reading ${event.file.name}` },
        }),
        Run: ({ context, event }) =>
          Option.match(runnableData(context), {
            onNone: () => ({ context: { note: pickFirstNote } }),
            onSome: (data) => ({
              target: "running" as const,
              input: { data, theme: event.theme },
              context: { note: `Running ${context.renderer}` },
            }),
          }),
      },
    },
    reading: {
      invoke: {
        src: "readFile",
        input: ({ input }) => ({ file: input.file }),
        onDone: ({ event }) =>
          Result.match(event.output.outcome, {
            onSuccess: (data) => ({
              target: "idle" as const,
              context: {
                loaded: data,
                source: "file" as const,
                note: `Loaded ${event.output.name}: ${data.nodes.length} nodes and ${data.links.length} links.`,
              },
            }),
            onFailure: (failure) => ({
              target: "idle" as const,
              context: {
                note: `Could not use ${event.output.name}: ${failure.message}`,
              },
            }),
          }),
        onError: ({ event }) => ({
          target: "idle",
          context: {
            note: `Could not use the file: ${Predicate.isError(event.error) ? event.error.message : String(event.error)}`,
          },
        }),
      },
      on: {
        SelectRenderer: selectRenderer,
        SelectSource: selectSource,
        // A newer pick replaces the older one: re-entering interrupts the unfinished read, so only the latest pick can set the dataset.
        PickFile: ({ event }) => ({
          target: "reading",
          reenter: true,
          input: { file: event.file },
          context: { note: `Reading ${event.file.name}` },
        }),
      },
    },
    running: {
      invoke: {
        src: "runRenderer",
        input: ({ context, input }) => ({
          renderer: context.renderer,
          data: input.data,
          theme: input.theme,
        }),
        onDone: ({ context, event }) =>
          Result.match(event.output, {
            onSuccess: (result) => ({
              target: "idle" as const,
              context: { results: [...context.results, result], note: "" },
            }),
            onFailure: (failure) => ({
              target: "idle" as const,
              context: {
                note: `${failure.renderer} failed at ${failure.stage}: ${failure.message}`,
              },
            }),
          }),
        onError: ({ context, event }) => ({
          target: "idle",
          context: {
            note: `${context.renderer} failed unexpectedly: ${Predicate.isError(event.error) ? event.error.message : String(event.error)}`,
          },
        }),
      },
    },
  },
});
