import assert from "node:assert/strict";
import { test } from "node:test";

import { Effect } from "effect";

import { MINI_GRAPH, makeMiniStore } from "../../history/tests/fakes.ts";
import { opponentsSample } from "../src/samples.ts";
import { opponents } from "../src/tables/opponents.ts";

test("opponents of 16 and 12 on the shared test league match the sample", async () => {
  const result = await Effect.runPromise(
    opponents(MINI_GRAPH, makeMiniStore(), 16, 12)
  );
  assert.deepEqual(result.tables, opponentsSample.tables);
  assert.equal(result.notes, opponentsSample.notes);
});

test("equal inputs list each player once", async () => {
  const result = await Effect.runPromise(
    opponents(MINI_GRAPH, makeMiniStore(), 16, 16)
  );
  // Only goalie 16's opponents: the sample's focus-16 rows, once each, and the players they name with 16.
  const faced = opponentsSample.tables.faced.filter((row) => row.focus === 16);
  const ids = new Set([16, ...faced.map((row) => row.opponent)]);
  assert.deepEqual(result.tables.faced, faced);
  assert.deepEqual(
    result.tables.players,
    opponentsSample.tables.players.filter((p) => ids.has(p.playerId))
  );
  assert.equal(result.notes, opponentsSample.notes);
});
