import { PairTables } from "@nhl-reddit-stats/viz";
import { Effect, Match, Schema } from "effect";

import { describeExportFileFailure, readExportFile } from "./export-file";
import type { ExportFileFailure } from "./export-file";

/** A span names a club the teams table does not carry; the chart would fail while drawing. */
class PairFileOrphanSpan extends Schema.TaggedError<
  PairFileOrphanSpan,
  { readonly brand: unique symbol }
>()("PairFileOrphanSpan", { teamId: Schema.Int }) {}

export type PairFileFailure = ExportFileFailure | PairFileOrphanSpan;

const readPairExport = readExportFile(
  "pair",
  Schema.Struct({ tables: PairTables, notes: Schema.String })
);

/** Reads, decodes, and checks one picked pair file. */
export const loadPairFile = (picked: File) =>
  Effect.gen(function* () {
    const tables = yield* readPairExport(picked);
    // The chart maps each span's club through the teams table, so a span with no club must fail here.
    const clubs = new Set(tables.teams.map((team) => team.teamId));
    const orphan = tables.spans.find((span) => !clubs.has(span.teamId));
    if (orphan !== undefined)
      return yield* new PairFileOrphanSpan({ teamId: orphan.teamId });
    return tables;
  });

export const describePairFailure = (failure: PairFileFailure): string =>
  Match.valueTags(failure, {
    ExportFileReadError: describeExportFileFailure,
    ExportFileNotJson: describeExportFileFailure,
    ExportFileNotAnExport: describeExportFileFailure,
    PairFileOrphanSpan: ({ teamId }) =>
      `a span names team ${teamId}, which the teams table does not carry`,
  });
