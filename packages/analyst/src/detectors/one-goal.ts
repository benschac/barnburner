import type { CardDraft } from '../card.ts'

const quote = (team: string): string => `'${team.replaceAll("'", "''")}'`

export const oneGoal = (team: string): CardDraft[] => [
  {
    team,
    kind: 'record',
    headline: '{team} are {wins} and {losses} in one-goal games',
    body: '{one_goal} of {games} games have been decided by a single goal, with {wins} wins and {losses} losses (overtime and shootout losses included).',
    bindings: {
      team: { column: 'team', row: 0 },
      games: { column: 'games', row: 0 },
      one_goal: { column: 'one_goal', row: 0 },
      wins: { column: 'wins', row: 0 },
      losses: { column: 'losses', row: 0 },
    },
    evidence: {
      query: `SELECT team, count(*) AS games,
  count(*) FILTER (WHERE abs(gf - ga) = 1) AS one_goal,
  count(*) FILTER (WHERE abs(gf - ga) = 1 AND result = 'W') AS wins,
  count(*) FILTER (WHERE abs(gf - ga) = 1 AND result <> 'W') AS losses
FROM team_games
WHERE team = ${quote(team)} AND is_final
GROUP BY team`,
      gamesQuery: `SELECT game_id FROM team_games WHERE team = ${quote(team)} AND is_final AND abs(gf - ga) = 1`,
    },
  },
]
