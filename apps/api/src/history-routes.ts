import {
  DEFAULT_FILTER,
  HistoryUnavailable,
  farthest,
  finalsCoverage,
  findPaths,
  link,
  linkKind,
  makeGraph,
  opponents,
} from "@nhl-reddit-stats/history";
import type {
  Hop,
  HistoryStore,
  PathResult,
  PlayerRow,
  TeammateGraph,
  UnknownPlayer,
} from "@nhl-reddit-stats/history";
import {
  GoaliePartnersLink,
  HistoryRpcs,
  NoLink,
  PlayedWithLink,
  WirePlayedAgainst,
} from "@nhl-reddit-stats/history/rpc";
import type { PathResultSchema, WireHop } from "@nhl-reddit-stats/history/rpc";
import {
  Array,
  ByteSize,
  Context,
  Effect,
  Layer,
  Match,
  Order,
  Result,
  Scope,
} from "effect";
import { HttpIncomingMessage, HttpRouter } from "effect/http";
import { RpcSerialization, RpcServer } from "effect/rpc";

import { openScopedHistoryStore } from "./history-store.ts";

type HistoryValue = {
  readonly store: Effect.Effect<HistoryStore, HistoryUnavailable>;
  /** The teammate graph of `store`, built once per opened store. */
  readonly graph: Effect.Effect<TeammateGraph, HistoryUnavailable>;
};

/** `open` runs on first use inside the layer's scope, so closing the layer (a handler `dispose`) releases the store. */
const fromStoreEffect = (
  open: Effect.Effect<HistoryStore, HistoryUnavailable, Scope.Scope>
) =>
  Effect.gen(function* () {
    const scope = yield* Effect.scope;
    const cachedStore = yield* Effect.cached(Scope.provide(open, scope));
    const graph = yield* Effect.cached(
      Effect.map(cachedStore, (opened) => makeGraph(opened.graph.arrays))
    );
    return { store: cachedStore, graph } satisfies HistoryValue;
  });

/** The history store, opened once per warm function. A missing or invalid file fails each call as `HistoryUnavailable`. */
export class History extends Context.Service<History, HistoryValue>()(
  "glanceboard/History"
) {
  static readonly make = fromStoreEffect;

  /** Opens the serving file on first use and reuses the result, success or failure, for the process lifetime. */
  static readonly layer = (path: string | undefined) =>
    Layer.effect(
      this,
      this.make(
        path === undefined || path === ""
          ? Effect.fail(
              new HistoryUnavailable({
                message: "No history serving file is configured.",
              })
            )
          : openScopedHistoryStore(path)
      )
    );

  /** Serves an already-open store (tests use the in-memory fake). */
  static readonly fromStore = (store: HistoryStore) =>
    Layer.effect(this, this.make(Effect.succeed(store)));
}

const summary = ({
  playerId,
  name,
  position,
  firstSeason,
  lastSeason,
  games,
}: PlayerRow) => ({ playerId, name, position, firstSeason, lastSeason, games });

/** The competition rule behind every Finals answer (plan D8). */
export const FINALS_RULE =
  "A teammate is anyone credited in the same NHL regular-season or playoff game for the same team; " +
  "international games do not count. Cup Finals are flagged from the 1926-27 season (1927) on, when the Final became an NHL-only series.";

export type WirePathResult = typeof PathResultSchema.Type;

/** Fills every `PlayedAgainst` hop with the first game (earliest by date, then game ID) the pair played against each other. */
export const fillOpponentHops = (
  store: HistoryStore,
  result: PathResult
): Effect.Effect<WirePathResult, HistoryUnavailable | UnknownPlayer> =>
  Effect.gen(function* () {
    const fillHop = (
      hop: Hop
    ): Effect.Effect<WireHop, HistoryUnavailable | UnknownPlayer> =>
      Match.valueTags(hop, {
        PlayedWith: (h) => Effect.succeed<WireHop>(h),
        GoaliePartners: (h) => Effect.succeed<WireHop>(h),
        PlayedAgainst: (h) =>
          Effect.gen(function* () {
            const games = yield* store.opposedGames(h.from, h.to);
            const first = Array.sortBy<typeof games>(
              Order.mapInput(
                Order.String,
                (game: (typeof games)[number]) => game.gameDate
              ),
              Order.mapInput(
                Order.Number,
                (game: (typeof games)[number]) => game.gameId
              )
            )(games)[0];
            if (first === undefined) {
              return yield* new HistoryUnavailable({
                message: `No opposed game on record for players ${h.from} and ${h.to}.`,
              });
            }
            return WirePlayedAgainst.make({
              from: h.from,
              to: h.to,
              games: h.games,
              gameId: first.gameId,
            });
          }),
      });
    const paths = yield* Effect.forEach(result.paths, (path) =>
      Effect.forEach(path, fillHop)
    );
    return { ...result, paths };
  });

