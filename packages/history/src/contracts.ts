import { Schema, Struct } from "effect";
import { Rpc, RpcGroup } from "effect/rpc";

import {
  Count,
  FinalsYear,
  GameTypeSchema,
  GoaliePartners,
  PlayedAgainst,
  PlayedWith,
  TeammateHop,
} from "./shapes.ts";

// Expected failures (C-rpc). Each carries the context a caller needs to explain it.

/** The serving file is missing, unreadable, or does not match the expected schema. */
export class HistoryUnavailable extends Schema.TaggedError<
  HistoryUnavailable,
  { readonly brand: unique symbol }
>()("HistoryUnavailable", {
  message: Schema.String,
}) {}

/**
 * No such player. `playerId` is any number, not only an integer: the pure search functions take raw
 * numbers, and a non-integer ID (1.5, NaN) is simply a player the graph does not hold. An `Int` here
 * would make the error constructor throw for exactly those inputs. Over the RPC the payload schemas
 * already require integers.
 */
export class UnknownPlayer extends Schema.TaggedError<
  UnknownPlayer,
  { readonly brand: unique symbol }
>()("UnknownPlayer", {
  // @effect-diagnostics-next-line schemaNumber:off
  playerId: Schema.Number,
}) {}

/** The team had no credited player in that season and competition. */
export class UnknownRoster extends Schema.TaggedError<
  UnknownRoster,
  { readonly brand: unique symbol }
>()("UnknownRoster", {
  teamId: Schema.Int,
  seasonId: Schema.Int,
  gameType: Schema.Literals([2, 3]),
}) {}

/** Both players exist but no chain connects them under the filter and relation. */
export class NoPath extends Schema.TaggedError<
  NoPath,
  { readonly brand: unique symbol }
>()("NoPath", {
  from: Schema.Int,
  to: Schema.Int,
}) {}

/** `against` and `either` accept only the default filter. */
export class UnsupportedFilter extends Schema.TaggedError<
  UnsupportedFilter,
  { readonly brand: unique symbol }
>()("UnsupportedFilter", {
  relation: Schema.Literals(["against", "either"]),
}) {}

// Schemas for the plain shapes in `shapes.ts`. They carry a `Schema` suffix so both can be exported side by side;
// `tests/contracts.test.ts` checks each decoded type is assignable to its plain shape. The tagged hop and
// Finals year schemas live in `shapes.ts` and are used here as they are.

const PositionSchema = Schema.Literals(["C", "L", "R", "D", "G"]);

export const FilterSchema = Schema.Struct({
  competition: Schema.Literals(["all", "regular", "playoff"]),
  fromSeason: Schema.NullOr(Schema.Int),
  toSeason: Schema.NullOr(Schema.Int),
  goaliePartners: Schema.Boolean,
});
export const RelationSchema = Schema.Literals(["with", "against", "either"]);

/** On the wire a `PlayedAgainst` hop also carries `gameId`: the API handler fills it from the store. */
export const WirePlayedAgainst = PlayedAgainst.mapFields(
  Struct.assign({ gameId: Schema.Int })
);
export const WireHop = Schema.Union([
  PlayedWith,
  GoaliePartners,
  WirePlayedAgainst,
]);
export type WireHop = typeof WireHop.Type;

export const PathResultSchema = Schema.Struct({
  distance: Count,
  pathCount: Count,
  pathCountCapped: Schema.Boolean,
  paths: Schema.Array(Schema.Array(WireHop)),
});

export const FarthestResultSchema = Schema.Struct({
  distance: Count,
  atDistance: Count,
  reachable: Count,
  unreachable: Count,
  example: Schema.Array(TeammateHop),
});

const LinkKindSchema = Schema.Literals(["PlayedWith", "GoaliePartners"]);
export const LinkSpanSchema = Schema.Struct({
  seasonId: Schema.Int,
  gameType: GameTypeSchema,
  teamId: Schema.Int,
  link: LinkKindSchema,
  games: Count,
  firstGameId: Schema.Int,
});
export const LinkResultSchema = Schema.Struct({
  spans: Schema.Array(LinkSpanSchema),
  totalGames: Count,
  evidenceGameId: Schema.NullOr(Schema.Int),
  opposedGames: Count,
});

