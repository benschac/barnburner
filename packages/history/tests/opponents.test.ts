import assert from 'node:assert/strict'
import { test } from 'node:test'
import { Array, Order, Result, Schema } from 'effect'
import { HistoryUnavailable, NoPath, UnknownPlayer, UnsupportedFilter } from '../src/contracts.ts'
import { link, makeGraph, opponentAdjacency, opponents } from '../src/graph.ts'
import { findPaths } from '../src/paths.ts'
import { DEFAULT_FILTER } from '../src/shapes.ts'
import type { Filter, PathResult, Relation } from '../src/shapes.ts'
import { MINI_ARRAYS, MINI_GRAPH } from './fakes.ts'

const filterWith = (changes: Partial<Filter>): Filter => ({ ...DEFAULT_FILTER, ...changes })

// The mini league without its opponent arrays, as a store that has not loaded them yet.
const { oppA, oppB, oppGames, ...TEAMMATES_ONLY } = MINI_ARRAYS
assert.ok(oppA !== undefined && oppB !== undefined && oppGames !== undefined)

// Opponent pairs and games of C-mini. A dressed goalie is nobody's opponent.
const PAIRS: ReadonlyArray<readonly [number, number, number]> = [
  [11, 15, 2], [11, 16, 2], [11, 19, 1], [11, 20, 1], [12, 15, 2], [12, 16, 3], [12, 17, 1], [12, 18, 1],
  [13, 16, 1], [13, 19, 1], [13, 20, 1], [14, 16, 4], [14, 17, 1], [14, 18, 1], [15, 16, 2],
]

const opponentsOf = (playerId: number) => {
  const result = opponents(MINI_GRAPH, playerId)
  assert.ok(Result.isSuccess(result), `opponents of ${playerId}`)
  return result.success
}

test('opponents of 16: 14 (4 games), 12 (3), 11 (2), 15 (2), 13 (1)', () => {
  assert.deepEqual(opponentsOf(16), [
    { playerId: 14, games: 4 }, { playerId: 12, games: 3 }, { playerId: 11, games: 2 },
    { playerId: 15, games: 2 }, { playerId: 13, games: 1 },
  ])
})

test('every player lists exactly the C-mini pairs, symmetric, most games first then lower ID', () => {
  const expected = new Map<number, Array<{ playerId: number; games: number }>>()
  for (const [a, b, games] of PAIRS) {
    expected.set(a, [...(expected.get(a) ?? []), { playerId: b, games }])
    expected.set(b, [...(expected.get(b) ?? []), { playerId: a, games }])
  }
  for (const playerId of MINI_ARRAYS.playerIds) {
    const want = Array.sortBy(
      Order.mapInput(Order.flip(Order.Number), (row: { readonly games: number; readonly playerId: number }) => row.games),
      Order.mapInput(Order.Number, (row: { readonly games: number; readonly playerId: number }) => row.playerId),
    )(expected.get(playerId) ?? [])
    assert.deepEqual(opponentsOf(playerId), want, `opponents of ${playerId}`)
  }
})

test('12 against 16 is 3 games: the dressed goalie in game D adds none', () => {
  const result = link(MINI_GRAPH, 12, 16, DEFAULT_FILTER)
  assert.ok(Result.isSuccess(result))
  assert.equal(result.success.opposedGames, 3)
  assert.deepEqual(opponentsOf(12).find((o) => o.playerId === 16), { playerId: 16, games: 3 })
  assert.equal(opponentsOf(12).find((o) => o.playerId === 17)?.games, 1)
})

test('goalie 21, dressed only, is unknown; a small-league player lists only who he faced', () => {
  const unknown = opponents(MINI_GRAPH, 21)
  assert.ok(Result.isFailure(unknown))
  assert.ok(Schema.is(UnknownPlayer)(unknown.failure))
  assert.deepEqual(opponentsOf(20), [{ playerId: 11, games: 1 }, { playerId: 13, games: 1 }])
})

test('15 and 16 are teammates and opponents; link shows both', () => {
  const result = link(MINI_GRAPH, 15, 16, DEFAULT_FILTER)
  assert.ok(Result.isSuccess(result))
  assert.equal(result.success.totalGames, 2)
  assert.equal(result.success.opposedGames, 2)
  assert.deepEqual(link(MINI_GRAPH, 16, 15, DEFAULT_FILTER), result)
})

test('the opponent adjacency is built once per graph and cached; absent arrays give undefined', () => {
  const graph = makeGraph(MINI_ARRAYS)
  const first = opponentAdjacency(graph)
  assert.ok(first !== undefined)
  assert.equal(opponentAdjacency(graph), first)
  assert.equal(first.neighbours.length, 2 * PAIRS.length)
  assert.equal(opponentAdjacency(makeGraph(TEAMMATES_ONLY)), undefined)
})

