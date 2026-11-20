import assert from "node:assert/strict";
import { test } from "node:test";

import { Effect } from "effect";

import type { InsightCard } from "../src/card.ts";
import { SqlError } from "../src/shapes.ts";
import { coverageSql, verifyRerun } from "../src/verify-rerun.ts";
import { fakeDb } from "./fakes.ts";

const Q = "SELECT 1 AS wins";
const G = "SELECT game_id FROM games";
const A = "SELECT true";
const card = (
  over: Partial<InsightCard["evidence"]> & { assert?: string } = {}
): InsightCard => {
  const { assert: a, ...ev } = over;
  return {
    id: "x",
    status: "pending",
    team: "NJD",
    kind: "record",
    headline: "{wins}",
    body: "{wins}",
    bindings: { wins: { column: "wins", row: 0 } },
    ...(a === undefined ? {} : { assert: a }),
    evidence: { query: Q, result: [{ wins: 1 }], gameIds: [], ...ev },
    asOf: { fetchedAt: "t", completedGameIds: 1 },
    model: "m",
    runId: "r",
  };
};
const ctx = (touchesBoxscores = false, finals: number[] = [1, 2]) => ({
  touchesBoxscores,
  finals: new Set(finals),
});
const run = (db: ReturnType<typeof fakeDb>, c: InsightCard, x = ctx()) =>
  Effect.runPromise(verifyRerun({ db }, c, x));
const base = { [Q]: [{ wins: 1 }] };

test("passes a clean card", async () => {
  assert.deepEqual(await run(fakeDb(base), card()), { ok: true });
});

test("fails check 5 on drift and on SqlError", async () => {
  const drift = await run(fakeDb({ [Q]: [{ wins: 2 }] }), card());
  assert.equal(!drift.ok && drift.check, 5);
  const err = await run(
    fakeDb({ [Q]: new SqlError({ message: "boom", sql: Q }) }),
    card()
  );
  assert.deepEqual(err, { ok: false, check: 5, detail: "boom" });
});

test("check 5 ignores row key order but not values or row order", async () => {
  const stored = card({ result: [{ losses: 2, wins: 1 }] });
  assert.deepEqual(
    await run(fakeDb({ [Q]: [{ wins: 1, losses: 2 }] }), stored),
    { ok: true }
  );
  const differs = await run(fakeDb({ [Q]: [{ wins: 1, losses: 3 }] }), stored);
  assert.equal(!differs.ok && differs.check, 5);
  const two = card({ result: [{ n: 1 }, { n: 2 }] });
  const reordered = await run(fakeDb({ [Q]: [{ n: 2 }, { n: 1 }] }), two);
  assert.equal(!reordered.ok && reordered.check, 5);
});

test("check 6: changed game list, non-final game, gameIds without query", async () => {
  const c = card({ gamesQuery: G, gameIds: [1, 2] });
  assert.deepEqual(
    await run(fakeDb({ ...base, [G]: [{ game_id: 1 }, { game_id: 2 }] }), c),
    { ok: true }
  );
  const changed = await run(fakeDb({ ...base, [G]: [{ game_id: 1 }] }), c);
  assert.equal(!changed.ok && changed.check, 6);
  const nonFinal = await run(
    fakeDb({ ...base, [G]: [{ game_id: 1 }, { game_id: 2 }] }),
    c,
    ctx(false, [1])
  );
  assert.equal(!nonFinal.ok && nonFinal.check, 6);
  const stray = await run(fakeDb(base), card({ gameIds: [1] }));
  assert.equal(!stray.ok && stray.check, 6);
});

test("check 7: coverage matches, is wrong, or is on a non-boxscore card", async () => {
  const sql = coverageSql("NJD");
  assert.equal(
    sql,
    "SELECT archived, finals FROM boxscore_coverage WHERE team = 'NJD'"
  );
  const c = card({ coverage: { archived: 3, finals: 5 } });
  assert.deepEqual(
    await run(
      fakeDb({ ...base, [sql]: [{ archived: 3, finals: 5 }] }),
      c,
      ctx(true)
    ),
    { ok: true }
  );
  const wrong = await run(
    fakeDb({ ...base, [sql]: [{ archived: 4, finals: 5 }] }),
    c,
    ctx(true)
  );
  assert.equal(!wrong.ok && wrong.check, 7);
  const extra = await run(fakeDb(base), c, ctx(false));
  assert.equal(!extra.ok && extra.check, 7);
  const missing = await run(fakeDb(base), card(), ctx(true));
  assert.equal(!missing.ok && missing.check, 7);
});

test("check 8: assert must be a single true", async () => {
  assert.deepEqual(
    await run(fakeDb({ ...base, [A]: [{ ok: true }] }), card({ assert: A })),
    { ok: true }
  );
  for (const rows of [
    [{ ok: false }],
    [{ ok: 1 }],
    [{ a: true, b: true }],
    [],
    [{ ok: true }, { ok: true }],
  ]) {
    const r = await run(fakeDb({ ...base, [A]: rows }), card({ assert: A }));
    assert.equal(!r.ok && r.check, 8);
  }
});
