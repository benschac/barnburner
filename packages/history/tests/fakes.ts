import { Array, Effect, Order } from "effect";

import { UnknownPlayer, UnknownRoster } from "../src/contracts.ts";
import { makeGraph } from "../src/graph.ts";
import type { TeammateGraph } from "../src/graph.ts";
import type {
  FinalParticipant,
  FinalRow,
  GameType,
  GraphArrays,
  LinkKind,
  OpposedGameRow,
  PlayerDetail,
  PlayerRow,
  Position,
  RosterRow,
  SharedGameRow,
  StintRow,
} from "../src/shapes.ts";
import type { HistoryStore } from "../src/store.ts";

// The shared test league from plan section C-mini: players 11-20, teams 1-4, eight games.

/**
 * Players are 11..20 in index order 0..9; seasons 19501951, 19511952 are 0, 1; teams 1..4 are 0..3.
 * Links in (a, b) order: 11-12, 11-13, 12-14, 13-14, 14-15, 15-16, 16-17, 17-18, 19-20.
 * Only 16-17 is a goalie-partner span (3 games, first game E). Opponent pairs are the 15 of C-mini.
 */
/** The opponent arrays of C-mini, defined apart so tests can read them without optional access. */
export const MINI_OPPONENTS = {
  oppA: Uint16Array.of(0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 3, 3, 3, 4),
  oppB: Uint16Array.of(4, 5, 8, 9, 4, 5, 6, 7, 5, 8, 9, 5, 6, 7, 5),
  oppGames: Uint16Array.of(2, 2, 1, 1, 2, 3, 1, 1, 1, 1, 1, 4, 1, 1, 2),
};

export const MINI_ARRAYS: GraphArrays = {
  playerIds: Uint32Array.of(11, 12, 13, 14, 15, 16, 17, 18, 19, 20),
  seasonIds: Uint32Array.of(19501951, 19511952),
  teamIds: Uint32Array.of(1, 2, 3, 4),
  edgeA: Uint16Array.of(0, 0, 1, 2, 3, 4, 5, 6, 8),
  edgeB: Uint16Array.of(1, 2, 3, 3, 4, 5, 6, 7, 9),
  spanStart: Uint32Array.of(0, 1, 2, 3, 4, 5, 6, 7, 8, 9),
  spanSeason: Uint8Array.of(0, 0, 1, 1, 1, 0, 1, 1, 0),
  spanKind: Uint8Array.of(2, 2, 2, 2, 3, 2, 2, 2, 2),
  spanTeam: Uint8Array.of(0, 0, 1, 1, 1, 2, 2, 2, 3),
  spanLink: Uint8Array.of(0, 0, 0, 0, 0, 0, 1, 0, 0),
  spanGames: Uint16Array.of(2, 1, 2, 1, 2, 2, 3, 1, 1),
  spanFirstGame: Uint32Array.of(
    1950020001,
    1950020003,
    1951020001,
    1951020003,
    1951030111,
    1950020001,
    1951020001,
    1951020002,
    1950020003
  ),
  ...MINI_OPPONENTS,
};

export const MINI_GRAPH: TeammateGraph = makeGraph(MINI_ARRAYS);

export const MINI_SNAPSHOT_ID = "0123456789ab";

type MiniSide = {
  readonly teamId: number;
  readonly credited: ReadonlyArray<number>;
  /** On the box score with no credit. Only goalies are dressed in the league. */
  readonly dressed: ReadonlyArray<number>;
};
type MiniGame = {
  readonly gameId: number;
  readonly seasonId: number;
  readonly gameType: GameType;
  readonly gameDate: string;
  readonly sides: readonly [MiniSide, MiniSide];
};

// Games are dated in the order C-mini lists them (A, B, C, E, D, F, G, H). Goalie 21 is dressed for
// team 3 in game G and has no credited game anywhere, so no output may mention him.
const side = (
  teamId: number,
  credited: ReadonlyArray<number>,
  dressed: ReadonlyArray<number> = []
): MiniSide => ({
  teamId,
  credited,
  dressed,
});
export const MINI_GAMES: ReadonlyArray<MiniGame> = [
  {
    gameId: 1950020001,
    seasonId: 19501951,
    gameType: 2,
    gameDate: "1950-10-11",
    sides: [side(1, [11, 12]), side(3, [15, 16])],
  },
  {
    gameId: 1950020002,
    seasonId: 19501951,
    gameType: 2,
    gameDate: "1950-10-13",
    sides: [side(1, [11, 12]), side(3, [15, 16])],
  },
  {
    gameId: 1950020003,
    seasonId: 19501951,
    gameType: 2,
    gameDate: "1950-10-15",
    sides: [side(1, [11, 13]), side(4, [19, 20])],
  },
  {
    gameId: 1951020001,
    seasonId: 19511952,
    gameType: 2,
    gameDate: "1951-10-10",
    sides: [side(2, [12, 14]), side(3, [16], [17])],
  },
  {
    gameId: 1951020002,
    seasonId: 19511952,
    gameType: 2,
    gameDate: "1951-10-12",
    sides: [side(2, [12, 14]), side(3, [17, 18], [16])],
  },
  {
    gameId: 1951020003,
    seasonId: 19511952,
    gameType: 2,
    gameDate: "1951-10-14",
    sides: [side(2, [13, 14]), side(3, [16], [17])],
  },
  {
    gameId: 1951030111,
    seasonId: 19511952,
    gameType: 3,
    gameDate: "1952-04-02",
    sides: [side(2, [14, 15]), side(3, [16], [21])],
  },
  {
    gameId: 1951030112,
    seasonId: 19511952,
    gameType: 3,
    gameDate: "1952-04-04",
    sides: [side(2, [14, 15]), side(3, [16])],
  },
];

