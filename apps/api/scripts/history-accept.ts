import { readFileSync } from 'node:fs'
import { parseArgs } from 'node:util'
import { Effect, Result, Schema } from 'effect'
import {
  DEFAULT_FILTER, farthest, finalsCoverage, findPaths, link, makeGraph,
} from '@nhl-reddit-stats/history'
import type { Filter, HistoryStore, TeammateGraph } from '@nhl-reddit-stats/history'
import { openHistoryStore } from '../src/history-store.ts'

// Full-snapshot acceptance (plan C-accept). Opens a serving file through the real store, builds the graph
// with the package functions, runs every acceptance case, and compares with the truth file T1 wrote.
//
//   node scripts/history-accept.ts --db <serving file> --truth <truth.json> [--baseline] [--skip-diameter]
//
// `--baseline` demands the pinned baseline numbers exactly. Without it counts may only grow and historical
// answers must not change. Truth parity is always exact. Exit code 1 on any FAIL.

const USAGE = 'Usage: history-accept.ts --db <serving file> --truth <truth.json> [--baseline] [--skip-diameter]'

class UsageError extends Schema.TaggedError<UsageError, { readonly brand: unique symbol }>()('UsageError', {
  message: Schema.String,
}) {}
class TruthUnreadable extends Schema.TaggedError<TruthUnreadable, { readonly brand: unique symbol }>()('TruthUnreadable', {
  path: Schema.String,
  message: Schema.String,
}) {}

// The baseline snapshot's pinned values (plan C-accept). They apply only under `--baseline`.
const BASELINE = {
  players: 8842, sharedPairs: 478383, sharedSpans: 1049918, opponentPairs: 3273864, components: 1, diameter: 9,
  mcdavidTeammates: 174, mcdavidLindsay: 5, mcdavidDraisaitl: 879, johansenJones: 0, jagrTeammates: 518,
  finalsCovered: 45, finalsMissing: [2022] as ReadonlyArray<number>, flaggedFinals: 99,
} as const

const PairAnswer = Schema.Struct({ distance: Schema.NullOr(Schema.Int), chains: Schema.NullOr(Schema.Int) })
const PartnerSpan = Schema.Struct({
  season_id: Schema.Int, game_type: Schema.Int, team_id: Schema.Int, games: Schema.Int, first_game_id: Schema.Int,
})
const PairReport = Schema.Struct({
  shared_games: Schema.Int,
  partner_games: Schema.Int,
  partner_spans: Schema.NullOr(Schema.Array(PartnerSpan)),
})
const OptionalInt = Schema.optionalKey(Schema.NullOr(Schema.Int))

const Truth = Schema.Struct({
  players: Schema.Record(Schema.String, Schema.NullOr(Schema.Int)),
  player_count: Schema.Int,
  shared_game_pairs: Schema.Int,
  shared_game_spans: Schema.Int,
  opponent_pairs: Schema.Int,
  dressed_goalies_available: Schema.Boolean,
  partner_spans: Schema.Int,
  partner_added_pairs: Schema.Int,
  components: Schema.Int,
  components_partners_on: Schema.Int,
  diameter_partners_off: OptionalInt,
  mcdavid_teammates: OptionalInt,
  mcdavid_lindsay_distance: OptionalInt,
  mcdavid_draisaitl_games: OptionalInt,
  johansen_jones_2015_16_shared_games: OptionalInt,
  cleghorn_1918020026: Schema.optionalKey(Schema.NullOr(Schema.Array(
    Schema.Struct({ team_id: Schema.Int, teammate_id: Schema.Int, shared_games: Schema.Int }),
  ))),
  hill_samsonov: Schema.optionalKey(Schema.NullOr(PairReport)),
  ranford_joseph: Schema.optionalKey(Schema.NullOr(PairReport)),
  jagr_teammates: OptionalInt,
  jagr_finals_1980_2026: Schema.optionalKey(Schema.NullOr(Schema.Struct({
    covered_years: Schema.Array(Schema.Int), missing_years: Schema.Array(Schema.Int),
  }))),
  cup_final_seasons: Schema.Struct({
    count: Schema.Int, teams_by_season: Schema.Record(Schema.String, Schema.Array(Schema.Int)),
  }),
  pairs: Schema.Array(Schema.Struct({
    a: Schema.Int, b: Schema.Int, partners_on: PairAnswer, partners_off: PairAnswer,
  })),
})
type Truth = typeof Truth.Type

