import assert from "node:assert/strict";
import { test } from "node:test";

import { Array, Effect, Order, Schema } from "effect";

import {
  FarthestResultSchema,
  FilterSchema,
  FindPathInput,
  FindPathResult,
  GetFarthestInput,
  GetFarthestResult,
  GetFinalsCoverageInput,
  GetFinalsCoverageResult,
  GetLinkInput,
  GetLinkResult,
  GetOpponentsInput,
  GetOpponentsResult,
  GetOpposedGamesInput,
  GetOpposedGamesResult,
  GetPlayerInput,
  GetPlayerResult,
  GetRosterInput,
  GetRosterResult,
  GetSharedGamesInput,
  GetSharedGamesResult,
  GetTeammatesInput,
  GetTeammatesResult,
  HistoryRpcs,
  HistoryUnavailable,
  LinkResultSchema,
  NoPath,
  PathResultSchema,
  RosterLinkSchema,
  SearchPlayersInput,
  SearchPlayersResult,
  UnknownPlayer,
  UnknownRoster,
  UnsupportedFilter,
  WireHop,
} from "../src/contracts.ts";
import { DEFAULT_FILTER, FinalsYear } from "../src/shapes.ts";
import type {
  FarthestResult,
  Filter,
  GraphArrays,
  LinkResult,
  PathResult,
  TeammateHop,
} from "../src/shapes.ts";
import {
  MINI_ARRAYS,
  MINI_GAMES,
  MINI_SNAPSHOT_ID,
  makeMiniStore,
} from "./fakes.ts";

const roundTrip = <T, E>(schema: Schema.Codec<T, E>, value: T): void => {
  const decoded = Schema.decodeUnknownSync(schema)(
    Schema.encodeSync(schema)(value)
  );
  assert.deepEqual(decoded, value);
};

