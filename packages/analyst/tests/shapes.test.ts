import assert from 'node:assert/strict'
import { test } from 'node:test'
import { Array, Effect, Order } from 'effect'
import { SqlError, VIEWS } from '../src/shapes.ts'
import { fakeDb, fakeGuard, fakeVerify } from './fakes.ts'

test('fakeDb returns rows, errors, and unknown-sql failures', async () => {
  const err = new SqlError({ message: 'boom', sql: 'bad' })
  const db = fakeDb({ 'select 1': [{ x: 1 }], bad: err })
  assert.deepEqual(await Effect.runPromise(db.query('select 1')), { rows: [{ x: 1 }], rowCount: 1 })
  assert.deepEqual(await Effect.runPromise(db.queryCanonical('select 1')), { rows: [{ x: 1 }], rowCount: 1 })
  assert.equal((await Effect.runPromise(Effect.flip(db.query('bad')))).message, 'boom')
  assert.equal((await Effect.runPromise(Effect.flip(db.query('nope')))).sql, 'nope')
})

test('fakeGuard and fakeVerify return their fixed result', async () => {
  const db = fakeDb({})
  assert.deepEqual(await Effect.runPromise(fakeGuard({ ok: true, touchesBoxscores: false })(db, 'x')), {
    ok: true,
    touchesBoxscores: false,
  })
  const v = { ok: false, check: 2, detail: 'd' } as const
  assert.deepEqual(await Effect.runPromise(fakeVerify(v)({}, new Set())), v)
})

test('VIEWS has the five tables', () => {
  assert.deepEqual(Array.sort(Object.keys(VIEWS), Order.String), [
    'boxscore_coverage', 'goalie_games', 'skater_games', 'standings_daily', 'team_games',
  ])
})
