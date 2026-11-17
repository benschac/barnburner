import { existsSync } from 'node:fs'
import { parseArgs } from 'node:util'
import { fileURLToPath } from 'node:url'
import { Effect, Match, Result, Schema } from 'effect'
import {
  DEFAULT_FILTER, HistoryUnavailable, farthest, finalsCoverage, findPaths, link, makeGraph, opponents,
} from '@nhl-reddit-stats/history'
import type { Filter, FinalsYear, HistoryStore, PlayerRow, Relation, StintRow } from '@nhl-reddit-stats/history'
import { fillOpponentHops } from '../src/history-routes.ts'
import { openHistoryStore } from '../src/history-store.ts'
import type { WireHop } from '../src/history-routes.ts'

// Query the history serving file from the terminal. It runs the same package functions as the API
// handlers (findPaths, link, opponents, farthest, finalsCoverage, fillOpponentHops) on the opened store.
//
//   node scripts/history-query.ts [--db <file>] <command> ...
//
// `--db` defaults to $HISTORY_DB, else the first existing of apps/web/history-data/nhl-serve.sqlite and
// data/history/nhl-serve.sqlite.

const USAGE = `Usage: history-query.ts [--db <file>] <command> [options]
  path <a> <b>        shortest chain(s) between two players
  player <name>       player summary and stints
  link <a> <b>        how two players are linked
  opponents <name>    most-faced opponents
  farthest <name>     the player's farthest reachable teammate chain
  finals <name>       Cup Finals coverage [--from 1980 --to 2026]
Players are names (accent-folded) or numeric IDs.
Options: --regular | --playoff, --from-season <id>, --to-season <id>, --no-partners,
         --relation with|against|either, --limit <n>`

class UsageError extends Schema.TaggedError<UsageError, { readonly brand: unique symbol }>()('UsageError', {
  message: Schema.String,
}) {}
class NoMatch extends Schema.TaggedError<NoMatch, { readonly brand: unique symbol }>()('NoMatch', {
  query: Schema.String,
}) {}
class AmbiguousName extends Schema.TaggedError<AmbiguousName, { readonly brand: unique symbol }>()('AmbiguousName', {
  query: Schema.String,
  candidates: Schema.Array(Schema.String),
}) {}
class NoChain extends Schema.TaggedError<NoChain, { readonly brand: unique symbol }>()('NoChain', {
  from: Schema.String,
  to: Schema.String,
}) {}

const rootFile = (relative: string) => fileURLToPath(new URL(`../../../${relative}`, import.meta.url))

const defaultDb = (): string => {
  const fromEnv = process.env.HISTORY_DB
  if (fromEnv !== undefined && fromEnv !== '') return fromEnv
  const candidates = [rootFile('apps/web/history-data/nhl-serve.sqlite'), rootFile('data/history/nhl-serve.sqlite')]
  return candidates.find((candidate) => existsSync(candidate)) ?? candidates[0]
}

const foldName = (name: string): string => name.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()

const seasonLabel = (seasonId: number): string => {
  const start = Math.floor(seasonId / 10000)
  return `${start}–${String(start + 1).slice(-2)}`
}

const competitionLabel = (gameType: 2 | 3): string => (gameType === 2 ? 'regular season' : 'playoffs')

const describePlayer = (p: PlayerRow): string =>
  `${p.name} (id ${p.playerId}, ${p.position}, ${seasonLabel(p.firstSeason)} to ${seasonLabel(p.lastSeason)})`

const parseCount = (flag: string, text: string | undefined, fallback: number) => {
  if (text === undefined) return Effect.succeed(fallback)
  return /^\d+$/.test(text) ? Effect.succeed(Number(text)) : Effect.fail(new UsageError({ message: `${flag} needs a whole number.` }))
}

const resolve = (store: HistoryStore, text: string): Effect.Effect<PlayerRow, HistoryUnavailable | NoMatch | AmbiguousName> =>
  Effect.gen(function* () {
    if (/^\d+$/.test(text)) {
      const { player } = yield* store.player(Number(text)).pipe(
        Effect.catchTag('UnknownPlayer', () => Effect.fail(new NoMatch({ query: text }))),
      )
      return player
    }
    const found = yield* store.searchPlayers(text, 20)
    const folded = foldName(text.trim())
    const exact = found.filter((p) => foldName(p.name) === folded)
    const pool = exact.length > 0 ? exact : found
    if (pool.length === 0) return yield* new NoMatch({ query: text })
    if (pool.length > 1) return yield* new AmbiguousName({ query: text, candidates: pool.map(describePlayer) })
    return pool[0]
  })

type Detail = { readonly name: string; readonly stints: ReadonlyArray<StintRow> }

type Names = {
  readonly name: (id: number) => Effect.Effect<string, HistoryUnavailable>
  readonly team: (playerId: number, teamId: number) => Effect.Effect<string, HistoryUnavailable>
  readonly date: (hop: WireHop) => Effect.Effect<string, HistoryUnavailable>
}

