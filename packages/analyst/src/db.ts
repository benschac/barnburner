import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import {
  DuckDBInstance,
  DuckDBTypeId,
  JsonDuckDBValueConverter,
  StatementType,
} from "@duckdb/node-api";
import type { DuckDBResultReader } from "@duckdb/node-api";
import { Array, Clock, Effect, Order, Result, Semaphore } from "effect";
import type { Scope } from "effect";

import { toJson } from "./json.ts";
import { DbError, SqlError } from "./shapes.ts";
import type { Db, QueryOpts, QueryResult, Row } from "./shapes.ts";

export type OpenDbOpts = {
  readonly dataDir: string;
  // Directory of NN-name.sql files, loaded in sorted order. Defaults to src/views.
  readonly viewsDir?: string;
};

const defaultViewsDir = join(import.meta.dirname, "views");

const NUMERIC = new Set<number>([
  DuckDBTypeId.BIGINT,
  DuckDBTypeId.UBIGINT,
  DuckDBTypeId.HUGEINT,
  DuckDBTypeId.UHUGEINT,
  DuckDBTypeId.DECIMAL,
  DuckDBTypeId.DOUBLE,
  DuckDBTypeId.FLOAT,
]);

// Converts one JSON value by column type. Numbers that cannot survive JSON (NaN, Infinity) become null.
export const convertValue = (typeId: number, value: unknown): Row[string] => {
  if (value === null || value === undefined) return null;
  if (NUMERIC.has(typeId)) {
    const n = typeof value === "number" ? value : Number(value);
    return Number.isFinite(n) ? n : null;
  }
  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  )
    return value;
  return toJson(value);
};

export const convertRows = (
  reader: DuckDBResultReader,
  json: Record<string, unknown>[]
): Row[] => {
  const names = reader.deduplicatedColumnNames();
  const ids = reader.columnTypes().map((type) => type.typeId as number);
  return json.map((raw) => {
    const row: Row = {};
    names.forEach((name, index) => {
      row[name] = convertValue(ids[index] ?? -1, raw[name]);
    });
    return row;
  });
};

// Reads only the first `limit` rows as JSON values, so rows beyond a cap are never converted.
const readJsonRows = (
  reader: DuckDBResultReader,
  limit: number
): Record<string, unknown>[] => {
  const names = reader.deduplicatedColumnNames();
  const types = reader.columnTypes();
  const out: Record<string, unknown>[] = [];
  for (let r = 0; r < limit; r++) {
    const raw: Record<string, unknown> = {};
    names.forEach((name, c) => {
      const type = types[c];
      // defect: columnTypes has one entry per column name
      if (type === undefined) throw new Error(`No column type for ${name}`);
      raw[name] = JsonDuckDBValueConverter(
        reader.value(c, r),
        type,
        JsonDuckDBValueConverter
      );
    });
    out.push(raw);
  }
  return out;
};

const sqlLiteral = (value: string): string => value.replaceAll("'", "''");

