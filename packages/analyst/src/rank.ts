import { Array, Effect, Option, Order, Result, Schema } from 'effect'
import type { LanguageModel } from 'ai'
import { Llm } from './llm.ts'
import type { LlmError } from './llm.ts'
import type { InsightCard } from './card.ts'
import { toJson } from './json.ts'
import { render } from './render.ts'
import type { RenderError, Row } from './render.ts'

export class RankError extends Schema.TaggedError<RankError, { readonly brand: unique symbol }>()('RankError', {
  message: Schema.String,
  raw: Schema.optional(Schema.String),
}) {}

const Score = Schema.Int.check(Schema.isBetween({ minimum: 1, maximum: 5 }))
export const RankScores = Schema.Struct({
  scores: Schema.Array(Schema.Struct({ id: Schema.String, novelty: Score, specificity: Score, readability: Score })),
})
export type RankScores = typeof RankScores.Type

export interface RankedCard {
  readonly card: InsightCard
  readonly novelty: number
  readonly specificity: number
  readonly readability: number
  readonly total: number
}

export const TOP_N = 3

export const normalizeHeadline = (headline: string): string =>
  headline
    .toLowerCase()
    .replace(/\{[^}]*\}/g, ' ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

// Dedupe by id first, then by near-identical headline; first occurrence wins.
export const dedupeCards = (cards: ReadonlyArray<InsightCard>): ReadonlyArray<InsightCard> => {
  const ids = new Set<string>()
  const headlines = new Set<string>()
  const kept: InsightCard[] = []
  for (const card of cards) {
    if (ids.has(card.id)) continue
    const key = normalizeHeadline(card.headline)
    if (headlines.has(key)) continue
    ids.add(card.id)
    headlines.add(key)
    kept.push(card)
  }
  return kept
}

const system = [
  'You are a judge ranking candidate insight cards for an NHL team poster.',
  'Score each card from 1 (poor) to 5 (excellent) on three axes:',
  '- novelty: not already on the poster (see poster facts) and not obvious',
  '- specificity: concrete, quantified, tied to evidence',
  '- readability: clear, concise copy a fan understands at a glance',
  'Reply with JSON only, no prose, no code fences, exactly: {"scores":[{"id":"...","novelty":1,"specificity":1,"readability":1}]}',
  'Include every card id exactly once. Scores are integers 1-5.',
].join('\n')

export interface DroppedCard {
  readonly id: string
  readonly reason: string
}

export interface RankResult {
  readonly ranked: ReadonlyArray<RankedCard>
  readonly dropped: ReadonlyArray<DroppedCard>
}

interface RenderedCard {
  readonly card: InsightCard
  readonly headline: string
  readonly body: string
}

const renderCard = (card: InsightCard): Result.Result<RenderedCard, DroppedCard> => {
  const rows = card.evidence.result as unknown as Row[]
  const dropped = (error: RenderError) => Result.fail<DroppedCard>({ id: card.id, reason: `render failed: ${error.message}` })
  const headline = render(card.headline, card.bindings, rows)
  if (Result.isFailure(headline)) return dropped(headline.failure)
  const body = render(card.body, card.bindings, rows)
  if (Result.isFailure(body)) return dropped(body.failure)
  return Result.succeed({ card, headline: headline.success, body: body.success })
}

const buildPrompt = (cards: ReadonlyArray<RenderedCard>, posterFacts: ReadonlyArray<string>) =>
  toJson({
    posterFacts,
    cards: cards.map((c) => ({
      id: c.card.id,
      team: c.card.team,
      kind: c.card.kind,
      headline: c.headline,
      body: c.body,
      headlineTemplate: c.card.headline,
    })),
  })

// The first reason the ranker's scores do not cover the cards exactly once; undefined when they do.
const scoreProblem = (parsed: RankScores, ids: ReadonlySet<string>): string | undefined => {
  const seen = new Set<string>()
  for (const s of parsed.scores) {
    if (!ids.has(s.id)) return `ranker scored unknown id ${s.id}`
    if (seen.has(s.id)) return `ranker scored id ${s.id} twice`
    seen.add(s.id)
  }
  for (const id of ids) {
    if (!seen.has(id)) return `ranker did not score id ${id}`
  }
  return undefined
}

const validateScores = (parsed: RankScores, ids: ReadonlySet<string>): Effect.Effect<RankScores, RankError> => {
  const problem = scoreProblem(parsed, ids)
  return problem === undefined ? Effect.succeed(parsed) : Effect.fail(new RankError({ message: problem }))
}

// Highest total first; ties by card id.
const byRank: Order.Order<RankedCard> = Order.combine(
  Order.flip(Order.mapInput(Order.Number, (ranked: RankedCard) => ranked.total)),
  Order.mapInput(Order.String, (ranked: RankedCard) => ranked.card.id),
)

export interface RankInput {
  readonly cards: ReadonlyArray<InsightCard>
  readonly posterFacts: ReadonlyArray<string>
  readonly model?: LanguageModel
}

export const rank = (input: RankInput): Effect.Effect<RankResult, RankError | LlmError, Llm> =>
  Effect.gen(function* () {
    const [renderedCards, dropped] = Array.partition(dedupeCards(input.cards), renderCard)
    const cards = renderedCards.map((r) => r.card)
    if (cards.length === 0) return { ranked: [], dropped }
    const llm = yield* Llm
    const result = yield* llm.generateObject({
      schema: RankScores,
      system,
      prompt: buildPrompt(renderedCards, input.posterFacts),
      model: input.model ?? llm.config.rankModel,
    }).pipe(Effect.catchTag('LlmOutputError', (error) => Effect.fail(new RankError({ message: error.message, ...(error.raw === undefined ? {} : { raw: error.raw }) }))))
    const parsed = yield* validateScores(result.object, new Set(cards.map((c) => c.id)))
    const byId = new Map(parsed.scores.map((s) => [s.id, s]))
    const ranked = yield* Effect.forEach(cards, (card) => Option.match(Option.fromNullishOr(byId.get(card.id)), {
      onNone: () => Effect.fail(new RankError({ message: `No score for card ${card.id}` })),
      onSome: (s): Effect.Effect<RankedCard> => Effect.succeed({ card, novelty: s.novelty, specificity: s.specificity, readability: s.readability, total: s.novelty + s.specificity + s.readability }),
    }))
    const top = Array.sort(ranked, byRank).slice(0, TOP_N)
    return { ranked: top, dropped }
  })
