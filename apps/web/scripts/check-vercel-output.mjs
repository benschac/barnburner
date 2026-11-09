import assert from 'node:assert/strict'
import { cp, mkdtemp, readFile, rm } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { Effect, Layer } from 'effect'
import { FetchHttpClient } from 'effect/http'
import { SeasonSource, rpcSeasonSourceLayer } from '../src/season-source.ts'

assert.ok(process.argv[2], 'Pass the standalone Vercel build output directory')
const output = resolve(process.argv[2])
const routes = JSON.parse(await readFile(join(output, 'config.json'), 'utf8')).routes
assert.ok(routes.some((route) => route.status === 308 && new RegExp(route.src).test('/api/rpc/')), 'RPC trailing slash must preserve POST via HTTP 308')
const directory = await mkdtemp(join(tmpdir(), 'rinkside-vercel-'))

try {
  for (const route of ['rpc', 'games', 'poster', 'teams']) {
    const isolated = join(directory, route)
    await cp(join(output, `functions/api/${route}.func`), isolated, { recursive: true, dereference: true })
    const config = JSON.parse(await readFile(join(isolated, '.vc-config.json'), 'utf8'))
    assert.match(config.runtime, /^nodejs/)
    assert.equal(config.supportsCancellation, true)
    const entry = pathToFileURL(join(isolated, config.handler))
    const api = (await import(entry.href)).default
    const bundled = await import(pathToFileURL(createRequire(entry).resolve('@nhl-reddit-stats/api/web-handler')).href)
    try {
      if (route === 'rpc') {
        const fetch = FetchHttpClient.Fetch.of((input, init) => api.fetch(new Request(input, init)))
        const data = await Effect.runPromise(Effect.gen(function* () {
          const source = yield* SeasonSource
          return yield* source.load
        }).pipe(Effect.provide(rpcSeasonSourceLayer('https://rinkside.example/api/rpc').pipe(
          Layer.provide(Layer.succeed(FetchHttpClient.Fetch, fetch)),
        ))))
        assert.equal(data.poster.clubs.length, 32)
        assert.equal(data.season.games.length, 1344)
      } else {
        const url = `https://rinkside.example/api/${route}${route === 'games' ? '?team=ANA' : ''}`
        const response = await api.fetch(new Request(url))
        assert.equal(response.status, 200)
        const body = await response.json()
        if (route === 'games') assert.equal(body.count, 84)
        if (route === 'poster') assert.equal(body.clubs.length, 32)
        if (route === 'teams') assert.equal(body.teams.length, 32)
      }
    } finally {
      await bundled.webApi.dispose()
    }
  }
  console.log('Isolated Vercel RPC and all three GET functions passed')
} finally {
  await rm(directory, { recursive: true, force: true })
}
