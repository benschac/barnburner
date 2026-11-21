import { setupEffect } from "@xstate/effect";
import { Array as Arr, Option, Schema } from "effect";

export const searchDelayMs = 250;
export const minQueryLength = 2;

/** One search result as the picker needs it: the id it writes and the name the input shows once it is chosen. */
export const PickerOption = Schema.Struct({
  playerId: Schema.Int,
  name: Schema.String,
});
export type PickerOption = typeof PickerOption.Type;

const PickerContext = Schema.Struct({
  draft: Schema.String,
  query: Schema.String,
  open: Schema.Boolean,
  highlighted: Schema.NullOr(Schema.Int),
  options: Schema.Array(PickerOption),
});
export type PickerContext = typeof PickerContext.Type;

const Index = Schema.Struct({ index: Schema.Int });

const cleared: PickerContext = {
  draft: "",
  query: "",
  open: false,
  highlighted: null,
  options: [],
};

/**
 * The draft becomes the query. A query shorter than the minimum closes the list and drops its results;
 * a new query keeps the list's open state as given and waits for its own results.
 */
const settle = (context: PickerContext, open: boolean): PickerContext => {
  const query = context.draft.trim();
  if (query.length < minQueryLength) {
    return {
      ...context,
      query: "",
      open: false,
      highlighted: null,
      options: [],
    };
  }
  return query === context.query
    ? { ...context, open }
    : { ...context, query, open, highlighted: null, options: [] };
};

/** ArrowDown and ArrowUp move by `step` and wrap. From no highlight, down lands on the first option and up on the last. */
const moved = (context: PickerContext, step: 1 | -1): number | null => {
  const count = context.options.length;
  if (count === 0) {
    return null;
  }
  if (context.highlighted === null) {
    return step === 1 ? 0 : count - 1;
  }
  return (context.highlighted + step + count) % count;
};

const highlightNext = ({ context }: { readonly context: PickerContext }) =>
  context.open
    ? { context: { ...context, highlighted: moved(context, 1) } }
    : // ArrowDown on a closed list reopens it when there is a query to show.
      { context: { ...context, open: context.query.length >= minQueryLength } };

const highlightPrevious = ({ context }: { readonly context: PickerContext }) =>
  context.open
    ? { context: { ...context, highlighted: moved(context, -1) } }
    : {};

const highlight = ({
  context,
  event,
}: {
  readonly context: PickerContext;
  readonly event: { readonly index: number };
}) =>
  context.open && event.index >= 0 && event.index < context.options.length
    ? { context: { ...context, highlighted: event.index } }
    : {};

// Results for the query on screen replace the options. A highlight past the new end is dropped.
const results = ({
  context,
  event,
}: {
  readonly context: PickerContext;
  readonly event: {
    readonly query: string;
    readonly options: readonly PickerOption[];
  };
}) =>
  event.query === context.query
    ? {
        context: {
          ...context,
          options: event.options,
          highlighted:
            context.highlighted !== null &&
            context.highlighted < event.options.length
              ? context.highlighted
              : null,
        },
      }
    : {};

/** The option to pick: the highlighted one for Enter, or the one at `index` for a click. Only an open list picks. */
export const optionAt = (
  context: PickerContext,
  index: number | null
): Option.Option<PickerOption> =>
  !context.open || index === null
    ? Option.none()
    : Arr.get(context.options, index);

/**
 * The player picker's UI state: the draft in the input, the query it settled into, whether the result list is open,
 * which option is highlighted, and the options of the current query, which the component sends when they arrive.
 *
 * Typing enters `debouncing`; re-entering on each keystroke restarts its delayed transition, so the draft becomes the
 * query only after typing pauses. Picking emits `Picked` and leaves the URL write to the component. The machine has no
 * Effect actors or actions, so the component runs it with XState's synchronous `createActor`: a controlled input must
 * see its new value in the same event.
 */
export const pickerMachine = setupEffect({
  schemas: {
    context: PickerContext,
    events: {
      Type: Schema.Struct({ text: Schema.String }),
      Results: Schema.Struct({
        query: Schema.String,
        options: Schema.Array(PickerOption),
      }),
      HighlightNext: Schema.Struct({}),
      HighlightPrevious: Schema.Struct({}),
      Highlight: Index,
      PickHighlighted: Schema.Struct({}),
      PickOption: Index,
      Escape: Schema.Struct({}),
      Blur: Schema.Struct({}),
      Reset: Schema.Struct({}),
    },
    emitted: { Picked: Schema.Struct({ playerId: Schema.Int }) },
  },
}).createMachine({
  context: cleared,
  initial: "settled",
  on: {
    Results: results,
    HighlightNext: highlightNext,
    HighlightPrevious: highlightPrevious,
    Highlight: highlight,
    PickHighlighted: ({ context }, enq) =>
      Option.match(optionAt(context, context.highlighted), {
        onNone: () => ({}),
        onSome: (option) => {
          enq.emit({ type: "Picked", playerId: option.playerId });
          return {
            target: ".settled" as const,
            context: { ...cleared, draft: option.name },
          };
        },
      }),
    PickOption: ({ context, event }, enq) =>
      Option.match(optionAt(context, event.index), {
        onNone: () => ({}),
        onSome: (option) => {
          enq.emit({ type: "Picked", playerId: option.playerId });
          return {
            target: ".settled" as const,
            context: { ...cleared, draft: option.name },
          };
        },
      }),
    // Back, forward and Clear drop the draft and any queued search.
    Reset: () => ({ target: ".settled", context: cleared }),
  },
  states: {
    settled: {
      on: {
        Type: ({ context, event }) => ({
          target: "debouncing",
          context: { ...context, draft: event.text },
        }),
        // The first Escape closes the list, the second clears the draft.
        Escape: ({ context }) =>
          context.open
            ? { context: { ...context, open: false } }
            : { context: cleared },
        Blur: ({ context }) => ({ context: { ...context, open: false } }),
      },
    },
    debouncing: {
      after: {
        [searchDelayMs]: ({ context }) => ({
          target: "settled",
          context: settle(context, true),
        }),
      },
      on: {
        // Each keystroke re-enters the state, which restarts the delay.
        Type: ({ context, event }) => ({
          target: "debouncing",
          reenter: true,
          context: { ...context, draft: event.text },
        }),
        // Closing settles the draft now, closed, so the pending delay cannot reopen the list.
        Escape: ({ context }) =>
          context.open
            ? { target: "settled", context: settle(context, false) }
            : { target: "settled", context: cleared },
        Blur: ({ context }) => ({
          target: "settled",
          context: settle(context, false),
        }),
      },
    },
  },
});
