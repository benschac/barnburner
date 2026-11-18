import { existsSync, mkdirSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { NodeServices } from '@effect/platform-node'
import { Console, Effect, Option, Schema } from 'effect'
import { Argument, CliError, Command, Flag } from 'effect/cli'
import { HistoryUnavailable, makeGraph } from '@nhl-reddit-stats/history'
import type { HistoryStore, PlayerRow } from '@nhl-reddit-stats/history'
import { chain } from '@nhl-reddit-stats/viz/tables/chain'
import { ego } from '@nhl-reddit-stats/viz/tables/ego'
import { finals } from '@nhl-reddit-stats/viz/tables/finals'
import { league } from '@nhl-reddit-stats/viz/tables/league'
import { opponents } from '@nhl-reddit-stats/viz/tables/opponents'
import { pair } from '@nhl-reddit-stats/viz/tables/pair'
import { ViewData } from '@nhl-reddit-stats/viz'
import { openHistoryStore } from '../src/history-store.ts'

// Export one visualisation `Tables` file (the builder's { tables, notes }) as JSON into data/history/viz/.
//
//   node scripts/history-viz-tables.ts [--db <file>] [--out <dir>] <command> ...   (--help lists commands)
//
// Names resolve as in history-query: a name matching several players lists them and exits non-zero.

class NoMatch extends Schema.TaggedError<NoMatch, { readonly brand: unique symbol }>()('NoMatch', {
  query: Schema.String,
}) {}
class AmbiguousName extends Schema.TaggedError<AmbiguousName, { readonly brand: unique symbol }>()('AmbiguousName', {
  query: Schema.String,
  candidates: Schema.Array(Schema.String),
}) {}

class WriteFailed extends Schema.TaggedError<WriteFailed, { readonly brand: unique symbol }>()('WriteFailed', {
  path: Schema.String,
  reason: Schema.String,
}) {}

const rootFile = (relative: string) => fileURLToPath(new URL(`../../../${relative}`, import.meta.url))

const defaultDb = (): string => {
  const fromEnv = process.env.HISTORY_DB
  if (fromEnv !== undefined && fromEnv !== '') return fromEnv
  const candidates = [rootFile('apps/web/history-data/nhl-serve.sqlite'), rootFile('data/history/nhl-serve.sqlite')]
  return candidates.find((candidate) => existsSync(candidate)) ?? candidates[0]
}

// Ambiguity is judged on every match, so the list names every player the user might mean.
const ALL_MATCHES = 1_000_000

const foldName = (name: string): string => name.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()

const seasonLabel = (seasonId: number): string => {
  const start = Math.floor(seasonId / 10000)
  return `${start}–${String(start + 1).slice(-2)}`
}

const describePlayer = (p: PlayerRow): string =>
  `${p.name} (id ${p.playerId}, ${p.position}, ${seasonLabel(p.firstSeason)} to ${seasonLabel(p.lastSeason)})`

const resolve = (store: HistoryStore, text: string): Effect.Effect<PlayerRow, HistoryUnavailable | NoMatch | AmbiguousName> =>
  Effect.gen(function* () {
    if (/^\d+$/.test(text)) {
      const { player } = yield* store.player(Number(text)).pipe(
        Effect.catchTag('UnknownPlayer', () => Effect.fail(new NoMatch({ query: text }))),
      )
      return player
    }
    const found = yield* store.searchPlayers(text, ALL_MATCHES)
    const folded = foldName(text.trim())
    const exact = found.filter((p) => foldName(p.name) === folded)
    const pool = exact.length > 0 ? exact : found
    if (pool.length === 0) return yield* new NoMatch({ query: text })
    if (pool.length > 1) return yield* new AmbiguousName({ query: text, candidates: pool.map(describePlayer) })
    return pool[0]
  })

// The one JSON boundary: a Schema codec, so a result missing `notes` or a table cannot be written.
const encodeView = Schema.encodeSync(Schema.fromJsonString(ViewData, { space: 2 }))

const player = (name: string) =>
  Argument.String(name).pipe(Argument.withDescription('A player name (accent-folded) or numeric ID.'))

const year = (name: string, fallback: number, description: string) =>
  Flag.Int(name).pipe(Flag.withDefault(fallback), Flag.withDescription(description))

const root = Command.make('history-viz-tables').pipe(
  Command.withSharedFlags({
    db: Flag.String('db').pipe(Flag.optional, Flag.withDescription('Serving file; defaults to $HISTORY_DB or the local build.')),
    out: Flag.String('out').pipe(Flag.optional, Flag.withDescription('Output directory; defaults to data/history/viz.')),
  }),
  Command.withDescription('Export visualisation tables from the NHL history serving file.'),
)

const session = Effect.gen(function* () {
  const { db, out } = yield* root
  const store = yield* openHistoryStore(Option.getOrElse(db, defaultDb))
  return { store, graph: makeGraph(store.graph.arrays), out: Option.getOrElse(out, () => rootFile('data/history/viz')) }
})

const message = (cause: unknown): string => (cause instanceof Error ? cause.message : String(cause))

// Writes to a temporary sibling and renames it into place, so a failed write leaves no partial export.
const emit = (dir: string, name: string, value: ViewData) => {
  const path = join(dir, `${name}.json`)
  const temporary = `${path}.tmp-${process.pid}`
  return Effect.try({
    try: () => {
      const text = `${encodeView(value)}\n`
      mkdirSync(dir, { recursive: true })
      try {
        writeFileSync(temporary, text)
        renameSync(temporary, path)
      } finally {
        rmSync(temporary, { force: true })
      }
    },
    // foreign: filesystem and encoding exceptions are translated here.
    catch: (cause) => new WriteFailed({ path, reason: message(cause) }),
  }).pipe(Effect.andThen(Console.log(path)))
}

const chainCommand = Command.make('chain', { a: player('a'), b: player('b') }, (config) => Effect.gen(function* () {
  const { store, graph, out } = yield* session
  const a = yield* resolve(store, config.a)
  const b = yield* resolve(store, config.b)
  yield* emit(out, `chain-${a.playerId}-${b.playerId}`, yield* chain(graph, store, a.playerId, b.playerId))
})).pipe(Command.withDescription('Shortest teammate chains from a to b.'))

const pairCommand = Command.make('pair', { a: player('a'), b: player('b') }, (config) => Effect.gen(function* () {
  const { store, graph, out } = yield* session
  const a = yield* resolve(store, config.a)
  const b = yield* resolve(store, config.b)
  yield* emit(out, `pair-${a.playerId}-${b.playerId}`, yield* pair(graph, store, a.playerId, b.playerId))
})).pipe(Command.withDescription('How two players are linked.'))

const egoCommand = Command.make('ego', { name: player('name') }, (config) => Effect.gen(function* () {
  const { store, graph, out } = yield* session
  const a = yield* resolve(store, config.name)
  yield* emit(out, `ego-${a.playerId}`, yield* ego(graph, store, a.playerId))
})).pipe(Command.withDescription("A player's teammate neighbourhood."))

const leagueCommand = Command.make('league', {}, () => Effect.gen(function* () {
  const { store, graph, out } = yield* session
  yield* emit(out, 'league', yield* league(graph, store))
})).pipe(Command.withDescription('The whole league.'))

const opponentsCommand = Command.make('opponents', { a: player('a'), b: player('b') }, (config) => Effect.gen(function* () {
  const { store, graph, out } = yield* session
  const a = yield* resolve(store, config.a)
  const b = yield* resolve(store, config.b)
  yield* emit(out, `opponents-${a.playerId}-${b.playerId}`, yield* opponents(graph, store, a.playerId, b.playerId))
})).pipe(Command.withDescription('Most-faced opponents of two players.'))

const finalsCommand = Command.make('finals', {
  from: year('from', 1980, 'First Final year (default 1980).'),
  to: year('to', 2026, 'Last Final year (default 2026).'),
  name: player('name'),
}, (config) => Effect.gen(function* () {
  const { store, graph, out } = yield* session
  const a = yield* resolve(store, config.name)
  yield* emit(out, `finals-${a.playerId}-${config.from}-${config.to}`, yield* finals(graph, store, a.playerId, config.from, config.to))
})).pipe(Command.withDescription('Stanley Cup Finals coverage through teammates.'))

const app = root.pipe(
  Command.withSubcommands([chainCommand, pairCommand, egoCommand, leagueCommand, opponentsCommand, finalsCommand]),
)

const fail = (message: string) => Effect.sync(() => {
  process.stderr.write(`${message}\n`)
  process.exitCode = 1
})

const run = Command.run(app, { version: '0.0.0' }).pipe(
  Effect.catchTags({
    NoMatch: (e) => fail(`No player matches "${e.query}".`),
    AmbiguousName: (e) => fail(`"${e.query}" matches several players; use an ID:\n${e.candidates.map((c) => `  ${c}`).join('\n')}`),
    HistoryUnavailable: (e) => fail(`History unavailable: ${e.message}`),
    WriteFailed: (e) => fail(`Could not write ${e.path}: ${e.reason}`),
    UnknownPlayer: (e) => fail(`Unknown player ${e.playerId}.`),
    NoPath: () => fail('No chain between these players.'),
    UnsupportedFilter: () => fail('Unsupported filter.'),
    SelfPair: () => fail('Pick two different players.'),
  }),
  // effect/cli has already printed parse errors and help; only the exit code is left.
  Effect.catchIf(CliError.isCliError, () => Effect.sync(() => { process.exitCode = 1 })),
  Effect.provide(NodeServices.layer),
)

await Effect.runPromise(run)
