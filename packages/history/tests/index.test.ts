import assert from "node:assert/strict";
import { test } from "node:test";

import { historyPackage } from "../src/index.ts";

test("exports package marker", () => {
  assert.equal(historyPackage, "history");
});
