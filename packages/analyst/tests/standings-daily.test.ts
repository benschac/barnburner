import { test } from 'node:test'
import assert from 'node:assert/strict'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Effect } from 'effect'
import { openDb } from '../src/db.ts'
import { VIEWS } from '../src/shapes.ts'

const here = dirname(fileURLToPath(import.meta.url))
const dataDir = join(here, 'fixtures', 'data')
const viewsDir = join(here, '..', 'src', 'views')

test('standings_daily matches the fixture history', async () => {
  const rows = await Effect.runPromise(
    Effect.scoped(
      Effect.gen(function* () {
        const db = yield* openDb({ dataDir, viewsDir })
        const cols = yield* db.query('select * from standings_daily limit 1')
        assert.deepEqual(Object.keys(cols.rows[0] ?? {}), [...VIEWS.standings_daily])
        const result = yield* db.query('select * from standings_daily order by date, rank_conf')
        return result.rows
      }),
    ),
  )
  assert.deepEqual(
    rows.map((r) => [r.date, r.team, r.points, r.played, r.rank_div, r.rank_conf, r.wc_rank]),
    [
      ['2026-10-17', 'WSH', 10, 8, 3, 1, 0],
      ['2026-10-17', 'NJD', 8, 8, 5, 2, 5],
      ['2026-11-12', 'NJD', 28, 20, 2, 1, 0],
      ['2026-11-12', 'WSH', 20, 17, 4, 2, 3],
      ['2026-11-14', 'NJD', 30, 21, 2, 1, 0],
      ['2026-11-14', 'WSH', 20, 18, 5, 2, 4],
    ],
  )
})
