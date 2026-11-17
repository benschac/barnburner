import { ByteSize, Context, Effect, Layer, Result } from 'effect'
import { HttpIncomingMessage, HttpRouter } from 'effect/http'
import { RpcSerialization, RpcServer } from 'effect/rpc'
import { DEFAULT_FILTER, HistoryUnavailable, hopKind, link, linkIdBetween, makeGraph } from '@nhl-reddit-stats/history'
import type { HistoryStore, PlayerRow, TeammateGraph } from '@nhl-reddit-stats/history'
import { HistoryRpcs } from '@nhl-reddit-stats/history/rpc'
import { openHistoryStore } from './history-store.ts'

type HistoryValue = {
  readonly store: Effect.Effect<HistoryStore, HistoryUnavailable>
  /** The teammate graph of `store`, built once per opened store. */
  readonly graph: Effect.Effect<TeammateGraph, HistoryUnavailable>
}

const fromStoreEffect = (store: Effect.Effect<HistoryStore, HistoryUnavailable>) => Effect.gen(function* () {
  const cachedStore = yield* Effect.cached(store)
  const graph = yield* Effect.cached(Effect.map(cachedStore, (opened) => makeGraph(opened.graph.arrays)))
  return { store: cachedStore, graph } satisfies HistoryValue
})

/** The history store, opened once per warm function. A missing or invalid file fails each call as `HistoryUnavailable`. */
export class History extends Context.Service<History, HistoryValue>()('glanceboard/History') {
  /** Opens the serving file on first use and reuses the result, success or failure, for the process lifetime. */
  static layer = (path: string | undefined) => Layer.effect(History, fromStoreEffect(
    path === undefined || path === ''
      ? Effect.fail(new HistoryUnavailable({ message: 'No history serving file is configured.' }))
      : openHistoryStore(path),
  ))

  /** Serves an already-open store (tests use the in-memory fake). */
  static fromStore = (store: HistoryStore) => Layer.effect(History, fromStoreEffect(Effect.succeed(store)))
}

const summary = ({ playerId, name, position, firstSeason, lastSeason, games }: PlayerRow) => (
  { playerId, name, position, firstSeason, lastSeason, games }
)

// Placeholder: later tasks replace each of these with a real handler.
const notImplemented = (rpc: string) => () => Effect.fail(new HistoryUnavailable({ message: `${rpc} is not implemented yet.` }))

const handlers = HistoryRpcs.toLayer(Effect.gen(function* () {
  const { store, graph: graphOf } = yield* History
  return {
    SearchPlayers: ({ query, limit }) => Effect.gen(function* () {
      const opened = yield* store
      const players = yield* opened.searchPlayers(query, limit)
      return { snapshotId: opened.snapshotId, players: players.map(summary) }
    }),
    GetPlayer: ({ playerId }) => Effect.gen(function* () {
      const opened = yield* store
      const { player, stints } = yield* opened.player(playerId)
      const { points, teammates } = player
      return { snapshotId: opened.snapshotId, player: { ...summary(player), points, teammates }, stints }
    }),
    // TODO(later tasks): GetRoster, GetLink, GetSharedGames, GetOpponents, GetOpposedGames, FindPath, GetFarthest, GetFinalsCoverage.
    GetRoster: ({ teamId, seasonId, gameType, focusPlayerId }) => Effect.gen(function* () {
      const opened = yield* store
      const rows = yield* opened.roster(teamId, seasonId, gameType)
      if (focusPlayerId === undefined) return { snapshotId: opened.snapshotId, teamId, seasonId, gameType, players: rows }
      const graph = yield* graphOf
      yield* opened.player(focusPlayerId)
      const focusIndex = graph.indexOf.get(focusPlayerId)
      const players = rows.map((row) => {
        const rowIndex = graph.indexOf.get(row.playerId)
        const linkId = row.playerId === focusPlayerId || focusIndex === undefined || rowIndex === undefined
          ? -1
          : linkIdBetween(graph, focusIndex, rowIndex)
        const kind = linkId < 0 ? null : hopKind(graph, linkId, DEFAULT_FILTER)
        const found = kind === null ? null : link(graph, focusPlayerId, row.playerId, DEFAULT_FILTER)
        if (kind === null || found === null || Result.isFailure(found) || found.success.evidenceGameId === null) {
          return { ...row, link: { _tag: 'NoLink' as const } }
        }
        return { ...row, link: { _tag: kind, games: found.success.totalGames, evidenceGameId: found.success.evidenceGameId } }
      })
      return { snapshotId: opened.snapshotId, teamId, seasonId, gameType, players }
    }),
    GetLink: ({ a, b, filter }) => Effect.gen(function* () {
      const opened = yield* store
      const graph = yield* graphOf
      const result = link(graph, a, b, filter)
      if (Result.isFailure(result)) return yield* result.failure
      return { snapshotId: opened.snapshotId, ...result.success }
    }),
    GetSharedGames: ({ a, b, seasonId, gameType, teamId }) => Effect.gen(function* () {
      const opened = yield* store
      const games = yield* opened.sharedGames(a, b, seasonId, gameType, teamId)
      return { snapshotId: opened.snapshotId, games }
    }),
    GetOpponents: notImplemented('GetOpponents'),
    GetOpposedGames: notImplemented('GetOpposedGames'),
    FindPath: notImplemented('FindPath'),
    GetFarthest: notImplemented('GetFarthest'),
    GetFinalsCoverage: notImplemented('GetFinalsCoverage'),
  }
}))

const rpcBodyLimit = HttpRouter.middleware((httpEffect) => httpEffect.pipe(
  Effect.provideService(HttpIncomingMessage.MaxBodySize, ByteSize.kibibytes(8)),
)).layer

/** Serves `HistoryRpcs` at `/api/history`. Requires `History`. */
export const HistoryRoutes = RpcServer.layerHttp({ group: HistoryRpcs, path: '/api/history', protocol: 'http' }).pipe(
  Layer.provide([handlers, RpcSerialization.layerJson, rpcBodyLimit]),
)
