// Bake-off runner (card FE2): for each prompt and each vocabulary, generate a view, render it, repair on a
// failure at most twice, and write one record. The model and the renderer are injected, so tests stub both.
// Largest run: 5 prompts x 2 vocabularies x (1 generate + 2 repairs) = 30 model calls.

import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { NodeRuntime } from '@effect/platform-node'
import { Array as Arr, Effect, Order, Record, Schema } from 'effect'
import { checkViewCode } from '@nhl-reddit-stats/viz/check-view-code'
import { ViewData } from '@nhl-reddit-stats/viz'
import type { Tables } from '@nhl-reddit-stats/viz'
import { generateView, repairView, describeFailure, MAX_REPAIRS } from '../../src/viz/generate.ts'
import type { ViewFailure } from '../../src/viz/generate.ts'
import { Llm, llmConfigFromEnv } from '../../src/llm.ts'
import type { LlmError, LlmOutputError } from '../../src/llm.ts'
import { toPrettyJson } from '../../src/json.ts'
import type { RenderHarnessError, RenderViewResult } from './render.ts'
import type { BakeoffRecord } from './report.ts'

export class BakeoffError extends Schema.TaggedError<BakeoffError, { readonly brand: unique symbol }>()('BakeoffError', {
  message: Schema.String,
}) {}

export class BakeoffBudgetError extends Schema.TaggedError<BakeoffBudgetError, { readonly brand: unique symbol }>()('BakeoffBudgetError', {
  budget: Schema.Int,
  message: Schema.String,
}) {}

export type BakeoffOutputRecord = BakeoffRecord & { readonly failureMessage: string | null }

export class DatasetFileError extends Schema.TaggedError<DatasetFileError, { readonly brand: unique symbol }>()('DatasetFileError', {
  directory: Schema.String,
  dataset: Schema.String,
  matches: Schema.Array(Schema.String),
}) {
  override get message(): string {
    return `dataset ${this.dataset} in ${this.directory}: expected one file, found ${this.matches.length === 0 ? 'none' : this.matches.join(', ')}`
  }
}

// A 1x1 transparent PNG.
const PLACEHOLDER_PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64')

export const DEFAULT_CALL_BUDGET = 30
export const VOCABULARIES = ['antv', 'd3'] as const
export type Vocabulary = (typeof VOCABULARIES)[number]

export const BakeoffPrompt = Schema.Struct({ id: Schema.String, prompt: Schema.String })
export type BakeoffPrompt = typeof BakeoffPrompt.Type

export interface Generated {
  readonly code: string
  readonly model: string
  readonly tokens: number
}

export type ModelError = LlmError | LlmOutputError | BakeoffError

export interface BakeoffModel {
  readonly generate: (input: { readonly prompt: string; readonly tables: Tables; readonly notes: string; readonly system: string }) => Effect.Effect<Generated, ModelError>
  readonly repair: (input: { readonly code: string; readonly failure: ViewFailure; readonly system: string }) => Effect.Effect<Generated, ModelError>
}

export type BakeoffRenderer = (input: {
  readonly code: string
  readonly tables: Tables
  readonly notes: string
  readonly screenshotPath: string
}) => Effect.Effect<RenderViewResult, RenderHarnessError | BakeoffError>

export interface BakeoffInput {
  readonly prompts: ReadonlyArray<BakeoffPrompt>
  // Prompt id to the path of its export file ({ tables, notes }).
  readonly datasetPaths: Readonly<Record<string, string>>
  // Vocabulary to its system prompt text.
  readonly systems: Readonly<Record<Vocabulary, string>>
  readonly model: BakeoffModel
  readonly render: BakeoffRenderer
  readonly outDir: string
  readonly callBudget?: number
}

const here = dirname(fileURLToPath(import.meta.url))
export const defaultPromptsPath = join(here, 'prompts.json')
export const defaultOutDir = join(here, '../../../../data/history/viz/bakeoff')

const io = <A>(operation: () => Promise<A>) =>
  Effect.tryPromise({ try: operation, catch: (cause) => new BakeoffError({ message: String(cause) }) })

