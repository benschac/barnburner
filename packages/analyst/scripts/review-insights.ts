import { readdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { createInterface } from 'node:readline'
import { fileURLToPath } from 'node:url'
import { Result } from 'effect'
import { logError } from '../../../lib/logger.mjs'
import { type InsightCard, RejectReason } from '../src/card.ts'
import type { RenderError } from '../src/render.ts'
import { applyDecision, formatForReview } from '../src/review.ts'
import type { NotPendingError } from '../src/review.ts'
import { readCards, writeCards } from '../src/store.ts'
import type { StoreError } from '../src/store.ts'

export interface ReviewOptions {
  readonly dir: string
  readonly teams?: readonly string[] | undefined
  // Called only after the card and its prompt were written to out. Resolves undefined at end of input.
  readonly nextLine: () => Promise<string | undefined>
  readonly out: (text: string) => void
  readonly now: string
}

export interface ReviewSummary {
  readonly approved: number
  readonly rejected: number
  readonly skipped: number
}

export type ReviewError = StoreError | RenderError | NotPendingError

const REASONS: readonly string[] = RejectReason.literals
const isReason = (text: string): text is RejectReason => REASONS.includes(text)

const allTeams = (dir: string): string[] =>
  readdirSync(dir)
    .filter((name) => /^[A-Z]{3}\.json$/.test(name))
    .map((name) => name.slice(0, 3))
    .sort()

// Answers: a = approve, r = reject (next line is the reason), e or empty = skip.
// When the answers run out, the remaining cards are left pending.
// Stops at the first unreadable team file or card that cannot be shown; teams finished before it stay written.
export const runReview = async ({ dir, teams, nextLine, out, now }: ReviewOptions): Promise<Result.Result<ReviewSummary, ReviewError>> => {
  const next = async (): Promise<string | undefined> => (await nextLine())?.trim()
  const summary = { approved: 0, rejected: 0, skipped: 0 }
  let exhausted = false

  const decide = async (card: InsightCard): Promise<Result.Result<{ card: InsightCard; changed: boolean }, ReviewError>> => {
    const decided = (decision: Result.Result<InsightCard, NotPendingError>, changed: boolean) =>
      Result.map(decision, (next) => ({ card: next, changed }))
    const text = formatForReview(card)
    if (Result.isFailure(text)) return Result.fail(text.failure)
    out(text.success)
    out('[a]pprove / [r]eject / [e] skip:')
    const answer = await next()
    if (answer === undefined) {
      exhausted = true
      return Result.succeed({ card, changed: false })
    }
    const key = answer.toLowerCase()
    if (key === 'a') {
      summary.approved += 1
      return decided(applyDecision(card, { action: 'approve' }, now), true)
    }
    if (key === 'r') {
      out(`Reason (${REASONS.join(', ')}):`)
      let reason = (await next())?.toLowerCase()
      while (reason !== undefined && !isReason(reason)) {
        out(`Unknown reason "${reason}".`)
        reason = (await next())?.toLowerCase()
      }
      if (reason === undefined) {
        exhausted = true
        return Result.succeed({ card, changed: false })
      }
      summary.rejected += 1
      return decided(applyDecision(card, { action: 'reject', reason }, now), true)
    }
    summary.skipped += 1
    return decided(applyDecision(card, { action: 'skip' }, now), false)
  }

  for (const team of teams ?? allTeams(dir)) {
    if (exhausted) break
    const updated: InsightCard[] = []
    let changed = false
    const cards = readCards(dir, team)
    if (Result.isFailure(cards)) return Result.fail(cards.failure)
    for (const card of cards.success) {
      if (card.status !== 'pending' || exhausted) {
        updated.push(card)
        continue
      }
      const result = await decide(card)
      if (Result.isFailure(result)) return Result.fail(result.failure)
      updated.push(result.success.card)
      changed = changed || result.success.changed
    }
    if (changed) {
      const written = writeCards(dir, team, updated)
      if (Result.isFailure(written)) return Result.fail(written.failure)
    }
  }
  out(`approved ${summary.approved}, rejected ${summary.rejected}, skipped ${summary.skipped}`)
  return Result.succeed(summary)
}

const main = async (): Promise<void> => {
  const args = process.argv.slice(2)
  const flag = (name: string): string | undefined => {
    const i = args.indexOf(name)
    return i === -1 ? undefined : args[i + 1]
  }
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')
  const dir = flag('--dir') ?? join(root, 'data/insights/20262027')
  const team = flag('--team')
  const rl = createInterface({ input: process.stdin })
  const iterator = rl[Symbol.asyncIterator]()
  try {
    const result = await runReview({
      dir,
      teams: team === undefined ? undefined : [team.toUpperCase()],
      nextLine: async () => {
        const next = await iterator.next()
        return next.done === true ? undefined : next.value
      },
      out: (text) => process.stdout.write(`${text}\n`),
      now: new Date().toISOString(),
    })
    if (Result.isFailure(result)) {
      logError(result.failure.message)
      process.exitCode = 1
    }
  } finally {
    rl.close()
  }
}

if (process.argv[1] !== undefined && import.meta.url === new URL(`file://${resolve(process.argv[1])}`).href) await main()
