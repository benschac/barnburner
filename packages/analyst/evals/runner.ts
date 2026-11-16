import { Effect } from 'effect'
import type { Db } from '../src/shapes.ts'
import type { EvalAnswer, EvalCase } from './case.ts'
import { grade } from './grade.ts'

export type Answerer = (evalCase: EvalCase) => Effect.Effect<EvalAnswer>

export interface CaseResult {
  readonly id: string
  readonly pass: boolean
  readonly reason?: string
  readonly invalid?: true
  readonly truth?: number
  readonly answer?: EvalAnswer
}

export interface EvalRun {
  readonly results: ReadonlyArray<CaseResult>
  readonly passed: number
  readonly total: number
  readonly score: number
}

const describe = (e: unknown): string => {
  if (typeof e === 'object' && e !== null && 'message' in e) return String((e as { message: unknown }).message)
  return String(e)
}

const truthValue = (db: Db, sql: string): Effect.Effect<{ ok: true; value: number } | { ok: false; reason: string }> =>
  db.query(sql).pipe(
    Effect.map((res) => {
      if (res.rows.length !== 1) return { ok: false as const, reason: `truthSql returned ${res.rows.length} rows, expected exactly 1` }
      const cell = (res.rows[0] as Record<string, unknown>).value
      const n = typeof cell === 'bigint' ? Number(cell) : cell
      if (typeof n !== 'number' || !Number.isFinite(n)) return { ok: false as const, reason: 'truthSql value column is not a finite number' }
      return { ok: true as const, value: n }
    }),
    Effect.catch((e) => Effect.succeed({ ok: false as const, reason: `truthSql failed: ${describe(e)}` })),
  )

const runCase = (evalCase: EvalCase, db: Db, answerer: Answerer): Effect.Effect<CaseResult> =>
  Effect.gen(function* () {
    let truth: number | null = null
    if (evalCase.expect === 'value') {
      if (evalCase.truthSql === null) return { id: evalCase.id, pass: false, invalid: true as const, reason: 'invalid case: value case has no truthSql' }
      const t = yield* truthValue(db, evalCase.truthSql)
      if (!t.ok) return { id: evalCase.id, pass: false, invalid: true as const, reason: `invalid case: ${t.reason}` }
      truth = t.value
    }
    const answered = yield* Effect.suspend(() => answerer(evalCase)).pipe(
      Effect.map((answer) => ({ ok: true as const, answer })),
      Effect.catchCause((cause) => Effect.succeed({ ok: false as const, reason: describe(cause) })),
    )
    const base = truth === null ? {} : { truth }
    if (!answered.ok) return { id: evalCase.id, pass: false, reason: `answerer failed: ${answered.reason}`, ...base }
    const g = grade(evalCase, truth, answered.answer)
    return g.pass
      ? { id: evalCase.id, pass: true, answer: answered.answer, ...base }
      : { id: evalCase.id, pass: false, reason: g.reason, answer: answered.answer, ...base }
  })

export const runEvals = (input: {
  readonly cases: ReadonlyArray<EvalCase>
  readonly db: Db
  readonly answerer: Answerer
}): Effect.Effect<EvalRun> =>
  Effect.gen(function* () {
    const results: CaseResult[] = []
    for (const c of input.cases) results.push(yield* runCase(c, input.db, input.answerer))
    const passed = results.filter((r) => r.pass).length
    const total = results.length
    return { results, passed, total, score: total === 0 ? 0 : passed / total }
  })
