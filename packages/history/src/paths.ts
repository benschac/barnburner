// Shortest teammate paths in D6 order (C-search). Pure, no I/O. The hot loop works on typed arrays only.

import { Array, Order, Result } from "effect";

import type { HistoryUnavailable, UnsupportedFilter } from "./contracts.ts";
import { NoPath, UnknownPlayer } from "./contracts.ts";
import {
  evidenceSpan,
  hopKind,
  linkPassingGames,
  linkPasses,
} from "./graph.ts";
import type { TeammateGraph } from "./graph.ts";
import { findRelationPaths } from "./relation-paths.ts";
import { GoaliePartners, PATH_COUNT_CAP, PlayedWith } from "./shapes.ts";
import type {
  Filter,
  GameType,
  PathResult,
  Relation,
  TeammateHop,
} from "./shapes.ts";

/** Distance value for a node the search did not reach. */
export const UNREACHED = -1;

/**
 * Breadth-first distances from player index `source` over links that pass the filter (D7).
 * Returns an `Int32Array` of length `n`: the hop count to every reached player, `UNREACHED` otherwise.
 * With `stopAt >= 0` the search ends once that index is reached; every node closer than `stopAt` still
 * has its exact distance (all of the previous level is assigned before `stopAt` is found), which is all
 * `walkFirstPath` needs. Pass `-1` for a full sweep (farthest, path counts). Allocates two typed arrays.
 */
export const bfsDistances = (
  graph: TeammateGraph,
  source: number,
  filter: Filter,
  stopAt: number
): Int32Array => {
  const { offsets, neighbours, linkIds } = graph.adjacency;
  const n = graph.arrays.playerIds.length;
  const distance = new Int32Array(n).fill(UNREACHED);
  const queue = new Int32Array(n);
  let head = 0;
  let tail = 0;
  distance[source] = 0;
  queue[tail] = source;
  tail += 1;
  if (source === stopAt) return distance;
  while (head < tail) {
    const node = queue[head];
    head += 1;
    const next = distance[node] + 1;
    const end = offsets[node + 1];
    for (let at = offsets[node]; at < end; at += 1) {
      const other = neighbours[at];
      if (distance[other] !== UNREACHED) continue;
      if (!linkPasses(graph, linkIds[at], filter)) continue;
      distance[other] = next;
      if (other === stopAt) return distance;
      queue[tail] = other;
      tail += 1;
    }
  }
  return distance;
};

/**
 * The D6 choice among the neighbours of `node` that are one step closer (`distanceToTarget[node] - 1`):
 * the most passing games together, then the lowest player ID. Neighbours ascend by index, which is
 * ascending by player ID, so a strict `>` keeps the lowest ID on a tie. Returns the position in the
 * adjacency arrays, or -1 when there is no closer passing neighbour.
 */
export const firstStepAt = (
  graph: TeammateGraph,
  distanceToTarget: Int32Array,
  node: number,
  filter: Filter
): number => {
  const { offsets, neighbours, linkIds } = graph.adjacency;
  const want = distanceToTarget[node] - 1;
  const end = offsets[node + 1];
  let best = -1;
  let bestGames = 0;
  for (let at = offsets[node]; at < end; at += 1) {
    if (distanceToTarget[neighbours[at]] !== want) continue;
    const games = linkPassingGames(graph, linkIds[at], filter);
    if (games > bestGames) {
      best = at;
      bestGames = games;
    }
  }
  return best;
};

/** One teammate hop between player indexes over a passing link, as player IDs with its evidence span. */
export const teammateHop = (
  graph: TeammateGraph,
  linkId: number,
  from: number,
  to: number,
  filter: Filter
): TeammateHop => {
  const {
    playerIds,
    seasonIds,
    teamIds,
    spanSeason,
    spanTeam,
    spanKind,
    spanFirstGame,
  } = graph.arrays;
  const span = evidenceSpan(graph, linkId, filter);
  const gameType: GameType = spanKind[span] === 3 ? 3 : 2;
  const hop = {
    from: playerIds[from],
    to: playerIds[to],
    games: linkPassingGames(graph, linkId, filter),
    teamId: teamIds[spanTeam[span]],
    seasonId: seasonIds[spanSeason[span]],
    gameType,
    gameId: spanFirstGame[span],
  };
  return hopKind(graph, linkId, filter) === "GoaliePartners"
    ? GoaliePartners.make(hop)
    : PlayedWith.make(hop);
};

