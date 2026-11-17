import { Effect, Schema } from 'effect'
import { jsonSchema, tool } from 'ai'
import type { JSONSchema7 } from 'ai'
import { cardId, CardDraft, InsightCard } from '../card.ts'
import type { Db, Guard, Verify } from '../shapes.ts'
import { SqlError } from '../shapes.ts'

export class FillError extends Schema.TaggedError<FillError, { readonly brand: unique symbol }>()('FillError', {
  message: Schema.String,
}) {}

export interface CardMeta {
  readonly model: string
  readonly runId: string
  readonly asOf: { readonly fetchedAt: string; readonly completedGameIds: number }
}

const sqlText = (value: string): string => value.replaceAll("'", "''")

export const fillCard = (
  deps: { db: Db; guard: Guard },
  draft: CardDraft,
  meta: CardMeta,
): Effect.Effect<InsightCard, SqlError | FillError> =>
  Effect.gen(function* () {
    const { db, guard } = deps
    const { query, gamesQuery } = draft.evidence
    const verdict = yield* guard(db, query)
    if (!verdict.ok) return yield* new FillError({ message: verdict.reason })
    if (gamesQuery !== undefined) {
      const gv = yield* guard(db, gamesQuery)
      if (!gv.ok) return yield* new FillError({ message: gv.reason })
    }
    const result = yield* db.queryCanonical(query)
    const gameIds: number[] = []
    if (gamesQuery !== undefined) {
      const games = yield* db.queryCanonical(gamesQuery)
      for (const row of games.rows) {
        const id = row['game_id']
        if (typeof id !== 'number') return yield* new FillError({ message: 'gamesQuery must return an integer game_id column' })
        gameIds.push(id)
      }
    }
    let coverage: { archived: number; finals: number } | undefined
    if (verdict.touchesBoxscores) {
      const rows = (yield* db.query(
        `SELECT archived, finals FROM boxscore_coverage WHERE team = '${sqlText(draft.team)}'`,
      )).rows
      const row = rows[0]
      if (row === undefined || typeof row['archived'] !== 'number' || typeof row['finals'] !== 'number') {
        return yield* new FillError({ message: `no boxscore_coverage row for ${draft.team}` })
      }
      coverage = { archived: row['archived'], finals: row['finals'] }
    }
    return {
      id: cardId(draft.team, query, draft.headline),
      status: 'pending',
      team: draft.team,
      kind: draft.kind,
      headline: draft.headline,
      body: draft.body,
      bindings: draft.bindings,
      ...(draft.assert === undefined ? {} : { assert: draft.assert }),
      evidence: {
        query,
        ...(gamesQuery === undefined ? {} : { gamesQuery }),
        result: result.rows,
        gameIds,
        ...(coverage === undefined ? {} : { coverage }),
      },
      asOf: meta.asOf,
      model: meta.model,
      runId: meta.runId,
    } satisfies InsightCard
  })

export interface SubmitCardDeps {
  readonly db: Db
  readonly guard: Guard
  readonly verify: Verify
  readonly finals: ReadonlySet<number>
  readonly meta: CardMeta
  readonly onCard: (card: InsightCard) => void
}

export const submitCardText = (deps: SubmitCardDeps, input: unknown): Effect.Effect<string> =>
  Effect.gen(function* () {
    const draft = yield* Schema.decodeUnknownEffect(Schema.toCodecJson(CardDraft))(input)
    if (draft.assert !== undefined) {
      const av = yield* deps.guard(deps.db, draft.assert)
      if (!av.ok) return `ERROR: ${av.reason}`
    }
    const card = yield* fillCard(deps, draft, deps.meta)
    const verdict = yield* deps.verify(card, deps.finals)
    if (!verdict.ok) return `FAILED check ${verdict.check}: ${verdict.detail}`
    deps.onCard(card)
    return 'ok'
  }).pipe(Effect.catch((error: { readonly message?: string }) => Effect.succeed(`ERROR: ${error.message ?? String(error)}`)))

const jsonDoc = Schema.toJsonSchemaDocument(CardDraft)
const draftInputSchema = jsonSchema<CardDraft>(
  { ...jsonDoc.schema, definitions: jsonDoc.definitions } as JSONSchema7,
  {
    validate: (value) => {
      const decoded = Schema.decodeUnknownExit(Schema.toCodecJson(CardDraft))(value)
      return decoded._tag === 'Success'
        ? { success: true, value: decoded.value }
        : { success: false, error: new Error(String(decoded.cause)) }
    },
  },
)

export const makeSubmitCardTool = (deps: SubmitCardDeps) =>
  tool({
    description:
      'Submit a draft insight card. The system runs the queries, fills in the evidence and verifies the card. Returns "ok" or the failed check.',
    inputSchema: draftInputSchema,
    execute: (input: CardDraft) => Effect.runPromise(submitCardText(deps, input)),
  })
