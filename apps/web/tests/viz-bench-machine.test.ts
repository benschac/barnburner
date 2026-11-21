import assert from "node:assert/strict";
import { test } from "node:test";

import { BenchMountError } from "@nhl-reddit-stats/viz/contracts";
import type { BenchRenderer, VizTheme } from "@nhl-reddit-stats/viz/contracts";
import { createEffectActor, send, waitFor } from "@xstate/effect";
import { Deferred, Effect, Option } from "effect";
import type { Fiber } from "effect";

import {
  BenchHost,
  benchMachine,
  pickFirstNote,
} from "../src/viz/bench/bench-machine.ts";

// The harness drives the renderer with animation frames. Each fake frame is five seconds later, so the ten-second script takes three.
const frames = { ticking: true, clock: 0 };
Reflect.set(globalThis, "document", {
  visibilityState: "visible",
  addEventListener: () => undefined,
  removeEventListener: () => undefined,
});
const pendingFrames = new Map<number, Fiber.Fiber<void>>();
Reflect.set(
  globalThis,
  "requestAnimationFrame",
  (tick: (at: number) => void) => {
    const id = pendingFrames.size + 1;
    if (frames.ticking)
      pendingFrames.set(
        id,
        Effect.runFork(
          Effect.sleep("1 millis").pipe(
            Effect.andThen(
              Effect.sync(() => {
                frames.clock += 5000;
                tick(frames.clock);
              })
            )
          )
        )
      );
    return id;
  }
);
Reflect.set(globalThis, "cancelAnimationFrame", (id: number) => {
  pendingFrames.get(id)?.interruptUnsafe();
});

const colour = "#000000";
const theme: VizTheme = {
  mode: "light",
  background: colour,
  color: colour,
  muted: colour,
  gold: colour,
  win: colour,
  loss: colour,
  pending: colour,
  rule: colour,
  surface: colour,
  highlight: colour,
  brand: colour,
  bright: colour,
  chartWin: colour,
  chartLoss: colour,
  chartPositive: colour,
  chartNegative: colour,
  chartLine: colour,
  series: [colour, colour, colour, colour, colour, colour, colour],
  fonts: { body: "body", score: "score" },
};

// A renderer that records what the harness did to it. `gate` holds `mount` open until the test releases it.
const fakeRenderer = (gate?: Deferred.Deferred<void>) => {
  const log = { mounted: 0, destroyed: 0 };
  const renderer: BenchRenderer = {
    name: "fake",
    mount: () =>
      Effect.gen(function* () {
        log.mounted += 1;
        if (gate) yield* Deferred.await(gate);
        return {
          pan: () => undefined,
          zoom: () => undefined,
          destroy: () => {
            log.destroyed += 1;
          },
        };
      }),
  };
  return { renderer, log };
};

const root: HTMLElement = Object.create(null);
const hostFor = (renderer: BenchRenderer) => ({
  root: () => Option.some(root),
  loaders: [{ id: "fake", load: () => Promise.resolve({ default: renderer }) }],
});

const start = () =>
  createEffectActor(benchMachine, { input: { renderer: "fake" } });
const run = (
  host: ReturnType<typeof hostFor>,
  check: (
    actor: Effect.Success<ReturnType<typeof start>>
  ) => Effect.Effect<void, unknown>
) =>
  Effect.runPromise(
    start().pipe(
      Effect.flatMap(check),
      Effect.scoped,
      Effect.provideService(BenchHost, host)
    )
  );
const within = { timeout: "2 seconds" } as const;
const settle = Effect.sleep("40 millis");

// A file whose text arrives after `delayMs`, so a test can make an older read finish last.
class SlowFile extends File {
  readonly delayMs: number;
  constructor(name: string, text: string, delayMs: number) {
    super([text], name);
    this.delayMs = delayMs;
  }
  override async text() {
    await Effect.runPromise(Effect.sleep(this.delayMs));
    return await super.text();
  }
}
const dataset = (nodes: number) =>
  JSON.stringify({
    nodes: Array.from({ length: nodes }, (_, index) => ({
      playerId: index + 1,
      name: `Player ${index + 1}`,
      games: 1,
    })),
    links: [],
  });

test("a file read that finishes after a newer pick is dropped", async () => {
  await run(hostFor(fakeRenderer().renderer), (actor) =>
    Effect.gen(function* () {
      yield* send(actor, {
        type: "PickFile",
        file: new SlowFile("old.json", dataset(1), 150),
      });
      yield* send(actor, {
        type: "PickFile",
        file: new SlowFile("new.json", dataset(2), 1),
      });
      const loaded = yield* waitFor(
        actor,
        (snapshot) => snapshot.context.loaded !== null,
        within
      );
      assert.equal(loaded.context.loaded?.nodes.length, 2);
      yield* Effect.sleep("250 millis");
      const final = actor.getSnapshot();
      assert.equal(final.context.loaded?.nodes.length, 2);
      assert.equal(final.context.source, "file");
      assert.equal(final.context.note, "Loaded new.json: 2 nodes and 0 links.");
      assert.ok(final.matches("idle"));
    })
  );
});

