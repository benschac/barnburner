import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, readdir, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Effect, Result } from 'effect'
import { runBakeoff, loadPrompts, BakeoffBudgetError } from './bakeoff.ts'
import type { BakeoffModel, BakeoffRenderer } from './bakeoff.ts'

const GOOD = 'export default function view() { return null }'
const BAD = 'import x from "y"\nexport default 1'

const setup = async (ids: ReadonlyArray<string>) => {
  const dir = await mkdtemp(join(tmpdir(), 'bakeoff-'))
  const datasetPaths: Record<string, string> = {}
  for (const id of ids) {
    datasetPaths[id] = join(dir, `${id}.json`)
    await writeFile(datasetPaths[id], '{"tables":{"t":[{"a":1}]},"notes":"n"}')
  }
  return { dir, datasetPaths }
}

const systems = { antv: 'A', d3: 'D' }

const stubModel = (codes: string[], counter: { n: number }): BakeoffModel => {
  const next = () => {
    counter.n += 1
    return Effect.succeed({ code: codes.shift() ?? GOOD, model: 'stub', tokens: 10 })
  }
  return { generate: () => next(), repair: () => next() }
}

const okRender: BakeoffRenderer = (input) =>
  Effect.succeed({ outcome: 'Rendered', firstPaintMs: 5, medianFps: 60, screenshotPath: input.screenshotPath, failureMessage: null })

test('prompts.json holds the five prompts', async () => {
  const prompts = await Effect.runPromise(loadPrompts())
  assert.deepEqual(prompts.map((p) => p.id), ['chain', 'ego', 'league', 'opponents', 'finals'])
})

test('writes one record per prompt and vocabulary, summing tokens across repairs', async () => {
  const { dir, datasetPaths } = await setup(['chain'])
  const counter = { n: 0 }
  // antv: check failure, then frame Failed, then good (2 repairs). d3: good first time.
  const model = stubModel([BAD, GOOD, GOOD, GOOD], counter)
  let renders = 0
  const render: BakeoffRenderer = (input) => {
    renders += 1
    return Effect.succeed({ outcome: renders === 1 ? 'Failed' : 'Rendered', firstPaintMs: 5, medianFps: 30, screenshotPath: input.screenshotPath, failureMessage: null })
  }
  const records = await Effect.runPromise(
    runBakeoff({ prompts: [{ id: 'chain', prompt: 'p' }], datasetPaths, systems, model, render, outDir: join(dir, 'out') }),
  )
  assert.equal(records.length, 2)
  assert.equal(records[0].repairs, 2)
  assert.equal(records[0].tokens, 30)
  assert.equal(records[0].outcome, 'Rendered')
  assert.equal(records[1].repairs, 0)
  assert.equal(counter.n, 4)
  assert.deepEqual((await readdir(join(dir, 'out'))).sort(), ['chain-antv.json', 'chain-d3.json'])
})

test('stops repairing after two and records Failed', async () => {
  const { dir, datasetPaths } = await setup(['chain'])
  const counter = { n: 0 }
  const render: BakeoffRenderer = (input) =>
    Effect.succeed({ outcome: 'Failed', firstPaintMs: 1, medianFps: 0, screenshotPath: input.screenshotPath, failureMessage: 'boom' })
  const records = await Effect.runPromise(
    runBakeoff({ prompts: [{ id: 'chain', prompt: 'p' }], datasetPaths, systems, model: stubModel([], counter), render, outDir: join(dir, 'out') }),
  )
  assert.deepEqual(records.map((r) => [r.outcome, r.repairs]), [['Failed', 2], ['Failed', 2]])
  assert.equal(counter.n, 6)
})

test('refuses to exceed the call budget', async () => {
  const { dir, datasetPaths } = await setup(['chain'])
  const counter = { n: 0 }
  const render: BakeoffRenderer = (input) =>
    Effect.succeed({ outcome: 'Failed', firstPaintMs: 1, medianFps: 0, screenshotPath: input.screenshotPath, failureMessage: 'boom' })
  const result = await Effect.runPromise(
    Effect.result(runBakeoff({ prompts: [{ id: 'chain', prompt: 'p' }], datasetPaths, systems, model: stubModel([], counter), render, outDir: join(dir, 'out'), callBudget: 4 })),
  )
  assert.ok(Result.isFailure(result))
  assert.ok(result.failure instanceof BakeoffBudgetError)
  assert.equal(counter.n, 4)
})

test('default budget is 30, enough for a full run', async () => {
  const ids = ['chain', 'ego', 'league', 'opponents', 'finals']
  const { dir, datasetPaths } = await setup(ids)
  const counter = { n: 0 }
  const render: BakeoffRenderer = (input) =>
    Effect.succeed({ outcome: 'Failed', firstPaintMs: 1, medianFps: 0, screenshotPath: input.screenshotPath, failureMessage: 'boom' })
  const records = await Effect.runPromise(
    runBakeoff({ prompts: ids.map((id) => ({ id, prompt: id })), datasetPaths, systems, model: stubModel([], counter), render, outDir: join(dir, 'out') }),
  )
  assert.equal(records.length, 10)
  assert.equal(counter.n, 30)
})

test('okRender stub is usable', async () => {
  const r = await Effect.runPromise(okRender({ code: GOOD, tables: {}, notes: '', screenshotPath: 'x' }))
  assert.equal(r.outcome, 'Rendered')
})

test('a frame failure message reaches the repair prompt and the record', async () => {
  const { dir, datasetPaths } = await setup(['chain'])
  const failures: unknown[] = []
  const model: BakeoffModel = {
    generate: () => Effect.succeed({ code: GOOD, model: 'stub', tokens: 1 }),
    repair: (input) => {
      failures.push(input.failure)
      return Effect.succeed({ code: GOOD, model: 'stub', tokens: 1 })
    },
  }
  let renders = 0
  const render: BakeoffRenderer = (input) => {
    renders += 1
    return Effect.succeed(
      renders === 1
        ? { outcome: 'Failed', firstPaintMs: 1, medianFps: 0, screenshotPath: input.screenshotPath, failureMessage: 'x is not defined' }
        : { outcome: 'Rendered', firstPaintMs: 1, medianFps: 1, screenshotPath: input.screenshotPath, failureMessage: null },
    )
  }
  const records = await Effect.runPromise(
    runBakeoff({ prompts: [{ id: 'chain', prompt: 'p' }], datasetPaths, systems, model, render, outDir: join(dir, 'out') }),
  )
  assert.deepEqual(failures, ['x is not defined'])
  assert.equal(records[0].repairs, 1)
})
