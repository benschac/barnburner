import assert from "node:assert/strict";
import { test } from "node:test";

import { UnknownRoster } from "@nhl-reddit-stats/history/contracts";
import type { HistoryStore } from "@nhl-reddit-stats/history/store";
import { Effect, Schema } from "effect";

import { MINI_GRAPH, makeMiniStore } from "../../history/tests/fakes.ts";
import { pairSample } from "../src/samples.ts";
import { SelfPair, pair } from "../src/tables/pair.ts";

test("pair 15 and 16 on the shared test league matches pairSample", async () => {
  const view = await Effect.runPromise(
    pair(MINI_GRAPH, makeMiniStore(), 15, 16)
  );
  assert.deepStrictEqual(view.tables, pairSample.tables);
  assert.equal(view.notes, pairSample.notes);
});

// The store with the given players' stints for one club removed; the roster and everything else are unchanged.
const hideStints = (
  store: HistoryStore,
  players: readonly number[],
  teamId: number
): HistoryStore => ({
  ...store,
  player: (playerId) =>
    Effect.map(store.player(playerId), (detail) =>
      players.includes(playerId)
        ? {
            ...detail,
            stints: detail.stints.filter((s) => s.teamId !== teamId),
          }
        : detail
    ),
});

test("a goalie-partner pair whose goalies have no stint for the club is named from the roster", async () => {
  // 16 and 17 are goalie partners for club 3 in 1951-52 (game E), with no credited stint there.
  const store = hideStints(makeMiniStore(), [16, 17], 3);
  const view = await Effect.runPromise(pair(MINI_GRAPH, store, 16, 17));
  assert.deepStrictEqual(view.tables.teams, [
    { teamId: 3, abbrev: "CCC", name: "Charlie Club" },
  ]);
  assert.deepStrictEqual(view.tables.spans, [
    {
      seasonId: 19511952,
      gameType: 2,
      teamId: 3,
      link: "GoaliePartners",
      games: 3,
      firstGameId: 1951020001,
    },
  ]);
  assert.deepStrictEqual(view.tables.summary, [
    { a: 16, b: 17, totalGames: 3, opposedGames: 0 },
  ]);
});

test("a goalie-partner club with no name anywhere on record is a HistoryUnavailable failure", async () => {
  const base = hideStints(makeMiniStore(), [16, 17], 3);
  // Nobody has a stint for club 3 that the roster can name, so the lookup must fail.
  const store: HistoryStore = {
    ...base,
    roster: () =>
      Effect.fail(
        new UnknownRoster({ teamId: 3, seasonId: 19511952, gameType: 2 })
      ),
    player: (playerId) =>
      Effect.map(base.player(playerId), (detail) => ({
        ...detail,
        stints: detail.stints.filter((s) => s.teamId !== 3),
      })),
  };
  const error = await Effect.runPromise(
    Effect.flip(pair(MINI_GRAPH, store, 16, 17))
  );
  assert.equal(error._tag, "HistoryUnavailable");
});

test("a player paired with himself is a SelfPair error, not rows", async () => {
  const error = await Effect.runPromise(
    Effect.flip(pair(MINI_GRAPH, makeMiniStore(), 16, 16))
  );
  assert.ok(Schema.is(SelfPair)(error));
  assert.equal(error._tag, "SelfPair");
  assert.equal(error.playerId, 16);
});
