import assert from 'node:assert/strict'
import { test } from 'node:test'
import { Effect } from 'effect'
import { cardId } from '../src/card.ts'
import type { CardDraft, InsightCard } from '../src/card.ts'
import type { Guard } from '../src/shapes.ts'
import { fillCard, makeSubmitCardTool, submitCardText } from '../src/tools/submit-card.ts'
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

test('guard rejection stops before any db call', async () => {
  const calls: string[] = []
  const inner = fakeDb({})
  const spy = {
    query: (s: string) => (calls.push(s), inner.query(s)),
    queryCanonical: (s: string) => (calls.push(s), inner.queryCanonical(s)),
  }
  const reject = fakeGuard({ ok: false, reason: 'nope' })
  const err = await Effect.runPromise(Effect.flip(fillCard({ db: spy, guard: reject }, draft, meta)))
  assert.equal(err.message, 'nope')
  const onlyGames: Guard = (_db, sql) => Effect.succeed(sql === gamesQuery ? { ok: false, reason: 'bad games' } : { ok: true, touchesBoxscores: false })
  const err2 = await Effect.runPromise(Effect.flip(fillCard({ db: spy, guard: onlyGames }, draft, meta)))
  assert.equal(err2.message, 'bad games')
  const text = await Effect.runPromise(
    submitCardText({ db: spy, guard: reject, verify: fakeVerify({ ok: true }), finals: new Set(), meta, onCard: () => {} }, draft),
  )
  assert.equal(text, 'ERROR: nope')
  const assertGuard: Guard = (_db, sql) => Effect.succeed(sql === 'SELECT true' ? { ok: false, reason: 'bad assert' } : { ok: true, touchesBoxscores: false })
  const t2 = await Effect.runPromise(
    submitCardText({ db: spy, guard: assertGuard, verify: fakeVerify({ ok: true }), finals: new Set(), meta, onCard: () => {} }, { ...draft, assert: 'SELECT true' }),
  )
  assert.equal(t2, 'ERROR: bad assert')
  assert.deepEqual(calls, [])
})

test('null optional fields are treated as absent', async () => {
  const cards: InsightCard[] = []
  const input = { ...draft, assert: null, evidence: { query, gamesQuery: null } }
  const text = await Effect.runPromise(
    submitCardText({ db, guard: fakeGuard({ ok: true, touchesBoxscores: false }), verify: fakeVerify({ ok: true }), finals: new Set(), meta, onCard: (c) => cards.push(c) }, input),
  )
  assert.equal(text, 'ok')
  assert.deepEqual(cards[0]?.evidence.gameIds, [])
  const tool = makeSubmitCardTool({ db, guard: fakeGuard({ ok: true, touchesBoxscores: false }), verify: fakeVerify({ ok: true }), finals: new Set(), meta, onCard: () => {} })
  const v = await (tool.inputSchema as any).validate(input)
  assert.equal(v.success, true)
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
