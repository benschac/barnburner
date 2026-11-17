import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Effect } from 'effect'
import { MockLanguageModelV4 } from 'ai/test'
import { ask } from '../src/ask.ts'
import { Llm } from '../src/llm.ts'
import type { Db } from '../src/shapes.ts'
const db: Db = { query: () => Effect.succeed({ rows: [], rowCount: 0 }), queryCanonical: () => Effect.succeed({ rows: [], rowCount: 0 }) }
const usage = { inputTokens: { total: 10, noCache: 10, cacheRead: undefined, cacheWrite: undefined }, outputTokens: { total: 5, text: 5, reasoning: undefined } }
for (const terminal of [true, false]) test(`ask records ${terminal ? 'decline' : 'crash for unverified prose'}`, async () => {
  const dir = mkdtempSync(join(tmpdir(), 'ask-test-'))
  const model = new MockLanguageModelV4({ doGenerate: async () => ({ content: terminal ? [{ type: 'tool-call', toolCallId: '1', toolName: 'decline', input: '{"reason":"not available"}' }] : [{ type: 'text', text: '42' }], finishReason: { unified: terminal ? 'tool-calls' : 'stop', raw: undefined }, usage, warnings: [] }) })
  try {
    const result = await Effect.runPromise(ask({ question: 'why?', team: 'NJD', db, model, traceDir: dir }).pipe(Effect.provide(Llm.layer())))
    assert.equal(result.outcome._tag, terminal ? 'Declined' : 'Crashed')
    assert.equal(result.steps, 1)
    assert.equal(result.inputTokens, 10)
  } finally { rmSync(dir, { recursive: true, force: true }) }
})

test('ask answers a canonical cell and traces the executed tool', async () => {
  const { openDb } = await import('../src/db.ts')
  const { readFileSync } = await import('node:fs')
  const dir = mkdtempSync(join(tmpdir(), 'ask-answer-'))
  const model = new MockLanguageModelV4({ doGenerate: async () => ({ content: [{ type: 'tool-call', toolCallId: 'answer', toolName: 'answer', input: JSON.stringify({ query: 'SELECT COUNT(*) AS value FROM team_games', row: 0, column: 'value' }) }], finishReason: { unified: 'tool-calls', raw: undefined }, usage, warnings: [] }) })
  try {
    const result = await Effect.runPromise(Effect.scoped(Effect.gen(function* () {
      const realDb = yield* openDb({ dataDir: join(import.meta.dirname, 'fixtures/data') })
      return yield* ask({ question: 'how many team games?', team: 'NJD', db: realDb, model, traceDir: dir })
    })).pipe(Effect.provide(Llm.layer())))
    assert.equal(result.outcome._tag, 'Answered')
    if (result.outcome._tag === 'Answered') assert.equal(result.outcome.value, 8)
    const events = readFileSync(join(dir, `${result.runId}.jsonl`), 'utf8').trim().split('\n').map((line) => JSON.parse(line))
    const tool = events.find((event) => event.type === 'tool_call')
    assert.equal(tool.tool, 'answer')
    assert.equal(tool.output, 'ok')
    assert.ok(tool.durationMs >= 0)
  } finally { rmSync(dir, { recursive: true, force: true }) }
})

test('ask stops after three failed tools and does not fabricate an answer', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'ask-fail-'))
  const model = new MockLanguageModelV4({ doGenerate: async () => ({ content: [{ type: 'tool-call', toolCallId: 'bad', toolName: 'sql', input: '{"query":"DROP TABLE team_games"}' }], finishReason: { unified: 'tool-calls', raw: undefined }, usage, warnings: [] }) })
  try {
    const result = await Effect.runPromise(ask({ question: 'delete everything', team: 'NJD', db, model, traceDir: dir }).pipe(Effect.provide(Llm.layer())))
    assert.equal(result.outcome._tag, 'Crashed')
    assert.equal(result.steps, 3)
    assert.equal(model.doGenerateCalls.length, 3)
  } finally { rmSync(dir, { recursive: true, force: true }) }
})

test('ask preserves cancellation rather than reporting a crash', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'ask-abort-'))
  const controller = new AbortController()
  let started!: () => void
  const start = new Promise<void>((resolve) => { started = resolve })
  const model = new MockLanguageModelV4({ doGenerate: ({ abortSignal }) => new Promise((_resolve, reject) => {
    started()
    abortSignal!.addEventListener('abort', () => reject(new Error('aborted')), { once: true })
  }) })
  try {
    const running = Effect.runPromise(ask({ question: 'q', team: 'NJD', db, model, traceDir: dir }).pipe(Effect.provide(Llm.layer())), { signal: controller.signal })
    await start
    controller.abort()
    await assert.rejects(running)
  } finally { rmSync(dir, { recursive: true, force: true }) }
})

 test('ask counts invalid tool arguments toward failure limit', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'ask-invalid-'))
  const model = new MockLanguageModelV4({ doGenerate: async () => ({
    content: [{ type: 'tool-call', toolCallId: 'bad', toolName: 'answer', input: '{"row":-1}' }],
    finishReason: { unified: 'tool-calls', raw: undefined }, usage, warnings: [],
  }) })
  try {
    const result = await Effect.runPromise(ask({ question: 'q', team: 'NJD', db, model, traceDir: dir }).pipe(Effect.provide(Llm.layer())))
    assert.equal(result.outcome._tag, 'Crashed')
    assert.equal(result.steps, 3)
    const events = readFileSync(join(dir, `${result.runId}.jsonl`), 'utf8')
      .trim().split('\n').map((line) => JSON.parse(line))
    const failures = events.filter((event) => event.type === 'tool_call')
    assert.equal(failures.length, 3)
    for (const event of failures) {
      assert.equal(event.tool, 'answer')
      assert.ok(event.error.length > 0)
      assert.match(event.output, /^ERROR:/)
      assert.equal(event.durationMs, null)
    }
  } finally { rmSync(dir, { recursive: true, force: true }) }
})

test('ask traces rejected tool execution once with measured duration', async () => {
  const { openDb } = await import('../src/db.ts')
  const dir = mkdtempSync(join(tmpdir(), 'ask-execution-error-'))
  const model = new MockLanguageModelV4({ doGenerate: async () => ({
    content: [{ type: 'tool-call', toolCallId: 'failed', toolName: 'answer',
      input: JSON.stringify({ query: 'SELECT COUNT(*) AS value FROM team_games', row: 0, column: 'value' }) }],
    finishReason: { unified: 'tool-calls', raw: undefined }, usage, warnings: [],
  }) })
  try {
    const result = await Effect.runPromise(Effect.scoped(Effect.gen(function* () {
      const realDb = yield* openDb({ dataDir: join(import.meta.dirname, 'fixtures/data') })
      const failingDb = { ...realDb, queryCanonical: () => Effect.die('execution broke') }
      return yield* ask({ question: 'q', team: 'NJD', db: failingDb, model, traceDir: dir })
    })).pipe(Effect.provide(Llm.layer())))
    assert.equal(result.outcome._tag, 'Crashed')
    const events = readFileSync(join(dir, `${result.runId}.jsonl`), 'utf8')
      .trim().split('\n').map((line) => JSON.parse(line))
    const failures = events.filter((event) => event.type === 'tool_call')
    assert.equal(failures.length, 3)
    for (const event of failures) {
      assert.equal(event.tool, 'answer')
      assert.match(event.error, /execution broke/)
      assert.equal(typeof event.durationMs, 'number')
      assert.ok(event.durationMs >= 0)
    }
  } finally { rmSync(dir, { recursive: true, force: true }) }
})
