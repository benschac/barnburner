import { Effect } from 'effect'
import { type Db, type Guard, type GuardResult, VIEWS } from './shapes.ts'

type Json = unknown
type Obj = Record<string, Json>

const BOXSCORE_TABLES = new Set(['skater_games', 'goalie_games'])
const ALLOWED_TABLES = new Set<string>(Object.keys(VIEWS))
// Table-reference node types that are pure plumbing. Anything else that looks like a source is rejected.
const SAFE_REF_TYPES = new Set(['BASE_TABLE', 'JOIN', 'SUBQUERY', 'EMPTY', 'PIVOT', 'EXPRESSION_LIST'])

const isObj = (value: Json): value is Obj => typeof value === 'object' && value !== null && !Array.isArray(value)

const fail = (reason: string): GuardResult => ({ ok: false, reason })

const sqlLiteral = (value: string): string => value.replaceAll("'", "''")

// Names defined by any WITH clause in the tree (CTE scoping is not tracked; a CTE name is never a data file).
const collectCteNames = (node: Json, names: Set<string>): void => {
  if (Array.isArray(node)) return node.forEach((child) => collectCteNames(child, names))
  if (!isObj(node)) return
  const map = isObj(node.cte_map) ? node.cte_map.map : undefined
  if (Array.isArray(map)) {
    for (const entry of map) if (isObj(entry) && typeof entry.key === 'string') names.add(entry.key.toLowerCase())
  }
  for (const child of Object.values(node)) collectCteNames(child, names)
}

interface Scan {
  reason: string | null
  touchesBoxscores: boolean
}

const scan = (node: Json, cteNames: ReadonlySet<string>, state: Scan): void => {
  if (state.reason !== null) return
  if (Array.isArray(node)) return node.forEach((child) => scan(child, cteNames, state))
  if (!isObj(node)) return

  // A table reference carries both `alias` and `sample`; every one must be a known-safe kind.
  if ('sample' in node && 'alias' in node && typeof node.type === 'string') {
    if (!SAFE_REF_TYPES.has(node.type)) {
      state.reason = `source not allowed: ${node.type}`
      return
    }
    if (node.type === 'BASE_TABLE') {
      const name = typeof node.table_name === 'string' ? node.table_name.toLowerCase() : ''
      if (node.schema_name || node.catalog_name || node.at_clause) {
        state.reason = `qualified table not allowed: ${name}`
        return
      }
      if (BOXSCORE_TABLES.has(name)) state.touchesBoxscores = true
      if (!cteNames.has(name) && !ALLOWED_TABLES.has(name)) {
        state.reason = `unknown table: ${name}`
        return
      }
    }
  }
  for (const child of Object.values(node)) scan(child, cteNames, state)
}

export const guardQuery: Guard = (db: Db, sql: string) =>
  db.query(`SELECT json_serialize_sql('${sqlLiteral(sql)}') AS tree`).pipe(
    Effect.map((result): GuardResult => {
      const raw = result.rows[0]?.tree
      if (typeof raw !== 'string') return fail('parser returned no result')
      let tree: Json
      try {
        tree = JSON.parse(raw)
      } catch {
        return fail('parser returned invalid JSON')
      }
      if (!isObj(tree)) return fail('parser returned an unexpected shape')
      if (tree.error === true) {
        return fail(typeof tree.error_message === 'string' ? tree.error_message : 'not a single SELECT statement')
      }
      const statements = tree.statements
      if (!Array.isArray(statements) || statements.length !== 1) return fail('exactly one SELECT statement is required')
      const cteNames = new Set<string>()
      collectCteNames(statements[0], cteNames)
      const state: Scan = { reason: null, touchesBoxscores: false }
      scan(statements[0], cteNames, state)
      return state.reason === null ? { ok: true, touchesBoxscores: state.touchesBoxscores } : fail(state.reason)
    }),
    Effect.catch((error) => Effect.succeed(fail(error.message))),
  )
