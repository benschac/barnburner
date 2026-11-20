import assert from "node:assert/strict";
import { test } from "node:test";

import { Effect, Schema } from "effect";

import { UnknownPlayer } from "../src/contracts.ts";
import { finalsCoverage } from "../src/finals.ts";
import { makeGraph } from "../src/graph.ts";
import type { FinalRow, GraphArrays } from "../src/shapes.ts";
import { MINI_GRAPH, makeMiniStore } from "./fakes.ts";

// Mini league: the 1952 Final (games 1951030111/2) has players 14, 15, 16.
test("a hit: 13 played with 14, who played in the 1952 Final", async () => {
  const result = await Effect.runPromise(
    finalsCoverage(MINI_GRAPH, makeMiniStore(), 13, 1952, 1952)
  );
  assert.deepEqual(result, [
    {
      _tag: "Hit",
      year: 1952,
      seasonId: 19511952,
      playerId: 14,
      finalGameId: 1951030111,
      sharedGameId: 1951020003,
    },
  ]);
});

test("a goalie-partner link does not count, and neither does a teammate who missed the Final", async () => {
  // 17 is only a goalie partner of 16, who played the Final.
  const [partner] = await Effect.runPromise(
    finalsCoverage(MINI_GRAPH, makeMiniStore(), 17, 1952, 1952)
  );
  assert.deepEqual(partner, { _tag: "Miss", year: 1952, seasonId: 19511952 });
  // 20 has only teammate 19, who did not play the Final.
  const [none] = await Effect.runPromise(
    finalsCoverage(MINI_GRAPH, makeMiniStore(), 20, 1952, 1952)
  );
  assert.equal(none._tag, "Miss");
});

test("an unknown player fails with UnknownPlayer", async () => {
  const error = await Effect.runPromise(
    Effect.flip(finalsCoverage(MINI_GRAPH, makeMiniStore(), 999, 1952, 1952))
  );
  assert.ok(Schema.is(UnknownPlayer)(error));
});

test("the year range is inclusive and excludes other years", async () => {
  const store = makeMiniStore();
  assert.deepEqual(
    await Effect.runPromise(finalsCoverage(MINI_GRAPH, store, 13, 1953, 1960)),
    []
  );
  assert.deepEqual(
    await Effect.runPromise(finalsCoverage(MINI_GRAPH, store, 13, 1900, 1951)),
    []
  );
  assert.equal(
    (await Effect.runPromise(finalsCoverage(MINI_GRAPH, store, 13, 1900, 1952)))
      .length,
    1
  );
  assert.equal(
    (await Effect.runPromise(finalsCoverage(MINI_GRAPH, store, 13, 1952, 2000)))
      .length,
    1
  );
});

// Extra league: players 1..4; 1-2 (5 games, first 2000), 1-3 (3 games, first 2100), 1-4 goalie partners only.
const arrays: GraphArrays = {
  playerIds: Uint32Array.of(1, 2, 3, 4),
  seasonIds: Uint32Array.of(19951996),
  teamIds: Uint32Array.of(1),
  edgeA: Uint16Array.of(0, 0, 0),
  edgeB: Uint16Array.of(1, 2, 3),
  spanStart: Uint32Array.of(0, 1, 2, 3),
  spanSeason: Uint8Array.of(0, 0, 0),
  spanKind: Uint8Array.of(2, 2, 2),
  spanTeam: Uint8Array.of(0, 0, 0),
  spanLink: Uint8Array.of(0, 0, 1),
  spanGames: Uint16Array.of(5, 3, 4),
  spanFirstGame: Uint32Array.of(2000, 2100, 2200),
};
const graph = makeGraph(arrays);

const part = (playerId: number, firstGameId: number) => ({
  playerId,
  teamId: 1,
  firstGameId,
});
const finals: ReadonlyArray<FinalRow> = [
  // Teammate 2 played the Final (game 900) before the link's first game (2000): still a hit.
  {
    year: 1990,
    seasonId: 19891990,
    gameIds: [900],
    participants: [part(2, 900)],
  },
  // Only a goalie partner (4) played: miss.
  {
    year: 1991,
    seasonId: 19901991,
    gameIds: [910],
    participants: [part(4, 910)],
  },
  // Only the player himself played: miss.
  {
    year: 1992,
    seasonId: 19911992,
    gameIds: [920],
    participants: [part(1, 920)],
  },
  // Teammates 3 and 2 both played: 2 has more shared games.
  {
    year: 1993,
    seasonId: 19921993,
    gameIds: [930],
    participants: [part(1, 930), part(3, 930), part(2, 931)],
  },
  {
    year: 1994,
    seasonId: 19931994,
    gameIds: [940],
    participants: [part(3, 941)],
  },
];
const store = {
  ...makeMiniStore(),
  finals: (from: number, to: number) =>
    Effect.succeed(finals.filter((f) => f.year >= from && f.year <= to)),
};

test("a miss, a postdating link, and the most-games choice", async () => {
  const result = await Effect.runPromise(
    finalsCoverage(graph, store, 1, 1990, 1994)
  );
  assert.deepEqual(result, [
    {
      _tag: "Hit",
      year: 1990,
      seasonId: 19891990,
      playerId: 2,
      finalGameId: 900,
      sharedGameId: 2000,
    },
    { _tag: "Miss", year: 1991, seasonId: 19901991 },
    { _tag: "Miss", year: 1992, seasonId: 19911992 },
    {
      _tag: "Hit",
      year: 1993,
      seasonId: 19921993,
      playerId: 2,
      finalGameId: 931,
      sharedGameId: 2000,
    },
    {
      _tag: "Hit",
      year: 1994,
      seasonId: 19931994,
      playerId: 3,
      finalGameId: 941,
      sharedGameId: 2100,
    },
  ]);
});

test("the range bounds are inclusive in the extra league", async () => {
  const result = await Effect.runPromise(
    finalsCoverage(graph, store, 1, 1991, 1993)
  );
  assert.deepEqual(
    result.map((r) => r.year),
    [1991, 1992, 1993]
  );
});
