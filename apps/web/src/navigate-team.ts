import { teamHref } from './team-season.ts'

export function navigateTeam(team: string) {
  const href = teamHref(team)
  if (window.location.pathname === href && !window.location.hash) return
  window.history.pushState(null, '', href)
  window.dispatchEvent(new PopStateEvent('popstate'))
}