const teammateHop = (from: number, to: number): TeammateHop => ({
  _tag: "PlayedWith",
  from,
  to,
  games: 2,
  teamId: 1,
  seasonId: 19501951,
  gameType: 2,
  gameId: 1950020001,
});
const goaliePartners: TeammateHop = {
  _tag: "GoaliePartners",
  from: 16,
  to: 17,
  games: 3,
  teamId: 3,
  seasonId: 19511952,
  gameType: 2,
  gameId: 1951020001,
};
const filter: Filter = {
  competition: "regular",
  fromSeason: 19501951,
  toSeason: null,
  goaliePartners: false,
};
const link: LinkResult = {
  spans: [
    {
      seasonId: 19511952,
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
};
// The RPC hop adds the first opposed game to `PlayedAgainst`, so the wire type is a subtype of the pure `PathResult`.
const path: typeof PathResultSchema.Type = {
  distance: 3,
  pathCount: 2,
  pathCountCapped: false,
  paths: [
    [
      teammateHop(11, 12),
      goaliePartners,
      { _tag: "PlayedAgainst", from: 17, to: 12, games: 1, gameId: 1951020002 },
    ],
  ],
};
const farthest: FarthestResult = {
  distance: 6,
  atDistance: 1,
  reachable: 7,
  unreachable: 2,
  example: [goaliePartners],
};
const finalsYears: readonly FinalsYear[] = [
  {
    _tag: "Hit",
    year: 1952,
    seasonId: 19511952,
    playerId: 14,
    finalGameId: 1951030111,
    sharedGameId: 1951020001,
  },
  { _tag: "Miss", year: 1953, seasonId: 19521953 },
];
const player = {
  playerId: 14,
  name: "Player Fourteen",
  position: "D",
  firstSeason: 19511952,
  lastSeason: 19511952,
  games: 5,
} as const;

test("shape schemas round-trip and stay assignable to the plain shapes", () => {
  roundTrip(FilterSchema, filter);
  roundTrip(FilterSchema, DEFAULT_FILTER);
  // Each assignment below fails to compile if a schema drifts from its plain shape.
  const asLink: LinkResult = Schema.decodeSync(LinkResultSchema)(
    Schema.encodeSync(LinkResultSchema)(link)
  );
  assert.deepEqual(asLink, link);
  const asPath: PathResult = Schema.decodeSync(PathResultSchema)(
    Schema.encodeSync(PathResultSchema)(path)
  );
  assert.deepEqual(asPath, path);
  const asFarthest: FarthestResult = Schema.decodeSync(FarthestResultSchema)(
    Schema.encodeSync(FarthestResultSchema)(farthest)
  );
  assert.deepEqual(asFarthest, farthest);
  const asFilter: Filter = Schema.decodeSync(FilterSchema)(
    Schema.encodeSync(FilterSchema)(filter)
  );
  assert.deepEqual(asFilter, filter);
  roundTrip(LinkResultSchema, link);
  roundTrip(PathResultSchema, path);
  roundTrip(WireHop, goaliePartners);
  for (const year of finalsYears) {
    const asYear: FinalsYear = Schema.decodeSync(FinalsYear)(
      Schema.encodeSync(FinalsYear)(year)
    );
    assert.deepEqual(asYear, year);
  }
  roundTrip(RosterLinkSchema, { _tag: "NoLink" });
  roundTrip(RosterLinkSchema, {
    _tag: "GoaliePartners",
    games: 3,
    evidenceGameId: 1951020001,
  });
});

test("every RPC input and output round-trips one value", () => {
  roundTrip(SearchPlayersInput, { query: "dvorak", limit: 20 });
  roundTrip(SearchPlayersResult, {
    snapshotId: MINI_SNAPSHOT_ID,
    players: [player],
  });
  roundTrip(GetPlayerInput, { playerId: 14 });
  roundTrip(GetPlayerResult, {
    snapshotId: MINI_SNAPSHOT_ID,
    player: { ...player, points: 2, teammates: 3 },
    stints: [
      {
        seasonId: 19511952,
        gameType: 2,
        teamId: 2,
        teamAbbrev: "BBB",
        teamName: "Bravo Club",
        games: 3,
        firstGameId: 1951020001,
        lastGameId: 1951020003,
      },
    ],
  });
  roundTrip(GetRosterInput, {
    teamId: 2,
    seasonId: 19511952,
    gameType: 2,
    focusPlayerId: 14,
  });
  roundTrip(GetRosterInput, { teamId: 2, seasonId: 19511952, gameType: 3 });
  roundTrip(GetRosterResult, {
    snapshotId: MINI_SNAPSHOT_ID,
    teamId: 3,
    seasonId: 19511952,
    gameType: 2,
    focusPlayerId: 17,
    players: [
      {
        playerId: 16,
        name: "Goalie Sixteen",
        position: "G",
        games: 2,
        link: { _tag: "GoaliePartners", games: 3, evidenceGameId: 1951020001 },
      },
      {
        playerId: 18,
        name: "Player Eighteen",
        position: "D",
        games: 1,
        link: { _tag: "NoLink" },
      },
    ],
  });
  roundTrip(GetRosterResult, {
    snapshotId: MINI_SNAPSHOT_ID,
    teamId: 3,
    seasonId: 19511952,
    gameType: 2,
    players: [
      { playerId: 18, name: "Player Eighteen", position: "D", games: 1 },
    ],
  });
  roundTrip(GetLinkInput, { a: 16, b: 17, filter });
  roundTrip(GetLinkResult, { snapshotId: MINI_SNAPSHOT_ID, ...link });
  roundTrip(GetSharedGamesInput, {
    a: 16,
    b: 17,
    seasonId: 19511952,
    gameType: 2,
    teamId: 3,
    link: "GoaliePartners",
  });
  roundTrip(GetSharedGamesResult, {
    snapshotId: MINI_SNAPSHOT_ID,
    games: [
      { gameId: 1951020001, gameDate: "1951-10-10", link: "GoaliePartners" },
    ],
  });
  roundTrip(GetTeammatesInput, { playerId: 16, filter: DEFAULT_FILTER });
  roundTrip(GetTeammatesResult, {
    snapshotId: MINI_SNAPSHOT_ID,
    teammates: [
      {
        playerId: 17,
        name: "Goalie Seventeen",
        position: "G",
        spans: [
          {
            seasonId: 19511952,
            gameType: 2,
            teamId: 3,
            link: "GoaliePartners",
            games: 3,
            firstGameId: 1951020001,
          },
        ],
      },
    ],
  });
  roundTrip(GetOpponentsInput, { playerId: 16, limit: 50, offset: 0 });
  roundTrip(GetOpponentsResult, {
    snapshotId: MINI_SNAPSHOT_ID,
    total: 5,
    opponents: [{ playerId: 14, name: "Player Fourteen", games: 4 }],
  });
  roundTrip(GetOpposedGamesInput, { a: 11, b: 19 });
  roundTrip(GetOpposedGamesResult, {
    snapshotId: MINI_SNAPSHOT_ID,
    games: [
      { gameId: 1950020003, gameDate: "1950-10-15", aTeamId: 1, bTeamId: 4 },
    ],
  });
  roundTrip(FindPathInput, {
    from: 11,
    to: 18,
    filter: DEFAULT_FILTER,
    relation: "with",
    limit: 10,
  });
  roundTrip(FindPathResult, { snapshotId: MINI_SNAPSHOT_ID, ...path });
  roundTrip(GetFarthestInput, { playerId: 11, filter: DEFAULT_FILTER });
  roundTrip(GetFarthestResult, { snapshotId: MINI_SNAPSHOT_ID, ...farthest });
  roundTrip(GetFinalsCoverageInput, {
    playerId: 14,
    fromYear: 1952,
    toYear: 1952,
  });
  roundTrip(GetFinalsCoverageResult, {
    snapshotId: MINI_SNAPSHOT_ID,
    rule: "Teammates with a shared game only.",
    years: finalsYears,
  });
});

test("a roster result rejects a focused row without a link and an unfocused row with one", () => {
  const row = {
    playerId: 18,
    name: "Player Eighteen",
    position: "D",
    games: 1,
  } as const;
  const base = {
    snapshotId: MINI_SNAPSHOT_ID,
    teamId: 3,
    seasonId: 19511952,
    gameType: 2,
  } as const;
  const decode = Schema.decodeUnknownSync(GetRosterResult);
  assert.throws(() => decode({ ...base, focusPlayerId: 17, players: [row] }));
  assert.throws(() =>
    decode({
      ...base,
      focusPlayerId: 17,
      players: [{ ...row, link: { _tag: "NoLink" } }, row],
    })
  );
  assert.throws(() =>
    decode({ ...base, players: [{ ...row, link: { _tag: "NoLink" } }] })
  );
  decode({
    ...base,
    focusPlayerId: 17,
    players: [{ ...row, link: { _tag: "NoLink" } }],
  });
  decode({ ...base, players: [row] });
});

test("inputs reject values past the documented limits", () => {
  const decodeSearch = Schema.decodeUnknownSync(SearchPlayersInput);
  assert.throws(() => decodeSearch({ query: "a", limit: 21 }));
  assert.throws(() =>
    Schema.decodeUnknownSync(GetOpponentsInput)({
      playerId: 1,
      limit: 51,
      offset: 0,
    })
  );
  assert.throws(() =>
    Schema.decodeUnknownSync(FindPathInput)({
      from: 1,
      to: 2,
      filter: DEFAULT_FILTER,
      relation: "with",
      limit: 11,
    })
  );
});

test("tagged errors round-trip and carry their context", () => {
  const errors = [
    new HistoryUnavailable({ message: "serving file missing" }),
    new UnknownPlayer({ playerId: 99 }),
    new UnknownRoster({ teamId: 9, seasonId: 19511952, gameType: 2 }),
    new NoPath({ from: 11, to: 19 }),
    new UnsupportedFilter({ relation: "either" }),
  ];
  const schema = Schema.Union([
    HistoryUnavailable,
    UnknownPlayer,
    UnknownRoster,
    NoPath,
    UnsupportedFilter,
  ]);
  for (const error of errors) {
    const decoded = Schema.decodeUnknownSync(schema)(
      Schema.encodeSync(schema)(error)
    );
    assert.equal(decoded._tag, error._tag);
    assert.deepEqual(
      Schema.encodeSync(schema)(decoded),
      Schema.encodeSync(schema)(error)
    );
  }
});

test("HistoryRpcs declares the eleven calls", () => {
  assert.deepEqual(Array.sort([...HistoryRpcs.requests.keys()], Order.String), [
    "FindPath",
    "GetFarthest",
    "GetFinalsCoverage",
    "GetLink",
    "GetOpponents",
    "GetOpposedGames",
    "GetPlayer",
    "GetRoster",
    "GetSharedGames",
    "GetTeammates",
    "SearchPlayers",
  ]);
});

/** Returns every C-graph sort and length rule the arrays break. */
const graphViolations = (g: GraphArrays): readonly string[] => {
  const problems: string[] = [];
  const ascending = (name: string, values: ArrayLike<number>) => {
    for (let i = 1; i < values.length; i += 1)
      if (values[i] <= values[i - 1])
        problems.push(`${name} not ascending at ${i}`);
  };
  const n = g.playerIds.length;
  const m = g.edgeA.length;
  const s = g.spanGames.length;
  ascending("playerIds", g.playerIds);
  ascending("seasonIds", g.seasonIds);
  ascending("teamIds", g.teamIds);
  if (n > 65_535) problems.push("too many players");
  if (g.teamIds.length > 255) problems.push("too many teams");
  if (g.edgeB.length !== m) problems.push("edgeA and edgeB differ in length");
  if (g.spanStart.length !== m + 1)
    problems.push("spanStart length is not m + 1");
  if (g.spanStart[0] !== 0) problems.push("spanStart does not begin at 0");
  if (g.spanStart[m] !== s) problems.push("spanStart does not end at s");
  for (let e = 0; e < m; e += 1) {
    if (g.spanStart[e + 1] < g.spanStart[e])
      problems.push(`spanStart not monotone at ${e}`);
    if (g.spanStart[e + 1] === g.spanStart[e])
      problems.push(`link ${e} has no spans`);
    if (!(g.edgeA[e] < g.edgeB[e])) problems.push(`edge ${e} has a >= b`);
    if (g.edgeB[e] >= n) problems.push(`edge ${e} points past the players`);
    if (
      e > 0 &&
      !(
        g.edgeA[e] > g.edgeA[e - 1] ||
        (g.edgeA[e] === g.edgeA[e - 1] && g.edgeB[e] > g.edgeB[e - 1])
      )
    ) {
      problems.push(`edges not sorted by (a, b) at ${e}`);
    }
    // Spans sort by (season, kind, team); a shared-game span precedes a partner span in the same slot.
    for (let i = g.spanStart[e] + 1; i < g.spanStart[e + 1]; i += 1) {
      const before = [
        g.spanSeason[i - 1],
        g.spanKind[i - 1],
        g.spanTeam[i - 1],
        g.spanLink[i - 1],
      ];
      const after = [
        g.spanSeason[i],
        g.spanKind[i],
        g.spanTeam[i],
        g.spanLink[i],
      ];
      const order = before.findIndex((value, k) => value !== after[k]);
      if (order === -1 || before[order] > after[order])
        problems.push(`spans of link ${e} not sorted at ${i}`);
    }
  }
  for (const [name, values] of [
    ["spanSeason", g.spanSeason],
    ["spanKind", g.spanKind],
    ["spanTeam", g.spanTeam],
    ["spanLink", g.spanLink],
    ["spanGames", g.spanGames],
    ["spanFirstGame", g.spanFirstGame],
  ] as const) {
    if (values.length !== s) problems.push(`${name} length is not s`);
  }
  for (let i = 0; i < s; i += 1) {
    if (g.spanSeason[i] >= g.seasonIds.length)
      problems.push(`span ${i} season out of range`);
    if (g.spanTeam[i] >= g.teamIds.length)
      problems.push(`span ${i} team out of range`);
    if (g.spanKind[i] !== 2 && g.spanKind[i] !== 3)
      problems.push(`span ${i} kind is not 2 or 3`);
    if (g.spanLink[i] !== 0 && g.spanLink[i] !== 1)
      problems.push(`span ${i} link is not 0 or 1`);
    if (g.spanGames[i] === 0) problems.push(`span ${i} has no games`);
  }
  if (
    g.oppA !== undefined &&
    g.oppB !== undefined &&
    g.oppGames !== undefined
  ) {
    const o = g.oppA.length;
    if (g.oppB.length !== o || g.oppGames.length !== o)
      problems.push("opponent arrays differ in length");
    for (let i = 0; i < o; i += 1) {
      if (!(g.oppA[i] < g.oppB[i]))
        problems.push(`opponent pair ${i} has a >= b`);
      if (g.oppB[i] >= n)
        problems.push(`opponent pair ${i} points past the players`);
      if (
        i > 0 &&
        !(
          g.oppA[i] > g.oppA[i - 1] ||
          (g.oppA[i] === g.oppA[i - 1] && g.oppB[i] > g.oppB[i - 1])
        )
      ) {
        problems.push(`opponent pairs not sorted at ${i}`);
      }
    }
  } else if (
    g.oppA !== undefined ||
    g.oppB !== undefined ||
    g.oppGames !== undefined
  ) {
    problems.push("opponent arrays are only partly present");
  }
  return problems;
};

test("the C-mini arrays satisfy the C-graph sort and length rules", () => {
  assert.deepEqual(graphViolations(MINI_ARRAYS), []);
  assert.equal(MINI_ARRAYS.playerIds.length, 10);
  assert.equal(MINI_ARRAYS.edgeA.length, 9);
  assert.equal(MINI_ARRAYS.spanGames.length, 9);
  assert.equal(MINI_ARRAYS.oppA?.length, 15);
  assert.equal(MINI_ARRAYS.spanStart.length, 10);
});

test("the rule check catches broken arrays", () => {
  assert.notDeepEqual(
    graphViolations({
      ...MINI_ARRAYS,
      playerIds: Uint32Array.of(12, 11, 13, 14, 15, 16, 17, 18, 19, 20),
    }),
    []
  );
  assert.notDeepEqual(
    graphViolations({
      ...MINI_ARRAYS,
      spanStart: Uint32Array.of(0, 1, 2, 3, 4, 5, 6, 7, 8),
    }),
    []
  );
  assert.notDeepEqual(
    graphViolations({
      ...MINI_ARRAYS,
      edgeA: Uint16Array.of(1, 0, 1, 2, 3, 4, 5, 6, 8),
    }),
    []
  );
  assert.notDeepEqual(
    graphViolations({
      ...MINI_ARRAYS,
      oppB: Uint16Array.of(5, 4, 8, 9, 4, 5, 6, 7, 5, 8, 9, 5, 6, 7, 5),
    }),
    []
  );
  // Two spans of one link out of (season, kind, team) order.
  assert.notDeepEqual(
    graphViolations({
      ...MINI_ARRAYS,
      edgeA: Uint16Array.of(0, 1, 2, 3, 4, 5, 6, 8),
      edgeB: Uint16Array.of(2, 3, 3, 4, 5, 6, 7, 9),
      spanStart: Uint32Array.of(0, 2, 3, 4, 5, 6, 7, 8, 9),
    }),
    []
  );
});

test("the fake store agrees with the C-mini arrays", () => {
  const store = makeMiniStore();
  const g = MINI_ARRAYS;
  // Every teammate span matches the shared games the store lists for it.
  for (let e = 0; e < g.edgeA.length; e += 1) {
    for (let i = g.spanStart[e]; i < g.spanStart[e + 1]; i += 1) {
      const games = Effect.runSync(
        store.sharedGames(
          g.playerIds[g.edgeA[e]],
          g.playerIds[g.edgeB[e]],
          g.seasonIds[g.spanSeason[i]],
          g.spanKind[i] === 3 ? 3 : 2,
          g.teamIds[g.spanTeam[i]],
          g.spanLink[i] === 1 ? "GoaliePartners" : "PlayedWith"
        )
      );
      assert.equal(games.length, g.spanGames[i], `span ${i} game count`);
      assert.equal(games[0].gameId, g.spanFirstGame[i], `span ${i} first game`);
      assert.ok(
        games.every(
          (row) =>
            row.link === (g.spanLink[i] === 1 ? "GoaliePartners" : "PlayedWith")
        ),
        `span ${i} link kind`
      );
    }
  }
  // Every opponent pair matches the opposed games, and no other pair of players has any.
  const pairs = new Map<string, number>();
  const { oppA, oppB, oppGames } = g;
  assert.ok(oppA && oppB && oppGames);
  for (let i = 0; i < oppA.length; i += 1) {
    pairs.set(`${g.playerIds[oppA[i]]}-${g.playerIds[oppB[i]]}`, oppGames[i]);
  }
  for (const a of g.playerIds) {
    for (const b of g.playerIds) {
      if (a >= b) continue;
      const games = Effect.runSync(store.opposedGames(a, b));
      assert.equal(games.length, pairs.get(`${a}-${b}`) ?? 0, `${a} v ${b}`);
    }
  }
  assert.equal(pairs.size, 15);
});

test("sharedGames lists one span by kind, and the same player twice is no pair", () => {
  const store = makeMiniStore();
  const ids = (a: number, b: number, kind: "PlayedWith" | "GoaliePartners") =>
    Effect.runSync(store.sharedGames(a, b, 19511952, 2, 3, kind)).map(
      (r) => r.gameId
    );
  assert.deepEqual(
    ids(16, 17, "GoaliePartners"),
    [1951020001, 1951020002, 1951020003]
  );
  assert.deepEqual(ids(16, 17, "PlayedWith"), []);
  assert.deepEqual(ids(17, 18, "PlayedWith"), [1951020002]);
  assert.deepEqual(ids(17, 18, "GoaliePartners"), []);
  assert.deepEqual(ids(16, 16, "PlayedWith"), []);
  assert.deepEqual(ids(16, 16, "GoaliePartners"), []);
  assert.equal(
    Effect.runSync(
      Effect.flip(store.sharedGames(99, 99, 19511952, 2, 3, "PlayedWith"))
    )._tag,
    "UnknownPlayer"
  );
});

test("the fake store follows the C-mini answers and never mentions goalie 21", () => {
  const store = makeMiniStore();
  assert.equal(store.snapshotId, MINI_SNAPSHOT_ID);
  assert.equal(store.graph.indexOf.get(16), 5);
  assert.equal(store.graph.indexOf.has(21), false);
  assert.equal(MINI_GAMES.length, 8);

  const sixteen = Effect.runSync(store.player(16));
  assert.deepEqual(sixteen.player.games, 6);
  assert.deepEqual(
    sixteen.stints.map((s) => [s.seasonId, s.gameType, s.teamId, s.games]),
    [
      [19501951, 2, 3, 2],
      [19511952, 2, 3, 2],
      [19511952, 3, 3, 2],
    ]
  );
  assert.equal(Effect.runSync(store.player(14)).player.teammates, 3);

  assert.equal(
    Effect.runSync(Effect.flip(store.player(21)))._tag,
    "UnknownPlayer"
  );
  assert.equal(
    Effect.runSync(Effect.flip(store.player(99)))._tag,
    "UnknownPlayer"
  );
  assert.equal(
    Effect.runSync(Effect.flip(store.roster(9, 19511952, 2)))._tag,
    "UnknownRoster"
  );
  assert.deepEqual(
    Effect.runSync(store.roster(3, 19511952, 3)).map((r) => r.playerId),
    [16]
  );
  assert.deepEqual(
    Effect.runSync(store.roster(3, 19511952, 2)).map((r) => r.playerId),
    [16, 17, 18]
  );
  assert.deepEqual(
    Effect.runSync(store.searchPlayers("DVORAK", 5)).map((r) => r.playerId),
    [19]
  );
  assert.deepEqual(
    Effect.runSync(store.searchPlayers("goalie", 5)).map((r) => r.playerId),
    [16, 17]
  );
  assert.deepEqual(Effect.runSync(store.searchPlayers("", 5)), []);

  // Opponents of 16, most games first: 14 (4), 12 (3), 11 (2), 15 (2), 13 (1).
  const opponents = Effect.runSync(
    Effect.forEach([11, 12, 13, 14, 15], (id) => store.opposedGames(16, id))
  );
  assert.deepEqual(
    opponents.map((games) => games.length),
    [2, 3, 1, 4, 2]
  );
  // 15 and 16 are teammates (game A, B) and opponents (G, H).
  assert.deepEqual(
    Effect.runSync(store.sharedGames(15, 16, 19501951, 2, 3, "PlayedWith")).map(
      (r) => r.gameId
    ),
    [1950020001, 1950020002]
  );
  assert.deepEqual(
    Effect.runSync(store.opposedGames(15, 16)).map((r) => r.gameId),
    [1951030111, 1951030112]
  );

  // Games G and H stand in for the 1951-52 Final.
  assert.deepEqual(Effect.runSync(store.finals(1950, 1951)), []);
  const [final] = Effect.runSync(store.finals(1952, 1952));
  assert.equal(final.year, 1952);
  assert.deepEqual(final.gameIds, [1951030111, 1951030112]);
  assert.deepEqual(
    final.participants.map((p) => p.playerId),
    [14, 15, 16]
  );
});
