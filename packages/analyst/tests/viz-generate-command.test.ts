import { test } from 'node:test'
import assert from 'node:assert/strict'
import { Result } from 'effect'
import { parseArgs } from '../scripts/generate-view.ts'

const full = ['--prompt', 'show goals', '--tables', 't.json', '--vocabulary', 'antv', '--out', 'v.tsx']

test('parseArgs accepts all four flags and resolves the paths', () => {
  const parsed = parseArgs(full)
  assert.ok(Result.isSuccess(parsed))
  assert.equal(parsed.success.prompt, 'show goals')
  assert.equal(parsed.success.vocabulary, 'antv')
  assert.ok(parsed.success.tables.endsWith('t.json'))
})

test('parseArgs rejects a missing flag, an unknown vocabulary, a duplicate flag and an unknown flag', () => {
  assert.ok(Result.isFailure(parseArgs(full.slice(2))))
  assert.ok(Result.isFailure(parseArgs(['--prompt', 'x', '--tables', 't', '--vocabulary', 'plotly', '--out', 'o'])))
  assert.ok(Result.isFailure(parseArgs([...full, '--prompt', 'again'])))
  assert.ok(Result.isFailure(parseArgs([...full, '--team', 'NJD'])))
})
