import { PairTables } from "@nhl-reddit-stats/viz";
import type { LabEntry } from "@nhl-reddit-stats/viz";
import { Schema } from "effect";
import type { ChangeEvent, ReactNode } from "react";

import { useExportFile } from "../../../use-export-file";
import { exportFileMachine } from "../../export-file-machine";
import { G2Chart } from "../../G2Chart";
import { describePairFailure, loadPairFile } from "../../pair-file";
import { asG2Spec, gamesBySeason } from "../../specs/games-by-season";
import { teamColor, useVizTheme } from "../../theme";
import preview from "../data/pair-8478402-8477934.json";

const previewTables = Schema.decodeUnknownSync(PairTables)(preview.tables);

const previewState = {
  tables: previewTables,
  note: "Historical snapshot: Connor McDavid and Leon Draisaitl. Loaded with the page.",
};

const pairPicker = exportFileMachine({
  preview: previewState,
  read: loadPairFile,
  describe: describePairFailure,
});

function GamesBySeasonPage() {
  const theme = useVizTheme();
  const { tables, note, pick } = useExportFile(pairPicker);
  const spec = asG2Spec(
    gamesBySeason(tables, theme, (abbrev, index) =>
      teamColor(abbrev, theme, index)
    )
  );

  const onFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) pick(file);
  };

  return (
    <section>
      <label>
        Exported pair file{" "}
        <input type="file" accept="application/json" onChange={onFile} />
      </label>
      <p role="status">{note}</p>
      <G2Chart spec={spec} height="drawer" />
    </section>
  );
}

const entry: LabEntry<ReactNode> = {
  title: "Shared games by season",
  render: () => <GamesBySeasonPage />,
};

export default entry;
