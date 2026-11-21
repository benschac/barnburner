import assert from "node:assert/strict";
import { test } from "node:test";

import type { GraphData } from "@antv/g6";
import type {
  FindPathResult,
  GetPlayerResult,
  WireHop,
} from "@nhl-reddit-stats/history/rpc";

import { pathGraph, pathPlayerIds } from "../src/explorer/path-graph.ts";

type Result = typeof FindPathResult.Type;
type Detail = typeof GetPlayerResult.Type;

const detail = (
  playerId: number,
  name: string,
  stints: Detail["stints"] = []
): Detail => ({
  snapshotId: "snap",
  player: {
    playerId,
    name,
    position: "C",
    firstSeason: 19801981,
    lastSeason: 20192020,
    games: 900,
    points: 1000,
    teammates: 500,
  },
  stints,
});

const stint = (
  teamId: number,
  teamAbbrev: string,
  seasonId: number,
  gameType: 2 | 3 = 2
): Detail["stints"][number] => ({
  seasonId,
  gameType,
  teamId,
  teamAbbrev,
  teamName: teamAbbrev,
  games: 50,
  firstGameId: 1,
  lastGameId: 2,
});

const playedWith = (
  from: number,
  to: number,
  games: number,
  teamId: number,
  seasonId: number,
  gameType: 2 | 3 = 2,
  gameId = 1
): WireHop => ({
  _tag: "PlayedWith",
  from,
  to,
  games,
  teamId,
  seasonId,
  gameType,
  gameId,
});

const toMap = (details: readonly Detail[]) =>
  new Map(details.map((d) => [d.player.playerId, d]));

const result = (paths: Result["paths"]): Result => ({
  snapshotId: "snap",
  distance: paths[0]?.length ?? 0,
  pathCount: paths.length,
  pathCountCapped: false,
  paths,
});

const GRETZKY = 8447400;
const MCDAVID = 8478402;
const ROBITAILLE = 8448000;
const CAMMALLERI = 8470000;
const BLAKE = 8450000;
const DEMERS = 8474000;

const lak8889 = 19881989;
const gretzkyPlayers = toMap([
  detail(GRETZKY, "Wayne Gretzky", [stint(26, "LAK", lak8889)]),
  detail(ROBITAILLE, "Luc Robitaille", [
    stint(26, "LAK", lak8889),
    stint(26, "LAK", 20032004),
  ]),
  detail(BLAKE, "Rob Blake", [stint(26, "LAK", 19891990, 3)]),
  detail(CAMMALLERI, "Michael Cammalleri", [
    stint(26, "LAK", 20032004),
    stint(22, "EDM", 20172018),
  ]),
  detail(DEMERS, "Jason Demers"),
  detail(MCDAVID, "Connor McDavid", [stint(22, "EDM", 20172018)]),
]);

const gretzkyResult = result([
  [
    playedWith(GRETZKY, ROBITAILLE, 566, 26, lak8889, 2, 1988020007),
    playedWith(ROBITAILLE, CAMMALLERI, 94, 26, 20032004, 2, 2003020144),
    playedWith(CAMMALLERI, MCDAVID, 51, 22, 20172018, 2, 2017020286),
  ],
  [
    playedWith(GRETZKY, BLAKE, 328, 26, 19891990, 3, 1989030173),
    playedWith(BLAKE, CAMMALLERI, 125, 26, 20062007),
    playedWith(CAMMALLERI, MCDAVID, 51, 22, 20172018),
  ],
  [
    playedWith(GRETZKY, BLAKE, 328, 26, 19891990, 3, 1989030173),
    playedWith(BLAKE, DEMERS, 54, 28, 20092010),
    playedWith(DEMERS, MCDAVID, 1, 22, 20222023),
  ],
]);

