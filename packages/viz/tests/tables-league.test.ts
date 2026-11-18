import assert from 'node:assert/strict'
import { test } from 'node:test'
import { Effect } from 'effect'
import { MINI_GRAPH, makeMiniStore } from '../../history/tests/fakes.ts'
import { leagueSample } from '../src/samples.ts'
import { league } from '../src/tables/league.ts'

test('league on the C-mini store equals the league sample', async () => {
  const result = await Effect.runPromise(league(MINI_GRAPH, makeMiniStore()))
  assert.deepEqual(result.tables, leagueSample.tables)
  assert.equal(result.notes, leagueSample.notes)
})
