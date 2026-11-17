import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { Schema } from "effect";
import { EvalCases } from "./case.ts";

const file = new URL("./qa/decline.json", import.meta.url);

test("decline cases decode and expect a decline with no truth SQL", async () => {
  const cases = Schema.decodeUnknownSync(EvalCases)(JSON.parse(await readFile(file, "utf8")));
  assert.equal(cases.length, 4);
  for (const c of cases) {
    assert.equal(c.expect, "decline", c.id);
    assert.equal(c.truthSql, null, c.id);
  }
});
