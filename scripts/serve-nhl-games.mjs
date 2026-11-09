import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { parseArgs } from 'node:util'
import { selectTeamGames, validateSnapshot, GAMES_PER_TEAM } from '../lib/nhl-games.mjs'

export function createGamesServer(snapshot, expectedGamesPerTeam = GAMES_PER_TEAM) {
  validateSnapshot(snapshot, expectedGamesPerTeam)
  return createServer((request, response) => {
    const send = (status, body) => {
      response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-cache' })
      response.end(JSON.stringify(body))
    }
    if (request.method !== 'GET') {
      response.setHeader('Allow', 'GET')
      send(405, { error: 'Method not allowed' })
      return
    }
    let url
    try { url = new URL(request.url, 'http://localhost') } catch {
      send(400, { error: 'Invalid URL' })
      return
    }
    if (!['/api/teams', '/api/games'].includes(url.pathname)) {
      send(404, { error: 'Not found' })
      return
    }
    if ([...url.searchParams.keys()].some((key) => key !== 'team' || url.pathname !== '/api/games') || url.searchParams.getAll('team').length > 1) {
      send(400, { error: 'Unsupported query parameters' })
      return
    }
    const metadata = { schemaVersion: snapshot.schemaVersion, season: snapshot.season, fetchedAt: snapshot.fetchedAt }
    if (url.pathname === '/api/teams') {
      send(200, { ...metadata, teams: snapshot.teams })
      return
    }
    const team = url.searchParams.get('team')
    if (team !== null && !snapshot.teams.some(({ abbrev }) => abbrev === team)) {
      send(400, { error: 'Unknown team abbreviation' })
      return
    }
    const games = team === null ? snapshot.games : selectTeamGames(snapshot, team)
    send(200, { ...metadata, team, count: games.length, games })
  })
}

async function main() {
  const { values } = parseArgs({ options: {
    snapshot: { type: 'string', default: fileURLToPath(new URL('../data/nhl-20262027.json', import.meta.url)) },
    host: { type: 'string', default: '127.0.0.1' },
    port: { type: 'string', default: '3001' },
  } })
  const port = Number(values.port)
  if (!/^\d+$/.test(values.port) || !Number.isInteger(port) || port < 0 || port > 65535) throw new Error('Invalid port')
  const snapshot = JSON.parse(await readFile(values.snapshot, 'utf8'))
  if (snapshot.teams?.length !== 32) throw new Error('Expected all 32 NHL teams')
  const server = createGamesServer(snapshot)
  server.on('error', (error) => { console.error(error.message); process.exitCode = 1 })
  server.listen(port, values.host, () => console.log(`NHL snapshot API at http://${values.host}:${server.address().port}`))
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch((error) => { console.error(error.message); process.exitCode = 1 })
}