const TEAMS: ReadonlyMap<
  number,
  { readonly abbrev: string; readonly name: string }
> = new Map([
  [1, { abbrev: "AAA", name: "Alpha Club" }],
  [2, { abbrev: "BBB", name: "Bravo Club" }],
  [3, { abbrev: "CCC", name: "Charlie Club" }],
  [4, { abbrev: "DDD", name: "Delta Club" }],
]);

const PEOPLE: ReadonlyMap<
  number,
  {
    readonly name: string;
    readonly position: Position;
    readonly points: number;
  }
> = new Map([
  [11, { name: "Player Eleven", position: "C", points: 5 }],
  [12, { name: "Player Twelve", position: "L", points: 3 }],
  [13, { name: "Player Thirteen", position: "R", points: 1 }],
  [14, { name: "Player Fourteen", position: "D", points: 2 }],
  [15, { name: "Player Fifteen", position: "C", points: 4 }],
  [16, { name: "Goalie Sixteen", position: "G", points: 0 }],
  [17, { name: "Goalie Seventeen", position: "G", points: 0 }],
  [18, { name: "Player Eighteen", position: "D", points: 0 }],
  // Accented on purpose, to exercise accent-folded search.
  [19, { name: "Jaromír Dvořák", position: "L", points: 1 }],
  [20, { name: "Player Twenty", position: "R", points: 2 }],
]);

const foldName = (name: string): string =>
  name.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

const creditedIds = (game: MiniGame): ReadonlyArray<number> =>
  game.sides.flatMap((s) => s.credited);
const isGoalie = (playerId: number): boolean =>
  PEOPLE.get(playerId)?.position === "G";

/** The players table: only players with a credited game, as in the real build. */
const playerRows: ReadonlyMap<number, PlayerRow> = (() => {
  const teammates = new Map<number, number>();
  for (let e = 0; e < MINI_ARRAYS.edgeA.length; e += 1) {
    for (const index of [MINI_ARRAYS.edgeA[e], MINI_ARRAYS.edgeB[e]]) {
      const id = MINI_ARRAYS.playerIds[index];
      teammates.set(id, (teammates.get(id) ?? 0) + 1);
    }
  }
  const rows = new Map<number, PlayerRow>();
  for (const [playerId, person] of PEOPLE) {
    const played = MINI_GAMES.filter((g) => creditedIds(g).includes(playerId));
    if (played.length === 0) continue;
    rows.set(playerId, {
      playerId,
      name: person.name,
      searchName: foldName(person.name),
      position: person.position,
      firstSeason: Math.min(...played.map((g) => g.seasonId)),
      lastSeason: Math.max(...played.map((g) => g.seasonId)),
      games: played.length,
      points: person.points,
      teammates: teammates.get(playerId) ?? 0,
    });
  }
  return rows;
})();

/** Most games first; the tie-break is the lowest player ID. */
const byGamesThenPlayer: Order.Order<{
  readonly games: number;
  readonly playerId: number;
}> = Order.combine(
  Order.mapInput(
    Order.flip(Order.Number),
    (row: { readonly games: number; readonly playerId: number }) => row.games
  ),
  Order.mapInput(
    Order.Number,
    (row: { readonly games: number; readonly playerId: number }) => row.playerId
  )
);

const stintsOf = (playerId: number): ReadonlyArray<StintRow> => {
  const stints = new Map<string, StintRow>();
  for (const game of MINI_GAMES) {
    for (const s of game.sides) {
      if (!s.credited.includes(playerId)) continue;
      const key = `${game.seasonId}/${game.gameType}/${s.teamId}`;
      const team = TEAMS.get(s.teamId);
      const previous = stints.get(key);
      stints.set(key, {
        seasonId: game.seasonId,
        gameType: game.gameType,
        teamId: s.teamId,
        teamAbbrev: team?.abbrev ?? "",
        teamName: team?.name ?? "",
        games: (previous?.games ?? 0) + 1,
        firstGameId: previous?.firstGameId ?? game.gameId,
        lastGameId: game.gameId,
      });
    }
  }
  return Array.sortBy(
    Order.mapInput(Order.Number, (stint: StintRow) => stint.seasonId),
    Order.mapInput(Order.Number, (stint: StintRow) => stint.gameType),
    Order.mapInput(Order.Number, (stint: StintRow) => stint.teamId)
  )([...stints.values()]);
};

