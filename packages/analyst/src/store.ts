import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { Result, Schema } from 'effect'
import { type InsightCard, InsightCard as InsightCardSchema } from './card.ts'

const CardList = Schema.Array(InsightCardSchema)

export const cardsPath = (dir: string, team: string): string => join(dir, `${team}.json`)

// An expected refusal to read or write a team file: invalid JSON, cards that do not decode,
// or a card filed under another team.
export class StoreError extends Schema.TaggedError<StoreError, { readonly brand: unique symbol }>()('StoreError', {
  file: Schema.String,
  team: Schema.String,
  reason: Schema.String,
}) {
  override get message(): string {
    return `${this.file}: ${this.reason}`
  }
}

const decodeCards = (file: string, team: string, input: unknown): Result.Result<readonly InsightCard[], StoreError> =>
  Result.mapError(Schema.decodeUnknownResult(CardList)(input), (error) => new StoreError({ file, team, reason: `invalid cards: ${String(error)}` }))

// A missing file reads as []. An invalid file, or a card filed under another team, fails with StoreError.
export const readCards = (dir: string, team: string): Result.Result<readonly InsightCard[], StoreError> => {
  const file = cardsPath(dir, team)
  if (!existsSync(file)) return Result.succeed([])
  const text = readFileSync(file, 'utf8')
  const json = Result.try({
    try: () => JSON.parse(text) as unknown,
    catch: (error) => new StoreError({ file, team, reason: `invalid JSON: ${String(error)}` }),
  })
  if (Result.isFailure(json)) return Result.fail(json.failure)
  const cards = decodeCards(file, team, json.success)
  if (Result.isFailure(cards)) return cards
  const stray = cards.success.find((card) => card.team !== team)
  if (stray !== undefined) return Result.fail(new StoreError({ file, team, reason: `card ${stray.id} has team ${stray.team}, expected ${team}` }))
  return cards
}

export const writeCards = (dir: string, team: string, cards: readonly InsightCard[]): Result.Result<void, StoreError> => {
  const file = cardsPath(dir, team)
  // Validate everything before touching the file, so a bad write leaves existing contents unchanged.
  const valid = decodeCards(file, team, cards)
  if (Result.isFailure(valid)) return Result.fail(valid.failure)
  const stray = valid.success.find((card) => card.team !== team)
  if (stray !== undefined) return Result.fail(new StoreError({ file, team, reason: `cannot write card ${stray.id} with team ${stray.team} to ${team}` }))
  mkdirSync(dir, { recursive: true })
  writeFileSync(file, `${JSON.stringify(valid.success, null, 2)}\n`)
  return Result.succeed(undefined)
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
