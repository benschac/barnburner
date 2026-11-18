import assert from 'node:assert/strict'
import { test } from 'node:test'
import { Result } from 'effect'
import { samples } from '@nhl-reddit-stats/viz/samples'
import { benchDataFromTables, benchScript, decodeBenchText, frameRates, median, scriptMs, stepsDue, summarize, worst } from '../src/viz/bench/stats.ts'

test('median of odd, even, and empty lists', () => {
  assert.equal(median([3, 1, 2]), 2)
  assert.equal(median([4, 1, 3, 2]), 2.5)
  assert.equal(median([]), 0)
})

test('worst is the lowest rate, 0 when empty', () => {
  assert.equal(worst([60, 30, 59]), 30)
  assert.equal(worst([]), 0)
})

test('frameRates turns gaps into rates and skips equal times', () => {
  assert.deepEqual(frameRates([0, 10, 20, 20, 70]), [100, 100, 20])
  assert.deepEqual(frameRates([5]), [])
})

test('summarize reports the median and the worst frame rate', () => {
  const summary = summarize([0, 10, 20, 70])
  assert.equal(summary.frames, 4)
  assert.equal(summary.medianFps, 100)
  assert.equal(summary.worstFps, 20)
})

test('the script spans ten seconds, is ordered, and zooms cancel out', () => {
  const script = benchScript()
  assert.equal(script.length, scriptMs / 50)
  assert.ok(script.every((step, index) => index === 0 || step.atMs > script[index - 1].atMs))
  assert.ok(script.every((step) => step.atMs < scriptMs))
  const net = script.reduce((scale, step) => (step._tag === 'zoom' ? scale * step.factor : scale), 1)
  assert.ok(Math.abs(net - 1) < 1e-9)
  assert.ok(script.some((step) => step._tag === 'pan'))
})

test('stepsDue returns a half-open window', () => {
  const script = benchScript()
  assert.deepEqual(stepsDue(script, 0, 100).map((step) => step.atMs), [0, 50])
  assert.equal(stepsDue(script, 0, scriptMs).length, script.length)
  assert.equal(stepsDue(script, 100, 100).length, 0)
})

for (const name of ['ego', 'league'] as const) {
  const { tables } = samples[name]

  test(`${name} export maps players to nodes and links to links`, () => {
    const data = benchDataFromTables(tables)
    assert.equal(data.nodes.length, tables.players.length)
    assert.equal(data.links.length, tables.links.length)
    assert.deepEqual(data.nodes[0], { playerId: tables.players[0].playerId, name: tables.players[0].name, games: tables.players[0].games })
    assert.deepEqual(data.links[0], { a: tables.links[0].a, b: tables.links[0].b, games: tables.links[0].games })
  })

  test(`${name} export file text decodes to the same data`, () => {
    const decoded = decodeBenchText(JSON.stringify(samples[name]))
    assert.ok(Result.isSuccess(decoded))
    assert.deepEqual(decoded.success, benchDataFromTables(tables))
  })
}

test('a { nodes, links } file still decodes; other JSON fails with a tagged error', () => {
  const plain = { nodes: [{ playerId: 1, name: 'A', games: 2 }], links: [{ a: 1, b: 2, games: 3 }] }
  const ok = decodeBenchText(JSON.stringify(plain))
  assert.ok(Result.isSuccess(ok))
  assert.deepEqual(ok.success, plain)
  const bad = decodeBenchText('{"x":1}')
  assert.ok(Result.isFailure(bad))
  assert.equal(bad.failure._tag, 'BenchFileError')
})
