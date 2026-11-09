export type Outcome = 'win' | 'loss' | 'overtime' | 'pending'
type Venue = 'home' | 'away'

export type Matchup = {
  team: string
  games: { index: number; game: SeasonGame; outcome: Outcome }[]
}

type PlayoffComparison = {
  devilsPoints: number
  team: string
  teamPoints: number
  cutoff: 'first-team-out' | 'last-wild-card'
}

type GameResult = {
  goalsFor: number
  goalsAgainst: number
  decision: 'REG' | 'OT' | 'SO'
  comparison: PlayoffComparison
}

type SeasonGame = {
  id: number
  date: string
  startTime: string
  team: string
  venue: Venue
  result?: GameResult
}

// NHL regular-season schedule and same-day standings through Nov 8, 2026.
// Playoff margin compares the Devils with the first team out when in a playoff spot,
// or with the last wild card when outside. A zero indicates equal points.
export const seasonGames: readonly SeasonGame[] = [
  { id: 2026020009, date: '2026-10-01', startTime: '2026-10-01T23:00:00Z', team: 'PHI', venue: 'home', result: { goalsFor: 3, goalsAgainst: 2, decision: 'OT', comparison: { devilsPoints: 2, team: 'CAR', teamPoints: 1, cutoff: 'first-team-out' } } },
  { id: 2026020029, date: '2026-10-03', startTime: '2026-10-03T23:30:00Z', team: 'NYI', venue: 'away', result: { goalsFor: 0, goalsAgainst: 6, decision: 'REG', comparison: { devilsPoints: 2, team: 'NYI', teamPoints: 2, cutoff: 'last-wild-card' } } },
  { id: 2026020047, date: '2026-10-06', startTime: '2026-10-06T23:00:00Z', team: 'UTA', venue: 'home', result: { goalsFor: 3, goalsAgainst: 5, decision: 'REG', comparison: { devilsPoints: 2, team: 'TOR', teamPoints: 4, cutoff: 'last-wild-card' } } },
  { id: 2026020071, date: '2026-10-10', startTime: '2026-10-10T19:30:00Z', team: 'VAN', venue: 'home', result: { goalsFor: 4, goalsAgainst: 1, decision: 'REG', comparison: { devilsPoints: 4, team: 'WSH', teamPoints: 6, cutoff: 'last-wild-card' } } },
  { id: 2026020088, date: '2026-10-12', startTime: '2026-10-12T23:00:00Z', team: 'OTT', venue: 'home', result: { goalsFor: 1, goalsAgainst: 4, decision: 'REG', comparison: { devilsPoints: 4, team: 'WSH', teamPoints: 6, cutoff: 'last-wild-card' } } },
  { id: 2026020090, date: '2026-10-13', startTime: '2026-10-13T22:00:00Z', team: 'DET', venue: 'away', result: { goalsFor: 5, goalsAgainst: 4, decision: 'OT', comparison: { devilsPoints: 6, team: 'MTL', teamPoints: 7, cutoff: 'last-wild-card' } } },
  { id: 2026020113, date: '2026-10-15', startTime: '2026-10-15T23:00:00Z', team: 'NYR', venue: 'home', result: { goalsFor: 7, goalsAgainst: 1, decision: 'REG', comparison: { devilsPoints: 8, team: 'BUF', teamPoints: 9, cutoff: 'last-wild-card' } } },
  { id: 2026020121, date: '2026-10-17', startTime: '2026-10-17T17:00:00Z', team: 'WSH', venue: 'away', result: { goalsFor: 2, goalsAgainst: 4, decision: 'REG', comparison: { devilsPoints: 8, team: 'BUF', teamPoints: 10, cutoff: 'last-wild-card' } } },
  { id: 2026020142, date: '2026-10-20', startTime: '2026-10-20T23:00:00Z', team: 'COL', venue: 'home', result: { goalsFor: 4, goalsAgainst: 3, decision: 'REG', comparison: { devilsPoints: 10, team: 'TOR', teamPoints: 12, cutoff: 'last-wild-card' } } },
  { id: 2026020157, date: '2026-10-22', startTime: '2026-10-22T23:00:00Z', team: 'ANA', venue: 'home', result: { goalsFor: 4, goalsAgainst: 1, decision: 'REG', comparison: { devilsPoints: 12, team: 'FLA', teamPoints: 12, cutoff: 'first-team-out' } } },
  { id: 2026020169, date: '2026-10-24', startTime: '2026-10-24T19:30:00Z', team: 'LAK', venue: 'home', result: { goalsFor: 3, goalsAgainst: 1, decision: 'REG', comparison: { devilsPoints: 14, team: 'NYI', teamPoints: 12, cutoff: 'first-team-out' } } },
  { id: 2026020193, date: '2026-10-27', startTime: '2026-10-28T00:00:00Z', team: 'DAL', venue: 'away', result: { goalsFor: 5, goalsAgainst: 1, decision: 'REG', comparison: { devilsPoints: 16, team: 'TBL', teamPoints: 15, cutoff: 'first-team-out' } } },
  { id: 2026020201, date: '2026-10-28', startTime: '2026-10-29T01:00:00Z', team: 'COL', venue: 'away', result: { goalsFor: 2, goalsAgainst: 5, decision: 'REG', comparison: { devilsPoints: 16, team: 'TBL', teamPoints: 15, cutoff: 'first-team-out' } } },
  { id: 2026020214, date: '2026-10-30', startTime: '2026-10-30T22:00:00Z', team: 'VGK', venue: 'away', result: { goalsFor: 5, goalsAgainst: 2, decision: 'REG', comparison: { devilsPoints: 18, team: 'NYI', teamPoints: 16, cutoff: 'first-team-out' } } },
  { id: 2026020239, date: '2026-11-03', startTime: '2026-11-04T00:30:00Z', team: 'EDM', venue: 'home', result: { goalsFor: 4, goalsAgainst: 3, decision: 'SO', comparison: { devilsPoints: 20, team: 'TOR', teamPoints: 18, cutoff: 'first-team-out' } } },
  { id: 2026020254, date: '2026-11-05', startTime: '2026-11-06T00:00:00Z', team: 'STL', venue: 'home', result: { goalsFor: 5, goalsAgainst: 4, decision: 'OT', comparison: { devilsPoints: 22, team: 'TOR', teamPoints: 18, cutoff: 'first-team-out' } } },
  { id: 2026020270, date: '2026-11-07', startTime: '2026-11-08T00:00:00Z', team: 'NYI', venue: 'away', result: { goalsFor: 5, goalsAgainst: 4, decision: 'OT', comparison: { devilsPoints: 24, team: 'BUF', teamPoints: 19, cutoff: 'first-team-out' } } },
  { id: 2026020279, date: '2026-11-08', startTime: '2026-11-09T00:00:00Z', team: 'TOR', venue: 'away', result: { goalsFor: 4, goalsAgainst: 0, decision: 'REG', comparison: { devilsPoints: 26, team: 'BUF', teamPoints: 19, cutoff: 'first-team-out' } } },
  { id: 2026020291, date: '2026-11-10', startTime: '2026-11-11T00:00:00Z', team: 'WPG', venue: 'away' },
  { id: 2026020303, date: '2026-11-12', startTime: '2026-11-13T00:00:00Z', team: 'WSH', venue: 'home' },
  { id: 2026020318, date: '2026-11-14', startTime: '2026-11-15T00:00:00Z', team: 'WSH', venue: 'away' },
  { id: 2026020345, date: '2026-11-18', startTime: '2026-11-19T00:30:00Z', team: 'MTL', venue: 'home' },
  { id: 2026020368, date: '2026-11-21', startTime: '2026-11-22T00:00:00Z', team: 'STL', venue: 'away' },
  { id: 2026020378, date: '2026-11-23', startTime: '2026-11-24T00:00:00Z', team: 'CBJ', venue: 'home' },
  { id: 2026020393, date: '2026-11-25', startTime: '2026-11-26T00:00:00Z', team: 'CBJ', venue: 'away' },
  { id: 2026020401, date: '2026-11-27', startTime: '2026-11-27T18:00:00Z', team: 'CGY', venue: 'home' },
  { id: 2026020418, date: '2026-11-28', startTime: '2026-11-29T00:00:00Z', team: 'WPG', venue: 'home' },
  { id: 2026020437, date: '2026-12-01', startTime: '2026-12-02T00:30:00Z', team: 'SJS', venue: 'home' },
  { id: 2026020449, date: '2026-12-03', startTime: '2026-12-04T00:00:00Z', team: 'OTT', venue: 'away' },
  { id: 2026020467, date: '2026-12-05', startTime: '2026-12-05T20:00:00Z', team: 'PIT', venue: 'away' },
  { id: 2026020484, date: '2026-12-07', startTime: '2026-12-08T00:00:00Z', team: 'NYR', venue: 'away' },
  { id: 2026020496, date: '2026-12-09', startTime: '2026-12-10T00:00:00Z', team: 'DET', venue: 'home' },
  { id: 2026020514, date: '2026-12-12', startTime: '2026-12-12T18:00:00Z', team: 'BOS', venue: 'away' },
  { id: 2026020539, date: '2026-12-15', startTime: '2026-12-16T00:00:00Z', team: 'NYR', venue: 'home' },
  { id: 2026020553, date: '2026-12-17', startTime: '2026-12-18T00:30:00Z', team: 'TOR', venue: 'home' },
  { id: 2026020567, date: '2026-12-19', startTime: '2026-12-19T17:00:00Z', team: 'BOS', venue: 'home' },
  { id: 2026020581, date: '2026-12-20', startTime: '2026-12-21T00:00:00Z', team: 'NSH', venue: 'home' },
  { id: 2026020592, date: '2026-12-22', startTime: '2026-12-23T00:00:00Z', team: 'NYR', venue: 'away' },
  { id: 2026020603, date: '2026-12-26', startTime: '2026-12-27T00:00:00Z', team: 'BUF', venue: 'away' },
  { id: 2026020616, date: '2026-12-27', startTime: '2026-12-28T00:00:00Z', team: 'BOS', venue: 'home' },
  { id: 2026020634, date: '2026-12-29', startTime: '2026-12-30T02:00:00Z', team: 'UTA', venue: 'away' },
  { id: 2026020652, date: '2027-01-01', startTime: '2027-01-01T21:00:00Z', team: 'ANA', venue: 'away' },
  { id: 2026020665, date: '2027-01-02', startTime: '2027-01-03T02:00:00Z', team: 'LAK', venue: 'away' },
  { id: 2026020680, date: '2027-01-04', startTime: '2027-01-05T03:00:00Z', team: 'SJS', venue: 'away' },
  { id: 2026020695, date: '2027-01-07', startTime: '2027-01-08T00:00:00Z', team: 'CBJ', venue: 'home' },
  { id: 2026020709, date: '2027-01-09', startTime: '2027-01-09T17:00:00Z', team: 'CHI', venue: 'home' },
  { id: 2026020729, date: '2027-01-12', startTime: '2027-01-13T00:00:00Z', team: 'BUF', venue: 'away' },
  { id: 2026020738, date: '2027-01-13', startTime: '2027-01-14T00:00:00Z', team: 'MTL', venue: 'away' },
  { id: 2026020763, date: '2027-01-16', startTime: '2027-01-17T00:00:00Z', team: 'NYI', venue: 'home' },
  { id: 2026020787, date: '2027-01-19', startTime: '2027-01-20T00:00:00Z', team: 'DAL', venue: 'home' },
  { id: 2026020801, date: '2027-01-21', startTime: '2027-01-22T00:00:00Z', team: 'TBL', venue: 'home' },
  { id: 2026020820, date: '2027-01-23', startTime: '2027-01-24T00:30:00Z', team: 'PHI', venue: 'away' },
  { id: 2026020828, date: '2027-01-24', startTime: '2027-01-25T00:00:00Z', team: 'WSH', venue: 'home' },
  { id: 2026020838, date: '2027-01-26', startTime: '2027-01-27T00:00:00Z', team: 'SEA', venue: 'home' },
  { id: 2026020856, date: '2027-01-28', startTime: '2027-01-29T01:00:00Z', team: 'EDM', venue: 'away' },
  { id: 2026020866, date: '2027-01-30', startTime: '2027-01-30T20:30:00Z', team: 'CGY', venue: 'away' },
  { id: 2026020879, date: '2027-01-31', startTime: '2027-01-31T21:00:00Z', team: 'SEA', venue: 'away' },
  { id: 2026020893, date: '2027-02-03', startTime: '2027-02-04T02:00:00Z', team: 'VAN', venue: 'away' },
  { id: 2026020923, date: '2027-02-13', startTime: '2027-02-14T00:30:00Z', team: 'PHI', venue: 'away' },
  { id: 2026020942, date: '2027-02-16', startTime: '2027-02-17T01:00:00Z', team: 'NSH', venue: 'away' },
  { id: 2026020954, date: '2027-02-18', startTime: '2027-02-19T00:00:00Z', team: 'FLA', venue: 'away' },
  { id: 2026020968, date: '2027-02-20', startTime: '2027-02-20T18:30:00Z', team: 'BUF', venue: 'home' },
  { id: 2026020979, date: '2027-02-21', startTime: '2027-02-21T23:00:00Z', team: 'CHI', venue: 'away' },
  { id: 2026020993, date: '2027-02-23', startTime: '2027-02-24T00:30:00Z', team: 'CAR', venue: 'home' },
  { id: 2026021015, date: '2027-02-26', startTime: '2027-02-27T00:00:00Z', team: 'CBJ', venue: 'away' },
  { id: 2026021032, date: '2027-02-28', startTime: '2027-02-28T20:30:00Z', team: 'MIN', venue: 'away' },
  { id: 2026021045, date: '2027-03-02', startTime: '2027-03-03T00:00:00Z', team: 'OTT', venue: 'home' },
  { id: 2026021059, date: '2027-03-04', startTime: '2027-03-04T23:00:00Z', team: 'DET', venue: 'away' },
  { id: 2026021063, date: '2027-03-05', startTime: '2027-03-06T00:00:00Z', team: 'VGK', venue: 'home' },
  { id: 2026021093, date: '2027-03-09', startTime: '2027-03-10T00:00:00Z', team: 'FLA', venue: 'away' },
  { id: 2026021108, date: '2027-03-11', startTime: '2027-03-12T00:00:00Z', team: 'TBL', venue: 'away' },
  { id: 2026021128, date: '2027-03-13', startTime: '2027-03-14T00:00:00Z', team: 'CAR', venue: 'away' },
  { id: 2026021164, date: '2027-03-18', startTime: '2027-03-18T23:00:00Z', team: 'PIT', venue: 'home' },
  { id: 2026021180, date: '2027-03-20', startTime: '2027-03-20T23:00:00Z', team: 'TOR', venue: 'home' },
  { id: 2026021198, date: '2027-03-23', startTime: '2027-03-23T23:00:00Z', team: 'PHI', venue: 'home' },
  { id: 2026021215, date: '2027-03-25', startTime: '2027-03-25T23:00:00Z', team: 'PIT', venue: 'away' },
  { id: 2026021232, date: '2027-03-27', startTime: '2027-03-27T23:00:00Z', team: 'MTL', venue: 'away' },
  { id: 2026021244, date: '2027-03-29', startTime: '2027-03-29T23:00:00Z', team: 'CAR', venue: 'home' },
  { id: 2026021259, date: '2027-03-31', startTime: '2027-03-31T23:30:00Z', team: 'MIN', venue: 'home' },
  { id: 2026021281, date: '2027-04-03', startTime: '2027-04-03T21:00:00Z', team: 'CAR', venue: 'away' },
  { id: 2026021291, date: '2027-04-04', startTime: '2027-04-04T20:30:00Z', team: 'FLA', venue: 'home' },
  { id: 2026021303, date: '2027-04-06', startTime: '2027-04-06T23:30:00Z', team: 'TBL', venue: 'home' },
  { id: 2026021318, date: '2027-04-08', startTime: '2027-04-08T23:00:00Z', team: 'NYI', venue: 'home' },
  { id: 2026021335, date: '2027-04-10', startTime: '2027-04-10T22:00:00Z', team: 'PIT', venue: 'home' },
]

