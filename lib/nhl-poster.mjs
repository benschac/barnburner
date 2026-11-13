import { SEASON } from './nhl-games.mjs'

export const standingsUrl = (date) => `https://api-web.nhle.com/v1/standings/${date}`
export const clubStatsUrl = (team) => `https://api-web.nhle.com/v1/club-stats/${team}/${SEASON}/2`
export const teamSummaryUrl = `https://api.nhle.com/stats/rest/en/team/summary?limit=-1&cayenneExp=seasonId%3D${SEASON}%20and%20gameTypeId%3D2`

function requireValue(condition, message) {
  if (!condition) throw new Error(message)
}

const integer = (value) => Number.isSafeInteger(value) && value >= 0
const fraction = (value) => Number.isFinite(value) && value >= 0 && value <= 1
const text = (value) => typeof value === 'string' && value.trim().length > 0
const date = (value) => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value

export function completedDates(snapshot) {
  return [...new Set(snapshot.games.filter((game) => game.result !== null).map((game) => game.date))].sort()
}

function coverage(rows, teams, label) {
  requireValue(Array.isArray(rows) && rows.length === teams.length && new Set(rows.map((row) => row.team)).size === teams.length && teams.every(({ abbrev }) => rows.some((row) => row.team === abbrev)), `Incomplete ${label} team coverage`)
}

export function normalizeStandings(raw, teams, expectedDate) {
  requireValue(Array.isArray(raw?.standings), 'Missing standings')
  const rows = raw.standings.map((row) => {
    requireValue(row.seasonId === SEASON && row.gameTypeId === 2 && row.date === expectedDate, 'Wrong standings season, game type or date')
    return {
      team: row.teamAbbrev?.default,
      date: row.date,
      divisionSequence: row.divisionSequence,
      wildcardSequence: row.wildcardSequence,
      points: row.points,
      played: row.gamesPlayed,
    }
  })
  validateStandings(rows, teams, expectedDate)
  return rows.sort((a, b) => a.team.localeCompare(b.team))
}

function validateStandings(rows, teams, expectedDate) {
  coverage(rows, teams, 'standings')
  requireValue(date(expectedDate), 'Invalid standings date')
  for (const row of rows) {
    requireValue(row.date === expectedDate && integer(row.divisionSequence) && row.divisionSequence > 0 && integer(row.wildcardSequence) && integer(row.points) && integer(row.played) && row.points <= row.played * 2, `Invalid standings for ${row.team}`)
  }
}

function normalizePlayer(player) {
  requireValue(integer(player.playerId) && text(player.firstName?.default) && text(player.lastName?.default) && integer(player.gamesPlayed), 'Invalid player identity')
  requireValue(typeof player.headshot === 'string' && /^https:\/\/assets\.nhle\.com\/mugs\/nhl\/[A-Za-z0-9/_-]+\.png$/.test(player.headshot), 'Invalid player portrait')
  return { name: `${player.firstName.default[0]}. ${player.lastName.default}`, portrait: player.headshot }
}

export function normalizeLeaders(raw, expectedPlayed) {
  requireValue(String(raw?.season) === String(SEASON) && raw.gameType === 2 && Array.isArray(raw.skaters) && Array.isArray(raw.goalies), 'Invalid club stats season or arrays')
  const skaters = raw.skaters.map((player) => {
    const identity = normalizePlayer(player)
    requireValue(['goals', 'assists', 'points', 'shots'].every((key) => integer(player[key])) && fraction(player.shootingPctg) && player.points === player.goals + player.assists && player.gamesPlayed <= expectedPlayed, 'Invalid skater statistics')
    return { ...player, ...identity }
  }).filter((player) => player.gamesPlayed > 0)
  const goalies = raw.goalies.map((player) => {
    const identity = normalizePlayer(player)
    requireValue(fraction(player.savePercentage) && Number.isFinite(player.goalsAgainstAverage) && player.goalsAgainstAverage >= 0 && player.gamesPlayed <= expectedPlayed, 'Invalid goalie statistics')
    return { ...player, ...identity }
  }).filter((player) => player.gamesPlayed > 0)
  if (expectedPlayed === 0) return []
  requireValue(skaters.length > 0 && goalies.length > 0, 'Missing player leaders')
  const pick = (players, field) => players.toSorted((a, b) => b[field] - a[field] || b.gamesPlayed - a.gamesPlayed || a.playerId - b.playerId)[0]
  const points = pick(skaters, 'points')
  const shots = pick(skaters, 'shots')
  const saves = pick(goalies, 'savePercentage')
  return [
    { label: 'POINTS', name: points.name, portrait: points.portrait, detail: `${points.goals} goals, ${points.assists} assists`, value: String(points.points) },
    { label: 'SHOTS ON GOAL', name: shots.name, portrait: shots.portrait, detail: `${shots.goals} goals, ${(shots.shootingPctg * 100).toFixed(1)}% shooting`, value: String(shots.shots) },
    { label: 'SAVE PERCENTAGE', name: saves.name, portrait: saves.portrait, detail: `${saves.gamesPlayed} games, ${saves.goalsAgainstAverage.toFixed(2)} GAA`, value: saves.savePercentage.toFixed(3).replace(/^0/, '') },
  ]
}

