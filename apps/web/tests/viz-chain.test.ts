import assert from "node:assert/strict";
import { test } from "node:test";

import type { GraphData } from "@antv/g6";
import type { ChainTables } from "@nhl-reddit-stats/viz";
import { chainSample } from "@nhl-reddit-stats/viz/samples";

import { chainGraph } from "../src/viz/specs/chain.ts";

test("chainGraph builds the sample chain graph", () => {
  const graph = chainGraph(chainSample.tables);
  assert.deepEqual(
    graph.nodes.map((node) => node.id),
    ["11", "12", "14", "13"]
  );
  assert.equal(graph.edges.length, 4);
  assert.equal(graph.chains.length, 2);
  assert.deepEqual(graph.chains[0], ["11-12", "12-14"]);
  assert.deepEqual(graph.chains[1], ["11-13", "13-14"]);
  const first = graph.edges[0];
  assert.equal(first?.source, "11");
  assert.equal(first?.target, "12");
  assert.equal(first?.data.label, "AAA 1950–51 · 2 games");
  assert.equal(first?.style.labelText, "AAA 1950–51 · 2 games");
  assert.equal(first?.data.evidenceGameId, 1950020001);
  assert.deepEqual(
    graph.nodes.map((node) => node.data.end),
    [true, false, true, false]
  );
  assert.equal(graph.nodes[0]?.data.name, "Player Eleven");
  const ids = new Set(graph.edges.map((edge) => edge.id));
  assert.ok(graph.chains.flat().every((id) => ids.has(id)));
  // The result goes to G6 without copying.
  const data: GraphData = graph;
  assert.equal(data.nodes?.length, 4);
});

test("chainGraph from a player to themself is one node and one empty chain", () => {
  const tables: ChainTables = {
    players: chainSample.tables.players.slice(0, 1),
    teams: [],
    hops: [],
    summary: [
      { from: 11, to: 11, distance: 0, pathCount: 1, pathCountCapped: 0 },
    ],
  };
  const graph = chainGraph(tables);
  assert.deepEqual(
    graph.nodes.map((node) => node.id),
    ["11"]
  );
  assert.equal(graph.nodes[0]?.data.end, true);
  assert.deepEqual(graph.edges, []);
  assert.deepEqual(graph.chains, [[]]);
});

test("chainGraph labels a goalie-partner hop by games dressed", () => {
  const tables: ChainTables = {
    players: [
      {
        playerId: 16,
        name: "Goalie Sixteen",
        position: "G",
        firstSeason: 19501951,
        lastSeason: 19511952,
        games: 6,
      },
      {
        playerId: 17,
        name: "Goalie Seventeen",
        position: "G",
        firstSeason: 19511952,
        lastSeason: 19511952,
        games: 1,
      },
    ],
    teams: [{ teamId: 3, abbrev: "CCC", name: "Charlie Club" }],
    hops: [
      {
        chain: 0,
        step: 0,
        from: 16,
        to: 17,
        kind: "GoaliePartners",
        games: 3,
        teamId: 3,
        seasonId: 19511952,
        gameType: 2,
        gameId: 1951020005,
      },
    ],
    summary: [
      { from: 16, to: 17, distance: 1, pathCount: 1, pathCountCapped: 0 },
    ],
  };
  const graph = chainGraph(tables);
  assert.equal(graph.edges[0]?.data.label, "CCC 1951–52 · 3 dressed");
  assert.equal(graph.edges[0]?.style.labelText, "CCC 1951–52 · 3 dressed");
  assert.equal(graph.edges[0]?.data.kind, "GoaliePartners");
});

test("chainGraph rejects a hop whose player has no row", () => {
  const tables: ChainTables = {
    ...chainSample.tables,
    players: chainSample.tables.players.slice(1),
  };
  assert.throws(() => chainGraph(tables));
});
