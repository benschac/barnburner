import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const script = fileURLToPath(
  new URL("../../../scripts/check-error-model.mjs", import.meta.url)
);
const src = fileURLToPath(new URL("../src", import.meta.url));

const check = (files: Record<string, string>) => {
  const dir = mkdtempSync(join(tmpdir(), "error-model-"));
  try {
    for (const [name, text] of Object.entries(files))
      writeFileSync(join(dir, name), text);
    const run = spawnSync(process.execPath, [script, dir], {
      encoding: "utf-8",
    });
    return { status: run.status, stderr: run.stderr };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
};

test("the analyst source follows the error model", () => {
  const run = spawnSync(process.execPath, [script, src], { encoding: "utf-8" });
  assert.equal(run.status, 0, run.stderr);
});

test("a class that extends Error is rejected", () => {
  const { status, stderr } = check({
    "a.ts": "export class Boom extends Error {}\n",
  });
  assert.equal(status, 1);
  assert.match(stderr, /a\.ts:1 class extends Error/);
});

test("an unmarked throw is rejected", () => {
  const { status, stderr } = check({
    "a.ts": "export const f = () => {\n  throw new Error('no')\n}\n",
  });
  assert.equal(status, 1);
  assert.match(stderr, /a\.ts:2 throw without/);
});

test("a throw marked as a defect, tagged errors, comments and test files pass", () => {
  const { status, stderr } = check({
    "a.ts": [
      "import { Schema } from 'effect'",
      "export class Nope extends Schema.TaggedError<Nope>()('Nope', {}) {}",
      "// A comment that says throw or extends Error is fine.",
      "export const f = (): never => {",
      "  // defect: unreachable",
      "  throw new Error('unreachable')",
      "}",
      "",
    ].join("\n"),
    "a.test.ts": "throw new Error('tests may throw')\n",
  });
  assert.equal(status, 0, stderr);
});
