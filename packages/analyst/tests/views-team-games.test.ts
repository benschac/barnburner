import { test } from 'node:test'
import assert from 'node:assert/strict'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Effect } from 'effect'
import { openDb } from '../src/db.ts'
import { VIEWS } from '../src/shapes.ts'
import type { Db } from '../src/shapes.ts'

const dataDir = join(fileURLToPath(new URL('.', import.meta.url)), 'fixtures', 'data')

const withDb = (run: (db: Db) => Promise<void>): Promise<void> =>
  Effect.runPromise(
    Effect.scoped(
      Effect.gen(function* () {
        const db = yield* openDb({ dataDir })
        yield* Effect.promise(() => run(db))
      }),
    ),
  )

const q = (db: Db, sql: string) => Effect.runPromise(db.query(sql)).then((r) => r.rows)

test('team_games columns match the contract', async () => {
  await withDb(async (db) => {
    const { rows } = await Effect.runPromise(db.query('select * from team_games limit 1'))
    assert.deepEqual(Object.keys(rows[0] ?? {}), [...VIEWS.team_games])
  })
})

test('team_games has two rows per game', async () => {
  await withDb(async (db) => {
    const rows = await q(db, 'select game_id, count(*) as c from team_games group by game_id order by game_id')
    assert.equal(rows.length, 4)
    assert.ok(rows.every((r) => r.c === 2))
    assert.equal((await q(db, 'select count(*) as c from team_games'))[0]?.c, 8)
  })
})

test('team_games fixture totals', async () => {
  await withDb(async (db) => {
    const rows = await q(
      db,
      `select team,
        count(*) filter (where result = 'W') as w,
        count(*) filter (where result = 'L') as l,
        count(*) filter (where result = 'OTL') as otl,
        sum(gf) as gf, sum(ga) as ga
       from team_games where is_final group by team order by team`,
    )
    assert.deepEqual(rows, [
      { team: 'NJD', w: 2, l: 1, otl: 0, gf: 14, ga: 10 },
      { team: 'WSH', w: 1, l: 2, otl: 0, gf: 10, ga: 14 },
    ])
  })
})

test('team_games scheduled game has null outcome columns', async () => {
  await withDb(async (db) => {
    const rows = await q(db, 'select * from team_games where game_id = 2026020828 order by team')
    assert.equal(rows.length, 2)
    for (const r of rows) {
      assert.equal(r.is_final, false)
      assert.equal(r.gf, null)
      assert.equal(r.ga, null)
      assert.equal(r.result, null)
      assert.equal(r.decision, null)
    }
    assert.deepEqual(rows.map((r) => [r.team, r.home, r.opp]), [['NJD', true, 'WSH'], ['WSH', false, 'NJD']])
  })
})

test('team_games home and date', async () => {
  await withDb(async (db) => {
    const rows = await q(db, 'select * from team_games where game_id = 2026020121 order by team')
    assert.deepEqual(rows.map((r) => [r.team, r.date, r.home, r.opp, r.gf, r.ga, r.result, r.decision]), [
      ['NJD', '2026-10-17', false, 'WSH', 2, 4, 'L', 'REG'],
      ['WSH', '2026-10-17', true, 'NJD', 4, 2, 'W', 'REG'],
    ])
  })
})
