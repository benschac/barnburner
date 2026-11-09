import { Context, Effect, FileSystem, Layer, Schema } from 'effect'
import { PosterSnapshot, SeasonGame, SeasonSnapshot, TeamData } from '@nhl-reddit-stats/season'
import { SnapshotLoadError } from '@nhl-reddit-stats/season/rpc'
import { GAMES_PER_TEAM, validateSnapshot } from '../../../lib/nhl-games.mjs'
import { completedDates, validatePosterSnapshot, validateStandingsAgainstGames } from '../../../lib/nhl-poster.mjs'

const SavedSeason = Schema.Struct({
  ...SeasonSnapshot.fields,
  sources: Schema.Array(Schema.String),
  teams: Schema.Array(Schema.Struct({
    abbrev: Schema.String, name: Schema.String, conference: Schema.String, division: Schema.String,
  })),
  games: Schema.Array(Schema.Struct({ ...SeasonGame.fields, season: Schema.Int, gameType: Schema.Literal(2) })),
})

export class SnapshotDataError extends Schema.TaggedError<SnapshotDataError>()('SnapshotDataError', {
  message: Schema.String,
}) {}

export const makeSnapshots = (input: { season: unknown, poster: unknown | null, expectedGamesPerTeam?: number }) => Effect.gen(function* () {
  const season = yield* Schema.decodeUnknownEffect(SavedSeason)(input.season)
  const poster = input.poster === null ? null : yield* Schema.decodeUnknownEffect(PosterSnapshot)(input.poster)
  yield* Effect.try({
    try: () => {
      validateSnapshot(season, input.expectedGamesPerTeam ?? GAMES_PER_TEAM)
      if (poster !== null) {
        validatePosterSnapshot(poster, season.teams, completedDates(season))
        validateStandingsAgainstGames(poster.standings, season)
      }
    },
    catch: (error) => new SnapshotDataError({ message: error instanceof Error ? error.message : String(error) }),
  })
  return {
    season,
    poster,
    load: poster === null
      ? Effect.fail(new SnapshotLoadError({ message: 'Poster data is unavailable. Refresh the poster data and restart the server.' }))
      : Schema.decodeUnknownEffect(TeamData)({ season, poster }).pipe(
        Effect.mapError(() => new SnapshotLoadError({ message: 'The team data is incomplete or invalid. Refresh the data and try again.' })),
      ),
  }
}).pipe(Effect.mapError((error) => new SnapshotDataError({ message: String(error) })))

export class Snapshots extends Context.Service<Snapshots, Effect.Success<ReturnType<typeof makeSnapshots>>>()('glanceboard/Snapshots') {
  static layer = (paths: { snapshot: string, posterSnapshot: string }) => Layer.effect(Snapshots, Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const seasonText = yield* fs.readFileString(paths.snapshot)
    const season = yield* Schema.decodeUnknownEffect(Schema.fromJsonString(SavedSeason))(seasonText)
    if (season.teams.length !== 32) return yield* Effect.fail(new SnapshotDataError({ message: 'Expected all 32 NHL teams' }))
    const posterText = yield* fs.readFileString(paths.posterSnapshot).pipe(
      Effect.catchIf((error) => error.reason._tag === 'NotFound', () => Effect.succeed(null)),
    )
    const poster = posterText === null ? null : yield* Schema.decodeUnknownEffect(Schema.fromJsonString(PosterSnapshot))(posterText)
    return yield* makeSnapshots({ season, poster })
  }))
}
