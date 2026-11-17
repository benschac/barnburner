-- One row per team in teams.json. finals counts the season's final games (result not null)
-- where the team is home or away. archived counts those finals that have a box score file.
CREATE TABLE boxscore_coverage AS
WITH finals AS (
  SELECT g.id, g.homeTeam, g.awayTeam
  FROM (SELECT unnest(games) AS g FROM read_json('${DATA_DIR}/nhl-20262027.json'))
  WHERE g.result IS NOT NULL
),
archived AS (
  SELECT DISTINCT id
  FROM read_json('${DATA_DIR}/boxscores/20262027/*.json', union_by_name=true)
),
sides AS (
  SELECT homeTeam AS team, finals.id, finals.id IN (SELECT id FROM archived) AS has_box FROM finals
  UNION ALL
  SELECT awayTeam AS team, finals.id, finals.id IN (SELECT id FROM archived) AS has_box FROM finals
)
SELECT
  t.abbrev AS team,
  COUNT(s.id) AS finals,
  COUNT(s.id) FILTER (WHERE s.has_box) AS archived
FROM read_json('${DATA_DIR}/teams.json') AS t
LEFT JOIN sides AS s ON s.team = t.abbrev
GROUP BY t.abbrev
