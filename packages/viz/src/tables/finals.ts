// Stanley Cup Finals coverage for one player (FT6): one row per Final year, plus the teammates who matched.

import { finalsCoverage } from "@nhl-reddit-stats/history";
import type {
  HistoryStore,
  HistoryUnavailable,
  TeammateGraph,
  UnknownPlayer,
} from "@nhl-reddit-stats/history";
import { Array, Effect, Match } from "effect";

import type { FinalsRow, FinalsTables, PlayerRow } from "../contracts.ts";

const NOTES =
  "finals: One row per Final year, with a teammate who played in it, a Final game, and a game they shared; empty IDs where no teammate played. " +
  "players: The teammates named in finals.";

/**
 * The Final years in `fromYear..toYear` for `playerId`, one `finals` row each, and a `players` row for every
 * teammate who matched. A miss has `covered` 0 and null IDs.
 */
export const finals = (
  graph: TeammateGraph,
  store: HistoryStore,
  playerId: number,
  fromYear: number,
  toYear: number
): Effect.Effect<
  { readonly tables: FinalsTables; readonly notes: string },
  UnknownPlayer | HistoryUnavailable
> =>
  Effect.gen(function* () {
    const years = yield* finalsCoverage(
      graph,
      store,
      playerId,
      fromYear,
      toYear
    );
    const rows: FinalsRow[] = years.map((year) =>
      Match.valueTags(year, {
        Hit: (hit): FinalsRow => ({
          year: hit.year,
          seasonId: hit.seasonId,
          covered: 1,
          playerId: hit.playerId,
          finalGameId: hit.finalGameId,
          sharedGameId: hit.sharedGameId,
        }),
        Miss: (miss): FinalsRow => ({
          year: miss.year,
          seasonId: miss.seasonId,
          covered: 0,
          playerId: null,
          finalGameId: null,
          sharedGameId: null,
        }),
      })
    );
    const matched = Array.dedupe(
      Array.flatMapNullishOr(rows, (row) => row.playerId)
    );
    const players: PlayerRow[] = yield* Effect.forEach(matched, (teammateId) =>
      Effect.map(store.player(teammateId), ({ player }) => ({
        playerId: player.playerId,
        name: player.name,
        position: player.position,
        firstSeason: player.firstSeason,
        lastSeason: player.lastSeason,
        games: player.games,
      }))
    );
    return { tables: { finals: rows, players }, notes: NOTES };
  });