export const seasonSummary = {
  throughDate: '2026-11-08',
  record: '13-5-0',
  points: 26,
  divisionPlace: '2nd',
  streak: 'won 5 straight',
  home: '8-2-0',
  road: '5-3-0',
  lastTen: '9-1-0',
}

export const standings = [
  { seed: 'M1', team: 'CAR', played: 19, points: 30 },
  { seed: 'M2', team: 'NJD', played: 18, points: 26 },
  { seed: 'M3', team: 'NYR', played: 18, points: 21 },
  { seed: 'WC1', team: 'OTT', played: 18, points: 23 },
  { seed: 'WC2', team: 'FLA', played: 18, points: 20 },
  { seed: '', team: 'BUF', played: 17, points: 19 },
  { seed: '', team: 'WSH', played: 15, points: 18 },
  { seed: '', team: 'TOR', played: 19, points: 18 },
]

export const specialTeams = [
  { label: 'POWER PLAY', rank: '24th', value: '19.3' },
  { label: 'PENALTY KILL', rank: '29th', value: '67.6' },
]

export const leaders = [
  { label: 'POINTS', name: 'J. Hughes', portrait: 'hughes', detail: '9 goals, 16 assists', value: '25' },
  { label: 'SHOTS ON GOAL', name: 'J. Hughes', portrait: 'hughes', detail: '9 goals, 12.3% shooting', value: '73' },
  { label: 'SAVE PERCENTAGE', name: 'C. Hellebuyck', portrait: 'hellebuyck', detail: '5 games, 1.96 GAA', value: '.913' },
]