/**
 * The first shortest chain from index `from` in D6 order, given distances to the target. Comparing two
 * shortest chains hop by hop from the start in D6 order means the greedy walk yields the first one.
 * Requires `distanceToTarget[from] >= 0`; a node with a finite distance always has a closer passing
 * neighbour, so the walk stops only at distance 0.
 */
export const walkFirstPath = (
  graph: TeammateGraph,
  distanceToTarget: Int32Array,
  from: number,
  filter: Filter
): ReadonlyArray<TeammateHop> => {
  const { neighbours, linkIds } = graph.adjacency;
  const hops: TeammateHop[] = [];
  let node = from;
  while (distanceToTarget[node] > 0) {
    const at = firstStepAt(graph, distanceToTarget, node, filter);
    if (at < 0) {
      // defect: a node with a finite distance always has a closer passing neighbour
      throw new Error(
        "walkFirstPath: no closer neighbour at a finite distance"
      );
    }
    hops.push(teammateHop(graph, linkIds[at], node, neighbours[at], filter));
    node = neighbours[at];
  }
  return hops;
};

/**
 * Number of distinct shortest chains from index `from` to the target, saturating at `cap`.
 * `distanceToTarget` comes from a breadth-first sweep from the target: every node closer than `from` has
 * its exact distance. Forward DP from `from` over the edges that lower the distance by one, in breadth-first
 * order (so every predecessor of a node is summed before the node is expanded): `ways[node]` is the number of
 * chains from `from` to it, `ways[from] = 1`. Only nodes on a shortest chain from `from` are touched; players
 * closer to the target that no such chain passes through cost nothing. `forEachCloser(node, visit)` calls
 * `visit(other)` once per neighbour of `node` that is one step closer over a passing edge. Each sum is clamped
 * to `cap`, which is exact for "reached the cap" because clamping is monotone and every node on this DAG
 * leads to the target. `capped` means the true count is `>= cap` (exactly `cap` counts as capped).
 * Requires `distanceToTarget[from] >= 0`.
 */
export const countChainsBy = (
  distanceToTarget: Int32Array,
  from: number,
  cap: number,
  forEachCloser: (node: number, visit: (other: number) => void) => void
): { readonly count: number; readonly capped: boolean } => {
  if (distanceToTarget[from] === 0)
    return { count: Math.min(1, cap), capped: 1 >= cap };
  const ways = new Float64Array(distanceToTarget.length);
  const queue: number[] = [from];
  ways[from] = 1;
  let current = from;
  const visit = (other: number): void => {
    if (ways[other] === 0) queue.push(other);
    ways[other] = Math.min(ways[other] + ways[current], cap);
  };
  let count = 0;
  for (let head = 0; head < queue.length; head += 1) {
    current = queue[head];
    if (distanceToTarget[current] === 0) {
      count = ways[current];
      break;
    }
    forEachCloser(current, visit);
  }
  count = Math.min(count, cap);
  return { count, capped: count >= cap };
};

/** `countChainsBy` over the teammate links that pass the filter. */
export const countShortestChains = (
  graph: TeammateGraph,
  distanceToTarget: Int32Array,
  from: number,
  filter: Filter,
  cap: number
): { readonly count: number; readonly capped: boolean } => {
  const { offsets, neighbours, linkIds } = graph.adjacency;
  return countChainsBy(distanceToTarget, from, cap, (node, visit) => {
    const want = distanceToTarget[node] - 1;
    const end = offsets[node + 1];
    for (let at = offsets[node]; at < end; at += 1) {
      if (distanceToTarget[neighbours[at]] !== want) continue;
      if (!linkPasses(graph, linkIds[at], filter)) continue;
      visit(neighbours[at]);
    }
  });
};

/**
 * Up to `limit` distinct shortest chains from `from`, lazily, in D6 order: a depth-first walk down the
 * distance layers that tries each node's `candidates(node)` in the order given (D6: most games first, then
 * lowest ID; only neighbours one step closer). Every closer neighbour leads to the target, so there are no
 * dead ends and the work is proportional to `limit * distance` plus building the candidate lists it visits.
 * `target(step)` is the node a step leads to; `hop(step, from, to)` builds its hop.
 */
