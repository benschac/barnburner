import assert from 'node:assert/strict'
import test from 'node:test'
import { normalizeBoxScore } from '../lib/nhl-boxscores.mjs'

const game = {
  id: 2026020285,
  season: 20262027,
  gameType: 2,
  date: '2026-11-09',
  awayTeam: 'NYI',
  homeTeam: 'SJS',
  result: { awayScore: 2, homeScore: 3, decision: 'SO' },
}
const fetchedAt = '2026-11-10T12:00:00.000Z'

function sourceBoxScore() {
  return {
    id: 2026020285,
    season: 20262027,
    gameType: 2,
    gameDate: '2026-11-09',
    gameState: 'OFF',
    gameOutcome: { lastPeriodType: 'SO' },
    awayTeam: { abbrev: 'NYI', score: 2, sog: 32 },
    homeTeam: { abbrev: 'SJS', score: 3, sog: 39 },
    playerByGameStats: {
      awayTeam: { forwards: [{ playerId: 1, goals: 1 }], defense: [{ playerId: 2 }], goalies: [{ playerId: 3, saves: 37 }] },
      homeTeam: { forwards: [{ playerId: 4, goals: 1 }], defense: [{ playerId: 5 }], goalies: [{ playerId: 6, saves: 30 }] },
    },
  }
}

test('archives the final score, shootout decision and provider player statistics', () => {
  const boxScore = normalizeBoxScore(sourceBoxScore(), game, fetchedAt)
  assert.equal(boxScore.source, 'https://api-web.nhle.com/v1/gamecenter/2026020285/boxscore')
  assert.equal(boxScore.fetchedAt, fetchedAt)
  assert.equal(boxScore.decision, 'SO')
  assert.equal(boxScore.homeTeam.score, 3)
  assert.equal(boxScore.awayTeam.shotsOnGoal, 32)
  assert.equal(boxScore.homeTeam.players.goalies[0].saves, 30)
})

test('rejects mismatched scores and incomplete or duplicated player rows', () => {
  const raw = sourceBoxScore()
  assert.throws(() => normalizeBoxScore({ ...raw, gameState: 'LIVE' }, game, fetchedAt), /does not match final game/)
  raw.homeTeam.score = 2
  assert.throws(() => normalizeBoxScore(raw, game, fetchedAt), /does not match SJS/)
  raw.homeTeam.score = 3
  raw.playerByGameStats.homeTeam.defense = []
  assert.throws(() => normalizeBoxScore(raw, game, fetchedAt), /Missing SJS defense/)
  raw.playerByGameStats.homeTeam.defense.push({ playerId: 4 })
  assert.throws(() => normalizeBoxScore(raw, game, fetchedAt), /duplicate SJS player/)
})