const decodePrompts = Schema.decodeUnknownEffect(Schema.fromJsonString(Schema.Array(BakeoffPrompt)))
const decodeViewData = Schema.decodeUnknownEffect(Schema.fromJsonString(ViewData))

export const loadPrompts = (path: string = defaultPromptsPath) =>
  Effect.gen(function* () {
    const text = yield* io(() => readFile(path, 'utf8'))
    return yield* decodePrompts(text).pipe(Effect.mapError((error) => new BakeoffError({ message: `${path}: ${error.message}` })))
  })

export const loadSystems = Effect.gen(function* () {
    const read = (name: string) => io(() => readFile(join(here, '../../src/prompts', name), 'utf8'))
    return { antv: yield* read('view-antv.md'), d3: yield* read('view-d3.md') } satisfies Record<Vocabulary, string>
})

// The real model: generateView and repairView over the Llm service built from the environment.
// For each dataset id: <id>.json if it exists, else the single <id>-*.json. Anything else is a DatasetFileError.
export const resolveDatasetPaths = (directory: string, ids: ReadonlyArray<string>) =>
  Effect.gen(function* () {
    const names = yield* io(() => readdir(directory))
    const entries = yield* Effect.forEach(ids, (id) =>
      Effect.gen(function* () {
        const exact = names.filter((name) => name === `${id}.json`)
        const matches = exact.length === 1 ? exact : Arr.sort(names.filter((name) => name.startsWith(`${id}-`) && name.endsWith('.json')), Order.String)
        if (matches.length !== 1) return yield* new DatasetFileError({ directory, dataset: id, matches })
        return [id, join(directory, matches[0])] as const
      }),
    )
    return Record.fromEntries(entries)
  })

export const llmModel = (model?: Parameters<typeof generateView>[0]['model']): BakeoffModel => {
  const layer = Llm.layer(llmConfigFromEnv())
  const run = (effect: Effect.Effect<{ readonly code: string; readonly model: string; readonly usage: { readonly totalTokens?: number | undefined } }, LlmError | LlmOutputError, Llm>) =>
    effect.pipe(
      Effect.provide(layer),
      Effect.map((result): Generated => ({ code: result.code, model: result.model, tokens: result.usage.totalTokens ?? 0 })),
    )
  const pick = model === undefined ? {} : { model }
  return {
    generate: (input) => run(generateView({ ...input, ...pick })),
    repair: (input) => run(repairView({ ...input, ...pick })),
  }
}

