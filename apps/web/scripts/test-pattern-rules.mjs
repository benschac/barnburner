import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { logInfo } from "../../../lib/logger.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const dir = await mkdtemp(`${root}src/pattern-rule-test-`);
const cases = [
  [
    "server import",
    'import { ApiRoutes } from "../../api/src/routes.ts"; export { ApiRoutes };',
    "eslint(no-restricted-imports)",
  ],
  [
    "server export",
    'export { ApiRoutes } from "../../api/src/routes.ts";',
    "eslint(no-restricted-imports)",
  ],
  [
    "raw box-score archive",
    'import box from "../../../data/boxscores/20262027/2026020201.json"; export { box };',
    "eslint(no-restricted-imports)",
  ],
  [
    "shared contract",
    'export { TeamRpcs } from "@nhl-reddit-stats/season/rpc";',
    null,
  ],
  [
    "shared binding",
    'let selectedTeam = "NJD"; export { selectedTeam };',
    "patterns(no-module-mutable-state)",
  ],
  [
    "exported binding",
    'export let selectedTeam = "NJD";',
    "patterns(no-module-mutable-state)",
  ],
  ["constant", 'export const selectedTeam = "NJD";', null],
  [
    "local binding",
    'export function select() { let team = "NJD"; team = "TOR"; return team; }',
    null,
  ],
  [
    "inline effect",
    "enq(() => Effect.succeed(1));",
    "xstate-effect(no-inline-effect)",
  ],
  [
    "inline actor",
    "enq.spawn(createEffectLogic({}));",
    "xstate-effect(no-inline-effect)",
  ],
  ["declared action", "enq(args.actions.load, args);", null],
];

try {
  for (const [name, source, expected] of cases) {
    const file = `${dir}/case.ts`;
    await writeFile(file, source);
    const result = spawnSync(
      `${root}../../node_modules/.bin/effect-tsgo`,
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
  logInfo(`${cases.length} actor-pattern lint cases passed`);
} finally {
  await rm(dir, { recursive: true, force: true });
}
