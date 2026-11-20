import assert from "node:assert/strict";
import { test } from "node:test";

import { Array, Order, Result, Schema } from "effect";

import { HistoryUnavailable, UnknownPlayer } from "../src/contracts.ts";
import {
  evidenceSpan,
  hopKind,
  link,
  linkIdBetween,
  linkKind,
  linkPassingGames,
  linkPasses,
  makeGraph,
  opponents,
  spanPasses,
} from "../src/graph.ts";
import { DEFAULT_FILTER } from "../src/shapes.ts";
import type { Filter, LinkResult } from "../src/shapes.ts";
import { MINI_ARRAYS, MINI_GRAPH } from "./fakes.ts";

const graph = makeGraph(MINI_ARRAYS);
const filterWith = (changes: Partial<Filter>): Filter => ({
  ...DEFAULT_FILTER,
  ...changes,
});

const S1 = 19501951;
const S2 = 19511952;

// Teammate links of C-mini as [a, b, games that pass the filter]; 0 means the link does not pass.
type Row = readonly [number, number, number];
const expectations: readonly (readonly [string, Filter, readonly Row[]])[] = [
  [
    "default",
    DEFAULT_FILTER,
    [
      [11, 12, 2],
      [11, 13, 1],
      [12, 14, 2],
      [13, 14, 1],
      [14, 15, 2],
      [15, 16, 2],
      [16, 17, 3],
      [17, 18, 1],
      [19, 20, 1],
    ],
  ],
  [
    "regular only",
    filterWith({ competition: "regular" }),
    [
      [11, 12, 2],
      [11, 13, 1],
      [12, 14, 2],
      [13, 14, 1],
      [14, 15, 0],
      [15, 16, 2],
      [16, 17, 3],
      [17, 18, 1],
      [19, 20, 1],
    ],
  ],
  [
    "playoff only",
    filterWith({ competition: "playoff" }),
    [
      [11, 12, 0],
      [11, 13, 0],
      [12, 14, 0],
      [13, 14, 0],
      [14, 15, 2],
      [15, 16, 0],
      [16, 17, 0],
      [17, 18, 0],
      [19, 20, 0],
    ],
  ],
  [
    "1950-51 only",
    filterWith({ fromSeason: S1, toSeason: S1 }),
    [
      [11, 12, 2],
      [11, 13, 1],
      [12, 14, 0],
      [13, 14, 0],
      [14, 15, 0],
      [15, 16, 2],
      [16, 17, 0],
      [17, 18, 0],
      [19, 20, 1],
    ],
  ],
  [
    "1951-52 only",
    filterWith({ fromSeason: S2, toSeason: S2 }),
    [
      [11, 12, 0],
      [11, 13, 0],
      [12, 14, 2],
      [13, 14, 1],
      [14, 15, 2],
      [15, 16, 0],
      [16, 17, 3],
      [17, 18, 1],
      [19, 20, 0],
    ],
  ],
  [
    "partners off",
    filterWith({ goaliePartners: false }),
    [
      [11, 12, 2],
      [11, 13, 1],
      [12, 14, 2],
      [13, 14, 1],
      [14, 15, 2],
      [15, 16, 2],
      [16, 17, 0],
      [17, 18, 1],
      [19, 20, 1],
    ],
  ],
  [
    "an open lower bound",
    filterWith({ fromSeason: S2 }),
    [
      [11, 12, 0],
      [12, 14, 2],
      [16, 17, 3],
      [19, 20, 0],
    ],
  ],
  [
    "an open upper bound",
    filterWith({ toSeason: S1 }),
    [
      [11, 12, 2],
      [12, 14, 0],
      [15, 16, 2],
      [16, 17, 0],
    ],
  ],
  [
    "playoff and 1950-51",
    filterWith({ competition: "playoff", toSeason: S1 }),
    [
      [14, 15, 0],
      [11, 12, 0],
    ],
  ],
];

