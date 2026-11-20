import assert from "node:assert/strict";
import { test } from "node:test";

import { ANALYST_VERSION } from "../src/version.ts";

test("analyst package resolves", () => {
  assert.equal(typeof ANALYST_VERSION, "string");
});
