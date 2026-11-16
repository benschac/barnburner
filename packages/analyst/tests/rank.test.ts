import { test } from 'node:test'
import assert from 'node:assert/strict'
import { Effect } from 'effect'
import { MockLanguageModelV4 } from 'ai/test'
import { Llm } from '../src/llm.ts'
import { RankError, dedupeCards, normalizeHeadline, rank } from '../src/rank.ts'
import type { InsightCard } from '../src/card.ts'

const usage = {
  inputTokens: { total: 10, noCache: 10, cacheRead: undefined, cacheWrite: undefined },
  outputTokens: { total: 5, text: 5, reasoning: undefined },
}
const mock = (text: string) =>
  new MockLanguageModelV4({
    doGenerate: async () => ({ content: [{ type: 'text', text }], finishReason: { unified: 'stop', raw: undefined }, usage, warnings: [] }),
  })

const card = (id: string, headline: string): InsightCard => ({
  id, status: 'pending', team: 'NJD', kind: 'record', headline, body: 'body', bindings: {},
  evidence: { query: 'select 1', result: [], gameIds: [] },
  asOf: { fetchedAt: '2026-11-16T00:00:00Z', completedGameIds: 0 },
  model: 'm', runId: 'r',
})

const run = <A, E>(e: Effect.Effect<A, E, Llm>) => Effect.runPromise(e.pipe(Effect.provide(Llm.layer())))
const score = (id: string, n: number, s: number, r: number) => ({ id, novelty: n, specificity: s, readability: r })

test('rank: normalizes headlines', () => {
  assert.equal(normalizeHeadline('{wins}-{losses} in One-Goal games!'), 'in one goal games')
})

test('rank: dedupes by id then by near-identical headline', () => {
  const out = dedupeCards([card('a', '{w} wins at home'), card('a', 'other'), card('b', '{x} Wins, at home.'), card('c', 'different')])
  assert.deepEqual(out.map((c) => c.id), ['a', 'c'])
})

test('rank: keeps top 3 by total, ties broken by id', async () => {
  const cards = [card('d', 'h1'), card('c', 'h2'), card('b', 'h3'), card('a', 'h4'), card('e', 'h5')]
  const model = mock(JSON.stringify({ scores: [score('a', 5, 5, 5), score('b', 3, 3, 3), score('c', 3, 3, 3), score('d', 3, 3, 3), score('e', 1, 1, 1)] }))
  const out = await run(rank({ cards, posterFacts: ['x'], model }))
  assert.deepEqual(out.map((r) => r.card.id), ['a', 'b', 'c'])
  assert.equal(out[0]!.total, 15)
  assert.equal(model.doGenerateCalls.length, 1)
})

test('rank: tolerates code fences', async () => {
  const model = mock('```json\n' + JSON.stringify({ scores: [score('a', 2, 2, 2)] }) + '\n```')
  const out = await run(rank({ cards: [card('a', 'h')], posterFacts: [], model }))
  assert.equal(out.length, 1)
})

test('rank: unparseable, out-of-range and incomplete replies are RankError', async () => {
  for (const text of ['nope', JSON.stringify({ scores: [score('a', 6, 1, 1)] }), JSON.stringify({ scores: [] }), JSON.stringify({ scores: [score('zzz', 1, 1, 1)] })]) {
    const error = await run(rank({ cards: [card('a', 'h')], posterFacts: [], model: mock(text) }).pipe(Effect.flip))
    assert.ok(error instanceof RankError, text)
  }
})

test('rank: no cards skips the model', async () => {
  const model = mock('unused')
  assert.deepEqual(await run(rank({ cards: [], posterFacts: [], model })), [])
  assert.equal(model.doGenerateCalls.length, 0)
})
