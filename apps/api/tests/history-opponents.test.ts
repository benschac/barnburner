import assert from "node:assert/strict";
import { test } from "node:test";

import {
  DEFAULT_FILTER,
  UnknownPlayer,
  findPaths,
  makeGraph,
} from "@nhl-reddit-stats/history";
import { HistoryRpcs } from "@nhl-reddit-stats/history/rpc";
import { Effect, Layer, Result, Schema } from "effect";
import { FetchHttpClient, HttpRouter } from "effect/http";
import type { RpcClientError } from "effect/rpc";
import { RpcClient, RpcSerialization } from "effect/rpc";

import {
  MINI_ARRAYS,
  makeMiniStore,
} from "../../../packages/history/tests/fakes.ts";
import {
  History,
  HistoryRoutes,
  fillOpponentHops,
} from "../src/history-routes.ts";

const fake = makeMiniStore();
type Client = RpcClient.FromGroup<
  typeof HistoryRpcs,
  RpcClientError.RpcClientError
>;
const DEFAULT = {
  competition: "all",
  fromSeason: null,
  toSeason: null,
  goaliePartners: true,
} as const;

const withFake = async (use: (client: Client) => Promise<void>) => {
  const web = HttpRouter.toWebHandler(
    HistoryRoutes.pipe(Layer.provide(History.fromStore(fake))),
    { disableLogger: true }
  );
  const fetch = FetchHttpClient.Fetch.of((input, init) =>
    web.handler(new Request(input, init))
  );
  try {
    await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const client = yield* RpcClient.make(HistoryRpcs);
          yield* Effect.promise(() => use(client));
        })
      ).pipe(
        Effect.provide(
          RpcClient.layerProtocolHttp({
            url: "https://rinkside.example/api/history",
          }).pipe(
            Layer.provide([FetchHttpClient.layer, RpcSerialization.layerJson]),
            Layer.provide(Layer.succeed(FetchHttpClient.Fetch, fetch))
          )
        )
      )
    );
  } finally {
    await web.dispose();
  }
};

const flip = <A, E>(effect: Effect.Effect<A, E>) =>
  Effect.runPromise(Effect.flip(effect));

test("GetOpponents lists opponents of 16 most games first with names and total", () =>
  withFake(async (client) => {
    const result = await Effect.runPromise(
      client.GetOpponents({ playerId: 16, limit: 50, offset: 0 })
    );
    assert.equal(result.total, 5);
    assert.deepEqual(
      result.opponents.map((o) => [o.playerId, o.games]),
      [
        [14, 4],
        [12, 3],
        [11, 2],
        [15, 2],
        [13, 1],
      ]
    );
    for (const o of result.opponents)
      assert.equal(o.name, Effect.runSync(fake.player(o.playerId)).player.name);
  }));

test("GetOpponents pages and rejects an unknown player", () =>
  withFake(async (client) => {
    const page = await Effect.runPromise(
      client.GetOpponents({ playerId: 16, limit: 2, offset: 2 })
    );
    assert.equal(page.total, 5);
    assert.deepEqual(
      page.opponents.map((o) => o.playerId),
      [11, 15]
    );
    assert.ok(
      Schema.is(UnknownPlayer)(
        await flip(client.GetOpponents({ playerId: 999, limit: 5, offset: 0 }))
      )
    );
  }));

test("GetOpposedGames returns the opposed games for 15-16 and rejects an unknown player", () =>
  withFake(async (client) => {
    const expected = Effect.runSync(fake.opposedGames(15, 16));
    assert.equal(expected.length, 2);
    const result = await Effect.runPromise(
      client.GetOpposedGames({ a: 15, b: 16 })
    );
    assert.deepEqual(result.games, expected);
    assert.ok(
      Schema.is(UnknownPlayer)(
        await flip(client.GetOpposedGames({ a: 15, b: 999 }))
      )
    );
  }));

test("GetLink for 15-16 is both teammates and opponents", () =>
  withFake(async (client) => {
    const result = await Effect.runPromise(
      client.GetLink({ a: 15, b: 16, filter: DEFAULT })
    );
    assert.equal(result.totalGames, 2);
    assert.equal(result.spans.length, 1);
    assert.equal(result.spans[0].link, "PlayedWith");
    assert.equal(result.opposedGames, 2);
  }));

test("fillOpponentHops adds the first opposed game to PlayedAgainst hops", async () => {
  const graph = makeGraph(MINI_ARRAYS);
  const found = findPaths(graph, 11, 18, DEFAULT_FILTER, "either", 1);
  assert.ok(Result.isSuccess(found));
  const filled = await Effect.runPromise(fillOpponentHops(fake, found.success));
  const [path] = filled.paths;
  assert.deepEqual(
    path.map((h) => [h._tag, h.from, h.to]),
    [
      ["PlayedWith", 11, 12],
      ["PlayedAgainst", 12, 18],
    ]
  );
  const hop = path[1];
  assert.equal(hop._tag === "PlayedAgainst" ? hop.gameId : null, 1951020002);
});
