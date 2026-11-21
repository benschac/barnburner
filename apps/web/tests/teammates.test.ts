import assert from "node:assert/strict";
import { test } from "node:test";

import type { GraphData } from "@antv/g6";

import {
  teammateRows,
  teammatesGraph,
  teammateGamesLabel,
} from "../src/explorer/teammates.ts";
import type {
  PlayerDetail,
  TeammatesDetail,
} from "../src/explorer/teammates.ts";

const detail: PlayerDetail = {
  snapshotId: "test",
  player: {
    playerId: 1,
    name: "Focus",
    position: "G",
    firstSeason: 20002001,
    lastSeason: 20012002,
    games: 100,
    points: 0,
    teammates: 3,
  },
  stints: [20002001, 20012002].map((seasonId, index) => ({
    seasonId,
    gameType: 2,
    teamId: index + 1,
    teamAbbrev: index === 0 ? "PIT" : "NYR",
    teamName: "Team",
    games: 50,
    firstGameId: 1,
    lastGameId: 2,
  })),
};
type Row = TeammatesDetail["teammates"][number];
const spans = (
  games: readonly number[],
  kind: "PlayedWith" | "GoaliePartners" = "PlayedWith"
): Row["spans"] =>
  games.map((count, index) => ({
    seasonId: index === 0 ? 20002001 : 20012002,
    gameType: 2,
    teamId: index + 1,
    link: kind,
    games: count,
    firstGameId: 1,
  }));
const teammate = (
  playerId: number,
  name: string,
  position: Row["position"],
  rowSpans: Row["spans"]
): Row => ({ playerId, name, position, spans: rowSpans });
const found = (...rows: Row[]): TeammatesDetail => ({
  snapshotId: "test",
  teammates: rows,
});
const base = [
  teammate(2, "Second", "D", spans([10, 20])),
  teammate(3, "Third", "C", spans([30])),
  teammate(4, "Partner", "G", spans([40], "GoaliePartners")),
];

test("sums a teammate's spans and names every team they shared", () => {
  const rows = teammateRows(detail, found(...base));
  assert.deepEqual(rows[0], {
    playerId: 2,
    name: "Second",
    position: "D",
    games: 30,
    goaliePartnerGames: 0,
    firstSeason: 20002001,
    lastSeason: 20012002,
    teams: ["PIT", "NYR"],
  });
  assert.equal(rows.length, 3);
});
test("keeps goalie-partner-only games separate and labels them", () => {
  const row = teammateRows(detail, found(...base)).find(
    (candidate) => candidate.playerId === 4
  );
  assert.ok(row);
  assert.equal(row.games, 0);
  assert.equal(row.goaliePartnerGames, 40);
  assert.equal(
    teammateGamesLabel(row),
    "0 games · 40 dressed as goalie partners"
  );
});
test("breaks game ties by lower ID", () => {
  assert.deepEqual(
    teammateRows(detail, found(...base)).map((row) => row.playerId),
    [2, 3, 4]
  );
});
test("sorts by games before ID and draws only top N spokes", () => {
  const rows = teammateRows(
    detail,
    found(base[0], teammate(3, "Third", "C", spans([50])), base[2])
  );
  assert.deepEqual(
    rows.map((row) => row.playerId),
    [3, 2, 4]
  );
  const graph: GraphData = teammatesGraph(detail, rows, 1);
  assert.deepEqual(
    graph.nodes?.map((node) => node.id),
    ["1", "3"]
  );
  assert.deepEqual(
    graph.edges?.map((edge) => [edge.source, edge.target]),
    [["1", "3"]]
  );
  assert.equal(teammatesGraph(detail, rows, "all").edges.length, 3);
  assert.equal(teammatesGraph(detail, rows, 0).nodes.length, 1);
});
test("separates shared and goalie partner spans within one pair", () => {
  const mixed = teammate(2, "Second", "D", [
    ...spans([7]),
    ...spans([105], "GoaliePartners"),
  ]);
  const row = teammateRows(detail, found(mixed)).find(
    (candidate) => candidate.playerId === 2
  );
  assert.ok(row);
  assert.equal(row.games, 7);
  assert.equal(row.goaliePartnerGames, 105);
});
test("no teammates produce an empty table", () => {
  assert.deepEqual(teammateRows(detail, found()), []);
});
