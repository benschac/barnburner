import assert from "node:assert/strict";
import { readdirSync } from "node:fs";
import { test } from "node:test";

import { rendererLoaders } from "../src/viz/bench/renderer-loaders.ts";

test("every renderer file is registered in rendererLoaders", () => {
  const files = readdirSync(
    new URL("../src/viz/bench/renderers/", import.meta.url)
  )
    .filter((name) => name.endsWith(".ts"))
    .map((name) => name.replace(/\.ts$/, ""))
    .toSorted();
  const registered = rendererLoaders.map(({ id }) => id).toSorted();
  assert.deepEqual(registered, files);
});
