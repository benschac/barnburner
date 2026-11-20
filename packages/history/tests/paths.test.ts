import assert from "node:assert/strict";
import { test } from "node:test";

import { Array, Order, Result, Schema } from "effect";

import { UNREACHED, countChainsBy } from "../src/chain-search.ts";
import { NoPath, UnknownPlayer } from "../src/contracts.ts";
import { makeGraph } from "../src/graph.ts";
import { bfsDistances, countShortestChains, findPaths } from "../src/paths.ts";
import { findRelationPaths } from "../src/relation-paths.ts";
import { DEFAULT_FILTER, PATH_COUNT_CAP } from "../src/shapes.ts";
import type { Filter, GraphArrays, PathResult } from "../src/shapes.ts";
import { MINI_GRAPH } from "./fakes.ts";

const filterWith = (changes: Partial<Filter>): Filter => ({
  ...DEFAULT_FILTER,
  ...changes,
});
const S2 = 19511952;

const find = (from: number, to: number, filter: Filter = DEFAULT_FILTER) =>
  findPaths(MINI_GRAPH, from, to, filter, "with", 1);

const expectPath = (
  from: number,
  to: number,
  filter: Filter = DEFAULT_FILTER
): PathResult => {
  const result = find(from, to, filter);
  assert.ok(Result.isSuccess(result), `expected a path ${from} to ${to}`);
  return result.success;
};
const expectFailure = (
  from: number,
  to: number,
  filter: Filter = DEFAULT_FILTER
) => {
  const result = find(from, to, filter);
  assert.ok(Result.isFailure(result), `expected a failure ${from} to ${to}`);
  return result.failure;
};
const ids = (result: PathResult): readonly number[] => {
  const hops = result.paths[0];
  return [hops[0].from, ...hops.map((hop) => hop.to)];
};

test("11 to 14: 2 games beats 1, so the first chain goes through 12", () => {
  const result = expectPath(11, 14);
  assert.equal(result.distance, 2);
  assert.deepEqual(ids(result), [11, 12, 14]);
  assert.equal(result.pathCount, 2);
  assert.equal(result.pathCountCapped, false);
  assert.equal(result.paths.length, 1);
});

test("hops carry the link total and the evidence span", () => {
  const [first, second] = expectPath(11, 14).paths[0];
  assert.deepEqual(first, {
    _tag: "PlayedWith",
    from: 11,
    to: 12,
    games: 2,
    teamId: 1,
    seasonId: 19501951,
    gameType: 2,
    gameId: 1950020001,
  });
  assert.deepEqual(second, {
    _tag: "PlayedWith",
    from: 12,
    to: 14,
    games: 2,
    teamId: 2,
    seasonId: S2,
    gameType: 2,
    gameId: 1951020001,
  });
});

test("11 to 16: distance 4, first chain 11-12-14-15-16, playoff evidence on 14-15", () => {
  const result = expectPath(11, 16);
  assert.equal(result.distance, 4);
  assert.deepEqual(ids(result), [11, 12, 14, 15, 16]);
  assert.deepEqual(result.paths[0][2], {
    _tag: "PlayedWith",
    from: 14,
    to: 15,
    games: 2,
    teamId: 2,
    seasonId: S2,
    gameType: 3,
    gameId: 1951030111,
  });
});

test("11 to 18: distance 6 through the goalie-partner hop 16-17 with game E", () => {
  const result = expectPath(11, 18);
  assert.equal(result.distance, 6);
  assert.deepEqual(ids(result), [11, 12, 14, 15, 16, 17, 18]);
  assert.deepEqual(result.paths[0][4], {
    _tag: "GoaliePartners",
    from: 16,
    to: 17,
    games: 3,
    teamId: 3,
    seasonId: S2,
    gameType: 2,
    gameId: 1951020001,
  });
  assert.equal(result.paths[0][5]._tag, "PlayedWith");
});

test("11 to 18 with goalie partners off has no path", () => {
  const failure = expectFailure(11, 18, filterWith({ goaliePartners: false }));
  assert.ok(Schema.is(NoPath)(failure));
  assert.equal(failure.from, 11);
  assert.equal(failure.to, 18);
});

test("11 to 19 has no path; an unknown player is a different failure", () => {
  assert.ok(Schema.is(NoPath)(expectFailure(11, 19)));
  const unknownFrom = expectFailure(99, 11);
  assert.ok(Schema.is(UnknownPlayer)(unknownFrom));
  assert.equal(unknownFrom.playerId, 99);
  const unknownTo = expectFailure(11, 98);
  assert.ok(Schema.is(UnknownPlayer)(unknownTo));
  assert.equal(unknownTo.playerId, 98);
});

test("11 to 15 in the regular season only has no path", () => {
  assert.ok(
    Schema.is(NoPath)(
      expectFailure(11, 15, filterWith({ competition: "regular" }))
    )
  );
});

