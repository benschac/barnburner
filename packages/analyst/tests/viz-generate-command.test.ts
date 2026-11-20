import assert from "node:assert/strict";
import { test } from "node:test";

import { Effect, Result } from "effect";

import { parseArgs, readText } from "../scripts/generate-view.ts";

const full = [
  "--prompt",
  "show goals",
  "--tables",
  "t.json",
  "--vocabulary",
  "antv",
  "--out",
  "v.tsx",
];

test("parseArgs accepts all four flags and resolves the paths", () => {
  const parsed = parseArgs(full);
  assert.ok(Result.isSuccess(parsed));
  assert.equal(parsed.success.prompt, "show goals");
  assert.equal(parsed.success.vocabulary, "antv");
  assert.ok(parsed.success.tables.endsWith("t.json"));
});

test("parseArgs rejects a missing flag, an unknown vocabulary, a duplicate flag and an unknown flag", () => {
  assert.ok(Result.isFailure(parseArgs(full.slice(2))));
  assert.ok(
    Result.isFailure(
      parseArgs([
        "--prompt",
        "x",
        "--tables",
        "t",
        "--vocabulary",
        "plotly",
        "--out",
        "o",
      ])
    )
  );
  assert.ok(Result.isFailure(parseArgs([...full, "--prompt", "again"])));
  assert.ok(Result.isFailure(parseArgs([...full, "--team", "NJD"])));
});

test("parseArgs rejects an empty or blank --prompt, --tables or --out before any model call", () => {
  for (const flag of ["--prompt", "--tables", "--out"]) {
    const argv = full.map((value, index) =>
      full[index - 1] === flag ? "   " : value
    );
    const parsed = parseArgs(argv);
    assert.ok(Result.isFailure(parsed), flag);
    assert.match(
      parsed.failure.message,
      new RegExp(flag + " must not be empty")
    );
  }
});

test("readText fails with a ReadFileError carrying the path and the cause", async () => {
  const path = "/nonexistent/generate-view-test/tables.json";
  const error = await Effect.runPromise(
    readText(path).pipe(
      Effect.catchTag("ReadFileError", (e) => Effect.succeed(e))
    )
  );
  if (typeof error === "string") assert.fail("readText should fail");
  assert.equal(error._tag, "ReadFileError");
  assert.equal(error.path, path);
  assert.ok(error.cause.length > 0);
});
