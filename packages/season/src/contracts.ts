import { Schema } from 'effect'
import { Rpc, RpcGroup } from 'effect/rpc'
import { TeamData } from './team-season.ts'

export class SnapshotLoadError extends Schema.TaggedError<SnapshotLoadError>()('SnapshotLoadError', {
  message: Schema.String,
}) {}

export class UnknownGame extends Schema.TaggedError<UnknownGame>()('UnknownGame', {
  gameId: Schema.Int,
}) {}

// Raised for a scheduled game with no archived box score, including games not yet final.
export class BoxscoreNotArchived extends Schema.TaggedError<BoxscoreNotArchived>()('BoxscoreNotArchived', {
  gameId: Schema.Int,
}) {}

export class BoxscoreLoadError extends Schema.TaggedError<BoxscoreLoadError>()('BoxscoreLoadError', {
  message: Schema.String,
}) {}

const Count = Schema.Int.check(Schema.isGreaterThanOrEqualTo(0))
const Skater = Schema.Struct({
  playerId: Schema.Int,
  name: Schema.String,
  goals: Count,
  assists: Count,
  points: Count,
})
const Goalie = Schema.Struct({
  playerId: Schema.Int,
  name: Schema.String,
  saves: Count,
  shotsAgainst: Count,
  savePct: Schema.NullOr(Schema.Number),
})
const BoxscoreTeam = Schema.Struct({
  abbrev: Schema.String,
  score: Count,
  shotsOnGoal: Count,
  scorers: Schema.Array(Skater),
  goalies: Schema.Array(Goalie),
})
export const GameBoxscore = Schema.Struct({
  gameId: Schema.Int,
  date: Schema.String,
  decision: Schema.Literals(['REG', 'OT', 'SO']),
  awayTeam: BoxscoreTeam,
  homeTeam: BoxscoreTeam,
})
export type GameBoxscore = typeof GameBoxscore.Type

export const TeamRpcs = RpcGroup.make(
  Rpc.make('GetTeamData', {
    payload: Schema.Struct({}),
    success: TeamData,
    error: SnapshotLoadError,
  }),
  Rpc.make('GetGameBoxscore', {
    payload: Schema.Struct({ gameId: Schema.Int }),
    success: GameBoxscore,
    error: Schema.Union([UnknownGame, BoxscoreNotArchived, BoxscoreLoadError]),
  }),
)