for (const [name, filter, rows] of expectations) {
  test(`teammate links under ${name}`, () => {
    for (const [a, b, games] of rows) {
      const result = link(graph, a, b, filter);
      assert.ok(Result.isSuccess(result), `${a}-${b} resolves`);
      assert.equal(result.success.totalGames, games, `${a}-${b} total games`);
      assert.equal(
        result.success.spans.length > 0,
        games > 0,
        `${a}-${b} has spans iff it passes`
      );
      assert.equal(
        result.success.evidenceGameId === null,
        games === 0,
        `${a}-${b} evidence iff it passes`
      );
      // Opponent games ignore the filter; of the teammate links only 15-16 also met as opponents (2 games).
      assert.equal(result.success.opposedGames, a === 15 && b === 16 ? 2 : 0);
      // The reverse order is the same link, and the allocation-free helpers agree with `link`.
      const reverse = link(graph, b, a, filter);
      assert.ok(Result.isSuccess(reverse));
      assert.deepEqual(reverse.success, result.success);
      const linkId = linkIdBetween(
        graph,
        graph.indexOf.get(a) ?? -1,
        graph.indexOf.get(b) ?? -1
      );
      assert.ok(linkId >= 0);
      assert.equal(linkPassingGames(graph, linkId, filter), games);
      assert.equal(linkPasses(graph, linkId, filter), games > 0);
    }
  });
}

test("evidence games and span contents under the default filter", () => {
  const expected: readonly (readonly [number, number, number])[] = [
    [11, 12, 1950020001],
    [11, 13, 1950020003],
    [12, 14, 1951020001],
    [13, 14, 1951020003],
    [14, 15, 1951030111],
    [15, 16, 1950020001],
    [16, 17, 1951020001],
    [17, 18, 1951020002],
    [19, 20, 1950020003],
  ];
  for (const [a, b, game] of expected) {
    const result = link(graph, a, b, DEFAULT_FILTER);
    assert.ok(Result.isSuccess(result));
    assert.equal(result.success.evidenceGameId, game, `${a}-${b}`);
    assert.equal(result.success.spans.length, 1);
    assert.equal(result.success.spans[0].firstGameId, game);
  }
  const playoff = link(graph, 14, 15, DEFAULT_FILTER);
  assert.ok(Result.isSuccess(playoff));
  assert.deepEqual(playoff.success.spans, [
    {
      seasonId: S2,
      gameType: 3,
      teamId: 2,
      link: "PlayedWith",
      games: 2,
      firstGameId: 1951030111,
    },
  ]);
});

test("the 16-17 goalie-partner link: evidence game E, gone with partners off", () => {
  const result = link(graph, 16, 17, DEFAULT_FILTER);
  assert.ok(Result.isSuccess(result));
  assert.deepEqual(result.success, {
    spans: [
      {
        seasonId: S2,
        gameType: 2,
        teamId: 3,
        link: "GoaliePartners",
        games: 3,
        firstGameId: 1951020001,
      },
    ],
    totalGames: 3,
    evidenceGameId: 1951020001,
    opposedGames: 0,
  } satisfies LinkResult);
  const off = link(graph, 16, 17, filterWith({ goaliePartners: false }));
  assert.ok(Result.isSuccess(off));
  assert.deepEqual(off.success, {
    spans: [],
    totalGames: 0,
    evidenceGameId: null,
    opposedGames: 0,
  });
});

