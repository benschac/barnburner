import { generateText, NoObjectGeneratedError, Output } from "ai";
import type {
  LanguageModel,
  LanguageModelUsage,
  StepResult,
  StopCondition,
  ToolSet,
} from "ai";
import { Context, Effect, Layer, Match, Predicate, Schema } from "effect";

export class LlmError extends Schema.TaggedError<
  LlmError,
  { readonly brand: unique symbol }
>()("LlmError", {
  message: Schema.String,
  model: Schema.String,
}) {}

export class LlmOutputError extends Schema.TaggedError<
  LlmOutputError,
  { readonly brand: unique symbol }
>()("LlmOutputError", {
  message: Schema.String,
  model: Schema.String,
  raw: Schema.optional(Schema.String),
}) {}

export type LlmObjectInput<S extends Schema.ConstraintDecoder<unknown>> = {
  readonly schema: S;
  readonly prompt: string;
  readonly system?: string;
  readonly model?: LanguageModel;
};

// Gateway "provider/model" strings; both are starting guesses (see E7 evals).
export type LlmConfig = {
  readonly generateModel: string;
  readonly rankModel: string;
};

export const defaultLlmConfig: LlmConfig = {
  generateModel: "anthropic/claude-sonnet-5.5",
  rankModel: "anthropic/claude-haiku-5.5",
};

// An empty variable falls back to the default, like an unset one.
const nonEmptyOr = (value: string | undefined, fallback: string) =>
  value === undefined || value === "" ? fallback : value;

export const llmConfigFromEnv = (
  env: Readonly<Record<string, string | undefined>> = process.env
): LlmConfig => ({
  generateModel: nonEmptyOr(
    env.ANALYST_GENERATE_MODEL,
    defaultLlmConfig.generateModel
  ),
  rankModel: nonEmptyOr(env.ANALYST_RANK_MODEL, defaultLlmConfig.rankModel),
});

export type LlmRunInput = {
  readonly system?: string;
  readonly prompt: string;
  readonly tools?: ToolSet;
  readonly stopWhen?: StopCondition<ToolSet> | StopCondition<ToolSet>[];
  // A gateway "provider/model" string or a LanguageModel instance; defaults to the generate model.
  readonly model?: LanguageModel;
};

export type LlmRunResult = {
  readonly text: string;
  readonly steps: readonly StepResult<ToolSet>[];
  readonly usage: LanguageModelUsage;
  readonly toolCalls: readonly StepResult<ToolSet>["toolCalls"][number][];
};

export type LlmService = {
  readonly config: LlmConfig;
  readonly generateObject: <S extends Schema.ConstraintDecoder<unknown>>(
    input: LlmObjectInput<S>
  ) => Effect.Effect<
    { readonly object: S["Type"]; readonly usage: LanguageModelUsage },
    LlmError | LlmOutputError
  >;
  readonly run: (input: LlmRunInput) => Effect.Effect<LlmRunResult, LlmError>;
};

export const modelLabel = (model: LanguageModel): string =>
  Match.value(model).pipe(
    Match.when(Match.string, (id) => id),
    Match.orElse((resolved) => `${resolved.provider}/${resolved.modelId}`)
  );

export const makeLlm = (
  config: LlmConfig = llmConfigFromEnv()
): LlmService => ({
  config,
  generateObject: (input) => {
    const model = input.model ?? config.generateModel;
    return Effect.tryPromise({
      try: async (signal) => {
        const result = await generateText({
          model,
          prompt: input.prompt,
          abortSignal: signal,
          output: Output.object({
            schema: {
              "~standard": {
                ...Schema.toStandardSchemaV1(input.schema)["~standard"],
                ...Schema.toStandardJSONSchemaV1(input.schema)["~standard"],
              },
            },
          }),
          instructions: input.system,
        });
        return { object: result.output, usage: result.usage };
      },
      catch: (cause) =>
        NoObjectGeneratedError.isInstance(cause)
          ? cause.text === undefined
            ? new LlmOutputError({
                message: cause.message,
                model: modelLabel(model),
              })
            : new LlmOutputError({
                message: cause.message,
                model: modelLabel(model),
                raw: cause.text,
              })
          : new LlmError({
              message: Predicate.isError(cause) ? cause.message : String(cause),
              model: modelLabel(model),
            }),
    });
  },
  run: (input) => {
    const model = input.model ?? config.generateModel;
    return Effect.tryPromise({
      try: async (signal) => {
        const result = await generateText({
          model,
          prompt: input.prompt,
          abortSignal: signal,
          instructions: input.system,
          tools: input.tools,
          stopWhen: input.stopWhen,
        });
        return {
          text: result.text,
          steps: result.steps,
          usage: result.usage,
          toolCalls: result.steps.flatMap((step) => step.toolCalls),
        } satisfies LlmRunResult;
      },
      catch: (cause) =>
        new LlmError({
          message: Predicate.isError(cause) ? cause.message : String(cause),
          model: modelLabel(model),
        }),
    });
  },
});

export class Llm extends Context.Service<Llm, LlmService>()("analyst/Llm") {
  static readonly make = (config?: LlmConfig) =>
    Effect.sync(() => Llm.of(makeLlm(config)));
  static readonly layer = (config?: LlmConfig) =>
    Layer.effect(Llm, Llm.make(config));
  static run = (input: LlmRunInput) => Llm.use((llm) => llm.run(input));
}
