import { Effect, Layer } from 'effect'
import { HttpRouter } from 'effect/http'
import season from '../../../data/nhl-20262027.json' with { type: 'json' }
import poster from '../../../data/nhl-poster-20262027.json' with { type: 'json' }
import { boxscoreArchive } from 'virtual:boxscore-archive'
import { insightsArchive } from 'virtual:insights-archive'
import { BoxScores } from './boxscores.ts'
import { Insights, loadPublishedInsights } from './insights.ts'
import { ApiRoutes } from './routes.ts'
import { makeSnapshots, Snapshots } from './snapshots.ts'

export const webApi = HttpRouter.toWebHandler(ApiRoutes.pipe(
  Layer.provide([
    Layer.effect(Snapshots, Effect.gen(function* () {
      const insights = yield* Insights
      return yield* makeSnapshots({ season, poster, insights: loadPublishedInsights(season.teams.map((team) => team.abbrev)).pipe(Effect.provideService(Insights, insights)) })
    })).pipe(Layer.provide(Insights.layerArchive(insightsArchive))),
    BoxScores.layerArchive(boxscoreArchive),
  ]),
))

export default { fetch: webApi.handler }
