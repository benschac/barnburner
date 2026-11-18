import { logInfo } from '../../../lib/logger.mjs'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { cp, mkdtemp, readdir, readFile, realpath, rm, stat, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { basename, dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Effect, Layer } from 'effect'
import { FetchHttpClient } from 'effect/http'
import { RpcClient, RpcSerialization } from 'effect/rpc'
import { HistoryRpcs } from '@nhl-reddit-stats/history/rpc'
import { SeasonSource, rpcSeasonSourceLayer } from '../src/season-source.ts'

// Usage: check-vercel-output.mjs <output-dir> [--require-history]
// <output-dir> is the Build Output API directory that `vercel build --prod --standalone` writes for the Next app (.vercel/output).
// Without --require-history, a build with no bundled snapshot passes if /api/history answers HistoryUnavailable.
//
// Layout read here (Build Output API v3, as `vercel build` writes it for a Next.js app):
//   config.json                                routes; the trailing-slash redirect for /api/rpc/ is one of them
//   functions/<pathname>.func/                 one directory per route handler, for example functions/api/rpc.func
//   functions/<pathname>.func/.vc-config.json  runtime, handler (the Next launcher), supportsCancellation
// Each function is copied outside the checkout, started in its own Node process the way Vercel starts it (the launcher
// exports a (req, res) listener), and called over real HTTP with the x-matched-path header that Vercel's router sends.

const HISTORY_FILE = 'apps/web/history-data/nhl-serve.sqlite'
// The history handler looks for the file under its working directory (the launcher's directory) at either path.
const HISTORY_FILE_NEAR_LAUNCHER = ['apps/web/history-data/nhl-serve.sqlite', 'history-data/nhl-serve.sqlite']
const WEB_ROUTES = ['rpc', 'games', 'poster', 'teams']
const REQUEST_TIMEOUT_MS = 60_000

const args = process.argv.slice(2)
const requireHistory = args.includes('--require-history')
const outputArg = args.find((arg) => !arg.startsWith('--'))
assert.ok(outputArg, 'Pass the standalone Vercel build output directory')
const output = resolve(outputArg)

const readJson = async (path) => JSON.parse(await readFile(path, 'utf8'))
const sizeOf = (path) => stat(path).then((file) => (file.isFile() ? file.size : null), () => null)

const config = await readJson(join(output, 'config.json')).catch((cause) => {
  throw new assert.AssertionError({ message: `${output}/config.json must exist and be JSON, found: ${cause.message}` })
})
assert.ok(Array.isArray(config.routes), `config.json must list routes, found ${typeof config.routes}`)
assert.ok(
  config.routes.some((route) => route.status === 308 && new RegExp(route.src).test('/api/rpc/')),
  `RPC trailing slash must preserve POST via HTTP 308: no route in config.json has status 308 and matches /api/rpc/ (${config.routes.length} routes, ${config.routes.filter((route) => route.status !== undefined).length} with a status)`,
)

// Every <pathname>.func directory below functions/, following symlinks (a function may be shared by several routes).
const findFunctions = async (root, prefix = '') => {
  const found = new Map()
  for (const entry of await readdir(join(root, prefix), { withFileTypes: true }).catch(() => [])) {
    const path = `${prefix}${entry.name}`
    const info = await stat(join(root, path)).catch(() => null)
    if (info === null || !info.isDirectory()) continue
    if (entry.name.endsWith('.func')) found.set(path.slice(0, -'.func'.length), join(root, path))
    else for (const [name, directory] of await findFunctions(root, `${path}/`)) found.set(name, directory)
  }
  return found
}
const functions = await findFunctions(join(output, 'functions'))
const apiFunctions = [...functions].filter(([name]) => name.startsWith('api/'))
const found = `found ${functions.size} functions${apiFunctions.length > 0 ? `; api: ${apiFunctions.map(([name]) => name).join(', ')}` : ''}`

const readConfig = async (name) => {
  const directory = functions.get(name)
  assert.ok(directory, `functions/${name}.func is missing from ${output}; ${found}`)
  const vc = await readJson(join(directory, '.vc-config.json')).catch((cause) => {
    throw new assert.AssertionError({ message: `functions/${name}.func/.vc-config.json must exist and be JSON, found: ${cause.message}` })
  })
  assert.match(vc.runtime, /^nodejs/, `functions/${name}.func runtime must be a Node runtime, found ${vc.runtime}`)
  assert.equal(typeof vc.handler, 'string', `functions/${name}.func must name a handler file, found ${typeof vc.handler}`)
  assert.ok(
    vc.filePathMap === undefined || Object.keys(vc.filePathMap).length === 0,
    `functions/${name}.func lists filePathMap entries (files kept outside the function directory); build with --standalone so the function carries its own files`,
  )
  return { directory, vc }
}

// Cancellation: vercel.json sets supportsCancellation for app/api/**/route.ts, so every packaged API function must carry it.
for (const [name] of apiFunctions) {
  const { vc } = await readConfig(name)
  assert.equal(vc.supportsCancellation, true, `functions/${name}.func must have supportsCancellation: true in .vc-config.json, found ${vc.supportsCancellation}`)
}
logInfo(`All ${apiFunctions.length} packaged API functions support cancellation`)

// A copy of the function outside the checkout, served from its own Node process so one Next server never shares globals with another.
const harness = `
import { createServer } from 'node:http'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
const [directory, handlerPath] = process.argv.slice(2)
process.chdir(directory)
const loaded = await import(pathToFileURL(resolve(directory, handlerPath)).href)
if (typeof loaded.default !== 'function') {
  console.error('handler ' + handlerPath + ' must export a (req, res) function, found exports: ' + Object.keys(loaded).join(', '))
  process.exit(2)
}
const server = createServer((req, res) => {
  Promise.resolve(loaded.default(req, res)).catch((error) => {
    console.error('handler threw for ' + req.method + ' ' + req.url, error)
    if (!res.headersSent) res.statusCode = 500
    res.end()
  })
})
server.listen(0, '127.0.0.1', () => console.log('LISTENING ' + server.address().port))
`

// Resolved paths come back as real paths (/var is /private/var on macOS), so keep the temporary directory in that form.
const directory = await realpath(await mkdtemp(join(tmpdir(), 'rinkside-vercel-')))
const harnessFile = join(directory, 'harness.mjs')
await writeFile(harnessFile, harness)
// HISTORY_DB would hide a missing bundled file, so no packaged function sees it.
const { HISTORY_DB: _ignoredHistoryDb, ...childEnv } = process.env

const startFunction = async (name, vc, source) => {
  const isolated = join(directory, name.replaceAll('/', '_'))
  await cp(source, isolated, { recursive: true, dereference: true })
  const launcher = join(isolated, vc.handler)
  assert.ok(await sizeOf(launcher) !== null, `functions/${name}.func handler ${vc.handler} is not a file in the function directory`)
  const child = spawn(process.execPath, [harnessFile, isolated, vc.handler], {
    cwd: isolated,
    env: { ...childEnv, NEXT_TELEMETRY_DISABLED: '1' },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  let log = ''
  child.stderr.on('data', (chunk) => { log += chunk })
  const exited = new Promise((done) => child.once('exit', (code, signal) => done(`exited with ${code ?? signal}`)))
  const port = await new Promise((done, fail) => {
    child.stdout.on('data', (chunk) => {
      log += chunk
      const match = /LISTENING (\d+)/.exec(log)
      if (match) done(Number(match[1]))
    })
    void exited.then((reason) => fail(new assert.AssertionError({ message: `functions/${name}.func ${reason} before it listened\n${log}` })))
    setTimeout(() => fail(new assert.AssertionError({ message: `functions/${name}.func did not listen within ${REQUEST_TIMEOUT_MS} ms\n${log}` })), REQUEST_TIMEOUT_MS).unref()
  }).catch(async (error) => {
    child.kill()
    throw error
  })
  const pathname = `/${name}`
  // Vercel's router tells a Next function which route it matched; the launcher's routing reads this header.
  const fetchFunction = (input, init) => {
    const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined))
    headers.set('x-matched-path', pathname)
    return fetch(input, { ...init, headers, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) })
  }
  return {
    isolated,
    launcherDirectory: dirname(launcher),
    url: `http://127.0.0.1:${port}${pathname}`,
    fetch: fetchFunction,
    // A failed assertion is more useful with whatever the function logged.
    async run(check) {
      try {
        return await check()
      } catch (error) {
        if (error instanceof Error) error.message += `\n--- functions/${name}.func output ---\n${log || '(none)'}`
        throw error
      }
    },
    async stop() {
      child.kill()
      await exited
    },
  }
}

