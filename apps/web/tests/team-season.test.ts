import { teamPoster, playoffComparison, describePlayoffComparison } from '../src/stats.ts'
import { posterFixture } from './team-fixture.ts'
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { Schema } from 'effect'
import snapshotData from '../../../data/nhl-20262027.json' with { type: 'json' }
import { SeasonSnapshot, TeamData, teams, teamFromHash, teamHref, teamSeason } from '../src/team-season.ts'

const snapshot = Schema.decodeUnknownSync(SeasonSnapshot)(snapshotData)

test('all 32 teams have their own schedule and paired game perspectives', () => {
  assert.equal(teams.length, 32)
  for (const team of teams) {
    const season = teamSeason(snapshot, team.abbrev)
    assert.equal(season.games.length, 84, team.abbrev)
    assert.equal(teamFromHash(teamHref(team.abbrev)), team.abbrev)
    for (const game of season.games) {
      assert.notEqual(game.opponent, team.abbrev)
      const other = teamSeason(snapshot, game.opponent).games.find((item) => item.game.id === game.game.id)
      assert.ok(other)
      assert.notEqual(game.venue, other.venue)
      assert.equal(game.goalsFor, other.goalsAgainst)
      if (game.outcome === 'win') assert.ok(other.outcome === 'loss' || other.outcome === 'overtime')
    }
  }
})

test('regulation, overtime and shootout results use the selected team perspective', () => {
  for (const decision of ['REG', 'OT', 'SO'] as const) {
    const sample = {
      schemaVersion: 1 as const, season: 20262027, fetchedAt: snapshot.fetchedAt,
      games: [{ id: 1, date: '2026-10-01', startTimeUTC: '2026-10-01T23:00:00Z', state: 'FINAL', scheduleState: 'OK', homeTeam: 'NJD', awayTeam: 'BOS', result: { homeScore: 2, awayScore: 3, decision } }],
    }
    assert.equal(teamSeason(sample, 'BOS').wins, 1)
    assert.equal(teamSeason(sample, 'NJD').losses, decision === 'REG' ? 1 : 0)
    assert.equal(teamSeason(sample, 'NJD').overtime, decision === 'REG' ? 0 : 1)
    assert.equal(teamSeason(sample, 'NJD').points, decision === 'REG' ? 0 : 1)
    sample.games[0].state = 'LIVE'
    assert.equal(teamSeason(sample, 'BOS').played, 0)
    assert.equal(teamSeason(sample, 'BOS').games[0].goalsFor, null)
  }
})

test('invalid routes return to the poster and invalid snapshots fail decoding', () => {
  assert.equal(teamFromHash('#team/XXX'), null)
  assert.equal(teamFromHash('#poster'), null)
  assert.throws(() => Schema.decodeUnknownSync(SeasonSnapshot)({ schemaVersion: 2 }))
})

test('all 32 posters project backend scores without importing Devils fixture stats', () => {
  for (const team of teams) {
    const data = teamPoster({ season: snapshot, poster: posterFixture }, team.abbrev)
    const season = teamSeason(snapshot, team.abbrev)
    assert.equal(data.team.abbrev, team.abbrev)
    assert.equal(data.seasonSummary.record, `${season.wins}-${season.losses}-${season.overtime}`)
    assert.equal(data.seasonSummary.points, season.points)
    assert.equal(data.seasonGames.length, 84)
    assert.equal(data.divisions.flatMap((division) => division.teams).length, 31)
    assert.equal(data.divisions.flatMap((division) => division.teams).some((row) => row.team === team.abbrev), false)
    assert.deepEqual(data.leaders, [])
    assert.deepEqual(data.specialTeams, [])
    assert.equal(data.latestPlayoffCushion, undefined)
    for (const game of data.seasonGames) {
      assert.notEqual(game.team, team.abbrev)
      const raw = snapshot.games.find((row) => row.id === game.id)!
      if (game.result) assert.equal(game.result.goalsFor, raw.homeTeam === team.abbrev ? raw.result!.homeScore : raw.result!.awayScore)
    }
  }
})

test('playoff cushion uses official spots and the selected conference', () => {
  const standings = [
    { team: 'NJD', divisionSequence: 2, wildcardSequence: 0, points: 26, played: 18, date: '2026-11-08' },
    { team: 'BUF', divisionSequence: 5, wildcardSequence: 3, points: 19, played: 17, date: '2026-11-08' },
    { team: 'FLA', divisionSequence: 4, wildcardSequence: 2, points: 20, played: 18, date: '2026-11-08' },
    { team: 'SEA', divisionSequence: 5, wildcardSequence: 3, points: 99, played: 18, date: '2026-11-08' },
  ]
  assert.equal(playoffComparison(standings, 'NJD')?.team, 'BUF')
  assert.equal(playoffComparison(standings, 'BUF')?.team, 'FLA')
  assert.equal(describePlayoffComparison(playoffComparison(standings, 'BUF')!).equation, 'BUF 19 pts − FLA 20 pts (last wild card) = -1')
  const data = teamPoster({ season: snapshot, poster: { ...posterFixture, standings,
    history: [{ date: snapshot.games.find((game) => game.homeTeam === 'NJD' || game.awayTeam === 'NJD')!.date,
      standings: standings.map((row) => ({ ...row, points: row.team === 'NJD' ? 2 : 1 })) }],
  } }, 'NJD')
  assert.equal(data.latestPlayoffCushion?.signedGap, '+7')
  assert.equal(data.seasonGames[0].result?.comparison?.selectedPoints, 2)
})

test('selected team remains visible below the first five wildcard rows', () => {
  const easternWildcards = teams.filter((team) => team.conference === 'Eastern')
  const standings = easternWildcards.map((team, index) => ({ team: team.abbrev, divisionSequence: 4, wildcardSequence: index + 1, points: 1, played: 1, date: '2026-11-08' }))
  const selected = easternWildcards.at(-1)!.abbrev
  const data = teamPoster({ season: snapshot, poster: { ...posterFixture, standings } }, selected)
  assert.ok(data.standings.some((row) => row.team === selected))
})

test('malformed dates and incomplete supplemental coverage fail at the boundary', () => {
  assert.throws(() => Schema.decodeUnknownSync(TeamData)({ season: snapshot, poster: { ...posterFixture, fetchedAt: 'bad' } }))
  assert.throws(() => Schema.decodeUnknownSync(TeamData)({ season: snapshot, poster: { ...posterFixture, clubs: [] } }))
  assert.throws(() => Schema.decodeUnknownSync(TeamData)({ season: snapshot, poster: { ...posterFixture, season: 20252026 } }))
})

test('mixed snapshot generations fail before contradictory points can reach the poster', async () => {
  const { default: poster } = await import('../../../data/nhl-poster-20262027.json', { with: { type: 'json' } })
  assert.doesNotThrow(() => Schema.decodeUnknownSync(TeamData)({ season: snapshot, poster }))
  const olderSeason = {
    ...snapshot,
    games: snapshot.games.map((game) => game.id === 2026020279 ? { ...game, state: 'FUT', result: null } : game),
  }
  assert.equal(teamSeason(olderSeason, 'NJD').points, 24)
  assert.throws(() => Schema.decodeUnknownSync(TeamData)({ season: olderSeason, poster }))
})
