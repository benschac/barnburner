import type { SeasonSnapshot } from "@nhl-reddit-stats/season";
import {
  BoxscoreLoadError,
  BoxscoreNotArchived,
  UnknownGame,
} from "@nhl-reddit-stats/season/rpc";
import type { GameBoxscore } from "@nhl-reddit-stats/season/rpc";
import {
  Array,
  Context,
  Effect,
  FileSystem,
  Layer,
  Order,
  Schema,
  String as Str,
} from "effect";

import { boxScoreMatchesGame } from "../../../lib/nhl-boxscores.mjs";

// Reads only the fields the drawer shows; the archived file keeps the NHL's full player rows.
const Count = Schema.Int.check(Schema.isGreaterThanOrEqualTo(0));
const ArchivedSkater = Schema.Struct({
  playerId: Schema.Int,
  name: Schema.Struct({ default: Schema.String }),
  goals: Count,
  assists: Count,
  points: Count,
});
const ArchivedGoalie = Schema.Struct({
  playerId: Schema.Int,
  name: Schema.Struct({ default: Schema.String }),
  saves: Count,
  shotsAgainst: Count,
  toi: Schema.String,
});
const ArchivedTeam = Schema.Struct({
  abbrev: Schema.String,
  score: Count,
  shotsOnGoal: Count,
  players: Schema.Struct({
    forwards: Schema.Array(ArchivedSkater),
    defense: Schema.Array(ArchivedSkater),
    goalies: Schema.Array(ArchivedGoalie),
  }),
});
const ArchivedBoxscore = Schema.Struct({
  id: Schema.Int,
  date: Schema.String,
  decision: Schema.Literals(["REG", "OT", "SO"]),
  awayTeam: ArchivedTeam,
  homeTeam: ArchivedTeam,
});

const byText = Order.make<string>((self, that) =>
  Str.localeCompare(that)(self)
);
const byScorer = Order.combineAll<typeof ArchivedSkater.Type>([
  Order.flip(Order.mapInput(Order.Number, (player) => player.points)),
  Order.flip(Order.mapInput(Order.Number, (player) => player.goals)),
  Order.mapInput(byText, (player) => player.name.default),
]);

const summarizeTeam = (
  team: typeof ArchivedTeam.Type
): GameBoxscore["homeTeam"] => ({
  abbrev: team.abbrev,
  score: team.score,
  shotsOnGoal: team.shotsOnGoal,
  scorers: Array.sort(
    [...team.players.forwards, ...team.players.defense].filter(
      (player) => player.points > 0
    ),
    byScorer
  ).map(({ playerId, name, goals, assists, points }) => ({
    playerId,
    name: name.default,
    goals,
    assists,
    points,
  })),
  goalies: team.players.goalies
    .filter((goalie) => goalie.toi !== "00:00")
    .map(({ playerId, name, saves, shotsAgainst }) => ({
      playerId,
      name: name.default,
      saves,
      shotsAgainst,
      savePct: shotsAgainst > 0 ? saves / shotsAgainst : null,
    })),
});

type BoxScoreLoad = (
  gameId: number
) => Effect.Effect<unknown, BoxscoreLoadError>;

const unreadable = () =>
  new BoxscoreLoadError({ message: "The box score could not be read." });

/** Storage port for archived box scores. `null` means the game has no archived file. Callers pass only ids from the season snapshot. */
export class BoxScores extends Context.Service<
  BoxScores,
  { readonly load: BoxScoreLoad }
>()("glanceboard/BoxScores") {
  static readonly make = (load: BoxScoreLoad) =>
    Effect.succeed(BoxScores.of({ load }));

  static readonly layer = (load: BoxScoreLoad) =>
    Layer.effect(this, this.make(load));

  static readonly layerFiles = (directory: string) =>
    Layer.effect(
      this,
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        return yield* BoxScores.make((gameId) =>
          Effect.gen(function* () {
            const text = yield* fs
              .readFileString(`${directory}/${gameId}.json`)
              .pipe(
                Effect.catchReason("PlatformError", "NotFound", () =>
                  Effect.succeed(null)
                )
              );
            if (text === null) return null;
            return yield* Schema.decodeUnknownEffect(
              Schema.fromJsonString(Schema.Unknown)
            )(text);
          }).pipe(Effect.tapError(Effect.logError), Effect.mapError(unreadable))
        );
      })
    );

  /** One lazy loader per archived file, so a request reads only its own game. */
  static readonly layerArchive = (
    archive: Readonly<Record<number, () => Promise<{ default: unknown }>>>
  ) =>
    this.layer((gameId) =>
      Object.hasOwn(archive, gameId)
        ? Effect.tryPromise({
            try: async () => (await archive[gameId]()).default,
            catch: unreadable,
          })
        : Effect.succeed(null)
    );
}

export const getGameBoxscore = (season: SeasonSnapshot, gameId: number) =>
  Effect.gen(function* () {
    // The id must be a scheduled game before storage is touched; storage keys never come from the request.
    const game = season.games.find((entry) => entry.id === gameId);
    if (!game) return yield* new UnknownGame({ gameId });
    if (game.result === null) return yield* new BoxscoreNotArchived({ gameId });
    const raw = yield* (yield* BoxScores).load(gameId);
    if (raw === null) return yield* new BoxscoreNotArchived({ gameId });
    const invalid = () =>
      new BoxscoreLoadError({ message: "The archived box score is invalid." });
    const box = yield* Schema.decodeUnknownEffect(ArchivedBoxscore)(raw).pipe(
      Effect.tapError(Effect.logError),
      Effect.mapError(invalid)
    );
    if (!boxScoreMatchesGame(raw, game)) return yield* invalid();
    return {
      gameId,
      date: box.date,
      decision: box.decision,
      awayTeam: summarizeTeam(box.awayTeam),
      homeTeam: summarizeTeam(box.homeTeam),
    } satisfies GameBoxscore;
  });
