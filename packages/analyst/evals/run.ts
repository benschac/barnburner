import { createHash, randomUUID } from 'node:crypto'
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Array, DateTime, Effect, Match, Order, Schema } from 'effect'
import { logError } from '../../../lib/logger.mjs'
import { ask, ASK_SYSTEM } from '../src/ask.ts'
import type { AskResult } from '../src/ask.ts'
import { openDb } from '../src/db.ts'
import { toPrettyJson } from '../src/json.ts'
import { Llm, llmConfigFromEnv } from '../src/llm.ts'
import type { Db } from '../src/shapes.ts'
import { EvalCases } from './case.ts'
import type { EvalAnswer, EvalCase } from './case.ts'
import { runEvals } from './runner.ts'

export class EvalCliError extends Schema.TaggedError<EvalCliError, { readonly brand: unique symbol }>()('EvalCliError', {
  message: Schema.String,
}) {}

const io = <A>(operation: () => Promise<A>) => Effect.tryPromise({
  try: operation,
  catch: (cause) => new EvalCliError({ message: String(cause) }),
})
const hash = (text: string) => createHash('sha256').update(text).digest('hex')
const here = dirname(fileURLToPath(import.meta.url))

export const loadCases = (dir: string) => Effect.gen(function* () {
  const entries = yield* io(() => readdir(dir))
  const names = Array.sort(entries.filter((name) => name.endsWith('.json')), Order.String)
  const loaded = yield* Effect.forEach(names, (name) => Effect.gen(function* () {
    const text = yield* io(() => readFile(join(dir, name), 'utf8'))
    const decoded = yield* Schema.decodeUnknownEffect(Schema.fromJsonString(EvalCases))(text).pipe(
      Effect.mapError((error) => new EvalCliError({ message: `${name}: ${error.message}` })),
    )
    return { decoded, file: { file: name, sha256: hash(text) } }
  }))
  const cases: EvalCase[] = loaded.flatMap((item) => item.decoded)
  const files = loaded.map((item) => item.file)
  if (!cases.length) return yield* new EvalCliError({ message: 'No eval cases found' })
  if (new Set(cases.map((item) => item.id)).size !== cases.length) {
    return yield* new EvalCliError({ message: 'Duplicate eval case IDs' })
  }
  return { cases, files }
})

export const evalAnswer = (result: AskResult): Effect.Effect<EvalAnswer, EvalCliError> => Match.value(result.outcome).pipe(
  Match.tagsExhaustive({
    Answered: (answer) => typeof answer.value === 'number' && Number.isFinite(answer.value)
      ? Effect.succeed<EvalAnswer>({ _tag: 'Answered', value: answer.value, coverage: answer.coverage })
      : Effect.fail(new EvalCliError({ message: 'Answer is not a finite number' })),
    Declined: (answer) => Effect.succeed<EvalAnswer>(answer),
    Crashed: (answer) => Effect.fail(new EvalCliError({ message: answer.reason })),
  }),
)

export const evaluate = <E, R>(input: {
  readonly cases: readonly EvalCase[]
  readonly db: Db
  readonly answer: (item: EvalCase) => Effect.Effect<AskResult, E, R>
}) => Effect.gen(function* () {
  const runs: Array<{ caseId: string; run: AskResult }> = []
  const services = yield* Effect.context<R>()
  const result = yield* runEvals({
    cases: input.cases,
    db: input.db,
    answerer: (item) => input.answer(item).pipe(
      Effect.provide(services),
      Effect.tap((run) => Effect.sync(() => { runs.push({ caseId: item.id, run }) })),
      Effect.flatMap(evalAnswer),
    ),
  })
  return { ...result, invalidFixtures: result.results.filter((item) => item.invalid).length, runs }
})

const snapshotData = (dir: string) => Effect.gen(function* () {
  const entries = yield* io(() => readdir(join(dir, 'boxscores/20262027')))
  const boxscores = Array.sort(entries.filter((name) => name.endsWith('.json')), Order.String)
  const names = ['nhl-20262027.json', 'nhl-poster-20262027.json', 'teams.json', ...boxscores.map((name) => `boxscores/20262027/${name}`)]
  return yield* Effect.forEach(names, (file) => Effect.map(
    io(() => readFile(join(dir, file))),
    (bytes) => ({ file, sha256: createHash('sha256').update(bytes).digest('hex') }),
  ))
})

