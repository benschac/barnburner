import assert from "node:assert/strict";
import { test } from "node:test";

import { createEffectActor, send, waitFor } from "@xstate/effect";
import { Deferred, Effect } from "effect";

import { exportFileMachine } from "../src/viz/export-file-machine.ts";
import type { ExportFilePicker } from "../src/viz/export-file-machine.ts";

type Tables = { readonly label: string };
const preview = { tables: { label: "preview" }, note: "Preview note." };

const file = (name: string) => new File(["{}"], name);

const start = (picker: ExportFilePicker<Tables>) =>
  createEffectActor(picker.machine, { input: picker.preview });
const within = { timeout: "2 seconds" } as const;

test("the machine starts on the preview tables and note", async () => {
  const machine = exportFileMachine({
    preview,
    read: () => Effect.succeed<Tables>({ label: "never" }),
    describe: (reason: string) => reason,
  });
  await Effect.runPromise(
    Effect.scoped(
      Effect.gen(function* () {
        const actor = yield* start(machine);
        const snapshot = yield* waitFor(
          actor,
          (state) => state.matches("preview"),
          within
        );
        assert.deepEqual(machine.tablesOf(snapshot), preview.tables);
        assert.equal(snapshot.context.note, preview.note);
      })
    )
  );
});

test("a good file loads its tables and says so", async () => {
  const machine = exportFileMachine({
    preview,
    read: (picked) => Effect.succeed<Tables>({ label: picked.name }),
    describe: (reason: string) => reason,
  });
  await Effect.runPromise(
    Effect.scoped(
      Effect.gen(function* () {
        const actor = yield* start(machine);
        yield* send(actor, { type: "Pick", file: file("a.json") });
        const snapshot = yield* waitFor(
          actor,
          (state) => state.matches("loaded"),
          within
        );
        assert.deepEqual(snapshot.context.tables, { label: "a.json" });
        assert.equal(snapshot.context.note, "Loaded a.json.");
      })
    )
  );
});

test("a rejected file keeps the last good tables and says why", async () => {
  const machine = exportFileMachine({
    preview,
    read: (picked) =>
      picked.name === "bad.json"
        ? Effect.fail("bad.json is not an export.")
        : Effect.succeed<Tables>({ label: picked.name }),
    describe: (reason: string) => reason,
  });
  await Effect.runPromise(
    Effect.scoped(
      Effect.gen(function* () {
        const actor = yield* start(machine);
        yield* send(actor, { type: "Pick", file: file("good.json") });
        yield* waitFor(actor, (state) => state.matches("loaded"), within);
        yield* send(actor, { type: "Pick", file: file("bad.json") });
        const snapshot = yield* waitFor(
          actor,
          (state) => state.matches("rejected"),
          within
        );
        assert.deepEqual(snapshot.context.tables, { label: "good.json" });
        assert.equal(snapshot.context.note, "bad.json is not an export.");
        // A pick is accepted from the rejected state too.
        yield* send(actor, { type: "Pick", file: file("again.json") });
        const again = yield* waitFor(
          actor,
          (state) => state.matches("loaded"),
          within
        );
        assert.deepEqual(again.context.tables, { label: "again.json" });
      })
    )
  );
});

test("a stale read is interrupted and dropped when a newer pick arrives", async () => {
  const interrupted: string[] = [];
  const machine = exportFileMachine({
    preview,
    read: (picked) =>
      picked.name === "slow.json"
        ? Effect.never.pipe(
            Effect.onInterrupt(() =>
              Effect.sync(() => {
                interrupted.push(picked.name);
              })
            )
          )
        : Effect.succeed<Tables>({ label: picked.name }),
    describe: (reason: string) => reason,
  });
  await Effect.runPromise(
    Effect.scoped(
      Effect.gen(function* () {
        const actor = yield* start(machine);
        yield* send(actor, { type: "Pick", file: file("slow.json") });
        yield* waitFor(actor, (state) => state.matches("reading"), within);
        yield* send(actor, { type: "Pick", file: file("fast.json") });
        const snapshot = yield* waitFor(
          actor,
          (state) => state.matches("loaded"),
          within
        );
        assert.deepEqual(snapshot.context.tables, { label: "fast.json" });
        assert.equal(snapshot.context.note, "Loaded fast.json.");
      })
    )
  );
  assert.deepEqual(interrupted, ["slow.json"]);
});

test("unmounting interrupts a read that is still pending", async () => {
  const started = Effect.runSync(Deferred.make<void>());
  let interrupted = false;
  const machine = exportFileMachine({
    preview,
    read: () =>
      Deferred.succeed(started, undefined).pipe(
        Effect.andThen(Effect.never),
        Effect.onInterrupt(() =>
          Effect.sync(() => {
            interrupted = true;
          })
        )
      ),
    describe: (reason: string) => reason,
  });
  await Effect.runPromise(
    Effect.gen(function* () {
      yield* Effect.scoped(
        Effect.gen(function* () {
          const actor = yield* start(machine);
          yield* send(actor, { type: "Pick", file: file("slow.json") });
          yield* Deferred.await(started);
        })
      );
      yield* Effect.sleep("10 millis");
    })
  );
  assert.ok(interrupted);
});
