import { Schema } from 'effect'
import teamData from '../../../data/teams.json' with { type: 'json' }

export const teams = teamData
export const teamHref = (team: string) => `#team/${team}`
export const posterHref = '#poster'
export const teamFromHash = (hash: string) => teams.find((team) => teamHref(team.abbrev) === hash)?.abbrev ?? null
export const teamLogo = (team: string, theme: string) => `/assets/teams/${team === 'TOR' && theme === 'light' ? 'TOR-inverted' : team === 'WSH' ? 'WSH-alt' : team}.svg`

const GameResult = Schema.Struct({
  homeScore: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
  awayScore: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
  decision: Schema.Literals(['REG', 'OT', 'SO']),
})
export const SeasonGame = Schema.Struct({
  id: Schema.Int,
  date: Schema.String,
  startTimeUTC: Schema.String,
  state: Schema.String,
  scheduleState: Schema.String,
  homeTeam: Schema.String,
  awayTeam: Schema.String,
  result: Schema.NullOr(GameResult),
})
export const SeasonSnapshot = Schema.Struct({
  schemaVersion: Schema.Literal(1),
  season: Schema.Int,
  fetchedAt: Schema.String,
  games: Schema.Array(SeasonGame),
})
export type SeasonSnapshot = typeof SeasonSnapshot.Type
export type SeasonGame = typeof SeasonGame.Type
export type TeamGame = {
  game: SeasonGame
  opponent: string
  venue: 'home' | 'away'
  outcome: 'win' | 'loss' | 'overtime' | 'pending'
  goalsFor: number | null
  goalsAgainst: number | null
}

export function teamSeason(snapshot: SeasonSnapshot, team: string) {
  const games: TeamGame[] = snapshot.games
    .filter((game) => game.homeTeam === team || game.awayTeam === team)
    .map((game): TeamGame => {
      const home = game.homeTeam === team
      const result = game.state === 'OFF' || game.state === 'FINAL' ? game.result : null
      const goalsFor = result ? (home ? result.homeScore : result.awayScore) : null
      const goalsAgainst = result ? (home ? result.awayScore : result.homeScore) : null
      return {
        game,
        opponent: home ? game.awayTeam : game.homeTeam,
        venue: home ? 'home' : 'away',
        outcome: goalsFor === null || goalsAgainst === null || !result ? 'pending'
          : goalsFor > goalsAgainst ? 'win' : result.decision === 'REG' ? 'loss' : 'overtime',
        goalsFor,
        goalsAgainst,
      }
    })
    .sort((a, b) => a.game.startTimeUTC.localeCompare(b.game.startTimeUTC) || a.game.id - b.game.id)
  const wins = games.filter((game) => game.outcome === 'win').length
  const losses = games.filter((game) => game.outcome === 'loss').length
  const overtime = games.filter((game) => game.outcome === 'overtime').length
  return { games, wins, losses, overtime, played: wins + losses + overtime, points: wins * 2 + overtime }
}
