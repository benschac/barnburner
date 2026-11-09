import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { once } from 'node:events'
import { buildSnapshot, normalizeGame, selectTeamGames, validateSnapshot } from '../lib/nhl-games.mjs'
import { refreshSnapshot, writeSnapshot } from '../scripts/refresh-nhl-games.mjs'
import { createGamesServer } from '../scripts/serve-nhl-games.mjs'

const teams = [
  { abbrev: 'NJD', name: 'New Jersey Devils', conference: 'Eastern', division: 'Metropolitan' },
  { abbrev: 'TOR', name: 'Toronto Maple Leafs', conference: 'Eastern', division: 'Atlantic' },
]
const fetchedAt = '2026-11-09T12:00:00.000Z'
const game = {
  id: 2026020279, season: 20262027, gameType: 2,
  gameDate: '2026-11-08', startTimeUTC: '2026-11-09T00:00:00Z',
  gameState: 'OFF', gameScheduleState: 'OK',
  homeTeam: { abbrev: 'TOR', score: 0 }, awayTeam: { abbrev: 'NJD', score: 4 },
  gameOutcome: { lastPeriodType: 'REG' },
}
const schedules = () => new Map(teams.map(({ abbrev }) => [abbrev, { games: [structuredClone(game)] }]))
const snapshot = () => buildSnapshot(schedules(), teams, fetchedAt, 1)

test('stores a mirrored game once and filters both participating teams', () => {
  const data = snapshot()
  assert.equal(data.games.length, 1)
  assert.deepEqual(selectTeamGames(data, 'NJD'), selectTeamGames(data, 'TOR'))
  assert.equal(selectTeamGames(data, 'NJD')[0].awayTeam, 'NJD')
  assert.throws(() => selectTeamGames(data, 'XXX'), /Unknown team/)
  assert.throws(() => selectTeamGames(data, 'njd'), /Unknown team/)
})

test('filters out other teams and sorts by start time', () => {
  const fourTeams = [...teams, { ...teams[0], abbrev: 'NYR' }, { ...teams[0], abbrev: 'PHI' }]
  const otherGame = { ...game, id: 2026020001, gameDate: '2026-10-01', startTimeUTC: '2026-10-01T23:00:00Z', homeTeam: { abbrev: 'NYR', score: 2 }, awayTeam: { abbrev: 'PHI', score: 1 } }
  const input = schedules()
  input.set('NYR', { games: [otherGame] })
  input.set('PHI', { games: [otherGame] })
  const data = buildSnapshot(input, fourTeams, fetchedAt, 1)
  assert.deepEqual(data.games.map((entry) => entry.id), [otherGame.id, game.id])
  assert.deepEqual(selectTeamGames(data, 'NJD').map((entry) => entry.id), [game.id])
})

test('rejects conflicting and repeated games', () => {
  const conflict = schedules()
  conflict.get('TOR').games[0].homeTeam.score = 1
  assert.throws(() => buildSnapshot(conflict, teams, fetchedAt, 1), /Conflicting/)
  const duplicate = schedules()
  duplicate.get('NJD').games.push(game)
  assert.throws(() => buildSnapshot(duplicate, teams, fetchedAt, 1), /Duplicate game/)
})

test('requires complete club and game coverage before publishing', () => {
  const missing = schedules()
  missing.delete('TOR')
  assert.throws(() => buildSnapshot(missing, teams, fetchedAt, 1), /Missing or unexpected/)
  const truncated = schedules()
  truncated.get('TOR').games = []
  assert.throws(() => buildSnapshot(truncated, teams, fetchedAt, 1), /Incomplete TOR/)
  assert.throws(() => buildSnapshot(schedules(), teams, fetchedAt), /expected 84/)
})

test('requires matching games in both clubs even when per-club counts match', () => {
  const missingMirror = schedules()
  missingMirror.get('TOR').games[0].id = 2026020280
  assert.throws(() => buildSnapshot(missingMirror, teams, fetchedAt, 1), /Missing mirrored/)
})

test('ignores preseason records and retains regular-season games', () => {
  const input = schedules()
  for (const schedule of input.values()) schedule.games.push({ ...game, id: 2026010001, gameType: 1 })
  assert.equal(buildSnapshot(input, teams, fetchedAt, 1).games.length, 1)
})

