import assert from "node:assert/strict";
import { test } from "node:test";

import { ChainTables, FinalsTables, PairTables } from "@nhl-reddit-stats/viz";
import { Schema } from "effect";

import chain from "../src/viz/lab/data/chain-8478402-8471675.json" with { type: "json" };
import finals from "../src/viz/lab/data/finals-8478402-1980-2026.json" with { type: "json" };
import pair from "../src/viz/lab/data/pair-8478402-8477934.json" with { type: "json" };
import { chainGraph } from "../src/viz/specs/chain.ts";
import { gamesBySeasonRows } from "../src/viz/specs/games-by-season.ts";

test("bundled chain resolves every player and club into a renderable graph", () => {
  const tables = Schema.decodeUnknownSync(ChainTables)(chain.tables);
  const graph = chainGraph(tables);
  assert.ok(graph.chains.length > 0);
  assert.ok(graph.nodes.some((node) => node.data.name === "Connor McDavid"));
  assert.ok(graph.nodes.some((node) => node.data.name === "Sidney Crosby"));
  for (const edge of graph.edges) {
    assert.ok(graph.nodes.some((node) => node.id === edge.source));
    assert.ok(graph.nodes.some((node) => node.id === edge.target));
    assert.ok(edge.data.evidenceGameId > 0);
  }
});

test("bundled shared-game rows retain the exported total and club names", () => {
  const tables = Schema.decodeUnknownSync(PairTables)(pair.tables);
  const rows = gamesBySeasonRows(tables);
  const summary = tables.summary[0];
  assert.ok(summary);
  assert.ok(rows.length > 0);
  assert.equal(
    rows.reduce((total, row) => total + row.games, 0),
    summary.totalGames
  );
  assert.ok(rows.every((row) => row.club === "EDM"));
  assert.equal(tables.players.length, 2);
  assert.ok(tables.players.some((player) => player.name === "Connor McDavid"));
  assert.ok(tables.players.some((player) => player.name === "Leon Draisaitl"));
});

test("bundled Finals coverage spans the advertised years and names every hit", () => {
  const tables = Schema.decodeUnknownSync(FinalsTables)(finals.tables);
  assert.equal(tables.finals.length, 46);
  assert.ok(tables.finals.every((row) => row.year !== 2005));
  assert.equal(tables.finals[0]?.year, 1980);
  assert.equal(tables.finals.at(-1)?.year, 2026);
  assert.ok(tables.finals.some((row) => row.covered === 1));
  for (const row of tables.finals) {
    if (row.covered === 1) {
      assert.ok(
        tables.players.some((player) => player.playerId === row.playerId)
      );
      assert.ok(row.finalGameId && row.sharedGameId);
    } else {
      assert.equal(row.playerId, null);
    }
  }
});