// Player rows as served: the players table without `searchName`.
export const PlayerSummarySchema = Schema.Struct({
  playerId: Schema.Int,
  name: Schema.String,
  position: PositionSchema,
  firstSeason: Schema.Int,
  lastSeason: Schema.Int,
  games: Count,
});
export const PlayerSchema = Schema.Struct({
  ...PlayerSummarySchema.fields,
  points: Count,
  teammates: Count,
});
export const StintSchema = Schema.Struct({
  seasonId: Schema.Int,
  gameType: GameTypeSchema,
  teamId: Schema.Int,
  teamAbbrev: Schema.String,
  teamName: Schema.String,
  games: Count,
  firstGameId: Schema.Int,
  lastGameId: Schema.Int,
});

/** A roster row's tie to the focus player. Goalie partners mean that is the only tie. */
export const RosterLinkSchema = Schema.Union([
  Schema.TaggedStruct("PlayedWith", {
    games: Count,
    evidenceGameId: Schema.Int,
  }),
  Schema.TaggedStruct("GoaliePartners", {
    games: Count,
    evidenceGameId: Schema.Int,
  }),
  Schema.TaggedStruct("NoLink", {}),
]);
export const RosterEntrySchema = Schema.Struct({
  playerId: Schema.Int,
  name: Schema.String,
  position: PositionSchema,
  games: Count,
  link: Schema.optionalKey(RosterLinkSchema),
});

export const SharedGameSchema = Schema.Struct({
  gameId: Schema.Int,
  gameDate: Schema.String,
  link: LinkKindSchema,
});
export const OpposedGameSchema = Schema.Struct({
  gameId: Schema.Int,
  gameDate: Schema.String,
  aTeamId: Schema.Int,
  bTeamId: Schema.Int,
});
export const OpponentSchema = Schema.Struct({
  playerId: Schema.Int,
  name: Schema.String,
  games: Count,
});

// Inputs and outputs. Every success carries `snapshotId`.

const Limit = (maximum: number) =>
  Schema.Int.check(Schema.isBetween({ minimum: 1, maximum }));

export const SearchPlayersInput = Schema.Struct({
  query: Schema.String,
  limit: Limit(20),
});
export const SearchPlayersResult = Schema.Struct({
  snapshotId: Schema.String,
  players: Schema.Array(PlayerSummarySchema),
});

export const GetPlayerInput = Schema.Struct({ playerId: Schema.Int });
export const GetPlayerResult = Schema.Struct({
  snapshotId: Schema.String,
  player: PlayerSchema,
  stints: Schema.Array(StintSchema),
});

export const GetRosterInput = Schema.Struct({
  teamId: Schema.Int,
  seasonId: Schema.Int,
  gameType: GameTypeSchema,
  focusPlayerId: Schema.optionalKey(Schema.Int),
});
/**
 * A roster answer. `focusPlayerId` is echoed when the request carried one; then every row must carry a
 * `link` (`NoLink` when the player has no tie), and without it no row may. One struct with a cross-field
 * check keeps the wire shape flat; a result that breaks the rule fails to decode.
 */
export const GetRosterResult = Schema.Struct({
  snapshotId: Schema.String,
  teamId: Schema.Int,
  seasonId: Schema.Int,
  gameType: GameTypeSchema,
  focusPlayerId: Schema.optionalKey(Schema.Int),
  players: Schema.Array(RosterEntrySchema),
}).check(
  Schema.makeFilter((result) =>
    result.players.every(
      (row) => (row.link !== undefined) === (result.focusPlayerId !== undefined)
    )
      ? undefined
      : "Roster rows carry a link exactly when a focus player is named."
  )
);

export const GetLinkInput = Schema.Struct({
  a: Schema.Int,
  b: Schema.Int,
  filter: FilterSchema,
});
export const GetLinkResult = Schema.Struct({
  snapshotId: Schema.String,
  ...LinkResultSchema.fields,
});

export const GetSharedGamesInput = Schema.Struct({
  a: Schema.Int,
  b: Schema.Int,
  seasonId: Schema.Int,
  gameType: GameTypeSchema,
  teamId: Schema.Int,
  /** Which span of the pair to list: a shared-game span and a partner span can share one season, type, and team. */
  link: LinkKindSchema,
});
export const GetSharedGamesResult = Schema.Struct({
  snapshotId: Schema.String,
  games: Schema.Array(SharedGameSchema),
});

