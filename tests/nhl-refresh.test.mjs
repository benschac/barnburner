import assert from 'node:assert/strict'
import test from 'node:test'
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { refreshData } from '../scripts/refresh-nhl-data.mjs'

const readJson = async (path) => JSON.parse(await readFile(path, 'utf8'))
const seedSeason = await readJson(new URL('../data/nhl-20262027.json', import.meta.url))
const seedPoster = await readJson(new URL('../data/nhl-poster-20262027.json', import.meta.url))

function fixture({ sameDay = false, backdated = false, legacy = true } = {}) {
  const season = structuredClone(seedSeason)
  const poster = structuredClone(seedPoster)
  const included = new Set(poster.completedGameIds ?? season.games.filter((game) => game.result && game.date <= poster.history.at(-1).date).map(({ id }) => id))
  for (const game of season.games) {
    if (!included.has(game.id)) {
      game.state = 'FUT'
      game.result = null
    }
  }
  const pending = season.games.find((game) => !game.result && game.date >= poster.history.at(-1).date)
  assert.ok(pending, 'fixture needs an upcoming regular-season game')
  if (sameDay || backdated) {
    const latest = poster.history.at(-1).date
    pending.date = backdated ? new Date(Date.parse(`${latest}T00:00:00Z`) - 86_400_000).toISOString().slice(0, 10) : latest
    pending.startTimeUTC = `${pending.date}T23:59:00Z`
  }
  if (legacy) delete poster.completedGameIds
  else poster.completedGameIds = [...included].sort((a, b) => a - b)
  const next = structuredClone(season)
  const final = next.games.find(({ id }) => id === pending.id)
  final.state = 'OFF'
  final.result = { homeScore: 3, awayScore: 2, decision: 'REG' }
  return { season, poster, next, final, included }
}

function rawSchedule(game) {
  return {
    id: game.id, season: game.season, gameType: game.gameType,
    gameDate: game.date, startTimeUTC: game.startTimeUTC,
    gameState: game.state, gameScheduleState: game.scheduleState,
    homeTeam: { abbrev: game.homeTeam, score: game.result?.homeScore },
    awayTeam: { abbrev: game.awayTeam, score: game.result?.awayScore },
    gameOutcome: game.result ? { lastPeriodType: game.result.decision } : undefined,
  }
}

function rawStandings(data, date, lagging) {
  return { standings: data.next.teams.map(({ abbrev }) => {
    const previous = data.poster.standings.find(({ team }) => team === abbrev)
    const finals = data.next.games.filter((game) => game.result && game.date <= date && (game.homeTeam === abbrev || game.awayTeam === abbrev))
    const points = finals.reduce((total, game) => {
      const home = game.homeTeam === abbrev
      const scored = home ? game.result.homeScore : game.result.awayScore
      const conceded = home ? game.result.awayScore : game.result.homeScore
      return total + (scored > conceded ? 2 : game.result.decision === 'REG' ? 0 : 1)
    }, 0)
    return {
      teamAbbrev: { default: abbrev }, date, seasonId: data.next.season, gameTypeId: 2,
      divisionSequence: previous.divisionSequence, wildcardSequence: previous.wildcardSequence,
      gamesPlayed: lagging ? previous.played : finals.length,
      points: lagging ? previous.points : points,
    }
  }) }
}

function rawClub(team) {
  const player = {
    playerId: 1, firstName: { default: 'Test' }, lastName: { default: 'Player' },
    headshot: `https://assets.nhle.com/mugs/nhl/20262027/${team}/1.png`,
    gamesPlayed: 1, goals: 1, assists: 0, points: 1, shots: 3, shootingPctg: 1 / 3,
  }
  return { season: '20262027', gameType: 2, skaters: [player], goalies: [{ ...player, playerId: 2, savePercentage: 0.9, goalsAgainstAverage: 2 }] }
}

function rawBox(game) {
  return {
    ...rawSchedule(game),
    homeTeam: { abbrev: game.homeTeam, score: game.result.homeScore, sog: 30 },
    awayTeam: { abbrev: game.awayTeam, score: game.result.awayScore, sog: 25 },
    playerByGameStats: {
      homeTeam: { forwards: [{ playerId: 1 }], defense: [{ playerId: 2 }], goalies: [{ playerId: 3 }] },
      awayTeam: { forwards: [{ playerId: 4 }], defense: [{ playerId: 5 }], goalies: [{ playerId: 6 }] },
    },
  }
}

function provider(data, mode, requests) {
  return async (url) => {
    requests.push(url)
    const path = new URL(url).pathname
    let body
    if (path.includes('/club-schedule-season/')) {
      const team = path.split('/').at(-2)
      body = { games: data.next.games.filter((game) => game.homeTeam === team || game.awayTeam === team).map(rawSchedule) }
    } else if (path.includes('/standings/')) {
      body = rawStandings(data, path.split('/').at(-1), mode === 'standings')
    } else if (path.includes('/team/summary')) {
      if (mode === 'unknown') throw new Error('unexpected provider decoding failure')
      body = { data: data.next.teams.map(({ abbrev, name }) => {
        const previous = data.poster.standings.find(({ team }) => team === abbrev)
        const club = data.poster.clubs.find(({ team }) => team === abbrev)
        return {
          teamFullName: name, seasonId: data.next.season,
          gamesPlayed: mode === 'ready' ? data.next.games.filter((game) => game.result && (game.homeTeam === abbrev || game.awayTeam === abbrev)).length : previous.played,
          powerPlayPct: club.specialTeams.find(({ label }) => label === 'POWER PLAY').value / 100,
          penaltyKillPct: club.specialTeams.find(({ label }) => label === 'PENALTY KILL').value / 100,
        }
      }) }
      if (mode === 'malformed') body.data.pop()
    } else if (path.includes('/club-stats/')) {
      body = rawClub(path.split('/').at(-3))
    } else if (path.includes('/gamecenter/')) {
      const id = Number(path.split('/').at(-2))
      const game = data.next.games.find((game) => game.id === id)
      assert.ok(game?.result, `collector requested an unfinished game's box score: ${id}`)
      body = rawBox(game)
    } else {
      throw new Error(`Unexpected NHL request: ${url}`)
    }
    return { ok: true, json: async () => structuredClone(body) }
  }
}

