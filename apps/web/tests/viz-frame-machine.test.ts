import assert from "node:assert/strict";
import { test } from "node:test";

import { createEffectActor, send, waitFor } from "@xstate/effect";
import { Effect } from "effect";

import { frameMachine } from "../src/viz/frame/frame-machine.ts";

const start = (limitMs: number) =>
  createEffectActor(frameMachine, { input: { limitMs } });
const run = (
  limitMs: number,
  check: (
    actor: Effect.Success<ReturnType<typeof start>>
  ) => Effect.Effect<void, unknown>
) =>
  Effect.runPromise(start(limitMs).pipe(Effect.flatMap(check), Effect.scoped));
const reach = (
  actor: Effect.Success<ReturnType<typeof start>>,
  state: "loading" | "ready" | "rendering" | "rendered" | "failed" | "timedOut"
) =>
  waitFor(actor, (snapshot) => snapshot.matches(state), {
    timeout: "2 seconds",
  });
const settle = Effect.sleep("30 millis");

test("the frame starts loading and Ready moves it to ready", () =>
  run(10_000, (actor) =>
    Effect.gen(function* () {
      yield* reach(actor, "loading");
      yield* send(actor, { type: "Ready" });
      yield* reach(actor, "ready");
    })
  ));

test("a render request moves to rendering and records its id", () =>
  run(10_000, (actor) =>
    Effect.gen(function* () {
      yield* send(actor, { type: "Ready" });
      yield* send(actor, { type: "Render", id: "a" });
      const snapshot = yield* reach(actor, "rendering");
      assert.equal(snapshot.context.id, "a");
    })
  ));

test("Rendered with the recorded id settles the render", () =>
  run(10_000, (actor) =>
    Effect.gen(function* () {
      yield* send(actor, { type: "Ready" });
      yield* send(actor, { type: "Render", id: "a" });
      yield* send(actor, { type: "Rendered", id: "a" });
      yield* reach(actor, "rendered");
    })
  ));

test("Failed with the recorded id settles the render as failed", () =>
  run(10_000, (actor) =>
    Effect.gen(function* () {
      yield* send(actor, { type: "Ready" });
      yield* send(actor, { type: "Render", id: "a" });
      yield* send(actor, { type: "Failed", id: "a" });
      yield* reach(actor, "failed");
    })
  ));

test("a report with another id is ignored", () =>
  run(10_000, (actor) =>
    Effect.gen(function* () {
      yield* send(actor, { type: "Ready" });
      yield* send(actor, { type: "Render", id: "b" });
      yield* send(actor, { type: "Rendered", id: "a" });
      yield* send(actor, { type: "Failed", id: "a" });
      yield* settle;
      yield* reach(actor, "rendering");
      yield* send(actor, { type: "Rendered", id: "b" });
      yield* reach(actor, "rendered");
    })
  ));

test("a new render request after a settled one starts again with its own id", () =>
  run(10_000, (actor) =>
    Effect.gen(function* () {
      yield* send(actor, { type: "Ready" });
      yield* send(actor, { type: "Render", id: "a" });
      yield* send(actor, { type: "Failed", id: "a" });
      yield* reach(actor, "failed");
      yield* send(actor, { type: "Render", id: "b" });
      yield* waitFor(actor, (snapshot) => snapshot.context.id === "b", {
        timeout: "2 seconds",
      });
      const snapshot = yield* reach(actor, "rendering");
      assert.equal(snapshot.context.id, "b");
    })
  ));

test("no Ready within the limit moves to timedOut", () =>
  run(20, (actor) => reach(actor, "timedOut").pipe(Effect.asVoid)));

test("no answer to a render within the limit moves to timedOut", () =>
  run(60, (actor) =>
    Effect.gen(function* () {
      yield* send(actor, { type: "Ready" });
      yield* send(actor, { type: "Render", id: "a" });
      yield* reach(actor, "timedOut");
    })
  ));

test("an answer in time cancels the timeout", () =>
  run(60, (actor) =>
    Effect.gen(function* () {
      yield* send(actor, { type: "Ready" });
      yield* send(actor, { type: "Render", id: "a" });
      yield* send(actor, { type: "Rendered", id: "a" });
      yield* Effect.sleep("150 millis");
      yield* reach(actor, "rendered");
    })
  ));

test("overlapping renders settle on the latest id and ignore a late answer for the earlier one", () =>
  run(10_000, (actor) =>
    Effect.gen(function* () {
      yield* send(actor, { type: "Ready" });
      yield* send(actor, { type: "Render", id: "a" });
      yield* send(actor, { type: "Render", id: "b" });
      yield* waitFor(actor, (snapshot) => snapshot.context.id === "b", {
        timeout: "2 seconds",
      });
      yield* send(actor, { type: "Rendered", id: "b" });
      yield* reach(actor, "rendered");
      yield* send(actor, { type: "Rendered", id: "a" });
      yield* settle;
      yield* reach(actor, "rendered");
    })
  ));

test("a newer render restarts the time limit", () =>
  run(150, (actor) =>
    Effect.gen(function* () {
      yield* send(actor, { type: "Ready" });
      yield* send(actor, { type: "Render", id: "a" });
      yield* Effect.sleep("100 millis");
      yield* send(actor, { type: "Render", id: "b" });
      yield* Effect.sleep("100 millis");
      yield* reach(actor, "rendering");
      yield* reach(actor, "timedOut");
    })
  ));

test("a redraw from rendered starts a new render with its own id", () =>
  run(10_000, (actor) =>
    Effect.gen(function* () {
      yield* send(actor, { type: "Ready" });
      yield* send(actor, { type: "Render", id: "a" });
      yield* send(actor, { type: "Rendered", id: "a" });
      yield* reach(actor, "rendered");
      yield* send(actor, { type: "Render", id: "b" });
      yield* waitFor(actor, (snapshot) => snapshot.context.id === "b", {
        timeout: "2 seconds",
      });
      yield* send(actor, { type: "Rendered", id: "b" });
      yield* reach(actor, "rendered");
    })
  ));

test("Failed after paint with the current id moves to failed", () =>
  run(10_000, (actor) =>
    Effect.gen(function* () {
      yield* send(actor, { type: "Ready" });
      yield* send(actor, { type: "Render", id: "a" });
      yield* send(actor, { type: "Rendered", id: "a" });
      yield* reach(actor, "rendered");
      yield* send(actor, { type: "Failed", id: "a" });
      yield* reach(actor, "failed");
    })
  ));

test("Failed after paint with another id is ignored", () =>
  run(10_000, (actor) =>
    Effect.gen(function* () {
      yield* send(actor, { type: "Ready" });
      yield* send(actor, { type: "Render", id: "b" });
      yield* send(actor, { type: "Rendered", id: "b" });
      yield* reach(actor, "rendered");
      yield* send(actor, { type: "Failed", id: "a" });
      yield* settle;
      yield* reach(actor, "rendered");
    })
  ));
