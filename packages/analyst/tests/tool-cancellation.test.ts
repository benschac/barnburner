import assert from 'node:assert/strict'
import { test } from 'node:test'
import { Effect } from 'effect'
import { executeOf } from '../src/tools/execute-of.ts'
import { makeSqlTool } from '../src/tools/sql.ts'
import { makeAnswerTool } from '../src/tools/answer.ts'
import { makeDeclineTool } from '../src/tools/decline.ts'
import { makeSubmitCardTool } from '../src/tools/submit-card.ts'
import { fakeDb } from './fakes.ts'
import { makeGate } from './gate.ts'
import type { Guard } from '../src/shapes.ts'

for (const kind of ['sql', 'answer'] as const) {
  test(`${kind}: SDK abort interrupts the running guard`, async () => {
    const controller = new AbortController()
    let finalized = false
    const entered = makeGate()
    const guard: Guard = () => Effect.gen(function* () {
      entered.open()
      return yield* Effect.never
    }).pipe(Effect.ensuring(Effect.sync(() => { finalized = true })))
    const db = fakeDb({})
    const options = { toolCallId: 'cancel', messages: [], context: {}, abortSignal: controller.signal }
    const sql = makeSqlTool({ db, guard })
    const answer = makeAnswerTool({ db, guard, team: 'NJD', onAnswer: () => assert.fail('cancelled answer recorded') })
    const pending = kind === 'sql'
      ? executeOf(sql.execute)({ query: 'SELECT 1' }, options)
      : executeOf(answer.execute)({ query: 'SELECT 1', row: 0, column: 'value' }, options)
    const rejected = assert.rejects(Promise.resolve(pending))
    await entered.opened
    controller.abort()
    await rejected
    assert.equal(finalized, true)
  })
}

test('terminal tools do not record callbacks with an already aborted signal', async () => {
  const signal = AbortSignal.abort()
  const options = { toolCallId: 'cancel', messages: [], context: {}, abortSignal: signal }
  const decline = makeDeclineTool({ onDecline: () => assert.fail('cancelled decline recorded') })
  await assert.rejects(Promise.resolve(executeOf(decline.execute)({ reason: 'no data' }, options)))
  const submit = makeSubmitCardTool({
    db: fakeDb({}), guard: () => Effect.succeed({ ok: true, touchesBoxscores: false }),
    verify: () => Effect.succeed({ ok: true }), finals: new Set(),
    meta: { model: 'mock', runId: 'cancel', asOf: { fetchedAt: '2026-11-17', completedGameIds: 0 } },
    onCard: () => assert.fail('cancelled card recorded'),
  })
  await assert.rejects(Promise.resolve(executeOf(submit.execute)({
    team: 'NJD', kind: 'trend', headline: 'test', body: 'test', bindings: {}, evidence: { query: 'SELECT 1' },
  }, options)))
})

test('submit_card: abort interrupts verification and prevents recording', async () => {
  const controller = new AbortController()
  const entered = makeGate()
  let finalized = false
  const submit = makeSubmitCardTool({
    db: fakeDb({ 'SELECT 1': [{ value: 1 }] }),
    guard: () => Effect.succeed({ ok: true, touchesBoxscores: false }),
    verify: () => Effect.gen(function* () {
      entered.open()
      return yield* Effect.never
    }).pipe(Effect.ensuring(Effect.sync(() => { finalized = true }))),
    finals: new Set(),
    meta: { model: 'mock', runId: 'cancel', asOf: { fetchedAt: '2026-11-17', completedGameIds: 0 } },
    onCard: () => assert.fail('cancelled card recorded'),
  })
  const rejected = assert.rejects(Promise.resolve(executeOf(submit.execute)({
    team: 'NJD', kind: 'trend', headline: 'test', body: 'test', bindings: {}, evidence: { query: 'SELECT 1' },
  }, { toolCallId: 'cancel', messages: [], context: {}, abortSignal: controller.signal })))
  await entered.opened
  controller.abort()
  await rejected
  assert.equal(finalized, true)
})
