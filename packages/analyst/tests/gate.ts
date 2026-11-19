import { Deferred, Effect } from 'effect'

// A one-shot signal a test can wait on: `open()` releases every `opened` waiter.
export const makeGate = () => {
  const deferred = Deferred.makeUnsafe<void>()
  return {
    open: () => { Deferred.doneUnsafe(deferred, Effect.void) },
    opened: Effect.runPromise(Deferred.await(deferred)),
  }
}

// A promise that rejects once `signal` aborts, for mocks that must hang until cancelled.
export const rejectOnAbort = (signal: AbortSignal | undefined, onStart?: () => void): Promise<never> =>
  Effect.runPromise(Effect.callback<never>((resume) => {
    onStart?.()
    signal?.addEventListener('abort', () => resume(Effect.die(new Error('aborted'))), { once: true })
  }))
