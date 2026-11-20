import type { Tables } from "@nhl-reddit-stats/viz";
import { checkViewCode } from "@nhl-reddit-stats/viz/check-view-code";
import type { ViewCodeProblem } from "@nhl-reddit-stats/viz/check-view-code";
import type { LanguageModel, LanguageModelUsage } from "ai";
import { Array, Effect, Match, Schema } from "effect";

import { toJson } from "../json.ts";
import { Llm } from "../llm.ts";
import type { LlmError, LlmOutputError } from "../llm.ts";

export class ViewCodeError extends Schema.TaggedError<
  ViewCodeError,
  { readonly brand: unique symbol }
>()("ViewCodeError", {
  message: Schema.String,
  code: Schema.String,
  attempts: Schema.Int,
  model: Schema.String,
  inputTokens: Schema.Int,
  outputTokens: Schema.Int,
  totalTokens: Schema.Int,
}) {}

export const GeneratedView = Schema.Struct({
  title: Schema.String,
  code: Schema.String,
});
export type GeneratedView = typeof GeneratedView.Type;

export interface GenerateViewInput {
  readonly prompt: string;
  // The same value the frame receives; the prompt carries a summary of it, never all the rows.
  readonly tables: Tables;
  readonly notes: string;
  // The system prompt is a parameter, so generation does not depend on how it is written.
  readonly system: string;
  readonly model?: LanguageModel;
}

export interface GeneratedViewResult {
  readonly title: string;
  readonly code: string;
  readonly model: string;
  readonly usage: LanguageModelUsage;
}

// The text a repair is told about: a frame's Failed message, or the problems from checkViewCode.
export type ViewFailure = string | ReadonlyArray<ViewCodeProblem>;

export interface RepairViewInput {
  readonly code: string;
  readonly failure: ViewFailure;
  readonly system: string;
  readonly model?: LanguageModel;
}

export const MAX_REPAIRS = 2;
export const SAMPLE_ROWS = 3;

// For each table: its name, row count, column names (from every row) and first rows. Never the whole data.
export const describeTables = (
  tables: Tables
): ReadonlyArray<{
  readonly name: string;
  readonly rowCount: number;
  readonly columns: ReadonlyArray<string>;
  readonly sampleRows: Tables[string];
}> =>
  Object.entries(tables).map(([name, rows]) => {
    const sampleRows = rows.slice(0, SAMPLE_ROWS);

    return {
      name,
      rowCount: rows.length,
      columns: Array.dedupe(rows.flatMap((row) => Object.keys(row))),
      sampleRows,
    };
  });

const describeProblem = (problem: ViewCodeProblem): string =>
  Match.valueTags(problem, {
    MissingDefaultExport: () => "The module has no default export.",
    ModuleLoader: (p) => `Line ${p.line}: \`${p.keyword}\` is not allowed.`,
    ForbiddenGlobal: (p) => `Line ${p.line}: \`${p.name}\` is not allowed.`,
  });

export const describeFailure = (failure: ViewFailure): string =>
  typeof failure === "string"
    ? failure
    : failure.map(describeProblem).join("\n");

const modelName = (
  llm: { readonly config: { readonly generateModel: string } },
  model: LanguageModel | undefined
): string =>
  model === undefined
    ? llm.config.generateModel
    : typeof model === "string"
      ? model
      : `${model.provider}/${model.modelId}`;

type GenerateErrors = LlmError | LlmOutputError;

export const generateView = (
  input: GenerateViewInput
): Effect.Effect<GeneratedViewResult, GenerateErrors, Llm> =>
  Effect.gen(function* () {
    const llm = yield* Llm;
    const result = yield* llm.generateObject({
      schema: GeneratedView,
      system: input.system,
      prompt: toJson({
        request: input.prompt,
        tables: describeTables(input.tables),
        notes: input.notes,
      }),
      ...(input.model === undefined ? {} : { model: input.model }),
    });
    return {
      title: result.object.title,
      code: result.object.code,
      model: modelName(llm, input.model),
      usage: result.usage,
    };
  });

export const repairView = (
  input: RepairViewInput
): Effect.Effect<GeneratedViewResult, GenerateErrors, Llm> =>
  Effect.gen(function* () {
    const llm = yield* Llm;
    const result = yield* llm.generateObject({
      schema: GeneratedView,
      system: input.system,
      prompt: toJson({
        task: "The view module below failed. Fix it and return the whole corrected module.",
        failure: describeFailure(input.failure),
        code: input.code,
      }),
      ...(input.model === undefined ? {} : { model: input.model }),
    });
    return {
      title: result.object.title,
      code: result.object.code,
      model: modelName(llm, input.model),
      usage: result.usage,
    };
  });

const addUsage = (
  a: LanguageModelUsage,
  b: LanguageModelUsage
): LanguageModelUsage => ({
  ...a,
  inputTokens: (a.inputTokens ?? 0) + (b.inputTokens ?? 0),
  outputTokens: (a.outputTokens ?? 0) + (b.outputTokens ?? 0),
  totalTokens: (a.totalTokens ?? 0) + (b.totalTokens ?? 0),
});

// Generates, checks the code, and repairs at most MAX_REPAIRS times. Usage is summed over every call.
export const generateChecked = (
  input: GenerateViewInput
): Effect.Effect<
  GeneratedViewResult & { readonly repairs: number },
  GenerateErrors | ViewCodeError,
  Llm
> =>
  Effect.gen(function* () {
    let current = yield* generateView(input);
    let problems = checkViewCode(current.code);
    let repairs = 0;
    // loop: stop repairing as soon as the generated code passes validation.
    while (problems.length > 0 && repairs < MAX_REPAIRS) {
      const next = yield* repairView({
        code: current.code,
        failure: problems,
        system: input.system,
        ...(input.model === undefined ? {} : { model: input.model }),
      });
      current = { ...next, usage: addUsage(current.usage, next.usage) };
      problems = checkViewCode(current.code);
      repairs += 1;
    }
    if (problems.length > 0) {
      return yield* new ViewCodeError({
        message: describeFailure(problems),
        code: current.code,
        attempts: repairs + 1,
        model: current.model,
        inputTokens: current.usage.inputTokens ?? 0,
        outputTokens: current.usage.outputTokens ?? 0,
        totalTokens: current.usage.totalTokens ?? 0,
      });
    }
    return { ...current, repairs };
  });
