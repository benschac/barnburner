import assert from "node:assert/strict";
import { test } from "node:test";

import type { GraphData } from "@antv/g6";

import {
  teammateCandidates,
  teammateRows,
  teammatesGraph,
  teammateGamesLabel,
} from "../src/explorer/teammates.ts";
import type {
  PlayerDetail,
  RosterDetail,
  LinkDetail,
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
const rosters: RosterDetail[] = detail.stints.map((stint) => ({
  snapshotId: "test",
  teamId: stint.teamId,
  seasonId: stint.seasonId,
  gameType: 2,
  focusPlayerId: 1,
  players: [
    {
      playerId: 1,
      name: "Focus",
      position: "G",
      games: 50,
      link: { _tag: "PlayedWith", games: 999, evidenceGameId: 1 },
    },
    {
      playerId: 3,
      name: "Third",
      position: "C",
      games: 50,
      link: { _tag: "PlayedWith", games: 30, evidenceGameId: 1 },
    },
    {
      playerId: 2,
      name: "Second",
      position: "D",
      games: 50,
      link: { _tag: "PlayedWith", games: 30, evidenceGameId: 1 },
    },
    {
      playerId: 4,
      name: "Partner",
      position: "G",
      games: 50,
      link: { _tag: "GoaliePartners", games: 40, evidenceGameId: 1 },
    },
    {
      playerId: 5,
      name: "Unlinked",
      position: "C",
      games: 50,
      link: { _tag: "NoLink" },
    },
  ],
}));
const link = (
  games: readonly number[],
  kind: "PlayedWith" | "GoaliePartners" = "PlayedWith"
): LinkDetail => ({
  snapshotId: "test",
  totalGames: games.reduce((a, b) => a + b, 0),
  evidenceGameId: 1,
  opposedGames: 0,
  spans: games.map((count, index) => ({
    seasonId: index === 0 ? 20002001 : 20012002,
    gameType: 2,
    teamId: index + 1,
    link: kind,
    games: count,
    firstGameId: 1,
  })),
});
const links = new Map([
  [2, link([10, 20])],
  [3, link([30])],
  [4, link([40], "GoaliePartners")],
]);

test("merges repeated roster identities and sums shared spans once", () => {
  const rows = teammateRows(detail, rosters, links);
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
  const row = teammateRows(detail, rosters, links).find(
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
test("excludes focus and unlinked players and breaks game ties by lower ID", () => {
  assert.deepEqual(
    teammateCandidates(1, rosters).map((row) => row.playerId),
    [3, 2, 4]
  );
  assert.deepEqual(
    teammateRows(detail, rosters, links).map((row) => row.playerId),
    [2, 3, 4]
  );
});
test("sorts by games before ID and draws only top N spokes", () => {
  const rows = teammateRows(
    detail,
    rosters,
    new Map([...links, [3, link([50])]])
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
  const mixed = {
    ...link([7]),
    spans: [...link([7]).spans, ...link([105], "GoaliePartners").spans],
  };
  const row = teammateRows(
    detail,
    rosters,
    new Map([...links, [2, mixed]])
  ).find((candidate) => candidate.playerId === 2);
  assert.ok(row);
  assert.equal(row.games, 7);
  assert.equal(row.goaliePartnerGames, 105);
});
test("empty rosters produce an empty table", () => {
  assert.deepEqual(teammateRows(detail, [], new Map()), []);
});
