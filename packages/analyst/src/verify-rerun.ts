import { isDeepStrictEqual } from 'node:util'
import { Effect } from 'effect'
import type { InsightCard } from './card.ts'
import type { Db, Row, VerifyResult } from './shapes.ts'

export const coverageSql = (team: string): string =>
  `SELECT archived, finals FROM boxscore_coverage WHERE team = '${team}'`

const fail = (check: number, detail: string): VerifyResult => ({ ok: false, check, detail })
const pass: VerifyResult = { ok: true }

const json = (value: unknown): string => JSON.stringify(value)
// Rerun a query; a SqlError becomes a failure of the given check.
const rerun = (check: number, run: Effect.Effect<{ rows: Row[] }, { message: string }>) =>
  Effect.mapError(run, (e) => fail(check, e.message))

const check5 = (db: Db, card: InsightCard) =>
  Effect.map(
    rerun(5, db.queryCanonical(card.evidence.query)),
    ({ rows }): VerifyResult =>
      isDeepStrictEqual(JSON.parse(json(rows)), JSON.parse(json(card.evidence.result))) ? pass : fail(5, 'canonical rerun differs from evidence.result'),
  )

const check6 = (db: Db, card: InsightCard, finals: ReadonlySet<number>) => {
  const { gamesQuery, gameIds } = card.evidence
  const verifyIds = (ids: ReadonlyArray<unknown>): VerifyResult => {
    if (json(ids) !== json(gameIds)) return fail(6, 'canonical rerun of gamesQuery differs from gameIds')
    const missing = gameIds.filter((id) => !finals.has(id))
    return missing.length === 0 ? pass : fail(6, `game ids not final: ${missing.join(', ')}`)
  }
  if (gamesQuery === undefined) return Effect.succeed(gameIds.length === 0 ? pass : fail(6, 'gameIds present without gamesQuery'))
  return Effect.map(rerun(6, db.queryCanonical(gamesQuery)), ({ rows }) => verifyIds(rows.map((r) => r['game_id'])))
}

const check7 = (db: Db, card: InsightCard, touchesBoxscores: boolean) => {
  const { coverage } = card.evidence
  if (!touchesBoxscores) return Effect.succeed(coverage === undefined ? pass : fail(7, 'coverage present on a card that does not touch box scores'))
  if (coverage === undefined) return Effect.succeed(fail(7, 'coverage missing on a card that touches box scores'))
  return Effect.map(rerun(7, db.query(coverageSql(card.team))), ({ rows }): VerifyResult => {
    const row = rows[0]
    if (rows.length !== 1 || row === undefined) return fail(7, 'boxscore_coverage must return exactly one row')
    return row['archived'] === coverage.archived && row['finals'] === coverage.finals
      ? pass
      : fail(7, `coverage ${json(coverage)} differs from boxscore_coverage ${json(row)}`)
  })
}

const check8 = (db: Db, card: InsightCard) => {
  if (card.assert === undefined) return Effect.succeed(pass)
  return Effect.map(rerun(8, db.query(card.assert)), ({ rows }): VerifyResult => {
    const row = rows[0]
    if (rows.length !== 1 || row === undefined) return fail(8, 'assert must return exactly one row')
    const values = Object.values(row)
    if (values.length !== 1) return fail(8, 'assert must return exactly one column')
    return values[0] === true ? pass : fail(8, 'assert did not return true')
  })
}

export const verifyRerun = (
  deps: { db: Db },
  card: InsightCard,
  ctx: { touchesBoxscores: boolean; finals: ReadonlySet<number> },
): Effect.Effect<VerifyResult> => {
  const { db } = deps
  const steps = [
    () => check5(db, card),
    () => check6(db, card, ctx.finals),
    () => check7(db, card, ctx.touchesBoxscores),
    () => check8(db, card),
  ]
  return Effect.gen(function* () {
    for (const step of steps) {
      const result = yield* Effect.match(step(), { onFailure: (f) => f, onSuccess: (s) => s })
      if (!result.ok) return result
    }
    return pass
  })
}
