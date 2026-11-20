import assert from "node:assert/strict";
import { test } from "node:test";

import { Result } from "effect";

import { jsonRoundTrip, parseJson, toJson, toPrettyJson } from "../src/json.ts";

test("parseJson returns the parsed value", () => {
  assert.deepEqual(Result.getOrThrow(parseJson('{"a":[1,null]}')), {
    a: [1, null],
  });
});

test("parseJson fails with a tagged error on invalid text", () => {
  const parsed = parseJson("{bad");
  assert.ok(Result.isFailure(parsed));
  assert.equal(parsed.failure._tag, "JsonParseError");
  assert.match(parsed.failure.message, /^invalid JSON: /);
});

test("toJson and toPrettyJson write what JSON.stringify writes", () => {
  const value = { a: undefined, b: [1, undefined], n: Number.NaN };
  assert.equal(toJson(value), JSON.stringify(value));
  assert.equal(toPrettyJson(value), JSON.stringify(value, null, 2));
});

test("toJson refuses a value JSON cannot represent", () => {
  assert.throws(() => toJson(undefined));
  assert.throws(() => toJson(10n));
});

test("jsonRoundTrip drops undefined fields", () => {
  assert.deepEqual(jsonRoundTrip({ a: undefined, b: 1 }), { b: 1 });
});
