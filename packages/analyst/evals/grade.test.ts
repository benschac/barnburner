import assert from 'node:assert/strict'
import { test } from 'node:test'
import { Schema } from 'effect'
import { EvalCase } from './case.ts'
import { grade } from './grade.ts'

const value = { expect: 'value' } as const

test('integers match exactly', () => {
  assert.equal(grade(value, 12, { _tag: 'Answered', value: 12 }).pass, true)
  assert.equal(grade({ ...value, tolerance: 1 }, 12, { _tag: 'Answered', value: 13 }).pass, false)
})

test('decimals use tolerance', () => {
  const c = { expect: 'value', tolerance: 0.01 } as const
  assert.equal(grade(c, 0.915, { _tag: 'Answered', value: 0.92 }).pass, true)
  assert.equal(grade(c, 0.915, { _tag: 'Answered', value: 0.93 }).pass, false)
  assert.equal(grade(value, 0.915, { _tag: 'Answered', value: 0.915 }).pass, true)
  assert.equal(grade(value, 0.915, { _tag: 'Answered', value: 0.916 }).pass, false)
})

test('tolerance boundary passes despite floating-point error', () => {
  const c = { expect: 'value', tolerance: 0.01 } as const
  assert.equal(grade(c, 0.915, { _tag: 'Answered', value: 0.925 }).pass, true)
  assert.equal(grade(c, 0.915, { _tag: 'Answered', value: 0.905 }).pass, true)
  assert.equal(grade(c, 0.915, { _tag: 'Answered', value: 0.926 }).pass, false)
})

test('non-finite truth fails', () => {
  assert.equal(grade(value, Number.NaN, { _tag: 'Answered', value: 123 }).pass, false)
  assert.equal(grade(value, Number.POSITIVE_INFINITY, { _tag: 'Answered', value: Number.POSITIVE_INFINITY }).pass, false)
})

test('decline cases must be declined', () => {
  assert.equal(grade({ expect: 'decline' }, null, { _tag: 'Declined' }).pass, true)
  assert.equal(grade({ expect: 'decline' }, null, { _tag: 'Answered', value: 3 }).pass, false)
})

test('declining a value case fails', () => {
  assert.equal(grade(value, 3, { _tag: 'Declined', reason: 'unsure' }).pass, false)
})

test('mustMentionCoverage needs a coverage value', () => {
  const c = { expect: 'value', mustMentionCoverage: true } as const
  assert.equal(grade(c, 3, { _tag: 'Answered', value: 3 }).pass, false)
  assert.equal(grade(c, 3, { _tag: 'Answered', value: 3, coverage: { archived: Number.NaN, finals: 10 } }).pass, false)
  assert.equal(grade(c, 3, { _tag: 'Answered', value: 3, coverage: { archived: 8, finals: 10 } }).pass, true)
})

test('non-finite answers and missing truth fail', () => {
  assert.equal(grade(value, 3, { _tag: 'Answered', value: Number.NaN }).pass, false)
  assert.equal(grade(value, null, { _tag: 'Answered', value: 3 }).pass, false)
})

test('case schema decodes a case', () => {
  const decoded = Schema.decodeSync(EvalCase)({
    id: 'a',
    team: 'TOR',
    question: 'q',
    truthSql: null,
    expect: 'decline',
  })
  assert.equal(decoded.expect, 'decline')
})
