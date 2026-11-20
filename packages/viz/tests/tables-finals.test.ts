import assert from "node:assert/strict";
import { test } from "node:test";

import { Effect } from "effect";

import { MINI_GRAPH, makeMiniStore } from "../../history/tests/fakes.ts";
import { finalsSample } from "../src/samples.ts";
import { finals } from "../src/tables/finals.ts";

test("finals for player 12, 1900 to 2100, matches the sample", async () => {
  const result = await Effect.runPromise(
    finals(MINI_GRAPH, makeMiniStore(), 12, 1900, 2100)
  );
  assert.deepEqual(result.tables, finalsSample.tables);
  assert.equal(result.notes, finalsSample.notes);
});
