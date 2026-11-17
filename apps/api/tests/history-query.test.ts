import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { DatabaseSync } from 'node:sqlite'
import { Effect } from 'effect'
import { MINI_ARRAYS, MINI_GAMES, MINI_SNAPSHOT_ID, makeMiniStore } from '../../../packages/history/tests/fakes.ts'

const fake = makeMiniStore()
const script = new URL('../scripts/history-query.ts', import.meta.url).pathname

const SERVE_TABLES = `
  CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
  CREATE TABLE players (player_id INTEGER PRIMARY KEY, name TEXT, search_name TEXT, position TEXT, first_season INTEGER,
    last_season INTEGER, games INTEGER, points INTEGER, teammates INTEGER);
  CREATE TABLE teams (team_id INTEGER PRIMARY KEY, abbrev TEXT, name TEXT);
  CREATE TABLE games (game_id INTEGER PRIMARY KEY, season_id INTEGER, game_type INTEGER, game_date TEXT, playoff_round INTEGER, cup_final INTEGER);
  CREATE TABLE appearances (player_id INTEGER, game_id INTEGER, team_id INTEGER, PRIMARY KEY (player_id, game_id)) WITHOUT ROWID;
  CREATE TABLE stints (player_id INTEGER, season_id INTEGER, game_type INTEGER, team_id INTEGER, games INTEGER,
    first_game_id INTEGER, last_game_id INTEGER, PRIMARY KEY (player_id, season_id, game_type, team_id));
  CREATE TABLE graph_arrays (name TEXT PRIMARY KEY, bytes BLOB);
`

const blobs: Record<string, ArrayBufferView> = {
  player_ids: MINI_ARRAYS.playerIds, season_ids: MINI_ARRAYS.seasonIds, team_ids: MINI_ARRAYS.teamIds,
  edge_a: MINI_ARRAYS.edgeA, edge_b: MINI_ARRAYS.edgeB, span_start: MINI_ARRAYS.spanStart,
  span_season: MINI_ARRAYS.spanSeason, span_kind: MINI_ARRAYS.spanKind, span_team: MINI_ARRAYS.spanTeam,
  span_link: MINI_ARRAYS.spanLink, span_games: MINI_ARRAYS.spanGames, span_first_game: MINI_ARRAYS.spanFirstGame,
  opp_a: MINI_ARRAYS.oppA!, opp_b: MINI_ARRAYS.oppB!, opp_games: MINI_ARRAYS.oppGames!,
}

/** Writes the C-mini serving database. Rows come from the in-memory fake so both sides share one source. */
const writeMini = (path: string) => {
  const db = new DatabaseSync(path)
  db.exec(SERVE_TABLES)
  db.prepare('INSERT INTO meta VALUES (?, ?)').run('schema_version', '1')
  db.prepare('INSERT INTO meta VALUES (?, ?)').run('snapshot_id', MINI_SNAPSHOT_ID)
  const teams = new Map<number, [string, string]>()
  for (let id = 11; id <= 20; id += 1) {
    const { player, stints } = Effect.runSync(fake.player(id))
    db.prepare('INSERT INTO players VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').run(
      player.playerId, player.name, player.searchName, player.position, player.firstSeason, player.lastSeason,
      player.games, player.points, player.teammates,
    )
    for (const s of stints) {
      teams.set(s.teamId, [s.teamAbbrev, s.teamName])
      db.prepare('INSERT INTO stints VALUES (?, ?, ?, ?, ?, ?, ?)').run(
        player.playerId, s.seasonId, s.gameType, s.teamId, s.games, s.firstGameId, s.lastGameId,
      )
    }
  }
  for (const [teamId, [abbrev, name]] of teams) db.prepare('INSERT INTO teams VALUES (?, ?, ?)').run(teamId, abbrev, name)
  for (const game of MINI_GAMES) {
    // The fake treats the two playoff games as the Final (decision D8 flag).
    db.prepare('INSERT INTO games VALUES (?, ?, ?, ?, ?, ?)').run(
      game.gameId, game.seasonId, game.gameType, game.gameDate, game.gameType === 3 ? 1 : null, game.gameType === 3 ? 1 : 0,
    )
    for (const side of game.sides) {
      for (const playerId of side.credited) {
        db.prepare('INSERT INTO appearances VALUES (?, ?, ?)').run(playerId, game.gameId, side.teamId)
      }
    }
  }
  for (const [name, view] of Object.entries(blobs)) {
    db.prepare('INSERT INTO graph_arrays VALUES (?, ?)').run(name, new Uint8Array(view.buffer, view.byteOffset, view.byteLength))
  }
  db.close()
}


