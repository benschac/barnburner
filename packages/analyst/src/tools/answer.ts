import { jsonSchema, tool } from "ai";
import { Effect, Result, Schema } from "effect";

import { checkWith } from "../json.ts";
import { Answered, Coverage } from "../shapes.ts";
import type { Answer, Db, Guard, Row } from "../shapes.ts";

export type AnswerDeps = {
  readonly db: Db;
  readonly guard: Guard;
  // Team whose boxscore coverage is attached when the query reads box scores.
  readonly team: string;
  readonly onAnswer: (a: Answer) => void;
};

export type AnswerInput = {
  readonly query: string;
  readonly row: number;
  readonly column: string;
};

const AnswerInputSchema = Schema.Struct({
  query: Schema.String.annotate({ message: "query must be a string" }),
  row: Schema.Number.annotate({
    message: "row must be a non-negative integer",
  }).check(
    Schema.isFinite({ message: "row must be a non-negative integer" }),
    Schema.isInt({ message: "row must be a non-negative integer" }),
    Schema.isGreaterThanOrEqualTo(0, {
      message: "row must be a non-negative integer",
    })
  ),
  column: Schema.String.annotate({ message: "column must be a string" }),
}).annotate({ message: "input must be an object" });

// Runtime check of model-supplied arguments. Wrong types are reported, never coerced.
export const checkAnswerInput = checkWith(AnswerInputSchema);

const fail = (reason: string): string => `ERROR: ${reason}`;

// Exact SQL text; the fake DB in tests keys on it.
export const coverageSql = (team: string): string =>
  `SELECT archived, finals FROM boxscore_coverage WHERE team = '${team.replaceAll("'", "''")}'`;

const readCoverage = (
  deps: AnswerDeps
): Effect.Effect<Result.Result<Coverage, string>> =>
  Effect.gen(function* () {
    const result = yield* Effect.result(deps.db.query(coverageSql(deps.team)));
    if (Result.isFailure(result)) return Result.fail(result.failure.message);
    const row = result.success.rows[0];
    if (row === undefined) return Result.fail("missing");
    return Result.mapError(
      Schema.decodeUnknownResult(Coverage)(row),
      () => "boxscore_coverage has no numeric counts"
    );
  });

// Returns "ok" or "ERROR: <reason>". Tool errors go back to the model as text.
export const runAnswer = (
  deps: AnswerDeps,
  raw: unknown
): Effect.Effect<string> =>
  Effect.gen(function* () {
    const checked = checkAnswerInput(raw);
    if (!checked.ok) return fail(checked.reason);
    const input = checked.input;
    const verdict = yield* deps.guard(deps.db, input.query);
    if (!verdict.ok) return fail(verdict.reason);

    const result = yield* Effect.result(deps.db.queryCanonical(input.query));
    if (Result.isFailure(result)) return fail(result.failure.message);
    const rows: readonly Row[] = result.success.rows;

    if (
      !Number.isInteger(input.row) ||
      input.row < 0 ||
      input.row >= rows.length
    ) {
      return fail(
        `row ${input.row} is out of range (result has ${rows.length} rows)`
      );
    }
    const row = rows[input.row];
    if (!Object.hasOwn(row, input.column)) {
      return fail(
        `column ${input.column} is not in the result (columns: ${Object.keys(row).join(", ") || "none"})`
      );
    }
    const value = row[input.column];

    let coverage: Coverage | undefined;
    if (verdict.touchesBoxscores) {
      const found = yield* readCoverage(deps);
      if (Result.isFailure(found)) {
        if (found.failure === "missing")
          return fail(`no boxscore_coverage row for ${deps.team}`);
        return fail(`coverage query failed: ${found.failure}`);
      }
      coverage = found.success;
    }

    deps.onAnswer(
      coverage === undefined
        ? Answered.make({ value, query: input.query })
        : Answered.make({ value, query: input.query, coverage })
    );
    return "ok";
  });

export const makeAnswerTool = (deps: AnswerDeps) =>
  tool({
    description:
      "Record the answer to the user question. Give the SQL query, the zero-based row index, and the column name of the single cell that answers the question. The query must be a single SELECT over the allowed views.",
    inputSchema: jsonSchema<AnswerInput>(
      {
        type: "object",
        properties: {
          query: { type: "string", description: "A single SELECT statement." },
          row: {
            type: "integer",
            minimum: 0,
            description: "Zero-based row index in the query result.",
          },
          column: {
            type: "string",
            description: "Column name in the query result.",
          },
        },
        required: ["query", "row", "column"],
        additionalProperties: false,
      },
      {
        validate: (value) => {
          const checked = checkAnswerInput(value);
          return checked.ok
            ? { success: true, value: checked.input }
            : { success: false, error: new Error(checked.reason) };
        },
      }
    ),
    execute: (input, { abortSignal }) =>
      Effect.runPromise(runAnswer(deps, input), { signal: abortSignal }),
  });
