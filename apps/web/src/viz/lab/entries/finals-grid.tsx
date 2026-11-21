import { FinalsTables } from "@nhl-reddit-stats/viz";
import type { LabEntry } from "@nhl-reddit-stats/viz";
import { Schema } from "effect";
import type { ChangeEvent, ReactNode } from "react";

import { useExportFile } from "../../../use-export-file";
import { describeExportFileFailure } from "../../export-file";
import { exportFileMachine } from "../../export-file-machine";
import { loadFinalsFile } from "../../finals-file";
import { G2Chart } from "../../G2Chart";
import { finalsGrid } from "../../specs/finals-grid";
import { useVizTheme } from "../../theme";
import preview from "../data/finals-8478402-1980-2026.json";

const previewTables = Schema.decodeUnknownSync(FinalsTables)(preview.tables);

const previewState = {
  tables: previewTables,
  note: "Historical snapshot: Connor McDavid’s teammates in the Stanley Cup Finals, 1980–2026. Loaded with the page.",
};

const finalsPicker = exportFileMachine({
  preview: previewState,
  read: loadFinalsFile,
  describe: describeExportFileFailure,
});

function FinalsGridPage() {
  const theme = useVizTheme();
  const { tables, note, pick } = useExportFile(finalsPicker);
  const spec = finalsGrid(tables, theme);

  const onFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) pick(file);
  };

  return (
    <section>
      <label>
        Exported finals file{" "}
        <input type="file" accept="application/json" onChange={onFile} />
      </label>
      <p role="status">{note}</p>
      <G2Chart spec={spec} height="seasonChart" />
    </section>
  );
}

const entry: LabEntry<ReactNode> = {
  title: "Finals coverage through teammates",
  render: () => <FinalsGridPage />,
};

export default entry;