export const runBakeoff = (input: BakeoffInput): Effect.Effect<ReadonlyArray<BakeoffOutputRecord>, BakeoffError | BakeoffBudgetError | RenderHarnessError | LlmError | LlmOutputError> =>
  Effect.gen(function* () {
    const budget = input.callBudget ?? DEFAULT_CALL_BUDGET
    let calls = 0
    const spend = Effect.gen(function* () {
      if (calls >= budget) {
        return yield* new BakeoffBudgetError({ budget, message: `model call budget of ${budget} reached` })
      }
      calls += 1
    })
    yield* io(() => mkdir(input.outDir, { recursive: true }))
    const attempt = (
      pair: { readonly system: string; readonly data: ViewData; readonly screenshotPath: string },
      progress: { readonly current: Generated; readonly tokens: number; readonly repairs: number },
    ): Effect.Effect<{ readonly current: Generated; readonly tokens: number; readonly repairs: number; readonly result: RenderViewResult }, BakeoffError | BakeoffBudgetError | RenderHarnessError | ModelError> =>
      Effect.gen(function* () {
        const { system, data, screenshotPath } = pair
        const { current, tokens, repairs } = progress
        const problems = checkViewCode(current.code)
        let failure: ViewFailure | undefined
        let result: RenderViewResult
        if (problems.length > 0) {
          failure = problems
          // The candidate never reaches the renderer: its record gets a placeholder image the report can read.
          yield* io(() => writeFile(screenshotPath, PLACEHOLDER_PNG))
          result = { outcome: 'Failed', firstPaintMs: 0, medianFps: 0, screenshotPath, failureMessage: describeFailure(problems) }
        } else {
          result = yield* input.render({ code: current.code, tables: data.tables, notes: data.notes, screenshotPath })
          if (result.outcome === 'Failed') failure = result.failureMessage ?? 'The frame reported Failed while rendering the module.'
        }
        if (failure === undefined || repairs >= MAX_REPAIRS) return { current, tokens, repairs, result }
        yield* spend
        const next = yield* input.model.repair({ code: current.code, failure: describeFailure(failure), system })
        return yield* attempt(pair, { current: next, tokens: tokens + next.tokens, repairs: repairs + 1 })
      })
    const runPair = (item: BakeoffPrompt, data: ViewData, vocabulary: Vocabulary) =>
      Effect.gen(function* () {
        const system = input.systems[vocabulary]
        const screenshotPath = join(input.outDir, `${item.id}-${vocabulary}.png`)
        yield* spend
        const first = yield* input.model.generate({ prompt: item.prompt, tables: data.tables, notes: data.notes, system })
        const { current, tokens, repairs, result } = yield* attempt({ system, data, screenshotPath }, { current: first, tokens: first.tokens, repairs: 0 })
        const record: BakeoffOutputRecord = {
          prompt: item.prompt,
          dataset: item.id,
          vocabulary,
          outcome: result.outcome,
          repairs,
          model: current.model,
          tokens,
          firstPaintMs: result.firstPaintMs,
          medianFps: result.medianFps,
          screenshotPath: result.screenshotPath,
          code: current.code,
          failureMessage: result.failureMessage,
        }
        yield* io(() => writeFile(join(input.outDir, `${item.id}-${vocabulary}.json`), toPrettyJson(record) + '\n'))
        return record
      })
    const runPrompt = (item: BakeoffPrompt) =>
      Effect.gen(function* () {
        const path = input.datasetPaths[item.id]
        if (path === undefined) return yield* new BakeoffError({ message: `no dataset path for prompt ${item.id}` })
        const text = yield* io(() => readFile(path, 'utf8'))
        const data = yield* decodeViewData(text).pipe(Effect.mapError((error) => new BakeoffError({ message: `${path}: ${error.message}` })))
        return yield* Effect.forEach(VOCABULARIES, (vocabulary) => runPair(item, data, vocabulary))
      })
    const perPrompt = yield* Effect.forEach(input.prompts, runPrompt)
    return Arr.flatten(perPrompt)
  })

// One command for the gate: prints the budget and the pair count, and runs only with --yes.
const program = Effect.gen(function* () {
    const { parseArgs } = yield* io(() => import('node:util'))
    const { values } = yield* Effect.try({
      try: () =>
        parseArgs({
          options: {
            'base-url': { type: 'string' },
            datasets: { type: 'string' },
            out: { type: 'string' },
            budget: { type: 'string' },
            yes: { type: 'boolean' },
          },
        }),
      catch: (cause) => new BakeoffError({ message: `bad arguments: ${String(cause)}` }),
    })
    const budget = values.budget === undefined ? DEFAULT_CALL_BUDGET : Number(values.budget)
    const prompts = yield* loadPrompts()
    const pairs = prompts.length * VOCABULARIES.length
    yield* Effect.log(`call budget: ${budget}; prompt and vocabulary pairs: ${pairs}`)
    if (values.yes !== true) return
    if (values['base-url'] === undefined || values.datasets === undefined || !Number.isInteger(budget)) {
      return yield* new BakeoffError({ message: '--base-url, --datasets and an integer --budget are required with --yes' })
    }
    const baseUrl = values['base-url']
    const { renderView } = yield* io(() => import('./render.ts'))
    const datasetPaths = yield* resolveDatasetPaths(values.datasets, prompts.map((item) => item.id))
    const records = yield* runBakeoff({
      prompts,
      datasetPaths,
      systems: yield* loadSystems,
      model: llmModel(),
      render: (input) =>
        renderView({ baseUrl, code: input.code, tables: input.tables, notes: input.notes, screenshotPath: input.screenshotPath }),
      outDir: values.out ?? defaultOutDir,
      callBudget: budget,
    })
    yield* Effect.log(`wrote ${records.length} records`)
})

if (import.meta.main) NodeRuntime.runMain(program)