test('only final games have results and preserves overtime decisions', () => {
  for (const state of ['FUT', 'PRE', 'LIVE', 'CRIT']) {
    assert.equal(normalizeGame({ ...game, gameState: state }, teams).result, null)
  }
  for (const state of ['OFF', 'FINAL']) {
    for (const decision of ['REG', 'OT', 'SO']) {
      assert.equal(normalizeGame({ ...game, gameState: state, gameOutcome: { lastPeriodType: decision } }, teams).result.decision, decision)
    }
  }
})

test('rejects malformed source data and final results', () => {
  for (const patch of [
    { season: 20252026 }, { gameDate: 'bad' }, { gameDate: '2026-02-30' },
    { startTimeUTC: 'tomorrow' }, { homeTeam: { abbrev: 'XXX', score: 0 } },
    { homeTeam: { abbrev: 'TOR', score: 4 } }, { gameOutcome: null },
    { homeTeam: { abbrev: 'TOR', score: -1 } }, { gameState: '' },
  ]) assert.throws(() => normalizeGame({ ...game, ...patch }, teams))
  assert.throws(() => buildSnapshot(schedules(), teams, 'bad', 1), /retrieval timestamp/)
})

test('validates loaded snapshots before serving them', () => {
  const bad = snapshot()
  bad.games.push(bad.games[0])
  assert.throws(() => validateSnapshot(bad, 1), /Duplicate game/)
  const nonfinal = snapshot()
  nonfinal.games[0].state = 'LIVE'
  assert.throws(() => createGamesServer(nonfinal, 1), /Nonfinal result/)
})

test('failed refresh and invalid replacement preserve the previous snapshot', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'nhl-games-'))
  try {
    const output = join(directory, 'snapshot.json')
    await writeFile(output, 'previous bytes\n')
    await assert.rejects(refreshSnapshot({ teams, output, expectedGamesPerTeam: 1, fetcher: async () => ({ ok: false, status: 503 }) }), /HTTP 503/)
    assert.equal(await readFile(output, 'utf8'), 'previous bytes\n')
    await assert.rejects(writeSnapshot(output, { ...snapshot(), fetchedAt: 'invalid' }, 1), /timestamp/)
    assert.equal(await readFile(output, 'utf8'), 'previous bytes\n')
  } finally { await rm(directory, { recursive: true, force: true }) }
})

test('imports downloaded schedules with explicit provenance and writes validated JSON', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'nhl-games-'))
  try {
    const output = join(directory, 'snapshot.json')
    for (const [team, schedule] of schedules()) await writeFile(join(directory, `${team}.json`), JSON.stringify(schedule))
    await assert.rejects(refreshSnapshot({ teams, output, fromDir: directory, expectedGamesPerTeam: 1 }), /requires the actual/)
    const result = await refreshSnapshot({ teams, output, fromDir: directory, fetchedAt, expectedGamesPerTeam: 1 })
    assert.deepEqual(JSON.parse(await readFile(output, 'utf8')), result)
    assert.equal(result.fetchedAt, fetchedAt)
    assert.match(result.sources[0], /club-schedule-season\/NJD\/20262027/)
  } finally { await rm(directory, { recursive: true, force: true }) }
})

test('HTTP endpoint returns filtered games and rejects unsupported requests', async () => {
  const server = createGamesServer(snapshot(), 1)
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  try {
    const base = `http://127.0.0.1:${server.address().port}`
    const result = await fetch(`${base}/api/games?team=NJD`)
    assert.equal(result.status, 200)
    const body = await result.json()
    assert.equal(body.count, 1)
    assert.equal(body.team, 'NJD')
    assert.equal(body.fetchedAt, fetchedAt)
    assert.equal((await (await fetch(`${base}/api/games`)).json()).games.length, 1)
    assert.equal((await (await fetch(`${base}/api/teams`)).json()).teams.length, 2)
    for (const path of ['/api/games?team=XXX', '/api/games?team=', '/api/games?team=NJD&team=TOR', '/api/games?season=20262027', '/api/teams?team=NJD']) {
      assert.equal((await fetch(`${base}${path}`)).status, 400, path)
    }
    assert.equal((await fetch(`${base}/missing`)).status, 404)
    assert.equal((await fetch(`${base}/api/games`, { method: 'POST' })).status, 405)
  } finally {
    server.closeAllConnections()
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
  }
})