test("shared-game spans come before goalie-partner spans, and a link passes on any one span", () => {
  // Hand-built: link 0 holds a partner span (array order first) then a shared-game span, in two seasons.
  const arrays = {
    ...MINI_ARRAYS,
    edgeA: Uint16Array.of(0),
    edgeB: Uint16Array.of(1),
    spanStart: Uint32Array.of(0, 2),
    spanSeason: Uint8Array.of(0, 1),
    spanKind: Uint8Array.of(2, 2),
    spanTeam: Uint8Array.of(0, 0),
    spanLink: Uint8Array.of(1, 0),
    spanGames: Uint16Array.of(4, 5),
    spanFirstGame: Uint32Array.of(1950020001, 1951020001),
  };
  const g = makeGraph(arrays);
  const both = link(g, 11, 12, DEFAULT_FILTER);
  assert.ok(Result.isSuccess(both));
  assert.deepEqual(
    both.success.spans.map((s) => s.link),
    ["PlayedWith", "GoaliePartners"]
  );
  assert.equal(both.success.totalGames, 9);
  assert.equal(both.success.evidenceGameId, 1951020001);
  const sharedOnly = link(g, 11, 12, filterWith({ goaliePartners: false }));
  assert.ok(Result.isSuccess(sharedOnly));
  assert.equal(sharedOnly.success.totalGames, 5);
  const firstSeason = link(g, 11, 12, filterWith({ toSeason: S1 }));
  assert.ok(Result.isSuccess(firstSeason));
  assert.equal(firstSeason.success.totalGames, 4);
  assert.equal(firstSeason.success.evidenceGameId, 1950020001);
});

test("with shared-game and partner spans both passing, the kind is PlayedWith and the evidence is the shared span", () => {
  // One link, spans sorted (season, kind, team, link): 1950-51 team 3 shared then partner, then 1951-52 partner only.
  const arrays = {
    ...MINI_ARRAYS,
    edgeA: Uint16Array.of(5),
    edgeB: Uint16Array.of(6),
    spanStart: Uint32Array.of(0, 3),
    spanSeason: Uint8Array.of(0, 0, 1),
    spanKind: Uint8Array.of(2, 2, 2),
    spanTeam: Uint8Array.of(2, 2, 2),
    spanLink: Uint8Array.of(0, 1, 1),
    spanGames: Uint16Array.of(2, 7, 3),
    spanFirstGame: Uint32Array.of(1950020005, 1950020001, 1951020001),
  };
  const g = makeGraph(arrays);
  const result = link(g, 16, 17, DEFAULT_FILTER);
  assert.ok(Result.isSuccess(result));
  assert.deepEqual(
    result.success.spans.map((s) => [s.link, s.seasonId]),
    [
      ["PlayedWith", S1],
      ["GoaliePartners", S1],
      ["GoaliePartners", S2],
    ]
  );
  assert.equal(result.success.totalGames, 12);
  // Evidence is the shared span's first game, not the earlier partner game.
  assert.equal(result.success.evidenceGameId, 1950020005);
  assert.equal(evidenceSpan(g, 0, DEFAULT_FILTER), 0);
  assert.equal(hopKind(g, 0, DEFAULT_FILTER), "PlayedWith");
  // A filter that drops the shared span leaves a partner hop with the first passing partner span as evidence.
  const lateOnly = filterWith({ fromSeason: S2 });
  assert.equal(hopKind(g, 0, lateOnly), "GoaliePartners");
  assert.equal(evidenceSpan(g, 0, lateOnly), 2);
  assert.equal(
    hopKind(g, 0, filterWith({ goaliePartners: false })),
    "PlayedWith"
  );
  assert.equal(hopKind(g, 0, filterWith({ competition: "playoff" })), null);
  assert.equal(evidenceSpan(g, 0, filterWith({ competition: "playoff" })), -1);
});

test("hop kind and evidence span on the mini league", () => {
  const id = (a: number, b: number) =>
    linkIdBetween(
      MINI_GRAPH,
      MINI_GRAPH.indexOf.get(a) ?? -1,
      MINI_GRAPH.indexOf.get(b) ?? -1
    );
  assert.equal(
    hopKind(MINI_GRAPH, id(16, 17), DEFAULT_FILTER),
    "GoaliePartners"
  );
  assert.equal(
    hopKind(MINI_GRAPH, id(16, 17), filterWith({ goaliePartners: false })),
    null
  );
  assert.equal(hopKind(MINI_GRAPH, id(11, 12), DEFAULT_FILTER), "PlayedWith");
  assert.equal(evidenceSpan(MINI_GRAPH, id(16, 17), DEFAULT_FILTER), 6);
});

