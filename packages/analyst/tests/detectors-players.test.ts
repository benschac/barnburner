import assert from "node:assert/strict";
import { join } from "node:path";
import { test } from "node:test";

import { Effect, Result, Schema } from "effect";

import { CardDraft } from "../src/card.ts";
import { openDb } from "../src/db.ts";
import { goalieStarts } from "../src/detectors/goalie-starts.ts";
import { pointsLeader } from "../src/detectors/points-leader.ts";
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

const detectors = {
  "points-leader": pointsLeader,
  "goalie-starts": goalieStarts,
};

for (const [label, detect] of Object.entries(detectors)) {
  test(`${label} draft is valid and renders on fixtures`, async () => {
    await withDb(async (db) => {
      const drafts = detect("NJD");
      assert.ok(drafts.length > 0);
      for (const draft of drafts) {
        Schema.decodeUnknownSync(CardDraft)(draft);
        assert.equal(draft.kind, "player");
        assert.deepEqual(literalDigits(draft.headline), []);
        assert.deepEqual(literalDigits(draft.body), []);
        const sqls = [
          draft.evidence.query,
          draft.evidence.gamesQuery,
          draft.assert,
        ].filter((s) => s !== undefined);
        for (const sql of sqls) {
          const g = await Effect.runPromise(guardQuery(db, sql));
          assert.equal(g.ok, true);
        }
        const { rows } = await Effect.runPromise(
          db.queryCanonical(draft.evidence.query)
        );
        const games = await Effect.runPromise(
          db.queryCanonical(
            draft.evidence.gamesQuery ?? "select 1 as game_id where false"
          )
        );
        assert.deepEqual(
          games.rows.map((r) => r.game_id),
          [2026020303, 2026020318]
        );
        Result.getOrThrow(render(draft.headline, draft.bindings, rows));
        const body = Result.getOrThrow(
          render(draft.body, draft.bindings, rows)
        );
        if (label === "goalie-starts") {
          assert.equal(
            body,
            "C. Hellebuyck started 2 of the 2 archived games for NJD."
          );
        } else {
          assert.match(
            body,
            /^.+ has \d+ points in the 2 archived games for NJD\.$/
          );
        }
      }
    });
  });
}

test("points-leader matches summed fixture points", async () => {
  await withDb(async (db) => {
    const [draft] = pointsLeader("NJD");
    assert.ok(draft);
    const { rows } = await Effect.runPromise(
      db.queryCanonical(draft.evidence.query)
    );
    assert.equal(rows.length, 1);
    const top = await Effect.runPromise(
      db.query(
        "select max(t) as m from (select sum(p) as t from skater_games where team = 'NJD' group by player_id)"
      )
    );
    assert.equal(Number(rows[0].points), Number(top.rows[0].m));
  });
});