test("12 to 13 in 1951-52 only: distance 2 through 14; 11 to 14 has no path", () => {
  const filter = filterWith({ fromSeason: S2, toSeason: S2 });
  const result = expectPath(12, 13, filter);
  assert.equal(result.distance, 2);
  assert.deepEqual(ids(result), [12, 14, 13]);
  assert.ok(
    result.paths[0].every(
      (hop) => hop._tag !== "PlayedAgainst" && hop.seasonId === S2
    )
  );
  assert.ok(Schema.is(NoPath)(expectFailure(11, 14, filter)));
});

test("the same player is distance 0 with one empty path", () => {
  const result = expectPath(11, 11);
  assert.equal(result.distance, 0);
  assert.equal(result.pathCount, 1);
  assert.deepEqual(result.paths, [[]]);
});

test("bfsDistances: a full sweep from 11 leaves 19 and 20 unreached", () => {
  const index = (id: number) => MINI_GRAPH.indexOf.get(id) ?? -1;
  const distance = bfsDistances(MINI_GRAPH, index(11), DEFAULT_FILTER, -1);
  const byId = [11, 12, 13, 14, 15, 16, 17, 18, 19, 20].map(
    (id) => distance[index(id)]
  );
  assert.deepEqual(byId, [0, 1, 1, 2, 3, 4, 5, 6, UNREACHED, UNREACHED]);
});

const chainIds = (path: PathResult["paths"][number]): readonly number[] =>
  path.length === 0 ? [] : [path[0].from, ...path.map((hop) => hop.to)];
const findLimit = (from: number, to: number, limit: number): PathResult => {
  const result = findPaths(MINI_GRAPH, from, to, DEFAULT_FILTER, "with", limit);
  assert.ok(Result.isSuccess(result));
  return result.success;
};

test("11 to 14: two tied chains in D6 order for limit 2 and limit 10", () => {
  for (const limit of [2, 10]) {
    const result = findLimit(11, 14, limit);
    assert.equal(result.distance, 2);
    assert.equal(result.pathCount, 2);
    assert.equal(result.pathCountCapped, false);
    assert.deepEqual(result.paths.map(chainIds), [
      [11, 12, 14],
      [11, 13, 14],
    ]);
  }
});

test("11 to 16: distance 4, two tied chains, 12 first then 13", () => {
  const result = findLimit(11, 16, 10);
  assert.equal(result.distance, 4);
  assert.equal(result.pathCount, 2);
  assert.deepEqual(result.paths.map(chainIds), [
    [11, 12, 14, 15, 16],
    [11, 13, 14, 15, 16],
  ]);
});

test("limit 1 is the first chain only but still reports the tie count", () => {
  const one = findLimit(11, 14, 1);
  assert.deepEqual(one.paths, findLimit(11, 14, 10).paths.slice(0, 1));
  assert.equal(one.pathCount, 2);
  assert.equal(one.paths.length, 1);
});

test("same player: limit 10 still returns the one empty chain", () => {
  const result = findLimit(11, 11, 10);
  assert.deepEqual(result.paths, [[]]);
  assert.equal(result.pathCount, 1);
});

// A start (index 0), 7 layers of 8 players, and a target, fully connected layer to layer:
// 8^7 = 2,097,152 shortest chains. Every link is one 1-game span, so ties break by player ID (100 + index).
const WIDTH = 8;
const LAYERS = 7;
const CHAINS = WIDTH ** LAYERS;
const layered = () => {
  const n = 2 + WIDTH * LAYERS;
  const a: number[] = [];
  const b: number[] = [];
  const layerOf = (node: number) =>
    node === 0
      ? 0
      : node === n - 1
        ? LAYERS + 1
        : 1 + Math.floor((node - 1) / WIDTH);
  for (let x = 0; x < n; x += 1) {
    for (let y = x + 1; y < n; y += 1) {
      if (layerOf(y) === layerOf(x) + 1) {
        a.push(x);
        b.push(y);
      }
    }
  }
  const m = a.length;
  const arrays: GraphArrays = {
    playerIds: Uint32Array.from({ length: n }, (_, i) => 100 + i),
    seasonIds: Uint32Array.of(19501951),
    teamIds: Uint32Array.of(1),
    edgeA: Uint16Array.from(a),
    edgeB: Uint16Array.from(b),
    spanStart: Uint32Array.from({ length: m + 1 }, (_, i) => i),
    spanSeason: new Uint8Array(m),
    spanKind: new Uint8Array(m).fill(2),
    spanTeam: new Uint8Array(m),
    spanLink: new Uint8Array(m),
    spanGames: new Uint16Array(m).fill(1),
    spanFirstGame: new Uint32Array(m).fill(1950020001),
  };
  return makeGraph(arrays);
};

