/** @typedef {{abbrev: string, name: string, conference: string, division: string}} Team */
/** @typedef {{homeScore: number, awayScore: number, decision: 'REG'|'OT'|'SO'}} Result */
/** @typedef {{id: number, season: number, gameType: 2, date: string, startTimeUTC: string, state: string, scheduleState: string, homeTeam: string, awayTeam: string, result: Result|null}} Game */
/** @typedef {{schemaVersion: 1, season: number, fetchedAt: string, sources: string[], teams: Team[], games: Game[]}} Snapshot */

export const SEASON = 20262027
export const GAMES_PER_TEAM = 84

function requireValue(condition, message) {
  if (!condition) throw new Error(message)
}

function text(value) {
  return typeof value === 'string' && value.length > 0
}

function timestamp(value) {
  if (typeof value !== 'string') return false
  const match = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,9})?(?:Z|[+-](\d{2}):(\d{2}))$/.exec(value)
  return Boolean(match && date(match[1]) && Number(match[2]) < 24 && Number(match[3]) < 60 && Number(match[4]) < 60 && Number(match[5] ?? 0) < 24 && Number(match[6] ?? 0) < 60 && Number.isFinite(Date.parse(value)))
}

function date(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value
}

function score(value) {
  return Number.isSafeInteger(value) && value >= 0
}

export function scheduleUrl(team) {
  return `https://api-web.nhle.com/v1/club-schedule-season/${team}/${SEASON}`
}

function validateTeams(teams) {
  requireValue(Array.isArray(teams) && teams.length > 0, 'Missing team registry')
  const codes = new Set()
  for (const team of teams) {
    requireValue(team && /^[A-Z]{3}$/.test(team.abbrev) && text(team.name) && text(team.conference) && text(team.division), 'Invalid team metadata')
    requireValue(!codes.has(team.abbrev), `Duplicate team ${team.abbrev}`)
    codes.add(team.abbrev)
  }
  return codes
}

function validateGame(game, codes) {
  requireValue(game && Number.isSafeInteger(game.id) && String(game.id).startsWith('202602') && String(game.id).length === 10, 'Invalid game ID')
  requireValue(game.season === SEASON && game.gameType === 2, `Wrong season or game type for ${game.id}`)
  requireValue(date(game.date) && timestamp(game.startTimeUTC), `Invalid date for ${game.id}`)
  requireValue(text(game.state) && text(game.scheduleState), `Missing game status for ${game.id}`)
  requireValue(codes.has(game.homeTeam) && codes.has(game.awayTeam) && game.homeTeam !== game.awayTeam, `Invalid teams for ${game.id}`)
  const final = game.state === 'OFF' || game.state === 'FINAL'
  if (final) {
    requireValue(game.result && score(game.result.homeScore) && score(game.result.awayScore) && game.result.homeScore !== game.result.awayScore && ['REG', 'OT', 'SO'].includes(game.result.decision), `Invalid final result for ${game.id}`)
  } else {
    requireValue(game.result === null, `Nonfinal result for ${game.id}`)
  }
}

/** @returns {Game} */
export function normalizeGame(raw, teams) {
  requireValue(raw && typeof raw === 'object', 'Invalid source game')
  const final = raw.gameState === 'OFF' || raw.gameState === 'FINAL'
  const game = {
    id: raw.id,
    season: raw.season,
    gameType: raw.gameType,
    date: raw.gameDate,
    startTimeUTC: raw.startTimeUTC,
    state: raw.gameState,
    scheduleState: raw.gameScheduleState,
    homeTeam: raw.homeTeam?.abbrev,
    awayTeam: raw.awayTeam?.abbrev,
    result: final ? {
      homeScore: raw.homeTeam?.score,
      awayScore: raw.awayTeam?.score,
      decision: raw.gameOutcome?.lastPeriodType,
    } : null,
  }
  validateGame(game, validateTeams(teams))
  return game
}

function mergeGameCopies(previous, game, reportingTeam) {
  const { state: previousState, result: previousResult, ...previousSchedule } = previous
  const { state, result, ...schedule } = game
  requireValue(JSON.stringify(previousSchedule) === JSON.stringify(schedule), `Conflicting copies of game ${game.id}`)
  if (previousResult && result) {
    requireValue(JSON.stringify(previousResult) === JSON.stringify(result), `Conflicting copies of game ${game.id}`)
    return previousState === state || previousState === 'OFF' ? previous : game
  }
  // Both clubs must report a final before this refresh counts the result.
  if (previousResult) return game
  if (result) return previous
  // Live states can change between requests; retain the home club's observation.
  return reportingTeam === game.homeTeam ? game : previous
}