type Line = { readonly status: 'PASS' | 'FAIL' | 'SKIP'; readonly name: string; readonly detail: string }
type Answer = { readonly distance: number; readonly chains: number }

const PARTNERS_OFF: Filter = { ...DEFAULT_FILTER, goaliePartners: false }
const FINAL_FROM = 1980
const FINAL_TO = 2026
const CLEGHORN_GAME = 1918020026
const CLEGHORN_SEASON = 19181919

const readTruth = (path: string) => Effect.gen(function* () {
  const text = yield* Effect.try({
    try: () => readFileSync(path, 'utf8'),
    // foreign: node:fs throws its own errors
    catch: () => new TruthUnreadable({ path, message: 'The truth file could not be read.' }),
  })
  return yield* Schema.decodeUnknownEffect(Schema.fromJsonString(Truth))(text).pipe(
    Effect.mapError(() => new TruthUnreadable({ path, message: 'The truth file does not match the expected shape.' })),
  )
})

/** The distance and tied-chain count, or null for no path. Other failures stay in the error channel. */
const answerOf = (graph: TeammateGraph, a: number, b: number, filter: Filter) => {
  const found = findPaths(graph, a, b, filter, 'with', 1)
  if (Result.isSuccess(found)) return Effect.succeed<Answer | null>({ distance: found.success.distance, chains: found.success.pathCount })
  if (found.failure._tag === 'NoPath') return Effect.succeed<Answer | null>(null)
  return Effect.fail(found.failure)
}

const describeAnswer = (answer: { readonly distance: number | null; readonly chains: number | null } | null) =>
  answer === null || answer.distance === null ? 'no path' : `${answer.distance} hops, ${answer.chains} chain(s)`

const sameAnswer = (actual: Answer | null, truth: { readonly distance: number | null; readonly chains: number | null }) =>
  actual === null ? truth.distance === null : truth.distance === actual.distance && truth.chains === actual.chains

/** Number of players with a shared-game (span link 0) link to the player at `index`. */
const sharedTeammates = (graph: TeammateGraph, index: number): number => {
  const { offsets, linkIds } = graph.adjacency
  const { spanStart, spanLink } = graph.arrays
  let count = 0
  for (let at = offsets[index]; at < offsets[index + 1]; at += 1) {
    for (let span = spanStart[linkIds[at]]; span < spanStart[linkIds[at] + 1]; span += 1) {
      if (spanLink[span] === 0) {
        count += 1
        break
      }
    }
  }
  return count
}

type LinkCounts = { readonly sharedPairs: number; readonly sharedSpans: number; readonly partnerSpans: number; readonly addedPairs: number }

const countLinks = (graph: TeammateGraph): LinkCounts => {
  const { edgeA, spanStart, spanLink } = graph.arrays
  let sharedPairs = 0
  let sharedSpans = 0
  let partnerSpans = 0
  let addedPairs = 0
  for (let e = 0; e < edgeA.length; e += 1) {
    let shared = 0
    for (let span = spanStart[e]; span < spanStart[e + 1]; span += 1) {
      if (spanLink[span] === 0) shared += 1
      else partnerSpans += 1
    }
    sharedSpans += shared
    if (shared > 0) sharedPairs += 1
    else addedPairs += 1
  }
  return { sharedPairs, sharedSpans, partnerSpans, addedPairs }
}

/** Components by union-find over links; goalie-partner links count only when `partners` is true. */
const componentCount = (graph: TeammateGraph, partners: boolean): number => {
  const { playerIds, edgeA, edgeB, spanStart, spanLink } = graph.arrays
  const parent = Uint32Array.from({ length: playerIds.length }, (_, i) => i)
  const root = (x: number): number => {
    let r = x
    while (parent[r] !== r) r = parent[r]
    let c = x
    while (parent[c] !== r) {
      const next = parent[c]
      parent[c] = r
      c = next
    }
    return r
  }
  let components = playerIds.length
  for (let e = 0; e < edgeA.length; e += 1) {
    let passes = partners
    for (let span = spanStart[e]; span < spanStart[e + 1] && !passes; span += 1) passes = spanLink[span] === 0
    if (!passes) continue
    const a = root(edgeA[e])
    const b = root(edgeB[e])
    if (a !== b) {
      parent[a] = b
      components -= 1
    }
  }
  return components
}

