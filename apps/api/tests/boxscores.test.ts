import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { createServer } from "node:http";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import { NodeHttpServer, NodeServices } from "@effect/platform-node";
import {
  BoxscoreLoadError,
  BoxscoreNotArchived,
  UnknownGame,
} from "@nhl-reddit-stats/season/rpc";
import { Array, Effect, Layer, Order, Schema } from "effect";
import { HttpRouter, HttpServer } from "effect/http";

import season from "../../../data/nhl-20262027.json" with { type: "json" };
import poster from "../../../data/nhl-poster-20262027.json" with { type: "json" };
import {
  BoxscoreSource,
  rpcBoxscoreSourceLayer,
} from "../../web/src/season-source.ts";
import { BoxScores } from "../src/boxscores.ts";
import { ApiRoutes } from "../src/routes.ts";
import { makeSnapshots, Snapshots } from "../src/snapshots.ts";

const archiveDirectory = fileURLToPath(
  new URL("../../../data/boxscores/20262027", import.meta.url)
);
const archivedIds = Array.sort(
  readdirSync(archiveDirectory).map((file) =>
    Number(file.replace(".json", ""))
  ),
  Order.Number
);
const readArchived = (id: number) =>
  JSON.parse(readFileSync(`${archiveDirectory}/${id}.json`, "utf-8"));
const archivedId = archivedIds[0];

const request = <A, E>(
  boxScores: Layer.Layer<BoxScores>,
  run: (source: typeof BoxscoreSource.Service) => Effect.Effect<A, E>
) =>
  Effect.runPromise(
    Effect.gen(function* () {
      const snapshots = yield* makeSnapshots({ season, poster });
      const server = HttpRouter.serve(ApiRoutes, {
        disableLogger: true,
        disableListenLog: true,
      }).pipe(
        Layer.provide([Layer.succeed(Snapshots, snapshots), boxScores]),
        Layer.provideMerge(
          NodeHttpServer.layer(() => createServer(), {
            host: "127.0.0.1",
            port: 0,
          })
        )
      );
      return yield* Effect.gen(function* () {
        const http = yield* HttpServer.HttpServer;
        return yield* Effect.gen(function* () {
          const source = yield* BoxscoreSource;
          return yield* run(source);
        }).pipe(
          Effect.provide(
            rpcBoxscoreSourceLayer(
              `${HttpServer.formatAddress(http.address)}/api/rpc`
            )
          )
        );
      }).pipe(Effect.provide(server));
    }).pipe(Effect.scoped)
  );

const files = Layer.provide(
  BoxScores.layerFiles(archiveDirectory),
  NodeServices.layer
);
const counting = (load: () => unknown) => {
  const calls: number[] = [];
  const layer = Layer.succeed(
    BoxScores,
    BoxScores.of({
      load: (id) => {
        calls.push(id);
        return Effect.succeed(load());
      },
    })
  );
  return { calls, layer };
};

test("GetGameBoxscore returns a trimmed summary of the archived file", async () => {
  const raw = readArchived(archivedId);
  const box = await request(files, (source) => source.load(archivedId));
  assert.equal(box.gameId, archivedId);
  assert.equal(box.decision, raw.decision);
  for (const side of ["awayTeam", "homeTeam"] as const) {
    const archived = raw[side];
    assert.equal(box[side].abbrev, archived.abbrev);
    assert.equal(box[side].score, archived.score);
    assert.equal(box[side].shotsOnGoal, archived.shotsOnGoal);
    const skaters = [...archived.players.forwards, ...archived.players.defense];
    assert.deepEqual(
      Array.sort(
        box[side].scorers.map((player) => player.playerId),
        Order.Number
      ),
      Array.sort(
        Array.flatMapNullishOr(
          skaters,
          (player: { points: number; playerId: number }) =>
            player.points > 0 ? player.playerId : null
        ),
        Order.Number
      )
    );
    assert.equal(
      box[side].scorers.reduce((total, player) => total + player.goals, 0),
      skaters.reduce(
        (total: number, player: { goals: number }) => total + player.goals,
        0
      )
    );
    const played = archived.players.goalies.filter(
      (goalie: { toi: string }) => goalie.toi !== "00:00"
    );
    assert.deepEqual(
      box[side].goalies.map(({ playerId, saves, shotsAgainst }) => ({
        playerId,
        saves,
        shotsAgainst,
      })),
      played.map(
        ({
          playerId,
          saves,
          shotsAgainst,
        }: {
          playerId: number;
          saves: number;
          shotsAgainst: number;
        }) => ({ playerId, saves, shotsAgainst })
      )
    );
    for (const goalie of box[side].goalies)
      assert.equal(
        goalie.savePct,
        goalie.shotsAgainst === 0 ? null : goalie.saves / goalie.shotsAgainst
      );
    const points = box[side].scorers.map((player) => player.points);
    assert.deepEqual(points, Array.sort(points, Order.flip(Order.Number)));
  }
  assert.ok(
    JSON.stringify(box).length < 4096,
    "the response is a summary, not the raw archive"
  );
});

test("an unknown game id fails with a typed error before storage is touched", async () => {
  const { calls, layer } = counting(() => readArchived(archivedId));
  for (const gameId of [1, 2026029999, 2026020041 + 1e9]) {
    const error = await request(layer, (source) =>
      Effect.flip(source.load(gameId))
    );
    assert.ok(Schema.is(UnknownGame)(error));
    assert.equal(error.gameId, gameId);
  }
  assert.deepEqual(calls, []);
});

test("a scheduled game without an archived box score reports not archived", async () => {
  const final = season.games.find(
    (game) => game.result !== null && !archivedIds.includes(game.id)
  );
  const pending = season.games.find((game) => game.result === null);
  assert.ok(final && pending);
  const missing = await request(files, (source) =>
    Effect.flip(source.load(final.id))
  );
  assert.ok(Schema.is(BoxscoreNotArchived)(missing));
  assert.equal(missing.gameId, final.id);
  // A game that has not finished is never read from storage, even if a file existed for it.
  const { calls, layer } = counting(() => readArchived(archivedId));
  const unplayed = await request(layer, (source) =>
    Effect.flip(source.load(pending.id))
  );
  assert.ok(Schema.is(BoxscoreNotArchived)(unplayed));
  assert.deepEqual(calls, []);
});

test("unreadable or mismatched archive contents are a load failure, not a missing box score", async () => {
  const other = archivedIds.find((id) => id !== archivedId);
  assert.ok(other);
  for (const contents of [
    {},
    readArchived(other),
    {
      ...readArchived(archivedId),
      decision: readArchived(archivedId).decision === "REG" ? "SO" : "REG",
    },
  ]) {
    const { layer } = counting(() => contents);
    const error = await request(layer, (source) =>
      Effect.flip(source.load(archivedId))
    );
    assert.ok(Schema.is(BoxscoreLoadError)(error));
  }
});

test("every archived box score decodes against its scheduled game", async () => {
  const boxes = await request(files, (source) =>
    Effect.forEach(archivedIds, (id) => source.load(id), { concurrency: 8 })
  );
  assert.deepEqual(
    boxes.map((box) => box.gameId),
    archivedIds
  );
});
