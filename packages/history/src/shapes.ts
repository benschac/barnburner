// Data shapes shared by the search lane, the store port, and the RPC contract.
// Player IDs, never indexes, cross every boundary except `GraphArrays` itself.
// The tagged shapes (hops and Finals years) are schemas, defined once here; `contracts.ts` reuses them.
import { Schema } from 'effect'

/** The five positions in the players table (C-serve). */
export type Position = 'C' | 'L' | 'R' | 'D' | 'G'

/** 2 for the regular season, 3 for the playoffs. */
export const GameTypeSchema = Schema.Literals([2, 3])
export type GameType = typeof GameTypeSchema.Type

/**
 * Every C-graph blob as its typed array, little-endian on disk. `n` players, `m` links, `s` spans,
 * `o` opponent pairs. Indexes (`edgeA`, `edgeB`, `spanSeason`, `spanTeam`) point into `playerIds`,
 * `seasonIds`, and `teamIds`. The opponent arrays are optional until B6 writes them.
 */
export type GraphArrays = {
  readonly playerIds: Uint32Array
  readonly seasonIds: Uint32Array
  readonly teamIds: Uint32Array
  readonly edgeA: Uint16Array
  readonly edgeB: Uint16Array
  readonly spanStart: Uint32Array
  readonly spanSeason: Uint8Array
  /** The competition itself: 2 or 3. */
  readonly spanKind: Uint8Array
  readonly spanTeam: Uint8Array
  /** 0 when both were credited, 1 for goalie partners. */
  readonly spanLink: Uint8Array
  readonly spanGames: Uint16Array
  readonly spanFirstGame: Uint32Array
  readonly oppA?: Uint16Array
  readonly oppB?: Uint16Array
  readonly oppGames?: Uint16Array
}

/**
 * The loaded graph. Deliberately minimal: the arrays plus the player-ID to index lookup.
 * Q1 (`makeGraph`) extends this type with the adjacency lists it builds.
 */
export type Graph = {
  readonly arrays: GraphArrays
  readonly indexOf: ReadonlyMap<number, number>
}

export type Competition = 'all' | 'regular' | 'playoff'

/** Season bounds are season IDs (for example 20192020), inclusive. */
export type Filter = {
  readonly competition: Competition
  readonly fromSeason: number | null
  readonly toSeason: number | null
  readonly goaliePartners: boolean
}

export const DEFAULT_FILTER: Filter = {
  competition: 'all',
  fromSeason: null,
  toSeason: null,
  goaliePartners: true,
}

/** `with` covers both teammate kinds. */
export type Relation = 'with' | 'against' | 'either'

/** `pathCount` stops counting here and sets `pathCountCapped`. */
export const PATH_COUNT_CAP = 1_000_000

export type LinkKind = 'PlayedWith' | 'GoaliePartners'

/** A game or link count: a non-negative integer. */
export const Count = Schema.Int.check(Schema.isGreaterThanOrEqualTo(0))

const TeammateFields = {
  from: Schema.Int,
  to: Schema.Int,
  games: Count,
  teamId: Schema.Int,
  seasonId: Schema.Int,
  gameType: GameTypeSchema,
  gameId: Schema.Int,
}

/** One teammate hop. `games` is the link's total over passing spans; the rest is the evidence span. */
export const PlayedWith = Schema.TaggedStruct('PlayedWith', TeammateFields)
export type PlayedWith = typeof PlayedWith.Type

export const GoaliePartners = Schema.TaggedStruct('GoaliePartners', TeammateFields)
export type GoaliePartners = typeof GoaliePartners.Type

/**
 * Opponents carry a game count only: the pure search leaves `PlayedAgainst` without a game. The RPC wire
 * member (`WirePlayedAgainst` in `contracts.ts`) extends this one with the `gameId` the API handler adds
 * from the store.
 */
export const PlayedAgainst = Schema.TaggedStruct('PlayedAgainst', {
  from: Schema.Int,
  to: Schema.Int,
  games: Count,
})
export type PlayedAgainst = typeof PlayedAgainst.Type

