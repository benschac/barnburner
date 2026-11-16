import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { cardId, type InsightCard } from '../src/card.ts'
import { mergePending, readCards, writeCards } from '../src/store.ts'

const makeCard = (headline: string, status: InsightCard['status'] = 'pending', team = 'NJD'): InsightCard => ({
  id: cardId(team, 'SELECT 1 AS wins', headline),
  team,
  status,
  kind: 'record',
  headline,
  body: `Body for ${headline}.`,
  bindings: { wins: { column: 'wins', row: 0 } },
  evidence: { query: 'SELECT 1 AS wins', result: [{ wins: 1 }], gameIds: [] },
  asOf: { fetchedAt: '2026-11-16T00:00:00Z', completedGameIds: 12 },
  model: 'test',
  runId: 'run-1',
})

const tempDir = () => mkdtempSync(join(tmpdir(), 'analyst-store-'))

test('a missing file reads as []', () => {
  assert.deepEqual(readCards(tempDir(), 'NJD'), [])
})

test('writeCards then readCards round-trips with pretty JSON and a trailing newline', () => {
  const dir = tempDir()
  const cards = [makeCard('one'), makeCard('two', 'approved')]
  writeCards(dir, 'NJD', cards)
  const raw = readFileSync(join(dir, 'NJD.json'), 'utf8')
  assert.ok(raw.endsWith('\n'))
  assert.equal(raw, `${JSON.stringify(JSON.parse(raw), null, 2)}\n`)
  assert.deepEqual(readCards(dir, 'NJD'), cards)
})

test('readCards fails loudly on an invalid file', () => {
  const dir = tempDir()
  writeFileSync(join(dir, 'NJD.json'), JSON.stringify([{ id: 'x' }]))
  assert.throws(() => readCards(dir, 'NJD'))
})

test('readCards rejects cards filed under another team', () => {
  const dir = tempDir()
  writeFileSync(join(dir, 'NJD.json'), JSON.stringify([makeCard('wrong team', 'pending', 'NYR')]))
  assert.throws(() => readCards(dir, 'NJD'), /expected NJD/)
})

test('mergePending adds a card with a new id', () => {
  const existing = [makeCard('one')]
  const added = makeCard('two')
  assert.deepEqual(mergePending(existing, [added]), [...existing, added])
})

test('mergePending replaces a pending card with the same id', () => {
  const old = makeCard('one')
  const fresh = { ...old, body: 'Updated body.' }
  assert.deepEqual(mergePending([old], [fresh]), [fresh])
})

test('mergePending keeps an approved card with the same id', () => {
  const approved = makeCard('one', 'approved')
  const incoming = { ...approved, status: 'pending' as const, body: 'Updated body.' }
  assert.deepEqual(mergePending([approved], [incoming]), [approved])
})

test('mergePending keeps a rejected card with the same id', () => {
  const rejected: InsightCard = { ...makeCard('one', 'rejected'), review: { by: 'ben', at: '2026-11-16T00:00:00Z', reason: 'wrong' } }
  assert.deepEqual(mergePending([rejected], [makeCard('one')]), [rejected])
})

test('mergePending keeps a stale card with the same id', () => {
  const stale = makeCard('one', 'stale')
  assert.deepEqual(mergePending([stale], [{ ...stale, status: 'pending', body: 'Updated body.' }]), [stale])
})

test('mergePending keeps every existing card in order', () => {
  const a = makeCard('a', 'approved')
  const b = makeCard('b')
  const c = makeCard('c', 'rejected')
  const d = makeCard('d')
  const merged = mergePending([a, b, c], [makeCard('b', 'pending'), d])
  assert.deepEqual(merged.map((card) => card.id), [a.id, b.id, c.id, d.id])
})
