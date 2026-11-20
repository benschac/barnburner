import type {
  HistoryUnavailable,
  UnknownPlayer,
} from "@nhl-reddit-stats/history/contracts";
import type { TeammateGraph } from "@nhl-reddit-stats/history/graph";
import { link } from "@nhl-reddit-stats/history/graph";
import { DEFAULT_FILTER } from "@nhl-reddit-stats/history/shapes";
import type { HistoryStore } from "@nhl-reddit-stats/history/store";
import { Array, Effect, Order } from "effect";

import type { EgoLinkRow, EgoPlayerRow, EgoTables } from "../contracts.ts";

const linkOf = (graph: TeammateGraph, a: number, b: number) =>
  Effect.fromResult(link(graph, a, b, DEFAULT_FILTER));

export const EGO_NOTES =
  "focus: The player at the centre. " +
  "players: The focus player and every teammate, with games played together. " +
  "links: Every teammate link among those players.";

/** The ego table set for one player: the player, every teammate under the default filter, and each link among them. */
export const ego = (
  graph: TeammateGraph,
  store: HistoryStore,
  playerId: number
): Effect.Effect<
  { readonly tables: EgoTables; readonly notes: string },
  HistoryUnavailable | UnknownPlayer
> =>
  Effect.gen(function* () {
    const focusIndex = graph.indexOf.get(playerId);
    // A missing ID surfaces as `UnknownPlayer` from the store lookup.
    const { offsets, neighbours } = graph.adjacency;
    const neighbourIds =
      focusIndex === undefined
        ? []
        : Array.map(
            Array.fromIterable(
              neighbours.subarray(offsets[focusIndex], offsets[focusIndex + 1])
            ),
            (at) => graph.arrays.playerIds[at]
          );
    const neighbourLinks = yield* Effect.forEach(neighbourIds, (id) =>
      Effect.map(linkOf(graph, playerId, id), (shared) => ({ id, shared }))
    );
    const teammateIds = Array.flatMap(neighbourLinks, ({ id, shared }) =>
      shared.totalGames > 0 ? [id] : []
    );
    const ids = Array.sort(
      Array.dedupe([playerId, ...teammateIds]),
      Order.Number
    );

    const players = yield* Effect.forEach(ids, (id) =>
      Effect.gen(function* () {
        const { player } = yield* store.player(id);
        const withFocus =
          id === playerId ? undefined : yield* linkOf(graph, playerId, id);
        const row: EgoPlayerRow = {
          playerId: player.playerId,
          name: player.name,
          position: player.position,
          firstSeason: player.firstSeason,
          lastSeason: player.lastSeason,
          games: player.games,
          gamesWithFocus: withFocus?.totalGames ?? 0,
        };
        return row;
      })
    );

    const pairs = Array.flatMap(ids, (a, i) =>
      Array.map(ids.slice(i + 1), (b) => [a, b] as const)
    );
    const shared = yield* Effect.forEach(pairs, ([a, b]) =>
      Effect.map(linkOf(graph, a, b), (found) => ({ a, b, found }))
    );
    const links = Array.flatMap(shared, ({ a, b, found }): EgoLinkRow[] => {
      if (found.totalGames === 0) return [];
      const seasons = Array.map(found.spans, (span) => span.seasonId);
      return [
        {
          a,
          b,
          games: found.totalGames,
          firstSeason: Math.min(...seasons),
          lastSeason: Math.max(...seasons),
        },
      ];
    });

    return {
      tables: { focus: [{ playerId }], players, links },
      notes: EGO_NOTES,
    };
  });
