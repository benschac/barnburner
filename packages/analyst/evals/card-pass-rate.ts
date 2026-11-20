import { Effect } from "effect";

import type { Verify } from "../src/shapes.ts";

export type CardPassRate = {
  readonly total: number;
  readonly passed: number;
  readonly passRate: number;
  // Count of failing cards keyed by the verifier check number that failed.
  readonly failuresByCheck: Record<number, number>;
};

// Share of cards that pass verify, with failures grouped by check. Scores both the detectors and the generator.
export const scoreCards = (
  cards: readonly unknown[],
  verify: Verify,
  finals: ReadonlySet<number>
): Effect.Effect<CardPassRate> =>
  Effect.gen(function* () {
    const results = yield* Effect.forEach(cards, (card) =>
      verify(card, finals)
    );
    const failuresByCheck: Record<number, number> = {};
    let passed = 0;
    for (const result of results) {
      if (result.ok) {
        passed += 1;
      } else {
        failuresByCheck[result.check] =
          (failuresByCheck[result.check] ?? 0) + 1;
      }
    }
    const total = cards.length;
    return {
      total,
      passed,
      passRate: total === 0 ? 0 : passed / total,
      failuresByCheck,
    };
  });
