import assert from "node:assert/strict";
import { test } from "node:test";

import { Effect } from "effect";

import { cardId } from "../src/card.ts";
import type { Guard } from "../src/shapes.ts";
import { verifyStatic } from "../src/verify-static.ts";
import { fakeDb, fakeGuard } from "./fakes.ts";

const base = () => ({
  id: cardId("BOS", "select 1", "h"),
  status: "pending",
  team: "BOS",
  kind: "record",
  headline: "{team} lead",
  body: "They have {wins} wins",
  bindings: {
    team: { column: "team", row: 0 },
    wins: { column: "wins", row: 0 },
  },
  evidence: {
    query: "select 1",
    result: [{ team: "Boston", wins: 5 }],
    gameIds: [],
  },
  asOf: { fetchedAt: "2026-11-16T00:00:00Z", completedGameIds: 3 },
  model: "m",
  runId: "r",
});

const run = (
  card: unknown,
  guard: Guard = fakeGuard({ ok: true, touchesBoxscores: true })
) => Effect.runPromise(verifyStatic({ db: fakeDb({}), guard }, card));

test("a good card passes and reports touchesBoxscores", async () => {
  const r = await run(base());
  assert.equal(r.ok, true);
  if (r.ok) assert.equal(r.touchesBoxscores, true);
});

test("check 1: undecodable card", async () => {
  const r = await run({ ...base(), kind: "nope" });
  assert.deepEqual(!r.ok && r.check, 1);
});

test("check 2: guard rejects query, gamesQuery or assert", async () => {
  const bad =
    (needle: string): Guard =>
    (_db, sql) =>
      Effect.succeed(
        sql === needle
          ? { ok: false, reason: "nope" }
          : { ok: true, touchesBoxscores: false }
      );
  const b = base();
  const r1 = await run(b, bad("select 1"));
  assert.deepEqual(!r1.ok && [r1.check, r1.detail], [2, "query: nope"]);
  const withGames = {
    ...b,
    evidence: { ...b.evidence, gamesQuery: "select game_id" },
  };
  const r2 = await run(withGames, bad("select game_id"));
  assert.deepEqual(!r2.ok && [r2.check, r2.detail], [2, "gamesQuery: nope"]);
  const r3 = await run({ ...b, assert: "select true" }, bad("select true"));
  assert.deepEqual(!r3.ok && [r3.check, r3.detail], [2, "assert: nope"]);
});

test("check 3: unknown placeholder or missing cell", async () => {
  const r1 = await run({ ...base(), body: "{missing} wins" });
  assert.equal(!r1.ok && r1.check, 3);
  const r2 = await run({
    ...base(),
    bindings: { ...base().bindings, wins: { column: "wins", row: 9 } },
  });
  assert.equal(!r2.ok && r2.check, 3);
});

test("check 4: literal digits", async () => {
  const r = await run({ ...base(), headline: "{team} won 5" });
  assert.equal(!r.ok && r.check, 4);
});
