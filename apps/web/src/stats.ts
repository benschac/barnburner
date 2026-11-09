import { teams, teamSeason } from './team-season.ts'
import type { Standing, TeamData, TeamGame } from './team-season.ts'

export type Outcome = TeamGame['outcome']
export type PlayoffComparison = {
  selectedTeam: string
  selectedPoints: number
  team: string
  teamPoints: number
  cutoff: 'first-team-out' | 'last-wild-card'
}
export type SeasonGame = {
  id: number
  date: string
  startTime: string
  team: string
  venue: 'home' | 'away'
  result?: { goalsFor: number; goalsAgainst: number; decision: 'REG' | 'OT' | 'SO'; comparison?: PlayoffComparison }
}
export type Matchup = { team: string; games: { index: number; game: SeasonGame; outcome: Outcome }[] }

const easternTime = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York' })
const shortDate = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
const weekday = new Intl.DateTimeFormat('en-US', { weekday: 'short', timeZone: 'UTC' })
const longDate = new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC' })
const retrievedDate = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York' })

export function ordinal(value: number) {
  const lastTwo = value % 100
  return `${value}${lastTwo >= 11 && lastTwo <= 13 ? 'th' : value % 10 === 1 ? 'st' : value % 10 === 2 ? 'nd' : value % 10 === 3 ? 'rd' : 'th'}`
}
export function gameDateTime(game: SeasonGame) {
  return `${shortDate.format(new Date(game.date))}, ${easternTime.format(new Date(game.startTime))} ET`
}
export function playoffGap({ selectedPoints, teamPoints }: PlayoffComparison) {
  return selectedPoints - teamPoints
}
export function describePlayoffComparison(comparison: PlayoffComparison) {
  const gap = playoffGap(comparison)
  const signedGap = gap > 0 ? `+${gap}` : `${gap}`
  const cutoff = comparison.cutoff === 'first-team-out' ? 'first team out' : 'last wild card'
  return { signedGap, equation: `${comparison.selectedTeam} ${comparison.selectedPoints} pts − ${comparison.team} ${comparison.teamPoints} pts (${cutoff}) = ${signedGap}` }
}
export function playoffComparison(standings: readonly Standing[], team: string): PlayoffComparison | undefined {
  const metadata = teams.find((entry) => entry.abbrev === team)
  const selected = standings.find((entry) => entry.team === team)
  if (!metadata || !selected) return undefined
  const qualified = selected.divisionSequence <= 3 || (selected.wildcardSequence > 0 && selected.wildcardSequence <= 2)
  const comparison = standings.find((entry) => entry.wildcardSequence === (qualified ? 3 : 2) &&
    teams.find((club) => club.abbrev === entry.team)?.conference === metadata.conference)
  if (!comparison) return undefined
  return { selectedTeam: team, selectedPoints: selected.points, team: comparison.team, teamPoints: comparison.points, cutoff: qualified ? 'first-team-out' : 'last-wild-card' }
}
function record(games: readonly TeamGame[]) {
  return ['win', 'loss', 'overtime'].map((outcome) => games.filter((game) => game.outcome === outcome).length).join('-')
}

