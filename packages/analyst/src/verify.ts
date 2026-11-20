import { Effect } from "effect";

import type { Db, Guard, Verify, VerifyResult } from "./shapes.ts";
import { verifyRerun } from "./verify-rerun.ts";
import { verifyStatic } from "./verify-static.ts";

// Runs the static checks (1-4), then the database reruns (5-8); returns the first failure.
export const verifyCard = (
  deps: { db: Db; guard: Guard },
  card: unknown,
  finals: ReadonlySet<number>
): Effect.Effect<VerifyResult> =>
  Effect.gen(function* () {
    const statics = yield* verifyStatic(deps, card);
    if (!statics.ok) return statics;
    return yield* verifyRerun(deps, statics.card, {
      touchesBoxscores: statics.touchesBoxscores,
      finals,
    });
  });

export const makeVerify =
  (deps: { db: Db; guard: Guard }): Verify =>
  (card, finals) =>
    verifyCard(deps, card, finals);
