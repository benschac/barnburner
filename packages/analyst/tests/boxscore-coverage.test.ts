import assert from "node:assert/strict";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import { Effect } from "effect";

import { openDb } from "../src/db.ts";
import { VIEWS } from "../src/shapes.ts";

const fixtures = fileURLToPath(new URL("./fixtures/data", import.meta.url));

const coverage = async (dataDir: string) =>
  Effect.runPromise(
    Effect.scoped(
      Effect.gen(function* () {
        const db = yield* openDb({ dataDir });
        return yield* db.query("SELECT * FROM boxscore_coverage ORDER BY team");
      })
    )
  );

test("boxscore_coverage has the contract columns in order", async () => {
  const { rows } = await coverage(fixtures);
  assert.deepEqual(Object.keys(rows[0] ?? {}), [...VIEWS.boxscore_coverage]);
});

test("boxscore_coverage counts finals and archived per team on the fixture", async () => {
  const { rows } = await coverage(fixtures);
  assert.deepEqual(rows, [
    { team: "NJD", finals: 3, archived: 2 },
    { team: "WSH", finals: 3, archived: 2 },
  ]);
});
