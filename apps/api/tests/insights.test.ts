import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import { NodeServices } from "@effect/platform-node";
import type { InsightCard } from "@nhl-reddit-stats/analyst/card";
import { SnapshotLoadError } from "@nhl-reddit-stats/season/rpc";
import { Effect, FileSystem } from "effect";

import {
  archiveInsights,
  filesInsights,
  loadPublishedInsights,
} from "../src/insights.ts";

const card = (
  status: InsightCard["status"],
  id: string,
  extra: Partial<Pick<InsightCard, "bindings" | "review">> = {}
) => ({
  id,
  status,
  team: "TOR",
  kind: "record",
  headline: "{wins} wins in {games}",
  body: "Toronto has {wins} wins.",
  bindings: {
    wins: { column: "wins", row: 0 },
    games: { column: "games", row: 0 },
  },
  evidence: {
    query: "select 5 as wins, 8 as games",
    result: [{ wins: 5, games: 8 }],
    gameIds: [1, 2],
  },
  asOf: { fetchedAt: "2026-11-17T00:00:00Z", completedGameIds: 8 },
  model: "test",
  runId: "run",
  ...extra,
});

const load = (directory: string, teams: string[]) =>
  Effect.runPromise(
    Effect.flatMap(FileSystem.FileSystem, (fs) =>
      loadPublishedInsights(filesInsights(fs, directory), teams)
    ).pipe(Effect.provide(NodeServices.layer))
  );

test("only approved cards are served, with headline and body rendered", async () => {
  const root = await mkdtemp(join(tmpdir(), "insights-"));

  try {
    await writeFile(
      join(root, "TOR.json"),
      JSON.stringify([
        card("pending", "a"),
        card("approved", "b"),
        card("rejected", "c", {
          review: { by: "ben", at: "x", reason: "wrong" },
        }),
        card("stale", "d"),
      ])
    );
    const result = await load(root, ["TOR", "MTL"]);
    assert.equal(result.length, 1);
    assert.equal(result[0].headline, "5 wins in 8");
    assert.equal(result[0].body, "Toronto has 5 wins.");
    assert.deepEqual(result[0].gameIds, [1, 2]);
    assert.equal(result[0].query, "select 5 as wins, 8 as games");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("a missing file or directory means no insights, while a present null file fails", async () => {
  const root = await mkdtemp(join(tmpdir(), "insights-"));

  try {
    assert.deepEqual(await load(root, ["TOR"]), []);
    assert.deepEqual(await load(join(root, "absent"), ["TOR"]), []);
    await writeFile(join(root, "TOR.json"), "null");
    await assert.rejects(load(root, ["TOR"]), SnapshotLoadError);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("an approved card that cannot render is dropped; an unreadable file fails the load", async () => {
  const root = await mkdtemp(join(tmpdir(), "insights-"));

  try {
    await mkdir(root, { recursive: true });
    await writeFile(
      join(root, "TOR.json"),
      JSON.stringify([card("approved", "b", { bindings: {} })])
    );
    assert.deepEqual(await load(root, ["TOR"]), []);
    await writeFile(join(root, "TOR.json"), "{not json");
    await assert.rejects(load(root, ["TOR"]));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("the archive distinguishes a missing team from a null card file", async () => {
  const reader = archiveInsights({
    TOR: () => Promise.resolve({ default: null }),
  });

  assert.deepEqual(
    await Effect.runPromise(loadPublishedInsights(reader, ["MTL"])),
    []
  );
  await assert.rejects(
    Effect.runPromise(loadPublishedInsights(reader, ["TOR"])),
    SnapshotLoadError
  );
});