/** @returns {Snapshot} */
export function buildSnapshot(schedules, teams, fetchedAt, expectedGamesPerTeam = GAMES_PER_TEAM) {
  const codes = validateTeams(teams)
  requireValue(schedules instanceof Map && schedules.size === teams.length && [...schedules.keys()].every((code) => codes.has(code)), 'Missing or unexpected club schedule')
  const games = new Map()
  const appearances = new Map()
  for (const { abbrev } of teams) {
    const schedule = schedules.get(abbrev)
    requireValue(schedule && Array.isArray(schedule.games), `Invalid schedule for ${abbrev}`)
    const seen = new Set()
    for (const raw of schedule.games) {
      requireValue(raw && Number.isInteger(raw.gameType), `Invalid game type in ${abbrev} schedule`)
      if (raw.gameType !== 2) continue
      const game = normalizeGame(raw, teams)
      requireValue(game.homeTeam === abbrev || game.awayTeam === abbrev, `Unrelated game ${game.id} in ${abbrev} schedule`)
      requireValue(!seen.has(game.id), `Duplicate game ${game.id} in ${abbrev} schedule`)
      seen.add(game.id)
      const previous = games.get(game.id)
      games.set(game.id, previous ? mergeGameCopies(previous, game, abbrev) : game)
      const clubs = appearances.get(game.id) ?? new Set()
      clubs.add(abbrev)
      appearances.set(game.id, clubs)
    }
    requireValue(seen.size === expectedGamesPerTeam, `Incomplete ${abbrev} schedule: expected ${expectedGamesPerTeam}, received ${seen.size}`)
  }
  for (const game of games.values()) {
    const clubs = appearances.get(game.id)
    requireValue(clubs.size === 2 && clubs.has(game.homeTeam) && clubs.has(game.awayTeam), `Missing mirrored game ${game.id}`)
  }
  const snapshot = {
    schemaVersion: 1,
    season: SEASON,
    fetchedAt,
    sources: teams.map(({ abbrev }) => scheduleUrl(abbrev)),
    teams: [...teams].sort((a, b) => a.abbrev.localeCompare(b.abbrev)),
    games: [...games.values()].sort((a, b) => a.startTimeUTC.localeCompare(b.startTimeUTC) || a.id - b.id),
  }
  validateSnapshot(snapshot, expectedGamesPerTeam)
  return snapshot
}

export function validateSnapshot(snapshot, expectedGamesPerTeam = GAMES_PER_TEAM) {
  requireValue(snapshot?.schemaVersion === 1 && snapshot.season === SEASON, 'Unsupported NHL snapshot')
  requireValue(timestamp(snapshot.fetchedAt), 'Invalid snapshot retrieval timestamp')
  const codes = validateTeams(snapshot.teams)
  requireValue(Array.isArray(snapshot.sources) && snapshot.sources.length === codes.size && snapshot.teams.every(({ abbrev }) => snapshot.sources.includes(scheduleUrl(abbrev))), 'Invalid snapshot sources')
  requireValue(Array.isArray(snapshot.games), 'Missing games')
  const ids = new Set()
  const counts = new Map([...codes].map((code) => [code, 0]))
  for (const game of snapshot.games) {
    validateGame(game, codes)
    requireValue(!ids.has(game.id), `Duplicate game ${game.id}`)
    ids.add(game.id)
    counts.set(game.homeTeam, counts.get(game.homeTeam) + 1)
    counts.set(game.awayTeam, counts.get(game.awayTeam) + 1)
  }
  requireValue([...counts.values()].every((count) => count === expectedGamesPerTeam), 'Incomplete snapshot coverage')
  return snapshot
}

/** @param {Snapshot} snapshot @param {string} team @returns {Game[]} */
export function selectTeamGames(snapshot, team) {
  if (typeof team !== 'string' || !snapshot.teams.some(({ abbrev }) => abbrev === team)) {
    throw new RangeError(`Unknown team: ${team}`)
  }
  return snapshot.games.filter((game) => game.homeTeam === team || game.awayTeam === team)
}
