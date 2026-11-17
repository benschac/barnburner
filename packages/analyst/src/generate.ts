import { randomUUID } from 'node:crypto'
import { Cause, Effect, Exit, Result, Schema } from 'effect'
import type { LanguageModel, StopCondition, ToolExecuteFunction, ToolSet } from 'ai'
import { stepCountIs } from 'ai'
import type { InsightCard } from './card.ts'
import { guardQuery } from './guard.ts'
import { Llm } from './llm.ts'
import { buildPrompt } from './prompt.ts'
import type { Coverage, Db, Outcome } from './shapes.ts'
import { VIEWS } from './shapes.ts'
import { makeDeclineTool } from './tools/decline.ts'
import { makeSqlTool } from './tools/sql.ts'
import { makeSubmitCardTool } from './tools/submit-card.ts'
import { openTrace } from './trace.ts'
import type { ToolCallEvent, TracePayload } from './trace.ts'
import { makeVerify } from './verify.ts'

export const GENERATE_MAX_STEPS = 25
export const GENERATE_MAX_CARDS = 6

export class GenerateError extends Schema.TaggedError<GenerateError, { readonly brand: unique symbol }>()(
  'GenerateError', { message: Schema.String },
) {}

export interface GenerateInput {
  readonly team: string
  readonly db: Db
  // Facts the poster already states; the prompt tells the model not to restate them.
  readonly posterFacts?: ReadonlyArray<string>
  readonly fetchedAt?: string
  readonly model?: LanguageModel
  readonly traceDir?: string
}
export interface GenerateResult {
  readonly outcome: Outcome
  readonly cards: ReadonlyArray<InsightCard>
  // Why the run declined, found nothing, or crashed.
  readonly reason: string | null
  readonly runId: string
  readonly model: string
  readonly steps: number | null
  readonly inputTokens: number | null
  readonly outputTokens: number | null
  readonly latencyMs: number
}

const sqlText = (value: string): string => value.replaceAll("'", "''")
const isFailureText = (output: string): boolean => output.startsWith('ERROR:') || output.startsWith('FAILED check')