const makeNames = (store: HistoryStore): Names => {
  const details = new Map<number, Effect.Effect<Detail, HistoryUnavailable>>()
  const detail = (id: number) => {
    let cached = details.get(id)
    if (cached === undefined) {
      cached = store.player(id).pipe(
        Effect.map(({ player, stints }): Detail => ({ name: player.name, stints })),
        Effect.catchTag('UnknownPlayer', () => Effect.succeed<Detail>({ name: `player ${id}`, stints: [] })),
      )
      details.set(id, cached)
    }
    return cached
  }
  return {
    name: (id) => Effect.map(detail(id), (d) => d.name),
    team: (playerId, teamId) => Effect.map(detail(playerId), (d) => d.stints.find((s) => s.teamId === teamId)?.teamAbbrev ?? `team ${teamId}`),
    date: (hop) => {
      const games = hop._tag === 'PlayedAgainst'
        ? store.opposedGames(hop.from, hop.to)
        : store.sharedGames(hop.from, hop.to, hop.seasonId, hop.gameType, hop.teamId, hop._tag)
      return games.pipe(
        Effect.map((rows) => rows.find((g) => g.gameId === hop.gameId)?.gameDate ?? '?'),
        Effect.catchTag('UnknownPlayer', () => Effect.succeed('?')),
      )
    },
  }
}

const hopLine = (names: Names, hop: WireHop) => Effect.gen(function* () {
  const from = yield* names.name(hop.from)
  const to = yield* names.name(hop.to)
  const date = yield* names.date(hop)
  const plural = hop.games === 1 ? 'game' : 'games'
  if (hop._tag === 'PlayedAgainst') {
    return `${from} → ${to}: ${hop.games} ${plural} against, first game ${hop.gameId} (${date})`
  }
  const team = yield* names.team(hop.from, hop.teamId)
  const kind = hop._tag === 'GoaliePartners' ? ', goalie partners' : ''
  return `${from} → ${to}: ${hop.games} ${plural}, ${team} ${seasonLabel(hop.seasonId)} ${competitionLabel(hop.gameType)}${kind}, game ${hop.gameId} (${date})`
})

const finalsLine = (names: Names, year: FinalsYear) => Effect.gen(function* () {
  if (year._tag === 'Miss') return `${year.year}: no teammate in the Final`
  const who = yield* names.name(year.playerId)
  return `${year.year}: ${who} (Final game ${year.finalGameId}, shared game ${year.sharedGameId})`
})

const COMMANDS = ['path', 'player', 'link', 'opponents', 'farthest', 'finals']

