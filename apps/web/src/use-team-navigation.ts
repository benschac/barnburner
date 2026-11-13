import { useEffect, useRef, useState } from 'react'
import { Effect, Fiber } from 'effect'
import { createEffectActor } from '@xstate/effect'
import type { EffectActor } from '@xstate/effect'
import type { SnapshotFrom } from 'xstate'
import { teamMachine } from './team-machine.ts'
import { rpcSeasonSourceLayer } from './season-source.ts'
import { teamFromLocation, teamFromPath } from './team-season.ts'
import { navigateTeam } from './navigate-team.ts'

export function useTeamNavigation() {
  const actorRef = useRef<EffectActor<typeof teamMachine> | null>(null)
  const [snapshot, setSnapshot] = useState<SnapshotFrom<typeof teamMachine> | null>(null)
  useEffect(() => {
    const lifetime = Effect.runFork(Effect.gen(function* () {
      const actor = yield* createEffectActor(teamMachine)
      actorRef.current = actor
      const syncRoute = () => {
        const team = teamFromLocation(window.location)
        actor.send(team ? { type: 'SELECT_TEAM', team } : { type: 'SHOW_POSTER' })
      }
      const followTeamLink = (event: MouseEvent) => {
        if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
        const link = event.target instanceof Element ? event.target.closest('a') : null
        if (!(link instanceof HTMLAnchorElement) || link.hasAttribute('download') || (link.target && link.target !== '_self')) return
        const url = new URL(link.href)
        const team = teamFromPath(url.pathname)
        if (url.origin !== window.location.origin || !team || url.search || url.hash) return
        event.preventDefault()
        navigateTeam(team)
      }
      yield* Effect.acquireRelease(
        Effect.sync(() => {
          const subscription = actor.subscribe(setSnapshot)
          window.addEventListener('hashchange', syncRoute)
          window.addEventListener('popstate', syncRoute)
          document.addEventListener('click', followTeamLink, true)
          syncRoute()
          return subscription
        }),
        (subscription) => Effect.sync(() => {
          subscription.unsubscribe()
          window.removeEventListener('hashchange', syncRoute)
          window.removeEventListener('popstate', syncRoute)
          document.removeEventListener('click', followTeamLink, true)
          if (actorRef.current === actor) actorRef.current = null
        }),
      )
      return yield* Effect.never
    }).pipe(Effect.scoped, Effect.provide(rpcSeasonSourceLayer('/api/rpc'))))
    return () => { Effect.runFork(Fiber.interrupt(lifetime)) }
  }, [])
  return { snapshot, retry: () => actorRef.current?.send({ type: 'RETRY' }) }
}
