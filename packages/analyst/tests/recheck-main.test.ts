import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Effect } from 'effect'
import { openDb } from '../src/db.ts'
import { guardQuery } from '../src/guard.ts'
import { fillCard } from '../src/tools/submit-card.ts'
import { writeCards } from '../src/store.ts'
import { recheckInsights } from '../scripts/recheck-insights.ts'

const dataDir = fileURLToPath(new URL('./fixtures/data', import.meta.url))
const query = "SELECT count(*) AS n FROM team_games WHERE team = 'NJD' AND is_final"
const gamesQuery = "SELECT game_id FROM team_games WHERE team = 'NJD' AND is_final ORDER BY game_id"

const makeCard = () =>
  Effect.runPromise(
    Effect.scoped(
      Effect.gen(function* () {
        const db = yield* openDb({ dataDir })
        const card = yield* fillCard(
          { db, guard: guardQuery },
          {
            team: 'NJD', kind: 'record', headline: '{n} games played', body: 'All final.',
            bindings: { n: { column: 'n', row: 0 } }, evidence: { query, gamesQuery },
          },
          { model: 'm', runId: 'r', asOf: { fetchedAt: 'old', completedGameIds: 0 } },
        )
        return { ...card, status: 'approved' as const }
      }),
    ),
  )

test('recheckInsights with a missing insights dir reports zero cards', async () => {
  const dir = join(mkdtempSync(join(tmpdir(), 'recheck-main-')), 'absent')
  assert.deepEqual(await Effect.runPromise(recheckInsights({ dir, dataDir })), { unchanged: 0, refreshed: 0, stale: 0 })
})

test('recheckInsights rechecks an approved card against the real database', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'recheck-main-'))
  const card = await makeCard()
  writeCards(dir, 'NJD', [card])
  const summary = await Effect.runPromise(recheckInsights({ dir, dataDir }))
  // Data is unchanged, so the card stays as is.
  assert.deepEqual(summary, { unchanged: 1, refreshed: 0, stale: 0 })

  // Tamper with the stored result: the rerun must refresh it and stamp asOf from the poster file.
  writeCards(dir, 'NJD', [{ ...card, evidence: { ...card.evidence, result: [{ n: 99 }] } }])
  assert.deepEqual(await Effect.runPromise(recheckInsights({ dir, dataDir })), { unchanged: 0, refreshed: 1, stale: 0 })
  const saved = JSON.parse(readFileSync(join(dir, 'NJD.json'), 'utf8'))[0]
  assert.equal(saved.status, 'approved')
  assert.deepEqual(saved.evidence.result, card.evidence.result)
  assert.deepEqual(saved.asOf, { fetchedAt: '2026-11-16T15:12:15.816Z', completedGameIds: 3 })
})
