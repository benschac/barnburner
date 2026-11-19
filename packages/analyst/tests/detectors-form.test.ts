import { test } from 'node:test'
import assert from 'node:assert/strict'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Effect, Result, Schema } from 'effect'
import { CardDraft } from '../src/card.ts'
import { openDb } from '../src/db.ts'
import { guardQuery } from '../src/guard.ts'
import { literalDigits, render } from '../src/render.ts'
import type { Db } from '../src/shapes.ts'
import { lastTen } from '../src/detectors/last-ten.ts'
import { streak } from '../src/detectors/streak.ts'

const dataDir = join(fileURLToPath(new URL('.', import.meta.url)), 'fixtures', 'data')

const withDb = (run: (db: Db) => Promise<void>): Promise<void> =>
  Effect.runPromise(
    Effect.scoped(
      Effect.gen(function* () {
        const db = yield* openDb({ dataDir })
        yield* Effect.promise(() => run(db))
      }),
    ),
  )

const check = async (db: Db, draft: CardDraft) => {
  Schema.decodeSync(CardDraft)(draft)
  assert.deepEqual(literalDigits(draft.headline), [])
  assert.deepEqual(literalDigits(draft.body), [])
  const sqls = [draft.evidence.query, draft.evidence.gamesQuery, draft.assert].filter((s): s is string => s !== undefined)
  for (const sql of sqls) {
    const verdict = await Effect.runPromise(guardQuery(db, sql))
    assert.equal(verdict.ok, true, sql)
    await Effect.runPromise(db.queryCanonical(sql))
  }
  const { rows } = await Effect.runPromise(db.queryCanonical(draft.evidence.query))
  const games = draft.evidence.gamesQuery === undefined ? [] : (await Effect.runPromise(db.queryCanonical(draft.evidence.gamesQuery))).rows
  return {
    headline: Result.getOrThrow(render(draft.headline, draft.bindings, rows)),
    body: Result.getOrThrow(render(draft.body, draft.bindings, rows)),
    games,
  }
}

test('last-ten works with fewer finals than the window', async () => {
  await withDb(async (db) => {
    const drafts = lastTen('NJD')
    assert.equal(drafts.length, 1)
    assert.equal(drafts[0]?.kind, 'trend')
    const out = await check(db, drafts[0] as CardDraft)
    assert.equal(out.headline, 'NJD are 2-1-0 in their last 3 games')
    assert.match(out.body, /Their season record is 2-1-0 over 3 games\./)
    assert.equal(out.games.length, 3)
  })
})

test('streak is a trend that states the current and longest runs without a tie claim', async () => {
  await withDb(async (db) => {
    const draft = streak('NJD')[0] as CardDraft
    assert.equal(draft.kind, 'trend')
    assert.equal(draft.assert, undefined)
    const out = await check(db, draft)
    assert.equal(out.headline, 'NJD are on a 2-game winning streak')
    assert.equal(out.body, 'Their longest winning streak this season is 2 games.')
    assert.deepEqual(out.games.map((r) => r.game_id), [2026020303, 2026020318])
  })
})

test('streak for WSH is a losing streak', async () => {
  await withDb(async (db) => {
    const out = await check(db, streak('WSH')[0] as CardDraft)
    assert.equal(out.headline, 'WSH are on a 2-game losing streak')
  })
})
