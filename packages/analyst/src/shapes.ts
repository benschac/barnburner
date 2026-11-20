import type { Effect } from "effect";
import { Schema } from "effect";

export class DbError extends Schema.TaggedError<DbError>()("DbError", {
  message: Schema.String,
}) {}

export class SqlError extends Schema.TaggedError<SqlError>()("SqlError", {
  message: Schema.String,
  sql: Schema.String,
}) {}

export type Row = Record<string, string | number | boolean | null>;

export type QueryResult = {
  readonly rows: Row[];
  readonly rowCount: number;
};

export type QueryOpts = {
  readonly timeoutMs?: number;
  readonly rowCap?: number;
};

export type Db = {
  readonly query: (
    sql: string,
    opts?: QueryOpts
  ) => Effect.Effect<QueryResult, SqlError>;
  readonly queryCanonical: (
    sql: string,
    opts?: QueryOpts
  ) => Effect.Effect<QueryResult, SqlError>;
};

export type GuardResult =
  | { ok: true; touchesBoxscores: boolean }
  | { ok: false; reason: string };
export type Guard = (db: Db, sql: string) => Effect.Effect<GuardResult>;

export type VerifyResult =
  | { ok: true }
  | { ok: false; check: number; detail: string };
export type Verify = (
  card: unknown,
  finals: ReadonlySet<number>
) => Effect.Effect<VerifyResult>;

export const Coverage = Schema.Struct({
  finals: Schema.Finite,
  archived: Schema.Finite,
});
export type Coverage = typeof Coverage.Type;

export const Answered = Schema.TaggedStruct("Answered", {
  value: Schema.Union([
    Schema.String,
    Schema.Finite,
    Schema.Boolean,
    Schema.Null,
  ]),
  query: Schema.String,
  coverage: Schema.optionalKey(Coverage),
});
export const Declined = Schema.TaggedStruct("Declined", {
  reason: Schema.String,
});
export const Crashed = Schema.TaggedStruct("Crashed", {
  reason: Schema.String,
});
export const Answer = Schema.Union([Answered, Declined]);
export type Answer = typeof Answer.Type;

export type Outcome = "cards" | "declined" | "no_insight" | "crashed";

export const VIEWS = {
  team_games: [
    "team",
    "game_id",
    "date",
    "home",
    "opp",
    "gf",
    "ga",
    "result",
    "decision",
    "is_final",
  ],
  skater_games: [
    "game_id",
    "date",
    "team",
    "opp",
    "player_id",
    "name",
    "pos",
    "g",
    "a",
    "p",
    "sog",
    "toi_sec",
    "hits",
    "blocks",
    "pim",
    "ppg",
    "plus_minus",
  ],
  goalie_games: [
    "game_id",
    "date",
    "team",
    "opp",
    "player_id",
    "name",
    "starter",
    "decision",
    "shots_against",
    "saves",
    "save_pct",
    "ga",
    "toi_sec",
  ],
  standings_daily: [
    "date",
    "team",
    "points",
    "played",
    "rank_div",
    "rank_conf",
    "wc_rank",
  ],
  boxscore_coverage: ["team", "finals", "archived"],
} as const;