export function teamPoster(data: TeamData, selectedTeam: string) {
  const metadata = teams.find((entry) => entry.abbrev === selectedTeam)
  if (!metadata) throw new Error(`Unknown team: ${selectedTeam}`)
  const season = teamSeason(data.season, selectedTeam)
  const final = season.games.filter((game) => game.outcome !== 'pending')
  const history = new Map(data.poster.history.map((day) => [day.date, day.standings]))
  const seasonGames: SeasonGame[] = season.games.map(({ game, opponent, venue, goalsFor, goalsAgainst }) => ({
    id: game.id, date: game.date, startTime: game.startTimeUTC, team: opponent, venue,
    result: goalsFor !== null && goalsAgainst !== null && game.result
      ? { goalsFor, goalsAgainst, decision: game.result.decision, comparison: playoffComparison(history.get(game.date) ?? [], selectedTeam) }
      : undefined,
  }))
  const completedGames = seasonGames.filter((game) => game.result)
  const currentStanding = data.poster.standings.find((entry) => entry.team === selectedTeam)
  const latestComparison = playoffComparison(data.poster.standings, selectedTeam)
  const latestPlayoffCushion = latestComparison && describePlayoffComparison(latestComparison)
  const divisionStandings = data.poster.standings.filter((entry) =>
    teams.find((team) => team.abbrev === entry.team)?.division === metadata.division && entry.divisionSequence <= 3)
    .sort((a, b) => a.divisionSequence - b.divisionSequence)
  const wildcards = data.poster.standings.filter((entry) =>
    teams.find((team) => team.abbrev === entry.team)?.conference === metadata.conference && entry.wildcardSequence > 0)
    .sort((a, b) => a.wildcardSequence - b.wildcardSequence)
  const cutoffRows = wildcards.slice(0, 5)
  const selectedWildcard = wildcards.find((row) => row.team === selectedTeam)
  if (selectedWildcard && !cutoffRows.includes(selectedWildcard)) cutoffRows.push(selectedWildcard)
  const standings = [...divisionStandings.map((entry) => ({ team: entry.team, played: entry.played, points: entry.points, seed: `${metadata.division[0]}${entry.divisionSequence}` })),
    ...cutoffRows.map((entry) => ({ team: entry.team, played: entry.played, points: entry.points, seed: entry.wildcardSequence <= 2 ? `WC${entry.wildcardSequence}` : '' }))]
  const lastOutcome = final.at(-1)?.outcome
  const streakLength = lastOutcome ? final.toReversed().findIndex((game) => game.outcome !== lastOutcome) : 0
  const streakCount = streakLength === -1 ? final.length : streakLength
  const streak = !lastOutcome ? 'no final games yet' : `${lastOutcome === 'win' ? 'won' : lastOutcome === 'overtime' ? 'OT/SO losses in' : 'lost'} ${streakCount} straight`
  const throughDate = currentStanding?.date ?? data.season.fetchedAt.slice(0, 10)
  const club = data.poster.clubs.find((entry) => entry.team === selectedTeam)
  const divisions = ['Atlantic', 'Pacific', 'Metropolitan', 'Central'].map((name) => {
    const opponents = teams.filter((entry) => entry.division === name && entry.abbrev !== selectedTeam)
    const matchups: Matchup[] = opponents.map((opponent) => ({
      team: opponent.abbrev,
      games: seasonGames.flatMap((game, index) => game.team === opponent.abbrev ? [{ game, index, outcome: season.games[index].outcome }] : []),
    }))
    const divisionGames = season.games.filter((game) => opponents.some((opponent) => opponent.abbrev === game.opponent))
    return { name, record: record(divisionGames), teams: matchups }
  })
  const recent = final.slice(-5).reverse().map((game) => ({
    id: game.game.id, team: game.opponent, outcome: game.outcome,
    score: `${game.goalsFor}-${game.goalsAgainst}`, extra: game.game.result?.decision === 'REG' ? '' : game.game.result?.decision,
  }))
  const upcoming = season.games.filter((game) => game.outcome === 'pending').slice(0, 5).map(({ game, opponent, venue }) => ({
    id: game.id, team: opponent, venue: venue === 'home' ? 'vs' : '@', date: Number(game.date.slice(-2)),
    day: weekday.format(new Date(game.date)).toUpperCase(),
    time: game.scheduleState === 'PPD' ? 'Postponed' : easternTime.format(new Date(game.startTimeUTC)),
  }))
  return {
    team: metadata, seasonGames, completedGames, divisions, standings, recent, upcoming, latestPlayoffCushion,
    specialTeams: club?.specialTeams.map((entry) => ({ label: entry.label, rank: ordinal(entry.rank), value: entry.value.toFixed(1) })) ?? [],
    leaders: club?.leaders ?? [],
    snapshotDate: longDate.format(new Date(throughDate)),
    fetchedAt: retrievedDate.format(new Date(data.season.fetchedAt)),
    posterFetchedAt: retrievedDate.format(new Date(data.poster.fetchedAt)),
    seasonSummary: {
      record: record(final), points: season.points, divisionPlace: currentStanding ? ordinal(currentStanding.divisionSequence) : 'Unranked',
      home: record(final.filter((game) => game.venue === 'home')), road: record(final.filter((game) => game.venue === 'away')),
      lastTen: record(final.slice(-10)), streak,
    },
  }
}
export type TeamPosterData = ReturnType<typeof teamPoster>
