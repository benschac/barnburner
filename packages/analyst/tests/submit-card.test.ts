import assert from 'node:assert/strict'
import { test } from 'node:test'
import { Effect } from 'effect'
import { cardId } from '../src/card.ts'
import type { CardDraft, InsightCard } from '../src/card.ts'
import { fillCard, submitCardText } from '../src/tools/submit-card.ts'
import { fakeDb, fakeGuard, fakeVerify } from './fakes.ts'

const query = 'SELECT n FROM t'
const gamesQuery = 'SELECT game_id FROM g'
const draft: CardDraft = {
  team: 'TOR',
  kind: 'record',
  headline: 'Headline {n}',
  body: 'Body {n}',
  bindings: { n: { column: 'n', row: 0 } },
  evidence: { query, gamesQuery },
}
const meta = { model: 'm', runId: 'r', asOf: { fetchedAt: '2026-01-01', completedGameIds: 2 } }
const covSql = "SELECT archived, finals FROM boxscore_coverage WHERE team = 'TOR'"
const db = fakeDb({ [query]: [{ n: 3 }], [gamesQuery]: [{ game_id: 1 }, { game_id: 2 }], [covSql]: [{ archived: 1, finals: 2 }] })

test('fillCard fills derived fields, coverage only when boxscores touched', async () => {
  const plain = await Effect.runPromise(fillCard({ db, guard: fakeGuard({ ok: true, touchesBoxscores: false }) }, draft, meta))
  assert.equal(plain.id, cardId('TOR', query, draft.headline))
  assert.equal(plain.status, 'pending')
  assert.deepEqual(plain.evidence.result, [{ n: 3 }])
  assert.deepEqual(plain.evidence.gameIds, [1, 2])
  assert.equal(plain.evidence.coverage, undefined)
  const box = await Effect.runPromise(fillCard({ db, guard: fakeGuard({ ok: true, touchesBoxscores: true }) }, draft, meta))
  assert.deepEqual(box.evidence.coverage, { archived: 1, finals: 2 })
  const noGames = await Effect.runPromise(
    fillCard({ db, guard: fakeGuard({ ok: true, touchesBoxscores: false }) }, { ...draft, evidence: { query } }, meta),
  )
  assert.deepEqual(noGames.evidence.gameIds, [])
})

test('submit tool body returns ok, failures and errors as text', async () => {
  const cards: InsightCard[] = []
  const base = { db, guard: fakeGuard({ ok: true, touchesBoxscores: false }), finals: new Set([1, 2]), meta, onCard: (c: InsightCard) => cards.push(c) }
  assert.equal(await Effect.runPromise(submitCardText({ ...base, verify: fakeVerify({ ok: true }) }, draft)), 'ok')
  assert.equal(cards.length, 1)
  const failed = await Effect.runPromise(submitCardText({ ...base, verify: fakeVerify({ ok: false, check: 4, detail: 'digits' }) }, draft))
  assert.equal(failed, 'FAILED check 4: digits')
  assert.equal(cards.length, 1)
  const bad = await Effect.runPromise(submitCardText({ ...base, verify: fakeVerify({ ok: true }) }, { nope: 1 }))
  assert.match(bad, /^ERROR: /)
  const sqlFail = await Effect.runPromise(
    submitCardText({ ...base, db: fakeDb({}), verify: fakeVerify({ ok: true }) }, draft),
  )
  assert.match(sqlFail, /^ERROR: /)
})
