import { test } from 'node:test'
import assert from 'node:assert/strict'
import { join } from 'node:path'
import { Effect } from 'effect'
import { openDb } from '../src/db.ts'
import { VIEWS } from '../src/shapes.ts'
import type { Db } from '../src/shapes.ts'

const here = import.meta.dirname
const withDb = (run: (db: Db) => Promise<void>): Promise<void> =>
  Effect.runPromise(
    Effect.scoped(
      Effect.gen(function* () {
        const db = yield* openDb({ dataDir: join(here, 'fixtures/data'), viewsDir: join(here, '../src/views') })
        yield* Effect.promise(() => run(db))
      }),
    ),
  )
const q = (db: Db, sql: string) => Effect.runPromise(db.query(sql))

test('skater_games columns match the contract', async () => {
  await withDb(async (db) => {
    const { rows } = await q(db, "select column_name from information_schema.columns where table_name = 'skater_games' order by ordinal_position")
    assert.deepEqual(rows.map((r) => r.column_name), [...VIEWS.skater_games])
  })
})

test('skater_games has 36 skaters per archived game, forwards and defense', async () => {
  await withDb(async (db) => {
    const { rows } = await q(db, 'select game_id, count(*) as n from skater_games group by game_id order by game_id')
    assert.deepEqual(rows.map((r) => [r.game_id, r.n]), [[2026020303, 36], [2026020318, 36]])
    const pos = await q(db, 'select distinct pos from skater_games order by pos')
    const set = pos.rows.map((r) => r.pos)
    assert.ok(set.includes('D'))
    assert.ok(set.some((p) => p === 'C' || p === 'L' || p === 'R'))
    const per = await q(db, "select team, count(*) filter (where pos = 'D') as d, count(*) filter (where pos <> 'D') as f from skater_games where game_id = 2026020303 group by team order by team")
    assert.deepEqual(per.rows.map((r) => [r.team, r.d, r.f]), [['NJD', 6, 12], ['WSH', 6, 12]])
  })
})

test('skater_games fills opp, parses toi and matches goals', async () => {
  await withDb(async (db) => {
    const opp = await q(db, "select team, opp, count(*) as n from skater_games where game_id = 2026020303 group by team, opp order by team")
    assert.deepEqual(opp.rows.map((r) => [r.team, r.opp, r.n]), [['NJD', 'WSH', 18], ['WSH', 'NJD', 18]])
    const bad = await q(db, 'select count(*) as c from skater_games where toi_sec is null or toi_sec <= 0 or toi_sec > 3600 or opp is null or opp = team')
    assert.equal(bad.rows[0]?.c, 0)
    const goals = await q(db, 'select game_id, team, sum(g) as g, sum(sog) as sog from skater_games group by game_id, team order by game_id, team')
    assert.deepEqual(goals.rows.map((r) => [r.game_id, r.team, r.g]), [
      [2026020303, 'NJD', 5], [2026020303, 'WSH', 2], [2026020318, 'NJD', 7], [2026020318, 'WSH', 4],
    ])
    assert.deepEqual(goals.rows.map((r) => r.sog), [29, 28, 33, 47])
  })
})
