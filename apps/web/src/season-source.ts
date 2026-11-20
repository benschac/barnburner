import {
  BoxscoreLoadError,
  SnapshotLoadError,
  TeamRpcs,
} from "@nhl-reddit-stats/season/rpc";
import type {
  BoxscoreNotArchived,
  TeamDataWithInsights,
  GameBoxscore,
  UnknownGame,
} from "@nhl-reddit-stats/season/rpc";
import { Context, Effect, Layer } from "effect";
import { FetchHttpClient } from "effect/http";
import { RpcClient, RpcSerialization } from "effect/rpc";

export class SeasonSource extends Context.Service<
  SeasonSource,
  {
    readonly load: Effect.Effect<TeamDataWithInsights, SnapshotLoadError>;
  }
>()("glanceboard/SeasonSource", {
  make: Effect.gen(function* () {
    const client = yield* RpcClient.make(TeamRpcs);
    return {
      load: client.GetTeamData({}).pipe(
        Effect.catchTag("RpcClientError", () =>
          Effect.fail(
            new SnapshotLoadError({
              message: "Team data could not be loaded. Try again.",
            })
          )
        ),
        Effect.withSpan("SeasonSource.load")
      ),
    };
  }),
}) {
  static readonly layer = Layer.effect(this, this.make);
}

export class BoxscoreSource extends Context.Service<
  BoxscoreSource,
  {
    readonly load: (
      gameId: number
    ) => Effect.Effect<
      GameBoxscore,
      UnknownGame | BoxscoreNotArchived | BoxscoreLoadError
    >;
  }
>()("glanceboard/BoxscoreSource", {
  make: Effect.gen(function* () {
    const client = yield* RpcClient.make(TeamRpcs);
    return {
      load: (gameId: number) =>
        client.GetGameBoxscore({ gameId }).pipe(
          Effect.catchTag("RpcClientError", () =>
            Effect.fail(
              new BoxscoreLoadError({
                message: "The box score could not be loaded. Try again.",
              })
            )
          ),
          Effect.withSpan("BoxscoreSource.load")
        ),
    };
  }),
}) {
  static readonly layer = Layer.effect(this, this.make);
}

const rpcProtocol = (url: string) =>
  RpcClient.layerProtocolHttp({ url }).pipe(
    Layer.provide([FetchHttpClient.layer, RpcSerialization.layerJson])
  );

export const rpcSeasonSourceLayer = (url: string) =>
  SeasonSource.layer.pipe(Layer.provide(rpcProtocol(url)));

export const rpcBoxscoreSourceLayer = (url: string) =>
  BoxscoreSource.layer.pipe(Layer.provide(rpcProtocol(url)));
