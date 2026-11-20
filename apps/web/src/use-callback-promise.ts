import { Effect } from 'effect'

/**
 * A promise that resolves when `register` hands its callback a call. `register` runs at once.
 * This is the boundary for foreign promise-returning contracts, such as a renderer's `mount`.
 */
export const callbackPromise = (register: (resolve: () => void) => void): Promise<void> =>
  Effect.runPromise(Effect.callback<void>((resume) => {
    register(() => resume(Effect.void))
  }))
