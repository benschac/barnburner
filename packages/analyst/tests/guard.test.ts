import assert from "node:assert/strict";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import { Effect } from "effect";

import { openDb } from "../src/db.ts";
import { guardQuery } from "../src/guard.ts";
import type { Db, GuardResult } from "../src/shapes.ts";

const dataDir = join(
  dirname(fileURLToPath(import.meta.url)),
  "fixtures",
  "data"
);

const withGuard = (
  run: (check: (sql: string) => Promise<GuardResult>) => Promise<void>
) =>
  Effect.runPromise(
    Effect.scoped(
      Effect.gen(function* () {
        const db: Db = yield* openDb({ dataDir });
        yield* Effect.promise(() =>
          run((sql) => Effect.runPromise(guardQuery(db, sql)))
        );
      })
    )
  );

const rejected = async (
  check: (sql: string) => Promise<GuardResult>,
  sql: string
) => {
  const result = await check(sql);
  assert.equal(result.ok, false, sql);
};

test("rejects multiple statements, non-SELECT statements, and parse errors", async () => {
  await withGuard(async (check) => {
    await rejected(check, "SELECT 1; SELECT 2");
    await rejected(check, "ATTACH 'x.db'");
    await rejected(check, "COPY team_games TO 'x.csv'");
    await rejected(check, "DROP TABLE team_games");
    await rejected(check, "SELEC nope");
  });
});

test("rejects table functions and file sources", async () => {
  await withGuard(async (check) => {
    await rejected(check, "SELECT * FROM read_json('x.json')");
    await rejected(check, "SELECT * FROM team_games, read_csv('x.csv')");
    await rejected(
      check,
      "SELECT * FROM (SELECT * FROM read_parquet('x.parquet')) q"
    );
    await rejected(check, "SELECT * FROM generate_series(1, 3)");
    await rejected(check, "SELECT * FROM 'x.csv'");
  });
});

test("rejects unknown and qualified tables, including inside subqueries", async () => {
  await withGuard(async (check) => {
    await rejected(check, "SELECT * FROM players");
    await rejected(
      check,
      "SELECT * FROM team_games WHERE team IN (SELECT team FROM secrets)"
    );
    await rejected(check, "SELECT (SELECT 1 FROM secrets)");
    await rejected(
      check,
      "SELECT * FROM team_games UNION SELECT * FROM secrets"
    );
    await rejected(check, "SELECT * FROM main.team_games");
    await rejected(check, "SELECT * FROM information_schema.tables");
  });
});

test("accepts plain selects, CTEs, subqueries, joins, and set operations", async () => {
  await withGuard(async (check) => {
    assert.deepEqual(
      await check("SELECT team, count(*) FROM team_games GROUP BY team"),
      { ok: true, touchesBoxscores: false }
    );
    assert.deepEqual(await check("SELECT 1"), {
      ok: true,
      touchesBoxscores: false,
    });
    assert.deepEqual(await check("SELECT 'it''s' AS s FROM team_games"), {
      ok: true,
      touchesBoxscores: false,
    });
    assert.deepEqual(
      await check(
        "WITH a AS (SELECT team FROM team_games), b AS (SELECT * FROM a) SELECT * FROM b JOIN standings_daily s USING (team)"
      ),
      { ok: true, touchesBoxscores: false }
    );
    assert.deepEqual(
      await check(
        "SELECT * FROM (SELECT team FROM boxscore_coverage) q WHERE team IN (SELECT team FROM team_games)"
      ),
      {
        ok: true,
        touchesBoxscores: false,
      }
    );
    assert.deepEqual(
      await check(
        "SELECT team FROM team_games UNION ALL SELECT team FROM standings_daily"
      ),
      { ok: true, touchesBoxscores: false }
    );
    assert.deepEqual(
      await check(
        "WITH RECURSIVE r AS (SELECT 1 AS n UNION ALL SELECT n + 1 FROM r WHERE n < 3) SELECT * FROM r"
      ),
      { ok: true, touchesBoxscores: false }
    );
  });
});

test("touchesBoxscores is true wherever a boxscore table is read", async () => {
  await withGuard(async (check) => {
    assert.deepEqual(await check("SELECT * FROM skater_games"), {
      ok: true,
      touchesBoxscores: true,
    });
    assert.deepEqual(
      await check(
        "WITH x AS (SELECT * FROM goalie_games) SELECT count(*) FROM x"
      ),
      { ok: true, touchesBoxscores: true }
    );
    assert.deepEqual(
      await check(
        "WITH x AS (SELECT * FROM goalie_games), y AS (SELECT * FROM x) SELECT * FROM y"
      ),
      {
        ok: true,
        touchesBoxscores: true,
      }
    );
    assert.deepEqual(
      await check(
        "SELECT * FROM team_games WHERE game_id IN (SELECT game_id FROM skater_games)"
      ),
      {
        ok: true,
        touchesBoxscores: true,
      }
    );
    assert.deepEqual(await check("SELECT (SELECT max(g) FROM skater_games)"), {
      ok: true,
      touchesBoxscores: true,
    });
  });
});

test("CTE names are only visible inside their own query scope", async () => {
  await withGuard(async (check) => {
    await rejected(
      check,
      "WITH unused AS (WITH sqlite_master AS (SELECT 1) SELECT 1) SELECT * FROM sqlite_master"
    );
    await rejected(
      check,
      "WITH a AS (SELECT 1 AS n), b AS (SELECT * FROM c), c AS (SELECT 1 AS n) SELECT * FROM b"
    );
    await rejected(check, "WITH x AS (SELECT * FROM x) SELECT * FROM x");
    assert.deepEqual(
      await check(
        "WITH a AS (WITH inner_cte AS (SELECT 1 AS n) SELECT * FROM inner_cte) SELECT * FROM a"
      ),
      {
        ok: true,
        touchesBoxscores: false,
      }
    );
    assert.deepEqual(
      await check(
        "SELECT * FROM (WITH q AS (SELECT 1 AS n) SELECT * FROM q) t"
      ),
      { ok: true, touchesBoxscores: false }
    );
  });
});

test("a CTE shadowing a boxscore table does not count as reading boxscores", async () => {
  await withGuard(async (check) => {
    assert.deepEqual(
      await check(
        "WITH skater_games AS (SELECT * FROM team_games) SELECT count(*) FROM skater_games"
      ),
      {
        ok: true,
        touchesBoxscores: false,
      }
    );
    assert.deepEqual(
      await check(
        "WITH skater_games AS (SELECT * FROM skater_games) SELECT count(*) FROM skater_games"
      ),
      {
        ok: true,
        touchesBoxscores: true,
      }
    );
  });
});
