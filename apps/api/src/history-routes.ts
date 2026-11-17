import { ByteSize, Context, Effect, Layer } from 'effect'
import { HttpIncomingMessage, HttpRouter } from 'effect/http'
import { RpcSerialization, RpcServer } from 'effect/rpc'
import { HistoryUnavailable } from '@nhl-reddit-stats/history'
import type { HistoryStore, PlayerRow } from '@nhl-reddit-stats/history'
import { HistoryRpcs } from '@nhl-reddit-stats/history/rpc'
import { openHistoryStore } from './history-store.ts'

/** The history store, opened once per warm function. A missing or invalid file fails each call as `HistoryUnavailable`. */
export class History extends Context.Service<History, { readonly store: Effect.Effect<HistoryStore, HistoryUnavailable> }>()('glanceboard/History') {
  /** Opens the serving file on first use and reuses the result, success or failure, for the process lifetime. */
  static layer = (path: string | undefined) => Layer.effect(History, Effect.gen(function* () {
    const store = path === undefined || path === ''
      ? Effect.fail(new HistoryUnavailable({ message: 'No history serving file is configured.' }))
      : openHistoryStore(path)
    return { store: yield* Effect.cached(store) }
  }))
}

const summary = ({ playerId, name, position, firstSeason, lastSeason, games }: PlayerRow) => (
  { playerId, name, position, firstSeason, lastSeason, games }
)

// Placeholder: later tasks replace each of these with a real handler.
const notImplemented = (rpc: string) => () => Effect.fail(new HistoryUnavailable({ message: `${rpc} is not implemented yet.` }))

const handlers = HistoryRpcs.toLayer(Effect.gen(function* () {
  const { store } = yield* History
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
    GetRoster: notImplemented('GetRoster'),
    GetLink: notImplemented('GetLink'),
    GetSharedGames: notImplemented('GetSharedGames'),
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
