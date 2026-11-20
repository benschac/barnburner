// oxlint-disable effecttsgo/node-builtin-import, effecttsgo/global-console, effecttsgo/process-env -- a test runner outside any Effect runtime

// Local addition to the vendored copy; see ../UPSTREAM.md.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { CHANGES_ENV, changedLines, changesJson } from "./changed.ts";

const dir = realpathSync(
  mkdtempSync(join(tmpdir(), "anti-slop-with-changes-"))
);
const git = (...args: string[]) =>
  execFileSync("git", args, { cwd: dir, stdio: "ignore" });
const env = { ...process.env };
try {
  delete process.env.ANTI_SLOP_BASE;
  git("init", "-q", "-b", "main");
  git("config", "user.email", "test@example.com");
  git("config", "user.name", "test");
  writeFileSync(join(dir, "a.ts"), "one\ntwo\nthree\n");
  git("add", "a.ts");
  git("commit", "-q", "-m", "a");
  git("checkout", "-q", "-b", "feature");
  writeFileSync(join(dir, "a.ts"), "one\nTWO\nthree\n");
  writeFileSync(join(dir, "b.ts"), "new\n");

  const json = changesJson(dir);
  assert.deepEqual(JSON.parse(json).files, { "a.ts": [2], "b.ts": "all" });

  // With the precomputed file, rules answer without git: PATH no longer finds it.
  const file = join(dir, "changes.json");
  writeFileSync(file, json);
  process.env[CHANGES_ENV] = file;
  process.env.PATH = "";
  const warnings: string[] = [];
  const warn = (message: string) => warnings.push(message);
  assert.deepEqual([...changedLines(join(dir, "a.ts"), undefined, warn)], [2]);
  assert.equal(changedLines(join(dir, "b.ts"), undefined, warn), "all");
  assert.deepEqual(warnings, []);

  // A rule with its own base option is not what the file was computed for, so it runs git, which now fails.
  assert.equal(changedLines(join(dir, "a.ts"), "main", warn), "all");
  assert.equal(warnings.length, 1);
  console.log("ok - precomputed changes answer changedLines without git");
} finally {
  process.env = env;
  rmSync(dir, { recursive: true, force: true });
}
