import type {
  LanguageModel,
  StopCondition,
  ToolExecuteFunction,
  ToolSet,
} from "ai";
import { stepCountIs } from "ai";
import {
  Array,
  Cause,
  Clock,
  DateTime,
  Effect,
  Exit,
  Match,
  Option,
  Result,
  Schema,
  Stream,
} from "effect";
import { SecureRandom } from "effect/crypto";

import type { AskResult } from "./ask.ts";
import type { InsightCard } from "./card.ts";
import { guardQuery } from "./guard.ts";
import { Llm } from "./llm.ts";
import { buildPrompt } from "./prompt.ts";
import type { Coverage, Db, Outcome } from "./shapes.ts";
import { VIEWS } from "./shapes.ts";
import { declineTool } from "./tools/decline.ts";
import { executeOf } from "./tools/execute-of.ts";
import { sqlTool } from "./tools/sql.ts";
import { submitCardTool } from "./tools/submit-card.ts";
import { openTrace } from "./trace.ts";
import type { ToolCallEvent, TracePayload } from "./trace.ts";
import { verifyCard } from "./verify.ts";

export const GENERATE_MAX_STEPS = 25;

export const GENERATE_MAX_CARDS = 6;

export class GenerateError extends Schema.TaggedError<
  GenerateError,
  { readonly brand: unique symbol }
>()("GenerateError", { message: Schema.String }) {}

export interface GenerateInput {
  readonly team: string;
  readonly db: Db;
  // Facts the poster already states; the prompt tells the model not to restate them.
  readonly posterFacts?: readonly string[];
  readonly fetchedAt?: string;
  readonly model?: LanguageModel;
  readonly traceDir?: string;
}

const RunReason = Schema.NullOr(Schema.String);

export interface GenerateResult extends Pick<
  AskResult,
  "runId" | "model" | "steps" | "inputTokens" | "outputTokens" | "latencyMs"
> {
  readonly outcome: Outcome;
  readonly cards: readonly InsightCard[];
  // Why the run declined, found nothing, or crashed.
  readonly reason: typeof RunReason.Type;
}

const sqlText = (value: string): string => value.replaceAll("'", "''");

const isFailureText = (output: string): boolean =>
  output.startsWith("ERROR:") || output.startsWith("FAILED check");

type GenerateSteps = Parameters<StopCondition<ToolSet>>[0]["steps"];

const hasFailureStreak = (steps: GenerateSteps): boolean => {
  const parts = Array.flatMap(steps, (step) => step.content);

  const streaks = Array.scan(parts, 0, (failures, part) =>
    Match.value(part).pipe(
      Match.when({ type: "tool-error" }, () => failures + 1),
      Match.when({ type: "tool-result" }, ({ output }) =>
        Schema.is(Schema.String)(output) && isFailureText(output)
          ? failures + 1
          : 0
      ),
      Match.orElse(() => failures)
    )
  );

  return Array.some(streaks, (failures) => failures >= 3);
};

