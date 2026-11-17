// Shortest teammate paths in D6 order (C-search). Pure, no I/O. The hot loop works on typed arrays only.
import { Result } from 'effect'
import { NoPath, UnknownPlayer } from './contracts.ts'
import { evidenceSpan, hopKind, linkPassingGames, linkPasses } from './graph.ts'
import type { TeammateGraph } from './graph.ts'
import type { Filter, GameType, PathResult, Relation, TeammateHop } from './shapes.ts'

/** Distance value for a node the search did not reach. */
export const UNREACHED = -1

/**
 * Breadth-first distances from player index `source` over links that pass the filter (D7).
 * Returns an `Int32Array` of length `n`: the hop count to every reached player, `UNREACHED` otherwise.
 * With `stopAt >= 0` the search ends once that index is reached; every node closer than `stopAt` still
 * has its exact distance (all of the previous level is assigned before `stopAt` is found), which is all
 * `walkFirstPath` needs. Pass `-1` for a full sweep (farthest, path counts). Allocates two typed arrays.
 */
export const bfsDistances = (graph: TeammateGraph, source: number, filter: Filter, stopAt: number): Int32Array => {
  const { offsets, neighbours, linkIds } = graph.adjacency
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
    const end = offsets[node + 1]
    for (let at = offsets[node]; at < end; at += 1) {
      const other = neighbours[at]
      if (distance[other] !== UNREACHED) continue
      if (!linkPasses(graph, linkIds[at], filter)) continue
      distance[other] = next
      if (other === stopAt) return distance
      queue[tail] = other
      tail += 1
    }
  }
  return distance
}

/**
 * The D6 choice among the neighbours of `node` that are one step closer (`distanceToTarget[node] - 1`):
 * the most passing games together, then the lowest player ID. Neighbours ascend by index, which is
 * ascending by player ID, so a strict `>` keeps the lowest ID on a tie. Returns the position in the
 * adjacency arrays, or -1 when there is no closer passing neighbour.
 */
export const firstStepAt = (graph: TeammateGraph, distanceToTarget: Int32Array, node: number, filter: Filter): number => {
  const { offsets, neighbours, linkIds } = graph.adjacency
  const want = distanceToTarget[node] - 1
  const end = offsets[node + 1]
  let best = -1
  let bestGames = 0
  for (let at = offsets[node]; at < end; at += 1) {
    if (distanceToTarget[neighbours[at]] !== want) continue
    const games = linkPassingGames(graph, linkIds[at], filter)
    if (games > bestGames) {
      best = at
      bestGames = games
    }
  }
  return best
}

/** One teammate hop between player indexes over a passing link, as player IDs with its evidence span. */
export const teammateHop = (graph: TeammateGraph, linkId: number, from: number, to: number, filter: Filter): TeammateHop => {
  const { playerIds, seasonIds, teamIds, spanSeason, spanTeam, spanKind, spanFirstGame } = graph.arrays
  const span = evidenceSpan(graph, linkId, filter)
  const gameType: GameType = spanKind[span] === 3 ? 3 : 2
  const hop = {
    from: playerIds[from],
    to: playerIds[to],
    games: linkPassingGames(graph, linkId, filter),
    teamId: teamIds[spanTeam[span]],
    seasonId: seasonIds[spanSeason[span]],
    gameType,
    gameId: spanFirstGame[span],
  }
  return hopKind(graph, linkId, filter) === 'GoaliePartners'
    ? { _tag: 'GoaliePartners', ...hop }
    : { _tag: 'PlayedWith', ...hop }
}

/**
 * The first shortest chain from index `from` in D6 order, given distances to the target. Comparing two
 * shortest chains hop by hop from the start in D6 order means the greedy walk yields the first one.
 * Requires `distanceToTarget[from] >= 0`; a node with a finite distance always has a closer passing
 * neighbour, so the walk stops only at distance 0.
 */
export const walkFirstPath = (
  graph: TeammateGraph, distanceToTarget: Int32Array, from: number, filter: Filter,
): ReadonlyArray<TeammateHop> => {
  const { neighbours, linkIds } = graph.adjacency
  const hops: TeammateHop[] = []
  let node = from
  while (distanceToTarget[node] > 0) {
    const at = firstStepAt(graph, distanceToTarget, node, filter)
    if (at < 0) break
    hops.push(teammateHop(graph, linkIds[at], node, neighbours[at], filter))
    node = neighbours[at]
  }
  return hops
}

/**
 * Shortest teammate paths from `from` to `to` (player IDs) in D6 order.
 * Only `relation: 'with'` and `limit: 1` are real so far. Q3 adds further chains and the tie count
 * (`pathCount` is 1 until then); Q7 adds `against` and `either`.
 */
export const findPaths = (
  graph: TeammateGraph, from: number, to: number, filter: Filter, relation: Relation, _limit: number,
): Result.Result<PathResult, UnknownPlayer | NoPath> => {
  const fromIndex = graph.indexOf.get(from)
  if (fromIndex === undefined) return Result.fail(new UnknownPlayer({ playerId: from }))
  const toIndex = graph.indexOf.get(to)
  if (toIndex === undefined) return Result.fail(new UnknownPlayer({ playerId: to }))
  // TODO(Q7): `against` and `either`. Placeholder until then: report no path rather than a wrong teammate path.
  if (relation !== 'with') return Result.fail(new NoPath({ from, to }))
  // TODO(Q3): `limit` above 1 returns more chains, and `pathCount` becomes the real tie count.
  const distanceToTarget = bfsDistances(graph, toIndex, filter, fromIndex)
  const distance = distanceToTarget[fromIndex]
  if (distance === UNREACHED) return Result.fail(new NoPath({ from, to }))
  const path = walkFirstPath(graph, distanceToTarget, fromIndex, filter)
  return Result.succeed({ distance, pathCount: 1, pathCountCapped: false, paths: [path] })
}