/** A fixture where players 18 and 20 also share the name "Twin Skater", so that name is ambiguous. */
const withDb = (use: (db: string) => void) => {
  const directory = mkdtempSync(join(tmpdir(), 'history-query-'))
  try {
    const path = join(directory, 'nhl-serve.sqlite')
    writeMini(path)
    const db = new DatabaseSync(path)
    db.prepare('UPDATE players SET name = ?, search_name = ? WHERE player_id IN (18, 20)').run('Twin Skater', 'twin skater')
    db.close()
    use(path)
  } finally { rmSync(directory, { recursive: true, force: true }) }
}

const query = (db: string, ...args: ReadonlyArray<string>) => {
  const run = spawnSync(process.execPath, [script, '--db', db, ...args], { encoding: 'utf8' })
  return { code: run.status, out: run.stdout, err: run.stderr }
}

test('path prints one line per hop with team, season, and evidence game', () => withDb((db) => {
  const run = query(db, 'path', 'Player Eleven', 'Player Fourteen')
  assert.equal(run.code, 0, run.err)
  assert.match(run.out, /^2 hop\(s\)/)
  assert.match(run.out, /Player Eleven \u2192 Player Twelve: 2 games, AAA 1950\u201351 regular season, game 1950020001 \(1950-10-11\)/)
  assert.match(run.out, /Player Twelve \u2192 Player Fourteen: 2 games, BBB 1951\u201352 regular season, game 1951020001 \(1951-10-10\)/)
}))

test('path accepts numeric IDs, accent-folded names, and filters', () => withDb((db) => {
  assert.equal(query(db, 'path', '11', 'dvorak').code, 1)
  const playoff = query(db, 'path', '14', '15', '--playoff')
  assert.equal(playoff.code, 0, playoff.err)
  assert.match(playoff.out, /playoffs, game 1951030111 \(1952-04-02\)/)
  const none = query(db, 'path', '11', '18', '--no-partners')
  assert.equal(none.code, 1)
  assert.equal(none.err, 'No chain between Player Eleven and Twin Skater with these filters.\n')
}))

test('player, link, opponents, farthest, and finals print their answers', () => withDb((db) => {
  const player = query(db, 'player', 'jaromir dvorak')
  assert.equal(player.code, 0, player.err)
  assert.match(player.out, /^Jaromír Dvořák \(id 19, L,/)
  const linked = query(db, 'link', '11', '12')
  assert.equal(linked.code, 0, linked.err)
  assert.match(linked.out, /Player Eleven and Player Twelve: 2 games together/)
  const opp = query(db, 'opponents', '11', '--limit', '2')
  assert.equal(opp.code, 0, opp.err)
  assert.equal(opp.out.trim().split('\n').length, 3)
  const far = query(db, 'farthest', '11')
  assert.equal(far.code, 0, far.err)
  assert.match(far.out, /farthest teammate chain is \d+ hop\(s\)/)
  const finals = query(db, 'finals', '14', '--from', '1950', '--to', '1952')
  assert.equal(finals.code, 0, finals.err)
  assert.match(finals.out, /1952: Player Fifteen/)
}))

test('an ambiguous name lists the players and exits non-zero', () => withDb((db) => {
  const run = query(db, 'player', 'Twin Skater')
  assert.equal(run.code, 1)
  assert.match(run.err, /matches several players/)
  assert.match(run.err, /id 18, D/)
  assert.match(run.err, /id 20, R/)
  assert.equal(query(db, 'player', '20').code, 0)
}))

test('bad input exits non-zero with a one-line message', () => withDb((db) => {
  const unknown = query(db, 'player', 'Nobody Atall')
  assert.equal(unknown.code, 1)
  assert.equal(unknown.err, 'No player matches "Nobody Atall".\n')
  assert.equal(query(db, 'bogus').code, 1)
  assert.equal(query(db, 'path', '11').code, 1)
  assert.equal(query(db, 'path', '11', '12', '--regular', '--playoff').code, 1)
}))

test('a missing serving file is reported as unavailable', () => {
  const run = spawnSync(process.execPath, [script, '--db', join(tmpdir(), 'history-query-missing.sqlite'), 'player', '11'], { encoding: 'utf8' })
  assert.equal(run.status, 1)
  assert.match(run.stderr, /^History unavailable/)
})
