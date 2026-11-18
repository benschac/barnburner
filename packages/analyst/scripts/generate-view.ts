import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Effect, Result, Schema } from 'effect'
import { ViewData } from '@nhl-reddit-stats/viz'
import { logError } from '../../../lib/logger.mjs'
import { Llm } from '../src/llm.ts'
import { toPrettyJson } from '../src/json.ts'
import { generateChecked, ViewCodeError } from '../src/viz/generate.ts'

export class GenerateCommandError extends Schema.TaggedError<GenerateCommandError, { readonly brand: unique symbol }>()('GenerateCommandError', {
  message: Schema.String,
}) {}

const usage = 'Usage: node packages/analyst/scripts/generate-view.ts --prompt "text" --tables <file> --vocabulary antv|d3 --out <file>'
const vocabularies = { antv: 'view-antv.md', d3: 'view-d3.md' } as const
type Vocabulary = keyof typeof vocabularies

export interface GenerateArgs {
  readonly prompt: string
  readonly tables: string
  readonly vocabulary: Vocabulary
  readonly out: string
}

// Flags are `--name value` pairs. Every flag is required and may appear once.
export const parseArgs = (argv: ReadonlyArray<string>): Result.Result<GenerateArgs, GenerateCommandError> => {
  const values = new Map<string, string>()
  for (let index = 0; index < argv.length; index += 2) {
    const name = argv[index]
    const value = argv[index + 1]
    if (name === undefined || !name.startsWith('--') || value === undefined || value.startsWith('--') || values.has(name)) {
      return Result.fail(new GenerateCommandError({ message: usage }))
    }
    values.set(name, value)
  }
  const prompt = values.get('--prompt')
  const tables = values.get('--tables')
  const vocabulary = values.get('--vocabulary')
  const out = values.get('--out')
  const known = ['--prompt', '--tables', '--vocabulary', '--out']
  const unknown = [...values.keys()].some((name) => !known.includes(name))
  if (unknown || prompt === undefined || tables === undefined || out === undefined || (vocabulary !== 'antv' && vocabulary !== 'd3')) {
    return Result.fail(new GenerateCommandError({ message: usage }))
  }
  return Result.succeed({ prompt, tables: resolve(tables), vocabulary, out: resolve(out) })
}

const decodeTables = Schema.decodeUnknownResult(Schema.fromJsonString(ViewData))

const run = (args: GenerateArgs) =>
  Effect.gen(function* () {
    const text = yield* Effect.try({
      try: () => readFileSync(args.tables, 'utf8'),
      catch: () => new GenerateCommandError({ message: `Cannot read ${args.tables}` }),
    })
    const data = yield* Effect.fromResult(
      Result.mapError(decodeTables(text), () => new GenerateCommandError({ message: `${args.tables} is not { tables, notes }` })),
    )
    const system = readFileSync(new URL(`../src/prompts/${vocabularies[args.vocabulary]}`, import.meta.url), 'utf8')
    const result = yield* generateChecked({ prompt: args.prompt, tables: data.tables, notes: data.notes, system })
    yield* Effect.sync(() => writeFileSync(args.out, result.code))
    return {
      title: result.title,
      model: result.model,
      tokens: { input: result.usage.inputTokens ?? 0, output: result.usage.outputTokens ?? 0, total: result.usage.totalTokens ?? 0 },
      repairs: result.repairs,
      out: args.out,
    }
  }).pipe(
    Effect.catchTag('ViewCodeError', (error: ViewCodeError) =>
      Effect.sync(() => {
        logError(`${error.message} (model ${error.model}, ${error.attempts} attempts, ${error.totalTokens} tokens)`)
        process.exitCode = 1
        return undefined
      }),
    ),
    Effect.provide(Llm.layer()),
  )

// Imported by the test, the command runs only when executed directly.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const parsed = parseArgs(process.argv.slice(2))
  if (Result.isFailure(parsed)) {
    logError(parsed.failure.message)
    process.exitCode = 1
  } else {
    await Effect.runPromise(run(parsed.success)).then((summary) => {
      if (summary !== undefined) process.stdout.write(`${toPrettyJson(summary)}\n`)
    }, (error: unknown) => {
      logError(String(error))
      process.exitCode = 1
    })
  }
}