test("a file that cannot be used keeps the dataset loaded before it", async () => {
  await run(hostFor(fakeRenderer().renderer), (actor) =>
    Effect.gen(function* () {
      yield* send(actor, {
        type: "PickFile",
        file: new SlowFile("good.json", dataset(1), 1),
      });
      yield* waitFor(
        actor,
        (snapshot) => snapshot.context.loaded !== null,
        within
      );
      yield* send(actor, {
        type: "PickFile",
        file: new SlowFile("bad.json", "not json", 1),
      });
      const failed = yield* waitFor(
        actor,
        (snapshot) => snapshot.context.note.startsWith("Could not use"),
        within
      );
      assert.equal(failed.context.loaded?.nodes.length, 1);
      assert.ok(failed.context.note.startsWith("Could not use bad.json: "));
    })
  );
});

test("a successful run appends a result and clears the note", async () => {
  const { renderer, log } = fakeRenderer();
  await run(hostFor(renderer), (actor) =>
    Effect.gen(function* () {
      yield* send(actor, { type: "SelectSource", source: "ego" });
      yield* send(actor, { type: "Run", theme });
      const done = yield* waitFor(
        actor,
        (snapshot) =>
          snapshot.matches("idle") && snapshot.context.results.length > 0,
        within
      );
      assert.equal(done.context.results.length, 1);
      assert.equal(done.context.results[0]?.renderer, "fake");
      assert.equal(done.context.note, "");
      assert.equal(log.destroyed, 1);
      yield* send(actor, { type: "Run", theme });
      const again = yield* waitFor(
        actor,
        (snapshot) => snapshot.context.results.length === 2,
        within
      );
      assert.equal(again.context.results.length, 2);
    })
  );
});

test("a failed run names the renderer and the stage", async () => {
  const renderer: BenchRenderer = {
    name: "fake",
    mount: () => Effect.fail(new BenchMountError({ message: "boom" })),
  };
  await run(hostFor(renderer), (actor) =>
    Effect.gen(function* () {
      yield* send(actor, { type: "Run", theme });
      const failed = yield* waitFor(
        actor,
        (snapshot) => snapshot.context.note.includes("failed at"),
        within
      );
      assert.equal(failed.context.note, "fake failed at mount: boom");
      assert.equal(failed.context.results.length, 0);
      assert.ok(failed.matches("idle"));
    })
  );
});

test("the file source cannot be chosen before a file has loaded", async () => {
  await run(hostFor(fakeRenderer().renderer), (actor) =>
    Effect.gen(function* () {
      yield* send(actor, { type: "SelectSource", source: "file" });
      yield* settle;
      assert.equal(actor.getSnapshot().context.source, "league");
    })
  );
});

test("Run without a chosen renderer only leaves a note", async () => {
  const { renderer, log } = fakeRenderer();
  await Effect.runPromise(
    createEffectActor(benchMachine, { input: { renderer: "" } }).pipe(
      Effect.flatMap((actor) =>
        Effect.gen(function* () {
          yield* send(actor, { type: "Run", theme });
          const noted = yield* waitFor(
            actor,
            (snapshot) => snapshot.context.note !== "",
            within
          );
          assert.equal(noted.context.note, pickFirstNote);
          assert.ok(noted.matches("idle"));
          assert.equal(log.mounted, 0);
        })
      ),
      Effect.scoped,
      Effect.provideService(BenchHost, hostFor(renderer))
    )
  );
});

test("Run, file and selection events are ignored while a run is in flight", async () => {
  const gate = Deferred.makeUnsafe<void>();
  const { renderer, log } = fakeRenderer(gate);
  await run(hostFor(renderer), (actor) =>
    Effect.gen(function* () {
      yield* send(actor, { type: "Run", theme });
      yield* waitFor(actor, (snapshot) => snapshot.matches("running"), within);
      yield* send(actor, { type: "Run", theme });
      yield* send(actor, { type: "SelectRenderer", renderer: "other" });
      yield* send(actor, { type: "SelectSource", source: "ego" });
      yield* send(actor, {
        type: "PickFile",
        file: new SlowFile("late.json", dataset(1), 1),
      });
      yield* settle;
      const during = actor.getSnapshot();
      assert.ok(during.matches("running"));
      assert.equal(during.context.renderer, "fake");
      assert.equal(during.context.source, "league");
      assert.equal(during.context.loaded, null);
      assert.equal(during.context.note, "Running fake");
      assert.equal(log.mounted, 1);
      yield* Deferred.succeed(gate, undefined);
      const done = yield* waitFor(
        actor,
        (snapshot) => snapshot.matches("idle"),
        within
      );
      assert.equal(done.context.results.length, 1);
      assert.equal(log.mounted, 1);
    })
  );
});

test("stopping the actor during a run destroys the renderer", async () => {
  frames.ticking = false;
  const gate = Deferred.makeUnsafe<void>();
  const { renderer, log } = fakeRenderer(gate);
  await Effect.runPromise(
    Effect.gen(function* () {
      yield* Effect.scoped(
        Effect.gen(function* () {
          const actor = yield* start();
          yield* send(actor, { type: "Run", theme });
          yield* waitFor(
            actor,
            (snapshot) => snapshot.matches("running"),
            within
          );
          yield* Deferred.succeed(gate, undefined);
          // The renderer is mounted and the script is waiting for a frame that never comes.
          yield* Effect.sleep("40 millis");
          assert.equal(log.mounted, 1);
          assert.equal(log.destroyed, 0);
        })
      );
      yield* Effect.sleep("40 millis");
    }).pipe(Effect.provideService(BenchHost, hostFor(renderer)))
  );
  frames.ticking = true;
  assert.equal(log.destroyed, 1);
});