export const generate = (
  input: GenerateInput
): Effect.Effect<GenerateResult, GenerateError, Llm> =>
  Effect.gen(function* () {
    const llm = yield* Llm;
    const runId = yield* Effect.sync(() => SecureRandom.uuidV4Unsafe());
    const model = input.model ?? llm.config.generateModel;
    const label = Schema.is(Schema.String)(model)
      ? model
      : `${model.provider}/${model.modelId}`;
    const { team, db } = input;
    const fail = (cause: unknown) =>
      new GenerateError({ message: String(cause) });

    const trace = yield* Effect.try({
      try: () => openTrace({ runId, dir: input.traceDir }),
      catch: fail,
    });

    if (Result.isFailure(trace))
      return yield* new GenerateError({ message: trace.failure.message });

    const append = (payload: TracePayload) =>
      Effect.try({
        try: () => trace.success.append(payload),
        catch: fail,
      }).pipe(
        Effect.flatMap((result) =>
          Result.isFailure(result)
            ? Effect.fail(
                new GenerateError({ message: result.failure.message })
              )
            : Effect.void
        )
      );

    const coverageRows = (yield* db
      .query(
        `SELECT finals, archived FROM boxscore_coverage WHERE team = '${sqlText(team)}'`
      )
      .pipe(Effect.mapError(fail))).rows;

    const coverageRow = coverageRows[0];

    if (
      coverageRow === undefined ||
      !Schema.is(
        Schema.Struct({ finals: Schema.Number, archived: Schema.Number })
      )(coverageRow)
    ) {
      return yield* new GenerateError({
        message: `no boxscore_coverage row for ${team}`,
      });
    }

    const coverage: Coverage = {
      finals: coverageRow["finals"],
      archived: coverageRow["archived"],
    };

    const finalRows = (yield* db
      .query(
        `SELECT game_id FROM team_games WHERE team = '${sqlText(team)}' AND is_final`
      )
      .pipe(Effect.mapError(fail))).rows;
    // The verifier takes a ReadonlySet of game IDs.

    const finals = new Set(
      Array.filterMap(finalRows, (row) =>
        Schema.is(Schema.Number)(row["game_id"])
          ? Result.succeed(row["game_id"])
          : Result.failVoid
      )
    );

    const bounded: Db = {
      query: (sql, opts) =>
        db.query(sql, { ...opts, timeoutMs: 10_000, rowCap: 200 }),
      queryCanonical: (sql, opts) =>
        db.queryCanonical(sql, { ...opts, timeoutMs: 10_000, rowCap: 200 }),
    };

    const cards: InsightCard[] = [];
    let declined = Option.none<string>();
    const events: ToolCallEvent[] = [];
    const failedDurations = new Map<string, number[]>();
    let tracedSteps = 0;
    const context = yield* Effect.context<Llm>();
    const runTool = Effect.runPromiseWith(context);

    const traced =
      <I, C>(name: string, execute: ToolExecuteFunction<I, string, C>) =>
      (
        toolInput: I,
        options: Parameters<ToolExecuteFunction<I, string, C>>[1]
      ) =>
        runTool(
          Effect.gen(function* () {
            const start = yield* Clock.monotonicTimeNanos;

            return yield* Effect.gen(function* () {
              const result = yield* Effect.tryPromise(() =>
                Promise.resolve(execute(toolInput, options))
              );

              const output = Schema.is(Schema.String)(result)
                ? result
                : yield* Stream.fromAsyncIterable(
                    result,
                    (cause) => new Cause.UnknownError(cause)
                  ).pipe(
                    Stream.runFold(
                      () => "",
                      (_previous, part) => part
                    )
                  );

              const end = yield* Clock.monotonicTimeNanos;

              const event: ToolCallEvent = {
                type: "tool_call",
                tool: name,
                input: toolInput,
                output,
                durationMs: Number(end - start) / 1_000_000,
              };

              events.push(
                isFailureText(output) ? { ...event, error: output } : event
              );

              return output;
            }).pipe(
              Effect.onError(() =>
                Effect.gen(function* () {
                  const end = yield* Clock.monotonicTimeNanos;
                  const durations =
                    failedDurations.get(options.toolCallId) ?? [];
                  durations.push(Number(end - start) / 1_000_000);
                  failedDurations.set(options.toolCallId, durations);
                })
              ),
              // The SDK receives the original rejection for its tool error response.
              Effect.catchTag("UnknownError", (error) =>
                Effect.die(error.cause)
              )
            );
          }),
          { signal: options.abortSignal }
        );

    const fetchedAt =
      input.fetchedAt ?? (yield* Effect.map(DateTime.now, DateTime.formatIso));
    const sql = sqlTool({ db: bounded, guard: guardQuery });

    const submit = submitCardTool({
      db: bounded,
      guard: guardQuery,
      verify: (card, finalIds) =>
        verifyCard({ db: bounded, guard: guardQuery }, card, finalIds),
      finals,
      meta: {
        model: label,
        runId,
        asOf: { fetchedAt, completedGameIds: finals.size },
      },
      onCard: (card) => {
        cards.push(card);
      },
    });

    const decline = declineTool({
      onDecline: (reason) => {
        if (Option.isNone(declined)) declined = Option.some(reason);
      },
    });

    const tools = {
      sql: { ...sql, execute: traced("sql", executeOf(sql.execute)) },
      submit_card: {
        ...submit,
        execute: traced("submit_card", executeOf(submit.execute)),
      },
      decline: {
        ...decline,
        execute: traced("decline", executeOf(decline.execute)),
      },
    };

    let failureStop = false;

    const stopWhen: StopCondition<ToolSet> = ({ steps }) => {
      Array.forEach(
        Array.flatMap(Array.drop(steps, tracedSteps), (step) => step.content),
        (part) => {
          if (part.type !== "tool-error") return;
          const error = String(part.error);
          events.push({
            type: "tool_call",
            tool: part.toolName,
            input: part.input ?? null,
            output: `ERROR: ${error}`,
            error,
            durationMs: failedDurations.get(part.toolCallId)?.shift() ?? null,
          });
        }
      );
      tracedSteps = steps.length;

      if (
        Option.isSome(declined) ||
        cards.length >= GENERATE_MAX_CARDS ||
        stepCountIs(GENERATE_MAX_STEPS)({ steps })
      )
        return true;

      if (!hasFailureStreak(steps)) return false;
      failureStop = true;

      return true;
    };

    const start = yield* Clock.monotonicTimeNanos;

    const result = yield* llm
      .run({
        prompt: buildPrompt({
          team,
          views: VIEWS,
          coverage,
          posterFacts: input.posterFacts ?? [],
        }),
        model,
        tools,
        stopWhen,
      })
      .pipe(Effect.exit);

    const end = yield* Clock.monotonicTimeNanos;
    const latencyMs = Number(end - start) / 1_000_000;

    if (
      Exit.isFailure(result) &&
      Array.some(result.cause.reasons, Cause.isInterruptReason)
    )
      return yield* Effect.interrupt;
    yield* Effect.forEach(events, append, { discard: true });
    yield* Effect.forEach(
      cards,
      (card) => append({ type: "card", cardId: card.id, card }),
      { discard: true }
    );

    const finish = (
      outcome: Outcome,
      reason: GenerateResult["reason"],
      usage: Pick<GenerateResult, "steps" | "inputTokens" | "outputTokens">
    ) =>
      append(
        reason === null
          ? { type: "outcome", status: outcome }
          : { type: "outcome", status: outcome, detail: reason }
      ).pipe(
        Effect.as({
          outcome,
          cards,
          reason,
          runId,
          model: label,
          latencyMs,
          ...usage,
        } satisfies GenerateResult)
      );

    if (Exit.isFailure(result)) {
      const reason = String(Cause.squash(result.cause));

      return yield* finish(
        cards.length > 0 ? "cards" : "crashed",
        cards.length > 0 ? null : reason,
        { steps: null, inputTokens: null, outputTokens: null }
      );
    }

    const value = result.value;

    if (
      value.usage.inputTokens !== undefined &&
      value.usage.outputTokens !== undefined
    ) {
      yield* append({
        type: "model_call",
        model: label,
        latencyMs,
        inputTokens: value.usage.inputTokens,
        outputTokens: value.usage.outputTokens,
      });
    }

    const usage = {
      steps: value.steps.length,
      inputTokens: value.usage.inputTokens ?? null,
      outputTokens: value.usage.outputTokens ?? null,
    };

    if (cards.length > 0) return yield* finish("cards", null, usage);

    if (Option.isSome(declined))
      return yield* finish("declined", declined.value, usage);

    if (failureStop)
      return yield* finish("crashed", "three consecutive tool failures", usage);

    return yield* finish(
      "no_insight",
      "model stopped without submitting a verified card or declining",
      usage
    );
  });
