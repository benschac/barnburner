import type { CardDraft } from "../card.ts";

const quote = (team: string): string => `'${team.replaceAll("'", "''")}'`;

export const homeAway = (team: string): CardDraft[] => [
  {
    team,
    kind: "record",
    headline:
      "{team} have won {home_wins} of {home_games} at home and {away_wins} of {away_games} on the road",
    body: "Home record: {home_wins} wins in {home_games} games. Road record: {away_wins} wins in {away_games} games.",
    bindings: {
      team: { column: "team", row: 0 },
      home_games: { column: "home_games", row: 0 },
      home_wins: { column: "home_wins", row: 0 },
      away_games: { column: "away_games", row: 0 },
      away_wins: { column: "away_wins", row: 0 },
    },
    evidence: {
      query: `SELECT team, count(*) FILTER (WHERE home) AS home_games,
  count(*) FILTER (WHERE home AND result = 'W') AS home_wins,
  count(*) FILTER (WHERE NOT home) AS away_games,
  count(*) FILTER (WHERE NOT home AND result = 'W') AS away_wins
FROM team_games
WHERE team = ${quote(team)} AND is_final
GROUP BY team`,
      gamesQuery: `SELECT game_id FROM team_games WHERE team = ${quote(team)} AND is_final AND true`,
    },
  },
];
