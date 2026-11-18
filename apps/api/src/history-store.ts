import { SqliteClient } from '@effect/sql-sqlite-node'
import { Effect, Schema, Scope } from 'effect'
import { Reactivity } from 'effect/reactivity'
import { SqlSchema } from 'effect/sql'
import type { SqlClient, SqlError } from 'effect/sql'
import { HistoryUnavailable, UnknownPlayer, UnknownRoster } from '@nhl-reddit-stats/history'
import type {
  FinalParticipant, FinalRow, Graph, GraphArrays, HistoryStore, OpposedGameRow, PlayerDetail,
  PlayerRow, RosterRow, SharedGameRow, StintRow,
} from '@nhl-reddit-stats/history'

// Reads the serving database (plan C-serve, C-graph) through Effect SQL on the built-in `node:sqlite`.
// The file is opened read-only, and every query is compiled with `EXPLAIN` when the store opens, so a
// file with a missing table or column fails once, as `HistoryUnavailable`.

const SCHEMA_VERSION = '1'

const unavailable = (message: string) => new HistoryUnavailable({ message })
const invalid = () => unavailable('The history serving file is invalid.')

/** A failed statement is `HistoryUnavailable` with `message`; a row or request that does not match its schema is an invalid file. */
const served = (message: string) => <A, R>(effect: Effect.Effect<A, SqlError.SqlError | Schema.SchemaError, R>) => effect.pipe(
  Effect.catchTags({
    SqlError: () => Effect.fail(unavailable(message)),
    SchemaError: () => Effect.fail(invalid()),
  }),
)
const queried = served('The history query failed.')

