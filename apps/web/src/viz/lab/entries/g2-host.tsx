import type { LabEntry, LeagueTables } from "@nhl-reddit-stats/viz";
import { samples } from "@nhl-reddit-stats/viz/samples";
import { useState } from "react";
import type { ReactNode } from "react";

import { G2Chart } from "../../G2Chart";

/** The bar chart of players by games: a pure function of the tables. Options go in with `hideAxis` and `width`. */
function gamesSpec(
  tables: LeagueTables,
  options: { hideAxis: boolean; width?: number }
) {
  const spec = {
    type: "interval",
    data: tables.players.map((player) => ({
      name: player.name,
      games: player.games,
    })),
    encode: { x: "name", y: "games" },
    axis: options.hideAxis
      ? { y: false, x: { labelAutoRotate: true } }
      : { x: { labelAutoRotate: true } },
  };
  if (options.width === undefined) return spec;
  return Object.assign(spec, { width: options.width });
}

// Plain buttons in the lab: they exist to reach the host's two spec cases from a browser.
function Cases({ tables }: { tables: LeagueTables }) {
  const [hideAxis, setHideAxis] = useState(false);
  const [width, setWidth] = useState<number | undefined>(undefined);
  return (
    <>
      <button type="button" onClick={() => setHideAxis((value) => !value)}>
        toggle y axis
      </button>
      <button
        type="button"
        onClick={() =>
          setWidth((value) => (value === undefined ? 300 : undefined))
        }
      >
        spec carries width
      </button>
      <G2Chart
        spec={gamesSpec(tables, { hideAxis, width })}
        height="seasonChart"
      />
    </>
  );
}

const entry: LabEntry<ReactNode> = {
  title: "G2 host: league players by games",
  render: () => <Cases tables={samples.league.tables} />,
};

export default entry;
