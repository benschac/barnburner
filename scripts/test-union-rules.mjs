#!/usr/bin/env node
/* oxlint-disable no-restricted-imports, no-restricted-properties -- legacy: port to the Effect platform services, see "Node scripts" in AGENTS.md */
// Proves the union-model lint rules fire on bad shapes and stay quiet on good ones.
// Usage: node scripts/test-union-rules.mjs <package dir with .oxlintrc.json>

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { logInfo } from "../lib/logger.mjs";

// The package config turns on type-aware rules, which only the Effect-patched oxlint can run.
const effectTsgo = fileURLToPath(
  new URL("../node_modules/.bin/effect-tsgo", import.meta.url)
);
const root = resolve(process.argv[2] ?? ".");
const dir = await mkdtemp(`${root}/union-rule-test-`);
const cases = [
  [
    "untagged union",
    "export type A = { value: number } | { declined: true; reason?: string }",
    "unions(discriminated)",
  ],
  [
    "untagged inline union",
    "export const f = (a: { x: number } | { y: number }) => a",
    "unions(discriminated)",
  ],
  [
    "tagged union",
    "export type A = { _tag: 'Answered'; value: number } | { _tag: 'Declined' }",
    null,
  ],
  [
    "boolean discriminant",
    "export type A = { ok: true; value: number } | { ok: false; reason: string }",
    null,
  ],
  ["object or null", "export type A = { value: number } | null", null],
  [
    "in narrowing",
    "export const f = (a: object) => 'declined' in a",
    "unions(no-in-narrowing)",
  ],
  [
    "foreign in",
    "// foreign: a is parsed JSON\nexport const f = (a: object) => 'declined' in a",
    null,
  ],
  [
    "bare foreign marker",
    "// foreign:\nexport const f = (a: object) => 'declined' in a",
    "unions(no-in-narrowing)",
  ],
  ["dynamic in", "export const f = (a: object, key: string) => key in a", null],
  // Type-aware rules: these prove the lint run has type information.
  [
    "open switch",
    "type A = { _tag: 'X' } | { _tag: 'Y' }\nexport const f = (a: A) => { switch (a._tag) { case 'X': return 1 } return 0 }",
    "typescript(switch-exhaustiveness-check)",
  ],
  [
    "closed switch",
    "type A = { _tag: 'X' } | { _tag: 'Y' }\nexport const f = (a: A) => { switch (a._tag) { case 'X': return 1; case 'Y': return 2 } }",
    null,
  ],
  [
    "floating promise",
    "const g = async () => 1\nexport const h = () => { g() }",
    "typescript(no-floating-promises)",
  ],
];

try {
  for (const [name, source, expected] of cases) {
    const file = `${dir}/case.ts`;
    await writeFile(file, source);
    const result = spawnSync(
      effectTsgo,
      ["--tsrs-lint", "oxlint", "--format", "json", file],
      { cwd: root, encoding: "utf8" }
    );
    assert.equal(result.error, undefined, name);
    const { diagnostics } = JSON.parse(result.stdout);
    assert.ok(
      !diagnostics.some((d) => d.message.includes("Error running JS plugin")),
      `${name}: plugin crashed`
    );
    // anti-slop rules also report on the fixture, a new file; count only the rules under test.
    const errors = diagnostics.filter(
      (d) =>
        d.severity === "error" &&
        !/^(anti-slop[a-z-]*|landmines|ai-guard|enfect)\(/.test(d.code)
    );
    if (expected)
      assert.ok(
        errors.some((d) => d.code === expected),
        `${name}: ${result.stdout}`
      );
    else assert.equal(errors.length, 0, `${name}: ${result.stdout}`);
    assert.equal(
      result.status,
      diagnostics.some((d) => d.severity === "error") ? 1 : 0,
      name
    );
  }
  logInfo(`${cases.length} union-model and type-aware lint cases passed`);
} finally {
  await rm(dir, { recursive: true, force: true });
}
