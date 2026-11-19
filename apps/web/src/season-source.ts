import { Context, Effect, Layer } from 'effect'
import { FetchHttpClient } from 'effect/http'
import { RpcClient, RpcSerialization } from 'effect/rpc'
import { BoxscoreLoadError, SnapshotLoadError, TeamRpcs } from '@nhl-reddit-stats/season/rpc'
import type { BoxscoreNotArchived, TeamDataWithInsights, GameBoxscore, UnknownGame } from '@nhl-reddit-stats/season/rpc'

export class SeasonSource extends Context.Service<SeasonSource, {
  readonly load: Effect.Effect<TeamDataWithInsights, SnapshotLoadError>
}>()('glanceboard/SeasonSource') {}

export class BoxscoreSource extends Context.Service<BoxscoreSource, {
  readonly load: (gameId: number) => Effect.Effect<GameBoxscore, UnknownGame | BoxscoreNotArchived | BoxscoreLoadError>
}>()('glanceboard/BoxscoreSource') {}

const rpcProtocol = (url: string) => RpcClient.layerProtocolHttp({ url }).pipe(
  Layer.provide([FetchHttpClient.layer, RpcSerialization.layerJson]),
)

export const rpcSeasonSourceLayer = (url: string) => Layer.effect(SeasonSource, Effect.gen(function* () {
  const client = yield* RpcClient.make(TeamRpcs)
  return SeasonSource.of({
    load: client.GetTeamData({}).pipe(
      Effect.catchTag('RpcClientError', () => Effect.fail(new SnapshotLoadError({
        message: 'Team data could not be loaded. Try again.',
      }))),
    ),
  })
})).pipe(Layer.provide(rpcProtocol(url)))

export const rpcBoxscoreSourceLayer = (url: string) => Layer.effect(BoxscoreSource, Effect.gen(function* () {
  const client = yield* RpcClient.make(TeamRpcs)
  return BoxscoreSource.of({
    load: (gameId) => client.GetGameBoxscore({ gameId }).pipe(
      Effect.catchTag('RpcClientError', () => Effect.fail(new BoxscoreLoadError({
        message: 'The box score could not be loaded. Try again.',
      }))),
    ),
  })
})).pipe(Layer.provide(rpcProtocol(url)))
