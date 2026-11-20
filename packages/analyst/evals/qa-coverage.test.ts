import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import { Effect, Schema } from "effect";

import { openDb } from "../src/db.ts";
import { EvalCases } from "./case.ts";

const file = new URL("qa/coverage.json", import.meta.url);
const dataDir = fileURLToPath(
  new URL("../tests/fixtures/data", import.meta.url)
);

test("coverage cases decode and their truth SQL returns one value column on fixtures", async () => {
  const cases = Schema.decodeUnknownSync(EvalCases)(
    JSON.parse(await readFile(file, "utf-8"))
  );
  assert.equal(cases.length, 4);
  assert.equal(new Set(cases.map((c) => c.id)).size, cases.length);

  await Effect.runPromise(
    Effect.scoped(
      Effect.gen(function* () {
        const db = yield* openDb({ dataDir });
        yield* Effect.forEach(
          cases,
          (c) =>
            Effect.gen(function* () {
              assert.equal(c.expect, "value", c.id);
              assert.equal(c.mustMentionCoverage, true, c.id);
              assert.ok(c.truthSql !== null, c.id);
              const { rows, rowCount } = yield* db.query(c.truthSql);
              assert.equal(rowCount, 1, c.id);
              assert.equal(rows.length, 1, c.id);
              assert.deepEqual(Object.keys(rows[0] ?? {}), ["value"], c.id);
            }),
          { discard: true }
        );
      })
    )
  );
});
