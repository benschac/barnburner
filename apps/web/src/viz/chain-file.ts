import { ChainTables } from "@nhl-reddit-stats/viz";
import { Effect, Match, Result, Schema } from "effect";

// An export file is { tables, notes }, as the export command writes it.
const ChainFile = Schema.Struct({ tables: ChainTables, notes: Schema.String });
const decodeChainText = Schema.decodeUnknownResult(
  Schema.fromJsonString(ChainFile)
);

class ChainFileReadError extends Schema.TaggedError<
  ChainFileReadError,
  { readonly brand: unique symbol }
>()("ChainFileReadError", {
  fileName: Schema.String,
  cause: Schema.Defect(),
}) {}

class ChainFileDecodeError extends Schema.TaggedError<
  ChainFileDecodeError,
  { readonly brand: unique symbol }
>()("ChainFileDecodeError", {
  fileName: Schema.String,
}) {}

class ChainFileNoSummary extends Schema.TaggedError<
  ChainFileNoSummary,
  { readonly brand: unique symbol }
>()("ChainFileNoSummary", {}) {}

/** A summary or hop names a player the players table does not list; chainGraph would throw on that. */
class ChainFileMissingPlayer extends Schema.TaggedError<
  ChainFileMissingPlayer,
  { readonly brand: unique symbol }
>()("ChainFileMissingPlayer", {
  row: Schema.Literals(["summary", "hop"]),
  playerId: Schema.Int,
}) {}

export type ChainFileFailure =
  | ChainFileReadError
  | ChainFileDecodeError
  | ChainFileNoSummary
  | ChainFileMissingPlayer;

function chainFileProblem(
  tables: ChainTables
): Result.Result<ChainTables, ChainFileNoSummary | ChainFileMissingPlayer> {
  const summary = tables.summary[0];
  if (summary === undefined) return Result.fail(new ChainFileNoSummary({}));
  const known = new Set(tables.players.map((player) => player.playerId));
  for (const playerId of [summary.from, summary.to]) {
    if (!known.has(playerId))
      return Result.fail(
        new ChainFileMissingPlayer({ row: "summary", playerId })
      );
  }
  for (const hop of tables.hops) {
    for (const playerId of [hop.from, hop.to]) {
      if (!known.has(playerId))
        return Result.fail(
          new ChainFileMissingPlayer({ row: "hop", playerId })
        );
    }
  }
  return Result.succeed(tables);
}

export const describeFailure = (failure: ChainFileFailure): string =>
  Match.valueTags(failure, {
    ChainFileReadError: ({ fileName, cause }) =>
      `${fileName} could not be read: ${String(cause)}.`,
    ChainFileDecodeError: ({ fileName }) =>
      `${fileName} is not a chain export.`,
    ChainFileNoSummary: () => "the file has no summary row.",
    ChainFileMissingPlayer: ({ row, playerId }) =>
      `the ${row} names player ${playerId}, which the players table does not list.`,
  });

/** Reads, decodes, and checks one picked file. Every failure is a tagged error. */
export const loadChainFile = (picked: File) =>
  Effect.gen(function* () {
    const text = yield* Effect.tryPromise({
      try: () => picked.text(),
      catch: (cause) =>
        new ChainFileReadError({
          fileName: picked.name,
          cause,
        }),
    });
    const decoded = decodeChainText(text);
    if (!Result.isSuccess(decoded))
      return yield* new ChainFileDecodeError({ fileName: picked.name });
    const checked = chainFileProblem(decoded.success.tables);
    if (!Result.isSuccess(checked)) return yield* checked.failure;
    return checked.success;
  });