const handlers = HistoryRpcs.toLayer(
  Effect.gen(function* () {
    const { store, graph: graphOf } = yield* History;
    return {
      SearchPlayers: ({ query, limit }) =>
        Effect.gen(function* () {
          const opened = yield* store;
          const players = yield* opened.searchPlayers(query, limit);
          return {
            snapshotId: opened.snapshotId,
            players: players.map(summary),
          };
        }),
      GetPlayer: ({ playerId }) =>
        Effect.gen(function* () {
          const opened = yield* store;
          const { player, stints } = yield* opened.player(playerId);
          const { points, teammates } = player;
          return {
            snapshotId: opened.snapshotId,
            player: { ...summary(player), points, teammates },
            stints,
          };
        }),
      GetRoster: ({ teamId, seasonId, gameType, focusPlayerId }) =>
        Effect.gen(function* () {
          const opened = yield* store;
          const rows = yield* opened.roster(teamId, seasonId, gameType);
          if (focusPlayerId === undefined)
            return {
              snapshotId: opened.snapshotId,
              teamId,
              seasonId,
              gameType,
              players: rows,
            };
          const graph = yield* graphOf;
          yield* opened.player(focusPlayerId);
          const players = rows.map((row) => {
            const kind =
              row.playerId === focusPlayerId
                ? null
                : linkKind(graph, focusPlayerId, row.playerId, DEFAULT_FILTER);
            const found =
              kind === null
                ? null
                : link(graph, focusPlayerId, row.playerId, DEFAULT_FILTER);
            if (
              kind === null ||
              found === null ||
              Result.isFailure(found) ||
              found.success.evidenceGameId === null
            ) {
              return { ...row, link: NoLink.make({}) };
            }
            const evidence = {
              games: found.success.totalGames,
              evidenceGameId: found.success.evidenceGameId,
            };
            return {
              ...row,
              link:
                kind === "PlayedWith"
                  ? PlayedWithLink.make(evidence)
                  : GoaliePartnersLink.make(evidence),
            };
          });
          return {
            snapshotId: opened.snapshotId,
            teamId,
            seasonId,
            gameType,
            focusPlayerId,
            players,
          };
        }),
      GetLink: ({ a, b, filter }) =>
        Effect.gen(function* () {
          const opened = yield* store;
          const graph = yield* graphOf;
          const result = link(graph, a, b, filter);
          if (Result.isFailure(result)) return yield* result.failure;
          return { snapshotId: opened.snapshotId, ...result.success };
        }),
      GetSharedGames: ({ a, b, seasonId, gameType, teamId, link: kind }) =>
        Effect.gen(function* () {
          const opened = yield* store;
          const games = yield* opened.sharedGames(
            a,
            b,
            seasonId,
            gameType,
            teamId,
            kind
          );
          return { snapshotId: opened.snapshotId, games };
        }),
      GetOpponents: ({ playerId, limit, offset }) =>
        Effect.gen(function* () {
          const opened = yield* store;
          const graph = yield* graphOf;
          yield* opened.player(playerId);
          const found = opponents(graph, playerId);
          if (Result.isFailure(found)) return yield* found.failure;
          const page = found.success.slice(offset, offset + limit);
          const rows = yield* Effect.forEach(page, ({ playerId: id, games }) =>
            Effect.map(opened.player(id), ({ player }) => ({
              playerId: id,
              name: player.name,
              games,
            }))
          );
          return {
            snapshotId: opened.snapshotId,
            total: found.success.length,
            opponents: rows,
          };
        }),
      GetOpposedGames: ({ a, b }) =>
        Effect.gen(function* () {
          const opened = yield* store;
          const games = yield* opened.opposedGames(a, b);
          return { snapshotId: opened.snapshotId, games };
        }),
      FindPath: ({ from, to, filter, relation, limit }) =>
        Effect.gen(function* () {
          const opened = yield* store;
          const graph = yield* graphOf;
          const result = findPaths(graph, from, to, filter, relation, limit);
          if (Result.isFailure(result)) return yield* result.failure;
          const filled = yield* fillOpponentHops(opened, result.success);
          return { snapshotId: opened.snapshotId, ...filled };
        }),
      GetFarthest: ({ playerId, filter }) =>
        Effect.gen(function* () {
          const opened = yield* store;
          const graph = yield* graphOf;
          const result = farthest(graph, playerId, filter);
          if (Result.isFailure(result)) return yield* result.failure;
          return { snapshotId: opened.snapshotId, ...result.success };
        }),
      GetFinalsCoverage: ({ playerId, fromYear, toYear }) =>
        Effect.gen(function* () {
          const opened = yield* store;
          const graph = yield* graphOf;
          const years = yield* finalsCoverage(
            graph,
            opened,
            playerId,
            fromYear,
            toYear
          );
          return { snapshotId: opened.snapshotId, years, rule: FINALS_RULE };
        }),
    };
  })
);

const rpcBodyLimit = HttpRouter.middleware((httpEffect) =>
  httpEffect.pipe(
    Effect.provideService(
      HttpIncomingMessage.MaxBodySize,
      ByteSize.kibibytes(8)
    )
  )
).layer;

/** Serves `HistoryRpcs` at `/api/history`. Requires `History`. */
export const HistoryRoutes = RpcServer.layerHttp({
  group: HistoryRpcs,
  path: "/api/history",
  protocol: "http",
}).pipe(Layer.provide([handlers, RpcSerialization.layerJson, rpcBodyLimit]));
