import assert from "node:assert/strict";
import { test } from "node:test";

import {
  BoxscoreLoadError,
  BoxscoreNotArchived,
} from "@nhl-reddit-stats/season/rpc";
import type { GameBoxscore } from "@nhl-reddit-stats/season/rpc";
import { createEffectActor, send, waitFor } from "@xstate/effect";
import { Effect } from "effect";

import { boxscoreMachine } from "../src/boxscore-machine.ts";
import { BoxscoreSource } from "../src/season-source.ts";

const team = {
  abbrev: "NJD",
  score: 3,
  shotsOnGoal: 30,
  scorers: [],
  goalies: [],
};
const boxscore: GameBoxscore = {
  gameId: 7,
  date: "2026-10-10",
  decision: "REG",
  awayTeam: team,
  homeTeam: { ...team, abbrev: "TOR" },
};

const run = (
  load: (gameId: number) => ReturnType<(typeof BoxscoreSource.Service)["load"]>,
  check: (
    actor: Effect.Success<ReturnType<typeof start>>
  ) => Effect.Effect<void, unknown>
) =>
  Effect.runPromise(
    start().pipe(
      Effect.flatMap(check),
      Effect.scoped,
      Effect.provideService(BoxscoreSource, { load })
    )
  );
const start = () =>
  createEffectActor(boxscoreMachine, { input: { gameId: 7 } });

test("opening a game loads its box score once", async () => {
  const requested: number[] = [];
  await run(
    (gameId) =>
      Effect.sync(() => {
        requested.push(gameId);
      }).pipe(Effect.as(boxscore)),
    (actor) =>
      Effect.gen(function* () {
        const shown = yield* waitFor(actor, (state) => state.matches("shown"), {
          timeout: "2 seconds",
        });
        assert.deepEqual(shown.context.outcome, { kind: "ready", boxscore });
      })
  );
  assert.deepEqual(requested, [7]);
});

test("a game without an archived box score is an outcome, not a failure", async () => {
  await run(
    () => Effect.fail(new BoxscoreNotArchived({ gameId: 7 })),
    (actor) =>
      Effect.gen(function* () {
        const shown = yield* waitFor(actor, (state) => state.matches("shown"), {
          timeout: "2 seconds",
        });
        assert.deepEqual(shown.context.outcome, { kind: "unavailable" });
      })
  );
});

test("a failed load offers retry and then shows the box score", async () => {
  let attempts = 0;
  await run(
    () =>
      Effect.suspend(() =>
        ++attempts === 1
          ? Effect.fail(new BoxscoreLoadError({ message: "Unavailable" }))
          : Effect.succeed(boxscore)
      ),
    (actor) =>
      Effect.gen(function* () {
        yield* waitFor(actor, (state) => state.matches("failed"), {
          timeout: "2 seconds",
        });
        yield* send(actor, { type: "RETRY" });
        const shown = yield* waitFor(actor, (state) => state.matches("shown"), {
          timeout: "2 seconds",
        });
        assert.deepEqual(shown.context.outcome, { kind: "ready", boxscore });
      })
  );
  assert.equal(attempts, 2);
});

test("closing the drawer interrupts a request that is still pending", async () => {
  let interrupted = false;
  await Effect.runPromise(
    Effect.gen(function* () {
      yield* Effect.scoped(
        Effect.gen(function* () {
          const actor = yield* start();
          yield* waitFor(actor, (state) => state.matches("loading"), {
            timeout: "2 seconds",
          });
          yield* Effect.sleep("10 millis");
        })
      );
      yield* Effect.sleep("10 millis");
    }).pipe(
      Effect.provideService(BoxscoreSource, {
        load: () =>
          Effect.never.pipe(
            Effect.onInterrupt(() =>
              Effect.sync(() => {
                interrupted = true;
              })
            )
          ),
      })
    )
  );
  assert.ok(interrupted);
});
