import { Effect, Layer } from 'effect'
import { HttpRouter, HttpServerRequest, HttpServerResponse } from 'effect/http'
import { RpcSerialization, RpcServer } from 'effect/rpc'
import { TeamRpcs } from '@nhl-reddit-stats/season/rpc'
import { Snapshots } from './snapshots.ts'

const handlers = TeamRpcs.toLayer(Effect.gen(function* () {
  const snapshots = yield* Snapshots
  return { GetTeamData: () => snapshots.load }
}))

const json = (status: number, body: unknown, headers: Record<string, string> = {}) => HttpServerResponse.jsonUnsafe(body, {
  status, headers: { 'cache-control': 'no-cache', ...headers },
})

const snapshotRoutes = HttpRouter.use((router) => Effect.gen(function* () {
  const { season, poster } = yield* Snapshots
  yield* router.add('*', '/*', Effect.gen(function* () {
    const request = yield* HttpServerRequest.HttpServerRequest
    if (request.method !== 'GET') return json(405, { error: 'Method not allowed' }, { allow: 'GET' })
    let url: URL
    try { url = new URL(request.url, 'http://localhost') } catch { return json(400, { error: 'Invalid URL' }) }
    if (!['/api/teams', '/api/games', '/api/poster'].includes(url.pathname)) return json(404, { error: 'Not found' })
    if ([...url.searchParams.keys()].some((key) => key !== 'team' || url.pathname !== '/api/games') || url.searchParams.getAll('team').length > 1) {
      return json(400, { error: 'Unsupported query parameters' })
    }
    if (url.pathname === '/api/poster') {
      return json(poster === null ? 503 : 200, poster ?? { error: 'Poster snapshot is unavailable. Refresh the poster data and restart the server.' })
    }
    const metadata = { schemaVersion: season.schemaVersion, season: season.season, fetchedAt: season.fetchedAt }
    if (url.pathname === '/api/teams') return json(200, { ...metadata, teams: season.teams })
    const team = url.searchParams.get('team')
    if (team !== null && !season.teams.some(({ abbrev }) => abbrev === team)) return json(400, { error: 'Unknown team abbreviation' })
    const games = team === null ? season.games : season.games.filter((game) => game.homeTeam === team || game.awayTeam === team)
    return json(200, { ...metadata, team, count: games.length, games })
  }))
}))

export const ApiRoutes = Layer.mergeAll(
  RpcServer.layerHttp({ group: TeamRpcs, path: '/api/rpc', protocol: 'http' }).pipe(
    Layer.provide([handlers, RpcSerialization.layerJson]),
  ),
  snapshotRoutes,
)