export const generate = (input: GenerateInput): Effect.Effect<GenerateResult, GenerateError, Llm> => Effect.gen(function* () {
  const llm = yield* Llm
  const runId = randomUUID()
  const model = input.model ?? llm.config.generateModel
  const label = typeof model === 'string' ? model : `${model.provider}/${model.modelId}`
  const { team, db } = input
  const fail = (cause: unknown) => new GenerateError({ message: String(cause) })
  const trace = yield* Effect.try({
    try: () => openTrace({ runId, ...(input.traceDir === undefined ? {} : { dir: input.traceDir }) }),
    catch: fail,
  })
  if (Result.isFailure(trace)) return yield* new GenerateError({ message: trace.failure.message })
  const append = (payload: TracePayload) => Effect.try({ try: () => trace.success.append(payload), catch: fail }).pipe(
    Effect.flatMap((result) => Result.isFailure(result)
      ? Effect.fail(new GenerateError({ message: result.failure.message }))
      : Effect.void))

  const coverageRows = (yield* db.query(
    `SELECT finals, archived FROM boxscore_coverage WHERE team = '${sqlText(team)}'`,
  ).pipe(Effect.mapError(fail))).rows
  const coverageRow = coverageRows[0]
  if (coverageRow === undefined || typeof coverageRow['finals'] !== 'number' || typeof coverageRow['archived'] !== 'number') {
    return yield* new GenerateError({ message: `no boxscore_coverage row for ${team}` })
  }
  const coverage: Coverage = { finals: coverageRow['finals'], archived: coverageRow['archived'] }
  const finalRows = (yield* db.query(
    `SELECT game_id FROM team_games WHERE team = '${sqlText(team)}' AND is_final`,
  ).pipe(Effect.mapError(fail))).rows
  const finals = new Set<number>()
  for (const row of finalRows) if (typeof row['game_id'] === 'number') finals.add(row['game_id'])

  const bounded: Db = {
    query: (sql, opts) => db.query(sql, { ...opts, timeoutMs: 10_000, rowCap: 200 }),
    queryCanonical: (sql, opts) => db.queryCanonical(sql, { ...opts, timeoutMs: 10_000, rowCap: 200 }),
  }
  const cards: InsightCard[] = []
  let declined: string | undefined
  const events: ToolCallEvent[] = []
  const failedDurations = new Map<string, number[]>()
  let tracedSteps = 0
  const traced = <I, C>(name: string, execute: ToolExecuteFunction<I, string, C>) =>
    async (toolInput: I, options: Parameters<ToolExecuteFunction<I, string, C>>[1]) => {
      const start = performance.now()
      let completed = false
      try {
        const result = await execute(toolInput, options)
        let output = ''
        if (typeof result === 'string') output = result
        else for await (const part of result) output = part
        events.push({
          type: 'tool_call', tool: name, input: toolInput, output,
          durationMs: performance.now() - start,
          ...(isFailureText(output) ? { error: output } : {}),
        })
        completed = true
        return output
      } finally {
        if (!completed) {
          const durations = failedDurations.get(options.toolCallId) ?? []
          durations.push(performance.now() - start)
          failedDurations.set(options.toolCallId, durations)
        }
      }
    }
  const fetchedAt = input.fetchedAt ?? new Date().toISOString()
  const sql = makeSqlTool({ db: bounded, guard: guardQuery })
  const submit = makeSubmitCardTool({
    db: bounded, guard: guardQuery, verify: makeVerify({ db: bounded, guard: guardQuery }), finals,
    meta: { model: label, runId, asOf: { fetchedAt, completedGameIds: finals.size } },
    onCard: (card) => { cards.push(card) },
  })
  const decline = makeDeclineTool({ onDecline: (reason) => { declined ??= reason } })
  const tools = {
    sql: { ...sql, execute: traced('sql', sql.execute!) },
    submit_card: { ...submit, execute: traced('submit_card', submit.execute!) },
    decline: { ...decline, execute: traced('decline', decline.execute!) },
  }
  let failureStop = false
  const stopWhen: StopCondition<ToolSet> = ({ steps }) => {
    for (const step of steps.slice(tracedSteps)) {
      for (const part of step.content) {
        if (part.type !== 'tool-error') continue
        const error = String(part.error)
        events.push({
          type: 'tool_call', tool: part.toolName, input: part.input ?? null,
          output: `ERROR: ${error}`, error,
          durationMs: failedDurations.get(part.toolCallId)?.shift() ?? null,
        })
      }
    }
    tracedSteps = steps.length
    if (declined !== undefined || cards.length >= GENERATE_MAX_CARDS || stepCountIs(GENERATE_MAX_STEPS)({ steps })) return true
    let failures = 0
    for (const step of steps) {
      for (const part of step.content) {
        if (part.type === 'tool-error') failures++
        else if (part.type === 'tool-result') {
          failures = typeof part.output === 'string' && isFailureText(part.output) ? failures + 1 : 0
        }
        if (failures >= 3) { failureStop = true; return true }
      }
    }
    return false
  }

  const start = Date.now()
  const result = yield* llm.run({
    prompt: buildPrompt({ team, views: VIEWS, coverage, posterFacts: input.posterFacts ?? [] }),
    model, tools, stopWhen,
  }).pipe(Effect.exit)
  const latencyMs = Date.now() - start
  if (Exit.isFailure(result) && result.cause.reasons.some(Cause.isInterruptReason)) return yield* Effect.interrupt
  for (const event of events) yield* append(event)
  for (const card of cards) yield* append({ type: 'card', cardId: card.id, card })
  const finish = (outcome: Outcome, reason: string | null, usage: Pick<GenerateResult, 'steps' | 'inputTokens' | 'outputTokens'>) =>
    append({ type: 'outcome', status: outcome, ...(reason === null ? {} : { detail: reason }) }).pipe(
      Effect.as({ outcome, cards, reason, runId, model: label, latencyMs, ...usage } satisfies GenerateResult),
    )
  if (Exit.isFailure(result)) {
    const reason = String(Cause.squash(result.cause))
    return yield* finish(cards.length > 0 ? 'cards' : 'crashed', cards.length > 0 ? null : reason,
      { steps: null, inputTokens: null, outputTokens: null })
  }
  const value = result.value
  if (value.usage.inputTokens !== undefined && value.usage.outputTokens !== undefined) {
    yield* append({
      type: 'model_call', model: label, latencyMs,
      inputTokens: value.usage.inputTokens, outputTokens: value.usage.outputTokens,
    })
  }
  const usage = { steps: value.steps.length, inputTokens: value.usage.inputTokens ?? null, outputTokens: value.usage.outputTokens ?? null }
  if (cards.length > 0) return yield* finish('cards', null, usage)
  if (declined !== undefined) return yield* finish('declined', declined, usage)
  if (failureStop) return yield* finish('crashed', 'three consecutive tool failures', usage)
  return yield* finish('no_insight', 'model stopped without submitting a verified card or declining', usage)
})
