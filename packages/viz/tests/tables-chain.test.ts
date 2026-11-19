import assert from 'node:assert/strict'
import { test } from 'node:test'
import { Array, Effect, Order } from 'effect'
import type { HistoryStore } from '@nhl-reddit-stats/history'
import { chain } from '../src/tables/chain.ts'
import { chainSample } from '../src/samples.ts'
import { MINI_GRAPH, makeMiniStore } from '../../history/tests/fakes.ts'

test('chain 11 to 14 on the shared test league matches chainSample', async () => {
  const view = await Effect.runPromise(chain(MINI_GRAPH, makeMiniStore(), 11, 14))
  assert.deepStrictEqual(view.tables, chainSample.tables)
  assert.equal(view.notes, chainSample.notes)
})

// Every teamId a hop names has a teams row, and no other.
const teamsCoverHops = (tables: { hops: ReadonlyArray<{ teamId: number }>, teams: ReadonlyArray<{ teamId: number }> }) => {
  const named = Array.sort(Array.dedupe(Array.map(tables.hops, (h) => h.teamId)), Order.Number)
  assert.deepStrictEqual(tables.teams.map((t) => t.teamId), named)
}

test('a goalie-partner hop and the chain through it get a teams row for every hop team', async () => {
  const store = makeMiniStore()
  const direct = await Effect.runPromise(chain(MINI_GRAPH, store, 16, 17))
  assert.equal(direct.tables.hops[0]?.kind, 'GoaliePartners')
  teamsCoverHops(direct.tables)
  const through = await Effect.runPromise(chain(MINI_GRAPH, store, 11, 18))
  assert.deepStrictEqual(through.tables.summary, [{ from: 11, to: 18, distance: 6, pathCount: 2, pathCountCapped: 0 }])
  assert.equal(through.tables.hops.length, 12)
  teamsCoverHops(through.tables)
  assert.deepStrictEqual(through.tables.teams.map((t) => t.abbrev), ['AAA', 'BBB', 'CCC'])
})

test('the club comes from the roster when no chain player has a stint for it', async () => {
  // Goalies 16 and 17 lose their stints, as if neither had a credited game for club 3 in the span.
  const base = makeMiniStore()
  const store: HistoryStore = {
    ...base,
    player: (playerId) => playerId === 16 || playerId === 17
      ? Effect.map(base.player(playerId), (detail) => ({ ...detail, stints: [] }))
      : base.player(playerId),
  }
  const view = await Effect.runPromise(chain(MINI_GRAPH, store, 16, 17))
  assert.equal(view.tables.hops[0]?.kind, 'GoaliePartners')
  teamsCoverHops(view.tables)
  assert.deepStrictEqual(view.tables.teams, [{ teamId: 3, abbrev: 'CCC', name: 'Charlie Club' }])
})
