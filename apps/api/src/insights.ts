import { Array, Context, Effect, FileSystem, Layer, Result, Schema } from 'effect'
import { PublishedInsight } from '@nhl-reddit-stats/season/rpc'
import { SnapshotLoadError } from '@nhl-reddit-stats/season/rpc'
import { InsightCard } from '@nhl-reddit-stats/analyst/card'
import { render } from '@nhl-reddit-stats/analyst/render'

const CardList = Schema.Array(InsightCard)
const loadError = () => new SnapshotLoadError({ message: 'The insight cards could not be read.' })

/** Storage port for per-team insight files. `null` means the team has no file. */
export class Insights extends Context.Service<Insights, {
  readonly load: (team: string) => Effect.Effect<unknown | null, SnapshotLoadError>
}>()('glanceboard/Insights') {
  static none = Layer.succeed(Insights, Insights.of({ load: () => Effect.succeed(null) }))

  static layerFiles = (directory: string) => Layer.effect(Insights, Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    return filesInsights(fs, directory)
  }))

  /** One lazy loader per team file, bundled by scripts/build.mjs. */
  static layerArchive = (archive: Readonly<Record<string, () => Promise<{ default: unknown }>>>) => Layer.succeed(Insights, Insights.of({
    load: (team) => Object.hasOwn(archive, team)
      ? Effect.tryPromise({ try: async () => (await archive[team]()).default, catch: loadError })
      : Effect.succeed(null),
  }))
}

export const filesInsights = (fs: FileSystem.FileSystem, directory: string) => Insights.of({
  load: (team) => fs.readFileString(`${directory}/${team}.json`).pipe(
    Effect.flatMap((text) => Schema.decodeUnknownEffect(Schema.fromJsonString(Schema.Unknown))(text)),
    Effect.catchIf((error) => error._tag === 'PlatformError' && error.reason._tag === 'NotFound', () => Effect.succeed(null)),
    Effect.mapError(loadError),
  ),
})

/** Keeps approved cards, renders their copy, and validates each against the published shape. A card that cannot render or validate is dropped. */
export const publishCards = (cards: ReadonlyArray<typeof InsightCard.Type>): ReadonlyArray<PublishedInsight> =>
  cards.flatMap((card) => {
    if (card.status !== 'approved') return []
    const rows = card.evidence.result.map((row) => ({ ...row }))
    const bindings = Object.fromEntries(Object.entries(card.bindings))
    const headline = render(card.headline, bindings, rows)
    const body = render(card.body, bindings, rows)
    if (Result.isFailure(headline) || Result.isFailure(body)) return []
    const published = Schema.decodeUnknownResult(PublishedInsight)({
      headline: headline.success,
      body: body.success,
      query: card.evidence.query,
      result: card.evidence.result,
      gameIds: card.evidence.gameIds,
      ...(card.evidence.coverage === undefined ? {} : { coverage: card.evidence.coverage }),
      asOf: card.asOf,
    })
    return Result.isSuccess(published) ? [published.success] : []
  })

/** The approved, rendered cards of every team, in team order. */
export const loadPublishedInsights = (teams: ReadonlyArray<string>) => Effect.gen(function* () {
  const insights = yield* Insights
  const published = yield* Effect.forEach(teams, (team) => Effect.gen(function* () {
    const raw = yield* insights.load(team)
    if (raw === null) return []
    const cards = yield* Schema.decodeUnknownEffect(CardList)(raw).pipe(Effect.mapError(loadError))
    return publishCards(cards.filter((card) => card.team === team))
  }))
  return Array.flatten(published)
})
