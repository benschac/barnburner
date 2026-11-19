import { Array, Effect, FileSystem, Option, Result, Schema } from 'effect'
import { PublishedInsight } from '@nhl-reddit-stats/season/rpc'
import { SnapshotLoadError } from '@nhl-reddit-stats/season/rpc'
import { InsightCard } from '@nhl-reddit-stats/analyst/card'
import { render } from '@nhl-reddit-stats/analyst/render'

const CardList = Schema.Array(InsightCard)

const loadError = () => new SnapshotLoadError({ message: 'The insight cards could not be read.' })

/** None means the team has no insight file. */
type LoadTeamCards = (team: string) => Effect.Effect<Option.Option<unknown>, SnapshotLoadError>

/** One lazy loader per team file, bundled by scripts/build.mjs. */
export const archiveInsights = (archive: Readonly<Record<string, () => Promise<{ default: unknown }>>>): LoadTeamCards =>
  (team) => Object.hasOwn(archive, team)
    ? Effect.tryPromise({ try: async () => Option.some((await archive[team]()).default), catch: loadError })
    : Effect.succeedNone

export const filesInsights = (fs: FileSystem.FileSystem, directory: string): LoadTeamCards =>
  (team) => fs.readFileString(`${directory}/${team}.json`).pipe(
    Effect.flatMap((text) => Schema.decodeUnknownEffect(Schema.fromJsonString(Schema.Unknown))(text)),
    Effect.map(Option.some),
    Effect.catchReason('PlatformError', 'NotFound', () => Effect.succeedNone),
    Effect.mapError(loadError),
  )

/** Keeps approved cards, renders their copy, and validates each against the published shape. A card that cannot render or validate is dropped. */
export const publishCards = (cards: ReadonlyArray<typeof InsightCard.Type>): ReadonlyArray<PublishedInsight> =>
  cards.flatMap((card) => {
    if (card.status !== 'approved') return []

    const rows = card.evidence.result.map((row) => ({ ...row }))
    const bindings = Object.fromEntries(Object.entries(card.bindings))
    const headline = render(card.headline, bindings, rows)
    const body = render(card.body, bindings, rows)

    if (Result.isFailure(headline) || Result.isFailure(body)) return []

    const evidence = { query: card.evidence.query, result: card.evidence.result, gameIds: card.evidence.gameIds }
    const source = card.evidence.coverage === undefined ? evidence : { ...evidence, coverage: card.evidence.coverage }

    const published = Schema.decodeUnknownResult(PublishedInsight)({
      headline: headline.success,
      body: body.success,
      ...source,
      asOf: card.asOf,
    })

    return Result.isSuccess(published) ? [published.success] : []
  })

/** The approved, rendered cards of every team, in team order. */
export const loadPublishedInsights = (load: LoadTeamCards, teams: ReadonlyArray<string>) => Effect.gen(function* () {
  const published = yield* Effect.forEach(teams, (team) => Effect.gen(function* () {
    const raw = yield* load(team)

    if (Option.isNone(raw)) return []

    const cards = yield* Schema.decodeUnknownEffect(CardList)(raw.value).pipe(Effect.mapError(loadError))

    return publishCards(cards.filter((card) => card.team === team))
  }))

  return Array.flatten(published)
})
