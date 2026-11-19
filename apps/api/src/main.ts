import { createServer } from 'node:http'
import { parseArgs } from 'node:util'
import { fileURLToPath } from 'node:url'
import { NodeHttpServer, NodeRuntime, NodeServices } from '@effect/platform-node'
import { Effect, Layer } from 'effect'
import { HttpRouter } from 'effect/http'
import { loggerLayer } from '../../../lib/logger.mjs'
import { BoxScores } from './boxscores.ts'
import { History, HistoryRoutes } from './history-routes.ts'
import { ApiRoutes } from './routes.ts'
import { Snapshots } from './snapshots.ts'

const program = Effect.gen(function* () {
  const { values } = yield* Effect.try(() => parseArgs({ options: {
    snapshot: { type: 'string', default: fileURLToPath(new URL('../../../data/nhl-20262027.json', import.meta.url)) },
    'poster-snapshot': { type: 'string', default: fileURLToPath(new URL('../../../data/nhl-poster-20262027.json', import.meta.url)) },
    insights: { type: 'string', default: fileURLToPath(new URL('../../../data/insights/20262027', import.meta.url)) },
    boxscores: { type: 'string', default: fileURLToPath(new URL('../../../data/boxscores/20262027', import.meta.url)) },
    history: { type: 'string' },
    host: { type: 'string', default: '127.0.0.1' },
    port: { type: 'string', default: '3001' },
  } }))
  const port = Number(values.port)
  if (!/^\d+$/.test(values.port) || !Number.isInteger(port) || port < 0 || port > 65535) {
    return yield* Effect.fail(new Error('Invalid port'))
  }
  return yield* HttpRouter.serve(values.history === undefined ? ApiRoutes : Layer.mergeAll(ApiRoutes, HistoryRoutes)).pipe(
    Layer.provide([
      Snapshots.layer({ snapshot: values.snapshot, posterSnapshot: values['poster-snapshot'], insights: values.insights }),
      BoxScores.layerFiles(values.boxscores),
      History.layer(values.history),
    ]),
    Layer.provide(NodeHttpServer.layer(() => createServer(), { host: values.host, port })),
    Layer.provide(NodeServices.layer),
    Layer.launch,
  )
})

NodeRuntime.runMain(program.pipe(Effect.provide(loggerLayer)))
