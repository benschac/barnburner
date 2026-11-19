import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Effect } from 'effect'
import { MockLanguageModelV4 } from 'ai/test'
import type { CardDraft } from '../src/card.ts'
import { openDb } from '../src/db.ts'
import { generate } from '../src/generate.ts'
import { Llm } from '../src/llm.ts'
import { toJson } from '../src/json.ts'

const dataDir = join(import.meta.dirname, 'fixtures/data')

const usage = { inputTokens: { total: 10, noCache: 10, cacheRead: undefined, cacheWrite: undefined }, outputTokens: { total: 5, text: 5, reasoning: undefined } }

type ToolInputs = { submit_card: CardDraft; sql: { query: string }; decline: { reason: string } }


const call = <K extends keyof ToolInputs>(toolName: K, input: ToolInputs[K], id = toolName) => ({
  content: [{ type: 'tool-call' as const, toolCallId: id, toolName, input: toJson(input) }],
  finishReason: { unified: 'tool-calls' as const, raw: undefined }, usage, warnings: [],
})

const prose = { content: [{ type: 'text' as const, text: 'nothing to add' }], finishReason: { unified: 'stop' as const, raw: undefined }, usage, warnings: [] }

const draft: CardDraft = {
  team: 'NJD', kind: 'record', headline: 'NJD has {wins} wins', body: 'Goal difference is {gd}.',
  bindings: { wins: { column: 'wins', row: 0 }, gd: { column: 'gd', row: 0 } },
  assert: "SELECT count(*) = 3 FROM team_games WHERE team = 'NJD' AND is_final",
  evidence: {
    query: "SELECT count(*) FILTER (WHERE gf > ga) AS wins, sum(gf - ga) AS gd FROM team_games WHERE team = 'NJD' AND is_final",
    gamesQuery: "SELECT game_id FROM team_games WHERE team = 'NJD' AND is_final ORDER BY game_id",
  },
}

// Plays the scripted responses in order, repeating the last one.
const scripted = (responses: ReadonlyArray<ReturnType<typeof call> | typeof prose>) => {
  let index = 0

  return new MockLanguageModelV4({ doGenerate: async () => responses[Math.min(index++, responses.length - 1)] })
}

const run = async (model: MockLanguageModelV4) => {
  const dir = mkdtempSync(join(tmpdir(), 'generate-test-'))

  try {
    const result = await Effect.runPromise(Effect.scoped(Effect.gen(function* () {
      const db = yield* openDb({ dataDir })

      return yield* generate({ team: 'NJD', db, model, traceDir: dir, fetchedAt: '2026-11-15' })
    })).pipe(Effect.provide(Llm.layer())))

    const events = readFileSync(join(dir, `${result.runId}.jsonl`), 'utf8').trim().split('\n').map((line) => JSON.parse(line))

    return { result, events }
  } finally { rmSync(dir, { recursive: true, force: true }) }
}

test('generate returns the verified card and traces it', async () => {
  const { result, events } = await run(scripted([call('submit_card', draft), prose]))
  assert.equal(result.outcome, 'cards')
  assert.equal(result.cards.length, 1)
  assert.equal(result.cards[0].status, 'pending')
  assert.equal(result.cards[0].runId, result.runId)
  assert.equal(result.cards[0].asOf.completedGameIds, 3)
  assert.deepEqual(events.map((event) => event.type), ['tool_call', 'card', 'model_call', 'outcome'])
  assert.equal(events[0].output, 'ok')
  assert.equal(events.at(-1).status, 'cards')
})

test('generate records a decline', async () => {
  const { result, events } = await run(scripted([call('decline', { reason: 'nothing new' })]))
  assert.equal(result.outcome, 'declined')
  assert.equal(result.reason, 'nothing new')
  assert.equal(result.cards.length, 0)
  assert.equal(events.at(-1).status, 'declined')
})

test('generate reports no_insight when the model stops with nothing', async () => {
  const { result, events } = await run(scripted([prose]))
  assert.equal(result.outcome, 'no_insight')
  assert.equal(result.cards.length, 0)
  assert.equal(events.at(-1).status, 'no_insight')
})

test('generate crashes after three consecutive tool failures', async () => {
  const model = scripted([call('sql', { query: 'DROP TABLE team_games' })])
  const { result, events } = await run(model)
  assert.equal(result.outcome, 'crashed')
  assert.equal(model.doGenerateCalls.length, 3)
  assert.equal(events.filter((event) => event.type === 'tool_call').length, 3)
  assert.equal(events.at(-1).status, 'crashed')
})

test('generate crashes when the model call fails', async () => {
  const model = new MockLanguageModelV4({ doGenerate: async () => { throw new Error('gateway down') } })
  const { result } = await run(model)
  assert.equal(result.outcome, 'crashed')
  assert.match(result.reason ?? '', /gateway down/)
})
