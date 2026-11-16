import type { CardDraft } from '../card.ts'

const quote = (team: string): string => `'${team.replaceAll("'", "''")}'`

// The current run of identical results (W, L or OTL), compared with the longest run of that type this season.
export const streak = (team: string): CardDraft[] => {
  const t = quote(team)
  const base = `WITH f AS (
  SELECT game_id, result, row_number() OVER (ORDER BY date, game_id) AS seq
  FROM team_games
  WHERE team = ${t} AND is_final
),
f2 AS (
  SELECT game_id, result, seq, seq - row_number() OVER (PARTITION BY result ORDER BY seq) AS grp FROM f
),
runs AS (
  SELECT result, count(*) AS len, max(seq) AS last_seq FROM f2 GROUP BY result, grp
),
cur AS (
  SELECT result, len, last_seq FROM runs ORDER BY last_seq DESC LIMIT 1
)`
  return [
    {
      team,
      kind: 'comparative',
      headline: '{team} are on a {len}-game {label} streak',
      body: 'It ties the longest {label} streak of their season, which is {longest} games.',
      bindings: {
        team: { column: 'team', row: 0 },
        len: { column: 'len', row: 0 },
        label: { column: 'label', row: 0 },
        longest: { column: 'longest', row: 0 },
      },
      evidence: {
        query: `${base}
SELECT
  ${t} AS team,
  cur.len AS len,
  CASE cur.result WHEN 'W' THEN 'winning' WHEN 'L' THEN 'losing' ELSE 'overtime-loss' END AS label,
  (SELECT max(len) FROM runs WHERE runs.result = cur.result) AS longest
FROM cur`,
        gamesQuery: `${base}
SELECT game_id FROM f WHERE seq > (SELECT last_seq - len FROM cur)`,
      },
      // True exactly while the current run is still the longest of its type (the claim the body makes).
      assert: `${base}
SELECT cur.len = (SELECT max(len) FROM runs WHERE runs.result = cur.result) AS holds FROM cur`,
    },
  ]
}
