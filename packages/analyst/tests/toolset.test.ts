import { test } from 'node:test'
import assert from 'node:assert/strict'
import { join } from 'node:path'
import { Effect } from 'effect'
import { openDb } from '../src/db.ts'
import { makeToolset } from '../src/toolset.ts'
import type { QueryOpts } from '../src/shapes.ts'

test('toolset guards real SQL and caps canonical query rows', async () => {
  await Effect.runPromise(Effect.scoped(Effect.gen(function* () {
    const db = yield* openDb({ dataDir: join(import.meta.dirname, 'fixtures/data') })
    let options: QueryOpts | undefined
    let executions = 0
    const toolset = makeToolset({ ...db, queryCanonical: (_sql, opts) => {
      options = opts
      executions++
      return Effect.succeed({ rows: Array.from({ length: 201 }, (_, value) => ({ value })), rowCount: 201 })
    } }, 'NJD')
    const output = yield* Effect.promise(() => toolset.tools.sql.execute({ query: 'SELECT * FROM team_games' }, { toolCallId: '1', messages: [] } as never))
    const parsed = JSON.parse(output)
    assert.equal(parsed.rows.length, 200)
    assert.equal(parsed.truncated, true)
    assert.deepEqual(options, { rowCap: 200, timeoutMs: 10_000 })
    const rejected = yield* Effect.promise(() => toolset.tools.sql.execute({ query: 'DROP TABLE team_games' }, { toolCallId: '2', messages: [] } as never))
    assert.match(rejected, /^ERROR:/)
    assert.equal(executions, 1)
  })))
})
