import type { CardDraft } from "../card.ts";

const lit = (team: string): string => team.replaceAll("'", "''");

/** The team's points leader across its archived games. Ties break by name. */
export const pointsLeader = (team: string): CardDraft[] => [
  {
    team,
    kind: "player",
    headline: "{name} leads {team} in points",
    body: "{name} has {points} points in the {games} archived games for {team}.",
    bindings: {
      name: { column: "name", row: 0 },
      team: { column: "team", row: 0 },
      points: { column: "points", row: 0 },
      games: { column: "games", row: 0 },
    },
    evidence: {
      query: `select name, '${lit(team)}' as team, sum(p) as points,
  (select count(distinct game_id) from skater_games where team = '${lit(team)}') as games
from skater_games
where team = '${lit(team)}'
group by player_id, name
order by points desc, name
limit 1`,
      gamesQuery: `select distinct game_id from skater_games where team = '${lit(team)}'`,
    },
  },
];
