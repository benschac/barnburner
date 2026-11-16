import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Effect } from 'effect'
import { openDb } from '../src/db.ts'
import type { Db } from '../src/shapes.ts'

const withDb = async (run: (db: Db, dir: string) => Promise<void>): Promise<void> => {
  const dir = mkdtempSync(join(tmpdir(), 'db-test-'))
  const views = join(dir, 'views')
  mkdirSync(views)
  writeFileSync(join(dir, 'rows.json'), JSON.stringify([{ id: 2, team: 'B', n: 3 }, { id: 1, team: 'A', n: 3 }, { id: 3, team: 'A', n: 1 }]))
  writeFileSync(join(views, '10-t.sql'), "CREATE TABLE t AS SELECT * FROM read_json('${DATA_DIR}/rows.json')")
  try {
    await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const db = yield* openDb({ dataDir: dir, viewsDir: views })
          yield* Effect.promise(() => run(db, dir))
        }),
      ),
    )
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

const q = (db: Db, sql: string) => Effect.runPromise(db.query(sql))
const fails = (db: Db, sql: string) => Effect.runPromise(Effect.flip(db.query(sql)))

test('select 1', async () => {
  await withDb(async (db) => {
    assert.deepEqual(await q(db, 'select 1 as x'), { rows: [{ x: 1 }], rowCount: 1 })
  })
})

test('conversions', async () => {
  await withDb(async (db) => {
    const { rows } = await q(
      db,
      `select 5::BIGINT as big, 2.50::DECIMAL(5,2) as dec, 1.5::DOUBLE as dbl, 7::HUGEINT as huge,
        DATE '2026-01-02' as d, 'x' as s, true as b, NULL as nul, [1,2] as lst, 'NaN'::DOUBLE as nan`,
    )
    assert.deepEqual(rows, [{ big: 5, dec: 2.5, dbl: 1.5, huge: 7, d: '2026-01-02', s: 'x', b: true, nul: null, lst: '[1,2]', nan: null }])
  })
})

test('JSON round trip', async () => {
  await withDb(async (db) => {
    const { rows } = await q(db, 'select id, team, n, count(*) over () as c, id / 3.0 as f, DATE \'2026-03-04\' as d from t')
    assert.deepEqual(JSON.parse(JSON.stringify(rows)), rows)
  })
})

test('queryCanonical orders all columns', async () => {
  await withDb(async (db) => {
    const result = await Effect.runPromise(db.queryCanonical('select id, team, n from t order by n desc;'))
    assert.deepEqual(result.rows.map((r) => r.id), [1, 2, 3])
    assert.equal(result.rowCount, 3)
  })
})

test('duplicate column names keep keys and types aligned', async () => {
  await withDb(async (db) => {
    const { rows } = await q(db, "select 'A' as x, 2::BIGINT as x")
    assert.equal(rows.length, 1)
    assert.deepEqual(Object.values(rows[0] ?? {}), ['A', 2])
  })
})

test('queryCanonical accepts trailing line comments and terminators', async () => {
  await withDb(async (db) => {
    for (const sql of ['select 1 as x -- why', 'select 1 as x; -- why', 'select 1 as x;']) {
      assert.deepEqual((await Effect.runPromise(db.queryCanonical(sql))).rows, [{ x: 1 }], sql)
    }
  })
})

test('only a single SELECT runs; injected statements leave tables intact', async () => {
  await withDb(async (db) => {
    const injection = 'SELECT 1) AS s; DROP TABLE t; SELECT 1 --'
    assert.equal((await Effect.runPromise(Effect.flip(db.queryCanonical(injection))))._tag, 'SqlError')
    assert.equal((await fails(db, 'select 1; drop table t')) ._tag, 'SqlError')
    assert.equal((await fails(db, 'drop table t'))._tag, 'SqlError')
    assert.equal((await fails(db, 'create table z as select 1'))._tag, 'SqlError')
    assert.equal((await q(db, 'select count(*) as c from t')).rows[0]?.c, 3)
  })
})

test('sql errors are SqlError', async () => {
  await withDb(async (db) => {
    const error = await fails(db, 'select nope from t')
    assert.equal(error._tag, 'SqlError')
  })
})

test('COPY, ATTACH, read_json and unlock fail after open', async () => {
  await withDb(async (db, dir) => {
    const source = join(dir, 'rows.json')
    for (const sql of [
      `COPY t TO '${join(dir, 'out.csv')}'`,
      `ATTACH '${join(dir, 'o.db')}' AS other`,
      `CREATE TABLE u AS SELECT * FROM read_json('${source}')`,
      `SELECT * FROM read_json('${source}')`,
      'SET enable_external_access=true',
    ]) {
      assert.equal((await fails(db, sql))._tag, 'SqlError', sql)
    }
    assert.equal((await q(db, 'select count(*) as c from t')).rows[0]?.c, 3)
  })
})
