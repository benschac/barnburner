import assert from "node:assert/strict";
import { test } from "node:test";

import { UnknownPlayer } from "@nhl-reddit-stats/history";
import { Effect, Schema } from "effect";

import { MINI_GRAPH, makeMiniStore } from "../../history/tests/fakes.ts";
import { egoSample } from "../src/samples.ts";
import { ego } from "../src/tables/ego.ts";

test("ego of player 14 on the mini league equals the sample", async () => {
  const result = await Effect.runPromise(ego(MINI_GRAPH, makeMiniStore(), 14));
  assert.deepEqual(result.tables, egoSample.tables);
  assert.equal(result.notes, egoSample.notes);
});

test("ego of an unknown player fails with UnknownPlayer", async () => {
  const error = await Effect.runPromise(
    Effect.flip(ego(MINI_GRAPH, makeMiniStore(), 999))
  );
  assert.ok(Schema.is(UnknownPlayer)(error));
});
