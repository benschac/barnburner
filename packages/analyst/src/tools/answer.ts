import { Effect, Result } from 'effect'
import { jsonSchema, tool } from 'ai'
import type { Answer, Coverage, Db, Guard, Row } from '../shapes.ts'

export interface AnswerDeps {
  readonly db: Db
  readonly guard: Guard
  // Team whose boxscore coverage is attached when the query reads box scores.
  readonly team: string
  readonly onAnswer: (a: Answer) => void
}

export interface AnswerInput {
  readonly query: string
  readonly row: number
  readonly column: string
}

const fail = (reason: string): string => `ERROR: ${reason}`

// Exact SQL text; the fake DB in tests keys on it.
export const coverageSql = (team: string): string =>
  `SELECT archived, finals FROM boxscore_coverage WHERE team = '${team.replaceAll("'", "''")}'`

const readCoverage = async (deps: AnswerDeps): Promise<Coverage | 'missing' | string> => {
  const result = await Effect.runPromise(Effect.result(deps.db.query(coverageSql(deps.team))))
  if (Result.isFailure(result)) return result.failure.message
  const row = result.success.rows[0]
  if (row === undefined) return 'missing'
  const { archived, finals } = row
  if (typeof archived !== 'number' || typeof finals !== 'number') return 'boxscore_coverage has no numeric counts'
  return { archived, finals }
}

// Returns "ok" or "ERROR: <reason>". Tool errors go back to the model as text.
export const runAnswer = async (deps: AnswerDeps, input: AnswerInput): Promise<string> => {
  const verdict = await Effect.runPromise(deps.guard(deps.db, input.query))
  if (!verdict.ok) return fail(verdict.reason)

  const result = await Effect.runPromise(Effect.result(deps.db.queryCanonical(input.query)))
  if (Result.isFailure(result)) return fail(result.failure.message)
  const rows: readonly Row[] = result.success.rows

  if (!Number.isInteger(input.row) || input.row < 0 || input.row >= rows.length) {
    return fail(`row ${input.row} is out of range (result has ${rows.length} rows)`)
  }
  const row = rows[input.row] as Row
  if (!Object.hasOwn(row, input.column)) {
    return fail(`column ${input.column} is not in the result (columns: ${Object.keys(row).join(', ') || 'none'})`)
  }
  const value = row[input.column]

  let coverage: Coverage | undefined
  if (verdict.touchesBoxscores) {
    const found = await readCoverage(deps)
    if (typeof found === 'string') {
      if (found === 'missing') return fail(`no boxscore_coverage row for ${deps.team}`)
      return fail(`coverage query failed: ${found}`)
    }
    coverage = found
  }

  deps.onAnswer({ value, query: input.query, ...(coverage === undefined ? {} : { coverage }) })
  return 'ok'
}

export const makeAnswerTool = (deps: AnswerDeps) =>
  tool({
    description:
      'Record the answer to the user question. Give the SQL query, the zero-based row index, and the column name of the single cell that answers the question. The query must be a single SELECT over the allowed views.',
    inputSchema: jsonSchema<AnswerInput>({
      type: 'object',
      properties: {
        query: { type: 'string', description: 'A single SELECT statement.' },
        row: { type: 'integer', minimum: 0, description: 'Zero-based row index in the query result.' },
        column: { type: 'string', description: 'Column name in the query result.' },
      },
      required: ['query', 'row', 'column'],
      additionalProperties: false,
    }),
    execute: (input) => runAnswer(deps, input),
  })