// The packaged API is the built apps/api/dist, imported at run time (it stays external to webpack). The function must carry
// its handler and every box-score chunk as separate files, found the way the route finds them.
const sourceDist = fileURLToPath(new URL('../../api/dist/', import.meta.url))
const sourceChunks = (await readdir(sourceDist).catch(() => [])).filter((file) => /^chunk-.*\.js$/.test(file))
const assertPackagedApi = async (name, running, handlerFile, withChunks) => {
  const specifier = `@nhl-reddit-stats/api/${basename(handlerFile, '.js')}`
  let resolved
  try {
    resolved = createRequire(join(running.launcherDirectory, 'noop.cjs')).resolve(specifier)
  } catch (cause) {
    assert.fail(`functions/${name}.func must carry ${specifier} (apps/api/dist/${handlerFile}) where the launcher can resolve it, found: ${cause.message}`)
  }
  assert.ok(
    !relative(running.isolated, resolved).startsWith('..'),
    `functions/${name}.func resolved ${specifier} to ${resolved}, outside the function directory`,
  )
  assert.equal(basename(resolved), handlerFile, `functions/${name}.func resolved ${specifier} to ${resolved}, expected a file named ${handlerFile}`)
  if (!withChunks) return
  const chunks = (await readdir(dirname(resolved))).filter((file) => /^chunk-.*\.js$/.test(file))
  assert.ok(chunks.length > 0, `functions/${name}.func carries no box-score chunk-*.js beside ${handlerFile}; found 0`)
  const missing = sourceChunks.filter((file) => !chunks.includes(file))
  assert.equal(
    missing.length,
    0,
    `functions/${name}.func must carry all ${sourceChunks.length} box-score chunks of ${sourceDist}, found ${chunks.length} and missing ${missing.length} (${missing.slice(0, 3).join(', ')})`,
  )
}

