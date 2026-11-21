import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  copyFile,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repository = fileURLToPath(new URL("../", import.meta.url));
const turbo = join(repository, "node_modules/.bin/turbo");
const fixtureTasks = [
  "lint:core",
  "lint:unions",
  "lint:design",
  "lint:patterns",
  "lint:xstate",
];
const workspaces = [
  "apps/api",
  "apps/web",
  "packages/analyst",
  "packages/history",
  "packages/season",
  "packages/viz",
];
const representativeFiles = [
  ".gitignore",
  "turbo.json",
  "package.json",
  "bun.lock",
  "lib/logger.mjs",
  "lib/logger.d.mts",
  "lint/oxlint.ts",
  "lint/ultracite.ts",
  "lint/effect-core.oxlintrc.json",
  "lint/anti-slop.oxlintrc.json",
  "lint/effect-core-plugin.mjs",
  "lint/union-model-plugin.mjs",
  "scripts/test-effect-core-rules.mjs",
  "scripts/test-union-rules.mjs",
  "apps/web/scripts/test-design-rules.mjs",
  "apps/web/scripts/test-pattern-rules.mjs",
  "apps/web/scripts/test-xstate-rules.mjs",
  "apps/web/scripts/check-design-files.mjs",
  "apps/web/lint/design-plugin.mjs",
  "apps/web/lint/patterns-plugin.mjs",
  "apps/web/lint/xstate-plugin.mjs",
  "apps/web/design/contract.json",
  "apps/web/tamagui.config.ts",
  "apps/web/src/App.tsx",
  "packages/season/src/contracts.ts",
  "data/teams.json",
  "data/nhl-20262027.json",
  "data/history/serving.json",
  "tests/lint-task-graph.test.mjs",
];

async function copyIfPresent(root, file) {
  const target = join(root, file);
  await mkdir(dirname(target), { recursive: true });
  try {
    await copyFile(join(repository, file), target);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}

async function miniatureMonorepo(t) {
  const root = await mkdtemp(join(tmpdir(), "nhl-lint-task-graph-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  await Promise.all(
    representativeFiles.map((file) => copyIfPresent(root, file))
  );
  for (const workspace of workspaces) {
    const files = await readdir(join(repository, workspace));
    await Promise.all(
      files
        .filter(
          (file) =>
            file === "package.json" ||
            file === "turbo.json" ||
            /^tsconfig.*\.json$/.test(file) ||
            /^oxlint.*\.config\.ts$/.test(file)
        )
        .map((file) => copyIfPresent(root, `${workspace}/${file}`))
    );
  }
  return root;
}

function taskHashes(root) {
  const result = spawnSync(
    turbo,
    ["run", ...fixtureTasks, "build", "typecheck", "--dry=json", "--no-daemon"],
    { cwd: root, encoding: "utf8", timeout: 30_000 }
  );
  assert.equal(result.error, undefined, "Turbo dry run failed to start");
  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(result.stdout);
  return new Map(
    report.tasks
      .filter(({ command }) => command !== "<NONEXISTENT>")
      .map(({ taskId, hash }) => [taskId, hash])
  );
}

function hashOf(hashes, id) {
  const hash = hashes.get(id);
  assert.ok(hash, `missing task: ${id}`);
  return hash;
}

function ruleHashes(hashes) {
  return new Map(
    [...hashes].filter(([id]) => fixtureTasks.includes(id.split("#")[1]))
  );
}

async function afterEditing(root, file) {
  const path = join(root, file);
  const original = await readFile(path, "utf8");
  try {
    await writeFile(path, `${original}\n `);
    return taskHashes(root);
  } finally {
    await writeFile(path, original);
  }
}

test("rule caches follow shared plugins and workspace compiler settings", async (t) => {
  const root = await miniatureMonorepo(t);
  const before = taskHashes(root);
  const pluginEdit = await afterEditing(root, "lint/effect-core-plugin.mjs");
  const fixtures = ruleHashes(before);
  assert.ok(fixtures.size > 0, "expected cached rule tasks");
  for (const [id, hash] of fixtures) {
    assert.notEqual(
      hashOf(pluginEdit, id),
      hash,
      `${id}: stale shared-plugin hash`
    );
  }

  const configEdit = await afterEditing(root, "packages/history/tsconfig.json");
  for (const task of ["lint:core", "lint:unions"]) {
    const id = `@nhl-reddit-stats/history#${task}`;
    assert.notEqual(hashOf(configEdit, id), hashOf(before, id), id);
  }
  const webCore = "@nhl-reddit-stats/web#lint:core";
  assert.equal(hashOf(configEdit, webCore), hashOf(before, webCore));
  const contractEdit = await afterEditing(
    root,
    "apps/web/design/contract.json"
  );
  assert.notEqual(hashOf(contractEdit, webCore), hashOf(before, webCore));
});

test("application and NHL data edits spare rule caches and invalidate runtime checks", async (t) => {
  const root = await miniatureMonorepo(t);
  const before = taskHashes(root);
  const appEdit = await afterEditing(root, "apps/web/src/App.tsx");
  assert.deepEqual(ruleHashes(appEdit), ruleHashes(before));
  for (const task of ["build", "typecheck"]) {
    const id = `@nhl-reddit-stats/web#${task}`;
    assert.notEqual(hashOf(appEdit, id), hashOf(before, id), id);
  }

  const dataEdit = await afterEditing(root, "data/nhl-20262027.json");
  assert.deepEqual(ruleHashes(dataEdit), ruleHashes(before));
  for (const task of ["build", "typecheck"]) {
    const id = `@nhl-reddit-stats/web#${task}`;
    assert.notEqual(hashOf(dataEdit, id), hashOf(before, id), id);
  }
});

test("actor-pattern cache follows the season source and team registry imported by its fixtures", async (t) => {
  const root = await miniatureMonorepo(t);
  const before = taskHashes(root);
  const after = await afterEditing(root, "packages/season/src/contracts.ts");
  const patterns = "@nhl-reddit-stats/web#lint:patterns";
  assert.notEqual(hashOf(after, patterns), hashOf(before, patterns));
  const core = "@nhl-reddit-stats/web#lint:core";
  assert.equal(hashOf(after, core), hashOf(before, core));
  const teamEdit = await afterEditing(root, "data/teams.json");
  assert.notEqual(hashOf(teamEdit, patterns), hashOf(before, patterns));
});
