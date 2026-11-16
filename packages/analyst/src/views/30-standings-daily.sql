CREATE TABLE standings_daily AS
WITH days AS (
  SELECT unnest(h.standings) AS s
  FROM (
    SELECT unnest(history) AS h
    FROM read_json('${DATA_DIR}/nhl-poster-20262027.json', maximum_object_size = 268435456)
  )
),
rows AS (
  SELECT
    CAST(s.date AS DATE) AS date,
    s.team AS team,
    CAST(s.points AS INTEGER) AS points,
    CAST(s.played AS INTEGER) AS played,
    CAST(s.divisionSequence AS INTEGER) AS rank_div,
    CAST(s.wildcardSequence AS INTEGER) AS wc_rank
  FROM days
),
teams AS (
  SELECT abbrev, conference FROM read_json('${DATA_DIR}/teams.json')
)
SELECT
  r.date,
  r.team,
  r.points,
  r.played,
  r.rank_div,
  CAST(row_number() OVER (PARTITION BY r.date, t.conference ORDER BY r.points DESC, r.played ASC, r.team ASC) AS INTEGER) AS rank_conf,
  r.wc_rank
FROM rows r
JOIN teams t ON t.abbrev = r.team
