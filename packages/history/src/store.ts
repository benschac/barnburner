import type { Effect } from "effect";

import type {
  HistoryUnavailable,
  UnknownPlayer,
  UnknownRoster,
} from "./contracts.ts";
import type {
  FinalRow,
  GameType,
  Graph,
  LinkKind,
  OpposedGameRow,
  PlayerDetail,
  PlayerRow,
  RosterRow,
  SharedGameRow,
} from "./shapes.ts";

/**
 * Storage port over the serving database (C-store). The SQLite store (A1) and the in-memory fake
 * implement it.
 *
 * Consistency choice: `snapshotId` and `graph` are plain values, loaded when the store opens, so a
 * missing or corrupt file fails once at layer construction. Every query is an `Effect` that can
 * fail with `HistoryUnavailable`, and with a lookup error where the ID may not exist. A pair
 * lookup with no result (no shared games) succeeds with an empty array, not an error.
 */
export type HistoryStore = {
  readonly snapshotId: string;
  readonly graph: Graph;
  /** Substring match on `search_name` against the accent-folded, lower-cased query; most games first, then lower ID. */
  readonly searchPlayers: (
    query: string,
    limit: number
  ) => Effect.Effect<readonly PlayerRow[], HistoryUnavailable>;
  /** The rows of the given players in one read, in no set order. An ID the file does not hold is left out. */
  readonly players: (
    playerIds: readonly number[]
  ) => Effect.Effect<readonly PlayerRow[], HistoryUnavailable>;
  /** Stints are ordered by season, game type, team. */
  readonly player: (
    playerId: number
  ) => Effect.Effect<PlayerDetail, HistoryUnavailable | UnknownPlayer>;
  /** Most games first, then lower ID. An empty roster is `UnknownRoster`. */
  readonly roster: (
    teamId: number,
    seasonId: number,
    gameType: GameType
  ) => Effect.Effect<readonly RosterRow[], HistoryUnavailable | UnknownRoster>;
  /**
   * Games of one span of the pair, oldest first. `PlayedWith`: both have an `appearances` row for the team
   * in that season and game type. `GoaliePartners`: both are on the team's `dressed_goalies` rows for the
   * game and not both credited; a file without that table returns an empty list. The same ID twice is not a
   * pair: an empty list, never the player's own games.
   */
  readonly sharedGames: (
    a: number,
    b: number,
    seasonId: number,
    gameType: GameType,
    teamId: number,
    link: LinkKind
  ) => Effect.Effect<
    readonly SharedGameRow[],
    HistoryUnavailable | UnknownPlayer
  >;
  /** Every game on opposite sides, oldest first. */
  readonly opposedGames: (
    a: number,
    b: number
  ) => Effect.Effect<
    readonly OpposedGameRow[],
    HistoryUnavailable | UnknownPlayer
  >;
  /** The Finals whose year is in range, ascending. */
  readonly finals: (
    fromYear: number,
    toYear: number
  ) => Effect.Effect<readonly FinalRow[], HistoryUnavailable>;
};
