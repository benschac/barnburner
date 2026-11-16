import assert from 'node:assert/strict'
import { test } from 'node:test'
import { Effect } from 'effect'
import { fakeDb } from '../tests/fakes.ts'
import type { EvalAnswer, EvalCase } from './case.ts'
import { runEvals } from './runner.ts'

const c = (id: string, extra: Partial<EvalCase> = {}): EvalCase => ({
  id,
  team: 'TOR',
  question: id,
  truthSql: `sql-${id}`,
  expect: 'value',
  ...extra,
})

test('runEvals grades, flags invalid cases, and survives answerer failures', async () => {
  const db = fakeDb({
    'sql-ok': [{ value: 5 }],
    'sql-wrong': [{ value: 5 }],
    'sql-multi': [{ value: 1 }, { value: 2 }],
    'sql-text': [{ value: 'x' }],
    'sql-fail': [{ value: 1 }],
    'sql-throw': [{ value: 1 }],
  })
  const scripted: Record<string, () => Effect.Effect<EvalAnswer>> = {
    ok: () => Effect.succeed({ value: 5 }),
    wrong: () => Effect.succeed({ value: 6 }),
    fail: () => Effect.die(new Error('boom')),
    throw: () => {
      throw new Error('sync boom')
    },
    dec: () => Effect.succeed({ declined: true }),
  }
  const out = await Effect.runPromise(
    runEvals({
      db,
      answerer: (e) => (scripted[e.id] ?? (() => Effect.succeed({ value: 0 })))(),
      cases: [
        c('ok'),
        c('wrong'),
        c('multi'),
        c('text'),
        c('missing'),
        c('fail'),
        c('throw'),
        c('dec', { truthSql: null, expect: 'decline' }),
      ],
    }),
  )
  const by = Object.fromEntries(out.results.map((r) => [r.id, r]))
  assert.equal(out.total, 8)
  assert.equal(out.passed, 2)
  assert.equal(out.score, 0.25)
  assert.equal(by.ok?.pass, true)
  assert.equal(by.ok?.truth, 5)
  assert.equal(by.wrong?.pass, false)
  assert.equal(by.wrong?.invalid, undefined)
  for (const id of ['multi', 'text', 'missing']) {
    assert.equal(by[id]?.pass, false)
    assert.equal(by[id]?.invalid, true)
  }
  assert.match(by.fail?.reason ?? '', /answerer failed/)
  assert.match(by.throw?.reason ?? '', /answerer failed/)
  assert.equal(by.dec?.pass, true)
})

test('runEvals on no cases scores zero', async () => {
  const out = await Effect.runPromise(runEvals({ cases: [], db: fakeDb({}), answerer: () => Effect.succeed({ value: 1 }) }))
  assert.equal(out.score, 0)
})