test("the Gretzky to McDavid shape keeps chain order and shares edges", () => {
  const players = new Map([
    ...gretzkyPlayers,
    [
      BLAKE,
      detail(BLAKE, "Rob Blake", [
        stint(26, "LAK", 19891990, 3),
        stint(26, "LAK", 20062007),
        stint(28, "SJS", 20092010),
      ]),
    ],
    [DEMERS, detail(DEMERS, "Jason Demers", [stint(22, "EDM", 20222023)])],
  ]);
  const graph = pathGraph({
    from: GRETZKY,
    to: MCDAVID,
    result: gretzkyResult,
    players,
  });
  assert.deepEqual(
    graph.nodes.map((node) => node.data.name),
    [
      "Wayne Gretzky",
      "Luc Robitaille",
      "Michael Cammalleri",
      "Connor McDavid",
      "Rob Blake",
      "Jason Demers",
    ]
  );
  assert.deepEqual(
    graph.nodes.map((node) => node.data.end),
    [true, false, false, true, false, false]
  );
  assert.deepEqual(graph.chains[0]?.names, [
    "Wayne Gretzky",
    "Luc Robitaille",
    "Michael Cammalleri",
    "Connor McDavid",
  ]);
  assert.deepEqual(graph.chains[0]?.playerIds, [
    GRETZKY,
    ROBITAILLE,
    CAMMALLERI,
    MCDAVID,
  ]);
  const shared = `${GRETZKY}-${BLAKE}`;
  assert.equal(graph.chains[1]?.edgeIds[0], shared);
  assert.equal(graph.chains[2]?.edgeIds[0], shared);
  assert.equal(graph.edges.filter((edge) => edge.id === shared).length, 1);
  // Cammalleri to McDavid is shared by chains 0 and 1.
  assert.deepEqual(
    graph.edges.map((edge) => edge.id),
    [
      `${GRETZKY}-${ROBITAILLE}`,
      `${ROBITAILLE}-${CAMMALLERI}`,
      `${CAMMALLERI}-${MCDAVID}`,
      shared,
      `${BLAKE}-${CAMMALLERI}`,
      `${BLAKE}-${DEMERS}`,
      `${DEMERS}-${MCDAVID}`,
    ]
  );
  assert.equal(graph.edges[0]?.data.label, "LAK 1988–89 · 566 games");
  assert.equal(graph.edges[0]?.style.labelText, "LAK 1988–89 · 566 games");
  assert.equal(graph.edges[3]?.data.label, "LAK 1989–90 · 328 games");
  assert.equal(graph.edges.at(-1)?.data.label, "EDM 2022–23 · 1 game");
  const data: GraphData = graph;
  assert.equal(data.nodes?.length, 6);
});

test("a two-chain teammate result lists nodes, edges and chains in order", () => {
  const players = toMap([
    detail(1, "A", [stint(7, "AAA", 19501951)]),
    detail(2, "B"),
    detail(3, "C"),
    detail(4, "D"),
  ]);
  const graph = pathGraph({
    from: 1,
    to: 4,
    players,
    result: result([
      [playedWith(1, 2, 2, 7, 19501951), playedWith(2, 4, 3, 7, 19501951)],
      [playedWith(1, 3, 4, 7, 19501951), playedWith(3, 4, 5, 7, 19501951)],
    ]),
  });
  assert.deepEqual(
    graph.nodes.map((n) => n.id),
    ["1", "2", "4", "3"]
  );
  assert.deepEqual(
    graph.edges.map((e) => e.id),
    ["1-2", "2-4", "1-3", "3-4"]
  );
  assert.deepEqual(
    graph.chains.map((c) => c.edgeIds),
    [
      ["1-2", "2-4"],
      ["1-3", "3-4"],
    ]
  );
  assert.deepEqual(graph.chains[1]?.names, ["A", "C", "D"]);
  assert.deepEqual(
    graph.nodes.map((n) => n.data.end),
    [true, false, true, false]
  );
  assert.equal(graph.edges[0]?.data.label, "AAA 1950–51 · 2 games");
});

