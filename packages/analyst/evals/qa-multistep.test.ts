import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { Effect, Schema } from "effect";
import { openDb } from "../src/db.ts";
import { EvalCases } from "./case.ts";

const file = new URL("./qa/multistep.json", import.meta.url);
const dataDir = fileURLToPath(new URL("../tests/fixtures/data", import.meta.url));

test("multistep cases decode and each truth SQL returns one value column", async (t) => {
  const cases = Schema.decodeUnknownSync(EvalCases)(JSON.parse(await readFile(file, "utf8")));
  assert.equal(cases.length, 6);
  assert.equal(new Set(cases.map((c) => c.id)).size, cases.length);

  await Effect.runPromise(
    Effect.scoped(
      Effect.gen(function* () {
        const db = yield* openDb({ dataDir });
        yield* Effect.promise(async () => {
          for (const c of cases) {
            await t.test(c.id, async () => {
              assert.equal(c.expect, "value");
              assert.ok(c.truthSql !== null);
              const result = await Effect.runPromise(db.query(c.truthSql));
              assert.equal(result.rows.length, 1);
              assert.deepEqual(Object.keys(result.rows[0] ?? {}), ["value"]);
            });
          }
        });
      }),
    ),
  );
});
