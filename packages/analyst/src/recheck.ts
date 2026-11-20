import { Effect, Schema } from "effect";

import type { InsightCard } from "./card.ts";
import { toJson } from "./json.ts";
import { render } from "./render.ts";
import type { Db, Guard } from "./shapes.ts";
import { fillCard } from "./tools/submit-card.ts";

export type RecheckChange = "unchanged" | "refreshed" | "stale";

export interface RecheckContext {
  readonly finals: ReadonlySet<number>;
  readonly asOf: {
    readonly fetchedAt: string;
    readonly completedGameIds: number;
  };
}

export interface RecheckResult {
  readonly card: InsightCard;
  readonly change: RecheckChange;
  readonly reason?: string;
}

class Stale extends Schema.TaggedError<
  Stale,
  { readonly brand: unique symbol }
>()("Stale", {
  reason: Schema.String,
}) {}

// Optional evidence, such as coverage, may be absent on either side.
const same = (a: unknown, b: unknown): boolean =>
  a === undefined || b === undefined ? a === b : toJson(a) === toJson(b);

const staleResult = (card: InsightCard, reason: string): RecheckResult => ({
  card: { ...card, status: "stale" },
  change: "stale",
  reason,
});

// Reruns an approved card against the current data. A card whose assert still holds is refreshed
// in place and stays approved; a failed assert, a query error, a broken placeholder or a
// non-final game marks it stale. Cards that are not approved are returned unchanged.
export const recheck = (
  deps: { db: Db; guard: Guard },
  card: InsightCard,
  ctx: RecheckContext
): Effect.Effect<RecheckResult> => {
  if (card.status !== "approved")
    return Effect.succeed({ card, change: "unchanged" });
  const { db, guard } = deps;
  const attempt = Effect.gen(function* () {
    const sqls = [
      card.evidence.query,
      card.evidence.gamesQuery,
      card.assert,
    ].filter((s): s is string => s !== undefined);
    yield* Effect.forEach(
      sqls,
      (sql) =>
        Effect.flatMap(guard(db, sql), (verdict) =>
          verdict.ok
            ? Effect.void
            : Effect.fail(
                new Stale({ reason: `guard rejected query: ${verdict.reason}` })
              )
        ),
      { discard: true }
    );
    const fresh = yield* fillCard(
      deps,
      {
        ...card,
        evidence: {
          query: card.evidence.query,
          ...(card.evidence.gamesQuery === undefined
            ? {}
            : { gamesQuery: card.evidence.gamesQuery }),
        },
      },
      {
        model: card.model,
        runId: card.runId,
        asOf: ctx.asOf,
      }
    );
    if (card.assert !== undefined) {
      const { rows } = yield* db.query(card.assert);
      const values =
        rows.length === 1 && rows[0] !== undefined
          ? Object.values(rows[0])
          : [];
      if (values.length !== 1 || values[0] !== true)
        return yield* new Stale({
          reason: "assert did not return a single true",
        });
    }
    yield* Effect.forEach(
      [card.headline, card.body],
      (template) =>
        Effect.fromResult(
          render(
            template,
            card.bindings,
            fresh.evidence.result.map((row) => ({ ...row }))
          )
        ).pipe(
          Effect.mapError((error) => new Stale({ reason: error.message }))
        ),
      { discard: true }
    );
    const notFinal = fresh.evidence.gameIds.filter((id) => !ctx.finals.has(id));
    if (notFinal.length > 0)
      return yield* new Stale({
        reason: `game ids not final: ${notFinal.join(", ")}`,
      });
    const changed =
      !same(fresh.evidence.result, card.evidence.result) ||
      !same(fresh.evidence.gameIds, card.evidence.gameIds) ||
      !same(fresh.evidence.coverage, card.evidence.coverage);
    if (!changed) return { card, change: "unchanged" } satisfies RecheckResult;
    const { coverage: _old, ...evidence } = card.evidence;
    return {
      card: {
        ...card,
        evidence: {
          ...evidence,
          result: fresh.evidence.result,
          gameIds: fresh.evidence.gameIds,
          ...(fresh.evidence.coverage === undefined
            ? {}
            : { coverage: fresh.evidence.coverage }),
        },
        asOf: ctx.asOf,
      },
      change: "refreshed",
    } satisfies RecheckResult;
  });
  return Effect.match(attempt, {
    onFailure: (error): RecheckResult =>
      staleResult(card, error._tag === "Stale" ? error.reason : error.message),
    onSuccess: (result): RecheckResult => result,
  });
};
