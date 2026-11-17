import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { DuckDBInstance, DuckDBTypeId, StatementType } from '@duckdb/node-api'
import type { DuckDBResultReader } from '@duckdb/node-api'
import { Effect, type Scope } from 'effect'
import { type Db, DbError, type QueryOpts, type QueryResult, type Row, SqlError } from './shapes.ts'

export interface OpenDbOpts {
  readonly dataDir: string
  // Directory of NN-name.sql files, loaded in sorted order. Defaults to src/views.
  readonly viewsDir?: string
}

const defaultViewsDir = join(dirname(fileURLToPath(import.meta.url)), 'views')

const NUMERIC = new Set<number>([
  DuckDBTypeId.BIGINT,
  DuckDBTypeId.UBIGINT,
  DuckDBTypeId.HUGEINT,
  DuckDBTypeId.UHUGEINT,
  DuckDBTypeId.DECIMAL,
  DuckDBTypeId.DOUBLE,
  DuckDBTypeId.FLOAT,
])

// Converts one JSON value by column type. Numbers that cannot survive JSON (NaN, Infinity) become null.
export const convertValue = (typeId: number, value: unknown): Row[string] => {
  if (value === null || value === undefined) return null
  if (NUMERIC.has(typeId)) {
    const n = typeof value === 'number' ? value : Number(value)
    return Number.isFinite(n) ? n : null
  }
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value
  return JSON.stringify(value)
}

export const convertRows = (reader: DuckDBResultReader, json: Record<string, unknown>[]): Row[] => {
  const names = reader.deduplicatedColumnNames()
  const ids = reader.columnTypes().map((type) => type.typeId as number)
  return json.map((raw) => {
    const row: Row = {}
    names.forEach((name, index) => {
      row[name] = convertValue(ids[index] ?? -1, raw[name])
    })
    return row
  })
}

const sqlLiteral = (value: string): string => value.replaceAll("'", "''")

export const openDb = (opts: OpenDbOpts): Effect.Effect<Db, DbError, Scope.Scope> =>
  Effect.gen(function* () {
    const instance = yield* Effect.tryPromise({
      try: () => DuckDBInstance.create(':memory:'),
      catch: (error) => new DbError({ message: `cannot create database: ${String(error)}` }),
    })
    yield* Effect.addFinalizer(() => Effect.sync(() => instance.closeSync()))
    const connection = yield* Effect.tryPromise({
      try: () => instance.connect(),
      catch: (error) => new DbError({ message: `cannot connect: ${String(error)}` }),
    })
    yield* Effect.addFinalizer(() => Effect.sync(() => connection.closeSync()))

    const run = (sql: string, label: string) =>
      Effect.tryPromise({
        try: () => connection.run(sql),
        catch: (error) => new DbError({ message: `${label}: ${error instanceof Error ? error.message : String(error)}` }),
      })

    const viewsDir = opts.viewsDir ?? defaultViewsDir
    const files = yield* Effect.try({
      try: () => readdirSync(viewsDir).filter((name) => name.endsWith('.sql')).sort(),
      catch: (error) => new DbError({ message: `cannot read ${viewsDir}: ${String(error)}` }),
    })
    for (const name of files) {
      const text = yield* Effect.try({
        try: () => readFileSync(join(viewsDir, name), 'utf8'),
        catch: (error) => new DbError({ message: `cannot read ${name}: ${String(error)}` }),
      })
      yield* run(text.replaceAll('${DATA_DIR}', sqlLiteral(opts.dataDir)), name)
    }
    yield* run('SET enable_external_access=false', 'lock')
    yield* run('SET lock_configuration=true', 'lock')

    // Refuses anything that is not exactly one SELECT, judged by DuckDB's own parser on the final text.
    const assertSingleSelect = async (sql: string): Promise<void> => {
      const statements = await connection.extractStatements(sql)
      if (statements.count !== 1) throw new Error(`expected exactly one statement, got ${statements.count}`)
      const prepared = await statements.prepare(0)
      if (prepared.statementType !== StatementType.SELECT) throw new Error('only SELECT statements are allowed')
    }

    const query = (sql: string, _opts?: QueryOpts): Effect.Effect<QueryResult, SqlError> =>
      Effect.tryPromise({
        try: async () => {
          await assertSingleSelect(sql)
          const reader = await connection.runAndReadAll(sql)
          const rows = convertRows(reader, await reader.getRowObjectsJson())
          return { rows, rowCount: rows.length }
        },
        catch: (error) => new SqlError({ message: error instanceof Error ? error.message : String(error), sql }),
      })

    const queryCanonical = (sql: string, queryOpts?: QueryOpts): Effect.Effect<QueryResult, SqlError> =>
      query(`SELECT * FROM (\n${sql.trim().replace(/;(\s|--[^\n]*)*$/, '')}\n) ORDER BY ALL`, queryOpts)

    return { query, queryCanonical }
  })
