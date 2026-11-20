import assert from "node:assert/strict";
import { test } from "node:test";

import { Duration, Effect, Layer, Option, Predicate } from "effect";
import { FetchHttpClient, HttpRouter } from "effect/http";
import { AsyncResult, Atom, AtomRegistry, Hydration } from "effect/reactivity";
import { RpcClient, RpcSerialization } from "effect/rpc";

import { makeMiniStore } from "../../../packages/history/tests/fakes.ts";
import { History, HistoryRoutes } from "../../api/src/history-routes.ts";
import {
  farthest,
  findPath,
  finalsCoverage,
  link,
  historyProtocol,
  opponents,
  opposedGames,
  player,
  roster,
  searchPlayers,
  sharedGames,
} from "../src/explorer/history-atoms.ts";

const URL = "http://history.test/api/history";
const filter = {
  competition: "all",
  fromSeason: null,
  toSeason: null,
  goaliePartners: true,
} as const;

const protocolOver = (fetch: typeof globalThis.fetch) =>
  RpcClient.layerProtocolHttp({ url: URL }).pipe(
    Layer.provide([FetchHttpClient.layer, RpcSerialization.layerJson]),
    Layer.provide(Layer.succeed(FetchHttpClient.Fetch, fetch))
  );

const web = HttpRouter.toWebHandler(
  HistoryRoutes.pipe(Layer.provide(History.fromStore(makeMiniStore()))),
  { disableLogger: true }
);
const served = protocolOver((input, init) =>
  web.handler(new Request(input, init))
);
const down = protocolOver(() => Promise.reject(new TypeError("network down")));

const pause = (ms: number) =>
  Effect.runPromise(Effect.sleep(Duration.millis(ms)));

const read = async <A, E>(
  layer: typeof served,
  atom: Atom.Atom<AsyncResult.AsyncResult<A, E>>
) => {
  const registry = AtomRegistry.make({
    initialValues: [[historyProtocol, layer]],
  });
  const unmount = registry.mount(atom);
  try {
    for (let tries = 0; tries < 200; tries++) {
      const result = registry.get(atom);
      if (AsyncResult.isNotInitial(result) && !AsyncResult.isWaiting(result))
        return result;
      await pause(10);
    }
    assert.fail("the atom never settled");
  } finally {
    unmount();
    registry.dispose();
  }
};

const failureTag = <A, E>(result: AsyncResult.AsyncResult<A, E>) => {
  assert.ok(AsyncResult.isFailure(result));
  const error = Effect.runSync(Effect.flip(Effect.failCause(result.cause)));
  assert.ok(Predicate.hasProperty(error, "_tag"));
  return String(error._tag);
};

const calls = [
  [
    "searchPlayers",
    () => searchPlayers({ query: "", limit: 5 }),
    () => searchPlayers({ query: "", limit: 6 }),
  ],
  ["player", () => player({ playerId: 11 }), () => player({ playerId: 12 })],
  [
    "roster",
    () => roster({ teamId: 1, seasonId: 19501951, gameType: 2 }),
    () => roster({ teamId: 2, seasonId: 19501951, gameType: 2 }),
  ],
  [
    "link",
    () => link({ a: 11, b: 12, filter }),
    () => link({ a: 11, b: 13, filter }),
  ],
  [
    "sharedGames",
    () =>
      sharedGames({
        a: 11,
        b: 12,
        seasonId: 19501951,
        gameType: 2,
        teamId: 1,
        link: "PlayedWith",
      }),
    () =>
      sharedGames({
        a: 11,
        b: 13,
        seasonId: 19501951,
        gameType: 2,
        teamId: 1,
        link: "PlayedWith",
      }),
  ],
  [
    "opponents",
    () => opponents({ playerId: 11, limit: 5, offset: 0 }),
    () => opponents({ playerId: 11, limit: 5, offset: 1 }),
  ],
  [
    "opposedGames",
    () => opposedGames({ a: 11, b: 15 }),
    () => opposedGames({ a: 11, b: 16 }),
  ],
  [
    "findPath",
    () => findPath({ from: 11, to: 14, filter, relation: "with", limit: 2 }),
    () => findPath({ from: 11, to: 15, filter, relation: "with", limit: 2 }),
  ],
  [
    "farthest",
    () => farthest({ playerId: 11, filter }),
    () => farthest({ playerId: 12, filter }),
  ],
  [
    "finalsCoverage",
    () => finalsCoverage({ playerId: 11, fromYear: 1951, toYear: 1952 }),
    () => finalsCoverage({ playerId: 11, fromYear: 1951, toYear: 1953 }),
  ],
] as const;

for (const [name, make, other] of calls) {
  test(`${name} returns one atom per payload`, () => {
    assert.equal(make(), make());
    assert.notEqual(make(), other());
  });
  test(`${name} reads a success through the real handler`, async () => {
    // SAFETY: every query atom's success carries snapshotId; the tuple type unions the atoms' differing result types.
    const result = await read(
      served,
      make() as Atom.Atom<
        AsyncResult.AsyncResult<{ readonly snapshotId: string }, unknown>
      >
    );
    assert.ok(AsyncResult.isSuccess(result), `${name} did not succeed`);
    assert.equal(result.value.snapshotId, "0123456789ab");
  });
  test(`${name} reports HistoryUnavailable when the transport fails`, async () => {
    // SAFETY: only the failure tag is read, so the atom's result types are widened.
    const result = await read(
      down,
      make() as Atom.Atom<AsyncResult.AsyncResult<unknown, unknown>>
    );
    assert.equal(failureTag(result), "HistoryUnavailable");
  });
}

