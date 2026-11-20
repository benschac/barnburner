// Search primitives shared by `paths.ts` (teammate links) and `relation-paths.ts` (played-against links).
// Pure, no I/O; typed arrays only.

import { evidenceSpan, hopKind, linkPassingGames } from "./graph.ts";
import type { TeammateGraph } from "./graph.ts";
import { GoaliePartners, PlayedWith } from "./shapes.ts";
import type { Filter, GameType, TeammateHop } from "./shapes.ts";

/** Distance value for a node the search did not reach. */
export const UNREACHED = -1;

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
/** The number of shortest chains, clamped to the cap; `capped` when the true count is at least the cap. */
export type ChainCount = {
  readonly count: number;
  readonly capped: boolean;
};

export const countChainsBy = (
  distanceToTarget: Int32Array,
  from: number,
  cap: number,
  forEachCloser: (node: number, visit: (other: number) => void) => void
): ChainCount => {
  if (distanceToTarget[from] === 0)
    return { count: Math.min(1, cap), capped: cap <= 1 };
  const ways = new Float64Array(distanceToTarget.length);
  const queue: number[] = [from];
  ways[from] = 1;
  let current = from;
  const visit = (other: number): void => {
    if (ways[other] === 0) queue.push(other);
    ways[other] = Math.min(ways[other] + ways[current], cap);
  };
  let count = 0;
  for (const node of queue) {
    current = node;
    if (distanceToTarget[current] === 0) {
      count = ways[current];
      break;
    }
    forEachCloser(current, visit);
  }
  count = Math.min(count, cap);
  return { count, capped: count >= cap };
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
  candidates: (node: number) => readonly Step[],
  target: (step: Step) => number,
  hop: (step: Step, from: number, to: number) => H
): readonly (readonly H[])[] => {
  const total = distanceToTarget[from];
  const chains: (readonly H[])[] = [];
  if (limit < 1) return chains;
  if (total === 0) return [[]];
  const nodes = new Int32Array(total + 1);
  const cursor = new Int32Array(total + 1);
  const chosen: Step[] = [];
  const frames: (readonly Step[])[] = [candidates(from)];
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