const easternTime = new Intl.DateTimeFormat('en-US', {
  hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York',
})
const shortDate = new Intl.DateTimeFormat('en-US', {
  month: 'short', day: 'numeric', timeZone: 'UTC',
})
const weekday = new Intl.DateTimeFormat('en-US', {
  weekday: 'short', timeZone: 'UTC',
})
const longDate = new Intl.DateTimeFormat('en-US', {
  weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC',
})

export const snapshotDate = longDate.format(new Date(seasonSummary.throughDate))

export function gameDateTime(game: SeasonGame) {
  return `${shortDate.format(new Date(game.date))}, ${easternTime.format(new Date(game.startTime))} ET`
}

function gameOutcome(game: SeasonGame): Outcome {
  if (!game.result) return 'pending'
  if (game.result.goalsFor > game.result.goalsAgainst) return 'win'
  return game.result.decision === 'REG' ? 'loss' : 'overtime'
}

const divisionTeams = [
  { name: 'Atlantic', teams: ['BOS', 'MTL', 'TBL', 'OTT', 'FLA', 'BUF', 'TOR', 'DET'] },
  { name: 'Pacific', teams: ['EDM', 'VGK', 'SEA', 'ANA', 'CGY', 'SJS', 'LAK', 'VAN'] },
  { name: 'Metropolitan', teams: ['CAR', 'NYR', 'WSH', 'NYI', 'CBJ', 'PIT', 'PHI'] },
  { name: 'Central', teams: ['MIN', 'DAL', 'COL', 'NSH', 'UTA', 'STL', 'WPG', 'CHI'] },
]

