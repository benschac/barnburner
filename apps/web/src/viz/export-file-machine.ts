import { createEffectLogic, setupEffect } from "@xstate/effect";
import { Effect, Option, Schema } from "effect";
import type { SnapshotFrom } from "xstate";

// The machine holds tables as `unknown`: setupEffect cannot relate a generic table type to its context mapping.
// The factory below is the only writer, and it only stores preview tables or what `read` returned, so `useExportFile`
// narrows them back to the caller's table type.
const Tables = Schema.Unknown;
const Preview = Schema.Struct({ tables: Tables, note: Schema.String });

const exportFileMachineOf = (
  readPicked: (picked: File) => Effect.Effect<{
    readonly tables: Option.Option<unknown>;
    readonly note: string;
  }>
) => {
  const read = createEffectLogic({
    schemas: { input: Schema.Struct({ file: Schema.NullOr(Schema.File) }) },
    effect: ({ input }) =>
      input.file === null
        ? Effect.die("exportFileMachine: reading without a picked file")
        : readPicked(input.file),
  });
  return setupEffect({
    schemas: {
      input: Preview,
      context: Schema.Struct({
        tables: Tables,
        note: Schema.String,
        picked: Schema.NullOr(Schema.File),
      }),
      events: { Pick: Schema.Struct({ file: Schema.File }) },
    },
    actors: { read },
  }).createMachine({
    context: ({ input }) => ({
      tables: input.tables,
      note: input.note,
      picked: null,
    }),
    initial: "preview",
    states: {
      preview: {
        on: {
          Pick: ({ context, event }) => ({
            target: "reading",
            context: { ...context, picked: event.file },
          }),
        },
      },
      reading: {
        invoke: {
          src: "read",
          input: ({ context }) => ({ file: context.picked }),
          onDone: ({ context, event }) =>
            Option.isSome(event.output.tables)
              ? {
                  target: "loaded",
                  context: {
                    ...context,
                    tables: event.output.tables.value,
                    note: event.output.note,
                  },
                }
              : {
                  target: "rejected",
                  context: { ...context, note: event.output.note },
                },
        },
        on: {
          // A newer pick replaces the older one: re-entering interrupts the pending read.
          Pick: ({ context, event }) => ({
            target: "reading",
            reenter: true,
            context: { ...context, picked: event.file },
          }),
        },
      },
      loaded: {
        on: {
          Pick: ({ context, event }) => ({
            target: "reading",
            context: { ...context, picked: event.file },
          }),
        },
      },
      rejected: {
        on: {
          Pick: ({ context, event }) => ({
            target: "reading",
            context: { ...context, picked: event.file },
          }),
        },
      },
    },
  });
};

export type ExportFileMachine = ReturnType<typeof exportFileMachineOf>;

/** One picker: its machine, the preview it starts from, and the typed read of its tables. T is tied to all three. */
export type ExportFilePicker<T> = {
  readonly machine: ExportFileMachine;
  readonly preview: { readonly tables: T; readonly note: string };
  readonly tablesOf: (snapshot: SnapshotFrom<ExportFileMachine>) => T;
};

/**
 * Builds the picker for one export kind: bundled preview tables until the user picks an exported file.
 * A pick is accepted from every state. Picking while a read is pending re-enters `reading`, which interrupts the older read,
 * so only the latest pick can settle. A rejected file keeps the last good tables and says why.
 *
 * The pick carries the `File` itself: `Schema.File` is an instanceOf schema, so the event needs no { name, text } copy
 * and the reader reads it through Effect. T is inferred from `read` and checked against `preview.tables`.
 */
export const exportFileMachine = <T, F>(config: {
  readonly preview: { readonly tables: T; readonly note: string };
  readonly read: (picked: File) => Effect.Effect<T, F>;
  readonly describe: (failure: F) => string;
}): ExportFilePicker<T> => ({
  machine: exportFileMachineOf((picked) =>
    config.read(picked).pipe(
      Effect.match({
        onSuccess: (tables) => ({
          tables: Option.some<unknown>(tables),
          note: `Loaded ${picked.name}.`,
        }),
        onFailure: (failure) => ({
          tables: Option.none(),
          note: config.describe(failure),
        }),
      })
    )
  ),
  preview: config.preview,
  // SAFETY: the machine's only writers store `preview.tables` or what `read` returned, both of type T.
  tablesOf: (snapshot) => snapshot.context.tables as T,
});
