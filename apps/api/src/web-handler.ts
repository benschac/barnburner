import { Layer } from 'effect'
import { HttpRouter } from 'effect/http'
import season from '../../../data/nhl-20262027.json' with { type: 'json' }
import poster from '../../../data/nhl-poster-20262027.json' with { type: 'json' }
import { boxscoreArchive } from 'virtual:boxscore-archive'
import { BoxScores } from './boxscores.ts'
import { ApiRoutes } from './routes.ts'
import { makeSnapshots, Snapshots } from './snapshots.ts'

export const webApi = HttpRouter.toWebHandler(ApiRoutes.pipe(
  Layer.provide([
    Layer.effect(Snapshots, makeSnapshots({ season, poster })),
    BoxScores.layerArchive(boxscoreArchive),
  ]),
))

export default { fetch: webApi.handler }
