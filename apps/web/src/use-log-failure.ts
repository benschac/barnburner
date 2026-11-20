import { Effect } from 'effect'

/** Writes a failure to the Effect logger. React effects call it; it is the one place that starts the logging fiber. */
export function logFailure(message: string, cause: unknown): void {
  void Effect.runFork(Effect.logError(message, cause))
}
