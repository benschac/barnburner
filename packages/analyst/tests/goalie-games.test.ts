import assert from "node:assert/strict";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import { Effect } from "effect";

import { openDb } from "../src/db.ts";
import { VIEWS } from "../src/shapes.ts";
import type { Db } from "../src/shapes.ts";

const here = dirname(fileURLToPath(import.meta.url));
const viewsDir = join(here, "..", "src", "views");
const dataDir = join(here, "fixtures", "data");

const withDb = (run: (db: Db) => Promise<void>): Promise<void> =>
  Effect.runPromise(
    Effect.scoped(
      Effect.gen(function* () {
        const db = yield* openDb({ dataDir, viewsDir });
        yield* Effect.promise(() => run(db));
      })
    )
  );

const q = (db: Db, sql: string) => Effect.runPromise(db.query(sql));

test("goalie_games columns match the contract", async () => {
  await withDb(async (db) => {
    const { rows } = await q(db, "select * from goalie_games limit 1");
    assert.deepEqual(Object.keys(rows[0] ?? {}), [...VIEWS.goalie_games]);
  });
});

test("goalie_games has one row per goalie per archived game", async () => {
  await withDb(async (db) => {
    assert.equal(
      (await q(db, "select count(*) as c from goalie_games")).rows[0]?.c,
      8
    );
    assert.equal(
      (await q(db, "select count(*) as c from goalie_games where starter"))
        .rows[0]?.c,
      4
    );
  });
});

test("goalie_games matches hand-computed box score numbers", async () => {
  await withDb(async (db) => {
    const { rows } = await q(
      db,
      "select team, opp, name, starter, decision, shots_against, saves, ga, toi_sec from goalie_games where game_id = 2026020303 and shots_against > 0 order by team"
    );
    assert.deepEqual(rows, [
      {
        team: "NJD",
        opp: "WSH",
        name: "C. Hellebuyck",
        starter: true,
        decision: "W",
        shots_against: 28,
        saves: 26,
        ga: 2,
        toi_sec: 3600,
      },
      {
        team: "WSH",
        opp: "NJD",
        name: "L. Thompson",
        starter: true,
        decision: "L",
        shots_against: 28,
        saves: 24,
        ga: 4,
        toi_sec: 58 * 60 + 10,
      },
    ]);
    const second = (
      await q(
        db,
        "select shots_against, saves, ga from goalie_games where game_id = 2026020318 and name = 'C. Hellebuyck'"
      )
    ).rows;
    assert.deepEqual(second, [{ shots_against: 47, saves: 43, ga: 4 }]);
  });
});

test("backups have no shots and null save_pct and decision", async () => {
  await withDb(async (db) => {
    const { rows } = await q(
      db,
      "select starter, decision, shots_against, save_pct, toi_sec from goalie_games where name = 'C. Lindgren' and game_id = 2026020303"
    );
    assert.deepEqual(rows, [
      {
        starter: false,
        decision: null,
        shots_against: 0,
        save_pct: null,
        toi_sec: 0,
      },
    ]);
    const thompson = (
      await q(
        db,
        "select save_pct from goalie_games where name = 'L. Thompson' and game_id = 2026020303"
      )
    ).rows[0];
    assert.ok(Math.abs(Number(thompson?.save_pct) - 0.857143) < 1e-6);
  });
});
