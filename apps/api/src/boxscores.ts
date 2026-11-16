import { Context, Effect, FileSystem, Layer, Schema } from 'effect'
import { BoxscoreLoadError, BoxscoreNotArchived, UnknownGame } from '@nhl-reddit-stats/season/rpc'
import type { GameBoxscore } from '@nhl-reddit-stats/season/rpc'
import { boxScoreMatchesGame } from '../../../lib/nhl-boxscores.mjs'
import type { SeasonSnapshot } from '@nhl-reddit-stats/season'

// Reads only the fields the drawer shows; the archived file keeps the NHL's full player rows.
const Count = Schema.Int.check(Schema.isGreaterThanOrEqualTo(0))
const ArchivedSkater = Schema.Struct({
  playerId: Schema.Int, name: Schema.Struct({ default: Schema.String }), goals: Count, assists: Count, points: Count,
})
const ArchivedGoalie = Schema.Struct({
  playerId: Schema.Int, name: Schema.Struct({ default: Schema.String }), saves: Count, shotsAgainst: Count, toi: Schema.String,
})
const ArchivedTeam = Schema.Struct({
  abbrev: Schema.String, score: Count, shotsOnGoal: Count,
  players: Schema.Struct({ forwards: Schema.Array(ArchivedSkater), defense: Schema.Array(ArchivedSkater), goalies: Schema.Array(ArchivedGoalie) }),
})
const ArchivedBoxscore = Schema.Struct({
  id: Schema.Int, date: Schema.String, decision: Schema.Literals(['REG', 'OT', 'SO']), awayTeam: ArchivedTeam, homeTeam: ArchivedTeam,
})

const summarizeTeam = (team: typeof ArchivedTeam.Type): GameBoxscore['homeTeam'] => ({
  abbrev: team.abbrev,
  score: team.score,
  shotsOnGoal: team.shotsOnGoal,
  scorers: [...team.players.forwards, ...team.players.defense]
    .filter((player) => player.points > 0)
    .sort((a, b) => b.points - a.points || b.goals - a.goals || a.name.default.localeCompare(b.name.default))
    .map(({ playerId, name, goals, assists, points }) => ({ playerId, name: name.default, goals, assists, points })),
  goalies: team.players.goalies
    .filter((goalie) => goalie.toi !== '00:00')
    .map(({ playerId, name, saves, shotsAgainst }) => ({
      playerId, name: name.default, saves, shotsAgainst, savePct: shotsAgainst > 0 ? saves / shotsAgainst : null,
    })),
})

/** Storage port for archived box scores. `null` means the game has no archived file. Callers pass only ids from the season snapshot. */
export class BoxScores extends Context.Service<BoxScores, {
  readonly load: (gameId: number) => Effect.Effect<unknown | null, BoxscoreLoadError>
}>()('glanceboard/BoxScores') {
  static layerFiles = (directory: string) => Layer.effect(BoxScores, Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    return BoxScores.of({
      load: (gameId) => fs.readFileString(`${directory}/${gameId}.json`).pipe(
        Effect.flatMap((text) => Effect.try(() => JSON.parse(text) as unknown)),
        Effect.catchIf((error) => 'reason' in error && error.reason._tag === 'NotFound', () => Effect.succeed(null)),
        Effect.mapError(() => new BoxscoreLoadError({ message: 'The box score could not be read.' })),
      ),
    })
  }))

  /** One lazy loader per archived file, so a request reads only its own game. */
  static layerArchive = (archive: Readonly<Record<number, () => Promise<{ default: unknown }>>>) => Layer.succeed(BoxScores, BoxScores.of({
    load: (gameId) => Object.hasOwn(archive, gameId)
      ? Effect.tryPromise({
        try: async () => (await archive[gameId]()).default,
        catch: () => new BoxscoreLoadError({ message: 'The box score could not be read.' }),
      })
      : Effect.succeed(null),
  }))
}

export const getGameBoxscore = (season: SeasonSnapshot, gameId: number) => Effect.gen(function* () {
  // The id must be a scheduled game before storage is touched; storage keys never come from the request.
  const game = season.games.find((entry) => entry.id === gameId)
  if (!game) return yield* new UnknownGame({ gameId })
  if (game.result === null) return yield* new BoxscoreNotArchived({ gameId })
  const raw = yield* (yield* BoxScores).load(gameId)
  if (raw === null) return yield* new BoxscoreNotArchived({ gameId })
  const invalid = () => new BoxscoreLoadError({ message: 'The archived box score is invalid.' })
  const box = yield* Schema.decodeUnknownEffect(ArchivedBoxscore)(raw).pipe(Effect.mapError(invalid))
  if (!boxScoreMatchesGame(raw, game)) return yield* invalid()
  return { gameId, date: box.date, decision: box.decision, awayTeam: summarizeTeam(box.awayTeam), homeTeam: summarizeTeam(box.homeTeam) } satisfies GameBoxscore
})
