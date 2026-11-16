import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { InsightCard } from '../src/card.ts'
import { applyDecision, formatForReview } from '../src/review.ts'
import { readCards, writeCards } from '../src/store.ts'
import { runReview } from '../scripts/review-insights.ts'

const NOW = '2026-11-16T12:00:00.000Z'

const makeCard = (team: string, id: string, overrides: Partial<InsightCard> = {}): InsightCard => ({
  id,
  status: 'pending',
  team,
  kind: 'record',
  headline: '{name} leads with {goals} goals',
  body: 'Scored in {games} straight games.',
  bindings: { name: { column: 'name', row: 0 }, goals: { column: 'goals', row: 0 }, games: { column: 'games', row: 1 } },
  evidence: {
    query: 'SELECT name, goals, games FROM t',
    result: [
      { name: 'Alex', goals: 12, games: 9 },
      { name: 'Sam', goals: 8, games: 5 },
    ],
    gameIds: [2026020001, 2026020002],
    coverage: { archived: 2, finals: 2 },
  },
  asOf: { fetchedAt: '2026-11-15T00:00:00Z', completedGameIds: 2 },
  model: 'fake',
  runId: 'run-1',
  ...overrides,
})

test('applyDecision approves, rejects and skips pending cards', () => {
  const card = makeCard('TOR', 'a')
  const approved = applyDecision(card, { action: 'approve' }, NOW)
  assert.equal(approved.status, 'approved')
  assert.deepEqual(approved.review, { by: 'ben', at: NOW })
  const rejected = applyDecision(card, { action: 'reject', reason: 'trivial' }, NOW)
  assert.equal(rejected.status, 'rejected')
  assert.deepEqual(rejected.review, { by: 'ben', at: NOW, reason: 'trivial' })
  assert.equal(applyDecision(card, { action: 'skip' }, NOW), card)
})

test('applyDecision refuses non-pending cards', () => {
  const card = makeCard('TOR', 'a', { status: 'approved' })
  assert.throws(() => applyDecision(card, { action: 'approve' }, NOW), /only pending/)
})

test('formatForReview shows rendered text, query, table, games and coverage', () => {
  const text = formatForReview(makeCard('TOR', 'a', { kind: 'comparative', assert: 'goals > 10' }))
  assert.match(text, /Alex leads with 12 goals/)
  assert.match(text, /Scored in 5 straight games\./)
  assert.match(text, /SELECT name, goals, games FROM t/)
  assert.match(text, /name +goals +games/)
  assert.match(text, /Alex +12 +9/)
  assert.match(text, /gameIds: 2026020001, 2026020002/)
  assert.match(text, /coverage: 2\/2/)
  assert.match(text, /assert: goals > 10/)
})

test('runReview applies scripted answers and writes back', () => {
  const dir = mkdtempSync(join(tmpdir(), 'review-'))
  writeCards(dir, 'TOR', [makeCard('TOR', 'a'), makeCard('TOR', 'b'), makeCard('TOR', 'c')])
  writeCards(dir, 'BOS', [makeCard('BOS', 'd'), makeCard('BOS', 'e', { status: 'approved' })])
  const output: string[] = []
  const summary = runReview({
    dir,
    lines: ['a', 'r', 'bogus', 'wrong', ''],
    out: (text) => output.push(text),
    now: NOW,
  })
  assert.deepEqual(summary, { approved: 1, rejected: 1, skipped: 1 })
  // BOS is reviewed first (sorted): d approved; then TOR: a rejected(wrong), b skipped, c left (answers ran out)
  const bos = readCards(dir, 'BOS')
  assert.equal(bos[0]?.status, 'approved')
  const tor = readCards(dir, 'TOR')
  assert.deepEqual(
    tor.map((card) => card.status),
    ['rejected', 'pending', 'pending'],
  )
  assert.equal(tor[0]?.review?.reason, 'wrong')
  assert.ok(output.some((line) => line.includes('Unknown reason "bogus"')))
})

test('runReview limits to the given team', () => {
  const dir = mkdtempSync(join(tmpdir(), 'review-'))
  writeCards(dir, 'TOR', [makeCard('TOR', 'a')])
  writeCards(dir, 'BOS', [makeCard('BOS', 'd')])
  runReview({ dir, teams: ['TOR'], lines: ['a'], out: () => {}, now: NOW })
  assert.equal(readCards(dir, 'TOR')[0]?.status, 'approved')
  assert.equal(readCards(dir, 'BOS')[0]?.status, 'pending')
})
