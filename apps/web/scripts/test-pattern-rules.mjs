import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, writeFile, rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { logInfo } from "../../../lib/logger.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const fixtureRoot = await mkdtemp(`${root}.lint-fixtures-web-`);
const dir = `${fixtureRoot}/src`;
await mkdir(dir);
// Only the rules these cases prove count. A fixture is a bare snippet, so the other rules in the
// package config (anti-slop, Ultracite) report on it for reasons unrelated to the case.
const CHECKED = /^(patterns\(|xstate-effect\(|eslint\(no-restricted-imports\))/;
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
  const files = [];
  for (const [index, [name, source, expected]] of cases.entries()) {
    const file = `${dir}/case-${index}.ts`;
    await writeFile(file, source);
    files.push({ name, expected, file, relative: file.slice(root.length) });
  }
  const tsconfig = `${fixtureRoot}/tsconfig.json`;
  await writeFile(
    tsconfig,
    JSON.stringify({
      extends: "../tsconfig.app.json",
      files: files.map(({ file }) => file.slice(fixtureRoot.length + 1)),
      include: [],
      exclude: [],
      references: [],
    })
  );
  const result = spawnSync(
    `${root}../../node_modules/.bin/effect-tsgo`,
    [
      "--tsrs-lint",
      "oxlint",
      "--config",
      "oxlint.fixtures.config.ts",
      "--no-ignore",
      "--tsconfig",
      tsconfig,
      "--format",
      "json",
      ...files.map(({ file }) => file),
    ],
    { cwd: root, encoding: "utf-8" }
  );
  assert.equal(result.error, undefined, "batch lint failed to start");
  const { diagnostics, number_of_files: linted } = JSON.parse(result.stdout);
  assert.equal(linted, files.length, "every fixture must be linted");
  assert.ok(
    !diagnostics.some((d) => d.message.includes("Error running JS plugin")),
    "plugin crashed"
  );
  assert.equal(
    result.status,
    diagnostics.some((d) => d.severity === "error") ? 1 : 0,
    "wrong batch process status"
  );
  const byFile = new Map(files.map(({ relative }) => [relative, []]));
  for (const diagnostic of diagnostics) {
    const found = byFile.get(diagnostic.filename);
    assert.ok(found, `unexpected diagnostic file: ${diagnostic.filename}`);
    found.push(diagnostic);
  }
  for (const { name, expected, relative } of files) {
    const found = byFile.get(relative);
    assert.ok(found, `${name}: missing fixture`);
    // anti-slop rules also report on the fixture, a new file; count only the rules under test.
    const errors = found.filter(
      (d) => d.severity === "error" && CHECKED.test(d.code)
    );
    if (expected)
      assert.ok(
        errors.some((d) => d.code === expected),
        `${name}: ${JSON.stringify(found)}`
      );
    else assert.equal(errors.length, 0, `${name}: ${JSON.stringify(found)}`);
  }
  logInfo(`${cases.length} actor-pattern lint cases passed`);
} finally {
  await rm(fixtureRoot, { recursive: true, force: true });
}
