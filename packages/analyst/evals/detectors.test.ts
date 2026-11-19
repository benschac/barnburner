import assert from 'node:assert/strict'
import { test } from 'node:test'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Effect } from 'effect'
import { DETECTORS, formatReport, runDetectorEval } from './detectors.ts'

const fixtureDataDir = join(fileURLToPath(new URL('.', import.meta.url)), '..', 'tests', 'fixtures', 'data')

test('every detector passes on the fixture data for both fixture teams', async () => {
  const report = await Effect.runPromise(runDetectorEval({ dataDir: fixtureDataDir }))
  assert.equal(report.teams, 2)
  assert.equal(report.total, DETECTORS.length * 2)
  assert.equal(report.passed, report.total)
  assert.equal(report.passRate, 1)
  assert.deepEqual(report.failures, [])
  assert.deepEqual(Object.keys(report.byDetector).sort(), DETECTORS.map((d) => d.name).sort())
})

test('formatReport names the overall rate, each detector, and the failures', async () => {
  const report = await Effect.runPromise(runDetectorEval({ dataDir: fixtureDataDir }))
  const text = formatReport(report)
  assert.match(text, /Pass rate: 14\/14 = 100\.0% across 2 teams/)
  assert.match(text, /streak: 2\/2 = 100\.0%/)
  assert.match(text, /Failures by check:\n {2}none/)
})