export const openDb = (
  opts: OpenDbOpts
): Effect.Effect<Db, DbError, Scope.Scope> =>
  Effect.gen(function* () {
    const instance = yield* Effect.tryPromise({
      try: () => DuckDBInstance.create(":memory:"),
      catch: (error) =>
        new DbError({ message: `cannot create database: ${String(error)}` }),
    });
    yield* Effect.addFinalizer(() =>
      Effect.sync(() => {
        instance.closeSync();
      })
    );
    const connection = yield* Effect.tryPromise({
      try: () => instance.connect(),
      catch: (error) =>
        new DbError({ message: `cannot connect: ${String(error)}` }),
    });
    yield* Effect.addFinalizer(() =>
      Effect.sync(() => {
        connection.closeSync();
      })
    );

    const run = (sql: string, label: string) =>
      Effect.tryPromise({
        try: () => connection.run(sql),
        catch: (error) =>
          new DbError({
            message: `${label}: ${error instanceof Error ? error.message : String(error)}`,
          }),
      });

    const viewsDir = opts.viewsDir ?? defaultViewsDir;
    const files = yield* Effect.try({
      try: () =>
        Array.sort(
          readdirSync(viewsDir).filter((name) => name.endsWith(".sql")),
          Order.String
        ),
      catch: (error) =>
        new DbError({ message: `cannot read ${viewsDir}: ${String(error)}` }),
    });
    yield* Effect.forEach(
      files,
      (name) =>
        Effect.try({
          try: () => readFileSync(join(viewsDir, name), "utf-8"),
          catch: (error) =>
            new DbError({ message: `cannot read ${name}: ${String(error)}` }),
        }).pipe(
          Effect.flatMap((text) =>
            run(text.replaceAll("${DATA_DIR}", sqlLiteral(opts.dataDir)), name)
          )
        ),
      { discard: true }
    );
    yield* run("SET enable_external_access=false", "lock");
    yield* run("SET lock_configuration=true", "lock");

    // Why the text is not exactly one SELECT, judged by DuckDB's own parser on the final text; undefined when it is.
    const singleSelectRefusal = async (
      sql: string
    ): Promise<string | undefined> => {
      const statements = await connection.extractStatements(sql);
      if (statements.count !== 1)
        return `expected exactly one statement, got ${statements.count}`;
      const prepared = await statements.prepare(0);
      if (prepared.statementType !== StatementType.SELECT)
        return "only SELECT statements are allowed";
      return undefined;
    };

    // One query at a time per connection, so an interrupt can only ever hit its own statement.
    const gate = yield* Semaphore.make(1);
    yield* Effect.addFinalizer(() => gate.withPermit(Effect.void));

    // Runs one statement on the driver. Interrupting the fiber interrupts the statement and waits for it to settle.
    const runNative = (
      sql: string,
      rowCap: number | undefined,
      timeout: { readonly message: string; timedOut: boolean }
    ) =>
      Effect.callback<Result.Result<QueryResult, SqlError>>(
        (resume, signal) => {
          let active = true;
          const cancel = () => {
            if (active) connection.interrupt();
          };
          signal.addEventListener("abort", cancel, { once: true });
          const fail = (message: string) =>
            Result.fail(new SqlError({ message, sql }));
          const pending = (async (): Promise<
            Result.Result<QueryResult, SqlError>
          > => {
            if (signal.aborted) return fail("query cancelled");
            try {
              const refusal = await singleSelectRefusal(sql);
              if (refusal !== undefined)
                return fail(timeout.timedOut ? timeout.message : refusal);
              if (signal.aborted) return fail("query cancelled");
              const reader = await connection.runAndReadAll(sql);
              const total = reader.currentRowCount;
              const keep =
                rowCap === undefined
                  ? total
                  : Math.min(total, Math.max(0, rowCap));
              const rows = convertRows(reader, readJsonRows(reader, keep));
              return Result.succeed({ rows, rowCount: total });
            } catch (error) {
              // A driver exception is translated here; nothing else can reject this promise.
              return fail(
                timeout.timedOut
                  ? timeout.message
                  : error instanceof Error
                    ? error.message
                    : String(error)
              );
            } finally {
              active = false;
              signal.removeEventListener("abort", cancel);
            }
          })();
          void pending.then((result) => {
            resume(Effect.succeed(result));
          });
          return Effect.promise(async () => {
            cancel();
            await pending;
            signal.removeEventListener("abort", cancel);
          });
        }
      );

    // Interrupts the running statement once the deadline passes; never completes on its own.
    const expire = (timeoutMs: number, timeout: { timedOut: boolean }) =>
      Effect.sleep(timeoutMs).pipe(
        Effect.andThen(
          Effect.sync(() => {
            timeout.timedOut = true;
            connection.interrupt();
          })
        ),
        Effect.andThen(Effect.never)
      );

    const query = (
      sql: string,
      queryOpts?: QueryOpts
    ): Effect.Effect<QueryResult, SqlError> =>
      gate.withPermit(
        Effect.gen(function* () {
          const { timeoutMs, rowCap } = queryOpts ?? {};
          const started = yield* Clock.currentTimeMillis;
          const timeout = {
            message: `query timed out after ${timeoutMs}ms`,
            timedOut: false,
          };
          const native = runNative(sql, rowCap, timeout);
          const result = yield* timeoutMs === undefined
            ? native
            : Effect.raceFirst(native, expire(timeoutMs, timeout));
          const finished = yield* Clock.currentTimeMillis;
          if (
            Result.isSuccess(result) &&
            timeoutMs !== undefined &&
            (timeout.timedOut || finished - started > timeoutMs)
          ) {
            return yield* new SqlError({ message: timeout.message, sql });
          }
          return yield* Effect.fromResult(result);
        })
      );

    const queryCanonical = (
      sql: string,
      queryOpts?: QueryOpts
    ): Effect.Effect<QueryResult, SqlError> =>
      query(
        `SELECT * FROM (\n${sql.trim().replace(/;(\s|--[^\n]*)*$/, "")}\n) ORDER BY ALL`,
        queryOpts
      );

    return { query, queryCanonical };
  });
