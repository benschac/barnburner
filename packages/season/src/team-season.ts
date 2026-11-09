import { Schema } from 'effect'
import teamData from '../../../data/teams.json' with { type: 'json' }

export const teams = teamData

const TeamCode = Schema.String.check(Schema.makeFilter((value) => teams.some((team) => team.abbrev === value)))
const DateText = Schema.String.check(Schema.makeFilter((value) => /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value))
const Timestamp = Schema.String.check(Schema.makeFilter((value) => /^\d{4}-\d{2}-\d{2}T/.test(value) && Number.isFinite(Date.parse(value))))

const GameResult = Schema.Struct({
  homeScore: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
  awayScore: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
  decision: Schema.Literals(['REG', 'OT', 'SO']),
})
export const SeasonGame = Schema.Struct({
  id: Schema.Int,
  date: DateText,
  startTimeUTC: Timestamp,
  state: Schema.String,
  scheduleState: Schema.String,
  homeTeam: TeamCode,
  awayTeam: TeamCode,
  result: Schema.NullOr(GameResult),
})
export const SeasonSnapshot = Schema.Struct({
  schemaVersion: Schema.Literal(1),
  season: Schema.Int,
  fetchedAt: Timestamp,
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

const NonnegativeInt = Schema.Int.check(Schema.isGreaterThanOrEqualTo(0))
const Standing = Schema.Struct({
  team: TeamCode,
  date: DateText,
  divisionSequence: Schema.Int.check(Schema.isBetween({ minimum: 1, maximum: 8 })),
  wildcardSequence: NonnegativeInt,
  points: NonnegativeInt,
  played: NonnegativeInt,
})
export const PosterSnapshot = Schema.Struct({
  schemaVersion: Schema.Literal(1),
  season: Schema.Int,
  fetchedAt: Timestamp,
  standings: Schema.Array(Standing),
  history: Schema.Array(Schema.Struct({ date: DateText, standings: Schema.Array(Standing) })),
  clubs: Schema.Array(Schema.Struct({
    team: TeamCode,
    specialTeams: Schema.Array(Schema.Struct({
      label: Schema.String,
      rank: Schema.Int.check(Schema.isBetween({ minimum: 1, maximum: 32 })),
      value: Schema.Number.check(Schema.isBetween({ minimum: 0, maximum: 100 })),
    })),
    leaders: Schema.Array(Schema.Struct({
      label: Schema.String, name: Schema.String, portrait: Schema.String, detail: Schema.String, value: Schema.String,
    })),
  })),
})
export type PosterSnapshot = typeof PosterSnapshot.Type
export type Standing = typeof Standing.Type
export const TeamData = Schema.Struct({ season: SeasonSnapshot, poster: PosterSnapshot }).check(
  Schema.makeFilter((data) => data.season.season === data.poster.season &&
    teams.every(({ abbrev }) => {
      const rows = data.poster.standings.filter((row) => row.team === abbrev)
      const season = teamSeason(data.season, abbrev)
      return data.poster.clubs.filter((club) => club.team === abbrev).length === 1 && rows.length === 1 &&
        rows[0].played === season.played && rows[0].points === season.points
    })),
)
export type TeamData = typeof TeamData.Type
