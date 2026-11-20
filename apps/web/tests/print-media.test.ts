import assert from "node:assert/strict";
import { test } from "node:test";

import { mediaObjectToString } from "tamagui";

import { printMedia } from "../design/print-media.ts";

// design/print-media.ts casts the raw "print" query past Tamagui's config type. The cast is safe
// only while Tamagui hands a string query to the stylesheet unchanged.
test("Tamagui passes the raw print media query through unchanged", () => {
  assert.equal(mediaObjectToString(printMedia), "print");
});

test("an object media query still becomes a feature query", () => {
  assert.equal(mediaObjectToString({ minWidth: 1206 }), "(min-width: 1206px)");
});
