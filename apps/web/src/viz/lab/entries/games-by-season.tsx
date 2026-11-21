import { PairTables } from "@nhl-reddit-stats/viz";
import type { LabEntry } from "@nhl-reddit-stats/viz";
import { Result, Schema } from "effect";
import { useRef, useState } from "react";
import type { ChangeEvent, ReactNode } from "react";

import { G2Chart } from "../../G2Chart";
import { asG2Spec, gamesBySeason } from "../../specs/games-by-season";
import { teamColor, useVizTheme } from "../../theme";
import preview from "../data/pair-8478402-8477934.json";

const previewTables = Schema.decodeUnknownSync(PairTables)(preview.tables);

/** An expected failure reading an exported pair file: unreadable, not JSON, the wrong shape, or a span with no club. */
class PairFileError extends Schema.TaggedError<
  PairFileError,
  { readonly brand: unique symbol }
>()("PairFileError", {
  file: Schema.String,
  message: Schema.String,
}) {}

const ExportFile = Schema.Struct({ tables: PairTables, notes: Schema.String });
const decodeJson = Schema.decodeUnknownResult(
  Schema.fromJsonString(Schema.Unknown)
);
const decodeExport = Schema.decodeUnknownResult(ExportFile);

const readText = async (
  file: File
): Promise<Result.Result<string, PairFileError>> => {
  try {
    return Result.succeed(await file.text());
  } catch (cause) {
    return Result.fail(
      new PairFileError({
        file: file.name,
        message: `could not read the file: ${String(cause)}`,
      })
    );
  }
};

function readExport(
  name: string,
  text: string
): Result.Result<PairTables, PairFileError> {
  const parsed = decodeJson(text);
  if (Result.isFailure(parsed)) {
    return Result.fail(
      new PairFileError({
        file: name,
        message: `not JSON: ${parsed.failure.message}`,
      })
    );
  }
  const decoded = decodeExport(parsed.success);
  if (Result.isFailure(decoded)) {
    return Result.fail(
      new PairFileError({
        file: name,
        message: "expected an exported pair file: { tables, notes }",
      })
    );
  }
  const tables = decoded.success.tables;
  // The chart maps each span's club through the teams table, so a span with no club must fail here, not while drawing.
  const clubs = new Set(tables.teams.map((team) => team.teamId));
  const orphan = tables.spans.find((span) => !clubs.has(span.teamId));
  if (orphan !== undefined) {
    return Result.fail(
      new PairFileError({
        file: name,
        message: `a span names team ${orphan.teamId}, which the teams table does not carry`,
      })
    );
  }
  return Result.succeed(tables);
}

function GamesBySeasonPage() {
  const theme = useVizTheme();
  const [loaded, setLoaded] = useState<PairTables | undefined>(undefined);
  const [note, setNote] = useState("");
  // Counts file selections, so a read that finishes after a newer selection is dropped.
  const selection = useRef(0);
  const tables = loaded ?? previewTables;
  const spec = asG2Spec(
    gamesBySeason(tables, theme, (abbrev, index) =>
      teamColor(abbrev, theme, index)
    )
  );

  const onFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    selection.current += 1;
    const token = selection.current;
    const text = await readText(file);
    if (Result.isFailure(text)) {
      if (token === selection.current) setNote(text.failure.message);
      return;
    }
    const decoded = readExport(file.name, text.success);
    if (token !== selection.current) return;
    if (Result.isSuccess(decoded)) {
      setLoaded(decoded.success);
      setNote(`Loaded ${file.name}.`);
    } else {
      setNote(decoded.failure.message);
    }
  };

  return (
    <section>
      <label>
        Exported pair file{" "}
        <input
          type="file"
          accept="application/json"
          onChange={(event) => {
            void onFile(event);
          }}
        />
      </label>
      <p role="status">
        {note ||
          "Historical snapshot: Connor McDavid and Leon Draisaitl. Loaded with the page."}
      </p>
      <G2Chart spec={spec} height="drawer" />
    </section>
  );
}

const entry: LabEntry<ReactNode> = {
  title: "Shared games by season",
  render: () => <GamesBySeasonPage />,
};

export default entry;