test("a goalie-partner hop is labelled by games dressed", () => {
  const players = toMap([
    detail(16, "G16", [stint(3, "CCC", 19511952)]),
    detail(17, "G17"),
  ]);
  const hop: WireHop = {
    _tag: "GoaliePartners",
    from: 16,
    to: 17,
    games: 3,
    teamId: 3,
    seasonId: 19511952,
    gameType: 2,
    gameId: 5,
  };
  const graph = pathGraph({
    from: 16,
    to: 17,
    players,
    result: result([[hop]]),
  });
  assert.equal(graph.edges[0]?.data.label, "CCC 1951–52 · 3 dressed");
  assert.equal(graph.edges[0]?.data._tag, "GoaliePartners");
});

test("a PlayedAgainst result labels games against", () => {
  const players = toMap([
    detail(GRETZKY, "Wayne Gretzky"),
    detail(9, "Jaromir Jagr"),
    detail(MCDAVID, "Connor McDavid"),
  ]);
  const graph = pathGraph({
    from: GRETZKY,
    to: MCDAVID,
    players,
    result: result([
      [
        {
          _tag: "PlayedAgainst",
          from: GRETZKY,
          to: 9,
          games: 21,
          gameId: 1990020216,
        },
        {
          _tag: "PlayedAgainst",
          from: 9,
          to: MCDAVID,
          games: 1,
          gameId: 2016020675,
        },
      ],
    ]),
  });
  assert.deepEqual(
    graph.edges.map((e) => e.data.label),
    ["21 games against", "1 game against"]
  );
  const first = graph.edges[0]?.data;
  assert.equal(first?._tag, "PlayedAgainst");
  if (first?._tag === "PlayedAgainst") {
    assert.equal(first.firstGameId, 1990020216);
  }
  assert.deepEqual(graph.chains[0]?.names, [
    "Wayne Gretzky",
    "Jaromir Jagr",
    "Connor McDavid",
  ]);
});

test("distance 0 is one node, no edges and one empty chain", () => {
  const players = toMap([detail(5, "Solo")]);
  const graph = pathGraph({ from: 5, to: 5, players, result: result([[]]) });
  assert.deepEqual(
    graph.nodes.map((n) => n.id),
    ["5"]
  );
  assert.equal(graph.nodes[0]?.data.end, true);
  assert.deepEqual(graph.edges, []);
  assert.deepEqual(graph.chains, [
    { edgeIds: [], playerIds: [5], names: ["Solo"] },
  ]);
});

test("the team abbreviation falls back to the other player's stint, then the team id", () => {
  const players = toMap([
    detail(1, "A"),
    detail(2, "B", [stint(7, "BBB", 19501951)]),
    detail(3, "C"),
  ]);
  const graph = pathGraph({
    from: 1,
    to: 3,
    players,
    result: result([
      [playedWith(1, 2, 2, 7, 19501951), playedWith(2, 3, 2, 8, 19501951)],
    ]),
  });
  assert.equal(graph.edges[0]?.data.label, "BBB 1950–51 · 2 games");
  assert.equal(graph.edges[1]?.data.label, "8 1950–51 · 2 games");
});

test("a hop whose player has no details is a defect", () => {
  assert.throws(() =>
    pathGraph({
      from: 1,
      to: 2,
      players: toMap([detail(1, "A")]),
      result: result([[playedWith(1, 2, 1, 7, 19501951)]]),
    })
  );
});

test("pathPlayerIds dedupes in first-appearance order and includes both ends", () => {
  assert.deepEqual(pathPlayerIds(gretzkyResult, GRETZKY, MCDAVID), [
    GRETZKY,
    ROBITAILLE,
    CAMMALLERI,
    MCDAVID,
    BLAKE,
    DEMERS,
  ]);
  assert.deepEqual(pathPlayerIds(result([[]]), 5, 5), [5]);
});
