import { Effect, Layer } from 'effect'
import { HttpRouter } from 'effect/http'
import { ApiRoutes } from '../src/routes.ts'
import { makeSnapshots, Snapshots } from '../src/snapshots.ts'

export async function makeTestApi(season: unknown, expectedGamesPerTeam: number, poster: unknown | null = null) {
  const snapshots = await Effect.runPromise(makeSnapshots({ season, poster, expectedGamesPerTeam }))
  const app = HttpRouter.toWebHandler(ApiRoutes.pipe(Layer.provide(Layer.succeed(Snapshots, snapshots))), { disableLogger: true })
  return {
    request: (path: string, init?: RequestInit) => app.handler(new Request(`http://localhost${path}`, init)),
    dispose: app.dispose,
  }
}
