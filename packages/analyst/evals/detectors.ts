import { readFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'
import { Effect, Match, Schema } from 'effect'
import { openDb } from '../src/db.ts'
import { guardQuery } from '../src/guard.ts'
import type { CardDraft, InsightCard } from '../src/card.ts'
import { extraTime } from '../src/detectors/extra-time.ts'
import { goalieStarts } from '../src/detectors/goalie-starts.ts'
import { homeAway } from '../src/detectors/home-away.ts'
import { lastTen } from '../src/detectors/last-ten.ts'
import { oneGoal } from '../src/detectors/one-goal.ts'
import { pointsLeader } from '../src/detectors/points-leader.ts'
import { streak } from '../src/detectors/streak.ts'
import { fillCard } from '../src/tools/submit-card.ts'
import type { CardMeta } from '../src/tools/submit-card.ts'
import type { Verify, VerifyResult } from '../src/shapes.ts'
import { verifyCard } from '../src/verify.ts'
import { scoreCards } from './card-pass-rate.ts'

export class EvalDetectorsError extends Schema.TaggedError<EvalDetectorsError, { readonly brand: unique symbol }>()('EvalDetectorsError', {
  message: Schema.String,
}) {}

const TeamsFile = Schema.Array(Schema.Struct({ abbrev: Schema.String }))

export interface DetectorDef {
  readonly name: string
  readonly run: (team: string) => CardDraft[]
}

export const DETECTORS: readonly DetectorDef[] = [
  { name: 'extraTime', run: extraTime },
  { name: 'goalieStarts', run: goalieStarts },
  { name: 'homeAway', run: homeAway },
  { name: 'lastTen', run: lastTen },
  { name: 'oneGoal', run: oneGoal },
  { name: 'pointsLeader', run: pointsLeader },
  { name: 'streak', run: streak },
]

// Check 0 is not a verifier check. It counts drafts that fillCard refused (guard or SQL failure) before verification.
export const FILL_CHECK = 0

export interface DetectorFailure {
  readonly team: string
  readonly detector: string
  readonly check: number
  readonly detail: string
}

export interface DetectorScore {
  readonly total: number
  readonly passed: number
  readonly passRate: number
}

export interface DetectorReport {
  readonly teams: number
  readonly total: number
  readonly passed: number
  readonly passRate: number
  readonly byDetector: Readonly<Record<string, DetectorScore>>
  // Failing cards keyed by check; FILL_CHECK for drafts that could not be filled.
  readonly failuresByCheck: Readonly<Record<number, number>>
  readonly failures: readonly DetectorFailure[]
}

interface Tally {
  total: number
  passed: number
  failuresByCheck: Record<number, number>
}

type FillOutcome =
  | { readonly _tag: 'Filled'; readonly card: InsightCard }
  | { readonly _tag: 'Unfilled'; readonly message: string }

const readTeams = (dataDir: string) =>
  Effect.gen(function* () {
    const text = yield* Effect.tryPromise({
      try: () => readFile(join(dataDir, 'teams.json'), 'utf8'),
      catch: (cause) => new EvalDetectorsError({ message: `cannot read teams.json: ${String(cause)}` }),
    })
    const teams = yield* Schema.decodeUnknownEffect(Schema.fromJsonString(TeamsFile))(text).pipe(
      Effect.mapError((error) => new EvalDetectorsError({ message: `teams.json: ${error.message}` })),
    )
    return teams.map((team) => team.abbrev)
  })

// Runs every detector for every team in data/teams.json through fillCard and verifyCard, then scores the cards.
export const runDetectorEval = (input: { readonly dataDir: string }) =>
  Effect.scoped(
    Effect.gen(function* () {
      const dataDir = resolve(input.dataDir)
      const teams = yield* readTeams(dataDir)
      const db = yield* openDb({ dataDir })
      const guard = guardQuery
      const deps = { db, guard }

      const finalRows = (yield* db.query('SELECT DISTINCT game_id FROM team_games WHERE is_final')).rows
      const finals = new Set(finalRows.map((row) => row['game_id']).filter((id): id is number => typeof id === 'number'))
      const meta: CardMeta = {
        model: 'detectors',
        runId: 'detectors',
        asOf: { fetchedAt: new Date().toISOString(), completedGameIds: finals.size },
      }

      const tallies = new Map<string, Tally>()
      const failures: DetectorFailure[] = []
      for (const detector of DETECTORS) {
        const tally: Tally = { total: 0, passed: 0, failuresByCheck: {} }
        tallies.set(detector.name, tally)
        for (const team of teams) {
          const filled: InsightCard[] = []
          let fillFailures = 0
          for (const draft of detector.run(team)) {
            const outcome: FillOutcome = yield* Effect.match(fillCard(deps, draft, meta), {
              onFailure: (error): FillOutcome => ({ _tag: 'Unfilled', message: error.message }),
              onSuccess: (card): FillOutcome => ({ _tag: 'Filled', card }),
            })
            Match.value(outcome).pipe(
              Match.tagsExhaustive({
                Filled: ({ card }) => {
                  filled.push(card)
                },
                Unfilled: ({ message }) => {
                  fillFailures += 1
                  failures.push({ team, detector: detector.name, check: FILL_CHECK, detail: message })
                },
              }),
            )
          }

          const details: DetectorFailure[] = []
          const verify: Verify = (card, finalIds) =>
            verifyCard(deps, card, finalIds).pipe(
              Effect.tap((result: VerifyResult) =>
                Effect.sync(() => {
                  if (!result.ok) details.push({ team, detector: detector.name, check: result.check, detail: result.detail })
                }),
              ),
            )
          const score = yield* scoreCards(filled, verify, finals)
          failures.push(...details)

          tally.total += filled.length + fillFailures
          tally.passed += score.passed
          for (const [check, count] of Object.entries(score.failuresByCheck)) {
            const key = Number(check)
            tally.failuresByCheck[key] = (tally.failuresByCheck[key] ?? 0) + count
          }
          if (fillFailures > 0) tally.failuresByCheck[FILL_CHECK] = (tally.failuresByCheck[FILL_CHECK] ?? 0) + fillFailures
        }
      }

      const rate = (passed: number, total: number) => (total === 0 ? 0 : passed / total)
      const byDetector: Record<string, DetectorScore> = {}
      const failuresByCheck: Record<number, number> = {}
      let total = 0
      let passed = 0
      for (const [name, tally] of tallies) {
        byDetector[name] = { total: tally.total, passed: tally.passed, passRate: rate(tally.passed, tally.total) }
        total += tally.total
        passed += tally.passed
        for (const [check, count] of Object.entries(tally.failuresByCheck)) {
          const key = Number(check)
          failuresByCheck[key] = (failuresByCheck[key] ?? 0) + count
        }
      }
      return { teams: teams.length, total, passed, passRate: rate(passed, total), byDetector, failuresByCheck, failures } satisfies DetectorReport
    }),
  )

const checkLabel = (check: number): string => (check === FILL_CHECK ? 'fill (draft could not be filled)' : `check ${check}`)

export const formatReport = (report: DetectorReport): string => {
  const pct = (rate: number) => `${(rate * 100).toFixed(1)}%`
  const lines = [
    `Pass rate: ${report.passed}/${report.total} = ${pct(report.passRate)} across ${report.teams} teams`,
    '',
    'By detector:',
    ...Object.entries(report.byDetector).map(([name, s]) => `  ${name}: ${s.passed}/${s.total} = ${pct(s.passRate)}`),
    '',
    'Failures by check:',
    ...(Object.keys(report.failuresByCheck).length === 0
      ? ['  none']
      : Object.entries(report.failuresByCheck).map(([check, count]) => `  ${checkLabel(Number(check))}: ${count}`)),
    '',
    'Failing cards:',
    ...(report.failures.length === 0
      ? ['  none']
      : report.failures.map((f) => `  ${f.team} ${f.detector} ${checkLabel(f.check)}: ${f.detail}`)),
  ]
  return lines.join('\n')
}

export const runCli = (args: readonly string[], out: (text: string) => void = console.log) =>
  Effect.gen(function* () {
    const parsed = yield* Effect.try({
      try: () => parseArgs({ args: [...args], options: { 'data-dir': { type: 'string' } }, strict: true }),
      catch: (cause) => new EvalDetectorsError({ message: String(cause) }),
    })
    const dataDir = parsed.values['data-dir'] ?? resolve(import.meta.dirname, '../../../data')
    const report = yield* runDetectorEval({ dataDir })
    out(formatReport(report))
  })

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await Effect.runPromise(
    runCli(process.argv.slice(2)).pipe(
      Effect.catch((error) =>
        Effect.sync(() => {
          console.error(String(error))
          process.exitCode = 1
        }),
      ),
    ),
  )
}
