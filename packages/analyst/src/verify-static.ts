import { Effect, Result, Schema } from 'effect'
import { InsightCard } from './card.ts'
import { literalDigits, render } from './render.ts'
import type { Db, Guard } from './shapes.ts'

export type StaticResult =
  | { ok: true; card: InsightCard; touchesBoxscores: boolean }
  | { ok: false; check: number; detail: string }

const fail = (check: number, detail: string): StaticResult => ({ ok: false, check, detail })

// Checks 1-4 of the verifier. None of them reads the database; `guard` is a parameter.
export const verifyStatic = (deps: { db: Db; guard: Guard }, input: unknown): Effect.Effect<StaticResult> =>
  Effect.gen(function* () {
    // 1. Decodes as an InsightCard.
    const decoded = Schema.decodeUnknownResult(InsightCard)(input)
    if (decoded._tag === 'Failure') return fail(1, String(decoded.failure))
    const card = decoded.success

    // 2. Guard passes for query, gamesQuery and assert.
    const queryGuard = yield* deps.guard(deps.db, card.evidence.query)
    if (!queryGuard.ok) return fail(2, `query: ${queryGuard.reason}`)
    const others: [string, string | undefined][] = [
      ['gamesQuery', card.evidence.gamesQuery],
      ['assert', card.assert],
    ]
    const guarded = yield* Effect.result(Effect.forEach(others, ([name, sql]) =>
      sql === undefined
        ? Effect.void
        : Effect.flatMap(deps.guard(deps.db, sql), (g) => (g.ok ? Effect.void : Effect.fail(fail(2, `${name}: ${g.reason}`)))),
    { discard: true }))
    if (Result.isFailure(guarded)) return guarded.failure

    // 3. Every placeholder resolves against evidence.result.
    const rows = card.evidence.result.map((r) => ({ ...r }))
    const bindings = Object.fromEntries(Object.entries(card.bindings))
    for (const [field, template] of [['headline', card.headline], ['body', card.body]] as const) {
      const rendered = render(template, bindings, rows)
      if (Result.isFailure(rendered)) return fail(3, `${field}: ${rendered.failure.message}`)
    }

    // 4. No literal digits in headline or body.
    for (const [field, template] of [['headline', card.headline], ['body', card.body]] as const) {
      const digits = literalDigits(template)
      if (digits.length > 0) return fail(4, `${field} has literal digits: ${digits.join('')}`)
    }

    return { ok: true, card, touchesBoxscores: queryGuard.touchesBoxscores }
  })