export const TeammateHop = Schema.Union([PlayedWith, GoaliePartners])
export type TeammateHop = typeof TeammateHop.Type
export const Hop = Schema.Union([PlayedWith, GoaliePartners, PlayedAgainst])
export type Hop = typeof Hop.Type

/** Paths in D6 order. `paths` holds at most the requested limit; `pathCount` is the full tie count. */
export type PathResult = {
  readonly distance: number
  readonly pathCount: number
  readonly pathCountCapped: boolean
  readonly paths: ReadonlyArray<ReadonlyArray<Hop>>
}

/**
 * `reachable` and `unreachable` exclude the start player. A player who reaches nobody has
 * distance 0, `atDistance` 0, and an empty example.
 */
export type FarthestResult = {
  readonly distance: number
  readonly atDistance: number
  readonly reachable: number
  readonly unreachable: number
  readonly example: ReadonlyArray<TeammateHop>
}

/** One passing span of a link. */
export type LinkSpan = {
  readonly seasonId: number
  readonly gameType: GameType
  readonly teamId: number
  readonly link: LinkKind
  readonly games: number
  readonly firstGameId: number
}

/**
 * `spans` lists shared-game spans before goalie-partner spans, each in array order, so the evidence
 * game is `spans[0].firstGameId`. With no passing span: no spans, 0 games, null evidence.
 */
export type LinkResult = {
  readonly spans: ReadonlyArray<LinkSpan>
  readonly totalGames: number
  readonly evidenceGameId: number | null
  readonly opposedGames: number
}

export type Opponent = {
  readonly playerId: number
  readonly games: number
}

/** A Final year is the season's ending year: the 2021-22 Final is 2022. */
export const FinalsHit = Schema.TaggedStruct('Hit', {
  year: Schema.Int,
  seasonId: Schema.Int,
  /** A teammate of the focus player who played in that Final. */
  playerId: Schema.Int,
  finalGameId: Schema.Int,
  /** A game the focus player and `playerId` shared (the link's evidence game). */
  sharedGameId: Schema.Int,
})
export type FinalsHit = typeof FinalsHit.Type

export const FinalsMiss = Schema.TaggedStruct('Miss', { year: Schema.Int, seasonId: Schema.Int })
export type FinalsMiss = typeof FinalsMiss.Type

export const FinalsYear = Schema.Union([FinalsHit, FinalsMiss])
export type FinalsYear = typeof FinalsYear.Type

// Store rows (C-store). Names follow the C-serve columns.

export type PlayerRow = {
  readonly playerId: number
  readonly name: string
  readonly searchName: string
  readonly position: Position
  readonly firstSeason: number
  readonly lastSeason: number
  readonly games: number
  readonly points: number
  readonly teammates: number
}

export type StintRow = {
  readonly seasonId: number
  readonly gameType: GameType
  readonly teamId: number
  readonly teamAbbrev: string
  readonly teamName: string
  readonly games: number
  readonly firstGameId: number
  readonly lastGameId: number
}

export type PlayerDetail = {
  readonly player: PlayerRow
  readonly stints: ReadonlyArray<StintRow>
}

export type RosterRow = {
  readonly playerId: number
  readonly name: string
  readonly position: Position
  readonly games: number
}

export type SharedGameRow = {
  readonly gameId: number
  readonly gameDate: string
  readonly link: LinkKind
}

/** `aTeamId` is the team of the first player asked about, `bTeamId` of the second. */
export type OpposedGameRow = {
  readonly gameId: number
  readonly gameDate: string
  readonly aTeamId: number
  readonly bTeamId: number
}

export type FinalParticipant = {
  readonly playerId: number
  readonly teamId: number
  /** The first Final game this player was credited in. */
  readonly firstGameId: number
}

export type FinalRow = {
  readonly year: number
  readonly seasonId: number
  readonly gameIds: ReadonlyArray<number>
  readonly participants: ReadonlyArray<FinalParticipant>
}
