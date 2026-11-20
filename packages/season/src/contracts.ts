import { Schema } from "effect";
import { Rpc, RpcGroup } from "effect/rpc";

import { TeamData, teamDataCheck } from "./team-season.ts";

export class SnapshotLoadError extends Schema.TaggedError<SnapshotLoadError>()(
  "SnapshotLoadError",
  {
    message: Schema.String,
  }
) {}

export class UnknownGame extends Schema.TaggedError<UnknownGame>()(
  "UnknownGame",
  {
    gameId: Schema.Int,
  }
) {}

// Raised for a scheduled game with no archived box score, including games not yet final.
export class BoxscoreNotArchived extends Schema.TaggedError<BoxscoreNotArchived>()(
  "BoxscoreNotArchived",
  {
    gameId: Schema.Int,
  }
) {}

export class BoxscoreLoadError extends Schema.TaggedError<BoxscoreLoadError>()(
  "BoxscoreLoadError",
  {
    message: Schema.String,
  }
) {}

const Count = Schema.Int.check(Schema.isGreaterThanOrEqualTo(0));
const Skater = Schema.Struct({
  playerId: Schema.Int,
  name: Schema.String,
  goals: Count,
  assists: Count,
  points: Count,
});
const Goalie = Schema.Struct({
  playerId: Schema.Int,
  name: Schema.String,
  saves: Count,
  shotsAgainst: Count,
  savePct: Schema.NullOr(Schema.Number),
});
const BoxscoreTeam = Schema.Struct({
  abbrev: Schema.String,
  score: Count,
  shotsOnGoal: Count,
  scorers: Schema.Array(Skater),
  goalies: Schema.Array(Goalie),
});
export const GameBoxscore = Schema.Struct({
  gameId: Schema.Int,
  date: Schema.String,
  decision: Schema.Literals(["REG", "OT", "SO"]),
  awayTeam: BoxscoreTeam,
  homeTeam: BoxscoreTeam,
});
export type GameBoxscore = typeof GameBoxscore.Type;

const Cell = Schema.Union([
  Schema.String,
  Schema.Number,
  Schema.Boolean,
  Schema.Null,
]);
// An approved insight card as served to the web: rendered copy plus the evidence it rests on.
export const PublishedInsight = Schema.Struct({
  headline: Schema.String,
  body: Schema.String,
  query: Schema.String,
  result: Schema.Array(Schema.Record(Schema.String, Cell)),
  gameIds: Schema.Array(Schema.Int),
  coverage: Schema.optionalKey(
    Schema.Struct({ archived: Count, finals: Count })
  ),
  asOf: Schema.Struct({ fetchedAt: Schema.String, completedGameIds: Count }),
});
export type PublishedInsight = typeof PublishedInsight.Type;

export const TeamDataWithInsights = Schema.Struct({
  ...TeamData.fields,
  insights: Schema.Array(PublishedInsight),
}).check(teamDataCheck);
export type TeamDataWithInsights = typeof TeamDataWithInsights.Type;

export const TeamRpcs = RpcGroup.make(
  Rpc.make("GetTeamData", {
    payload: Schema.Struct({}),
    success: TeamDataWithInsights,
    error: SnapshotLoadError,
  }),
  Rpc.make("GetGameBoxscore", {
    payload: Schema.Struct({ gameId: Schema.Int }),
    success: GameBoxscore,
    error: Schema.Union([UnknownGame, BoxscoreNotArchived, BoxscoreLoadError]),
  })
);
