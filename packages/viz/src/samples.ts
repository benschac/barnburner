import type {
  ChainTables,
  EgoTables,
  FinalsTables,
  LeagueTables,
  OpponentsTables,
  PairTables,
  PlayerRow,
} from "./contracts.ts";

// The six samples of plan section C-viz, written by hand from section C-mini (the shared test league:
// players 11-20, teams 1-4, eight games) with names from packages/history/tests/fakes.ts. Season IDs
// are 19501951 and 19511952. Every web card develops against these; every table builder is tested
// against them. Goalie 21 is dressed in one game and credited in none, so he appears nowhere.

type Sample<Tables> = { readonly tables: Tables; readonly notes: string };

const TEAMS = [
  { teamId: 1, abbrev: "AAA", name: "Alpha Club" },
  { teamId: 2, abbrev: "BBB", name: "Bravo Club" },
  { teamId: 3, abbrev: "CCC", name: "Charlie Club" },
  { teamId: 4, abbrev: "DDD", name: "Delta Club" },
] as const;

const P11: PlayerRow = {
  playerId: 11,
  name: "Player Eleven",
  position: "C",
  firstSeason: 19501951,
  lastSeason: 19501951,
  games: 3,
};
const P12: PlayerRow = {
  playerId: 12,
  name: "Player Twelve",
  position: "L",
  firstSeason: 19501951,
  lastSeason: 19511952,
  games: 4,
};
const P13: PlayerRow = {
  playerId: 13,
  name: "Player Thirteen",
  position: "R",
  firstSeason: 19501951,
  lastSeason: 19511952,
  games: 2,
};
const P14: PlayerRow = {
  playerId: 14,
  name: "Player Fourteen",
  position: "D",
  firstSeason: 19511952,
  lastSeason: 19511952,
  games: 5,
};
const P15: PlayerRow = {
  playerId: 15,
  name: "Player Fifteen",
  position: "C",
  firstSeason: 19501951,
  lastSeason: 19511952,
  games: 4,
};
const P16: PlayerRow = {
  playerId: 16,
  name: "Goalie Sixteen",
  position: "G",
  firstSeason: 19501951,
  lastSeason: 19511952,
  games: 6,
};
const P17: PlayerRow = {
  playerId: 17,
  name: "Goalie Seventeen",
  position: "G",
  firstSeason: 19511952,
  lastSeason: 19511952,
  games: 1,
};
const P18: PlayerRow = {
  playerId: 18,
  name: "Player Eighteen",
  position: "D",
  firstSeason: 19511952,
  lastSeason: 19511952,
  games: 1,
};
const P19: PlayerRow = {
  playerId: 19,
  name: "Jaromír Dvořák",
  position: "L",
  firstSeason: 19501951,
  lastSeason: 19501951,
  games: 1,
};
const P20: PlayerRow = {
  playerId: 20,
  name: "Player Twenty",
  position: "R",
  firstSeason: 19501951,
  lastSeason: 19501951,
  games: 1,
};

/** `chain`: 11 to 14, default filter, limit 10. Distance 2 with two tied chains; 11-12-14 comes first (2 games beats 1). */
export const chainSample: Sample<ChainTables> = {
  tables: {
    players: [P11, P12, P13, P14],
    teams: [TEAMS[0], TEAMS[1]],
    hops: [
      {
        chain: 0,
        step: 0,
        from: 11,
        to: 12,
        kind: "PlayedWith",
        games: 2,
        teamId: 1,
        seasonId: 19501951,
        gameType: 2,
        gameId: 1950020001,
      },
      {
        chain: 0,
        step: 1,
        from: 12,
        to: 14,
        kind: "PlayedWith",
        games: 2,
        teamId: 2,
        seasonId: 19511952,
        gameType: 2,
        gameId: 1951020001,
      },
      {
        chain: 1,
        step: 0,
        from: 11,
        to: 13,
        kind: "PlayedWith",
        games: 1,
        teamId: 1,
        seasonId: 19501951,
        gameType: 2,
        gameId: 1950020003,
      },
      {
        chain: 1,
        step: 1,
        from: 13,
        to: 14,
        kind: "PlayedWith",
        games: 1,
        teamId: 2,
        seasonId: 19511952,
        gameType: 2,
        gameId: 1951020003,
      },
    ],
    summary: [
      { from: 11, to: 14, distance: 2, pathCount: 2, pathCountCapped: 0 },
    ],
  },
  notes:
    "players: The players on the chains, by player ID. " +
    "teams: The clubs the hops were played for. " +
    "hops: Every hop of every chain, in preference order, with chain and step counted from 0. " +
    "summary: The distance and the number of tied chains.",
};