export const divisions = divisionTeams.map(({ name, teams }) => {
  const matchups: Matchup[] = teams.map((team) => ({
    team,
    games: seasonGames.flatMap((game, index) =>
      game.team === team ? [{ index, game, outcome: gameOutcome(game) }] : []),
  }))
  const outcomes = matchups.flatMap((matchup) => matchup.games.map((game) => game.outcome))
  const record = ['win', 'loss', 'overtime'].map((outcome) => outcomes.filter((value) => value === outcome).length).join('-')
  return { name, record, teams: matchups }
})

export const completedGames = seasonGames.filter((game) => game.result !== undefined)

const latestPlayoffComparison = completedGames.at(-1)?.result?.comparison
export const latestPlayoffCushion = latestPlayoffComparison && describePlayoffComparison(latestPlayoffComparison)

export function playoffGap({ devilsPoints, teamPoints }: PlayoffComparison) {
  return devilsPoints - teamPoints
}

export function describePlayoffComparison(comparison: PlayoffComparison) {
  const gap = playoffGap(comparison)
  const signedGap = gap > 0 ? `+${gap}` : `${gap}`
  const cutoff = comparison.cutoff === 'first-team-out' ? 'first team out' : 'last wild card'
  return {
    signedGap,
    equation: `NJD ${comparison.devilsPoints} pts − ${comparison.team} ${comparison.teamPoints} pts (${cutoff}) = ${signedGap}`,
  }
}

export const recent = completedGames.slice(-5).reverse().flatMap((game) => {
  if (!game.result) return []
  const { goalsFor, goalsAgainst, decision } = game.result
  return [{
    id: game.id,
    team: game.team,
    outcome: gameOutcome(game),
    score: `${goalsFor}-${goalsAgainst}`,
    extra: decision === 'REG' ? '' : decision,
  }]
})

export const upcoming = seasonGames.filter((game) => !game.result).slice(0, 5).map((game) => ({
  id: game.id,
  team: game.team,
  venue: game.venue === 'home' ? 'vs' : '@',
  date: Number(game.date.slice(-2)),
  day: weekday.format(new Date(game.date)).toUpperCase(),
  time: easternTime.format(new Date(game.startTime)),
}))
