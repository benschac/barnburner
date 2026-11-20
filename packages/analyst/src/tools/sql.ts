import { jsonSchema, tool } from "ai";
import { Effect } from "effect";

import { toJson } from "../json.ts";
import type { Db, Guard } from "../shapes.ts";

export interface SqlDeps {
  readonly db: Db;
  readonly guard: Guard;
  readonly timeoutMs?: number;
  readonly rowCap?: number;
}

const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_ROW_CAP = 200;

export const runSql = (deps: SqlDeps, query: string): Effect.Effect<string> => {
  const timeoutMs = deps.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const rowCap = deps.rowCap ?? DEFAULT_ROW_CAP;
  return Effect.gen(function* () {
    const verdict = yield* deps.guard(deps.db, query);
    if (!verdict.ok) return `ERROR: ${verdict.reason}`;
    const result = yield* deps.db.queryCanonical(query, { timeoutMs, rowCap });
    const rows = result.rows.slice(0, rowCap);
    return toJson({
      rows,
      rowCount: result.rowCount,
      truncated: result.rowCount > rows.length,
    });
  }).pipe(
    Effect.catchTag("SqlError", (e) => Effect.succeed(`ERROR: ${e.message}`))
  );
};

export const sqlTool = (deps: SqlDeps) =>
  tool({
    description:
      "Run one read-only DuckDB SELECT against the analyst views. Returns JSON { rows, rowCount, truncated } or ERROR: <reason>.",
    inputSchema: jsonSchema<{ query: string }>({
      type: "object",
      properties: {
        query: { type: "string", description: "A single SELECT statement." },
      },
      required: ["query"],
      additionalProperties: false,
    }),
    execute: ({ query }, { abortSignal }) =>
      Effect.runPromise(runSql(deps, query), { signal: abortSignal }),
  });

export const makeSqlTool = sqlTool;
