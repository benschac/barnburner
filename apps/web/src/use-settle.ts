import { Duration, Effect } from 'effect'

/** Resolves when `pending` settles or after `millis`, whichever is first. The wait is cancelled once it is over; `pending` itself is left running. */
export function settleWithin(pending: PromiseLike<unknown>, millis: number): Promise<void> {
  return Effect.runPromise(Effect.tryPromise({ try: () => pending, catch: () => undefined }).pipe(Effect.timeout(Duration.millis(millis)), Effect.ignore))
}
