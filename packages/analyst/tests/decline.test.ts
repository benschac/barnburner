import { Effect } from 'effect'
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { asSchema } from 'ai'
import { makeDeclineTool, runDecline } from '../src/tools/decline.ts'

test('records the trimmed reason and returns ok', () => {
  const reasons: string[] = []
  const deps = { onDecline: (reason: string) => reasons.push(reason) }
  assert.equal(Effect.runSync(runDecline(deps, { reason: '  no playoff data  ' })), 'ok')
  assert.deepEqual(reasons, ['no playoff data'])
})

test('a blank reason returns ERROR text and records nothing', () => {
  const reasons: string[] = []
  const deps = { onDecline: (reason: string) => reasons.push(reason) }
  assert.equal(Effect.runSync(runDecline(deps, { reason: '   ' })), 'ERROR: reason must be a non-empty string')
  assert.deepEqual(reasons, [])
})

test('makeDeclineTool builds a tool', () => {
  assert.ok(makeDeclineTool({ onDecline: () => {} }))
})

test('regression: a non-string reason returns ERROR text and does not throw', () => {
  const reasons: string[] = []
  const deps = { onDecline: (reason: string) => reasons.push(reason) }
  assert.equal(Effect.runSync(runDecline(deps, { reason: 42 })), 'ERROR: reason must be a non-empty string')
  assert.equal(Effect.runSync(runDecline(deps, undefined)), 'ERROR: input must be an object')
  assert.deepEqual(reasons, [])
})

test('regression: the tool schema validate callback rejects a non-string reason', async () => {
  const schema = asSchema(makeDeclineTool({ onDecline: () => {} }).inputSchema)
  const validate = schema.validate
  assert.ok(validate)
  assert.equal((await validate({ reason: 42 })).success, false)
  assert.equal((await validate({ reason: '   ' })).success, false)
  const good = await validate({ reason: ' no data ' })
  assert.deepEqual(good.success && good.value, { reason: 'no data' })
})
