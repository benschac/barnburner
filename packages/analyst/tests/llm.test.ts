import { test } from 'node:test'
import assert from 'node:assert/strict'
import { Effect } from 'effect'
import { MockLanguageModelV4 } from 'ai/test'
import { Llm, LlmError, defaultLlmConfig, llmConfigFromEnv } from '../src/llm.ts'

const usage = {
  inputTokens: { total: 10, noCache: 10, cacheRead: undefined, cacheWrite: undefined },
  outputTokens: { total: 5, text: 5, reasoning: undefined },
}

const run = <A, E>(effect: Effect.Effect<A, E, Llm>) => Effect.runPromise(effect.pipe(Effect.provide(Llm.layer())))

test('llm: run returns text, steps, usage and toolCalls from a mock model', async () => {
  const model = new MockLanguageModelV4({
    doGenerate: async () => ({
      content: [{ type: 'text', text: 'hello' }],
      finishReason: { unified: 'stop', raw: undefined },
      usage,
      warnings: [],
    }),
  })
  const result = await run(Llm.run({ system: 'be brief', prompt: 'hi', model }))
  assert.equal(result.text, 'hello')
  assert.equal(result.steps.length, 1)
  assert.deepEqual(result.toolCalls, [])
  assert.equal(result.usage.inputTokens, 10)
  assert.equal(model.doGenerateCalls.length, 1)
})

test('llm: failures map to LlmError', async () => {
  const model = new MockLanguageModelV4({
    doGenerate: async () => { throw new Error('boom') },
  })
  const error = await run(Llm.run({ prompt: 'hi', model, }).pipe(Effect.flip))
  assert.ok(error instanceof LlmError)
  assert.match(error.message, /boom/)
})

test('llm: config defaults and env overrides', () => {
  assert.deepEqual(llmConfigFromEnv({}), defaultLlmConfig)
  assert.deepEqual(
    llmConfigFromEnv({ ANALYST_GENERATE_MODEL: 'a/b', ANALYST_RANK_MODEL: 'c/d' }),
    { generateModel: 'a/b', rankModel: 'c/d' },
  )
})

test('llm: structured generation forwards cancellation to the provider', async () => {
  const { Schema } = await import('effect')
  const { makeLlm } = await import('../src/llm.ts')
  let started!: () => void
  const ready = new Promise<void>((resolve) => { started = resolve })
  let signal: AbortSignal | undefined
  const model = new MockLanguageModelV4({
    doGenerate: (options) => {
      signal = options.abortSignal
      started()
      return new Promise((_resolve, reject) => {
        options.abortSignal?.addEventListener('abort', () => reject(new Error('aborted')), { once: true })
      })
    },
  })
  const controller = new AbortController()
  const pending = Effect.runPromiseExit(makeLlm().generateObject({ schema: Schema.Struct({ value: Schema.String }), prompt: 'hi', model }), { signal: controller.signal })
  await ready
  controller.abort()
  await pending
  assert.equal(signal?.aborted, true)
})
