import { DatabaseSync } from 'node:sqlite'
import type { StatementSync } from 'node:sqlite'
import { Effect, Schema } from 'effect'
import { HistoryUnavailable, UnknownPlayer, UnknownRoster } from '@nhl-reddit-stats/history'
import type {
  FinalParticipant, FinalRow, Graph, GraphArrays, HistoryStore, OpposedGameRow, PlayerDetail,
  PlayerRow, RosterRow, SharedGameRow, StintRow,
} from '@nhl-reddit-stats/history'

// Reads the serving database (plan C-serve, C-graph) through the built-in `node:sqlite`. The file is
// opened read-only and every statement is prepared when the store opens, so a file with a missing
// table fails once, as `HistoryUnavailable`.

const SCHEMA_VERSION = '1'

const unavailable = (message: string) => new HistoryUnavailable({ message })
const invalid = () => unavailable('The history serving file is invalid.')

/** Runs foreign `node:sqlite` code and translates any exception into the tagged error. */
const attempt = <A>(run: () => A, message: string) =>
  Effect.try({ try: run, catch: () => unavailable(message) })

const Count = Schema.Int.check(Schema.isGreaterThanOrEqualTo(0))
const PositionSchema = Schema.Literals(['C', 'L', 'R', 'D', 'G'])
const PlayerRowSchema = Schema.Struct({
  playerId: Schema.Int, name: Schema.String, searchName: Schema.String, position: PositionSchema,
  firstSeason: Schema.Int, lastSeason: Schema.Int, games: Count, points: Count, teammates: Count,
})
const StintRowSchema = Schema.Struct({
  seasonId: Schema.Int, gameType: Schema.Literals([2, 3]), teamId: Schema.Int, teamAbbrev: Schema.String,
  teamName: Schema.String, games: Count, firstGameId: Schema.Int, lastGameId: Schema.Int,
})
const RosterRowSchema = Schema.Struct({ playerId: Schema.Int, name: Schema.String, position: PositionSchema, games: Count })
const SharedRowSchema = Schema.Struct({ gameId: Schema.Int, gameDate: Schema.String })
const OpposedRowSchema = Schema.Struct({
  gameId: Schema.Int, gameDate: Schema.String, aTeamId: Schema.Int, bTeamId: Schema.Int,
})
const FinalGameRowSchema = Schema.Struct({
  seasonId: Schema.Int, gameId: Schema.Int, playerId: Schema.Int, teamId: Schema.Int,
})
const BlobInfoSchema = Schema.Struct({ name: Schema.String, size: Count })
const MetaSchema = Schema.Struct({ value: Schema.String })
const FoundSchema = Schema.Struct({ found: Schema.Int })

const decodeRows = <S extends Schema.Top & { readonly DecodingServices: never }>(schema: S, rows: ReadonlyArray<unknown>) =>
  Schema.decodeUnknownEffect(Schema.Array(schema))(rows).pipe(Effect.mapError(invalid))

/** Accent-folded and lower-cased, as `players.search_name` is built. */
const foldName = (name: string): string => name.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()

const OPPONENT_BLOBS = ['opp_a', 'opp_b', 'opp_games'] as const

/**
 * Copies the blob into a fresh `ArrayBuffer`, because a Buffer slice of a database page can be
 * unaligned. The arrays are little-endian on disk and read natively, which holds on every platform
 * this service runs on.
 */
const aligned = (bytes: Uint8Array): ArrayBuffer => {
  const copy = new Uint8Array(bytes.byteLength)
  copy.set(bytes)
  return copy.buffer
}

/**
 * Opens the serving file read-only. `snapshotId` and the teammate arrays load here; the opponent
 * arrays load on the first read of `graph.arrays.oppA`, `oppB`, or `oppGames`. A missing file, a
 * missing table, a wrong `schema_version`, or a malformed blob is `HistoryUnavailable`.
 */
