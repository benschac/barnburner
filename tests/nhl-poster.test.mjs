import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { buildSnapshot } from '../lib/nhl-games.mjs'
import { buildPosterSnapshot, normalizeLeaders, normalizeStandings, validatePosterSnapshot } from '../lib/nhl-poster.mjs'
import { refreshPosterSnapshot, writePosterSnapshot } from '../scripts/refresh-nhl-poster.mjs'
import { makeTestApi } from '../apps/api/tests/test-api.ts'

const teams = [
  { abbrev: 'NJD', name: 'New Jersey Devils', conference: 'Eastern', division: 'Metropolitan' },
  { abbrev: 'TOR', name: 'Toronto Maple Leafs', conference: 'Eastern', division: 'Atlantic' },
]
const day = '2026-11-08'
const fetchedAt = '2026-11-09T12:00:00.000Z'
const sourceGame = { id: 2026020279, season: 20262027, gameType: 2, gameDate: day, startTimeUTC: '2026-11-09T00:00:00Z', gameState: 'OFF', gameScheduleState: 'OK', homeTeam: { abbrev: 'TOR', score: 0 }, awayTeam: { abbrev: 'NJD', score: 4 }, gameOutcome: { lastPeriodType: 'REG' } }
const games = buildSnapshot(new Map(teams.map(({ abbrev }) => [abbrev, { games: [sourceGame] }])), teams, fetchedAt, 1)
const player = { playerId: 1, headshot: 'https://assets.nhle.com/mugs/nhl/20262027/NJD/1.png', firstName: { default: 'Jack' }, lastName: { default: 'Hughes' }, gamesPlayed: 1, goals: 2, assists: 1, points: 3, shots: 5, shootingPctg: 0.4 }
const goalie = { ...player, playerId: 2, savePercentage: 0.93, goalsAgainstAverage: 2.5 }
const club = () => ({ season: '20262027', gameType: 2, skaters: [player], goalies: [goalie] })
const rawStandings = () => ({ standings: teams.map(({ abbrev }, index) => ({ teamAbbrev: { default: abbrev }, date: day, seasonId: 20262027, gameTypeId: 2, divisionSequence: 1, wildcardSequence: 0, points: index === 0 ? 2 : 0, gamesPlayed: 1 })) })
const input = () => ({
  games,
  fetchedAt,
  standingsByDate: new Map([[day, rawStandings()]]),
  summary: { data: teams.map(({ name }, index) => ({ teamFullName: name, seasonId: 20262027, gamesPlayed: 1, powerPlayPct: index === 0 ? 0.2 : 0.3, penaltyKillPct: 0.8 })) },
  clubStats: new Map(teams.map(({ abbrev }) => [abbrev, club()])),
})

test('normalizes authoritative standings and ranks percentage leaders for every team', () => {
  const snapshot = buildPosterSnapshot(input())
  assert.equal(snapshot.clubs.length, 2)
  assert.deepEqual(snapshot.clubs[0].specialTeams, [
    { label: 'POWER PLAY', rank: 2, value: 20 },
    { label: 'PENALTY KILL', rank: 1, value: 80 },
  ])
  assert.equal(snapshot.clubs[1].specialTeams[1].rank, 1)
  assert.deepEqual(snapshot.clubs[0].leaders.map(({ value }) => value), ['3', '5', '.930'])
  assert.equal(snapshot.history[0].date, day)
  assert.deepEqual(snapshot.standings, snapshot.history[0].standings)
})

test('leader selection uses the requested club and deterministically breaks ties by games played then player ID', () => {
  const raw = club()
  raw.skaters.push({ ...player, playerId: 3, firstName: { default: 'Auston' }, lastName: { default: 'Matthews' }, goals: 3, assists: 1, points: 4, shots: 8 })
  raw.goalies.push({ ...goalie, playerId: 4, firstName: { default: 'Another' }, savePercentage: 0.98 })
  const leaders = normalizeLeaders(raw, 1)
  assert.equal(leaders[0].name, 'A. Matthews')
  assert.equal(leaders[1].value, '8')
  assert.equal(leaders[2].value, '.980')
  raw.skaters[1].points = 3
  raw.skaters[1].goals = 2
  assert.equal(normalizeLeaders(raw, 1)[0].name, 'J. Hughes')
})

