#!/usr/bin/env node
// Runs a lint command with the branch's changed lines computed first.
//
// Usage: node with-changes.ts <command...>
//
// Rules set to mode "changed" otherwise run git from inside the linter. A type-aware linter on
// Linux can be too large to fork, so git fails with ENOMEM and every line is checked. This runs
// git once, writes the result to a temporary file, and names it in ANTI_SLOP_CHANGES for the
// command. With ANTI_SLOP_MODE=all, or when git cannot answer, it runs the command unchanged.
//
// Local addition to the vendored copy; see ../UPSTREAM.md.

// oxlint-disable effecttsgo/node-builtin-import, effecttsgo/global-console, effecttsgo/process-env -- a standalone CLI outside any Effect runtime, so Effect's platform services and logger do not apply

import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { errorMessage } from "../shared/error-message.ts";
import { CHANGES_ENV, changesJson } from "./changed.ts";

const USAGE = "usage: node with-changes.ts <command...>";

function spawn(command: ReadonlyArray<string>, env: NodeJS.ProcessEnv): number {
  const [bin, ...args] = command;
  if (bin === undefined) throw new Error(USAGE);
  const result = spawnSync(bin, args, {
    stdio: "inherit",
    env,
    shell: process.platform === "win32",
  });
  if (result.error !== undefined) throw result.error;
  return result.status ?? 1;
}

function run(command: ReadonlyArray<string>): number {
  if (process.env.ANTI_SLOP_MODE?.trim() === "all")
    return spawn(command, process.env);
  let json: string;
  try {
    json = changesJson(process.cwd());
  } catch (error) {
    console.error(
      `anti-slop: could not compute changed lines before linting; rules will run git themselves: ${errorMessage(error).trim()}`
    );
    return spawn(command, process.env);
  }
  const dir = mkdtempSync(join(tmpdir(), "anti-slop-changes-"));
  try {
    const file = join(dir, "changes.json");
    writeFileSync(file, json);
    return spawn(command, { ...process.env, [CHANGES_ENV]: file });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

try {
  process.exit(run(process.argv.slice(2)));
} catch (error) {
  console.error(`anti-slop with-changes: ${errorMessage(error)}`);
  process.exit(2);
}
