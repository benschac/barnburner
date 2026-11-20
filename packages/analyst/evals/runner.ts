import { Cause, Effect, Predicate, Schema } from "effect";

import type { Db } from "../src/shapes.ts";
import type { EvalAnswer, EvalCase } from "./case.ts";
import { grade } from "./grade.ts";

export type Answerer<R = never> = (
  evalCase: EvalCase
) => Effect.Effect<EvalAnswer, unknown, R>;

export type CaseResult = {
  readonly id: string;
  readonly pass: boolean;
  readonly reason?: string;
  readonly invalid?: true;
  readonly truth?: number;
  readonly answer?: EvalAnswer;
};

export type EvalRun = {
  readonly results: readonly CaseResult[];
  readonly passed: number;
  readonly total: number;
  readonly score: number;
};

const describe = (cause: Cause.Cause<unknown>): string => {
  // foreign: the squashed value is whatever an answerer or driver raised
  const raised = Cause.squash(cause);
  return Predicate.hasProperty(raised, "message")
    ? String(raised.message)
    : String(raised);
};

const truthValue = (
  db: Db,
  sql: string
): Effect.Effect<{ ok: true; value: number } | { ok: false; reason: string }> =>
  db.query(sql).pipe(
    Effect.map((res) => {
      if (res.rows.length !== 1)
        return {
          ok: false as const,
          reason: `truthSql returned ${res.rows.length} rows, expected exactly 1`,
        };
      const cell = res.rows[0]?.value;
      if (!Schema.is(Schema.Finite)(cell))
        return {
          ok: false as const,
          reason: "truthSql value column is not a finite number",
        };
      return { ok: true as const, value: cell };
    }),
    Effect.catch((e) =>
      Effect.succeed({
        ok: false as const,
        reason: `truthSql failed: ${e.message}`,
      })
    )
  );

const runCase = <R>(
  evalCase: EvalCase,
  db: Db,
  answerer: Answerer<R>
): Effect.Effect<CaseResult, never, R> =>
  Effect.gen(function* () {
    let truth: number | null = null;
    if (evalCase.expect === "value") {
      if (evalCase.truthSql === null)
        return {
          id: evalCase.id,
          pass: false,
          invalid: true as const,
          reason: "invalid case: value case has no truthSql",
        };
      const t = yield* truthValue(db, evalCase.truthSql);
      if (!t.ok)
        return {
          id: evalCase.id,
          pass: false,
          invalid: true as const,
          reason: `invalid case: ${t.reason}`,
        };
      truth = t.value;
    }
    const answered = yield* Effect.suspend(() => answerer(evalCase)).pipe(
      Effect.map((answer) => ({ ok: true as const, answer })),
      Effect.catchCause((cause) =>
        Effect.succeed({
          ok: false as const,
          reason: describe(cause),
        })
      )
    );
    const base = truth === null ? {} : { truth };
    if (!answered.ok)
      return {
        id: evalCase.id,
        pass: false,
        reason: `answerer failed: ${answered.reason}`,
        ...base,
      };
    const g = grade(evalCase, truth, answered.answer);
    return g.pass
      ? { id: evalCase.id, pass: true, answer: answered.answer, ...base }
      : {
          id: evalCase.id,
          pass: false,
          reason: g.reason,
          answer: answered.answer,
          ...base,
        };
  });

export const runEvals = <R = never>(input: {
  readonly cases: readonly EvalCase[];
  readonly db: Db;
  readonly answerer: Answerer<R>;
}): Effect.Effect<EvalRun, never, R> =>
  Effect.gen(function* () {
    const results = yield* Effect.forEach(input.cases, (c) =>
      runCase(c, input.db, input.answerer)
    );
    const passed = results.filter((r) => r.pass).length;
    const total = results.length;
    return { results, passed, total, score: total === 0 ? 0 : passed / total };
  });
