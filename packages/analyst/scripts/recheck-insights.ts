import { readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { Effect } from 'effect'
import type { InsightCard } from '../src/card.ts'
import { recheck } from '../src/recheck.ts'
import type { RecheckContext } from '../src/recheck.ts'
import type { Db, Guard } from '../src/shapes.ts'
import { readCards, writeCards } from '../src/store.ts'

export interface RecheckOptions {
  readonly dir: string
  readonly deps: { db: Db; guard: Guard }
  readonly ctx: RecheckContext
}

export interface RecheckSummary {
  readonly unchanged: number
  readonly refreshed: number
  readonly stale: number
}

const allTeams = (dir: string): string[] =>
  readdirSync(dir)
    .filter((name) => /^[A-Z]{3}\.json$/.test(name))
    .map((name) => name.slice(0, 3))
    .sort()

// Rechecks every approved card in every team file and writes back only the files that changed.
export const runRecheck = async ({ dir, deps, ctx }: RecheckOptions): Promise<RecheckSummary> => {
  const summary = { unchanged: 0, refreshed: 0, stale: 0 }
  for (const team of allTeams(dir)) {
    const cards = readCards(dir, team)
    let changed = false
    const updated: InsightCard[] = []
    for (const card of cards) {
      const result = await Effect.runPromise(recheck(deps, card, ctx))
      summary[result.change] += 1
      if (result.change !== 'unchanged') changed = true
      updated.push(result.card)
    }
    if (changed) writeCards(dir, team, updated)
  }
  return summary
}

const main = (): void => {
  // TODO: build the real database with openDb, take the guard from src/guard.ts, and compute finals and asOf.
  throw new Error('guard not wired yet')
}

if (process.argv[1] !== undefined && import.meta.url === new URL(`file://${resolve(process.argv[1])}`).href) main()