/** `pair`: players 15 and 16. Teammates in 1950-51 for two games; opponents in two playoff games. */
export const pairSample: Sample<PairTables> = {
  tables: {
    players: [P15, P16],
    teams: [TEAMS[2]],
    spans: [
      {
        seasonId: 19501951,
        gameType: 2,
        teamId: 3,
        link: "PlayedWith",
        games: 2,
        firstGameId: 1950020001,
      },
    ],
    summary: [{ a: 15, b: 16, totalGames: 2, opposedGames: 2 }],
  },
  notes:
    "players: The two players. " +
    "teams: The clubs they shared. " +
    "spans: Each season, competition, and club in which they played together. " +
    "summary: Their games together and their games on opposite sides.",
};

/** `ego`: player 14, the focus, with teammates 12, 13, and 15 and the three links among them. */
export const egoSample: Sample<EgoTables> = {
  tables: {
    focus: [{ playerId: 14 }],
    players: [
      { ...P12, gamesWithFocus: 2 },
      { ...P13, gamesWithFocus: 1 },
      { ...P14, gamesWithFocus: 0 },
      { ...P15, gamesWithFocus: 2 },
    ],
    links: [
      { a: 12, b: 14, games: 2, firstSeason: 19511952, lastSeason: 19511952 },
      { a: 13, b: 14, games: 1, firstSeason: 19511952, lastSeason: 19511952 },
      { a: 14, b: 15, games: 2, firstSeason: 19511952, lastSeason: 19511952 },
    ],
  },
  notes:
    "focus: The player at the centre. " +
    "players: The focus player and every teammate, with games played together. " +
    "links: Every teammate link among those players.",
};

/** `league`: the whole shared test league, ten players and nine links (16-17 is the goalie-partner link). */
export const leagueSample: Sample<LeagueTables> = {
  tables: {
    players: [
      { ...P11, teammates: 2 },
      { ...P12, teammates: 2 },
      { ...P13, teammates: 2 },
      { ...P14, teammates: 3 },
      { ...P15, teammates: 2 },
      { ...P16, teammates: 2 },
      { ...P17, teammates: 2 },
      { ...P18, teammates: 1 },
      { ...P19, teammates: 1 },
      { ...P20, teammates: 1 },
    ],
    links: [
      { a: 11, b: 12, games: 2, firstSeason: 19501951 },
      { a: 11, b: 13, games: 1, firstSeason: 19501951 },
      { a: 12, b: 14, games: 2, firstSeason: 19511952 },
      { a: 13, b: 14, games: 1, firstSeason: 19511952 },
      { a: 14, b: 15, games: 2, firstSeason: 19511952 },
      { a: 15, b: 16, games: 2, firstSeason: 19501951 },
      { a: 16, b: 17, games: 3, firstSeason: 19511952 },
      { a: 17, b: 18, games: 1, firstSeason: 19511952 },
      { a: 19, b: 20, games: 1, firstSeason: 19501951 },
    ],
  },
  notes:
    "players: Every player, with the number of teammates each has. " +
    "links: Every teammate link, with its games together and the first season.",
};

/** `opponents`: players 16 and 12, in that order. Each list is most games first, then lower ID. */
export const opponentsSample: Sample<OpponentsTables> = {
  tables: {
    players: [P11, P12, P13, P14, P15, P16, P17, P18],
    faced: [
      { focus: 16, opponent: 14, games: 4 },
      { focus: 16, opponent: 12, games: 3 },
      { focus: 16, opponent: 11, games: 2 },
      { focus: 16, opponent: 15, games: 2 },
      { focus: 16, opponent: 13, games: 1 },
      { focus: 12, opponent: 16, games: 3 },
      { focus: 12, opponent: 15, games: 2 },
      { focus: 12, opponent: 17, games: 1 },
      { focus: 12, opponent: 18, games: 1 },
    ],
  },
  notes:
    "players: The two players asked about and every opponent of either. " +
    "faced: The opponents of each player, most games first, then lower player ID.",
};

/** `finals`: player 12, 1900 to 2100. The test league has one Final, 1952, and teammate 14 played in it. */
export const finalsSample: Sample<FinalsTables> = {
  tables: {
    finals: [
      {
        year: 1952,
        seasonId: 19511952,
        covered: 1,
        playerId: 14,
        finalGameId: 1951030111,
        sharedGameId: 1951020001,
      },
    ],
    players: [P14],
  },
  notes:
    "finals: One row per Final year, with a teammate who played in it, a Final game, and a game they shared; empty IDs where no teammate played. " +
    "players: The teammates named in finals.",
};

export const samples = {
  chain: chainSample,
  pair: pairSample,
  ego: egoSample,
  league: leagueSample,
  opponents: opponentsSample,
  finals: finalsSample,
} as const;
