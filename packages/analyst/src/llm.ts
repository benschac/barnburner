import { Context, Effect, Layer, Schema } from 'effect'
import { generateText } from 'ai'
import type { LanguageModel, LanguageModelUsage, StepResult, StopCondition, ToolSet } from 'ai'

export class LlmError extends Schema.TaggedError<LlmError, { readonly brand: unique symbol }>()('LlmError', {
  message: Schema.String,
  model: Schema.String,
}) {}

// Gateway "provider/model" strings; both are starting guesses (see E7 evals).
export interface LlmConfig {
  readonly generateModel: string
  readonly rankModel: string
}

export const defaultLlmConfig: LlmConfig = {
  generateModel: 'anthropic/claude-sonnet-5.5',
  rankModel: 'anthropic/claude-haiku-5.5',
}

export const llmConfigFromEnv = (env: Readonly<Record<string, string | undefined>> = process.env): LlmConfig => ({
  generateModel: env.ANALYST_GENERATE_MODEL || defaultLlmConfig.generateModel,
  rankModel: env.ANALYST_RANK_MODEL || defaultLlmConfig.rankModel,
})

export interface LlmRunInput {
  readonly system?: string
  readonly prompt: string
  readonly tools?: ToolSet
  readonly stopWhen?: StopCondition<any, any> | ReadonlyArray<StopCondition<any, any>>
  // A gateway "provider/model" string or a LanguageModel instance; defaults to the generate model.
  readonly model?: LanguageModel
}

export interface LlmRunResult {
  readonly text: string
  readonly steps: ReadonlyArray<StepResult<any, any>>
  readonly usage: LanguageModelUsage
  readonly toolCalls: ReadonlyArray<StepResult<any, any>['toolCalls'][number]>
}

export interface LlmService {
  readonly config: LlmConfig
  readonly run: (input: LlmRunInput) => Effect.Effect<LlmRunResult, LlmError>
}

const modelLabel = (model: LanguageModel) => typeof model === 'string' ? model : `${model.provider}/${model.modelId}`

export const makeLlm = (config: LlmConfig = llmConfigFromEnv()): LlmService => ({
  config,
  run: (input) => {
    const model = input.model ?? config.generateModel
    return Effect.tryPromise({
      try: async (signal) => {
        const result = await generateText({
          model,
          prompt: input.prompt,
          abortSignal: signal,
          ...(input.system === undefined ? {} : { system: input.system }),
          ...(input.tools === undefined ? {} : { tools: input.tools }),
          ...(input.stopWhen === undefined ? {} : { stopWhen: input.stopWhen as StopCondition<any, any> }),
        })
        return {
          text: result.text,
          steps: result.steps,
          usage: result.totalUsage,
          toolCalls: result.steps.flatMap((step) => step.toolCalls),
        } satisfies LlmRunResult
      },
      catch: (cause) => new LlmError({
        message: cause instanceof Error ? cause.message : String(cause),
        model: modelLabel(model),
      }),
    })
  },
})

export class Llm extends Context.Service<Llm, LlmService>()('analyst/Llm') {
  static layer = (config?: LlmConfig) => Layer.succeed(Llm, Llm.of(makeLlm(config)))
  static run = (input: LlmRunInput) => Llm.use((llm) => llm.run(input))
}
