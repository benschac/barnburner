import type { G2Spec } from "@antv/g2";
import type {
  FinalsRow,
  FinalsTables,
  PlayerRow,
  VizTheme,
} from "@nhl-reddit-stats/viz";

// The Final-by-year grid (plan FV10): one cell per Final year, ten cells to a row, in year order.
// A hit is filled with the theme's `win`, a miss with `rule`. The tooltip names the teammate who
// matched. Returns a G2 spec as plain data, so the spec is testable without a DOM; the G2 host (FV4)
// mounts it.

const CELLS_PER_ROW = 10;
const COLUMNS = Array.from({ length: CELLS_PER_ROW }, (_, column) =>
  String(column)
);

export type FinalsCell = {
  readonly year: number;
  readonly x: string;
  readonly y: string;
  readonly status: "hit" | "miss";
  readonly player: string;
};

/** The G2 spec, with the cell data typed so the test can read it. */
export type FinalsGridSpec = G2Spec & {
  readonly data: readonly FinalsCell[];
};

const nameOf = (players: readonly PlayerRow[], row: FinalsRow): string => {
  if (row.playerId === null) return "No teammate played in this Final";
  const player = players.find(
    (candidate) => candidate.playerId === row.playerId
  );
  return player?.name ?? `Player ${row.playerId}`;
};

export function finalsGrid(
  tables: FinalsTables,
  theme: VizTheme
): FinalsGridSpec {
  const data = tables.finals.map((row, index): FinalsCell => ({
    year: row.year,
    x: String(index % CELLS_PER_ROW),
    y: String(Math.floor(index / CELLS_PER_ROW)),
    status: row.covered === 1 ? "hit" : "miss",
    player: nameOf(tables.players, row),
  }));
  return {
    type: "cell",
    data,
    encode: { x: "x", y: "y", color: "status" },
    // The x domain is all ten columns, so one Final still sits in a ten-column grid.
    scale: {
      x: { domain: COLUMNS },
      color: { domain: ["hit", "miss"], range: [theme.win, theme.rule] },
    },
    style: { inset: 2 },
    axis: false,
    legend: false,
    tooltip: {
      title: (datum) => String(datum.year),
      items: [(datum) => ({ name: "Teammate", value: datum.player })],
    },
  };
}