test('rejects missing teams, dates, wrong seasons and invalid source numbers', () => {
  const source = rawStandings()
  source.standings.pop()
  assert.throws(() => normalizeStandings(source, teams, day), /coverage/)
  const wrongSeason = rawStandings()
  wrongSeason.standings[0].seasonId = 20252026
  assert.throws(() => normalizeStandings(wrongSeason, teams, day), /season/)
  const incomplete = input()
  incomplete.standingsByDate.clear()
  assert.throws(() => buildPosterSnapshot(incomplete), /history/)
  const stale = input()
  stale.summary.data[0].gamesPlayed = 2
  assert.throws(() => buildPosterSnapshot(stale), /stale/)
  const invalid = club()
  invalid.goalies[0] = { ...goalie, savePercentage: 1.5 }
  assert.throws(() => normalizeLeaders(invalid, 1), /goalie/)
  const mismatch = input()
  mismatch.standingsByDate.get(day).standings[0].points = 1
  assert.throws(() => buildPosterSnapshot(mismatch), /disagree/)
})

test('loaded snapshot validation rejects malformed data and incomplete historical coverage', () => {
  const snapshot = buildPosterSnapshot(input())
  assert.throws(() => validatePosterSnapshot(snapshot, teams, ['2026-11-07', day]), /history/)
  snapshot.clubs[0].specialTeams[0].value = Infinity
  assert.throws(() => validatePosterSnapshot(snapshot, teams), /special teams/)
})

test('failed refresh or replacement keeps the last valid poster snapshot intact', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'nhl-poster-'))
  const output = join(directory, 'poster.json')
  try {
    await writeFile(output, 'previous')
    await assert.rejects(refreshPosterSnapshot({ games, output, fetcher: async () => ({ ok: false, status: 503 }) }), /HTTP 503/)
    assert.equal(await readFile(output, 'utf8'), 'previous')
    const invalid = buildPosterSnapshot(input())
    invalid.clubs.pop()
    await assert.rejects(writePosterSnapshot(output, invalid, teams, [day]), /coverage/)
    assert.equal(await readFile(output, 'utf8'), 'previous')
    await assert.rejects(refreshPosterSnapshot({ games, output, fromDir: directory }), /fetched-at/)
  } finally { await rm(directory, { recursive: true, force: true }) }
})

test('lagging standings report both totals before fetching other feeds and preserve saved data', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'nhl-poster-'))
  const output = join(directory, 'poster.json')
  const requests = []
  const lagging = rawStandings()
  lagging.standings[0].gamesPlayed = 0
  lagging.standings[0].points = 0
  try {
    await writeFile(output, 'previous')
    await assert.rejects(refreshPosterSnapshot({ games, output, fetcher: async (url) => {
      requests.push(url)
      return { ok: true, json: async () => url.includes('/standings/') ? lagging : url.includes('/club-stats/') ? club() : input().summary }
    } }), /Standings and games disagree for NJD on 2026-11-08: standings has 0 games played and 0 points; completed schedule has 1 games played and 2 points/)
    assert.deepEqual(requests, ['https://api-web.nhle.com/v1/standings/2026-11-08'])
    assert.equal(await readFile(output, 'utf8'), 'previous')
  } finally { await rm(directory, { recursive: true, force: true }) }
})

test('lagging team summaries report their games played against the standings', () => {
  const source = input()
  source.summary.data[0].gamesPlayed = 0
  assert.throws(() => buildPosterSnapshot(source), /Invalid or stale summary for NJD on 2026-11-08: summary has 0 games played; standings has 1 games played/)
})

test('refresh reads every dated standing and club then publishes the validated contract', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'nhl-poster-'))
  const output = join(directory, 'poster.json')
  const requests = []
  try {
    const snapshot = await refreshPosterSnapshot({ games, output, fetcher: async (url) => {
      requests.push(url)
      return { ok: true, json: async () => url.includes('/standings/') ? rawStandings() : url.includes('/club-stats/') ? club() : input().summary }
    } })
    assert.equal(requests.length, 4)
    assert.deepEqual(JSON.parse(await readFile(output, 'utf8')), snapshot)
  } finally { await rm(directory, { recursive: true, force: true }) }
})

test('HTTP poster endpoint serves the validated contract, rejects parameters, and reports missing data', async () => {
  const poster = buildPosterSnapshot(input())
  for (const supplement of [poster, null]) {
    const api = await makeTestApi(games, 1, supplement)
    try {
      const response = await api.request('/api/poster')
      assert.equal(response.status, supplement ? 200 : 503)
      if (supplement) assert.deepEqual(await response.json(), poster)
      assert.equal((await api.request('/api/poster?team=NJD')).status, 400)
      assert.equal((await api.request('/api/poster', { method: 'POST' })).status, 405)
      assert.equal((await api.request('/api/games?team=NJD')).status, 200)
    } finally {
      await api.dispose()
    }
  }
  const invalid = structuredClone(poster)
  invalid.clubs.pop()
  await assert.rejects(makeTestApi(games, 1, invalid), /coverage/)
  const mixed = structuredClone(poster)
  mixed.standings[0].points = 1
  await assert.rejects(makeTestApi(games, 1, mixed), /disagree/)
})