const Count = Schema.Int.check(Schema.isGreaterThanOrEqualTo(0))
const GameTypeSchema = Schema.Literals([2, 3])
const PositionSchema = Schema.Literals(['C', 'L', 'R', 'D', 'G'])
const PlayerRowSchema = Schema.Struct({
  playerId: Schema.Int, name: Schema.String, searchName: Schema.String, position: PositionSchema,
  firstSeason: Schema.Int, lastSeason: Schema.Int, games: Count, points: Count, teammates: Count,
})
const StintRowSchema = Schema.Struct({
  seasonId: Schema.Int, gameType: GameTypeSchema, teamId: Schema.Int, teamAbbrev: Schema.String,
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
const BlobSchema = Schema.Struct({ bytes: Schema.Uint8Array })
const MetaSchema = Schema.Struct({ value: Schema.String })
const FoundSchema = Schema.Struct({ found: Schema.Int })

const PlayerIdRequest = Schema.Struct({ playerId: Schema.Int })
const SearchRequest = Schema.Struct({ needle: Schema.String, limit: Count })
const RosterRequest = Schema.Struct({ teamId: Schema.Int, seasonId: Schema.Int, gameType: GameTypeSchema })
const SpanRequest = Schema.Struct({
  a: Schema.Int, b: Schema.Int, teamId: Schema.Int, seasonId: Schema.Int, gameType: GameTypeSchema,
})
const PairRequest = Schema.Struct({ a: Schema.Int, b: Schema.Int })
const YearsRequest = Schema.Struct({ fromYear: Schema.Int, toYear: Schema.Int })

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

/** One read-only connection; it closes with the surrounding scope. */
const connect = (path: string) => SqliteClient.make({ filename: path, readonly: true }).pipe(
  Effect.provide(Reactivity.layer),
  Effect.catchTag('SqlError', () => Effect.fail(unavailable('The history serving file could not be opened.'))),
)

const metaOf = (sql: SqlClient.SqlClient) => SqlSchema.findOneOption({
  Request: Schema.String,
  Result: MetaSchema,
  execute: (key) => sql`SELECT value FROM meta WHERE key = ${key}`,
})

/** The blob `name`, read through `sql`; the caller checks that it exists and its size. */
const blobOf = (sql: SqlClient.SqlClient) => SqlSchema.findOneOption({
  Request: Schema.String,
  Result: BlobSchema,
  execute: (name) => sql`SELECT bytes FROM graph_arrays WHERE name = ${name}`,
})

/**
 * Builds the store over an open connection to `path`. `snapshotId` and the teammate arrays load here; the
 * opponent arrays load on the first read of `graph.arrays.oppA`, `oppB`, or `oppGames`. A missing table or
 * column, a wrong `schema_version`, or a malformed blob is `HistoryUnavailable`.
 */
const buildHistoryStore = (sql: SqlClient.SqlClient, path: string): Effect.Effect<HistoryStore, HistoryUnavailable> => Effect.gen(function* () {
  const meta = (key: string) => metaOf(sql)(key).pipe(
    Effect.map((row) => row._tag === 'Some' ? row.value.value : null),
    served('The history serving file is missing a table.'),
  )
  if ((yield* meta('schema_version')) !== SCHEMA_VERSION) return yield* unavailable('The history serving file has an unsupported schema.')
  const snapshotId = yield* meta('snapshot_id')
  if (snapshotId === null) return yield* invalid()

  const playerColumns = sql.literal(`player_id AS playerId, name, search_name AS searchName, position, first_season AS firstSeason,
            last_season AS lastSeason, games, points, teammates`)
  const searchSql = ({ needle, limit }: typeof SearchRequest.Encoded) =>
    sql`SELECT ${playerColumns} FROM players WHERE instr(search_name, ${needle}) > 0 ORDER BY games DESC, player_id LIMIT ${limit}`
  const playerSql = ({ playerId }: typeof PlayerIdRequest.Encoded) => sql`SELECT ${playerColumns} FROM players WHERE player_id = ${playerId}`
  const stintsSql = ({ playerId }: typeof PlayerIdRequest.Encoded) => sql`
    SELECT s.season_id AS seasonId, s.game_type AS gameType, s.team_id AS teamId, t.abbrev AS teamAbbrev,
           t.name AS teamName, s.games, s.first_game_id AS firstGameId, s.last_game_id AS lastGameId
    FROM stints s JOIN teams t ON t.team_id = s.team_id
    WHERE s.player_id = ${playerId} ORDER BY s.season_id, s.game_type, s.team_id`
  const rosterSql = ({ teamId, seasonId, gameType }: typeof RosterRequest.Encoded) => sql`
    SELECT p.player_id AS playerId, p.name, p.position, s.games
    FROM stints s JOIN players p ON p.player_id = s.player_id
    WHERE s.team_id = ${teamId} AND s.season_id = ${seasonId} AND s.game_type = ${gameType} ORDER BY s.games DESC, p.player_id`
  const knownSql = ({ playerId }: typeof PlayerIdRequest.Encoded) => sql`SELECT 1 AS found FROM players WHERE player_id = ${playerId}`
  const playedWithSql = ({ a, b, teamId, seasonId, gameType }: typeof SpanRequest.Encoded) => sql`
    SELECT g.game_id AS gameId, g.game_date AS gameDate
    FROM games g
    JOIN appearances x ON x.game_id = g.game_id AND x.player_id = ${a} AND x.team_id = ${teamId}
    JOIN appearances y ON y.game_id = g.game_id AND y.player_id = ${b} AND y.team_id = ${teamId}
    WHERE g.season_id = ${seasonId} AND g.game_type = ${gameType} ORDER BY g.game_date, g.game_id`
  // Goalie partners (D2): both on the team's dressed-goalie rows, not both credited.
  const partnersSql = ({ a, b, teamId, seasonId, gameType }: typeof SpanRequest.Encoded) => sql`
    SELECT g.game_id AS gameId, g.game_date AS gameDate
    FROM games g
    JOIN dressed_goalies x ON x.game_id = g.game_id AND x.player_id = ${a} AND x.team_id = ${teamId}
    JOIN dressed_goalies y ON y.game_id = g.game_id AND y.player_id = ${b} AND y.team_id = ${teamId}
    WHERE g.season_id = ${seasonId} AND g.game_type = ${gameType}
      AND NOT (EXISTS (SELECT 1 FROM appearances c WHERE c.game_id = g.game_id AND c.player_id = x.player_id AND c.team_id = x.team_id)
           AND EXISTS (SELECT 1 FROM appearances c WHERE c.game_id = g.game_id AND c.player_id = y.player_id AND c.team_id = y.team_id))
    ORDER BY g.game_date, g.game_id`
  const opposedSql = ({ a, b }: typeof PairRequest.Encoded) => sql`
    SELECT g.game_id AS gameId, g.game_date AS gameDate, x.team_id AS aTeamId, y.team_id AS bTeamId
    FROM games g
    JOIN appearances x ON x.game_id = g.game_id AND x.player_id = ${a}
    JOIN appearances y ON y.game_id = g.game_id AND y.player_id = ${b} AND y.team_id <> x.team_id
    ORDER BY g.game_date, g.game_id`
  const finalsSql = ({ fromYear, toYear }: typeof YearsRequest.Encoded) => sql`
    SELECT g.season_id AS seasonId, g.game_id AS gameId, a.player_id AS playerId, a.team_id AS teamId
    FROM games g JOIN appearances a ON a.game_id = g.game_id
    WHERE g.cup_final = 1 AND g.season_id % 10000 BETWEEN ${fromYear} AND ${toYear}
    ORDER BY g.season_id, g.game_date, g.game_id, a.player_id`
  const blobInfoSql = sql`SELECT name, length(bytes) AS size FROM graph_arrays`

  // The serving build writes `dressed_goalies`; a file without it has no partner games.
  const hasDressed = (yield* sql`SELECT 1 AS found FROM sqlite_master WHERE type = 'table' AND name = 'dressed_goalies'`.pipe(
    served('The history query failed.'),
  )).length > 0

  // Compiling each query once proves its tables and columns exist; SQLite runs none of them.
  const span = { a: 0, b: 0, teamId: 0, seasonId: 0, gameType: 2 } as const
  const probes = [
    searchSql({ needle: '', limit: 0 }), playerSql({ playerId: 0 }), stintsSql({ playerId: 0 }),
    rosterSql({ teamId: 0, seasonId: 0, gameType: 2 }), knownSql({ playerId: 0 }), playedWithSql(span),
    ...(hasDressed ? [partnersSql(span)] : []), opposedSql({ a: 0, b: 0 }), finalsSql({ fromYear: 0, toYear: 0 }),
    blobInfoSql, sql`SELECT bytes FROM graph_arrays WHERE name = ''`,
  ]
  yield* Effect.forEach(probes, (probe) => sql`EXPLAIN ${probe}`, { discard: true }).pipe(
    Effect.catchTag('SqlError', () => Effect.fail(unavailable('The history serving file is missing a table.'))),
  )

  const searchQuery = SqlSchema.findAll({ Request: SearchRequest, Result: PlayerRowSchema, execute: searchSql })
  const playerQuery = SqlSchema.findOneOption({ Request: PlayerIdRequest, Result: PlayerRowSchema, execute: playerSql })
  const stintsQuery = SqlSchema.findAll({ Request: PlayerIdRequest, Result: StintRowSchema, execute: stintsSql })
  const rosterQuery = SqlSchema.findAll({ Request: RosterRequest, Result: RosterRowSchema, execute: rosterSql })
  const knownQuery = SqlSchema.findOneOption({ Request: PlayerIdRequest, Result: FoundSchema, execute: knownSql })
  const playedWithQuery = SqlSchema.findAll({ Request: SpanRequest, Result: SharedRowSchema, execute: playedWithSql })
  const partnersQuery = SqlSchema.findAll({ Request: SpanRequest, Result: SharedRowSchema, execute: partnersSql })
  const opposedQuery = SqlSchema.findAll({ Request: PairRequest, Result: OpposedRowSchema, execute: opposedSql })
  const finalsQuery = SqlSchema.findAll({ Request: YearsRequest, Result: FinalGameRowSchema, execute: finalsSql })

  const blobInfo = yield* Schema.decodeUnknownEffect(Schema.Array(BlobInfoSchema))(yield* blobInfoSql.pipe(queried)).pipe(
    Effect.mapError(invalid),
  )
  const sizes = new Map(blobInfo.map((row) => [row.name, row.size] as const))

  /** The blob `name` from `client`, copied aligned. A missing row, a wrong size, or a non-blob value is an invalid file. */
  const blob = (client: SqlClient.SqlClient, name: string, width: 1 | 2 | 4) => Effect.gen(function* () {
    const size = sizes.get(name)
    if (size === undefined || size % width !== 0) return yield* invalid()
    const row = yield* blobOf(client)(name).pipe(queried)
    if (row._tag === 'None' || row.value.bytes.byteLength !== size) return yield* invalid()
    return aligned(row.value.bytes)
  })
  const u8 = (name: string) => blob(sql, name, 1).pipe(Effect.map((buffer) => new Uint8Array(buffer)))
  const u16 = (name: string) => blob(sql, name, 2).pipe(Effect.map((buffer) => new Uint16Array(buffer)))
  const u32 = (name: string) => blob(sql, name, 4).pipe(Effect.map((buffer) => new Uint32Array(buffer)))

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

  // The opponent arrays load once, on first use, from the getters below, which are synchronous. They read
  // through their own short-lived connection: the store's connection sits behind a one-permit semaphore
  // that another fiber can hold across a yield, which `Effect.runSync` cannot wait for. Sizes were checked
  // at open and the snapshot is checked again, so a failure here means the file changed underneath us,
  // which is a defect rather than an expected error.
  type Opponents = { readonly a: Uint16Array; readonly b: Uint16Array; readonly games: Uint16Array }
  let opponents: Opponents | null | undefined
  const runSync = Effect.runSyncWith(yield* Effect.context())
  const readOpponents = Effect.scoped(Effect.gen(function* () {
    const own = yield* connect(path)
    const again = yield* metaOf(own)('snapshot_id').pipe(queried)
    if (again._tag === 'None' || again.value.value !== snapshotId) return yield* invalid()
    const u16Own = (name: string) => blob(own, name, 2).pipe(Effect.map((buffer) => new Uint16Array(buffer)))
    return yield* Effect.all({ a: u16Own('opp_a'), b: u16Own('opp_b'), games: u16Own('opp_games') })
  }))
  const loadOpponents = (): Opponents | null => {
    if (opponents === undefined) {
      opponents = OPPONENT_BLOBS.every((name) => sizes.has(name)) ? runSync(readOpponents.pipe(Effect.orDie)) : null
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

  const requireKnown = (playerId: number) => knownQuery({ playerId }).pipe(
    queried,
    Effect.flatMap((row) => row._tag === 'None' ? Effect.fail(new UnknownPlayer({ playerId })) : Effect.void),
  )

  const searchPlayers: HistoryStore['searchPlayers'] = (query, limit) => {
    const needle = foldName(query.trim())
    if (needle.length === 0) return Effect.succeed([])
    return searchQuery({ needle, limit }).pipe(queried, Effect.map((rows): ReadonlyArray<PlayerRow> => rows))
  }

  const player: HistoryStore['player'] = (playerId) => Effect.gen(function* () {
    const found = yield* playerQuery({ playerId }).pipe(queried)
    if (found._tag === 'None') return yield* new UnknownPlayer({ playerId })
    const stints: ReadonlyArray<StintRow> = yield* stintsQuery({ playerId }).pipe(queried)
    return { player: found.value, stints } satisfies PlayerDetail
  })

  const roster: HistoryStore['roster'] = (teamId, seasonId, gameType) => Effect.gen(function* () {
    const rows: ReadonlyArray<RosterRow> = yield* rosterQuery({ teamId, seasonId, gameType }).pipe(queried)
    if (rows.length === 0) return yield* new UnknownRoster({ teamId, seasonId, gameType })
    return rows
  })

  const sharedGames: HistoryStore['sharedGames'] = (a, b, seasonId, gameType, teamId, requested) => Effect.gen(function* () {
    yield* requireKnown(a)
    yield* requireKnown(b)
    // The same ID twice is not a pair; the joins would otherwise return the player's own games.
    if (a === b) return []
    if (requested === 'GoaliePartners' && !hasDressed) return []
    const query = requested === 'PlayedWith' ? playedWithQuery : partnersQuery
    const rows = yield* query({ a, b, teamId, seasonId, gameType }).pipe(queried)
    return rows.map((row): SharedGameRow => ({ ...row, link: requested }))
  })

  const opposedGames: HistoryStore['opposedGames'] = (a, b) => Effect.gen(function* () {
    yield* requireKnown(a)
    yield* requireKnown(b)
    const rows: ReadonlyArray<OpposedGameRow> = yield* opposedQuery({ a, b }).pipe(queried)
    return rows
  })

  const finals: HistoryStore['finals'] = (fromYear, toYear) => Effect.gen(function* () {
    const rows = yield* finalsQuery({ fromYear, toYear }).pipe(queried)
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

/**
 * Like `openHistoryStore`, but the connection closes when the surrounding scope closes, including after a
 * failed build. The store must not be used after that.
 */
export const openScopedHistoryStore = (path: string): Effect.Effect<HistoryStore, HistoryUnavailable, Scope.Scope> =>
  connect(path).pipe(Effect.flatMap((sql) => buildHistoryStore(sql, path)))

/**
 * Opens the serving file read-only and never closes it (scripts that live as long as the process).
 * A missing file, a missing table, a wrong `schema_version`, or a malformed blob is `HistoryUnavailable`.
 */
export const openHistoryStore = (path: string): Effect.Effect<HistoryStore, HistoryUnavailable> => Effect.gen(function* () {
  const scope = yield* Scope.make()
  return yield* openScopedHistoryStore(path).pipe(Scope.provide(scope))
})
