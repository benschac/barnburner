import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { Config, Effect, Layer } from 'effect'
import { HttpRouter } from 'effect/http'
import { loggerLayer } from '../../../lib/logger.mjs'
import { History, HistoryRoutes } from './history-routes.ts'

// Vercel runs the function with its root as `process.cwd()`. `includeFiles` in `apps/web/vercel.json` keeps the
// repo-relative path, so the file sits at `apps/web/history-data/nhl-serve.sqlite` under that root (checked by
// `apps/web/scripts/check-vercel-output.mjs`). `HISTORY_DB` overrides it for local serving and tests.
const bundledFile = ['apps/web/history-data/nhl-serve.sqlite', 'history-data/nhl-serve.sqlite']
  .map((path) => resolve(process.cwd(), path))
  .find((path) => existsSync(path))
const historyLayer = Layer.unwrap(Effect.gen(function* () {
  const fromEnv = yield* Config.String('HISTORY_DB').pipe(Config.withDefault(''), Effect.orDie)
  return History.layer(fromEnv || bundledFile)
}))

export const historyApi = HttpRouter.toWebHandler(HistoryRoutes.pipe(
  Layer.provide(historyLayer),
  Layer.provideMerge(loggerLayer),
))

export default { fetch: historyApi.handler }
