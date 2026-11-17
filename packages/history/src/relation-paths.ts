// Shortest paths over played-against links (D14, C-search): `against` walks opponent links only, `either`
// walks teammate links (both kinds, default filter) and opponent links. Same shape as `paths.ts`: a
// breadth-first sweep from the target, then a greedy walk from the start in D6 order. Pure, typed arrays only.
import { Result } from 'effect'
import { HistoryUnavailable, NoPath, UnsupportedFilter } from './contracts.ts'
import { linkIdBetween, linkPassingGames, opponentAdjacency } from './graph.ts'
import type { OpponentAdjacency, TeammateGraph } from './graph.ts'
import { UNREACHED, teammateHop } from './paths.ts'
import { DEFAULT_FILTER } from './shapes.ts'
import type { Filter, Hop, PathResult, PlayedAgainst, Relation } from './shapes.ts'

const isDefaultFilter = (filter: Filter): boolean =>
  filter.competition === DEFAULT_FILTER.competition &&
  filter.fromSeason === DEFAULT_FILTER.fromSeason &&
  filter.toSeason === DEFAULT_FILTER.toSeason &&
  filter.goaliePartners === DEFAULT_FILTER.goaliePartners

/**
 * Breadth-first distances from `source` over opponent links, plus teammate links when `withTeammates`.
 * Same contract as `bfsDistances`: with `stopAt >= 0` every node closer than `stopAt` has its exact distance.
 */
const relationDistances = (
  graph: TeammateGraph, opponents: OpponentAdjacency, withTeammates: boolean, source: number, stopAt: number,
): Int32Array => {
  const n = graph.arrays.playerIds.length
  const distance = new Int32Array(n).fill(UNREACHED)
  const queue = new Int32Array(n)
  let head = 0
  let tail = 0
  distance[source] = 0
  queue[tail] = source
  tail += 1
  if (source === stopAt) return distance
  while (head < tail) {
    const node = queue[head]
    head += 1
    const next = distance[node] + 1
    if (withTeammates) {
      const { offsets, neighbours } = graph.adjacency
      const end = offsets[node + 1]
      for (let at = offsets[node]; at < end; at += 1) {
        const other = neighbours[at]
        if (distance[other] !== UNREACHED) continue
        distance[other] = next
        if (other === stopAt) return distance
        queue[tail] = other
        tail += 1
      }
    }
    const end = opponents.offsets[node + 1]
    for (let at = opponents.offsets[node]; at < end; at += 1) {
      const other = opponents.neighbours[at]
      if (distance[other] !== UNREACHED) continue
      distance[other] = next
      if (other === stopAt) return distance
      queue[tail] = other
      tail += 1
    }
  }
  return distance
}

const opponentHop = (graph: TeammateGraph, from: number, to: number, games: number): PlayedAgainst => ({
  _tag: 'PlayedAgainst',
  from: graph.arrays.playerIds[from],
  to: graph.arrays.playerIds[to],
  games,
})

/**
 * The first shortest chain from `from` in D6 order: at each node the closer neighbour with the most games
 * on the link, then the lowest player ID. A pair linked both ways is a teammate link in `either` and
 * weighs its teammate games (the opponent link between them is not considered). Requires
 * `distanceToTarget[from] >= 0`, which guarantees a closer neighbour at every node above distance 0.
 */
const walkRelationPath = (
  graph: TeammateGraph, opponents: OpponentAdjacency, withTeammates: boolean, distanceToTarget: Int32Array, from: number,
): ReadonlyArray<Hop> => {
  const hops: Hop[] = []
  let node = from
  while (distanceToTarget[node] > 0) {
    const want = distanceToTarget[node] - 1
    let bestOther = -1
    let bestGames = 0
    let bestLinkId = -1
    if (withTeammates) {
      const { offsets, neighbours, linkIds } = graph.adjacency
      const end = offsets[node + 1]
      for (let at = offsets[node]; at < end; at += 1) {
        const other = neighbours[at]
        if (distanceToTarget[other] !== want) continue
        const games = linkPassingGames(graph, linkIds[at], DEFAULT_FILTER)
        if (games > bestGames || (games === bestGames && other < bestOther)) {
          bestOther = other
          bestGames = games
          bestLinkId = linkIds[at]
        }
      }
    }
    const end = opponents.offsets[node + 1]
    for (let at = opponents.offsets[node]; at < end; at += 1) {
      const other = opponents.neighbours[at]
      if (distanceToTarget[other] !== want) continue
      if (withTeammates && linkIdBetween(graph, node, other) >= 0) continue
      const games = opponents.games[at]
      if (games > bestGames || (games === bestGames && other < bestOther)) {
        bestOther = other
        bestGames = games
        bestLinkId = -1
      }
    }
    if (bestOther < 0) break
    hops.push(
      bestLinkId >= 0
        ? teammateHop(graph, bestLinkId, node, bestOther, DEFAULT_FILTER)
        : opponentHop(graph, node, bestOther, bestGames),
    )
    node = bestOther
  }
  return hops
}

/**
 * Shortest paths for `relation: 'against'` or `'either'` between player indexes. Only the default filter
 * is supported (D14: opponent links carry no season detail), anything else is `UnsupportedFilter`; a graph
 * without opponent arrays is `HistoryUnavailable`. Like Q2's `with` search this returns the first chain
 * only, with `pathCount` 1, whatever the requested limit.
 */
export const findRelationPaths = (
  graph: TeammateGraph, fromIndex: number, toIndex: number, filter: Filter, relation: Exclude<Relation, 'with'>,
): Result.Result<PathResult, UnsupportedFilter | HistoryUnavailable | NoPath> => {
  if (!isDefaultFilter(filter)) return Result.fail(new UnsupportedFilter({ relation }))
  const opponents = opponentAdjacency(graph)
  if (opponents === undefined) {
    return Result.fail(new HistoryUnavailable({ message: 'This history file has no opponent data.' }))
  }
  const withTeammates = relation === 'either'
  const distanceToTarget = relationDistances(graph, opponents, withTeammates, toIndex, fromIndex)
  const distance = distanceToTarget[fromIndex]
  if (distance === UNREACHED) {
    const { playerIds } = graph.arrays
    return Result.fail(new NoPath({ from: playerIds[fromIndex], to: playerIds[toIndex] }))
  }
  const path = walkRelationPath(graph, opponents, withTeammates, distanceToTarget, fromIndex)
  return Result.succeed({ distance, pathCount: 1, pathCountCapped: false, paths: [path] })
}
