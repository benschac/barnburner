import assert from 'node:assert/strict'
import { test } from 'node:test'
import { Result } from 'effect'
import { UnknownPlayer } from '../src/contracts.ts'
import { farthest } from '../src/farthest.ts'
import { DEFAULT_FILTER } from '../src/shapes.ts'
import type { FarthestResult, Filter } from '../src/shapes.ts'
import { MINI_GRAPH } from './fakes.ts'

const expectFarthest = (from: number, filter: Filter = DEFAULT_FILTER): FarthestResult => {
  const result = farthest(MINI_GRAPH, from, filter)
  assert.ok(Result.isSuccess(result), `expected a result from ${from}`)
  return result.success
}
const chain = (result: FarthestResult): ReadonlyArray<number> =>
  result.example.length === 0 ? [] : [result.example[0].from, ...result.example.map((hop) => hop.to)]

test('farthest from 11: distance 6, only 18, seven reachable, two unreachable', () => {
  const result = expectFarthest(11)
  assert.equal(result.distance, 6)
  assert.equal(result.atDistance, 1)
  assert.equal(result.reachable, 7)
  assert.equal(result.unreachable, 2)
})

test('the example for 11 is the first chain to 18, with 12 chosen before 13', () => {
  const result = expectFarthest(11)
  assert.deepEqual(chain(result), [11, 12, 14, 15, 16, 17, 18])
  assert.equal(result.example.length, result.distance)
  assert.equal(result.example[4]._tag, 'GoaliePartners')
})

test('goalie partners off: distance 4, only 16, five reachable, four unreachable', () => {
  const result = expectFarthest(11, { ...DEFAULT_FILTER, goaliePartners: false })
  assert.equal(result.distance, 4)
  assert.equal(result.atDistance, 1)
  assert.equal(result.reachable, 5)
  assert.equal(result.unreachable, 4)
  assert.deepEqual(chain(result), [11, 12, 14, 15, 16])
})

test('from 19: distance 1, only 20, one reachable, eight unreachable', () => {
  const result = expectFarthest(19)
  assert.equal(result.distance, 1)
  assert.equal(result.atDistance, 1)
  assert.equal(result.reachable, 1)
  assert.equal(result.unreachable, 8)
  assert.deepEqual(chain(result), [19, 20])
})

test('from 14: distance 4, only 18', () => {
  const result = expectFarthest(14)
  assert.equal(result.distance, 4)
  assert.equal(result.atDistance, 1)
  assert.deepEqual(chain(result), [14, 15, 16, 17, 18])
})

test('a player who reaches nobody has distance 0 and an empty example', () => {
  const result = expectFarthest(19, { ...DEFAULT_FILTER, competition: 'playoff' })
  assert.equal(result.distance, 0)
  assert.equal(result.atDistance, 0)
  assert.equal(result.reachable, 0)
  assert.equal(result.unreachable, 9)
  assert.deepEqual(result.example, [])
})

test('an unknown player fails with UnknownPlayer', () => {
  const result = farthest(MINI_GRAPH, 99, DEFAULT_FILTER)
  assert.ok(Result.isFailure(result))
  assert.ok(result.failure instanceof UnknownPlayer)
  assert.equal(result.failure.playerId, 99)
})
