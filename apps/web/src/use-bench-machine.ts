import { createEffectActor } from "@xstate/effect";
import type { EffectActor } from "@xstate/effect";
import { Effect, Fiber, Option } from "effect";
import { useCallback, useEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import type { TamaguiElement } from "tamagui";
import type { EventFromLogic, SnapshotFrom } from "xstate";

import { BenchHost, benchMachine } from "./viz/bench/bench-machine.ts";
import type { RendererLoader } from "./viz/bench/renderer-loaders.ts";

type BenchActor = EffectActor<typeof benchMachine>;
type BenchSnapshot = SnapshotFrom<typeof benchMachine>;

// Runs the bench actor until its scope closes, publishing the actor and each snapshot to the hook.
const benchLifetime = (
  renderer: string,
  actorRef: RefObject<BenchActor | null>,
  setSnapshot: (snapshot: BenchSnapshot) => void
) =>
  Effect.gen(function* () {
    const actor = yield* createEffectActor(benchMachine, {
      input: { renderer },
    });
    actorRef.current = actor;
    yield* Effect.acquireRelease(
      Effect.sync(() => {
        setSnapshot(actor.getSnapshot());
        return actor.subscribe(setSnapshot);
      }),
      (subscription) =>
        Effect.sync(() => {
          subscription.unsubscribe();
          if (actorRef.current === actor) actorRef.current = null;
        })
    );
    return yield* Effect.never;
  });

/**
 * Runs the network bench's machine while the page is mounted. Unmounting interrupts an unfinished read or run,
 * which destroys the renderer. `root` goes on the element the renderers draw in. The snapshot is null until the actor has started.
 */
export function useBenchMachine(loaders: readonly RendererLoader[]) {
  const root = useRef<TamaguiElement>(null);
  const actorRef = useRef<BenchActor | null>(null);
  const [snapshot, setSnapshot] = useState<BenchSnapshot | null>(null);
  useEffect(() => {
    const host = {
      root: () => {
        const element = root.current;
        return element instanceof HTMLElement
          ? Option.some(element)
          : Option.none();
      },
      loaders,
    };
    const lifetime = Effect.runFork(
      benchLifetime(loaders[0]?.id ?? "", actorRef, setSnapshot).pipe(
        Effect.scoped,
        Effect.provideService(BenchHost, host)
      )
    );
    return () => {
      Effect.runFork(Fiber.interrupt(lifetime));
    };
  }, [loaders]);
  const send = useCallback((event: EventFromLogic<typeof benchMachine>) => {
    actorRef.current?.send(event);
  }, []);
  return { snapshot, root, send };
}