const unknown = 999;
const unknownCalls = [
  ["player", () => player({ playerId: unknown })],
  [
    "roster",
    () =>
      roster({
        teamId: 1,
        seasonId: 19501951,
        gameType: 2,
        focusPlayerId: unknown,
      }),
  ],
  ["link", () => link({ a: unknown, b: 12, filter })],
  [
    "sharedGames",
    () =>
      sharedGames({
        a: unknown,
        b: 12,
        seasonId: 19501951,
        gameType: 2,
        teamId: 1,
        link: "PlayedWith",
      }),
  ],
  ["opponents", () => opponents({ playerId: unknown, limit: 5, offset: 0 })],
  ["opposedGames", () => opposedGames({ a: unknown, b: 12 })],
  [
    "findPath",
    () =>
      findPath({ from: unknown, to: 12, filter, relation: "with", limit: 2 }),
  ],
  ["farthest", () => farthest({ playerId: unknown, filter })],
  [
    "finalsCoverage",
    () => finalsCoverage({ playerId: unknown, fromYear: 1951, toYear: 1952 }),
  ],
] as const;

for (const [name, make] of unknownCalls) {
  test(`${name} fails as UnknownPlayer for a player the store does not hold`, async () => {
    // SAFETY: only the failure tag is read, so the atom's result types are widened.
    assert.equal(
      failureTag(
        await read(
          served,
          make() as Atom.Atom<AsyncResult.AsyncResult<unknown, unknown>>
        )
      ),
      "UnknownPlayer"
    );
  });
}

test("a search key accepts any string, including a lone surrogate", async () => {
  const result = await read(
    served,
    searchPlayers({ query: String.fromCharCode(0xd800), limit: 5 })
  );
  assert.ok(AsyncResult.isSuccess(result));
});

test("a hydrated result is used as it is, without a second request", async () => {
  const server = AtomRegistry.make({
    initialValues: [[historyProtocol, served]],
  });
  const atom = player({ playerId: 11 });
  const unmount = server.mount(atom);
  for (
    let tries = 0;
    tries < 200 && !AsyncResult.isSuccess(server.get(atom));
    tries++
  )
    await pause(10);
  const state = Hydration.dehydrate(server);
  unmount();
  server.dispose();
  assert.deepEqual(
    Hydration.toValues(state).map((entry) => entry.key),
    ["history:GetPlayer:11"]
  );

  let requests = 0;
  const failing = protocolOver(() => {
    requests++;
    return Promise.reject(new TypeError("network down"));
  });
  const browser = AtomRegistry.make({
    initialValues: [[historyProtocol, failing]],
  });
  Hydration.hydrate(browser, state);
  const stop = browser.mount(atom);
  await pause(100);
  const result = browser.get(atom);
  stop();
  browser.dispose();
  assert.ok(AsyncResult.isSuccess(result));
  assert.equal(result.value.player.playerId, 11);
  assert.equal(requests, 0);
});

test("the transport override survives until the first query", async () => {
  const registry = AtomRegistry.make({
    initialValues: [[historyProtocol, served]],
  });
  await pause(50);
  const atom = player({ playerId: 12 });
  const stop = registry.mount(atom);
  try {
    for (
      let tries = 0;
      tries < 200 && !AsyncResult.isNotInitial(registry.get(atom));
      tries++
    )
      await pause(10);
    assert.ok(AsyncResult.isSuccess(registry.get(atom)));
  } finally {
    stop();
    registry.dispose();
  }
});

test("a failed refresh keeps the previous success", async () => {
  let requests = 0;
  const flaky = protocolOver((input, init) => {
    requests++;
    return requests === 1
      ? web.handler(new Request(input, init))
      : Promise.reject(new TypeError("network down"));
  });
  const registry = AtomRegistry.make({
    initialValues: [[historyProtocol, flaky]],
  });
  const atom = player({ playerId: 13 });
  const stop = registry.mount(atom);
  try {
    for (
      let tries = 0;
      tries < 200 && !AsyncResult.isSuccess(registry.get(atom));
      tries++
    )
      await pause(10);
    assert.ok(AsyncResult.isSuccess(registry.get(atom)));
    registry.refresh(atom);
    for (
      let tries = 0;
      tries < 200 && !AsyncResult.isFailure(registry.get(atom));
      tries++
    )
      await pause(10);
    const result = registry.get(atom);
    assert.ok(AsyncResult.isFailure(result));
    assert.equal(failureTag(result), "HistoryUnavailable");
    assert.ok(Option.isSome(result.previousSuccess));
    assert.equal(result.previousSuccess.value.value.player.playerId, 13);
  } finally {
    stop();
    registry.dispose();
  }
});
