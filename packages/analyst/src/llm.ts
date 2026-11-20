import { generateText, NoObjectGeneratedError, Output } from "ai";
import type {
  LanguageModel,
  LanguageModelUsage,
  StepResult,
  StopCondition,
  ToolSet,
} from "ai";
import { Context, Effect, Layer, Schema } from "effect";

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

export interface LlmObjectInput<S extends Schema.ConstraintDecoder<unknown>> {
  readonly schema: S;
  readonly prompt: string;
  readonly system?: string;
  readonly model?: LanguageModel;
}

// Gateway "provider/model" strings; both are starting guesses (see E7 evals).
export interface LlmConfig {
  readonly generateModel: string;
  readonly rankModel: string;
}

export const defaultLlmConfig: LlmConfig = {
  generateModel: "anthropic/claude-sonnet-5.5",
  rankModel: "anthropic/claude-haiku-5.5",
};

export const llmConfigFromEnv = (
  env: Readonly<Record<string, string | undefined>> = process.env
): LlmConfig => ({
  generateModel: env.ANALYST_GENERATE_MODEL || defaultLlmConfig.generateModel,
  rankModel: env.ANALYST_RANK_MODEL || defaultLlmConfig.rankModel,
});

export interface LlmRunInput {
  readonly system?: string;
  readonly prompt: string;
  readonly tools?: ToolSet;
  readonly stopWhen?:
    | StopCondition<any, any>
    | readonly StopCondition<any, any>[];
  // A gateway "provider/model" string or a LanguageModel instance; defaults to the generate model.
  readonly model?: LanguageModel;
}

export interface LlmRunResult {
  readonly text: string;
  readonly steps: readonly StepResult<any, any>[];
  readonly usage: LanguageModelUsage;
  readonly toolCalls: readonly StepResult<any, any>["toolCalls"][number][];
}

export interface LlmService {
  readonly config: LlmConfig;
  readonly generateObject: <S extends Schema.ConstraintDecoder<unknown>>(
    input: LlmObjectInput<S>
  ) => Effect.Effect<
    { readonly object: S["Type"]; readonly usage: LanguageModelUsage },
    LlmError | LlmOutputError
  >;
  readonly run: (input: LlmRunInput) => Effect.Effect<LlmRunResult, LlmError>;
}

const modelLabel = (model: LanguageModel) =>
  typeof model === "string" ? model : `${model.provider}/${model.modelId}`;

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
          ...(input.system === undefined ? {} : { system: input.system }),
        });
        return { object: result.output, usage: result.totalUsage };
      },
      catch: (cause) =>
        NoObjectGeneratedError.isInstance(cause)
          ? new LlmOutputError({
              message: cause.message,
              model: modelLabel(model),
              ...(cause.text === undefined ? {} : { raw: cause.text }),
            })
          : new LlmError({
              message: cause instanceof Error ? cause.message : String(cause),
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
          ...(input.system === undefined ? {} : { system: input.system }),
          ...(input.tools === undefined ? {} : { tools: input.tools }),
          ...(input.stopWhen === undefined
            ? {}
            : { stopWhen: input.stopWhen as StopCondition<any, any> }),
        });
        return {
          text: result.text,
          steps: result.steps,
          usage: result.totalUsage,
          toolCalls: result.steps.flatMap((step) => step.toolCalls),
        } satisfies LlmRunResult;
      },
      catch: (cause) =>
        new LlmError({
          message: cause instanceof Error ? cause.message : String(cause),
          model: modelLabel(model),
        }),
    });
  },
});

export class Llm extends Context.Service<Llm, LlmService>()("analyst/Llm") {
  static layer = (config?: LlmConfig) =>
    Layer.succeed(Llm, Llm.of(makeLlm(config)));
  static run = (input: LlmRunInput) => Llm.use((llm) => llm.run(input));
}
