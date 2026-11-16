import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { Schema } from 'effect'
import { type InsightCard, InsightCard as InsightCardSchema } from './card.ts'

const CardList = Schema.Array(InsightCardSchema)

export const cardsPath = (dir: string, team: string): string => join(dir, `${team}.json`)

// A missing file reads as []. An invalid file, or a card filed under another team, throws.
export const readCards = (dir: string, team: string): readonly InsightCard[] => {
  const file = cardsPath(dir, team)
  if (!existsSync(file)) return []
  const cards = Schema.decodeUnknownSync(CardList)(JSON.parse(readFileSync(file, 'utf8')))
  const stray = cards.find((card) => card.team !== team)
  if (stray !== undefined) throw new Error(`${file}: card ${stray.id} has team ${stray.team}, expected ${team}`)
  return cards
}

export const writeCards = (dir: string, team: string, cards: readonly InsightCard[]): void => {
  const valid = Schema.decodeUnknownSync(CardList)(cards)
  mkdirSync(dir, { recursive: true })
  writeFileSync(cardsPath(dir, team), `${JSON.stringify(valid, null, 2)}\n`)
}

// Keeps every existing card. Adds incoming cards with new ids. Replaces an existing card
// only when it is pending. Approved, rejected and stale cards are never changed.
export const mergePending = (existing: readonly InsightCard[], incoming: readonly InsightCard[]): InsightCard[] => {
  const merged = [...existing]
  const indexById = new Map<string, number>()
  existing.forEach((card, index) => {
    if (!indexById.has(card.id)) indexById.set(card.id, index)
  })
  for (const card of incoming) {
    const index = indexById.get(card.id)
    if (index === undefined) {
      indexById.set(card.id, merged.length)
      merged.push(card)
    } else if (merged[index]?.status === 'pending') {
      merged[index] = card
    }
  }
  return merged
}
