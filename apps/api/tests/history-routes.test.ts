import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { DatabaseSync } from 'node:sqlite'
import { Effect, Layer } from 'effect'
import { FetchHttpClient, HttpRouter } from 'effect/http'
import { RpcClient, RpcClientError, RpcSerialization } from 'effect/rpc'
import { HistoryUnavailable, UnknownPlayer } from '@nhl-reddit-stats/history'
import { HistoryRpcs } from '@nhl-reddit-stats/history/rpc'
import { MINI_ARRAYS, MINI_GAMES, MINI_SNAPSHOT_ID, makeMiniStore } from '../../../packages/history/tests/fakes.ts'
import { History, HistoryRoutes } from '../src/history-routes.ts'

const fake = makeMiniStore()

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

type Client = RpcClient.FromGroup<typeof HistoryRpcs, RpcClientError.RpcClientError>

/** Serves the history routes over `path` and hands the test a typed client wired to the handler. */
const withClient = async (path: string | undefined, use: (client: Client) => Promise<void>) => {
  const web = HttpRouter.toWebHandler(HistoryRoutes.pipe(Layer.provide(History.layer(path))), { disableLogger: true })
  const fetch = FetchHttpClient.Fetch.of((input, init) => web.handler(new Request(input, init)))
  try {
    await Effect.runPromise(Effect.scoped(Effect.gen(function* () {
      const client = yield* RpcClient.make(HistoryRpcs)
      yield* Effect.promise(() => use(client))
    })).pipe(Effect.provide(RpcClient.layerProtocolHttp({ url: 'https://rinkside.example/api/history' }).pipe(
      Layer.provide([FetchHttpClient.layer, RpcSerialization.layerJson]),
      Layer.provide(Layer.succeed(FetchHttpClient.Fetch, fetch)),
    ))))
  } finally { await web.dispose() }
}

const withMini = async (use: (client: Client) => Promise<void>) => {
  const directory = mkdtempSync(join(tmpdir(), 'history-routes-'))
  try {
    const path = join(directory, 'nhl-serve.sqlite')
    writeMini(path)
    await withClient(path, use)
  } finally { rmSync(directory, { recursive: true, force: true }) }
}

const flip = <A, E>(effect: Effect.Effect<A, E>) => Effect.runPromise(Effect.flip(effect))

test('SearchPlayers folds accents, orders by games, and honors the limit', () => withMini(async (client) => {
  const accented = await Effect.runPromise(client.SearchPlayers({ query: 'dvorak', limit: 5 }))
  assert.equal(accented.snapshotId, MINI_SNAPSHOT_ID)
  assert.deepEqual(accented.players.map((p) => p.playerId), [19])
  const all = await Effect.runPromise(client.SearchPlayers({ query: 'player', limit: 20 }))
  const games = all.players.map((p) => p.games)
  assert.deepEqual(games, [...games].sort((a, b) => b - a))
  assert.ok(all.players.length > 2)
  const limited = await Effect.runPromise(client.SearchPlayers({ query: 'player', limit: 2 }))
  assert.deepEqual(limited.players, all.players.slice(0, 2))
}))

test('GetPlayer returns the player and stints; an unknown player is UnknownPlayer', () => withMini(async (client) => {
  const found = await Effect.runPromise(client.GetPlayer({ playerId: 11 }))
  const expected = Effect.runSync(fake.player(11))
  assert.equal(found.snapshotId, MINI_SNAPSHOT_ID)
  assert.equal(found.player.name, expected.player.name)
  assert.deepEqual(found.stints, expected.stints)
  const error = await flip(client.GetPlayer({ playerId: 999 }))
  assert.ok(error instanceof UnknownPlayer)
  assert.equal(error.playerId, 999)
}))

test('a missing serving file is HistoryUnavailable on every call', () => withClient(join(tmpdir(), 'history-routes-missing.sqlite'), async (client) => {
  assert.ok((await flip(client.SearchPlayers({ query: 'a', limit: 1 }))) instanceof HistoryUnavailable)
  assert.ok((await flip(client.GetPlayer({ playerId: 11 }))) instanceof HistoryUnavailable)
}))

test('no configured file is HistoryUnavailable', () => withClient(undefined, async (client) => {
  assert.ok((await flip(client.GetPlayer({ playerId: 11 }))) instanceof HistoryUnavailable)
}))

test('an RPC that a later task owns reports HistoryUnavailable', () => withMini(async (client) => {
  const error = await flip(client.GetRoster({ teamId: 1, seasonId: 20232024, gameType: 2 }))
  assert.ok(error instanceof HistoryUnavailable)
}))
