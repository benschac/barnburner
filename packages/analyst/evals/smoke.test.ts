import { test } from "node:test";
import assert from "node:assert/strict";
import { ANALYST_VERSION } from "../src/version.ts";

test("analyst eval harness resolves", () => {
  assert.equal(typeof ANALYST_VERSION, "string");
});
