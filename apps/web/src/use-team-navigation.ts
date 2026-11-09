import { useEffect, useRef, useState } from 'react'
import { Effect, Fiber } from 'effect'
import { createEffectActor } from '@xstate/effect'
import type { EffectActor } from '@xstate/effect'
import type { SnapshotFrom } from 'xstate'
import { teamMachine } from './team-machine.ts'
import { rpcSeasonSourceLayer } from './season-source.ts'
import { teamFromHash } from './team-season.ts'

export function useTeamNavigation() {
  const actorRef = useRef<EffectActor<typeof teamMachine> | null>(null)
  const [snapshot, setSnapshot] = useState<SnapshotFrom<typeof teamMachine> | null>(null)
  useEffect(() => {
    const lifetime = Effect.runFork(Effect.gen(function* () {
      const actor = yield* createEffectActor(teamMachine)
      actorRef.current = actor
      const syncRoute = () => {
        const team = teamFromHash(window.location.hash)
        actor.send(team ? { type: 'SELECT_TEAM', team } : { type: 'SHOW_POSTER' })
      }
      yield* Effect.acquireRelease(
        Effect.sync(() => {
          const subscription = actor.subscribe(setSnapshot)
          window.addEventListener('hashchange', syncRoute)
          syncRoute()
          return subscription
        }),
        (subscription) => Effect.sync(() => {
          subscription.unsubscribe()
          window.removeEventListener('hashchange', syncRoute)
          if (actorRef.current === actor) actorRef.current = null
        }),
      )
      return yield* Effect.never
    }).pipe(Effect.scoped, Effect.provide(rpcSeasonSourceLayer('/api/rpc'))))
    return () => { Effect.runFork(Fiber.interrupt(lifetime)) }
  }, [])
  return { snapshot, retry: () => actorRef.current?.send({ type: 'RETRY' }) }
}