test("a count past the cap saturates and is flagged; limit still lists chains lazily", () => {
  const graph = layered();
  const result = findPaths(graph, 100, 157, DEFAULT_FILTER, "with", 3);
  assert.ok(Result.isSuccess(result));
  assert.equal(result.success.distance, 8);
  assert.equal(result.success.pathCount, PATH_COUNT_CAP);
  assert.equal(result.success.pathCountCapped, true);
  assert.deepEqual(result.success.paths.map(chainIds), [
    [100, 101, 109, 117, 125, 133, 141, 149, 157],
    [100, 101, 109, 117, 125, 133, 141, 150, 157],
    [100, 101, 109, 117, 125, 133, 141, 151, 157],
  ]);
});

test("the cap is inclusive: a count equal to the cap is capped, one below is exact", () => {
  const graph = layered();
  const distance = bfsDistances(
    graph,
    graph.indexOf.get(157) ?? -1,
    DEFAULT_FILTER,
    0
  );
  assert.deepEqual(
    countShortestChains(graph, distance, 0, DEFAULT_FILTER, CHAINS + 1),
    { count: CHAINS, capped: false }
  );
  assert.deepEqual(
    countShortestChains(graph, distance, 0, DEFAULT_FILTER, CHAINS),
    { count: CHAINS, capped: true }
  );
});

test("equal games tie-break to the lower player ID, for limit 1 and in tied-chain order", () => {
  const graph = layered();
  const first = findPaths(graph, 100, 157, DEFAULT_FILTER, "with", 1);
  assert.ok(Result.isSuccess(first));
  assert.deepEqual(first.success.paths.map(chainIds), [
    [100, 101, 109, 117, 125, 133, 141, 149, 157],
  ]);
  const two = findPaths(graph, 148, 157, DEFAULT_FILTER, "with", 10);
  assert.ok(Result.isSuccess(two));
  assert.equal(two.success.pathCount, 8);
  assert.deepEqual(
    two.success.paths.map(chainIds),
    [149, 150, 151, 152, 153, 154, 155, 156].map((id) => [148, id, 157])
  );
});

// Start 0, target 7. Chains 0-1-{2,3}-7 (two tied) and 0-1-... Off-path players 4, 5, 6 hang off the target
// and each other at distance 1 and 2 from it, closer to the target than the start but on no chain from it.
const withOffPath = () => {
  const edges: readonly (readonly [number, number])[] = [
    [0, 1],
    [1, 2],
    [1, 3],
    [2, 7],
    [3, 7],
    [4, 7],
    [5, 7],
    [4, 6],
    [5, 6],
  ];
  const m = edges.length;
  return makeGraph({
    playerIds: Uint32Array.from({ length: 8 }, (_, i) => 100 + i),
    seasonIds: Uint32Array.of(19501951),
    teamIds: Uint32Array.of(1),
    edgeA: Uint16Array.from(edges.map(([x]) => x)),
    edgeB: Uint16Array.from(edges.map(([, y]) => y)),
    spanStart: Uint32Array.from({ length: m + 1 }, (_, i) => i),
    spanSeason: new Uint8Array(m),
    spanKind: new Uint8Array(m).fill(2),
    spanTeam: new Uint8Array(m),
    spanLink: new Uint8Array(m),
    spanGames: new Uint16Array(m).fill(1),
    spanFirstGame: new Uint32Array(m).fill(1950020001),
  });
};

test("counting visits only players on a shortest chain from the start, not closer off-path players", () => {
  const graph = withOffPath();
  const distance = bfsDistances(graph, 7, DEFAULT_FILTER, 0);
  assert.deepEqual(Array.fromIterable(distance), [3, 2, 1, 1, 1, 1, 2, 0]);
  const { offsets, neighbours } = graph.adjacency;
  const expanded: number[] = [];
  const counted = countChainsBy(distance, 0, PATH_COUNT_CAP, (node, visit) => {
    expanded.push(node);
    for (let at = offsets[node]; at < offsets[node + 1]; at += 1) {
      if (distance[neighbours[at]] === distance[node] - 1)
        visit(neighbours[at]);
    }
  });
  assert.deepEqual(counted, { count: 2, capped: false });
  assert.deepEqual(Array.sort([...expanded], Order.Number), [0, 1, 2, 3]);
  assert.deepEqual(
    countShortestChains(graph, distance, 0, DEFAULT_FILTER, PATH_COUNT_CAP),
    { count: 2, capped: false }
  );
});

test("findRelationPaths defaults limit to one chain", () => {
  const index = (id: number) => MINI_GRAPH.indexOf.get(id) ?? -1;
  const result = findRelationPaths(
    MINI_GRAPH,
    index(11),
    index(16),
    DEFAULT_FILTER,
    "either"
  );
  assert.ok(Result.isSuccess(result));
  assert.equal(result.success.paths.length, 1);
});