const paths = (from: number, to: number, relation: Relation, filter: Filter = DEFAULT_FILTER) =>
  findPaths(MINI_GRAPH, from, to, filter, relation, 1)
const expectPath = (from: number, to: number, relation: Relation): PathResult => {
  const result = paths(from, to, relation)
  assert.ok(Result.isSuccess(result), `expected a ${relation} path ${from} to ${to}`)
  return result.success
}
const summary = (result: PathResult) => result.paths[0].map((hop) => [hop._tag, hop.from, hop.to, hop.games])

test('against only, 11 to 19: distance 1, one game', () => {
  const result = expectPath(11, 19, 'against')
  assert.equal(result.distance, 1)
  assert.equal(result.pathCount, 1)
  assert.equal(result.pathCountCapped, false)
  assert.deepEqual(result.paths, [[{ _tag: 'PlayedAgainst', from: 11, to: 19, games: 1 }]])
})

test('against only never uses teammate links: 11 to 12 is 2 hops, tied on games so the lower ID (15) goes first', () => {
  const result = expectPath(11, 12, 'against')
  assert.equal(result.distance, 2)
  assert.deepEqual(summary(result), [['PlayedAgainst', 11, 15, 2], ['PlayedAgainst', 15, 12, 2]])
})

test('against only, 11 to 18: three hops through 15 then 12', () => {
  const result = expectPath(11, 18, 'against')
  assert.equal(result.distance, 3)
  assert.deepEqual(summary(result), [
    ['PlayedAgainst', 11, 15, 2], ['PlayedAgainst', 15, 12, 2], ['PlayedAgainst', 12, 18, 1],
  ])
})

test('against only with no opponent pairs at all is NoPath, not HistoryUnavailable', () => {
  const none = findPaths(
    makeGraph({ ...MINI_ARRAYS, oppA: Uint16Array.of(), oppB: Uint16Array.of(), oppGames: Uint16Array.of() }),
    11, 19, DEFAULT_FILTER, 'against', 1,
  )
  assert.ok(Result.isFailure(none))
  assert.ok(Schema.is(NoPath)(none.failure))
})

test('either relation, 11 to 18: distance 2, 11-12 as teammates then 12-18 as opponents', () => {
  const result = expectPath(11, 18, 'either')
  assert.equal(result.distance, 2)
  assert.equal(result.pathCount, 1)
  assert.deepEqual(result.paths, [[
    {
      _tag: 'PlayedWith', from: 11, to: 12, games: 2, teamId: 1, seasonId: 19501951, gameType: 2, gameId: 1950020001,
    },
    { _tag: 'PlayedAgainst', from: 12, to: 18, games: 1 },
  ]])
})

test('either: a pair linked both ways is a teammate hop weighted by teammate games', () => {
  const result = expectPath(15, 16, 'either')
  assert.equal(result.distance, 1)
  assert.deepEqual(result.paths[0].map((hop) => hop._tag), ['PlayedWith'])
  assert.equal(result.paths[0][0].games, 2)
})

test('either: teammate and opponent first hops compare on games, then on lower ID (13 to 15 goes through 11)', () => {
  const result = expectPath(13, 15, 'either')
  assert.equal(result.distance, 2)
  // 13 reaches 15 in two hops via 11 (teammate, 1 game), 14 (teammate, 1) or 16 (opponent, 1): a three-way tie.
  assert.deepEqual(summary(result), [['PlayedWith', 13, 11, 1], ['PlayedAgainst', 11, 15, 2]])
})

test('either: an opponent-only pair is a PlayedAgainst hop; a player to himself is distance 0', () => {
  const result = expectPath(11, 20, 'either')
  assert.equal(result.distance, 1)
  assert.deepEqual(result.paths[0], [{ _tag: 'PlayedAgainst', from: 11, to: 20, games: 1 }])
  const self = expectPath(11, 11, 'either')
  assert.equal(self.distance, 0)
  assert.deepEqual(self.paths, [[]])
})

test('against and either reject any non-default filter with UnsupportedFilter', () => {
  const filters: ReadonlyArray<Filter> = [
    filterWith({ competition: 'regular' }), filterWith({ competition: 'playoff' }),
    filterWith({ fromSeason: 19511952 }), filterWith({ toSeason: 19501951 }), filterWith({ goaliePartners: false }),
  ]
  for (const relation of ['against', 'either'] as const) {
    for (const filter of filters) {
      const result = paths(11, 19, relation, filter)
      assert.ok(Result.isFailure(result), `${relation} with a non-default filter`)
      assert.ok(Schema.is(UnsupportedFilter)(result.failure))
      assert.equal(result.failure.relation, relation)
    }
  }
})