try {
  for (const route of WEB_ROUTES) {
    const name = `api/${route}`
    const { directory: source, vc } = await readConfig(name)
    const running = await startFunction(name, vc, source)
    try {
      await running.run(async () => {
        await assertPackagedApi(name, running, 'web-handler.js', true)
        if (route === 'rpc') {
          const data = await Effect.runPromise(Effect.gen(function* () {
            const season = yield* SeasonSource
            return yield* season.load
          }).pipe(Effect.provide(rpcSeasonSourceLayer(running.url).pipe(
            Layer.provide(Layer.succeed(FetchHttpClient.Fetch, running.fetch)),
          ))))
          assert.equal(data.poster.clubs.length, 32, `RPC poster clubs: expected 32, found ${data.poster.clubs.length}`)
          assert.equal(data.season.games.length, 1344, `RPC season games: expected 1344, found ${data.season.games.length}`)
        } else {
          const url = `${running.url}${route === 'games' ? '?team=ANA' : ''}`
          const response = await running.fetch(url)
          assert.equal(response.status, 200, `GET ${name} expected status 200, found ${response.status}`)
          const body = await response.json()
          if (route === 'games') assert.equal(body.count, 84, `GET ${name}?team=ANA expected count 84, found ${body.count}`)
          if (route === 'poster') assert.equal(body.clubs.length, 32, `GET ${name} expected 32 clubs, found ${body.clubs.length}`)
          if (route === 'teams') assert.equal(body.teams.length, 32, `GET ${name} expected 32 teams, found ${body.teams.length}`)
        }
      })
    } finally {
      await running.stop()
    }
    // The snapshot is traced for /api/history only.
    for (const candidate of [HISTORY_FILE, 'history-data/nhl-serve.sqlite']) {
      assert.equal(await sizeOf(join(source, candidate)), null, `functions/${name}.func must not carry ${candidate}; the history file is traced for /api/history only`)
    }
  }
  logInfo('Isolated Vercel RPC and all three GET functions passed')

  // The history function must carry its serving file and run on a Node that has node:sqlite.
  const { directory: historyFunction, vc: historyConfig } = await readConfig('api/history')
  const node = /^nodejs(\d+)/.exec(historyConfig.runtime)
  assert.ok(node && Number(node[1]) >= 22, `history runtime ${historyConfig.runtime} must be Node 22.5 or newer for node:sqlite`)
  assert.ok(process.getBuiltinModule('node:sqlite'), `this Node (${process.version}) has no node:sqlite, so it cannot run the packaged history function`)
  const launcherDirectory = dirname(join(historyFunction, historyConfig.handler))
  const candidates = [join(historyFunction, HISTORY_FILE), ...HISTORY_FILE_NEAR_LAUNCHER.map((path) => join(launcherDirectory, path))]
  let shipped = null
  let size = null
  for (const candidate of candidates) {
    size = await sizeOf(candidate)
    if (size !== null) {
      shipped = candidate
      break
    }
  }
  if (requireHistory) {
    assert.ok(size !== null && size > 0, `${HISTORY_FILE} is missing or empty in the history function; looked at ${candidates.map((path) => relative(historyFunction, path)).join(', ')}`)
  }
  const running = await startFunction('api/history', historyConfig, historyFunction)
  try {
    await running.run(async () => {
      await assertPackagedApi('api/history', running, 'history-handler.js', false)
      const search = Effect.scoped(Effect.gen(function* () {
        const client = yield* RpcClient.make(HistoryRpcs)
        return yield* client.SearchPlayers({ query: 'a', limit: 3 })
      })).pipe(Effect.provide(RpcClient.layerProtocolHttp({ url: running.url }).pipe(
        Layer.provide([FetchHttpClient.layer, RpcSerialization.layerJson]),
        Layer.provide(Layer.succeed(FetchHttpClient.Fetch, running.fetch)),
      )))
      if (size === null) {
        const failure = await Effect.runPromise(Effect.flip(search))
        assert.equal(failure._tag, 'HistoryUnavailable', `without a bundled snapshot /api/history must answer HistoryUnavailable, found ${failure._tag}`)
        logInfo(`Packaged history function (${historyConfig.runtime}) has no snapshot and answered HistoryUnavailable`)
      } else {
        const result = await Effect.runPromise(search)
        assert.ok(result.snapshotId.length > 0, 'SearchPlayers returned an empty snapshotId from the packaged file')
        assert.ok(result.players.length > 0, 'SearchPlayers returned no rows from the packaged file')
        logInfo(`Packaged history function (${historyConfig.runtime}) served SearchPlayers from ${relative(historyFunction, shipped)} (${size} bytes)`)
      }
    })
  } finally {
    await running.stop()
  }
} finally {
  await rm(directory, { recursive: true, force: true })
}