export const enumerateBy = <Step, H>(
  distanceToTarget: Int32Array,
  from: number,
  limit: number,
  candidates: (node: number) => ReadonlyArray<Step>,
  target: (step: Step) => number,
  hop: (step: Step, from: number, to: number) => H
): ReadonlyArray<ReadonlyArray<H>> => {
  const total = distanceToTarget[from];
  const chains: ReadonlyArray<H>[] = [];
  if (limit < 1) return chains;
  if (total === 0) return [[]];
  const nodes = new Int32Array(total + 1);
  const cursor = new Int32Array(total + 1);
  const chosen: Step[] = [];
  const frames: ReadonlyArray<Step>[] = [candidates(from)];
  nodes[0] = from;
  let depth = 0;
  while (depth >= 0 && chains.length < limit) {
    const options = frames[depth];
    if (cursor[depth] >= options.length) {
      frames.pop();
      cursor[depth] = 0;
      depth -= 1;
      continue;
    }
    const step = options[cursor[depth]];
    cursor[depth] += 1;
    chosen[depth] = step;
    nodes[depth + 1] = target(step);
    if (depth + 1 === total) {
      const hops: H[] = [];
      for (let at = 0; at < total; at += 1)
        hops.push(hop(chosen[at], nodes[at], nodes[at + 1]));
      chains.push(hops);
    } else {
      depth += 1;
      cursor[depth] = 0;
      frames.push(candidates(nodes[depth]));
    }
  }
  return chains;
};

/** `enumerateBy` over the teammate links that pass the filter; steps are adjacency positions. */
export const enumerateChains = (
  graph: TeammateGraph,
  distanceToTarget: Int32Array,
  from: number,
  filter: Filter,
  limit: number
): ReadonlyArray<ReadonlyArray<TeammateHop>> => {
  const { offsets, neighbours, linkIds } = graph.adjacency;
  // Adjacency positions of the closer passing neighbours of `node`, in D6 order.
  const candidates = (node: number): ReadonlyArray<number> => {
    const want = distanceToTarget[node] - 1;
    const end = offsets[node + 1];
    type Found = { readonly at: number; readonly games: number };
    const found: Found[] = [];
    for (let at = offsets[node]; at < end; at += 1) {
      if (distanceToTarget[neighbours[at]] !== want) continue;
      const games = linkPassingGames(graph, linkIds[at], filter);
      if (games > 0) found.push({ at, games });
    }
    // Neighbour indexes ascend with player ID, so the tie-break on index is the lowest ID.
    return Array.sortBy(
      Order.mapInput(Order.flip(Order.Number), (entry: Found) => entry.games),
      Order.mapInput(Order.Number, (entry: Found) => neighbours[entry.at])
    )(found).map((entry) => entry.at);
  };
  return enumerateBy(
    distanceToTarget,
    from,
    limit,
    candidates,
    (at) => neighbours[at],
    (at, source, to) => teammateHop(graph, linkIds[at], source, to, filter)
  );
};

/**
 * Shortest teammate paths from `from` to `to` (player IDs) in D6 order.
 * `relation: 'with'` returns up to `limit` distinct shortest chains in D6 order (the first is Q2's) and
 * `pathCount`, the number of tied shortest chains, saturating at `PATH_COUNT_CAP` (`pathCountCapped` when
 * the true count is `>=` the cap). `against` and `either` go to `findRelationPaths`, which counts and lists tied chains the same way.
 */
export const findPaths = (
  graph: TeammateGraph,
  from: number,
  to: number,
  filter: Filter,
  relation: Relation,
  limit: number
): Result.Result<
  PathResult,
  UnknownPlayer | NoPath | UnsupportedFilter | HistoryUnavailable
> => {
  const fromIndex = graph.indexOf.get(from);
  if (fromIndex === undefined)
    return Result.fail(new UnknownPlayer({ playerId: from }));
  const toIndex = graph.indexOf.get(to);
  if (toIndex === undefined)
    return Result.fail(new UnknownPlayer({ playerId: to }));
  if (relation !== "with")
    return findRelationPaths(
      graph,
      fromIndex,
      toIndex,
      filter,
      relation,
      limit
    );
  const distanceToTarget = bfsDistances(graph, toIndex, filter, fromIndex);
  const distance = distanceToTarget[fromIndex];
  if (distance === UNREACHED) return Result.fail(new NoPath({ from, to }));
  const { count, capped } = countShortestChains(
    graph,
    distanceToTarget,
    fromIndex,
    filter,
    PATH_COUNT_CAP
  );
  const paths =
    limit <= 1
      ? [walkFirstPath(graph, distanceToTarget, fromIndex, filter)]
      : enumerateChains(graph, distanceToTarget, fromIndex, filter, limit);
  return Result.succeed({
    distance,
    pathCount: count,
    pathCountCapped: capped,
    paths,
  });
};
