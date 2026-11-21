import { createEffectActor } from "@xstate/effect";
import type { EffectActor } from "@xstate/effect";
import { Effect, Fiber } from "effect";
import { useEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import type { SnapshotFrom } from "xstate";

import type {
  ExportFileMachine,
  ExportFilePicker,
} from "./viz/export-file-machine";

type Actor = EffectActor<ExportFileMachine>;
type Snapshot = SnapshotFrom<ExportFileMachine>;

// Runs one picker actor until its scope closes, publishing the actor and each snapshot to the hook.
const pickerLifetime = (
  machine: ExportFileMachine,
  preview: { readonly tables: unknown; readonly note: string },
  actorRef: RefObject<Actor | null>,
  setSnapshot: (snapshot: Snapshot) => void
) =>
  Effect.gen(function* () {
    const actor = yield* createEffectActor(machine, { input: preview });
    actorRef.current = actor;
    yield* Effect.acquireRelease(
      Effect.sync(() => actor.subscribe(setSnapshot)),
      (subscription) =>
        Effect.sync(() => {
          subscription.unsubscribe();
          if (actorRef.current === actor) actorRef.current = null;
        })
    );
    return yield* Effect.never;
  });

/** Runs an export-file picker while the caller is mounted. Unmounting interrupts a pending read. */
export function useExportFile<T>(picker: ExportFilePicker<T>) {
  const { machine, preview, tablesOf } = picker;
  const actorRef = useRef<Actor | null>(null);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  useEffect(() => {
    const lifetime = Effect.runFork(
      pickerLifetime(machine, preview, actorRef, setSnapshot).pipe(
        Effect.scoped
      )
    );
    return () => {
      Effect.runFork(Fiber.interrupt(lifetime));
    };
  }, [machine, preview]);
  return {
    tables: snapshot === null ? preview.tables : tablesOf(snapshot),
    note: snapshot?.context.note ?? preview.note,
    pick: (file: File) => actorRef.current?.send({ type: "Pick", file }),
  };
}
