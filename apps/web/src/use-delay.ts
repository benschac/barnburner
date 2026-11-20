import { Duration, Effect } from 'effect'
import type { Fiber } from 'effect'
import { useCallback, useEffect, useRef } from 'react'

/**
 * A write that waits `millis` after the last call. `schedule` replaces any pending action, `cancel` drops it,
 * and unmounting cancels it too, so no action runs after the component is gone.
 */
export function useDelay(millis: number) {
  const pending = useRef<Fiber.Fiber<void> | undefined>(undefined)
  const cancel = useCallback(() => {
    pending.current?.interruptUnsafe()
    pending.current = undefined
  }, [])
  const schedule = useCallback((action: () => void) => {
    cancel()
    pending.current = Effect.runFork(Effect.sleep(Duration.millis(millis)).pipe(Effect.andThen(Effect.sync(action))))
  }, [millis, cancel])
  useEffect(() => cancel, [cancel])
  return { schedule, cancel }
}
