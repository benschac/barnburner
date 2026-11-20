import { useEffect, useRef } from 'react'
import { Effect, Fiber } from 'effect'

/** Runs a long-lived program for the life of the component, and interrupts it on unmount. The program is built once. */
export function useScopedProgram(build: () => Effect.Effect<never, never, never>): void {
  const first = useRef(build)
  useEffect(() => {
    const fiber = Effect.runFork(first.current())
    return () => { Effect.runFork(Fiber.interrupt(fiber)) }
  }, [])
}
