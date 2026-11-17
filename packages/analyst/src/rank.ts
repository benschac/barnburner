import { Effect, Result, Schema } from 'effect'
import type { LanguageModel } from 'ai'
import { Llm } from './llm.ts'
import type { LlmError } from './llm.ts'
import type { InsightCard } from './card.ts'
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

const renderCard = (card: InsightCard): RenderedCard | DroppedCard => {
  const rows = card.evidence.result as unknown as Row[]
  const dropped = (error: RenderError): DroppedCard => ({ id: card.id, reason: `render failed: ${error.message}` })
  const headline = render(card.headline, card.bindings, rows)
  if (Result.isFailure(headline)) return dropped(headline.failure)
  const body = render(card.body, card.bindings, rows)
  if (Result.isFailure(body)) return dropped(body.failure)
  return { card, headline: headline.success, body: body.success }
}

const buildPrompt = (cards: ReadonlyArray<RenderedCard>, posterFacts: ReadonlyArray<string>) =>
  JSON.stringify({
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

const stripFences = (text: string) => text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')

const parseScores = (text: string, ids: ReadonlySet<string>): Effect.Effect<RankScores, RankError> =>
  Effect.gen(function* () {
    const json = yield* Effect.try({
      try: () => JSON.parse(stripFences(text)) as unknown,
      catch: () => new RankError({ message: 'ranker reply is not valid JSON', raw: text }),
    })
    const parsed = yield* Schema.decodeUnknownEffect(RankScores)(json).pipe(
      Effect.mapError((e) => new RankError({ message: `ranker reply failed validation: ${String(e)}`, raw: text })),
    )
    const seen = new Set<string>()
    for (const s of parsed.scores) {
      if (!ids.has(s.id)) return yield* new RankError({ message: `ranker scored unknown id ${s.id}`, raw: text })
      if (seen.has(s.id)) return yield* new RankError({ message: `ranker scored id ${s.id} twice`, raw: text })
      seen.add(s.id)
    }
    for (const id of ids) {
      if (!seen.has(id)) return yield* new RankError({ message: `ranker did not score id ${id}`, raw: text })
    }
    return parsed
  })

export interface RankInput {
  readonly cards: ReadonlyArray<InsightCard>
  readonly posterFacts: ReadonlyArray<string>
  readonly model?: LanguageModel
}

export const rank = (input: RankInput): Effect.Effect<RankResult, RankError | LlmError, Llm> =>
  Effect.gen(function* () {
    const rendered = dedupeCards(input.cards).map(renderCard)
    const dropped = rendered.filter((r): r is DroppedCard => 'reason' in r)
    const renderedCards = rendered.filter((r): r is RenderedCard => 'card' in r)
    const cards = renderedCards.map((r) => r.card)
    if (cards.length === 0) return { ranked: [], dropped }
    const llm = yield* Llm
    const result = yield* llm.run({
      system,
      prompt: buildPrompt(renderedCards, input.posterFacts),
      model: input.model ?? llm.config.rankModel,
    })
    const parsed = yield* parseScores(result.text, new Set(cards.map((c) => c.id)))
    const byId = new Map(parsed.scores.map((s) => [s.id, s]))
    const ranked = cards.map((card): RankedCard => {
      const s = byId.get(card.id)!
      return { card, novelty: s.novelty, specificity: s.specificity, readability: s.readability, total: s.novelty + s.specificity + s.readability }
    })
    const top = ranked
      .sort((a, b) => b.total - a.total || (a.card.id < b.card.id ? -1 : a.card.id > b.card.id ? 1 : 0))
      .slice(0, TOP_N)
    return { ranked: top, dropped }
  })
