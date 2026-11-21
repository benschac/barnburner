import { Effect, Match, Result, Schema } from "effect";

/** The file could not be read from disk. */
export class ExportFileReadError extends Schema.TaggedError<
  ExportFileReadError,
  { readonly brand: unique symbol }
>()("ExportFileReadError", {
  fileName: Schema.String,
  cause: Schema.Defect(),
}) {}

/** The file's text is not JSON. */
export class ExportFileNotJson extends Schema.TaggedError<
  ExportFileNotJson,
  { readonly brand: unique symbol }
>()("ExportFileNotJson", {
  fileName: Schema.String,
  detail: Schema.String,
}) {}

/** The file is JSON but not the `{ tables, notes }` an export command writes. */
export class ExportFileNotAnExport extends Schema.TaggedError<
  ExportFileNotAnExport,
  { readonly brand: unique symbol }
>()("ExportFileNotAnExport", {
  fileName: Schema.String,
  kind: Schema.String,
}) {}

export type ExportFileFailure =
  | ExportFileReadError
  | ExportFileNotJson
  | ExportFileNotAnExport;

export const describeExportFileFailure = (failure: ExportFileFailure): string =>
  Match.valueTags(failure, {
    ExportFileReadError: ({ cause }) =>
      `could not read the file: ${String(cause)}`,
    ExportFileNotJson: ({ detail }) => `not JSON: ${detail}`,
    ExportFileNotAnExport: ({ kind }) =>
      `expected an exported ${kind} file: { tables, notes }`,
  });

const decodeJson = Schema.decodeUnknownResult(
  Schema.fromJsonString(Schema.Unknown)
);

/** Reads one picked file and decodes its `{ tables, notes }` body. Every failure is a tagged error. */
export const readExportFile = <T>(
  kind: string,
  exportFile: Schema.Decoder<{ readonly tables: T; readonly notes: string }>
) => {
  const decodeExport = Schema.decodeUnknownResult(exportFile);
  return (picked: File) =>
    Effect.gen(function* () {
      const text = yield* Effect.tryPromise({
        try: () => picked.text(),
        catch: (cause) =>
          new ExportFileReadError({ fileName: picked.name, cause }),
      });
      const parsed = decodeJson(text);
      if (Result.isFailure(parsed))
        return yield* new ExportFileNotJson({
          fileName: picked.name,
          detail: parsed.failure.message,
        });
      const decoded = decodeExport(parsed.success);
      if (Result.isFailure(decoded))
        return yield* new ExportFileNotAnExport({
          fileName: picked.name,
          kind,
        });
      return decoded.success.tables;
    });
};
