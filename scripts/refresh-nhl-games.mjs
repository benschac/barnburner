import { readFile, writeFile, rename, unlink, mkdir } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { randomUUID } from 'node:crypto'
import { parseArgs } from 'node:util'
import { buildSnapshot, scheduleUrl, validateSnapshot, SEASON, GAMES_PER_TEAM } from '../lib/nhl-games.mjs'

const root = fileURLToPath(new URL('../', import.meta.url))

export async function writeSnapshot(path, snapshot, expectedGamesPerTeam = GAMES_PER_TEAM) {
  validateSnapshot(snapshot, expectedGamesPerTeam)
  await mkdir(dirname(path), { recursive: true })
  const temporary = `${path}.${randomUUID()}.tmp`
  try {
    await writeFile(temporary, `${JSON.stringify(snapshot, null, 2)}\n`, { flag: 'wx' })
    await rename(temporary, path)
  } finally {
    await unlink(temporary).catch((error) => { if (error.code !== 'ENOENT') throw error })
  }
}

export async function refreshSnapshot({ teams, output, fromDir, fetchedAt, fetcher = fetch, expectedGamesPerTeam = GAMES_PER_TEAM }) {
  if (fromDir && !fetchedAt) throw new Error('--from-dir requires the actual --fetched-at timestamp')
  const schedules = new Map()
  for (const { abbrev } of teams) {
    let schedule
    if (fromDir) {
      schedule = JSON.parse(await readFile(join(fromDir, `${abbrev}.json`), 'utf8'))
    } else {
      const response = await fetcher(scheduleUrl(abbrev), { signal: AbortSignal.timeout(30_000) })
      if (!response.ok) throw new Error(`${abbrev} schedule request failed with HTTP ${response.status}`)
      schedule = await response.json()
    }
    schedules.set(abbrev, schedule)
  }
  const snapshot = buildSnapshot(schedules, teams, fetchedAt ?? new Date().toISOString(), expectedGamesPerTeam)
  await writeSnapshot(output, snapshot, expectedGamesPerTeam)
  return snapshot
}

async function main() {
  const { values } = parseArgs({ options: {
    'from-dir': { type: 'string' },
    'fetched-at': { type: 'string' },
    output: { type: 'string' },
  } })
  if (values['fetched-at'] && !values['from-dir']) throw new Error('--fetched-at is only valid with --from-dir')
  const teams = JSON.parse(await readFile(join(root, 'data/teams.json'), 'utf8'))
  if (teams.length !== 32) throw new Error('Expected all 32 NHL teams')
  const output = resolve(values.output ?? join(root, `data/nhl-${SEASON}.json`))
  const snapshot = await refreshSnapshot({ teams, output, fromDir: values['from-dir'], fetchedAt: values['fetched-at'] })
  console.log(`Saved ${snapshot.games.length} games for ${snapshot.teams.length} teams to ${output}`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch((error) => { console.error(error.message); process.exitCode = 1 })
}
