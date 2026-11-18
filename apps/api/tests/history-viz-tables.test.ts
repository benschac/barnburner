import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'
import { DatabaseSync } from 'node:sqlite'
import { Effect, Schema } from 'effect'
import { ViewData } from '@nhl-reddit-stats/viz'
import { chainSample, egoSample, leagueSample, opponentsSample, pairSample } from '@nhl-reddit-stats/viz/samples'
import { MINI_ARRAYS, MINI_GAMES, MINI_SNAPSHOT_ID, makeMiniStore } from '../../../packages/history/tests/fakes.ts'

const fake = makeMiniStore()
const script = fileURLToPath(new URL('../scripts/history-viz-tables.ts', import.meta.url))

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
  const directory = mkdtempSync(join(tmpdir(), 'history-viz-tables-'))
  try {
    const path = join(directory, 'nhl-serve.sqlite')
    writeMini(path)
    const db = new DatabaseSync(path)
    db.prepare('UPDATE players SET name = ?, search_name = ? WHERE player_id IN (18, 20)').run('Twin Skater', 'twin skater')
    db.close()
    use(path)
  } finally { rmSync(directory, { recursive: true, force: true }) }
}

const run = (db: string, out: string, ...args: ReadonlyArray<string>) => {
  const done = spawnSync(process.execPath, [script, '--db', db, '--out', out, ...args], { encoding: 'utf8' })
  return { code: done.status, out: done.stdout, err: done.stderr }
}

const decodeView = Schema.decodeUnknownSync(Schema.fromJsonString(ViewData))

const read = (path: string) => {
  assert.ok(existsSync(path), path)
  return decodeView(readFileSync(path, 'utf8'))
}

const counts = (tables: Record<string, ReadonlyArray<unknown>>) =>
  Object.fromEntries(Object.entries(tables).map(([name, rows]) => [name, rows.length]))

const exported = (args: ReadonlyArray<string>, file: string, check: (value: ReturnType<typeof read>) => void) =>
  withDb((db) => {
    const out = mkdtempSync(join(tmpdir(), 'history-viz-out-'))
    try {
      const done = run(db, out, ...args)
      assert.equal(done.code, 0, done.err)
      assert.equal(done.out.trim(), join(out, file))
      check(read(join(out, file)))
    } finally { rmSync(out, { recursive: true, force: true }) }
  })

test('chain writes the 11 to 14 chains', () => exported(['chain', 'Player Eleven', 'Player Fourteen'], 'chain-11-14.json', (v) => {
  assert.deepEqual(counts(v.tables), counts(chainSample.tables))
}))
test('pair writes 15 with 16', () => exported(['pair', '15', '16'], 'pair-15-16.json', (v) => {
  assert.deepEqual(counts(v.tables), counts(pairSample.tables))
}))
test('ego writes player 14', () => exported(['ego', '14'], 'ego-14.json', (v) => {
  assert.deepEqual(counts(v.tables), counts(egoSample.tables))
}))
test('league writes every player', () => exported(['league'], 'league.json', (v) => {
  assert.deepEqual(counts(v.tables), counts(leagueSample.tables))
}))
test('opponents writes 16 and 12', () => exported(['opponents', '16', '12'], 'opponents-16-12.json', (v) => {
  assert.deepEqual(counts(v.tables), counts(opponentsSample.tables))
}))
test('finals writes 14 for 1950 to 1952', () => exported(['finals', '14', '--from', '1950', '--to', '1952'], 'finals-14-1950-1952.json', (v) => {
  assert.equal(v.tables.finals?.length, 1)
}))

test('an unwritable destination prints one line, exits non-zero, and leaves no partial file', () => withDb((db) => {
  const done = run(db, '/dev/null', 'ego', '14')
  assert.equal(done.code, 1)
  assert.match(done.err, /^Could not write \/dev\/null\/ego-14\.json: .*\n$/)
  const out = mkdtempSync(join(tmpdir(), 'history-viz-out-'))
  try {
    assert.equal(run(db, out, 'ego', '14').code, 0)
    assert.deepEqual(readdirSync(out), ['ego-14.json'])
  } finally { rmSync(out, { recursive: true, force: true }) }
}))

test('an ambiguous name lists every match, not one page', () => withDb((db) => {
  const extra = new DatabaseSync(db)
  for (let id = 100; id < 130; id += 1) {
    extra.prepare('INSERT INTO players VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').run(id, `Smith ${id}`, `smith ${id}`, 'C', 19501951, 19501951, 1, 0, 0)
  }
  extra.close()
  const done = run(db, '/dev/null', 'ego', 'Smith')
  assert.equal(done.code, 1)
  assert.equal(done.err.trim().split('\n').length, 1 + 30)
  assert.match(done.err, /id 129,/)
}))

test('an ambiguous name lists the players, exits non-zero, and writes nothing', () => withDb((db) => {
  const out = mkdtempSync(join(tmpdir(), 'history-viz-out-'))
  try {
    const done = run(db, out, 'ego', 'Twin Skater')
    assert.equal(done.code, 1)
    assert.match(done.err, /matches several players/)
    assert.match(done.err, /id 18, D/)
    assert.match(done.err, /id 20, R/)
    assert.equal(existsSync(join(out, 'ego-18.json')), false)
  } finally { rmSync(out, { recursive: true, force: true }) }
}))
