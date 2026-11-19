import { Effect } from 'effect'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { SqlError } from '../src/shapes.ts'
import type { Row } from '../src/shapes.ts'
import { executeOf } from '../src/tools/execute-of.ts'
import { makeSqlTool, runSql } from '../src/tools/sql.ts'
import { fakeDb, fakeGuard } from './fakes.ts'

const ok = fakeGuard({ ok: true, touchesBoxscores: false })

test('sql: returns rows as JSON', async () => {
  const db = fakeDb({ 'SELECT 1': [{ a: 1 }] })
  const out = JSON.parse(await Effect.runPromise(runSql({ db, guard: ok }, 'SELECT 1')))
  assert.deepEqual(out, { rows: [{ a: 1 }], rowCount: 1, truncated: false })
})

test('sql: guard rejection comes back as text', async () => {
  const db = fakeDb({})
  const out = await Effect.runPromise(runSql({ db, guard: fakeGuard({ ok: false, reason: 'only SELECT' }) }, 'DROP TABLE x'))
  assert.equal(out, 'ERROR: only SELECT')
})

test('sql: SqlError comes back as text', async () => {
  const db = fakeDb({ q: new SqlError({ message: 'boom', sql: 'q' }) })
  assert.equal(await Effect.runPromise(runSql({ db, guard: ok }, 'q')), 'ERROR: boom')
})

test('sql: rows are capped', async () => {
  const rows: Row[] = Array.from({ length: 5 }, (_, i) => ({ i }))
  const db = fakeDb({ q: rows })
  const out = JSON.parse(await Effect.runPromise(runSql({ db, guard: ok, rowCap: 3 }, 'q')))
  assert.equal(out.rows.length, 3)
  assert.equal(out.rowCount, 5)
  assert.equal(out.truncated, true)
})

test('sql: tool wraps runSql', async () => {
  const db = fakeDb({ q: [{ a: 1 }] })
  const t = makeSqlTool({ db, guard: ok })
  const out = await executeOf(t.execute)({ query: 'q' }, { toolCallId: 't', messages: [], context: {} })
  assert.equal(JSON.parse(out as string).rowCount, 1)
})