export const openHistoryStore = (path: string): Effect.Effect<HistoryStore, HistoryUnavailable> => Effect.gen(function* () {
  const db = yield* attempt(() => new DatabaseSync(path, { readOnly: true }), 'The history serving file could not be opened.')
  const prepare = (sql: string) => attempt(() => db.prepare(sql), 'The history serving file is missing a table.')
  const rowsOf = (statement: StatementSync, ...params: Array<string | number>) =>
    attempt(() => statement.all(...params), 'The history query failed.')

  const metaStatement = yield* prepare('SELECT value FROM meta WHERE key = ?')
  const meta = (key: string) => rowsOf(metaStatement, key).pipe(
    Effect.flatMap((rows) => decodeRows(MetaSchema, rows)),
    Effect.map((rows) => rows.at(0)?.value ?? null),
  )
  if ((yield* meta('schema_version')) !== SCHEMA_VERSION) return yield* unavailable('The history serving file has an unsupported schema.')
  const snapshotId = yield* meta('snapshot_id')
  if (snapshotId === null) return yield* invalid()

  const playerColumns = `player_id AS playerId, name, search_name AS searchName, position, first_season AS firstSeason,
            last_season AS lastSeason, games, points, teammates`
  const searchStatement = yield* prepare(
    `SELECT ${playerColumns} FROM players WHERE instr(search_name, ?) > 0 ORDER BY games DESC, player_id LIMIT ?`,
  )
  const playerStatement = yield* prepare(`SELECT ${playerColumns} FROM players WHERE player_id = ?`)
  const stintsStatement = yield* prepare(
    `SELECT s.season_id AS seasonId, s.game_type AS gameType, s.team_id AS teamId, t.abbrev AS teamAbbrev,
            t.name AS teamName, s.games, s.first_game_id AS firstGameId, s.last_game_id AS lastGameId
     FROM stints s JOIN teams t ON t.team_id = s.team_id
     WHERE s.player_id = ? ORDER BY s.season_id, s.game_type, s.team_id`,
  )
  const rosterStatement = yield* prepare(
    `SELECT p.player_id AS playerId, p.name, p.position, s.games
     FROM stints s JOIN players p ON p.player_id = s.player_id
     WHERE s.team_id = ? AND s.season_id = ? AND s.game_type = ? ORDER BY s.games DESC, p.player_id`,
  )
  const knownStatement = yield* prepare('SELECT 1 AS found FROM players WHERE player_id = ?')
  const tableStatement = yield* prepare("SELECT 1 AS found FROM sqlite_master WHERE type = 'table' AND name = ?")
  const playedWithStatement = yield* prepare(
    `SELECT g.game_id AS gameId, g.game_date AS gameDate
     FROM games g
     JOIN appearances x ON x.game_id = g.game_id AND x.player_id = ? AND x.team_id = ?
     JOIN appearances y ON y.game_id = g.game_id AND y.player_id = ? AND y.team_id = ?
     WHERE g.season_id = ? AND g.game_type = ? ORDER BY g.game_date, g.game_id`,
  )
  // Goalie partners (D2): both on the team's dressed-goalie rows, not both credited. The serving build
  // writes `dressed_goalies`; a file without it has no partner games, so the statement is optional.
  const hasDressed = (yield* rowsOf(tableStatement, 'dressed_goalies')).length > 0
  const partnersStatement = hasDressed
    ? yield* prepare(
      `SELECT g.game_id AS gameId, g.game_date AS gameDate
       FROM games g
       JOIN dressed_goalies x ON x.game_id = g.game_id AND x.player_id = ? AND x.team_id = ?
       JOIN dressed_goalies y ON y.game_id = g.game_id AND y.player_id = ? AND y.team_id = ?
       WHERE g.season_id = ? AND g.game_type = ?
         AND NOT (EXISTS (SELECT 1 FROM appearances c WHERE c.game_id = g.game_id AND c.player_id = x.player_id AND c.team_id = x.team_id)
              AND EXISTS (SELECT 1 FROM appearances c WHERE c.game_id = g.game_id AND c.player_id = y.player_id AND c.team_id = y.team_id))
       ORDER BY g.game_date, g.game_id`,
    )
    : null
  const opposedStatement = yield* prepare(
    `SELECT g.game_id AS gameId, g.game_date AS gameDate, x.team_id AS aTeamId, y.team_id AS bTeamId
     FROM games g
     JOIN appearances x ON x.game_id = g.game_id AND x.player_id = ?
     JOIN appearances y ON y.game_id = g.game_id AND y.player_id = ? AND y.team_id <> x.team_id
     ORDER BY g.game_date, g.game_id`,
  )
  const finalsStatement = yield* prepare(
    `SELECT g.season_id AS seasonId, g.game_id AS gameId, a.player_id AS playerId, a.team_id AS teamId
     FROM games g JOIN appearances a ON a.game_id = g.game_id
     WHERE g.cup_final = 1 AND g.season_id % 10000 BETWEEN ? AND ?
     ORDER BY g.season_id, g.game_date, g.game_id, a.player_id`,
  )
  const blobInfoStatement = yield* prepare('SELECT name, length(bytes) AS size FROM graph_arrays')
  const blobStatement = yield* prepare('SELECT bytes FROM graph_arrays WHERE name = ?')

  const sizes = new Map((yield* decodeRows(BlobInfoSchema, yield* rowsOf(blobInfoStatement))).map((row) => [row.name, row.size] as const))
  const blob = (name: string, width: 1 | 2 | 4) => Effect.gen(function* () {
    const size = sizes.get(name)
    if (size === undefined || size % width !== 0) return yield* invalid()
    const bytes = (yield* rowsOf(blobStatement, name)).at(0)?.bytes
    if (!(bytes instanceof Uint8Array)) return yield* invalid()
    return aligned(bytes)
  })
  const u8 = (name: string) => blob(name, 1).pipe(Effect.map((buffer) => new Uint8Array(buffer)))
  const u16 = (name: string) => blob(name, 2).pipe(Effect.map((buffer) => new Uint16Array(buffer)))
  const u32 = (name: string) => blob(name, 4).pipe(Effect.map((buffer) => new Uint32Array(buffer)))

  const playerIds = yield* u32('player_ids')
  const seasonIds = yield* u32('season_ids')
  const teamIds = yield* u32('team_ids')
  const edgeA = yield* u16('edge_a')
  const edgeB = yield* u16('edge_b')
  const spanStart = yield* u32('span_start')
  const spanSeason = yield* u8('span_season')
  const spanKind = yield* u8('span_kind')
  const spanTeam = yield* u8('span_team')
  const spanLink = yield* u8('span_link')
  const spanGames = yield* u16('span_games')
  const spanFirstGame = yield* u32('span_first_game')

  // The opponent arrays load once, on first use. Their sizes were checked at open, so a failure
  // here means the file changed underneath us, which is a defect rather than an expected error.
  type Opponents = { readonly a: Uint16Array; readonly b: Uint16Array; readonly games: Uint16Array }
  let opponents: Opponents | null | undefined
  const loadOpponents = (): Opponents | null => {
    if (opponents === undefined) {
      opponents = OPPONENT_BLOBS.every((name) => sizes.has(name))
        ? Effect.runSync(Effect.all({ a: u16('opp_a'), b: u16('opp_b'), games: u16('opp_games') }).pipe(Effect.orDie))
        : null
    }
    return opponents
  }
  const arrays: GraphArrays = {
    playerIds, seasonIds, teamIds, edgeA, edgeB, spanStart, spanSeason, spanKind, spanTeam, spanLink, spanGames, spanFirstGame,
    get oppA() { return loadOpponents()?.a },
    get oppB() { return loadOpponents()?.b },
    get oppGames() { return loadOpponents()?.games },
  }
  const graph: Graph = { arrays, indexOf: new Map(Array.from(playerIds, (id, index) => [id, index] as const)) }

  const requireKnown = (playerId: number) => rowsOf(knownStatement, playerId).pipe(
    Effect.flatMap((rows) => decodeRows(FoundSchema, rows)),
    Effect.flatMap((rows) => rows.length === 0 ? Effect.fail(new UnknownPlayer({ playerId })) : Effect.void),
  )

  const searchPlayers: HistoryStore['searchPlayers'] = (query, limit) => {
    const needle = foldName(query.trim())
    if (needle.length === 0) return Effect.succeed([])
    return rowsOf(searchStatement, needle, limit).pipe(
      Effect.flatMap((rows) => decodeRows(PlayerRowSchema, rows)),
      Effect.map((rows): ReadonlyArray<PlayerRow> => rows),
    )
  }

  const player: HistoryStore['player'] = (playerId) => Effect.gen(function* () {
    const found = (yield* decodeRows(PlayerRowSchema, yield* rowsOf(playerStatement, playerId))).at(0)
    if (found === undefined) return yield* new UnknownPlayer({ playerId })
    const stints: ReadonlyArray<StintRow> = yield* decodeRows(StintRowSchema, yield* rowsOf(stintsStatement, playerId))
    return { player: found, stints } satisfies PlayerDetail
  })

  const roster: HistoryStore['roster'] = (teamId, seasonId, gameType) => Effect.gen(function* () {
    const rows: ReadonlyArray<RosterRow> = yield* decodeRows(RosterRowSchema, yield* rowsOf(rosterStatement, teamId, seasonId, gameType))
    if (rows.length === 0) return yield* new UnknownRoster({ teamId, seasonId, gameType })
    return rows
  })

  const sharedGames: HistoryStore['sharedGames'] = (a, b, seasonId, gameType, teamId, requested) => Effect.gen(function* () {
    yield* requireKnown(a)
    yield* requireKnown(b)
    // The same ID twice is not a pair; the joins would otherwise return the player's own games.
    if (a === b) return []
    const statement = requested === 'PlayedWith' ? playedWithStatement : partnersStatement
    if (statement === null) return []
    const rows = yield* decodeRows(SharedRowSchema, yield* rowsOf(statement, a, teamId, b, teamId, seasonId, gameType))
    return rows.map((row): SharedGameRow => ({ ...row, link: requested }))
  })

  const opposedGames: HistoryStore['opposedGames'] = (a, b) => Effect.gen(function* () {
    yield* requireKnown(a)
    yield* requireKnown(b)
    const rows: ReadonlyArray<OpposedGameRow> = yield* decodeRows(OpposedRowSchema, yield* rowsOf(opposedStatement, a, b))
    return rows
  })

  const finals: HistoryStore['finals'] = (fromYear, toYear) => Effect.gen(function* () {
    const rows = yield* decodeRows(FinalGameRowSchema, yield* rowsOf(finalsStatement, fromYear, toYear))
    const bySeason = new Map<number, { gameIds: Array<number>; participants: Map<number, FinalParticipant> }>()
    for (const row of rows) {
      const entry = bySeason.get(row.seasonId) ?? { gameIds: [], participants: new Map<number, FinalParticipant>() }
      bySeason.set(row.seasonId, entry)
      if (!entry.gameIds.includes(row.gameId)) entry.gameIds.push(row.gameId)
      // Rows arrive oldest game first, so a player's first row is his first Final game.
      if (!entry.participants.has(row.playerId)) {
        entry.participants.set(row.playerId, { playerId: row.playerId, teamId: row.teamId, firstGameId: row.gameId })
      }
    }
    return [...bySeason.entries()].map(([seasonId, entry]): FinalRow => ({
      year: seasonId % 10000,
      seasonId,
      gameIds: entry.gameIds,
      participants: [...entry.participants.values()].sort((x, y) => x.playerId - y.playerId),
    })).sort((x, y) => x.year - y.year)
  })

  return { snapshotId, graph, searchPlayers, player, roster, sharedGames, opposedGames, finals } satisfies HistoryStore
})