const program = (argv: ReadonlyArray<string>) => Effect.gen(function* () {
  const parsed = yield* Effect.try({
    try: () => parseArgs({
      args: [...argv],
      allowPositionals: true,
      options: {
        db: { type: 'string' }, regular: { type: 'boolean' }, playoff: { type: 'boolean' },
        'from-season': { type: 'string' }, 'to-season': { type: 'string' }, 'no-partners': { type: 'boolean' },
        relation: { type: 'string' }, limit: { type: 'string' }, from: { type: 'string' }, to: { type: 'string' },
      },
    }),
    // foreign: parseArgs throws its own errors for unknown flags
    catch: () => new UsageError({ message: `Bad arguments.\n${USAGE}` }),
  })
  const { values, positionals } = parsed
  const [command, ...args] = positionals
  if (command === undefined) return yield* new UsageError({ message: USAGE })
  if (!COMMANDS.includes(command)) return yield* new UsageError({ message: `Unknown command "${command}".\n${USAGE}` })
  const arity = command === 'path' || command === 'link' ? 2 : 1
  if (args.length !== arity) return yield* new UsageError({ message: `${command} takes ${arity} player argument(s).\n${USAGE}` })
  if (values.regular === true && values.playoff === true) {
    return yield* new UsageError({ message: 'Use only one of --regular and --playoff.' })
  }
  const relation: Relation = yield* Match.value(values.relation ?? 'with').pipe(
    Match.when('with', () => Effect.succeed<Relation>('with')),
    Match.when('against', () => Effect.succeed<Relation>('against')),
    Match.when('either', () => Effect.succeed<Relation>('either')),
    Match.orElse(() => Effect.fail(new UsageError({ message: '--relation must be with, against, or either.' }))),
  )
  const fromSeason = values['from-season'] === undefined ? null : yield* parseCount('--from-season', values['from-season'], 0)
  const toSeason = values['to-season'] === undefined ? null : yield* parseCount('--to-season', values['to-season'], 0)
  const filter: Filter = {
    ...DEFAULT_FILTER,
    competition: values.regular === true ? 'regular' : values.playoff === true ? 'playoff' : 'all',
    fromSeason, toSeason, goaliePartners: values['no-partners'] !== true,
  }

  // A one-shot command: the store stays open until the process exits.
  const store = yield* openHistoryStore(values.db ?? defaultDb())
  const graph = makeGraph(store.graph.arrays)
  const names = makeNames(store)
  const [a, b] = yield* Effect.forEach(args, (text) => resolve(store, text))

  switch (command) {
    case 'path': {
      const limit = yield* parseCount('--limit', values.limit, 1)
      const found = findPaths(graph, a.playerId, b.playerId, filter, relation, Math.min(Math.max(limit, 1), 10))
      if (Result.isFailure(found)) {
        if (found.failure._tag === 'NoPath') return yield* new NoChain({ from: a.name, to: b.name })
        return yield* found.failure
      }
      const filled = yield* fillOpponentHops(store, found.success)
      const out: Array<string> = [
        `${filled.distance} hop(s); ${filled.pathCount}${filled.pathCountCapped ? '+' : ''} shortest chain(s).`,
      ]
      for (const [index, path] of filled.paths.entries()) {
        if (filled.paths.length > 1) out.push(`Chain ${index + 1}:`)
        for (const hop of path) out.push(yield* hopLine(names, hop))
      }
      return out
    }
    case 'player': {
      const { player, stints } = yield* store.player(a.playerId)
      const out = [
        describePlayer(player),
        `${player.games} games, ${player.points} points, ${player.teammates} teammates.`,
      ]
      for (const s of stints) {
        out.push(`  ${seasonLabel(s.seasonId)} ${competitionLabel(s.gameType)}: ${s.teamAbbrev} (${s.teamName}), ${s.games} games`)
      }
      return out
    }
    case 'link': {
      const result = link(graph, a.playerId, b.playerId, filter)
      if (Result.isFailure(result)) return yield* result.failure
      const { spans, totalGames, evidenceGameId, opposedGames } = result.success
      if (spans.length === 0) {
        return [`${a.name} and ${b.name}: not teammates with these filters; ${opposedGames} games against each other.`]
      }
      const out = [
        `${a.name} and ${b.name}: ${totalGames} games together, ${opposedGames} against; evidence game ${evidenceGameId}.`,
      ]
      for (const span of spans) {
        const team = yield* names.team(a.playerId, span.teamId)
        const kind = span.link === 'GoaliePartners' ? ', goalie partners' : ''
        out.push(`  ${team} ${seasonLabel(span.seasonId)} ${competitionLabel(span.gameType)}: ${span.games} games${kind}, first game ${span.firstGameId}`)
      }
      return out
    }
    case 'opponents': {
      const limit = yield* parseCount('--limit', values.limit, 20)
      const found = opponents(graph, a.playerId)
      if (Result.isFailure(found)) return yield* found.failure
      const out = [`${a.name}: ${found.success.length} opponents.`]
      for (const o of found.success.slice(0, limit)) {
        out.push(`  ${yield* names.name(o.playerId)}: ${o.games} games`)
      }
      return out
    }
    case 'farthest': {
      const found = farthest(graph, a.playerId, filter)
      if (Result.isFailure(found)) return yield* found.failure
      const { distance, atDistance, reachable, unreachable, example } = found.success
      const out = [
        `${a.name}: farthest teammate chain is ${distance} hop(s), ${atDistance} player(s) at that distance; ${reachable} reachable, ${unreachable} not.`,
      ]
      for (const hop of example) out.push(yield* hopLine(names, hop))
      return out
    }
    default: {
      const fromYear = yield* parseCount('--from', values.from, 1980)
      const toYear = yield* parseCount('--to', values.to, 2026)
      const years = yield* finalsCoverage(graph, store, a.playerId, fromYear, toYear)
      const out = [`${a.name}: Cup Finals ${fromYear}-${toYear}.`]
      for (const year of years) out.push(yield* finalsLine(names, year))
      return out
    }
  }
})

const fail = (message: string) => Effect.sync(() => {
  process.stderr.write(`${message}\n`)
  process.exitCode = 1
})

const run = (argv: ReadonlyArray<string>) => program(argv).pipe(
  Effect.flatMap((lines) => Effect.sync(() => { process.stdout.write(`${lines.join('\n')}\n`) })),
  Effect.catchTags({
    UsageError: (e) => fail(e.message),
    NoMatch: (e) => fail(`No player matches "${e.query}".`),
    AmbiguousName: (e) => fail(`"${e.query}" matches several players; use an ID:\n${e.candidates.map((c) => `  ${c}`).join('\n')}`),
    NoChain: (e) => fail(`No chain between ${e.from} and ${e.to} with these filters.`),
    HistoryUnavailable: (e) => fail(`History unavailable: ${e.message}`),
    UnknownPlayer: (e) => fail(`Unknown player ${e.playerId}.`),
    NoPath: () => fail('No chain between these players with these filters.'),
    UnsupportedFilter: (e) => fail(`--relation ${e.relation} supports no competition, season, or partner flags.`),
  }),
)

await Effect.runPromise(run(process.argv.slice(2)))
