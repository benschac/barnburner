import { createHash } from 'node:crypto'
import { Schema } from 'effect'

export const RejectReason = Schema.Literals(['wrong', 'trivial', 'already_on_poster', 'misleading', 'bad_copy', 'other'])
export type RejectReason = typeof RejectReason.Type

const TeamCode = Schema.String.check(Schema.isPattern(/^[A-Z]{3}$/))
const Count = Schema.Int.check(Schema.isGreaterThanOrEqualTo(0))
export const CardKind = Schema.Literals(['record', 'trend', 'comparative', 'player'])
const Cell = Schema.Union([Schema.String, Schema.Number, Schema.Boolean, Schema.Null])
const Row = Schema.Record(Schema.String, Cell)

// Fields the model writes.
const draftFields = {
  team: TeamCode,
  kind: CardKind,
  headline: Schema.String,
  body: Schema.String,
  // Every {placeholder} maps to a cell of evidence.result (canonical order).
  bindings: Schema.Record(Schema.String, Schema.Struct({ column: Schema.String, row: Count })),
  assert: Schema.optional(Schema.String),
}
const draftEvidence = {
  query: Schema.String,
  gamesQuery: Schema.optional(Schema.String),
}

const comparativeNeedsAssert = Schema.makeFilter<{ readonly kind: string; readonly assert?: string | undefined }>(
  (card) => card.kind !== 'comparative' || (card.assert !== undefined && card.assert.trim() !== '') || 'comparative cards require assert',
)

export const CardDraft = Schema.Struct({
  ...draftFields,
  evidence: Schema.Struct(draftEvidence),
}).check(comparativeNeedsAssert)
export type CardDraft = typeof CardDraft.Type

export const InsightCard = Schema.Struct({
  id: Schema.String,
  status: Schema.Literals(['pending', 'approved', 'rejected', 'stale']),
  ...draftFields,
  evidence: Schema.Struct({
    ...draftEvidence,
    // Canonical result of evidence.query, derived by the system.
    result: Schema.Array(Row),
    // Canonical result of gamesQuery, or [] when there is none. Derived by the system.
    gameIds: Schema.Array(Schema.Int),
    // Filled by submit_card, never by the model.
    coverage: Schema.optional(Schema.Struct({ archived: Count, finals: Count })),
  }),
  asOf: Schema.Struct({ fetchedAt: Schema.String, completedGameIds: Count }),
  model: Schema.String,
  runId: Schema.String,
  review: Schema.optional(
    Schema.Struct({ by: Schema.Literal('ben'), at: Schema.String, reason: Schema.optional(RejectReason) }),
  ),
}).check(comparativeNeedsAssert)
export type InsightCard = typeof InsightCard.Type

export const cardId = (team: string, query: string, headline: string): string =>
  createHash('sha256').update(`${team}\0${query}\0${headline}`).digest('hex').slice(0, 16)
