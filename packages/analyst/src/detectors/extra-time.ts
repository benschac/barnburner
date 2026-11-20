import type { CardDraft } from "../card.ts";

const quote = (team: string): string => `'${team.replaceAll("'", "''")}'`;

export const extraTime = (team: string): CardDraft[] => [
  {
    team,
    kind: "record",
    headline: "{team} have played {extra_games} games past regulation",
    body: "{team} won {extra_wins} and lost {extra_losses} of those, with {shootouts} going to a shootout, out of {games} games in all.",
    bindings: {
      team: { column: "team", row: 0 },
      games: { column: "games", row: 0 },
      extra_games: { column: "extra_games", row: 0 },
      extra_wins: { column: "extra_wins", row: 0 },
      extra_losses: { column: "extra_losses", row: 0 },
      shootouts: { column: "shootouts", row: 0 },
    },
    evidence: {
      query: `SELECT team, count(*) AS games,
  count(*) FILTER (WHERE decision <> 'REG') AS extra_games,
  count(*) FILTER (WHERE decision <> 'REG' AND result = 'W') AS extra_wins,
  count(*) FILTER (WHERE decision <> 'REG' AND result <> 'W') AS extra_losses,
  count(*) FILTER (WHERE decision = 'SO') AS shootouts
FROM team_games
WHERE team = ${quote(team)} AND is_final
GROUP BY team`,
      gamesQuery: `SELECT game_id FROM team_games WHERE team = ${quote(team)} AND is_final AND decision <> 'REG'`,
    },
  },
];
