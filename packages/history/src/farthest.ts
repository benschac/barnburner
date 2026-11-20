// Farthest player from a start (C-search). Pure, no I/O; one sweep over typed arrays plus one early-exit BFS.

import { Result } from "effect";

import { UnknownPlayer } from "./contracts.ts";
import type { TeammateGraph } from "./graph.ts";
import { UNREACHED, bfsDistances, walkFirstPath } from "./paths.ts";
import type { FarthestResult, Filter } from "./shapes.ts";

/**
 * The player farthest from `from` (a player ID) over teammate links that pass the filter.
 * `distance` is the largest finite shortest distance and `atDistance` counts the players at it.
 * `reachable` and `unreachable` exclude the start. A player who reaches nobody gets distance 0,
 * `atDistance` 0 and an empty example.
 * The example runs from `from` to the lowest-ID player at the largest distance (indexes ascend by ID),
 * as the first shortest chain in D6 order. That needs distances to the target, so a second BFS runs
 * from the target and stops once it reaches `from`.
 */
export const farthest = (
  graph: TeammateGraph,
  from: number,
  filter: Filter
): Result.Result<FarthestResult, UnknownPlayer> => {
  const fromIndex = graph.indexOf.get(from);
  if (fromIndex === undefined)
    return Result.fail(new UnknownPlayer({ playerId: from }));
  const distances = bfsDistances(graph, fromIndex, filter, -1);
  const n = distances.length;
  let max = 0;
  let atDistance = 0;
  let target = -1;
  let reachable = 0;
  for (let at = 0; at < n; at += 1) {
    const d = distances[at];
    if (d === UNREACHED || at === fromIndex) continue;
    reachable += 1;
    if (d > max) {
      max = d;
      atDistance = 1;
      target = at;
    } else if (d === max) {
      atDistance += 1;
    }
  }
  const unreachable = n - 1 - reachable;
  if (target < 0)
    return Result.succeed({
      distance: 0,
      atDistance: 0,
      reachable,
      unreachable,
      example: [],
    });
  const toTarget = bfsDistances(graph, target, filter, fromIndex);
  const example = walkFirstPath(graph, toTarget, fromIndex, filter);
  return Result.succeed({
    distance: max,
    atDistance,
    reachable,
    unreachable,
    example,
  });
};
