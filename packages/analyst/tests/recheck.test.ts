import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import { Effect, Result } from "effect";

import { runRecheck } from "../scripts/recheck-insights.ts";
import type { InsightCard } from "../src/card.ts";
import { recheck } from "../src/recheck.ts";
import { SqlError } from "../src/shapes.ts";
import { readCards, writeCards } from "../src/store.ts";
import { fakeDb, fakeGuard } from "./fakes.ts";

const Q = "SELECT 1 AS wins";
const G = "SELECT game_id FROM games";
const A = "SELECT true";
const ctx = {
  finals: new Set([1, 2, 3]),
  asOf: { fetchedAt: "new", completedGameIds: 3 },
};
const guard = fakeGuard({ ok: true, touchesBoxscores: false });

const card = (over: Partial<InsightCard> = {}): InsightCard => ({
  id: "x",
  status: "approved",
  team: "NJD",
  kind: "record",
  headline: "{wins} wins",
  body: "Done",
  bindings: { wins: { column: "wins", row: 0 } },
  evidence: { query: Q, gamesQuery: G, result: [{ wins: 1 }], gameIds: [1, 2] },
  asOf: { fetchedAt: "old", completedGameIds: 2 },
  model: "m",
  runId: "r",
  ...over,
});
const run = (
  responses: Parameters<typeof fakeDb>[0],
  c: InsightCard,
  g = guard
) => Effect.runPromise(recheck({ db: fakeDb(responses), guard: g }, c, ctx));
const base = { [Q]: [{ wins: 1 }], [G]: [{ game_id: 1 }, { game_id: 2 }] };

test("unchanged when the rerun matches", async () => {
  const c = card();
  const r = await run(base, c);
  assert.equal(r.change, "unchanged");
  assert.equal(r.card, c);
});

test("non-approved cards are returned unchanged", async () => {
  const c = card({ status: "pending" });
  assert.equal((await run({}, c)).card, c);
});

test("refreshes a changed result and asOf and stays approved", async () => {
  const r = await run(
    { [Q]: [{ wins: 2 }], [G]: [{ game_id: 1 }, { game_id: 3 }] },
    card()
  );
  assert.equal(r.change, "refreshed");
  assert.equal(r.card.status, "approved");
  assert.deepEqual(r.card.evidence.result, [{ wins: 2 }]);
  assert.deepEqual(r.card.evidence.gameIds, [1, 3]);
  assert.deepEqual(r.card.asOf, ctx.asOf);
});

test("refreshes with an assert that still holds", async () => {
  const r = await run(
    { ...base, [Q]: [{ wins: 5 }], [A]: [{ ok: true }] },
    card({ assert: A })
  );
  assert.equal(r.change, "refreshed");
});

test("stale when assert fails", async () => {
  const r = await run({ ...base, [A]: [{ ok: false }] }, card({ assert: A }));
  assert.equal(r.change, "stale");
  assert.equal(r.card.status, "stale");
});

test("stale when a query errors", async () => {
  const r = await run(
    { ...base, [Q]: new SqlError({ message: "boom", sql: Q }) },
    card()
  );
  assert.equal(r.change, "stale");
  assert.match(r.reason ?? "", /boom/);
});

test("stale when a placeholder no longer resolves", async () => {
  const r = await run({ ...base, [Q]: [] }, card());
  assert.equal(r.change, "stale");
  assert.match(
    r.reason ?? "",
    /\{wins\} needs a value at row 0, column "wins"/
  );
});

test("stale when a game is not final", async () => {
  const r = await run({ ...base, [G]: [{ game_id: 9 }] }, card());
  assert.equal(r.change, "stale");
  assert.match(r.reason ?? "", /not final/);
});

test("stale when the guard rejects", async () => {
  const r = await run(base, card(), fakeGuard({ ok: false, reason: "nope" }));
  assert.equal(r.change, "stale");
  assert.equal(r.reason, "guard rejected query: nope");
});

test("runRecheck rewrites only changed files", async () => {
  const dir = mkdtempSync(join(tmpdir(), "recheck-"));
  writeCards(dir, "NJD", [card()]);
  writeCards(dir, "NYR", [card({ team: "NYR", id: "y" })]);
  const before = statSync(join(dir, "NJD.json")).mtimeMs;
  const db = fakeDb({
    [Q]: [{ wins: 1 }],
    [G]: [{ game_id: 1 }, { game_id: 2 }],
  });
  // NYR shares the queries, so both are unchanged first.
  assert.deepEqual(
    await Effect.runPromise(runRecheck({ dir, deps: { db, guard }, ctx })),
    { unchanged: 2, refreshed: 0, stale: 0 }
  );
  assert.equal(statSync(join(dir, "NJD.json")).mtimeMs, before);
  const db2 = fakeDb({
    [Q]: [{ wins: 4 }],
    [G]: [{ game_id: 1 }, { game_id: 2 }],
  });
  const summary = await Effect.runPromise(
    runRecheck({ dir, deps: { db: db2, guard }, ctx })
  );
  assert.deepEqual(summary, { unchanged: 0, refreshed: 2, stale: 0 });
  assert.deepEqual(
    Result.getOrThrow(readCards(dir, "NJD"))[0]?.evidence.result,
    [{ wins: 4 }]
  );
  assert.ok(readFileSync(join(dir, "NYR.json"), "utf8").includes('"wins": 4'));
});

test("runRecheck fails with StoreError on an unreadable team file", async () => {
  const dir = mkdtempSync(join(tmpdir(), "recheck-"));
  writeFileSync(join(dir, "NJD.json"), "{not json");
  const result = await Effect.runPromise(
    Effect.result(runRecheck({ dir, deps: { db: fakeDb({}), guard }, ctx }))
  );
  assert.ok(Result.isFailure(result));
  assert.equal(result.failure._tag, "StoreError");
  assert.equal(result.failure.team, "NJD");
});
