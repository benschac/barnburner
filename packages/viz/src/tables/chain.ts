import type {
  NoPath,
  UnknownPlayer,
  UnsupportedFilter,
} from "@nhl-reddit-stats/history/contracts";
import { HistoryUnavailable } from "@nhl-reddit-stats/history/contracts";
import type { TeammateGraph } from "@nhl-reddit-stats/history/graph";
import { findPaths } from "@nhl-reddit-stats/history/paths";
import type {
  GameType,
  Hop,
  StintRow,
  TeammateHop,
  PlayerDetail,
} from "@nhl-reddit-stats/history/shapes";
import { DEFAULT_FILTER } from "@nhl-reddit-stats/history/shapes";
import type { HistoryStore } from "@nhl-reddit-stats/history/store";
import { Array, Effect, Match, Order } from "effect";

import type {
  ChainHopRow,
  ChainSummaryRow,
  ChainTables,
  PlayerRow,
  TeamRow,
} from "../contracts.ts";

// `chain` (plan section FT, FT1): the shortest teammate chains from one player to another, under the
// default filter with the 'with' relation, listed in D6 order and capped at ten chains. Pure over the
// teammate graph and the store; the result matches `chainSample` in `src/samples.ts`.

/** Chains listed. `summary.pathCount` still counts every tied chain. */
const CHAIN_LIMIT = 10;

const NOTES =
  "players: The players on the chains, by player ID. " +
  "teams: The clubs the hops were played for. " +
  "hops: Every hop of every chain, in preference order, with chain and step counted from 0. " +
  "summary: The distance and the number of tied chains.";

/** The view a chain builder returns: its tables and the one-sentence notes for each table. */
export type ChainView = {
  readonly tables: ChainTables;
  readonly notes: string;
};

/** `relation: 'with'` only yields teammate hops; the other tags are handled for the type. */
const teammateHop = (hop: Hop): TeammateHop =>
  Match.valueTags(hop, {
    PlayedWith: (h) => h,
    GoaliePartners: (h) => h,
    PlayedAgainst: () => {
      // defect: relation 'with' never returns a PlayedAgainst hop
      throw new Error("chain: unexpected PlayedAgainst hop for relation with");
    },
  });

const playerRow = ({ player }: PlayerDetail): PlayerRow => ({
  playerId: player.playerId,
  name: player.name,
  position: player.position,
  firstSeason: player.firstSeason,
  lastSeason: player.lastSeason,
  games: player.games,
});

/**
 * The club's name from the store's roster for the hop's team, season, and game type: the first rostered
 * player with a stint for that club. A goalie-partner hop can have no chain player with a credited game
 * for the club, so the roster is the fallback.
 */
const clubFromRoster = (
  store: HistoryStore,
  teamId: number,
  seasonId: number,
  gameType: GameType
): Effect.Effect<TeamRow, HistoryUnavailable | UnknownPlayer> =>
  Effect.gen(function* () {
    const roster = yield* store.roster(teamId, seasonId, gameType).pipe(
      Effect.catchTag("UnknownRoster", () =>
        Effect.fail(
          new HistoryUnavailable({
            message: `No roster on record for team ${teamId}.`,
          })
        )
      )
    );
    // loop: stops at the first rostered player with a stint for the club, so later players are never fetched
    for (const row of roster) {
      const detail = yield* store.player(row.playerId);
      const stint = detail.stints.find(
        (s) =>
          s.teamId === teamId &&
          s.seasonId === seasonId &&
          s.gameType === gameType
      );
      if (stint !== undefined)
        return { teamId, abbrev: stint.teamAbbrev, name: stint.teamName };
    }
    return yield* new HistoryUnavailable({
      message: `No stint on record for team ${teamId} in season ${seasonId}.`,
    });
  });

/** The club's name from a chain player's stint on that team; the store's roster when no chain player has one. */
const teamRow = (
  store: HistoryStore,
  hop: ChainHopRow,
  stints: readonly StintRow[]
): Effect.Effect<TeamRow, HistoryUnavailable | UnknownPlayer> =>
  Effect.gen(function* () {
    const stint = stints.find((s) => s.teamId === hop.teamId);
    if (stint !== undefined)
      return {
        teamId: hop.teamId,
        abbrev: stint.teamAbbrev,
        name: stint.teamName,
      };
    return yield* clubFromRoster(store, hop.teamId, hop.seasonId, hop.gameType);
  });

/**
 * The shortest chains from `from` to `to`, teammates only, default filter. Unknown players, no path,
 * and store failures come back as tagged errors.
 */
export const chain = (
  graph: TeammateGraph,
  store: HistoryStore,
  from: number,
  to: number
): Effect.Effect<
  ChainView,
  UnknownPlayer | NoPath | UnsupportedFilter | HistoryUnavailable
> =>
  Effect.gen(function* () {
    const found = yield* Effect.fromResult(
      findPaths(graph, from, to, DEFAULT_FILTER, "with", CHAIN_LIMIT)
    );
    const chains = found.paths.map((path) => path.map(teammateHop));
    const hops: ChainHopRow[] = chains.flatMap((path, chainIndex) =>
      path.map((hop, step) => ({
        chain: chainIndex,
        step,
        from: hop.from,
        to: hop.to,
        kind: hop._tag,
        games: hop.games,
        teamId: hop.teamId,
        seasonId: hop.seasonId,
        gameType: hop.gameType,
        gameId: hop.gameId,
      }))
    );

    const playerIds = Array.sort(
      Array.dedupe([from, to, ...Array.flatMap(hops, (h) => [h.from, h.to])]),
      Order.Number
    );
    const details = yield* Effect.forEach(playerIds, (playerId) =>
      store.player(playerId)
    );
    const stints = details.flatMap((detail) => detail.stints);

    // One hop per club, for the season and game type the roster lookup needs.
    const clubHops = Array.sortWith(
      new Map(Array.map(hops, (h) => [h.teamId, h] as const)).values(),
      (h) => h.teamId,
      Order.Number
    );
    const teams = yield* Effect.forEach(clubHops, (hop) =>
      teamRow(store, hop, stints)
    );

    const summary: ChainSummaryRow[] = [
      {
        from,
        to,
        distance: found.distance,
        pathCount: found.pathCount,
        pathCountCapped: found.pathCountCapped ? 1 : 0,
      },
    ];

    return {
      tables: { players: details.map(playerRow), teams, hops, summary },
      notes: NOTES,
    };
  });
