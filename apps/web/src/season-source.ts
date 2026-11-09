import { Context, Effect, Layer } from 'effect'
import { FetchHttpClient } from 'effect/http'
import { RpcClient, RpcSerialization } from 'effect/rpc'
import type { TeamData } from '@nhl-reddit-stats/season'
import { SnapshotLoadError, TeamRpcs } from '@nhl-reddit-stats/season/rpc'

export class SeasonSource extends Context.Service<SeasonSource, {
  readonly load: Effect.Effect<TeamData, SnapshotLoadError>
}>()('glanceboard/SeasonSource') {}

export const rpcSeasonSourceLayer = (url: string) => Layer.effect(SeasonSource, Effect.gen(function* () {
  const client = yield* RpcClient.make(TeamRpcs)
  return SeasonSource.of({
    load: client.GetTeamData({}).pipe(
      Effect.catchTag('RpcClientError', () => Effect.fail(new SnapshotLoadError({
        message: 'Team data could not be loaded. Try again.',
      }))),
    ),
  })
})).pipe(
  Layer.provide(RpcClient.layerProtocolHttp({ url }).pipe(
    Layer.provide([FetchHttpClient.layer, RpcSerialization.layerJson]),
  )),
)
