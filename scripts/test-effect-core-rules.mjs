#!/usr/bin/env node
/* oxlint-disable no-restricted-imports, no-restricted-properties -- legacy: port to the Effect platform services, see "Node scripts" in AGENTS.md */
// Proves the Effect core module lint rules fire on native patterns and stay quiet on the Effect ones.
// Usage: node scripts/test-effect-core-rules.mjs <package dir whose oxlint.config.ts extends lint/effect-core.oxlintrc.json>

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { logInfo } from "../lib/logger.mjs";

const effectTsgo = fileURLToPath(
  new URL("../node_modules/.bin/effect-tsgo", import.meta.url)
);
const root = resolve(process.argv[2] ?? ".");
const dir = await mkdtemp(`${root}/effect-core-rule-test-`);
const effect = "import { Array, Effect, Order } from 'effect'\n";
const cases = [
  [
    "native sort with comparator",
    `${effect}export const f = (xs: number[]) => [...xs].sort((a, b) => a - b)`,
    "core(no-native-sort)",
  ],
  [
    "native toSorted",
    `${effect}export const f = (xs: number[]) => xs.toSorted((a, b) => a - b)`,
    "core(no-native-sort)",
  ],
  [
    "Array.sort with Order",
    `${effect}export const f = (xs: number[]) => Array.sort(xs, Order.Number)`,
    null,
  ],
  [
    "sort outside Effect code",
    "export const f = (xs: number[]) => [...xs].sort((a, b) => a - b)",
    null,
  ],
  [
    "spread Set dedupe",
    `${effect}export const f = (xs: number[]) => [...new Set(xs)]`,
    "core(no-set-dedupe)",
  ],
  [
    "Array.from Set dedupe",
    "import { Effect } from 'effect'\nexport const g = Effect.void\nexport const f = (xs: number[]) => Array.from(new Set(xs))",
    "core(no-set-dedupe)",
  ],
  [
    "spread Set of an Effect iterable",
    "import { Iterable } from 'effect'\nexport const f = (rows: { id: number | null }[]) => [...new Set(Iterable.flatMapNullishOr(rows, (row) => row.id))]",
    "core(no-set-dedupe)",
  ],
  [
    "spread Set of a pair",
    `${effect}export const f = (a: number, b: number) => [...new Set([a, b])]`,
    "core(no-set-dedupe)",
  ],
  [
    "spread Set with a typed Set",
    `${effect}export const f = (xs: number[]) => [...new Set<number>(xs)]`,
    "core(no-set-dedupe)",
  ],
  [
    "spread Set beside other elements",
    `${effect}export const f = (xs: number[], ys: number[]) => [...new Set(xs), ...ys]`,
    "core(no-set-dedupe)",
  ],
  [
    "spread Set inside a type assertion",
    `${effect}export const f = (xs: number[]) => [...(new Set(xs) as Set<number>)]`,
    "core(no-set-dedupe)",
  ],
  [
    "Array.from Set with a mapper",
    "import { Effect } from 'effect'\nexport const g = Effect.void\nexport const f = (xs: number[]) => Array.from(new Set(xs), (x) => x + 1)",
    "core(no-set-dedupe)",
  ],
  [
    "for-of over a new Set",
    `${effect}export const f = (xs: number[]) => { let n = 0; for (const x of new Set(xs)) n += x; return n }`,
    "core(no-set-dedupe)",
  ],
  [
    "Set of concatenated spreads",
    `${effect}export const f = (xs: number[], ys: number[]) => new Set([...xs, ...ys])`,
    "core(no-set-dedupe)",
  ],
  [
    "Set of a mixed list",
    `${effect}export const f = (xs: number[]) => new Set([0, ...xs])`,
    null,
  ],
  [
    "spread of a Set variable",
    `${effect}export const f = (ids: Set<number>) => [...ids]`,
    null,
  ],
  [
    "native sort of a spread Set variable",
    `${effect}export const f = (ids: Set<number>) => [...ids].sort((a, b) => a - b)`,
    "core(no-native-sort)",
  ],
  [
    "Array.dedupe",
    `${effect}export const f = (xs: number[]) => Array.dedupe(xs)`,
    null,
  ],
  [
    "Set kept as a Set",
    `${effect}export const f = (xs: number[]) => new Set(xs)`,
    null,
  ],
  [
    "yield* in for-of",
    `${effect}export const f = (xs: number[]) => Effect.gen(function* () { const out: number[] = []; for (const x of xs) out.push(yield* Effect.succeed(x)); return out })`,
    "core(no-yield-in-loop)",
  ],
  [
    "yield* in while",
    `${effect}export const f = Effect.gen(function* () { let n = 0; while (n < 3) n += yield* Effect.succeed(1); return n })`,
    "core(no-yield-in-loop)",
  ],
  [
    "marked loop",
    `${effect}export const f = (xs: number[]) => Effect.gen(function* () {\n  // loop: stops at the first match\n  for (const x of xs) if ((yield* Effect.succeed(x)) > 1) return x\n  return 0\n})`,
    null,
  ],
  [
    "bare loop marker",
    `${effect}export const f = (xs: number[]) => Effect.gen(function* () {\n  // loop:\n  for (const x of xs) yield* Effect.succeed(x)\n})`,
    "core(no-yield-in-loop)",
  ],
  [
    "yield* of the iterable",
    `${effect}export const f = Effect.gen(function* () { let n = 0; for (const x of yield* Effect.succeed([1, 2])) n += x; return n })`,
    null,
  ],
  [
    "Effect.forEach",
    `${effect}export const f = (xs: number[]) => Effect.forEach(xs, (x) => Effect.succeed(x))`,
    null,
  ],
  // The shared config also turns on @effect/tsgo rules; this proves they reach the package.
  [
    "upstream rule through the shared config",
    `${effect}export const f = Effect.sync(() => Date.now())`,
    "effecttsgo(global-date-in-effect)",
  ],
  [
    "generator nested in a loop",
    `${effect}export const f = (xs: number[]) => { const out = []; for (const x of xs) out.push(Effect.gen(function* () { return yield* Effect.succeed(x) })); return out }`,
    null,
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
    const core = diagnostics.filter(
      (d) => d.severity === "error" && /^(core|effecttsgo)\(/.test(d.code)
    );
    if (expected)
      assert.ok(
        core.some((d) => d.code === expected),
        `${name}: ${result.stdout}`
      );
    else assert.equal(core.length, 0, `${name}: ${result.stdout}`);
  }
  logInfo(`${cases.length} effect core module lint cases passed`);
} finally {
  await rm(dir, { recursive: true, force: true });
}