export const GetOpponentsInput = Schema.Struct({
  playerId: Schema.Int,
  limit: Limit(50),
  offset: Count,
});
export const GetOpponentsResult = Schema.Struct({
  snapshotId: Schema.String,
  total: Count,
  opponents: Schema.Array(OpponentSchema),
});

export const GetOpposedGamesInput = Schema.Struct({
  a: Schema.Int,
  b: Schema.Int,
});
export const GetOpposedGamesResult = Schema.Struct({
  snapshotId: Schema.String,
  games: Schema.Array(OpposedGameSchema),
});

export const FindPathInput = Schema.Struct({
  from: Schema.Int,
  to: Schema.Int,
  filter: FilterSchema,
  relation: RelationSchema,
  limit: Limit(10),
});
export const FindPathResult = Schema.Struct({
  snapshotId: Schema.String,
  ...PathResultSchema.fields,
});

export const GetFarthestInput = Schema.Struct({
  playerId: Schema.Int,
  filter: FilterSchema,
});
export const GetFarthestResult = Schema.Struct({
  snapshotId: Schema.String,
  ...FarthestResultSchema.fields,
});

export const GetFinalsCoverageInput = Schema.Struct({
  playerId: Schema.Int,
  fromYear: Schema.Int,
  toYear: Schema.Int,
});
export const GetFinalsCoverageResult = Schema.Struct({
  snapshotId: Schema.String,
  /** The competition rule the answer rests on (D8), as text for display. */
  rule: Schema.String,
  years: Schema.Array(FinalsYear),
});

export const SearchPlayers = Rpc.make("SearchPlayers", {
  payload: SearchPlayersInput,
  success: SearchPlayersResult,
  error: HistoryUnavailable,
});

export const GetPlayer = Rpc.make("GetPlayer", {
  payload: GetPlayerInput,
  success: GetPlayerResult,
  error: Schema.Union([HistoryUnavailable, UnknownPlayer]),
});

export const GetRoster = Rpc.make("GetRoster", {
  payload: GetRosterInput,
  success: GetRosterResult,
  error: Schema.Union([HistoryUnavailable, UnknownRoster, UnknownPlayer]),
});

export const GetLink = Rpc.make("GetLink", {
  payload: GetLinkInput,
  success: GetLinkResult,
  error: Schema.Union([HistoryUnavailable, UnknownPlayer]),
});

export const GetSharedGames = Rpc.make("GetSharedGames", {
  payload: GetSharedGamesInput,
  success: GetSharedGamesResult,
  error: Schema.Union([HistoryUnavailable, UnknownPlayer]),
});

export const GetOpponents = Rpc.make("GetOpponents", {
  payload: GetOpponentsInput,
  success: GetOpponentsResult,
  error: Schema.Union([HistoryUnavailable, UnknownPlayer]),
});

export const GetOpposedGames = Rpc.make("GetOpposedGames", {
  payload: GetOpposedGamesInput,
  success: GetOpposedGamesResult,
  error: Schema.Union([HistoryUnavailable, UnknownPlayer]),
});

export const FindPath = Rpc.make("FindPath", {
  payload: FindPathInput,
  success: FindPathResult,
  error: Schema.Union([
    HistoryUnavailable,
    UnknownPlayer,
    NoPath,
    UnsupportedFilter,
  ]),
});

export const GetFarthest = Rpc.make("GetFarthest", {
  payload: GetFarthestInput,
  success: GetFarthestResult,
  error: Schema.Union([HistoryUnavailable, UnknownPlayer]),
});

export const GetFinalsCoverage = Rpc.make("GetFinalsCoverage", {
  payload: GetFinalsCoverageInput,
  success: GetFinalsCoverageResult,
  error: Schema.Union([HistoryUnavailable, UnknownPlayer]),
});

export const HistoryRpcs = RpcGroup.make(
  SearchPlayers,
  GetPlayer,
  GetRoster,
  GetLink,
  GetSharedGames,
  GetOpponents,
  GetOpposedGames,
  FindPath,
  GetFarthest,
  GetFinalsCoverage
);