export const snapshotImplementation = (root: string) => io(async () => {
  const names = ['bun.lock', 'package.json', 'packages/analyst/package.json',
    ...['run.ts', 'runner.ts', 'grade.ts', 'case.ts'].map((file) => `packages/analyst/evals/${file}`)]
  const visit = async (relative: string): Promise<void> => {
    const entries = await readdir(join(root, relative), { withFileTypes: true })
    for (const entry of entries) {
      const file = `${relative}/${entry.name}`
      if (entry.isDirectory()) await visit(file)
      else if (entry.isFile()) names.push(file)
    }
  }
  await visit('packages/analyst/src')
  const files: { file: string; sha256: string }[] = []
  for (const file of Array.sort(names, Order.String)) {
    const bytes = await readFile(join(root, file))
    files.push({ file, sha256: createHash('sha256').update(bytes).digest('hex') })
  }
  return files
})

export interface OfflineEvaluation {
  readonly mode: 'offline'
  readonly answer: (item: EvalCase) => Effect.Effect<AskResult, EvalCliError>
}

export const runCli = (
  args: readonly string[],
  out: (text: string) => void = (text) => process.stdout.write(`${text}\n`),
  offline?: OfflineEvaluation,
) => Effect.gen(function* () {
  if (args.includes('--help')) {
    out('Usage: bun run evals --data-dir PATH [--output-dir PATH] [--cases-dir PATH]\nUses the configured live model; writes a JSON receipt and per-question traces.')
    return
  }
  const options = new Map<string, string>()
  let invalidOption: string | undefined
  for (let index = 0; index < args.length; index += 2) {
    const key = args[index]
    if (key === undefined) break
    const value = args[index + 1]
    if (!['--data-dir', '--output-dir', '--cases-dir'].includes(key) || !value || value.startsWith('--') || options.has(key)) {
      invalidOption = key
      break
    }
    options.set(key, value)
  }
  if (invalidOption !== undefined) return yield* new EvalCliError({ message: `Invalid or duplicate option: ${invalidOption}` })
  const dataDir = options.get('--data-dir')
  if (!dataDir) return yield* new EvalCliError({ message: '--data-dir is required' })
  const dataset = yield* loadCases(resolve(options.get('--cases-dir') ?? join(here, 'qa')))
  const prompt = yield* io(() => readFile(join(here, '../src/ask.ts'), 'utf8'))
  const config = llmConfigFromEnv()
  const outputDir = resolve(options.get('--output-dir') ?? join(here, 'results'))
  const startedNow = yield* DateTime.now
  const startedAt = DateTime.formatIso(startedNow)
  const runId = `${startedAt.replaceAll(':', '-')}-${randomUUID()}`
  const implementation = yield* snapshotImplementation(resolve(here, '../../..'))
  const dataSnapshot = yield* snapshotData(resolve(dataDir))
  const report = yield* Effect.scoped(Effect.gen(function* () {
    const db = yield* openDb({ dataDir: resolve(dataDir) })
    return yield* evaluate({
      cases: dataset.cases,
      db,
      answer: offline?.answer ?? ((item) => ask({ question: item.question, team: item.team, db, traceDir: join(outputDir, 'traces') }).pipe(Effect.mapError((error) => new EvalCliError({ message: error.message })))),
    })
  })).pipe(Effect.provide(Llm.layer(config)))
  const after = yield* snapshotData(resolve(dataDir))
  if (toPrettyJson(dataSnapshot) !== toPrettyJson(after)) return yield* new EvalCliError({ message: 'Data changed during evaluation; receipt not published' })
  const implementationAfter = yield* snapshotImplementation(resolve(here, '../../..'))
  if (toPrettyJson(implementation) !== toPrettyJson(implementationAfter)) return yield* new EvalCliError({ message: 'Implementation changed during evaluation; receipt not published' })
  const completedNow = yield* DateTime.now
  const completedAt = DateTime.formatIso(completedNow)
  const receipt = { version: 1, implementation, runtime: { version: process.version, versions: process.versions, platform: process.platform, arch: process.arch }, mode: offline?.mode ?? 'live', runId, startedAt, completedAt, config,
    dataDir: resolve(dataDir), dataset: dataset.files, dataSnapshot, systemPromptSha256: hash(ASK_SYSTEM), askSourceSha256: hash(prompt), ...report }
  yield* io(() => mkdir(outputDir, { recursive: true }))
  const path = join(outputDir, `${runId}-agent.json`)
  yield* io(() => writeFile(path, `${toPrettyJson(receipt)}\n`, { flag: 'wx' }))
  out(`${report.passed}/${report.total} passed; ${report.invalidFixtures} invalid fixtures. Receipt: ${path}`)
})

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await Effect.runPromise(runCli(process.argv.slice(2)).pipe(Effect.catch((error) => Effect.sync(() => {
    logError(String(error))
    process.exitCode = 1
  }))))
}
