import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { RejectReason } from '../src/card.ts'
import { applyDecision, formatForReview } from '../src/review.ts'
import { readCards, writeCards } from '../src/store.ts'

export interface ReviewOptions {
  readonly dir: string
  readonly teams?: readonly string[] | undefined
  readonly lines: readonly string[]
  readonly out: (text: string) => void
  readonly now: string
}

export interface ReviewSummary {
  readonly approved: number
  readonly rejected: number
  readonly skipped: number
}

const REASONS: readonly string[] = RejectReason.literals
const isReason = (text: string): text is RejectReason => REASONS.includes(text)

const allTeams = (dir: string): string[] =>
  readdirSync(dir)
    .filter((name) => /^[A-Z]{3}\.json$/.test(name))
    .map((name) => name.slice(0, 3))
    .sort()

// Answers: a = approve, r = reject (next line is the reason), e or empty = skip.
// When the answers run out, the remaining cards are left pending.
export const runReview = ({ dir, teams, lines, out, now }: ReviewOptions): ReviewSummary => {
  let cursor = 0
  const next = (): string | undefined => (cursor < lines.length ? lines[cursor++]?.trim() : undefined)
  const summary = { approved: 0, rejected: 0, skipped: 0 }
  let exhausted = false

  for (const team of teams ?? allTeams(dir)) {
    const cards = readCards(dir, team)
    let changed = false
    const updated = cards.map((card) => {
      if (card.status !== 'pending') return card
      if (exhausted) return card
      out(formatForReview(card))
      out('[a]pprove / [r]eject / [e] skip:')
      const answer = next()
      if (answer === undefined) {
        exhausted = true
        return card
      }
      const key = answer.toLowerCase()
      if (key === 'a') {
        summary.approved += 1
        changed = true
        return applyDecision(card, { action: 'approve' }, now)
      }
      if (key === 'r') {
        out(`Reason (${REASONS.join(', ')}):`)
        let reason = next()?.toLowerCase()
        while (reason !== undefined && !isReason(reason)) {
          out(`Unknown reason "${reason}".`)
          reason = next()?.toLowerCase()
        }
        if (reason === undefined) {
          exhausted = true
          return card
        }
        summary.rejected += 1
        changed = true
        return applyDecision(card, { action: 'reject', reason: reason as RejectReason }, now)
      }
      summary.skipped += 1
      return applyDecision(card, { action: 'skip' }, now)
    })
    if (changed) writeCards(dir, team, updated)
  }
  out(`approved ${summary.approved}, rejected ${summary.rejected}, skipped ${summary.skipped}`)
  return summary
}

const main = (): void => {
  const args = process.argv.slice(2)
  const flag = (name: string): string | undefined => {
    const i = args.indexOf(name)
    return i === -1 ? undefined : args[i + 1]
  }
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')
  const dir = flag('--dir') ?? join(root, 'data/insights/20262027')
  const team = flag('--team')
  const lines = readFileSync(0, 'utf8').split('\n')
  runReview({
    dir,
    teams: team === undefined ? undefined : [team.toUpperCase()],
    lines,
    out: (text) => console.log(text),
    now: new Date().toISOString(),
  })
}

if (process.argv[1] !== undefined && import.meta.url === new URL(`file://${resolve(process.argv[1])}`).href) main()
