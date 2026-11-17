import type { CardDraft } from '../card.ts'

const lit = (team: string): string => team.replaceAll("'", "''")

/** The goalie with the most starts across the team's archived games. Ties break by name. */
export const goalieStarts = (team: string): CardDraft[] => [
  {
    team,
    kind: 'player',
    headline: '{name} has started most in goal for {team}',
    body: '{name} started {starts} of the {games} archived games for {team}.',
    bindings: {
      name: { column: 'name', row: 0 },
      team: { column: 'team', row: 0 },
      starts: { column: 'starts', row: 0 },
      games: { column: 'games', row: 0 },
    },
    evidence: {
      query: `select name, '${lit(team)}' as team, count(*) as starts,
  (select count(distinct game_id) from goalie_games where team = '${lit(team)}') as games
from goalie_games
where team = '${lit(team)}' and starter
group by player_id, name
order by starts desc, name
limit 1`,
      gamesQuery: `select distinct game_id from goalie_games where team = '${lit(team)}'`,
    },
  },
]
