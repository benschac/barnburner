import { mkdir, mkdtemp, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { setTimeout as wait } from 'node:timers/promises'
import { fileURLToPath } from 'node:url'
import { isDeepStrictEqual, parseArgs } from 'node:util'
import { boxScoreMatchesGame, boxScoreUrl, normalizeBoxScore } from '../lib/nhl-boxscores.mjs'
import { SEASON } from '../lib/nhl-games.mjs'
import { completedDates } from '../lib/nhl-poster.mjs'
import { refreshSnapshot } from './refresh-nhl-games.mjs'
import { refreshPosterSnapshot } from './refresh-nhl-poster.mjs'

const readJson = async (path) => JSON.parse(await readFile(path, 'utf8'))
const backfillLimit = 16

function createNhlFetcher() {
  let nextRequestAt = 0
  return async (url) => {
    for (let attempt = 1; ; attempt++) {
      const delay = nextRequestAt - Date.now()
      if (delay > 60_000) throw new Error('NHL requested a cooldown longer than one minute')
      if (delay > 0) await wait(delay)
      nextRequestAt = Date.now() + 1_000
      const response = await fetch(url, { signal: AbortSignal.timeout(30_000) })
      if (response.status !== 429) return response

      const retryAfter = response.headers.get('retry-after') ?? ''
      const retryAt = /^\d+$/.test(retryAfter)
        ? Date.now() + Number(retryAfter) * 1_000
        : Date.parse(retryAfter)
      nextRequestAt = Number.isFinite(retryAt) ? Math.max(nextRequestAt, retryAt) : Date.now() + 30_000
      if (attempt === 3) return response
      console.warn(`NHL rate limit while reading ${url}. Waiting before retry.`)
      await response.body?.cancel()
    }
  }
}

async function readSavedJson(path) {
  try {
    return await readJson(path)
  } catch (error) {
    if (error.code !== 'ENOENT') throw error
    return null
  }
}

async function changed(path, next) {
  const previous = await readSavedJson(path)
  return !isDeepStrictEqual({ ...previous, fetchedAt: next.fetchedAt }, next)
}

async function refresh(directory) {
  const teams = await readJson(join(directory, 'teams.json'))
  if (teams.length !== 32) throw new Error('Expected all 32 NHL teams')
  const staging = await mkdtemp(join(directory, '.nhl-refresh-'))
  try {
    const gamesFile = `nhl-${SEASON}.json`
    const posterFile = `nhl-poster-${SEASON}.json`
    const fetcher = createNhlFetcher()
    const games = await refreshSnapshot({ teams, output: join(staging, gamesFile), fetcher })
    const poster = await refreshPosterSnapshot({ games, output: join(staging, posterFile), fetcher })

    const archive = join(directory, 'boxscores', String(SEASON))
    const finals = games.games.filter((game) => game.result)
    const currentBoxes = new Set()
    for (const game of finals) {
      const box = await readSavedJson(join(archive, `${game.id}.json`))
      if (boxScoreMatchesGame(box, game)) currentBoxes.add(game.id)
    }
    const recentDates = new Set(completedDates(games).slice(-2))
    const recent = finals.filter((game) => recentDates.has(game.date))
    const backlog = finals.filter((game) => !recentDates.has(game.date) && !currentBoxes.has(game.id))
    // Rotate the starting point so persistent gaps cannot starve other games.
    const day = Math.floor(Date.now() / 86_400_000)
    const offset = day * backfillLimit % Math.max(1, backlog.length)
    const older = [...backlog.slice(offset), ...backlog.slice(0, offset)].slice(0, backfillLimit)
    const pending = []
    const writes = []

    for (const [filename, snapshot] of [[gamesFile, games], [posterFile, poster]]) {
      const destination = join(directory, filename)
      if (await changed(destination, snapshot)) writes.push([join(staging, filename), destination])
    }

    for (const game of [...recent, ...older]) {
      let boxScore
      try {
        const response = await fetcher(boxScoreUrl(game.id))
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        boxScore = normalizeBoxScore(await response.json(), game, new Date().toISOString())
      } catch (error) {
        pending.push(game.id)
        console.warn(`Could not refresh box score ${game.id}: ${error.message}`)
        continue
      }
      const filename = `${game.id}.json`
      const destination = join(archive, filename)
      if (await changed(destination, boxScore)) {
        const staged = join(staging, filename)
        await writeFile(staged, `${JSON.stringify(boxScore, null, 2)}\n`)
        writes.push([staged, destination])
      }
      currentBoxes.add(game.id)
    }

    await mkdir(archive, { recursive: true })
    for (const [source, destination] of writes) await rename(source, destination)
    console.log(`Checked ${finals.length} finals through ${poster.standings[0].date}. Matching box scores: ${currentBoxes.size}/${finals.length}. Updated files: ${writes.length}.`)
    if (pending.length) console.warn(`Box scores unavailable this run: ${pending.join(', ')}`)
  } finally {
    await rm(staging, { recursive: true, force: true })
  }
}

const { values } = parseArgs({ options: { 'data-dir': { type: 'string' } } })
const directory = values['data-dir'] ? resolve(values['data-dir']) : fileURLToPath(new URL('../data', import.meta.url))
refresh(directory).catch((error) => {
  console.error(error.message)
  process.exitCode = 1
})