test("an unknown player is UnknownPlayer, whichever side", () => {
  const first = link(graph, 99, 11, DEFAULT_FILTER);
  assert.ok(Result.isFailure(first));
  assert.ok(Schema.is(UnknownPlayer)(first.failure));
  assert.equal(first.failure.playerId, 99);
  const second = link(graph, 11, 21, DEFAULT_FILTER);
  assert.ok(Result.isFailure(second));
  assert.equal(second.failure.playerId, 21);
});

test("a pair with no link, and a player with himself, is empty", () => {
  const empty = {
    spans: [],
    totalGames: 0,
    evidenceGameId: null,
    opposedGames: 0,
  };
  for (const [a, b] of [
    [11, 14],
    [11, 11],
  ] as const) {
    const result = link(graph, a, b, DEFAULT_FILTER);
    assert.ok(Result.isSuccess(result));
    assert.deepEqual(result.success, empty);
  }
});

test("adjacency lists each player's teammates in ascending ID order with matching link IDs", () => {
  const { offsets, neighbours, linkIds } = graph.adjacency;
  assert.equal(offsets.length, MINI_ARRAYS.playerIds.length + 1);
  assert.equal(neighbours.length, 2 * MINI_ARRAYS.edgeA.length);
  const teammatesOf = (playerId: number): number[] => {
    const index = graph.indexOf.get(playerId) ?? -1;
    return Array.fromIterable(
      neighbours.subarray(offsets[index], offsets[index + 1])
    ).map((n) => MINI_ARRAYS.playerIds[n]);
  };
  assert.deepEqual(teammatesOf(11), [12, 13]);
  assert.deepEqual(teammatesOf(14), [12, 13, 15]);
  assert.deepEqual(teammatesOf(16), [15, 17]);
  assert.deepEqual(teammatesOf(19), [20]);
  for (let p = 0; p < MINI_ARRAYS.playerIds.length; p += 1) {
    for (let k = offsets[p]; k < offsets[p + 1]; k += 1) {
      const e = linkIds[k];
      const ends = Array.sort(
        [MINI_ARRAYS.edgeA[e], MINI_ARRAYS.edgeB[e]],
        Order.Number
      );
      assert.deepEqual(ends, Array.sort([p, neighbours[k]], Order.Number));
    }
  }
  assert.equal(linkIdBetween(graph, 0, 3), -1);
});

test("spanPasses tests competition, inclusive season bounds, and partner spans", () => {
  // Span 4 is 14-15 playoffs in 1951-52; span 6 is the 16-17 partner span; span 0 is 11-12 in 1950-51.
  assert.equal(
    spanPasses(graph, 4, filterWith({ competition: "playoff" })),
    true
  );
  assert.equal(
    spanPasses(graph, 4, filterWith({ competition: "regular" })),
    false
  );
  assert.equal(
    spanPasses(graph, 0, filterWith({ fromSeason: S1, toSeason: S1 })),
    true
  );
  assert.equal(spanPasses(graph, 0, filterWith({ fromSeason: S2 })), false);
  assert.equal(spanPasses(graph, 0, filterWith({ toSeason: S1 - 1 })), false);
  assert.equal(
    spanPasses(graph, 6, filterWith({ goaliePartners: false })),
    false
  );
  assert.equal(spanPasses(graph, 6, DEFAULT_FILTER), true);
});

// The opponent count in `link` (D14). Full opponent answers are in tests/opponents.test.ts.

