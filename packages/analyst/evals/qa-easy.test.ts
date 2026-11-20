import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import { Effect, Schema } from "effect";

import { openDb } from "../src/db.ts";
import { EvalCases } from "./case.ts";

const file = new URL("./qa/easy.json", import.meta.url);
const dataDir = fileURLToPath(
  new URL("../tests/fixtures/data", import.meta.url)
);

test("six easy cases decode and return one value column on fixture data", async () => {
  const cases = Schema.decodeUnknownSync(EvalCases)(
    JSON.parse(await readFile(file, "utf8"))
  );
  assert.equal(cases.length, 6);

  await Effect.runPromise(
    Effect.scoped(
      Effect.gen(function* () {
        const db = yield* openDb({ dataDir });
        yield* Effect.forEach(
          cases,
          (c) =>
            Effect.gen(function* () {
              assert.equal(c.expect, "value", c.id);
              assert.ok(c.truthSql !== null, c.id);
              const { rows } = yield* db.query(c.truthSql);
              assert.equal(rows.length, 1, c.id);
              const row = rows[0];
              assert.ok(row, c.id);
              assert.deepEqual(Object.keys(row), ["value"], c.id);
              assert.equal(typeof row.value, "number", c.id);
              assert.ok(Number.isFinite(row.value), c.id);
            }),
          { discard: true }
        );
      })
    )
  );
});