/** Runs `farthest` from every player (partners off). A component of size s is seen s times, so it counts 1/s each. */
const sweepFarthest = (graph: TeammateGraph) => Effect.gen(function* () {
  const sizes = new Map<number, number>()
  let diameter = 0
  for (const playerId of graph.arrays.playerIds) {
    const found = farthest(graph, playerId, PARTNERS_OFF)
    if (Result.isFailure(found)) return yield* found.failure
    const size = found.success.reachable + 1
    sizes.set(size, (sizes.get(size) ?? 0) + 1)
    diameter = Math.max(diameter, found.success.distance)
  }
  let components = 0
  for (const [size, count] of sizes) components += count / size
  return { components, diameter }
})

const mulberry32 = (seed: number) => {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6D2B79F5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const median = (values: ReadonlyArray<number>) => {
  const sorted = values.toSorted((x, y) => x - y)
  return sorted.length === 0 ? 0 : sorted[Math.floor(sorted.length / 2)]
}

const spanKey = (season: number, type: number, team: number, games: number, first: number) =>
  `${season}/${type}/${team}/${games}/${first}`

const evaluate = (store: HistoryStore, graph: TeammateGraph, truth: Truth, baseline: boolean, skipDiameter: boolean) =>
  Effect.gen(function* () {
    const lines: Array<Line> = []
    const push = (status: Line['status'], name: string, detail: string) => { lines.push({ status, name, detail }) }
    const verdict = (name: string, ok: boolean, detail: string) => push(ok ? 'PASS' : 'FAIL', name, detail)
    // A case that needs data the truth file lacks: a failure on the baseline, a skip elsewhere.
    const missing = (name: string, why: string) => push(baseline ? 'FAIL' : 'SKIP', name, baseline ? `missing: ${why}` : `skipped: ${why}`)
    const idOf = (name: string): number | null => truth.players[name] ?? null

    // A count: the baseline demands the pinned value (and the truth); otherwise it may only grow.
    const count = (name: string, actual: number, expected: number, pinned: number) => {
      if (baseline) {
        verdict(name, actual === expected && actual === pinned, `actual ${actual}, truth ${expected}, baseline ${pinned}`)
      } else {
        verdict(name, actual >= expected, `actual ${actual}, truth ${expected} (may only grow)`)
      }
    }
    const exact = (name: string, actual: number, expected: number) =>
      verdict(name, actual === expected, `actual ${actual}, truth ${expected}`)

    const links = countLinks(graph)
    count('players', graph.arrays.playerIds.length, truth.player_count, BASELINE.players)
    count('shared-game pairs', links.sharedPairs, truth.shared_game_pairs, BASELINE.sharedPairs)
    count('shared-game spans', links.sharedSpans, truth.shared_game_spans, BASELINE.sharedSpans)
    count('opponent pairs', graph.arrays.oppA?.length ?? 0, truth.opponent_pairs, BASELINE.opponentPairs)
    exact('goalie-partner spans (truth only)', links.partnerSpans, truth.partner_spans)
    exact('pairs added by goalie partners (truth only)', links.addedPairs, truth.partner_added_pairs)

    exact('components with partners on', componentCount(graph, true), truth.components_partners_on)
    const componentsOff = componentCount(graph, false)
    const componentNote = baseline ? `, baseline ${BASELINE.components}` : ''
    if (skipDiameter) {
      push('SKIP', 'diameter with partners off', 'skipped: --skip-diameter')
      verdict('components with partners off', componentsOff === truth.components && (!baseline || componentsOff === BASELINE.components),
        `actual ${componentsOff}, truth ${truth.components}${componentNote}`)
    } else {
      const sweep = yield* sweepFarthest(graph)
      verdict('components with partners off (farthest from every player)',
        sweep.components === truth.components && sweep.components === componentsOff && (!baseline || sweep.components === BASELINE.components),
        `actual ${sweep.components}, union-find ${componentsOff}, truth ${truth.components}${componentNote}`)
      const expectedDiameter = truth.diameter_partners_off ?? null
      if (expectedDiameter === null) missing('diameter with partners off', 'no diameter in the truth file')
      else {
        verdict('diameter with partners off', sweep.diameter === expectedDiameter && (!baseline || sweep.diameter === BASELINE.diameter),
          `actual ${sweep.diameter}, truth ${expectedDiameter}${baseline ? `, baseline ${BASELINE.diameter}` : ''}`)
      }
    }

    const mcdavid = idOf('Connor McDavid')
    const lindsay = idOf('Ted Lindsay')
    const draisaitl = idOf('Leon Draisaitl')
    const mcdavidIndex = mcdavid === null ? undefined : graph.indexOf.get(mcdavid)
    const truthMcdavid = truth.mcdavid_teammates ?? null
    if (mcdavidIndex === undefined || truthMcdavid === null) missing('McDavid shared-game teammates', 'McDavid is not in the truth file')
    else count('McDavid shared-game teammates', sharedTeammates(graph, mcdavidIndex), truthMcdavid, BASELINE.mcdavidTeammates)

    const truthLindsay = truth.mcdavid_lindsay_distance ?? null
    if (mcdavid === null || lindsay === null || truthLindsay === null) missing('McDavid to Lindsay distance', 'McDavid or Lindsay is not in the truth file')
    else {
      const found = yield* answerOf(graph, mcdavid, lindsay, PARTNERS_OFF)
      const actual = found?.distance ?? null
      const ok = baseline
        ? actual === BASELINE.mcdavidLindsay && actual === truthLindsay
        : actual !== null && actual <= truthLindsay
      verdict('McDavid to Lindsay distance', ok,
        `actual ${actual ?? 'no path'}, truth ${truthLindsay}${baseline ? `, baseline ${BASELINE.mcdavidLindsay}` : ' (must not grow)'}`)
    }

    const truthDraisaitl = truth.mcdavid_draisaitl_games ?? null
    if (mcdavid === null || draisaitl === null || truthDraisaitl === null) missing('McDavid and Draisaitl games together', 'a player is not in the truth file')
    else {
      const together = link(graph, mcdavid, draisaitl, PARTNERS_OFF)
      if (Result.isFailure(together)) return yield* together.failure
      count('McDavid and Draisaitl games together', together.success.totalGames, truthDraisaitl, BASELINE.mcdavidDraisaitl)
    }

    const johansen = idOf('Ryan Johansen')
    const jones = idOf('Seth Jones')
    const truthJohansen = truth.johansen_jones_2015_16_shared_games ?? null
    if (johansen === null || jones === null || truthJohansen === null) missing('Johansen and Jones 2015-16 shared games', 'a player is not in the truth file')
    else {
      const season: Filter = { ...PARTNERS_OFF, fromSeason: 20152016, toSeason: 20152016 }
      const together = link(graph, johansen, jones, season)
      if (Result.isFailure(together)) return yield* together.failure
      const actual = together.success.totalGames
      verdict('Johansen and Jones 2015-16 shared games', actual === truthJohansen && (!baseline || actual === BASELINE.johansenJones),
        `actual ${actual}, truth ${truthJohansen}${baseline ? `, baseline ${BASELINE.johansenJones}` : ''}`)
    }

    const cleghorn = idOf('Sprague Cleghorn')
    const truthCleghorn = truth.cleghorn_1918020026 ?? null
    if (cleghorn === null || truthCleghorn === null) missing('Cleghorn in game 1918020026', 'Cleghorn is not in the truth file')
    else {
      let found = 0
      for (const entry of truthCleghorn) {
        const shared = yield* store.sharedGames(cleghorn, entry.teammate_id, CLEGHORN_SEASON, 2, entry.team_id)
        if (shared.filter((g) => g.gameId === CLEGHORN_GAME).length === entry.shared_games) found += 1
      }
      verdict('Cleghorn in game 1918020026', found === truthCleghorn.length && (!baseline || truthCleghorn.length > 0),
        `${found} of ${truthCleghorn.length} teammates in the game have exactly one shared game`)
    }

    const hill = idOf('Adin Hill')
    const samsonov = idOf('Ilya Samsonov')
    const truthHill = truth.hill_samsonov ?? null
    if (!truth.dressed_goalies_available) push('SKIP', 'Hill and Samsonov goalie partners', 'skipped: no dressed goalies')
    else if (hill === null || samsonov === null || truthHill === null) missing('Hill and Samsonov goalie partners', 'a player is not in the truth file')
    else {
      const together = link(graph, hill, samsonov, DEFAULT_FILTER)
      if (Result.isFailure(together)) return yield* together.failure
      const partner = together.success.spans.filter((s) => s.link === 'GoaliePartners')
      const actualKeys = partner.map((s) => spanKey(s.seasonId, s.gameType, s.teamId, s.games, s.firstGameId)).toSorted()
      const truthKeys = (truthHill.partner_spans ?? [])
        .map((s) => spanKey(s.season_id, s.game_type, s.team_id, s.games, s.first_game_id)).toSorted()
      const { stints } = yield* store.player(hill)
      const vegas = new Set(stints.filter((s) => s.teamAbbrev === 'VGK').map((s) => s.teamId))
      const atVegas = partner.some((s) => s.seasonId === 20242025 && vegas.has(s.teamId))
      const evidence = together.success.evidenceGameId
      verdict('Hill and Samsonov goalie partners', atVegas && evidence !== null && actualKeys.join('|') === truthKeys.join('|'),
        `${partner.length} partner span(s), Vegas 2024-25 ${atVegas ? 'present' : 'missing'}, evidence game ${evidence ?? 'none'}, truth ${truthKeys.length} span(s)`)
    }

    const ranford = idOf('Bill Ranford')
    const joseph = idOf('Curtis Joseph')
    if (ranford === null || joseph === null) push('SKIP', 'Ranford and Joseph (reported)', 'skipped: a player is not in the truth file')
    else {
      const together = link(graph, ranford, joseph, DEFAULT_FILTER)
      if (Result.isFailure(together)) return yield* together.failure
      const truthRanford = truth.ranford_joseph ?? null
      const note = truthRanford === null ? 'no truth entry' : `truth: ${truthRanford.shared_games} shared, ${truthRanford.partner_games} partner games`
      push('PASS', 'Ranford and Joseph (reported)',
        `${together.success.spans.length} span(s), ${together.success.totalGames} games together, ${together.success.opposedGames} against; ${note}`)
    }

    const jagr = idOf('Jaromír Jágr')
    const jagrIndex = jagr === null ? undefined : graph.indexOf.get(jagr)
    const truthJagr = truth.jagr_teammates ?? null
    if (jagrIndex === undefined || truthJagr === null) missing('Jágr shared-game teammates', 'Jágr is not in the truth file')
    else count('Jágr shared-game teammates', sharedTeammates(graph, jagrIndex), truthJagr, BASELINE.jagrTeammates)

    const truthFinals = truth.jagr_finals_1980_2026 ?? null
    if (jagr === null || truthFinals === null) missing('Jágr Finals 1980-2026', 'Jágr is not in the truth file')
    else {
      const years = yield* finalsCoverage(graph, store, jagr, FINAL_FROM, FINAL_TO)
      const covered = years.filter((y) => y._tag === 'Hit').map((y) => y.year)
      const missed = years.filter((y) => y._tag === 'Miss').map((y) => y.year)
      const sameTruth = covered.join(',') === truthFinals.covered_years.join(',') && missed.join(',') === truthFinals.missing_years.join(',')
      const sameBaseline = covered.length === BASELINE.finalsCovered && missed.join(',') === BASELINE.finalsMissing.join(',')
      verdict('Jágr Finals 1980-2026', sameTruth && (!baseline || sameBaseline),
        `${covered.length} of ${years.length} covered, missing ${missed.join(', ') || 'none'}; truth missing ${truthFinals.missing_years.join(', ') || 'none'}`)
    }

    const finals = yield* store.finals(0, 9999)
    const teamsBySeason = new Map(finals.map((f) => [f.seasonId, [...new Set(f.participants.map((p) => p.teamId))].toSorted((x, y) => x - y)] as const))
    const notTwo = [...teamsBySeason].filter(([, teams]) => teams.length !== 2).length
    const differing = Object.entries(truth.cup_final_seasons.teams_by_season).filter(([season, teams]) => {
      const actual = teamsBySeason.get(Number(season))
      return actual === undefined || actual.join(',') !== teams.toSorted((x, y) => x - y).join(',')
    }).length
    const finalsCount = teamsBySeason.size
    const countOk = baseline
      ? finalsCount === BASELINE.flaggedFinals && finalsCount === truth.cup_final_seasons.count
      : finalsCount >= truth.cup_final_seasons.count
    verdict('seasons with a flagged Cup Final', countOk && notTwo === 0 && differing === 0,
      `actual ${finalsCount}, truth ${truth.cup_final_seasons.count}${baseline ? `, baseline ${BASELINE.flaggedFinals}` : ''}; not two teams: ${notTwo}; differing from truth: ${differing}`)

    const mismatches: Array<string> = []
    const badPairs = new Set<number>()
    for (const [index, pair] of truth.pairs.entries()) {
      const on = yield* answerOf(graph, pair.a, pair.b, DEFAULT_FILTER)
      const off = yield* answerOf(graph, pair.a, pair.b, PARTNERS_OFF)
      if (!sameAnswer(on, pair.partners_on)) {
        badPairs.add(index)
        mismatches.push(`${pair.a}-${pair.b} on: ${describeAnswer(on)} vs ${describeAnswer(pair.partners_on)}`)
      }
      if (!sameAnswer(off, pair.partners_off)) {
        badPairs.add(index)
        mismatches.push(`${pair.a}-${pair.b} off: ${describeAnswer(off)} vs ${describeAnswer(pair.partners_off)}`)
      }
    }
    verdict('truth parity', badPairs.size === 0 && truth.pairs.length > 0,
      `${truth.pairs.length - badPairs.size} of ${truth.pairs.length} pairs match, partners on and off${mismatches.length > 0 ? `; first: ${mismatches.slice(0, 3).join('; ')}` : ''}`)
    return lines
  })

const medianFindPaths = (graph: TeammateGraph, calls: number) => {
  const ids = graph.arrays.playerIds
  if (ids.length < 2) return 0
  const random = mulberry32(20240101)
  const pick = () => ids[Math.floor(random() * ids.length)]
  const times: Array<number> = []
  for (let i = 0; i < calls; i += 1) {
    const a = pick()
    const b = pick()
    const start = performance.now()
    findPaths(graph, a, b, DEFAULT_FILTER, 'with', 1)
    times.push(performance.now() - start)
  }
  return median(times)
}

const program = (argv: ReadonlyArray<string>) => Effect.gen(function* () {
  const parsed = yield* Effect.try({
    try: () => parseArgs({
      args: [...argv],
      options: {
        db: { type: 'string' }, truth: { type: 'string' }, baseline: { type: 'boolean' }, 'skip-diameter': { type: 'boolean' },
      },
    }),
    // foreign: parseArgs throws its own errors for unknown flags
    catch: () => new UsageError({ message: `Bad arguments.\n${USAGE}` }),
  })
  const { db, truth: truthPath } = parsed.values
  if (db === undefined || truthPath === undefined) return yield* new UsageError({ message: USAGE })
  const baseline = parsed.values.baseline === true
  const truth = yield* readTruth(truthPath)

  const loadStart = performance.now()
  const store = yield* openHistoryStore(db)
  const graph = makeGraph(store.graph.arrays)
  const loadMs = performance.now() - loadStart

  const lines = yield* evaluate(store, graph, truth, baseline, parsed.values['skip-diameter'] === true)
  const out = lines.map((l) => `${l.status} ${l.name}: ${l.detail}`)
  const failures = lines.filter((l) => l.status === 'FAIL').length
  out.push(`cold load (open + makeGraph): ${loadMs.toFixed(0)} ms`)
  out.push(`median of 1000 findPaths calls: ${medianFindPaths(graph, 1000).toFixed(3)} ms`)
  out.push(failures === 0 ? 'ACCEPTED' : `REJECTED: ${failures} case(s) failed`)
  return { out, failures }
})

const fail = (message: string) => Effect.sync(() => {
  process.stderr.write(`${message}\n`)
  process.exitCode = 1
})

const run = (argv: ReadonlyArray<string>) => program(argv).pipe(
  Effect.flatMap(({ out, failures }) => Effect.sync(() => {
    process.stdout.write(`${out.join('\n')}\n`)
    if (failures > 0) process.exitCode = 1
  })),
  Effect.catchTags({
    UsageError: (e) => fail(e.message),
    TruthUnreadable: (e) => fail(`${e.path}: ${e.message}`),
    HistoryUnavailable: (e) => fail(`History unavailable: ${e.message}`),
    UnknownPlayer: (e) => fail(`Unknown player ${e.playerId}.`),
    NoPath: () => fail('Unexpected NoPath.'),
    UnsupportedFilter: () => fail('Unexpected UnsupportedFilter.'),
  }),
)

await Effect.runPromise(run(process.argv.slice(2)))
