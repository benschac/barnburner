import { Effect } from 'effect'
import { SqlError } from '../src/shapes.ts'
import type { Db, Guard, GuardResult, Row, Verify, VerifyResult } from '../src/shapes.ts'

export const fakeDb = (responses: Record<string, Row[] | SqlError>): Db => {
  const run = (sql: string) => {
    const r = responses[sql]
    if (r === undefined) return Effect.fail(new SqlError({ message: 'no fake response', sql }))
    if (r instanceof SqlError) return Effect.fail(r)
    return Effect.succeed({ rows: r, rowCount: r.length })
  }
  return { query: run, queryCanonical: run }
}

export const fakeGuard =
  (result: GuardResult): Guard =>
  () =>
    Effect.succeed(result)

export const fakeVerify =
  (result: VerifyResult): Verify =>
  () =>
    Effect.succeed(result)
