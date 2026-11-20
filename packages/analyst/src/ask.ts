import { randomUUID } from "node:crypto";

import type { LanguageModel } from "ai";
import { Cause, Clock, Effect, Exit, Match, Result, Schema } from "effect";

import { toJson } from "./json.ts";
import { Llm, modelLabel } from "./llm.ts";
import type { Answer, Db } from "./shapes.ts";
import { Crashed, VIEWS } from "./shapes.ts";
import { makeToolset } from "./toolset.ts";
import { openTrace } from "./trace.ts";
import type { TracePayload } from "./trace.ts";

export class AskError extends Schema.TaggedError<
  AskError,
  { readonly brand: unique symbol }
>()("AskError", { message: Schema.String }) {}

export type AskInput = {
  readonly question: string;
  readonly team: string;
  readonly db: Db;
  readonly model?: LanguageModel;
  readonly traceDir?: string;
};
export type AskResult = {
  readonly outcome: Answer | typeof Crashed.Type;
  readonly runId: string;
  readonly model: string;
  readonly steps: number | null;
  readonly inputTokens: number | null;
  readonly outputTokens: number | null;
  readonly latencyMs: number;
};
export const ASK_SYSTEM = `Answer NHL questions only from supplied read-only views. Use sql to investigate, then answer to record a verified cell or decline when data cannot answer. Never answer from memory. Views: ${toJson(VIEWS)}`;
export const ask = (input: AskInput): Effect.Effect<AskResult, AskError, Llm> =>
  Effect.gen(function* () {
    const llm = yield* Llm;
    const runId = randomUUID();
    const model = input.model ?? llm.config.generateModel;
    const label = modelLabel(model);
    const trace = yield* Effect.try({
      try: () =>
        openTrace({
          runId,
          dir: input.traceDir,
        }),
      catch: (cause) => new AskError({ message: String(cause) }),
    });
    if (Result.isFailure(trace))
      return yield* new AskError({ message: trace.failure.message });
    const append = (payload: TracePayload) =>
      Effect.try({
        try: () => trace.success.append(payload),
        catch: (cause) => new AskError({ message: String(cause) }),
      }).pipe(
        Effect.flatMap((result) =>
          Result.isFailure(result)
            ? Effect.fail(new AskError({ message: result.failure.message }))
            : Effect.void
        )
      );
    const toolset = makeToolset(input.db, input.team);
    const start = yield* Clock.currentTimeMillis;
    const result = yield* llm
      .run({
        system: ASK_SYSTEM,
        prompt: `Team: ${input.team}\nQuestion: ${input.question}`,
        model,
        tools: toolset.tools,
        stopWhen: toolset.stopWhen,
      })
      .pipe(Effect.exit);
    const latencyMs = (yield* Clock.currentTimeMillis) - start;
    if (
      Exit.isFailure(result) &&
      result.cause.reasons.some(Cause.isInterruptReason)
    )
      return yield* Effect.interrupt;
    yield* Effect.forEach(toolset.events, (event) => append(event), {
      discard: true,
    });
    if (Exit.isFailure(result)) {
      const reason = String(Cause.squash(result.cause));
      yield* append({ type: "outcome", status: "crashed", detail: reason });
      return {
        outcome: Crashed.make({ reason }),
        runId,
        model: label,
        steps: null,
        inputTokens: null,
        outputTokens: null,
        latencyMs,
      };
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
    const outcome =
      toolset.answer() ??
      Crashed.make({
        reason: "model stopped without a verified answer or decline",
      });
    yield* append({
      type: "outcome",
      status: Match.valueTags(outcome, {
        Answered: () => "answered" as const,
        Declined: () => "declined" as const,
        Crashed: () => "crashed" as const,
      }),
    });
    return {
      outcome,
      runId,
      model: label,
      steps: value.steps.length,
      latencyMs,
      inputTokens: value.usage.inputTokens ?? null,
      outputTokens: value.usage.outputTokens ?? null,
    };
  });
