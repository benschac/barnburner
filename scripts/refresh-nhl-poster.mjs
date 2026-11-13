import { readFile, writeFile, rename, unlink, mkdir } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { randomUUID } from 'node:crypto'
import { parseArgs } from 'node:util'
import { validateSnapshot } from '../lib/nhl-games.mjs'
import { buildPosterSnapshot, clubStatsUrl, completedDates, normalizeStandings, standingsUrl, teamSummaryUrl, validatePosterSnapshot, validateStandingsAgainstGames } from '../lib/nhl-poster.mjs'

export async function writePosterSnapshot(path, snapshot, teams, dates) {
  validatePosterSnapshot(snapshot, teams, dates)
  await mkdir(dirname(path), { recursive: true })
  const temporary = `${path}.${randomUUID()}.tmp`
  try {
    await writeFile(temporary, `${JSON.stringify(snapshot, null, 2)}\n`, { flag: 'wx' })
    await rename(temporary, path)
  } finally {
    await unlink(temporary).catch((error) => { if (error.code !== 'ENOENT') throw error })
  }
}

export async function refreshPosterSnapshot({ games, output, fromDir, fetchedAt, fetcher = fetch }) {
  if (fromDir && !fetchedAt) throw new Error('--from-dir requires the actual --fetched-at timestamp')
  const read = async (url, file) => {
    if (fromDir) return JSON.parse(await readFile(join(fromDir, file), 'utf8'))
    const response = await fetcher(url, { signal: AbortSignal.timeout(30_000) })
    if (!response.ok) throw new Error(`${url} failed with HTTP ${response.status}`)
    return response.json()
  }
  const standingsByDate = new Map()
  const dates = completedDates(games)
  if (dates.length === 0) throw new Error('No completed games for poster snapshot')
  // Check the newest standings before spending requests on history and player stats.
  const latest = dates.at(-1)
  const latestStandings = await read(standingsUrl(latest), `standings-${latest}.json`)
  validateStandingsAgainstGames(normalizeStandings(latestStandings, games.teams, latest), games)
  for (const date of dates) standingsByDate.set(date, date === latest ? latestStandings : await read(standingsUrl(date), `standings-${date}.json`))
  const summary = await read(teamSummaryUrl, 'summary.json')
  const clubStats = new Map()
  for (const { abbrev } of games.teams) clubStats.set(abbrev, await read(clubStatsUrl(abbrev), `club-${abbrev}.json`))
  const snapshot = buildPosterSnapshot({ games, standingsByDate, summary, clubStats, fetchedAt: fetchedAt ?? new Date().toISOString() })
  await writePosterSnapshot(output, snapshot, games.teams, completedDates(games))
  return snapshot
}

async function main() {
  const root = fileURLToPath(new URL('../', import.meta.url))
  const { values } = parseArgs({ options: {
    games: { type: 'string', default: join(root, 'data/nhl-20262027.json') },
    output: { type: 'string', default: join(root, 'data/nhl-poster-20262027.json') },
    'from-dir': { type: 'string' },
    'fetched-at': { type: 'string' },
  } })
  if (values['fetched-at'] && !values['from-dir']) throw new Error('--fetched-at is only valid with --from-dir')
  const games = validateSnapshot(JSON.parse(await readFile(values.games, 'utf8')))
  if (games.teams.length !== 32) throw new Error('Expected all 32 NHL teams')
  const snapshot = await refreshPosterSnapshot({ games, output: resolve(values.output), fromDir: values['from-dir'], fetchedAt: values['fetched-at'] })
  console.log(`Saved poster data for ${snapshot.clubs.length} teams through ${snapshot.standings[0].date}`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch((error) => { console.error(error.message); process.exitCode = 1 })
}
