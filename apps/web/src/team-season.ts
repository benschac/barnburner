import { teams } from '@nhl-reddit-stats/season'

export { teams } from '@nhl-reddit-stats/season'
export const teamHref = (team: string) => `#team/${team}`
export const posterHref = '#poster'
export const teamFromHash = (hash: string) => teams.find((team) => teamHref(team.abbrev) === hash)?.abbrev ?? null
export const teamLogo = (team: string, theme: string) => `/assets/teams/${theme === 'light' && team === 'TBL' ? 'TBL-light' : team === 'TOR' && theme === 'light' ? 'TOR-inverted' : team === 'WSH' ? 'WSH-alt' : team}.svg`
