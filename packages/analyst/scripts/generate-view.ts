import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { ViewData } from "@nhl-reddit-stats/viz";
import { Effect, Result, Schema } from "effect";

import { logError } from "../../../lib/logger.mjs";
import { toPrettyJson } from "../src/json.ts";
import { Llm } from "../src/llm.ts";
import type { ViewCodeError } from "../src/viz/generate.ts";
import { generateChecked } from "../src/viz/generate.ts";

// Expected failures of this command. Each is handled by tag in run(); only defects reach the catch-all.
export class GenerateCommandError extends Schema.TaggedError<
  GenerateCommandError,
  { readonly brand: unique symbol }
>()("GenerateCommandError", {
  message: Schema.String,
}) {}

export class ReadFileError extends Schema.TaggedError<
  ReadFileError,
  { readonly brand: unique symbol }
>()("ReadFileError", {
  path: Schema.String,
  cause: Schema.String,
}) {}

export class WriteFileError extends Schema.TaggedError<
  WriteFileError,
  { readonly brand: unique symbol }
>()("WriteFileError", {
  path: Schema.String,
  cause: Schema.String,
}) {}

const usage =
  'Usage: node packages/analyst/scripts/generate-view.ts --prompt "text" --tables <file> --vocabulary antv|d3 --out <file>';
const vocabularies = { antv: "view-antv.md", d3: "view-d3.md" } as const;
type Vocabulary = keyof typeof vocabularies;

export interface GenerateArgs {
  readonly prompt: string;
  readonly tables: string;
  readonly vocabulary: Vocabulary;
  readonly out: string;
}

// Flags are `--name value` pairs. Every flag is required, may appear once, and must have a non-empty value.
export const parseArgs = (
  argv: readonly string[]
): Result.Result<GenerateArgs, GenerateCommandError> => {
  const fail = (message: string) =>
    Result.fail(new GenerateCommandError({ message: `${message}\n${usage}` }));
  const values = new Map<string, string>();
  for (let index = 0; index < argv.length; index += 2) {
    const name = argv[index];
    const value = argv[index + 1];
    if (
      name === undefined ||
      !name.startsWith("--") ||
      value === undefined ||
      value.startsWith("--") ||
      values.has(name)
    ) {
      return fail("Each flag takes one value and may appear once.");
    }
    values.set(name, value);
  }
  const known = ["--prompt", "--tables", "--vocabulary", "--out"];
  if ([...values.keys()].some((name) => !known.includes(name)))
    return fail("Unknown flag.");
  const prompt = values.get("--prompt");
  const tables = values.get("--tables");
  const vocabulary = values.get("--vocabulary");
  const out = values.get("--out");
  if (
    prompt === undefined ||
    tables === undefined ||
    out === undefined ||
    vocabulary === undefined
  )
    return fail("Missing flag.");
  if (prompt.trim() === "") return fail("--prompt must not be empty.");
  if (tables.trim() === "") return fail("--tables must not be empty.");
  if (out.trim() === "") return fail("--out must not be empty.");
  if (vocabulary !== "antv" && vocabulary !== "d3")
    return fail("--vocabulary must be antv or d3.");
  return Result.succeed({
    prompt,
    tables: resolve(tables),
    vocabulary,
    out: resolve(out),
  });
};

const readText = (path: string): Effect.Effect<string, ReadFileError> =>
  Effect.try({
    try: () => readFileSync(path, "utf-8"),
    catch: (cause) => new ReadFileError({ path, cause: String(cause) }),
  });

const writeText = (
  path: string,
  text: string
): Effect.Effect<void, WriteFileError> =>
  Effect.try({
    try: () => {
      writeFileSync(path, text);
    },
    catch: (cause) => new WriteFileError({ path, cause: String(cause) }),
  });

const decodeTables = Schema.decodeUnknownResult(
  Schema.fromJsonString(ViewData)
);

// Token counts are null when the model reports none, not 0.
const count = (value: number | undefined): number | null => value ?? null;

const run = (args: GenerateArgs) =>
  Effect.gen(function* () {
    const text = yield* readText(args.tables);
    const data = yield* Effect.fromResult(
      Result.mapError(
        decodeTables(text),
        () =>
          new GenerateCommandError({
            message: `${args.tables} is not { tables, notes }`,
          })
      )
    );
    const system = yield* readText(
      fileURLToPath(
        new URL(
          `../src/prompts/${vocabularies[args.vocabulary]}`,
          import.meta.url
        )
      )
    );
    const result = yield* generateChecked({
      prompt: args.prompt,
      tables: data.tables,
      notes: data.notes,
      system,
    });
    yield* writeText(args.out, result.code);
    return {
      title: result.title,
      model: result.model,
      tokens: {
        input: count(result.usage.inputTokens),
        output: count(result.usage.outputTokens),
        total: count(result.usage.totalTokens),
      },
      repairs: result.repairs,
      out: args.out,
    };
  }).pipe(
    Effect.catchTags({
      GenerateCommandError: (error) =>
        Effect.sync(() => {
          logError(error.message);
          process.exitCode = 1;
          return undefined;
        }),
      ReadFileError: (error) =>
        Effect.sync(() => {
          logError(`Cannot read ${error.path}: ${error.cause}`);
          process.exitCode = 1;
          return undefined;
        }),
      WriteFileError: (error) =>
        Effect.sync(() => {
          logError(`Cannot write ${error.path}: ${error.cause}`);
          process.exitCode = 1;
          return undefined;
        }),
      LlmError: (error) =>
        Effect.sync(() => {
          logError(`LLM call failed (model ${error.model}): ${error.message}`);
          process.exitCode = 1;
          return undefined;
        }),
      LlmOutputError: (error) =>
        Effect.sync(() => {
          logError(
            `LLM output invalid (model ${error.model}): ${error.message}`
          );
          process.exitCode = 1;
          return undefined;
        }),
      ViewCodeError: (error: ViewCodeError) =>
        Effect.sync(() => {
          logError(
            `View code failed checks after ${error.attempts} attempts (model ${error.model}, ${error.inputTokens} in, ${error.outputTokens} out, ${error.totalTokens} total tokens): ${error.message}`
          );
          process.exitCode = 1;
          return undefined;
        }),
    }),
    Effect.provide(Llm.layer())
  );

// Imported by the test, the command runs only when executed directly (import.meta.main, Node 24).
if (import.meta.main) {
  const parsed = parseArgs(process.argv.slice(2));
  if (Result.isFailure(parsed)) {
    logError(parsed.failure.message);
    process.exitCode = 1;
  } else {
    // A defect only: every expected failure is handled by tag in run().
    await Effect.runPromise(run(parsed.success)).then(
      (summary) => {
        if (summary !== undefined)
          process.stdout.write(`${toPrettyJson(summary)}\n`);
      },
      (defect) => {
        // defect: an unexpected throw from a dependency, not a modelled failure
        logError(String(defect));
        process.exitCode = 1;
      }
    );
  }
}

export { readText };
