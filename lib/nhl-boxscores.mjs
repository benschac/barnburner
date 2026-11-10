export function boxScoreUrl(gameId) {
  return `https://api-web.nhle.com/v1/gamecenter/${gameId}/boxscore`
}

export function normalizeBoxScore(raw, game, fetchedAt) {
  if (!game.result || raw?.id !== game.id || raw.season !== game.season ||
      raw.gameType !== game.gameType || raw.gameDate !== game.date ||
      !['OFF', 'FINAL'].includes(raw.gameState) ||
      raw.gameOutcome?.lastPeriodType !== game.result.decision) {
    throw new Error(`Box score does not match final game ${game.id}`)
  }

  function teamBoxScore(side, abbrev, score) {
    const team = raw[side]
    const players = raw.playerByGameStats?.[side]
    if (team?.abbrev !== abbrev || team.score !== score || !Number.isInteger(team.sog) || team.sog < 0) {
      throw new Error(`Box score does not match ${abbrev}'s result in game ${game.id}`)
    }
    const ids = new Set()
    for (const group of ['forwards', 'defense', 'goalies']) {
      const rows = players?.[group]
      if (!Array.isArray(rows) || rows.length === 0) {
        throw new Error(`Missing ${abbrev} ${group} in game ${game.id}`)
      }
      for (const row of rows) {
        if (!Number.isSafeInteger(row?.playerId) || row.playerId <= 0 || ids.has(row.playerId)) {
          throw new Error(`Invalid or duplicate ${abbrev} player in game ${game.id}`)
        }
        ids.add(row.playerId)
      }
    }
    return { abbrev, score, shotsOnGoal: team.sog, players }
  }

  return {
    schemaVersion: 1,
    source: boxScoreUrl(game.id),
    fetchedAt,
    id: game.id,
    season: game.season,
    date: game.date,
    decision: game.result.decision,
    awayTeam: teamBoxScore('awayTeam', game.awayTeam, game.result.awayScore),
    homeTeam: teamBoxScore('homeTeam', game.homeTeam, game.result.homeScore),
  }
}