test('with ignores the opponent arrays: results and filters are unchanged', () => {
  const regular = findPaths(MINI_GRAPH, 11, 14, filterWith({ competition: 'regular' }), 'with', 1)
  assert.ok(Result.isSuccess(regular))
  assert.deepEqual(regular.success.paths[0].map((hop) => [hop._tag, hop.from, hop.to]), [
    ['PlayedWith', 11, 12], ['PlayedWith', 12, 14],
  ])
  const bare = findPaths(makeGraph(TEAMMATES_ONLY), 11, 14, DEFAULT_FILTER, 'with', 1)
  assert.ok(Result.isSuccess(bare))
  assert.equal(bare.success.distance, 2)
})

test('against and either on a graph without opponent arrays are HistoryUnavailable', () => {
  const graph = makeGraph(TEAMMATES_ONLY)
  for (const relation of ['against', 'either'] as const) {
    const result = findPaths(graph, 11, 19, DEFAULT_FILTER, relation, 1)
    assert.ok(Result.isFailure(result))
    assert.ok(Schema.is(HistoryUnavailable)(result.failure))
  }
})

test('unknown players fail before the filter is considered', () => {
  const result = paths(99, 11, 'against', filterWith({ competition: 'regular' }))
  assert.ok(Result.isFailure(result))
  assert.ok(Schema.is(UnknownPlayer)(result.failure))
})

const manyPaths = (from: number, to: number, relation: Relation, limit: number): PathResult => {
  const result = findPaths(MINI_GRAPH, from, to, DEFAULT_FILTER, relation, limit)
  assert.ok(Result.isSuccess(result), `expected a ${relation} path ${from} to ${to}`)
  return result.success
}
const chainSummary = (chain: PathResult['paths'][number]) => chain.map((hop) => [hop._tag, hop.from, hop.to, hop.games])

test('against, 11 to 12: two tied chains (via 15 and via 16) in D6 order, lower ID first on equal games', () => {
  // 11v15 and 11v16 are both 2 games, so the first hop ties and 15 comes first.
  const result = manyPaths(11, 12, 'against', 2)
  assert.equal(result.distance, 2)
  assert.equal(result.pathCount, 2)
  assert.equal(result.pathCountCapped, false)
  assert.deepEqual(result.paths.map(chainSummary), [
    [['PlayedAgainst', 11, 15, 2], ['PlayedAgainst', 15, 12, 2]],
    [['PlayedAgainst', 11, 16, 2], ['PlayedAgainst', 16, 12, 3]],
  ])
  const first = manyPaths(11, 12, 'against', 1)
  assert.equal(first.pathCount, 2)
  assert.deepEqual(first.paths, [result.paths[0]])
  assert.deepEqual(manyPaths(11, 12, 'against', 5).paths, result.paths)
})

test('against: an untied path counts one chain, and a player to himself counts one empty chain', () => {
  const single = manyPaths(11, 19, 'against', 5)
  assert.equal(single.pathCount, 1)
  assert.equal(single.paths.length, 1)
  const self = manyPaths(11, 11, 'against', 5)
  assert.equal(self.pathCount, 1)
  assert.deepEqual(self.paths, [[]])
})

test('either, 13 to 15: three tied chains via 11, 14 and 16; the pair 15-16 linked both ways counts once', () => {
  const result = manyPaths(13, 15, 'either', 10)
  assert.equal(result.distance, 2)
  assert.equal(result.pathCount, 3)
  assert.equal(result.pathCountCapped, false)
  assert.deepEqual(result.paths.map((chain) => chain.map((hop) => [hop._tag, hop.to])), [
    [['PlayedWith', 11], ['PlayedAgainst', 15]],
    [['PlayedWith', 14], ['PlayedWith', 15]],
    [['PlayedAgainst', 16], ['PlayedWith', 15]],
  ])
  // The 16-15 hop is the teammate link, weighed by its two teammate games.
  assert.equal(result.paths[2][1].games, 2)
  assert.equal(manyPaths(13, 15, 'either', 2).paths.length, 2)
  assert.deepEqual(manyPaths(13, 15, 'either', 1).paths, [result.paths[0]])
})

test('link reads opposed games from the raw sorted pairs, symmetric, for every C-mini pair', () => {
  const graph = makeGraph(MINI_ARRAYS)
  for (const [a, b, games] of PAIRS) {
    for (const [x, y] of [[a, b], [b, a]] as const) {
      const result = link(graph, x, y, DEFAULT_FILTER)
      assert.ok(Result.isSuccess(result))
      assert.equal(result.success.opposedGames, games, `${x} against ${y}`)
    }
  }
  const never = link(graph, 11, 12, DEFAULT_FILTER)
  assert.ok(Result.isSuccess(never))
  assert.equal(never.success.opposedGames, 0)
  const same = link(graph, 11, 11, DEFAULT_FILTER)
  assert.ok(Result.isSuccess(same))
  assert.equal(same.success.opposedGames, 0)
})
