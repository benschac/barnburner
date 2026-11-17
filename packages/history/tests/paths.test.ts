import assert from 'node:assert/strict'
import { test } from 'node:test'
import { Result } from 'effect'
import { NoPath, UnknownPlayer } from '../src/contracts.ts'
import { UNREACHED, bfsDistances, findPaths } from '../src/paths.ts'
import { DEFAULT_FILTER } from '../src/shapes.ts'
import type { Filter, PathResult } from '../src/shapes.ts'
import { MINI_GRAPH } from './fakes.ts'

const filterWith = (changes: Partial<Filter>): Filter => ({ ...DEFAULT_FILTER, ...changes })
const S2 = 19511952

const find = (from: number, to: number, filter: Filter = DEFAULT_FILTER) =>
  findPaths(MINI_GRAPH, from, to, filter, 'with', 1)

const expectPath = (from: number, to: number, filter: Filter = DEFAULT_FILTER): PathResult => {
  const result = find(from, to, filter)
  assert.ok(Result.isSuccess(result), `expected a path ${from} to ${to}`)
  return result.success
}
const expectFailure = (from: number, to: number, filter: Filter = DEFAULT_FILTER) => {
  const result = find(from, to, filter)
  assert.ok(Result.isFailure(result), `expected a failure ${from} to ${to}`)
  return result.failure
}
const ids = (result: PathResult): ReadonlyArray<number> => {
  const hops = result.paths[0]
  return [hops[0].from, ...hops.map((hop) => hop.to)]
}

test('11 to 14: 2 games beats 1, so the first chain goes through 12', () => {
  const result = expectPath(11, 14)
  assert.equal(result.distance, 2)
  assert.deepEqual(ids(result), [11, 12, 14])
  assert.equal(result.pathCount, 1)
  assert.equal(result.pathCountCapped, false)
  assert.equal(result.paths.length, 1)
})

test('hops carry the link total and the evidence span', () => {
  const [first, second] = expectPath(11, 14).paths[0]
  assert.deepEqual(first, {
    _tag: 'PlayedWith', from: 11, to: 12, games: 2, teamId: 1, seasonId: 19501951, gameType: 2, gameId: 1950020001,
  })
  assert.deepEqual(second, {
    _tag: 'PlayedWith', from: 12, to: 14, games: 2, teamId: 2, seasonId: S2, gameType: 2, gameId: 1951020001,
  })
})

test('11 to 16: distance 4, first chain 11-12-14-15-16, playoff evidence on 14-15', () => {
  const result = expectPath(11, 16)
  assert.equal(result.distance, 4)
  assert.deepEqual(ids(result), [11, 12, 14, 15, 16])
  assert.deepEqual(result.paths[0][2], {
    _tag: 'PlayedWith', from: 14, to: 15, games: 2, teamId: 2, seasonId: S2, gameType: 3, gameId: 1951030111,
  })
})

test('11 to 18: distance 6 through the goalie-partner hop 16-17 with game E', () => {
  const result = expectPath(11, 18)
  assert.equal(result.distance, 6)
  assert.deepEqual(ids(result), [11, 12, 14, 15, 16, 17, 18])
  assert.deepEqual(result.paths[0][4], {
    _tag: 'GoaliePartners', from: 16, to: 17, games: 3, teamId: 3, seasonId: S2, gameType: 2, gameId: 1951020001,
  })
  assert.equal(result.paths[0][5]._tag, 'PlayedWith')
})

test('11 to 18 with goalie partners off has no path', () => {
  const failure = expectFailure(11, 18, filterWith({ goaliePartners: false }))
  assert.ok(failure instanceof NoPath)
  assert.equal(failure.from, 11)
  assert.equal(failure.to, 18)
})

test('11 to 19 has no path; an unknown player is a different failure', () => {
  assert.ok(expectFailure(11, 19) instanceof NoPath)
  const unknownFrom = expectFailure(99, 11)
  assert.ok(unknownFrom instanceof UnknownPlayer)
  assert.equal(unknownFrom.playerId, 99)
  const unknownTo = expectFailure(11, 98)
  assert.ok(unknownTo instanceof UnknownPlayer)
  assert.equal(unknownTo.playerId, 98)
})

test('11 to 15 in the regular season only has no path', () => {
  assert.ok(expectFailure(11, 15, filterWith({ competition: 'regular' })) instanceof NoPath)
})

test('12 to 13 in 1951-52 only: distance 2 through 14; 11 to 14 has no path', () => {
  const filter = filterWith({ fromSeason: S2, toSeason: S2 })
  const result = expectPath(12, 13, filter)
  assert.equal(result.distance, 2)
  assert.deepEqual(ids(result), [12, 14, 13])
  assert.ok(result.paths[0].every((hop) => hop._tag !== 'PlayedAgainst' && hop.seasonId === S2))
  assert.ok(expectFailure(11, 14, filter) instanceof NoPath)
})

test('the same player is distance 0 with one empty path', () => {
  const result = expectPath(11, 11)
  assert.equal(result.distance, 0)
  assert.equal(result.pathCount, 1)
  assert.deepEqual(result.paths, [[]])
})

test('against and either are placeholders until Q7', () => {
  assert.ok(Result.isFailure(findPaths(MINI_GRAPH, 11, 14, DEFAULT_FILTER, 'against', 1)))
  assert.ok(Result.isFailure(findPaths(MINI_GRAPH, 11, 14, DEFAULT_FILTER, 'either', 1)))
})

test('bfsDistances: a full sweep from 11 leaves 19 and 20 unreached', () => {
  const index = (id: number) => MINI_GRAPH.indexOf.get(id) ?? -1
  const distance = bfsDistances(MINI_GRAPH, index(11), DEFAULT_FILTER, -1)
  const byId = [11, 12, 13, 14, 15, 16, 17, 18, 19, 20].map((id) => distance[index(id)])
  assert.deepEqual(byId, [0, 1, 1, 2, 3, 4, 5, 6, UNREACHED, UNREACHED])
})