async function savedDirectory(data) {
  const directory = await mkdtemp(join(tmpdir(), 'nhl-refresh-'))
  await writeFile(join(directory, 'teams.json'), JSON.stringify(data.season.teams))
  await writeFile(join(directory, 'nhl-20262027.json'), `${JSON.stringify(data.season)}\n`)
  await writeFile(join(directory, 'nhl-poster-20262027.json'), `${JSON.stringify(data.poster)}\n`)
  return directory
}

for (const scenario of [
  { name: 'lagging standings', mode: 'standings' },
  { name: 'lagging team summary', mode: 'summary' },
  { name: 'an additional final on the same day as retained standings', mode: 'summary', sameDay: true, legacy: false },
  { name: 'a late completed game dated before retained standings', mode: 'summary', backdated: true, legacy: false },
]) {
  test(`publishes new final scores and box scores despite ${scenario.name}`, async (t) => {
    const data = fixture(scenario)
    const directory = await savedDirectory(data)
    const requests = []
    t.mock.method(console, 'log', () => {})
    t.mock.method(console, 'warn', () => {})
    try {
      await refreshData(directory, { fetcher: provider(data, scenario.mode, requests) })
      const season = await readJson(join(directory, 'nhl-20262027.json'))
      const poster = await readJson(join(directory, 'nhl-poster-20262027.json'))
      assert.equal(season.games.length, 1344)
      assert.deepEqual(season.games.find(({ id }) => id === data.final.id).result, { homeScore: 3, awayScore: 2, decision: 'REG' })
      assert.equal(poster.fetchedAt, data.poster.fetchedAt)
      assert.deepEqual(poster.standings, data.poster.standings)
      assert.deepEqual(poster.history, data.poster.history)
      assert.deepEqual(poster.clubs, data.poster.clubs)
      assert.deepEqual([...poster.completedGameIds].sort((a, b) => a - b), [...data.included].sort((a, b) => a - b))
      assert.ok(!poster.completedGameIds.includes(data.final.id))
      const box = await readJson(join(directory, 'boxscores/20262027', `${data.final.id}.json`))
      assert.equal(box.homeTeam.score, 3)
      assert.equal(box.awayTeam.score, 2)
      assert.ok(requests.includes(`https://api-web.nhle.com/v1/gamecenter/${data.final.id}/boxscore`))
      assert.ok(!(await readdir(directory)).some((name) => name.startsWith('.nhl-refresh-')))
    } finally { await rm(directory, { recursive: true, force: true }) }
  })
}

test('a later synchronized refresh replaces retained stats with current coverage', async (t) => {
  const data = fixture()
  const directory = await savedDirectory(data)
  t.mock.method(console, 'log', () => {})
  t.mock.method(console, 'warn', () => {})
  try {
    await refreshData(directory, { fetcher: provider(data, 'summary', []) })
    const retained = await readJson(join(directory, 'nhl-poster-20262027.json'))
    assert.equal(retained.fetchedAt, data.poster.fetchedAt)
    assert.ok(!retained.completedGameIds.includes(data.final.id))

    await refreshData(directory, { fetcher: provider(data, 'ready', []) })
    const current = await readJson(join(directory, 'nhl-poster-20262027.json'))
    assert.notEqual(current.fetchedAt, retained.fetchedAt)
    assert.deepEqual([...current.completedGameIds].sort((a, b) => a - b), data.next.games.filter((game) => game.result).map(({ id }) => id).sort((a, b) => a - b))
    assert.ok(current.completedGameIds.includes(data.final.id))
    assert.equal(current.standings.find(({ team }) => team === data.final.homeTeam).played, data.poster.standings.find(({ team }) => team === data.final.homeTeam).played + 1)
    assert.equal(current.clubs.find(({ team }) => team === data.final.homeTeam).leaders[0].name, 'T. Player')
  } finally { await rm(directory, { recursive: true, force: true }) }
})

for (const mode of ['malformed', 'unknown']) {
  test(`${mode} supplemental failures still preserve the saved files`, async (t) => {
    const data = fixture()
    const directory = await savedDirectory(data)
    const requests = []
    t.mock.method(console, 'log', () => {})
    t.mock.method(console, 'warn', () => {})
    const paths = ['nhl-20262027.json', 'nhl-poster-20262027.json']
    const before = await Promise.all(paths.map((path) => readFile(join(directory, path), 'utf8')))
    try {
      await assert.rejects(refreshData(directory, { fetcher: provider(data, mode, requests) }), mode === 'malformed' ? /Incomplete team summary/ : /unexpected provider decoding failure/)
      assert.deepEqual(await Promise.all(paths.map((path) => readFile(join(directory, path), 'utf8'))), before)
      assert.ok(!requests.some((url) => url.includes('/gamecenter/')))
      assert.ok(!(await readdir(directory)).some((name) => name.startsWith('.nhl-refresh-')))
    } finally { await rm(directory, { recursive: true, force: true }) }
  })
}
