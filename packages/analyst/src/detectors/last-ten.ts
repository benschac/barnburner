import type { CardDraft } from "../card.ts";

const quote = (team: string): string => `'${team.replaceAll("'", "''")}'`;

// Record over the most recent finals (at most ten, fewer early in the season) against the season record.
// One row: every count is a count(), so it also works when the team has fewer finals than the window.
export const lastTen = (team: string): CardDraft[] => {
  const t = quote(team);
  const base = `WITH f AS (
  SELECT result, game_id, row_number() OVER (ORDER BY date DESC, game_id DESC) AS rn
  FROM team_games
  WHERE team = ${t} AND is_final
)`;
  return [
    {
      team,
      kind: "trend",
      headline: "{team} are {w}-{l}-{otl} in their last {n} games",
      body: "That is {w} wins, {l} regulation losses and {otl} overtime or shootout losses. Their season record is {sw}-{sl}-{sotl} over {sn} games.",
      bindings: {
        team: { column: "team", row: 0 },
        n: { column: "n", row: 0 },
        w: { column: "w", row: 0 },
        l: { column: "l", row: 0 },
        otl: { column: "otl", row: 0 },
        sw: { column: "sw", row: 0 },
        sl: { column: "sl", row: 0 },
        sotl: { column: "sotl", row: 0 },
        sn: { column: "sn", row: 0 },
      },
      evidence: {
        query: `${base}
SELECT
  ${t} AS team,
  count(*) FILTER (WHERE rn <= 10) AS n,
  count(*) FILTER (WHERE rn <= 10 AND result = 'W') AS w,
  count(*) FILTER (WHERE rn <= 10 AND result = 'L') AS l,
  count(*) FILTER (WHERE rn <= 10 AND result = 'OTL') AS otl,
  count(*) FILTER (WHERE result = 'W') AS sw,
  count(*) FILTER (WHERE result = 'L') AS sl,
  count(*) FILTER (WHERE result = 'OTL') AS sotl,
  count(*) AS sn
FROM f`,
        gamesQuery: `${base}
SELECT game_id FROM f WHERE rn <= 10`,
      },
    },
  ];
};
