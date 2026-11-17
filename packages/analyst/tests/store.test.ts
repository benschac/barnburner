import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Result } from 'effect'
import { cardId, type InsightCard } from '../src/card.ts'
import { mergePending, readCards, type StoreError, writeCards } from '../src/store.ts'

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

const failure = <A>(result: Result.Result<A, StoreError>): StoreError => {
  assert.ok(Result.isFailure(result))
  return result.failure
}

const tempDir = () => mkdtempSync(join(tmpdir(), 'analyst-store-'))

test('a missing file reads as []', () => {
  assert.deepEqual(readCards(tempDir(), 'NJD'), Result.succeed([]))
})

test('writeCards then readCards round-trips with pretty JSON and a trailing newline', () => {
  const dir = tempDir()
  const cards = [makeCard('one'), makeCard('two', 'approved')]
  assert.ok(Result.isSuccess(writeCards(dir, 'NJD', cards)))
  const raw = readFileSync(join(dir, 'NJD.json'), 'utf8')
  assert.ok(raw.endsWith('\n'))
  assert.equal(raw, `${JSON.stringify(JSON.parse(raw), null, 2)}\n`)
  assert.deepEqual(Result.getOrThrow(readCards(dir, 'NJD')), cards)
})

test('readCards fails loudly on an invalid file', () => {
  const dir = tempDir()
  writeFileSync(join(dir, 'NJD.json'), JSON.stringify([{ id: 'x' }]))
  const error = failure(readCards(dir, 'NJD'))
  assert.equal(error._tag, 'StoreError')
  assert.deepEqual([error.file, error.team], [join(dir, 'NJD.json'), 'NJD'])
  assert.match(error.reason, /^invalid cards: /)
})

test('readCards reports a file that is not JSON', () => {
  const dir = tempDir()
  writeFileSync(join(dir, 'NJD.json'), '{not json')
  const error = failure(readCards(dir, 'NJD'))
  assert.equal(error._tag, 'StoreError')
  assert.match(error.reason, /^invalid JSON: /)
  assert.ok(error.message.startsWith(`${join(dir, 'NJD.json')}: invalid JSON: `))
})

test('readCards rejects cards filed under another team', () => {
  const dir = tempDir()
  writeFileSync(join(dir, 'NJD.json'), JSON.stringify([makeCard('wrong team', 'pending', 'NYR')]))
  const error = failure(readCards(dir, 'NJD'))
  assert.equal(error._tag, 'StoreError')
  assert.equal(error.team, 'NJD')
  assert.match(error.message, /NJD\.json: card .* has team NYR, expected NJD$/)
})

test('writeCards rejects a card for another team and keeps the existing file', () => {
  const dir = tempDir()
  const existing = [makeCard('existing')]
  writeCards(dir, 'NJD', existing)
  const before = readFileSync(join(dir, 'NJD.json'), 'utf8')
  const error = failure(writeCards(dir, 'NJD', [makeCard('from nyr', 'pending', 'NYR')]))
  assert.equal(error._tag, 'StoreError')
  assert.match(error.reason, /^cannot write card .* with team NYR to NJD$/)
  assert.equal(readFileSync(join(dir, 'NJD.json'), 'utf8'), before)
  assert.deepEqual(Result.getOrThrow(readCards(dir, 'NJD')), existing)
})

test('writeCards rejects an invalid card and keeps the existing file', () => {
  const dir = tempDir()
  const existing = [makeCard('existing')]
  writeCards(dir, 'NJD', existing)
  const before = readFileSync(join(dir, 'NJD.json'), 'utf8')
  const invalid = { ...makeCard('bad'), status: 'bogus' } as unknown as InsightCard
  const error = failure(writeCards(dir, 'NJD', [makeCard('good'), invalid]))
  assert.equal(error._tag, 'StoreError')
  assert.match(error.reason, /^invalid cards: /)
  assert.equal(readFileSync(join(dir, 'NJD.json'), 'utf8'), before)
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

test('mergePending collapses existing cards that share an id to the later one', () => {
  const first = makeCard('one', 'approved')
  const second = { ...makeCard('one', 'rejected'), body: 'Second body.' }
  assert.deepEqual(mergePending([first, second], []), [second])
})
