import assert from "node:assert/strict";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import { Effect } from "effect";

import type { CardDraft, InsightCard } from "../src/card.ts";
import { openDb } from "../src/db.ts";
import { guardQuery } from "../src/guard.ts";
import { fillCard } from "../src/tools/submit-card.ts";
import { makeVerify } from "../src/verify.ts";

const dataDir = fileURLToPath(new URL("./fixtures/data", import.meta.url));
const meta = {
  model: "m",
  runId: "r",
  asOf: { fetchedAt: "2026-11-15", completedGameIds: 3 },
};
const finals = new Set([2026020121, 2026020303, 2026020318]);

const record: CardDraft = {
  team: "NJD",
  kind: "record",
  headline: "NJD has {wins} wins",
  body: "Goal difference is {gd}.",
  bindings: { wins: { column: "wins", row: 0 }, gd: { column: "gd", row: 0 } },
  assert: "SELECT count(*) = 3 FROM team_games WHERE team = 'NJD' AND is_final",
  evidence: {
    query:
      "SELECT count(*) FILTER (WHERE gf > ga) AS wins, sum(gf - ga) AS gd FROM team_games WHERE team = 'NJD' AND is_final",
    gamesQuery:
      "SELECT game_id FROM team_games WHERE team = 'NJD' AND is_final ORDER BY game_id",
  },
};
const box: CardDraft = {
  team: "NJD",
  kind: "player",
  headline: "NJD skaters have {goals} goals",
  body: "Across archived box scores.",
  bindings: { goals: { column: "goals", row: 0 } },
  evidence: {
    query: "SELECT sum(g) AS goals FROM skater_games WHERE team = 'NJD'",
    gamesQuery:
      "SELECT DISTINCT game_id FROM skater_games WHERE team = 'NJD' ORDER BY game_id",
  },
};

const withDb = <A>(
  f: (db: Awaited<ReturnType<typeof open>>) => Promise<A>
): Promise<A> =>
  Effect.runPromise(
    Effect.scoped(
      Effect.flatMap(openDb({ dataDir }), (db) => Effect.promise(() => f(db)))
    )
  );
const open = () => Effect.runPromise(Effect.scoped(openDb({ dataDir })));

const mutate = (card: InsightCard, over: Record<string, unknown>): unknown => ({
  ...card,
  ...over,
});

test("passing and failing cards against the real guard and fixture database", async () => {
  await withDb(async (db) => {
    const deps = { db, guard: guardQuery };
    const verify = makeVerify(deps);
    const run = (c: unknown) => Effect.runPromise(verify(c, finals));
    const fill = (d: CardDraft) => Effect.runPromise(fillCard(deps, d, meta));
    const failed = async (c: unknown) => {
      const r = await run(c);
      return r.ok ? 0 : r.check;
    };

    const plain = await fill(record);
    assert.equal(plain.evidence.coverage, undefined);
    assert.deepEqual(await run(plain), { ok: true });

    const boxed = await fill(box);
    assert.ok(boxed.evidence.coverage !== undefined);
    assert.deepEqual(await run(boxed), { ok: true });

    // 1: does not decode
    assert.equal(await failed(mutate(plain, { kind: "bogus" })), 1);
    // 2: guard rejects the query
    assert.equal(
      await failed(
        mutate(plain, {
          evidence: { ...plain.evidence, query: "DROP TABLE team_games" },
        })
      ),
      2
    );
    // 3: placeholder without a binding
    assert.equal(
      await failed(mutate(plain, { body: "Goal difference is {missing}." })),
      3
    );
    // 4: literal digit
    assert.equal(
      await failed(
        mutate(plain, { headline: "NJD has {wins} wins in 3 games" })
      ),
      4
    );
    // 5: drifted result
    assert.equal(
      await failed(
        mutate(plain, {
          evidence: { ...plain.evidence, result: [{ wins: 99, gd: 4 }] },
        })
      ),
      5
    );
    // 6: wrong game ids, and a non-final game
    assert.equal(
      await failed(
        mutate(plain, {
          evidence: { ...plain.evidence, gameIds: [2026020121] },
        })
      ),
      6
    );
    const r = await Effect.runPromise(verify(plain, new Set([2026020121])));
    assert.equal(r.ok ? 0 : r.check, 6);
    // 7: wrong coverage
    assert.equal(
      await failed(
        mutate(boxed, {
          evidence: {
            ...boxed.evidence,
            coverage: { archived: 99, finals: 3 },
          },
        })
      ),
      7
    );
    // 8: false assert
    assert.equal(
      await failed(
        mutate(plain, {
          assert:
            "SELECT count(*) = 4 FROM team_games WHERE team = 'NJD' AND is_final",
        })
      ),
      8
    );
  });
});
