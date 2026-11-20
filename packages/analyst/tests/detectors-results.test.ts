import assert from "node:assert/strict";
import { join } from "node:path";
import { test } from "node:test";

import { Effect, Result, Schema } from "effect";

import { CardDraft } from "../src/card.ts";
import { openDb } from "../src/db.ts";
import { extraTime } from "../src/detectors/extra-time.ts";
import { homeAway } from "../src/detectors/home-away.ts";
import { oneGoal } from "../src/detectors/one-goal.ts";
import { guardQuery } from "../src/guard.ts";
import { literalDigits, render } from "../src/render.ts";
import type { Db } from "../src/shapes.ts";

const dataDir = join(import.meta.dirname, "fixtures", "data");

const withDb = (run: (db: Db) => Promise<void>): Promise<void> =>
  Effect.runPromise(
    Effect.scoped(
      Effect.gen(function* () {
        const db = yield* openDb({ dataDir });
        yield* Effect.promise(() => run(db));
      })
    )
  );

const check = async (db: Db, make: (team: string) => CardDraft[]) => {
  const drafts = make("NJD");
  assert.equal(drafts.length, 1);
  const draft = Schema.decodeUnknownSync(CardDraft)(drafts[0]);
  assert.deepEqual(literalDigits(draft.headline), []);
  assert.deepEqual(literalDigits(draft.body), []);
  for (const sql of [draft.evidence.query, draft.evidence.gamesQuery ?? ""]) {
    const g = await Effect.runPromise(guardQuery(db, sql));
    assert.equal(g.ok, true, sql);
  }
  const { rows } = await Effect.runPromise(
    db.queryCanonical(draft.evidence.query)
  );
  const games = await Effect.runPromise(
    db.queryCanonical(draft.evidence.gamesQuery ?? "")
  );
  assert.deepEqual(Object.keys(games.rows[0] ?? { game_id: 0 }), ["game_id"]);
  return {
    headline: Result.getOrThrow(render(draft.headline, draft.bindings, rows)),
    body: Result.getOrThrow(render(draft.body, draft.bindings, rows)),
    gameIds: games.rows.map((r) => r.game_id),
  };
};

test("one-goal: NJD fixture", async () => {
  await withDb(async (db) => {
    const out = await check(db, oneGoal);
    assert.equal(out.headline, "NJD are 0 and 0 in one-goal games");
    assert.match(out.body, /^0 of 3 games/);
    assert.deepEqual(out.gameIds, []);
  });
});

test("home-away: NJD fixture", async () => {
  await withDb(async (db) => {
    const out = await check(db, homeAway);
    assert.equal(
      out.headline,
      "NJD have won 1 of 1 at home and 1 of 2 on the road"
    );
    assert.equal(out.gameIds.length, 3);
  });
});

test("extra-time: NJD fixture", async () => {
  await withDb(async (db) => {
    const out = await check(db, extraTime);
    assert.equal(out.headline, "NJD have played 0 games past regulation");
    assert.match(out.body, /out of 3 games in all\.$/);
    assert.deepEqual(out.gameIds, []);
  });
});
