import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { DatabaseSync } from 'node:sqlite'
import { Effect } from 'effect'
import { MINI_ARRAYS, MINI_OPPONENTS, MINI_GAMES, MINI_SNAPSHOT_ID, makeMiniStore } from '../../../packages/history/tests/fakes.ts'

const fake = makeMiniStore()
const script = new URL('../scripts/history-accept.ts', import.meta.url).pathname

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

const blobs = {
  player_ids: MINI_ARRAYS.playerIds, season_ids: MINI_ARRAYS.seasonIds, team_ids: MINI_ARRAYS.teamIds,
  edge_a: MINI_ARRAYS.edgeA, edge_b: MINI_ARRAYS.edgeB, span_start: MINI_ARRAYS.spanStart,
  span_season: MINI_ARRAYS.spanSeason, span_kind: MINI_ARRAYS.spanKind, span_team: MINI_ARRAYS.spanTeam,
  span_link: MINI_ARRAYS.spanLink, span_games: MINI_ARRAYS.spanGames, span_first_game: MINI_ARRAYS.spanFirstGame,
  opp_a: MINI_OPPONENTS.oppA, opp_b: MINI_OPPONENTS.oppB, opp_games: MINI_OPPONENTS.oppGames,
} satisfies Record<string, ArrayBufferView>

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


// Hand-written truth for C-mini: 10 credited players, 8 shared-game links, goalie partners 16-17, 15 opponent
// pairs, one Final season (1951-52) between teams 2 and 3. No named players, so the named cases skip.
const MINI_TRUTH = {
  players: {},
  player_count: 10,
  shared_game_pairs: 8,
  shared_game_spans: 8,
  opponent_pairs: 15,
  dressed_goalies_available: false,
  partner_spans: 1,
  partner_added_pairs: 1,
  components: 3,
  components_partners_on: 2,
  diameter_partners_off: 4,
  cup_final_seasons: { count: 1, teams_by_season: { '19511952': [2, 3] } },
  pairs: [
    { a: 11, b: 14, partners_on: { distance: 2, chains: 2 }, partners_off: { distance: 2, chains: 2 } },
    { a: 11, b: 16, partners_on: { distance: 4, chains: 2 }, partners_off: { distance: 4, chains: 2 } },
    { a: 11, b: 18, partners_on: { distance: 6, chains: 2 }, partners_off: { distance: null, chains: null } },
    { a: 11, b: 19, partners_on: { distance: null, chains: null }, partners_off: { distance: null, chains: null } },
  ],
}

const withFiles = (truth: unknown, use: (db: string, truthPath: string) => void) => {
  const directory = mkdtempSync(join(tmpdir(), 'history-accept-'))
  try {
    const db = join(directory, 'nhl-serve.sqlite')
    writeMini(db)
    const truthPath = join(directory, 'truth.json')
    // Test fixture: the truth file is plain JSON text.
    writeFileSync(truthPath, JSON.stringify(truth))
    use(db, truthPath)
  } finally { rmSync(directory, { recursive: true, force: true }) }
}

const accept = (db: string, truth: string, ...flags: ReadonlyArray<string>) => {
  const run = spawnSync(process.execPath, [script, '--db', db, '--truth', truth, ...flags], { encoding: 'utf8' })
  return { code: run.status, out: run.stdout, err: run.stderr }
}

test('a matching truth file is accepted and the report lists every case and the timings', () => withFiles(MINI_TRUTH, (db, truth) => {
  const run = accept(db, truth)
  assert.equal(run.code, 0, run.out + run.err)
  assert.match(run.out, /^PASS players: actual 10, truth 10/m)
  assert.match(run.out, /^PASS components with partners off \(farthest from every player\): actual 3/m)
  assert.match(run.out, /^PASS diameter with partners off: actual 4, truth 4/m)
  assert.match(run.out, /^PASS seasons with a flagged Cup Final: actual 1/m)
  assert.match(run.out, /^PASS truth parity: 4 of 4 pairs match/m)
  assert.match(run.out, /^SKIP Hill and Samsonov goalie partners: skipped: no dressed goalies/m)
  assert.match(run.out, /^cold load \(open \+ makeGraph\): \d+ ms$/m)
  assert.match(run.out, /^median of 1000 findPaths calls: [\d.]+ ms$/m)
  assert.doesNotMatch(run.out, /^FAIL/m)
}))

test('--skip-diameter skips the diameter and still checks components', () => withFiles(MINI_TRUTH, (db, truth) => {
  const run = accept(db, truth, '--skip-diameter')
  assert.equal(run.code, 0, run.out + run.err)
  assert.match(run.out, /^SKIP diameter with partners off: skipped: --skip-diameter/m)
  assert.match(run.out, /^PASS components with partners off: actual 3/m)
}))

test('counts may grow without --baseline, but a smaller serving count fails', () => {
  withFiles({ ...MINI_TRUTH, player_count: 9 }, (db, truth) => {
    assert.equal(accept(db, truth).code, 0)
  })
  withFiles({ ...MINI_TRUTH, player_count: 11 }, (db, truth) => {
    const run = accept(db, truth)
    assert.equal(run.code, 1)
    assert.match(run.out, /^FAIL players: actual 10, truth 11/m)
  })
})

test('a truth file that does not match exits non-zero', () => {
  const wrongPair = { a: 11, b: 14, partners_on: { distance: 3, chains: 1 }, partners_off: { distance: 2, chains: 2 } }
  withFiles({ ...MINI_TRUTH, pairs: [wrongPair, ...MINI_TRUTH.pairs.slice(1)], partner_added_pairs: 0 }, (db, truth) => {
    const run = accept(db, truth)
    assert.equal(run.code, 1)
    assert.match(run.out, /^FAIL truth parity: 3 of 4 pairs match/m)
    assert.match(run.out, /^FAIL pairs added by goalie partners/m)
    assert.match(run.out, /^REJECTED: 2 case\(s\) failed/m)
  })
})

test('--baseline demands the pinned numbers and fails on C-mini', () => withFiles(MINI_TRUTH, (db, truth) => {
  const run = accept(db, truth, '--baseline')
  assert.equal(run.code, 1)
  assert.match(run.out, /^FAIL players: actual 10, truth 10, baseline 8842/m)
  assert.match(run.out, /^FAIL McDavid shared-game teammates: missing/m)
}))

test('missing or malformed arguments and truth files exit non-zero', () => withFiles(MINI_TRUTH, (db) => {
  assert.equal(accept(db, join(tmpdir(), 'no-such-truth.json')).code, 1)
  assert.equal(spawnSync(process.execPath, [script, '--db', db], { encoding: 'utf8' }).status, 1)
}))
