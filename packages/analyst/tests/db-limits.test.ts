import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Effect } from 'effect'
import { openDb } from '../src/db.ts'
import type { Db } from '../src/shapes.ts'

const withDb = async (run: (db: Db) => Promise<void>): Promise<void> => {
  const dir = mkdtempSync(join(tmpdir(), 'db-limits-'))
  const views = join(dir, 'views')
  mkdirSync(views)
  try {
    await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const db = yield* openDb({ dataDir: dir, viewsDir: views })
          yield* Effect.promise(() => run(db))
        }),
      ),
    )
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

test('a slow query is interrupted and fails with SqlError', async () => {
  await withDb(async (db) => {
    const started = Date.now()
    const error = await Effect.runPromise(
      Effect.flip(db.query('select count(*) from range(100000) a, range(100000) b', { timeoutMs: 200 })),
    )
    assert.equal(error._tag, 'SqlError')
    assert.match(error.message, /timed out/)
    assert.ok(Date.now() - started < 10000)
    // the connection stays usable afterwards
    assert.deepEqual(await Effect.runPromise(db.query('select 1 as x')), { rows: [{ x: 1 }], rowCount: 1 })
  })
})

test('rowCap truncates rows but rowCount is the full count', async () => {
  await withDb(async (db) => {
    const result = await Effect.runPromise(db.query('select * from range(10) t(n)', { rowCap: 3 }))
    assert.equal(result.rows.length, 3)
    assert.equal(result.rowCount, 10)
    const canonical = await Effect.runPromise(db.queryCanonical('select * from range(10) t(n)', { rowCap: 4 }))
    assert.equal(canonical.rows.length, 4)
    assert.equal(canonical.rowCount, 10)
  })
})
