import { createEffectActor } from "@xstate/effect";
import type { EffectActor } from "@xstate/effect";
import { Effect, Fiber } from "effect";
import { useEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import type { SnapshotFrom } from "xstate";

import { boxscoreMachine } from "./boxscore-machine.ts";
import { rpcBoxscoreSourceLayer } from "./season-source.ts";

type BoxscoreActor = EffectActor<typeof boxscoreMachine>;
type BoxscoreSnapshot = SnapshotFrom<typeof boxscoreMachine>;

// Runs one box-score actor until its scope closes, publishing the actor and each snapshot to the hook.
const boxscoreLifetime = (
  gameId: number,
  actorRef: RefObject<BoxscoreActor | null>,
  setSnapshot: (snapshot: BoxscoreSnapshot) => void
) =>
  Effect.gen(function* () {
    const actor = yield* createEffectActor(boxscoreMachine, {
      input: { gameId },
    });
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

/** Loads one game's box score while the caller is mounted. Unmounting interrupts a pending request. */
export function useBoxscore(gameId: number) {
  const actorRef = useRef<EffectActor<typeof boxscoreMachine> | null>(null);
  const [snapshot, setSnapshot] = useState<SnapshotFrom<
    typeof boxscoreMachine
  > | null>(null);
  useEffect(() => {
    const lifetime = Effect.runFork(
      boxscoreLifetime(gameId, actorRef, setSnapshot).pipe(
        Effect.scoped,
        Effect.provide(rpcBoxscoreSourceLayer("/api/rpc"))
      )
    );
    return () => {
      Effect.runFork(Fiber.interrupt(lifetime));
    };
  }, [gameId]);
  const outcome = snapshot?.matches("shown") ? snapshot.context.outcome : null;
  return {
    status: snapshot?.matches("failed")
      ? ("failed" as const)
      : outcome
        ? outcome.kind
        : ("loading" as const),
    boxscore: outcome?.kind === "ready" ? outcome.boxscore : null,
    retry: () => actorRef.current?.send({ type: "RETRY" }),
  };
}
