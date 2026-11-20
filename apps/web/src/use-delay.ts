import { Duration, Effect } from 'effect'

/** Runs `action` once after `millis` and returns the function that cancels it. React effects and handlers call it in place of a timer. */
export function delay(millis: number, action: () => void): () => void {
  const fiber = Effect.runFork(Effect.sleep(Duration.millis(millis)).pipe(Effect.andThen(Effect.sync(action))))
  return () => fiber.interruptUnsafe()
}