test("link counts games as opponents with or without teammate spans, whatever the filter", () => {
  const never = { spans: [], totalGames: 0, evidenceGameId: null };
  const strangers = link(graph, 11, 19, DEFAULT_FILTER);
  assert.ok(Result.isSuccess(strangers));
  assert.deepEqual(strangers.success, { ...never, opposedGames: 1 });
  const reverse = link(graph, 19, 11, filterWith({ competition: "playoff" }));
  assert.ok(Result.isSuccess(reverse));
  assert.deepEqual(reverse.success, { ...never, opposedGames: 1 });
  // 15-16 are teammates and opponents; the filter hides only the teammate spans.
  const both = link(graph, 15, 16, filterWith({ competition: "playoff" }));
  assert.ok(Result.isSuccess(both));
  assert.deepEqual(both.success, { ...never, opposedGames: 2 });
  const unmet = link(graph, 11, 14, DEFAULT_FILTER);
  assert.ok(Result.isSuccess(unmet));
  assert.equal(unmet.success.opposedGames, 0);
});

test("without opponent arrays, link keeps opposedGames at 0 and opponents is HistoryUnavailable", () => {
  const { oppA, oppB, oppGames, ...teammatesOnly } = MINI_ARRAYS;
  assert.ok(oppA !== undefined && oppB !== undefined && oppGames !== undefined);
  const bare = makeGraph(teammatesOnly);
  const result = link(bare, 15, 16, DEFAULT_FILTER);
  assert.ok(Result.isSuccess(result));
  assert.equal(result.success.opposedGames, 0);
  const listed = opponents(bare, 16);
  assert.ok(Result.isFailure(listed));
  assert.ok(Schema.is(HistoryUnavailable)(listed.failure));
});

test("linkKind takes player IDs and answers null for non-links, unknown IDs, and the same player", () => {
  assert.equal(linkKind(MINI_GRAPH, 16, 17, DEFAULT_FILTER), "GoaliePartners");
  assert.equal(
    linkKind(MINI_GRAPH, 17, 16, filterWith({ goaliePartners: false })),
    null
  );
  assert.equal(linkKind(MINI_GRAPH, 11, 12, DEFAULT_FILTER), "PlayedWith");
  assert.equal(linkKind(MINI_GRAPH, 11, 20, DEFAULT_FILTER), null);
  assert.equal(linkKind(MINI_GRAPH, 11, 11, DEFAULT_FILTER), null);
  assert.equal(linkKind(MINI_GRAPH, 11, 99, DEFAULT_FILTER), null);
  assert.equal(linkKind(MINI_GRAPH, 11, 1.5, DEFAULT_FILTER), null);
});

test("a non-integer ID is an unknown player, not a thrown constructor error", () => {
  for (const bad of [1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
    const first = link(MINI_GRAPH, bad, 11, DEFAULT_FILTER);
    assert.ok(Result.isFailure(first));
    assert.equal(first.failure._tag, "UnknownPlayer");
    const second = link(MINI_GRAPH, 11, bad, DEFAULT_FILTER);
    assert.ok(Result.isFailure(second));
    assert.equal(second.failure._tag, "UnknownPlayer");
    const found = opponents(MINI_GRAPH, bad);
    assert.ok(Result.isFailure(found));
    assert.equal(found.failure._tag, "UnknownPlayer");
  }
});

test("every no-link result is a fresh object, so a caller cannot corrupt later answers", () => {
  const first = link(MINI_GRAPH, 11, 20, DEFAULT_FILTER);
  const second = link(MINI_GRAPH, 11, 20, DEFAULT_FILTER);
  assert.ok(Result.isSuccess(first) && Result.isSuccess(second));
  assert.notEqual(first.success, second.success);
  assert.notEqual(first.success.spans, second.success.spans);
  // SAFETY: drops readonly on purpose, to show that mutating one result cannot reach another.
  (first.success.spans as unknown[]).push("corrupt");
  assert.deepEqual(second.success.spans, []);
  const third = link(MINI_GRAPH, 11, 20, DEFAULT_FILTER);
  assert.ok(Result.isSuccess(third));
  assert.deepEqual(third.success.spans, []);
});
