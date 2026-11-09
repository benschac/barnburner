import assert from 'node:assert/strict'
import { test } from 'node:test'
import { Schema } from 'effect'
import snapshotData from '../../../data/nhl-20262027.json' with { type: 'json' }
import { SeasonSnapshot, teams, teamFromHash, teamHref, teamSeason } from '../src/team-season.ts'

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
