import assert from 'node:assert/strict'
import { test } from 'node:test'
import { Effect } from 'effect'
import type { Verify } from '../src/shapes.ts'
import { fakeVerify } from '../tests/fakes.ts'
import { scoreCards } from './card-pass-rate.ts'

const none = new Set<number>()

// Fails the check named on the card (card.check), passes cards without one.
const verifyByCheck: Verify = (card) =>
  Effect.succeed(
    // foreign: card is unknown here, as it is for the real verifier
    typeof card === 'object' && card !== null && 'check' in card && typeof card.check === 'number'
      ? { ok: false as const, check: card.check, detail: 'fake' }
      : { ok: true as const },
  )

test('no cards scores a pass rate of 0', async () => {
  const score = await Effect.runPromise(scoreCards([], fakeVerify({ ok: true }), none))
  assert.deepEqual(score, { total: 0, passed: 0, passRate: 0, failuresByCheck: {} })
})

test('all passing cards score 1 with no failures', async () => {
  const score = await Effect.runPromise(scoreCards([{}, {}, {}], fakeVerify({ ok: true }), none))
  assert.deepEqual(score, { total: 3, passed: 3, passRate: 1, failuresByCheck: {} })
})

test('every failing card is counted under its check', async () => {
  const score = await Effect.runPromise(
    scoreCards([{}, {}], fakeVerify({ ok: false, check: 5, detail: 'rerun differs' }), none),
  )
  assert.deepEqual(score, { total: 2, passed: 0, passRate: 0, failuresByCheck: { 5: 2 } })
})

test('failures are grouped by check across mixed cards', async () => {
  const cards = [{ check: 3 }, { check: 3 }, { check: 5 }, {}, { check: 8 }]
  const score = await Effect.runPromise(scoreCards(cards, verifyByCheck, none))
  assert.deepEqual(score, { total: 5, passed: 1, passRate: 0.2, failuresByCheck: { 3: 2, 5: 1, 8: 1 } })
})

test('verify receives the finals set', async () => {
  const finals = new Set([101, 102])
  const seen: ReadonlySet<number>[] = []
  const spy: Verify = (_card, f) => {
    seen.push(f)
    return Effect.succeed({ ok: true as const })
  }
  await Effect.runPromise(scoreCards([{}], spy, finals))
  assert.equal(seen[0], finals)
})