export function buildPosterSnapshot({ games, standingsByDate, summary, clubStats, fetchedAt }) {
  const dates = completedDates(games)
  requireValue(dates.length > 0, 'No completed games for poster snapshot')
  requireValue(standingsByDate instanceof Map && standingsByDate.size === dates.length && dates.every((day) => standingsByDate.has(day)), 'Incomplete standings history')
  const history = dates.map((day) => ({ date: day, standings: normalizeStandings(standingsByDate.get(day), games.teams, day) }))
  const standings = history.at(-1).standings
  validateStandingsAgainstGames(standings, games)
  requireValue(Array.isArray(summary?.data) && summary.data.length === games.teams.length, 'Incomplete team summary')
  const summaries = games.teams.map((team) => {
    const matching = summary.data.filter((row) => row.teamFullName === team.name)
    requireValue(matching.length === 1, `Missing or duplicate summary for ${team.abbrev}`)
    const row = matching[0]
    requireValue(row.seasonId === SEASON && integer(row.gamesPlayed) && fraction(row.powerPlayPct) && fraction(row.penaltyKillPct), `Invalid summary for ${team.abbrev}`)
    const standing = standings.find((standing) => standing.team === team.abbrev)
    requireValue(row.gamesPlayed === standing.played, `Invalid or stale summary for ${team.abbrev} on ${standing.date}: summary has ${row.gamesPlayed} games played; standings has ${standing.played} games played. NHL feeds may update at different times; retry after the feeds settle.`)
    return { ...row, team: team.abbrev }
  })
  requireValue(clubStats instanceof Map && clubStats.size === games.teams.length && games.teams.every(({ abbrev }) => clubStats.has(abbrev)), 'Incomplete club stats')
  const clubs = summaries.map((row) => ({
    team: row.team,
    specialTeams: [
      { label: 'POWER PLAY', rank: summaries.filter((other) => other.powerPlayPct > row.powerPlayPct).length + 1, value: row.powerPlayPct * 100 },
      { label: 'PENALTY KILL', rank: summaries.filter((other) => other.penaltyKillPct > row.penaltyKillPct).length + 1, value: row.penaltyKillPct * 100 },
    ],
    leaders: normalizeLeaders(clubStats.get(row.team), row.gamesPlayed),
  }))
  const snapshot = { schemaVersion: 1, season: SEASON, fetchedAt, standings, history, clubs }
  validatePosterSnapshot(snapshot, games.teams, dates)
  return snapshot
}

export function validateStandingsAgainstGames(standings, games) {
  for (const row of standings) {
    const finals = games.games.filter((game) => game.result && (game.homeTeam === row.team || game.awayTeam === row.team))
    const points = finals.reduce((total, game) => {
      const home = game.homeTeam === row.team
      const scored = home ? game.result.homeScore : game.result.awayScore
      const conceded = home ? game.result.awayScore : game.result.homeScore
      return total + (scored > conceded ? 2 : game.result.decision === 'REG' ? 0 : 1)
    }, 0)
    requireValue(row.played === finals.length && row.points === points, `Standings and games disagree for ${row.team} on ${row.date}: standings has ${row.played} games played and ${row.points} points; completed schedule has ${finals.length} games played and ${points} points. NHL feeds may update at different times; retry after the feeds settle.`)
  }
}

export function validatePosterSnapshot(snapshot, teams, expectedDates) {
  requireValue(snapshot?.schemaVersion === 1 && snapshot.season === SEASON, 'Unsupported poster snapshot')
  requireValue(typeof snapshot.fetchedAt === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(snapshot.fetchedAt) && Number.isFinite(Date.parse(snapshot.fetchedAt)), 'Invalid poster retrieval timestamp')
  requireValue(Array.isArray(snapshot.history) && snapshot.history.length > 0, 'Missing standings history')
  const dates = snapshot.history.map((entry) => entry.date)
  requireValue(new Set(dates).size === dates.length && dates.every((day, index) => date(day) && (index === 0 || day > dates[index - 1])), 'Invalid history dates')
  if (expectedDates) requireValue(JSON.stringify(dates) === JSON.stringify(expectedDates), 'Incomplete standings history')
  for (const entry of snapshot.history) validateStandings(entry.standings, teams, entry.date)
  validateStandings(snapshot.standings, teams, dates.at(-1))
  requireValue(JSON.stringify(snapshot.standings) === JSON.stringify(snapshot.history.at(-1).standings), 'Latest standings disagree with history')
  coverage(snapshot.clubs, teams, 'club stats')
  for (const club of snapshot.clubs) {
    requireValue(Array.isArray(club.specialTeams) && club.specialTeams.length === 2 && ['POWER PLAY', 'PENALTY KILL'].every((label) => club.specialTeams.some((entry) => entry.label === label)), `Invalid special teams for ${club.team}`)
    for (const entry of club.specialTeams) requireValue(integer(entry.rank) && entry.rank > 0 && entry.rank <= teams.length && Number.isFinite(entry.value) && entry.value >= 0 && entry.value <= 100, `Invalid special teams value for ${club.team}`)
    const played = snapshot.standings.find((row) => row.team === club.team).played
    requireValue(Array.isArray(club.leaders) && (played === 0 ? club.leaders.length === 0 : club.leaders.length === 3 && ['POINTS', 'SHOTS ON GOAL', 'SAVE PERCENTAGE'].every((label) => club.leaders.some((entry) => entry.label === label))), `Incomplete leaders for ${club.team}`)
    for (const leader of club.leaders) requireValue([leader.name, leader.detail, leader.value].every(text) && /^https:\/\/assets\.nhle\.com\/mugs\/nhl\/[A-Za-z0-9/_-]+\.png$/.test(leader.portrait), `Invalid leader for ${club.team}`)
  }
  return snapshot
}
