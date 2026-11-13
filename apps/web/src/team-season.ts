import { teams } from '@nhl-reddit-stats/season'

export { teams } from '@nhl-reddit-stats/season'
export const teamHref = (team: string) => `/team/${team}`
export const posterHref = '#poster'
export const teamFromHash = (hash: string) => teams.find((team) => `#team/${team.abbrev}` === hash)?.abbrev ?? null
export const teamFromPath = (path: string) => teams.find((team) => teamHref(team.abbrev) === path.replace(/\/$/, '').replace(/\.html$/, ''))?.abbrev ?? null
export const teamFromLocation = ({ pathname, hash }: { pathname: string; hash: string }) => hash === '#poster' ? null : teamFromHash(hash) ?? teamFromPath(pathname)
export const teamLogo = (team: string, theme: string) => `/assets/teams/${theme === 'light' && team === 'TBL' ? 'TBL-light' : team === 'TOR' && theme === 'light' ? 'TOR-inverted' : team === 'WSH' ? 'WSH-alt' : team}.svg`
