import type { Effect } from 'effect'
import type { HistoryUnavailable, UnknownPlayer, UnknownRoster } from './contracts.ts'
import type {
  FinalRow, GameType, Graph, OpposedGameRow, PlayerDetail, PlayerRow, RosterRow, SharedGameRow,
} from './shapes.ts'

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
  readonly snapshotId: string
  readonly graph: Graph
  /** Substring match on `search_name` against the accent-folded, lower-cased query; most games first, then lower ID. */
  readonly searchPlayers: (query: string, limit: number) => Effect.Effect<ReadonlyArray<PlayerRow>, HistoryUnavailable>
  /** Stints are ordered by season, game type, team. */
  readonly player: (playerId: number) => Effect.Effect<PlayerDetail, HistoryUnavailable | UnknownPlayer>
  /** Most games first, then lower ID. An empty roster is `UnknownRoster`. */
  readonly roster: (
    teamId: number, seasonId: number, gameType: GameType,
  ) => Effect.Effect<ReadonlyArray<RosterRow>, HistoryUnavailable | UnknownRoster>
  /** Games both were on the team's box score for the span, oldest first. */
  readonly sharedGames: (
    a: number, b: number, seasonId: number, gameType: GameType, teamId: number,
  ) => Effect.Effect<ReadonlyArray<SharedGameRow>, HistoryUnavailable | UnknownPlayer>
  /** Every game on opposite sides, oldest first. */
  readonly opposedGames: (
    a: number, b: number,
  ) => Effect.Effect<ReadonlyArray<OpposedGameRow>, HistoryUnavailable | UnknownPlayer>
  /** The Finals whose year is in range, ascending. */
  readonly finals: (fromYear: number, toYear: number) => Effect.Effect<ReadonlyArray<FinalRow>, HistoryUnavailable>
}
