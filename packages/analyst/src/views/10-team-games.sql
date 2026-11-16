CREATE TABLE team_games AS
WITH g AS (
  SELECT
    game.id AS id,
    CAST(game.date AS DATE) AS date,
    game.homeTeam AS homeTeam,
    game.awayTeam AS awayTeam,
    game.result.homeScore AS home_score,
    game.result.awayScore AS away_score,
    game.result.decision AS decision,
    game.result IS NOT NULL AS is_final
  FROM (SELECT unnest(games) AS game FROM read_json('${DATA_DIR}/nhl-20262027.json'))
),
sides AS (
  SELECT homeTeam AS team, id AS game_id, date, true AS home, awayTeam AS opp,
         home_score AS gf, away_score AS ga, decision, is_final
  FROM g
  UNION ALL
  SELECT awayTeam, id, date, false, homeTeam,
         away_score, home_score, decision, is_final
  FROM g
)
SELECT
  team,
  game_id,
  date,
  home,
  opp,
  gf,
  ga,
  CASE WHEN NOT is_final THEN NULL WHEN gf > ga THEN 'W' WHEN decision = 'REG' THEN 'L' ELSE 'OTL' END AS result,
  CASE WHEN is_final THEN decision END AS decision,
  is_final
FROM sides
