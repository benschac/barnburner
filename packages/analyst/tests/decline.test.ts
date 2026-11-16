import assert from 'node:assert/strict'
import { test } from 'node:test'
import { makeDeclineTool, runDecline } from '../src/tools/decline.ts'

test('records the trimmed reason and returns ok', () => {
  const reasons: string[] = []
  const deps = { onDecline: (reason: string) => reasons.push(reason) }
  assert.equal(runDecline(deps, { reason: '  no playoff data  ' }), 'ok')
  assert.deepEqual(reasons, ['no playoff data'])
})

test('a blank reason returns ERROR text and records nothing', () => {
  const reasons: string[] = []
  const deps = { onDecline: (reason: string) => reasons.push(reason) }
  assert.equal(runDecline(deps, { reason: '   ' }), 'ERROR: reason is required')
  assert.deepEqual(reasons, [])
})

test('makeDeclineTool builds a tool', () => {
  assert.ok(makeDeclineTool({ onDecline: () => {} }))
})