const finalRows: ReadonlyArray<FinalRow> = (() => {
  // The fake has no playoff rounds worth ranking: games G and H (round 1, playoff) are treated as
  // the 1951-52 Final, so the Final of year 1952 is those two games.
  const bySeason = new Map<number, MiniGame[]>();
  for (const game of MINI_GAMES.filter((g) => g.gameType === 3)) {
    bySeason.set(game.seasonId, [...(bySeason.get(game.seasonId) ?? []), game]);
  }
  const finals = [...bySeason.entries()].map(([seasonId, games]) => {
    const participants = new Map<number, FinalParticipant>();
    for (const game of games) {
      for (const s of game.sides) {
        for (const playerId of s.credited) {
          if (!participants.has(playerId))
            participants.set(playerId, {
              playerId,
              teamId: s.teamId,
              firstGameId: game.gameId,
            });
        }
      }
    }
    return {
      year: seasonId % 10000,
      seasonId,
      gameIds: games.map((g) => g.gameId),
      participants: Array.sortWith(
        [...participants.values()],
        (participant) => participant.playerId,
        Order.Number
      ),
    };
  });
  return Array.sortWith(finals, (final) => final.year, Order.Number);
})();

export const makeMiniStore = (): HistoryStore => {
  const known = (playerId: number) => playerRows.has(playerId);
  return {
    snapshotId: MINI_SNAPSHOT_ID,
    graph: MINI_GRAPH,
    searchPlayers: (query, limit) => {
      const needle = foldName(query.trim());
      const matches = Array.sort(
        [...playerRows.values()].filter(
          (row) => needle.length > 0 && row.searchName.includes(needle)
        ),
        byGamesThenPlayer
      );
      return Effect.succeed(matches.slice(0, limit));
    },
    player: (playerId) => {
      const player = playerRows.get(playerId);
      return player === undefined
        ? Effect.fail(new UnknownPlayer({ playerId }))
        : Effect.succeed<PlayerDetail>({ player, stints: stintsOf(playerId) });
    },
    roster: (teamId, seasonId, gameType) => {
      const rows: RosterRow[] = [];
      for (const row of playerRows.values()) {
        const stint = stintsOf(row.playerId).find(
          (s) =>
            s.teamId === teamId &&
            s.seasonId === seasonId &&
            s.gameType === gameType
        );
        if (stint !== undefined) {
          rows.push({
            playerId: row.playerId,
            name: row.name,
            position: row.position,
            games: stint.games,
          });
        }
      }
      return rows.length === 0
        ? Effect.fail(new UnknownRoster({ teamId, seasonId, gameType }))
        : Effect.succeed(Array.sort(rows, byGamesThenPlayer));
    },
    sharedGames: (a, b, seasonId, gameType, teamId, requested) => {
      const missing = [a, b].find((id) => !known(id));
      if (missing !== undefined)
        return Effect.fail(new UnknownPlayer({ playerId: missing }));
      // The same ID twice is not a pair.
      if (a === b) return Effect.succeed([]);
      const rows: SharedGameRow[] = [];
      for (const game of MINI_GAMES) {
        if (game.seasonId !== seasonId || game.gameType !== gameType) continue;
        for (const s of game.sides) {
          if (s.teamId !== teamId) continue;
          const onBox = [...s.credited, ...s.dressed];
          if (!onBox.includes(a) || !onBox.includes(b)) continue;
          const bothCredited = s.credited.includes(a) && s.credited.includes(b);
          const link: LinkKind | null = bothCredited
            ? "PlayedWith"
            : isGoalie(a) && isGoalie(b)
              ? "GoaliePartners"
              : null;
          if (link === requested)
            rows.push({ gameId: game.gameId, gameDate: game.gameDate, link });
        }
      }
      return Effect.succeed(rows);
    },
    opposedGames: (a, b) => {
      const missing = [a, b].find((id) => !known(id));
      if (missing !== undefined)
        return Effect.fail(new UnknownPlayer({ playerId: missing }));
      const rows: OpposedGameRow[] = [];
      for (const game of MINI_GAMES) {
        const [x, y] = game.sides;
        if (x.credited.includes(a) && y.credited.includes(b)) {
          rows.push({
            gameId: game.gameId,
            gameDate: game.gameDate,
            aTeamId: x.teamId,
            bTeamId: y.teamId,
          });
        } else if (y.credited.includes(a) && x.credited.includes(b)) {
          rows.push({
            gameId: game.gameId,
            gameDate: game.gameDate,
            aTeamId: y.teamId,
            bTeamId: x.teamId,
          });
        }
      }
      return Effect.succeed(rows);
    },
    finals: (fromYear, toYear) =>
      Effect.succeed(
        finalRows.filter((f) => f.year >= fromYear && f.year <= toYear)
      ),
  };
};
