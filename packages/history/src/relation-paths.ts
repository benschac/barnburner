// Shortest paths over played-against links (D14, C-search): `against` walks opponent links only, `either`
// walks teammate links (both kinds, default filter) and opponent links. Same shape as `paths.ts`: a
// breadth-first sweep from the target, then a layer DP for the tied-chain count and a depth-first listing in D6
// order. A pair linked both ways is ONE edge in `either`: a teammate link. Pure, typed arrays only.
import { Result } from 'effect'
import { HistoryUnavailable, NoPath, UnsupportedFilter } from './contracts.ts'
import { linkIdBetween, linkPassingGames, opponentAdjacency } from './graph.ts'
import type { OpponentAdjacency, TeammateGraph } from './graph.ts'
import { UNREACHED, countChainsBy, enumerateBy, teammateHop } from './paths.ts'
import { DEFAULT_FILTER, PATH_COUNT_CAP } from './shapes.ts'
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

/** One step towards the target: a teammate link (`linkId >= 0`) or an opponent link (`linkId === -1`). */
type Step = { readonly other: number; readonly games: number; readonly linkId: number }

/**
 * Number of tied shortest chains, saturating at `PATH_COUNT_CAP`. A node's ways sum over its teammate
 * neighbours one step closer and, for opponent neighbours one step closer, only those with no teammate link
 * (a pair linked both ways is one edge in `either`).
 */
const countRelationChains = (
  graph: TeammateGraph, opponents: OpponentAdjacency, withTeammates: boolean, distanceToTarget: Int32Array, from: number,
): { readonly count: number; readonly capped: boolean } => {
  const cap = PATH_COUNT_CAP
  const team = graph.adjacency
  return countChainsBy(distanceToTarget, from, cap, (node, ways) => {
    const want = distanceToTarget[node] - 1
    let sum = 0
    if (withTeammates) {
      const end = team.offsets[node + 1]
      for (let at = team.offsets[node]; at < end && sum < cap; at += 1) {
        if (distanceToTarget[team.neighbours[at]] === want) sum += ways[team.neighbours[at]]
      }
    }
    const end = opponents.offsets[node + 1]
    for (let at = opponents.offsets[node]; at < end && sum < cap; at += 1) {
      const other = opponents.neighbours[at]
      if (distanceToTarget[other] !== want) continue
      if (withTeammates && linkIdBetween(graph, node, other) >= 0) continue
      sum += ways[other]
    }
    return sum
  })
}

/**
 * Up to `limit` shortest chains in D6 order: at each node the closer neighbours (both lists merged) with the
 * most games on the link first, then the lowest player ID. A pair linked both ways is a teammate link in
 * `either` and weighs its teammate games (the opponent link between them is not considered).
 */
const enumerateRelationChains = (
  graph: TeammateGraph, opponents: OpponentAdjacency, withTeammates: boolean, distanceToTarget: Int32Array,
  from: number, limit: number,
): ReadonlyArray<ReadonlyArray<Hop>> => {
  const team = graph.adjacency
  const candidates = (node: number): ReadonlyArray<Step> => {
    const want = distanceToTarget[node] - 1
    const found: Step[] = []
    if (withTeammates) {
      const end = team.offsets[node + 1]
      for (let at = team.offsets[node]; at < end; at += 1) {
        const other = team.neighbours[at]
        if (distanceToTarget[other] !== want) continue
        const linkId = team.linkIds[at]
        found.push({ other, games: linkPassingGames(graph, linkId, DEFAULT_FILTER), linkId })
      }
    }
    const end = opponents.offsets[node + 1]
    for (let at = opponents.offsets[node]; at < end; at += 1) {
      const other = opponents.neighbours[at]
      if (distanceToTarget[other] !== want) continue
      if (withTeammates && linkIdBetween(graph, node, other) >= 0) continue
      found.push({ other, games: opponents.games[at], linkId: -1 })
    }
    // Player index ascends with player ID, so the tie-break on index is the lowest ID.
    return found.sort((x, y) => y.games - x.games || x.other - y.other)
  }
  return enumerateBy<Step, Hop>(
    distanceToTarget, from, limit, candidates, (step) => step.other,
    (step, source, to) =>
      step.linkId >= 0
        ? teammateHop(graph, step.linkId, source, to, DEFAULT_FILTER)
        : opponentHop(graph, source, to, step.games),
  )
}

/**
 * Shortest paths for `relation: 'against'` or `'either'` between player indexes. Only the default filter
 * is supported (D14: opponent links carry no season detail), anything else is `UnsupportedFilter`; a graph
 * without opponent arrays is `HistoryUnavailable`. Like Q3's `with` search it returns up to `limit` tied
 * shortest chains in D6 order and `pathCount`, the number of tied chains saturating at `PATH_COUNT_CAP`.
 */
export const findRelationPaths = (
  graph: TeammateGraph, fromIndex: number, toIndex: number, filter: Filter, relation: Exclude<Relation, 'with'>,
  limit: number,
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
  const { count, capped } = countRelationChains(graph, opponents, withTeammates, distanceToTarget, fromIndex)
  const paths = enumerateRelationChains(graph, opponents, withTeammates, distanceToTarget, fromIndex, Math.max(limit, 1))
  return Result.succeed({ distance, pathCount: count, pathCountCapped: capped, paths })
}
