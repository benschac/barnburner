CREATE TABLE skater_games AS
WITH games AS (
  SELECT * FROM read_json(
    '${DATA_DIR}/boxscores/20262027/*.json',
    union_by_name = true,
    columns = {id: 'BIGINT', date: 'VARCHAR', awayTeam: 'STRUCT(abbrev VARCHAR, players STRUCT(forwards STRUCT(playerId BIGINT, name STRUCT("default" VARCHAR), position VARCHAR, goals INTEGER, assists INTEGER, points INTEGER, plusMinus INTEGER, pim INTEGER, hits INTEGER, powerPlayGoals INTEGER, sog INTEGER, toi VARCHAR, blockedShots INTEGER)[], defense STRUCT(playerId BIGINT, name STRUCT("default" VARCHAR), position VARCHAR, goals INTEGER, assists INTEGER, points INTEGER, plusMinus INTEGER, pim INTEGER, hits INTEGER, powerPlayGoals INTEGER, sog INTEGER, toi VARCHAR, blockedShots INTEGER)[]))', homeTeam: 'STRUCT(abbrev VARCHAR, players STRUCT(forwards STRUCT(playerId BIGINT, name STRUCT("default" VARCHAR), position VARCHAR, goals INTEGER, assists INTEGER, points INTEGER, plusMinus INTEGER, pim INTEGER, hits INTEGER, powerPlayGoals INTEGER, sog INTEGER, toi VARCHAR, blockedShots INTEGER)[], defense STRUCT(playerId BIGINT, name STRUCT("default" VARCHAR), position VARCHAR, goals INTEGER, assists INTEGER, points INTEGER, plusMinus INTEGER, pim INTEGER, hits INTEGER, powerPlayGoals INTEGER, sog INTEGER, toi VARCHAR, blockedShots INTEGER)[]))'}
  )
),
sides AS (
  SELECT id, date, awayTeam.abbrev AS team, homeTeam.abbrev AS opp,
         awayTeam.players.forwards AS fwd, awayTeam.players.defense AS def
  FROM games
  UNION ALL
  SELECT id, date, homeTeam.abbrev AS team, awayTeam.abbrev AS opp,
         homeTeam.players.forwards AS fwd, homeTeam.players.defense AS def
  FROM games
),
skaters AS (
  SELECT id, date, team, opp, unnest(list_concat(fwd, def)) AS s FROM sides
)
SELECT
  id::BIGINT AS game_id,
  CAST(date AS DATE) AS date,
  team,
  opp,
  s.playerId::BIGINT AS player_id,
  s.name.default AS name,
  s.position AS pos,
  s.goals::INTEGER AS g,
  s.assists::INTEGER AS a,
  s.points::INTEGER AS p,
  s.sog::INTEGER AS sog,
  (split_part(s.toi, ':', 1)::INTEGER * 60 + split_part(s.toi, ':', 2)::INTEGER) AS toi_sec,
  s.hits::INTEGER AS hits,
  s.blockedShots::INTEGER AS blocks,
  s.pim::INTEGER AS pim,
  s.powerPlayGoals::INTEGER AS ppg,
  s.plusMinus::INTEGER AS plus_minus
FROM skaters
