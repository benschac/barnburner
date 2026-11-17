CREATE TABLE goalie_games AS
WITH box AS (
  SELECT * FROM read_json('${DATA_DIR}/boxscores/20262027/*.json', union_by_name = true)
),
sides AS (
  SELECT id, date, awayTeam.abbrev AS team, homeTeam.abbrev AS opp, unnest(awayTeam.players.goalies) AS g FROM box
  UNION ALL
  SELECT id, date, homeTeam.abbrev AS team, awayTeam.abbrev AS opp, unnest(homeTeam.players.goalies) AS g FROM box
)
SELECT
  id::BIGINT AS game_id,
  CAST(date AS DATE) AS date,
  team,
  opp,
  g.playerId::BIGINT AS player_id,
  g.name.default AS name,
  g.starter::BOOLEAN AS starter,
  g.decision AS decision,
  g.shotsAgainst::INTEGER AS shots_against,
  g.saves::INTEGER AS saves,
  g.savePctg::DOUBLE AS save_pct,
  g.goalsAgainst::INTEGER AS ga,
  (split_part(g.toi, ':', 1)::INTEGER * 60 + split_part(g.toi, ':', 2)::INTEGER) AS toi_sec
FROM sides
ORDER BY game_id, team, player_id
