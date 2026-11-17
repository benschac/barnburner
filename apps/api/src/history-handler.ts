import { Layer } from 'effect'
import { HttpRouter } from 'effect/http'
import { History, HistoryRoutes } from './history-routes.ts'

export const historyApi = HttpRouter.toWebHandler(HistoryRoutes.pipe(
  Layer.provide(History.layer(process.env.HISTORY_DB)),
))

export default { fetch: historyApi.handler }
