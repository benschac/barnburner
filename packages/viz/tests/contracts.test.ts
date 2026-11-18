import assert from 'node:assert/strict'
import { test } from 'node:test'
import { Schema } from 'effect'
import {
  ChainTables, EgoLinkRow, EgoTables, FinalsTables, FinalsRow, FrameMessage, FrameReport, HostMessage, LeagueLinkRow, LeagueTables, OpponentsTables, PairSummaryRow, PairTables, Row, Tables,
  ViewData, VizTheme,
} from '../src/contracts.ts'
import type { BenchRenderer, LabEntry, Tables as TablesType, ViewModule } from '../src/contracts.ts'
import {
  chainSample, egoSample, finalsSample, leagueSample, opponentsSample, pairSample, samples,
} from '../src/samples.ts'

const roundTrip = <T, E>(schema: Schema.Codec<T, E>, value: T): void => {
  const decoded = Schema.decodeUnknownSync(schema)(Schema.encodeSync(schema)(value))
  assert.deepEqual(decoded, value)
}

// A light theme, values from the light block of apps/web/design/contract.json.
const theme: VizTheme = {
  mode: 'light',
  background: '#ffffff',
  color: '#252525',
  muted: '#626262',
  gold: '#756331',
  win: '#408638',
  loss: '#b32238',
  pending: '#d2d2d2',
  rule: '#d6d6d6',
  surface: '#f1f1f1',
  highlight: '#f8dce0',
  brand: '#b52c35',
  bright: '#161616',
  chartWin: '#408638',
  chartLoss: '#b32238',
  chartPositive: '#d5e8cf',
  chartNegative: '#f4d2d8',
  chartLine: '#252525',
  series: ['#d5e8cf', '#f4d2d8', '#756331', '#b52c35', '#408638', '#b32238', '#626262'],
  fonts: { body: 'sans-serif', score: 'monospace' },
}

test('Row, Tables, and ViewData round-trip, and Row refuses a nested value', () => {
  roundTrip(Row, { name: 'Player Eleven', games: 3, firstGameId: null })
  roundTrip(Tables, { players: [{ playerId: 11, name: 'Player Eleven' }], empty: [] })
  roundTrip(ViewData, { tables: { players: [{ playerId: 11 }] }, notes: 'players: One row per player.' })
  assert.throws(() => Schema.decodeUnknownSync(Row)({ games: [3] }))
  assert.throws(() => Schema.decodeUnknownSync(Row)({ games: true }))
})

test('VizTheme round-trips', () => {
  roundTrip(VizTheme, theme)
  roundTrip(VizTheme, { ...theme, mode: 'dark' })
  assert.deepEqual(theme.series, [
    theme.chartPositive, theme.chartNegative, theme.gold, theme.brand, theme.chartWin, theme.chartLoss, theme.muted,
  ])
})

test('every frame message round-trips and is told apart by its tag', () => {
  const messages: ReadonlyArray<FrameMessage> = [
    { _tag: 'Render', id: 'v1', code: 'export default () => () => {}', tables: samples.league.tables, theme },
    { _tag: 'Dispose', id: 'v1' },
    { _tag: 'Ready', versions: { G2: '5.4.8', G6: '5.1.1' } },
    { _tag: 'Rendered', id: 'v1', ms: 42.5 },
    { _tag: 'Failed', id: 'v1', message: 'boom' },
    { _tag: 'FrameRate', id: 'v1', fps: 59.9 },
  ]
  for (const message of messages) roundTrip(FrameMessage, message)
  assert.deepEqual(messages.map((m) => m._tag), ['Render', 'Dispose', 'Ready', 'Rendered', 'Failed', 'FrameRate'])
  assert.throws(() => Schema.decodeUnknownSync(FrameMessage)({ _tag: 'Nope', id: 'v1' }))
  assert.throws(() => Schema.decodeSync(FrameMessage)({ _tag: 'Rendered', id: 'v1', ms: -1 }))
})

test('the view, lab, and bench types accept the shapes the plan gives them', () => {
  const view: ViewModule = { default: () => () => {} }
  const entry: LabEntry<string> = { title: 'hello', render: () => 'hello' }
  const renderer: BenchRenderer = {
    name: 'none',
    mount: () => Promise.resolve({ pan: () => {}, zoom: () => {}, destroy: () => {} }),
  }
  assert.equal(typeof view.default, 'function')
  assert.equal(entry.render(), 'hello')
  assert.equal(renderer.name, 'none')
  // A table set's rows are assignable to `Tables`, so a sample can be handed to a view as it is.
  const asTables: TablesType = samples.chain.tables
  assert.ok(asTables.hops !== undefined)
  // The league and ego samples feed a bench renderer directly.
  const data = { nodes: leagueSample.tables.players, links: leagueSample.tables.links }
  assert.equal(data.nodes.length, 10)
})

test('each sample decodes, and its notes name every table', () => {
  const sets = [
    [ChainTables, chainSample],
    [PairTables, pairSample],
    [EgoTables, egoSample],
    [LeagueTables, leagueSample],
    [OpponentsTables, opponentsSample],
    [FinalsTables, finalsSample],
  ] as const
  for (const [schema, sample] of sets) {
    roundTrip(schema as Schema.Codec<unknown, unknown>, sample.tables)
    Schema.decodeSync(ViewData)(sample)
    for (const table of Object.keys(sample.tables)) assert.ok(sample.notes.includes(table + ':'), table)
  }
})

// Every ID a row holds must have a `players` row, and every team ID a `teams` row.
const playerIds = (table: ReadonlyArray<{ readonly playerId: number }>): Set<number> => new Set(table.map((p) => p.playerId))
const teamIds = (table: ReadonlyArray<{ readonly teamId: number }>): Set<number> => new Set(table.map((t) => t.teamId))
const assertKnown = (label: string, known: Set<number>, ids: ReadonlyArray<number | null>): void => {
  for (const id of ids) if (id !== null) assert.ok(known.has(id), label + ': ' + String(id))
}

test('every player and team ID in a row has a players or teams row', () => {
  const chain = chainSample.tables
  assertKnown('chain hops', playerIds(chain.players), chain.hops.flatMap((h) => [h.from, h.to]))
  assertKnown('chain summary', playerIds(chain.players), chain.summary.flatMap((s) => [s.from, s.to]))
  assertKnown('chain teams', teamIds(chain.teams), chain.hops.map((h) => h.teamId))

  const pair = pairSample.tables
  assertKnown('pair summary', playerIds(pair.players), pair.summary.flatMap((s) => [s.a, s.b]))
  assertKnown('pair teams', teamIds(pair.teams), pair.spans.map((s) => s.teamId))

  const ego = egoSample.tables
  assertKnown('ego focus', playerIds(ego.players), ego.focus.map((f) => f.playerId))
  assertKnown('ego links', playerIds(ego.players), ego.links.flatMap((l) => [l.a, l.b]))

  const league = leagueSample.tables
  assertKnown('league links', playerIds(league.players), league.links.flatMap((l) => [l.a, l.b]))

  const opponents = opponentsSample.tables
  assertKnown('opponents faced', playerIds(opponents.players), opponents.faced.flatMap((f) => [f.focus, f.opponent]))

  const finals = finalsSample.tables
  assertKnown('finals', playerIds(finals.players), finals.finals.map((f) => f.playerId))

  // The reverse holds too: a players row is never an orphan the view cannot reach.
  const reached = (table: ReadonlyArray<{ readonly playerId: number }>, ids: ReadonlyArray<number | null>): void => {
    for (const p of table) assert.ok(ids.includes(p.playerId), 'unused player ' + String(p.playerId))
  }
  reached(chain.players, chain.hops.flatMap((h) => [h.from, h.to]))
  reached(pair.players, pair.summary.flatMap((s) => [s.a, s.b]))
  reached(ego.players, ego.links.flatMap((l) => [l.a, l.b]))
  reached(league.players, league.links.flatMap((l) => [l.a, l.b]))
  reached(finals.players, finals.finals.map((f) => f.playerId))
})

test('every a is below b', () => {
  for (const s of pairSample.tables.summary) assert.ok(s.a < s.b)
  for (const l of egoSample.tables.links) assert.ok(l.a < l.b)
  for (const l of leagueSample.tables.links) assert.ok(l.a < l.b)
  // Links are listed once each, in order.
  const keys = leagueSample.tables.links.map((l) => l.a * 100 + l.b)
  assert.deepEqual(keys, [...new Set(keys)].sort((x, y) => x - y))
})

test('chain hops are in D6 order, from 0, and join up', () => {
  const { hops, summary } = chainSample.tables
  const [{ from, to, distance, pathCount }] = summary
  const chains = new Map<number, Array<(typeof hops)[number]>>()
  for (const hop of hops) chains.set(hop.chain, [...(chains.get(hop.chain) ?? []), hop])
  assert.deepEqual([...chains.keys()], Array.from({ length: chains.size }, (_, i) => i))
  assert.equal(chains.size, Math.min(pathCount, 10))
  // Rows are listed chain by chain, step by step.
  assert.deepEqual(hops.map((h) => [h.chain, h.step]), [...hops].map((h) => [h.chain, h.step]).sort((x, y) => x[0] - y[0] || x[1] - y[1]))
  for (const steps of chains.values()) {
    assert.deepEqual(steps.map((h) => h.step), Array.from({ length: distance }, (_, i) => i))
    assert.equal(steps[0].from, from)
    assert.equal(steps[steps.length - 1].to, to)
    steps.slice(1).forEach((h, i) => assert.equal(h.from, steps[i].to))
  }
  // D6: compare two chains hop by hop; more games first, then the lower player ID.
  const ordered = [...chains.values()]
  for (let i = 1; i < ordered.length; i += 1) {
    const before = ordered[i - 1]
    const after = ordered[i]
    const at = before.findIndex((h, k) => h.games !== after[k].games || h.to !== after[k].to)
    assert.ok(at >= 0, 'two chains are identical')
    const [x, y] = [before[at], after[at]]
    assert.ok(x.games > y.games || (x.games === y.games && x.to < y.to), 'chain ' + String(i) + ' precedes chain ' + String(i - 1))
  }
  // The first chain is 11-12-14, then 11-13-14.
  assert.deepEqual(ordered.map((steps) => [steps[0].from, ...steps.map((h) => h.to)]), [[11, 12, 14], [11, 13, 14]])
})

test('the samples agree with the shared test league on its headline numbers', () => {
  assert.equal(leagueSample.tables.players.length, 10)
  assert.equal(leagueSample.tables.links.length, 9)
  assert.equal(leagueSample.tables.players.some((p) => p.playerId === 21), false)
  // Teammate counts match the links: each link adds one to both ends.
  for (const p of leagueSample.tables.players) {
    const degree = leagueSample.tables.links.filter((l) => l.a === p.playerId || l.b === p.playerId).length
    assert.equal(p.teammates, degree, String(p.playerId))
  }
  // Ego games with the focus match the league's links to the focus.
  for (const p of egoSample.tables.players) {
    const total = leagueSample.tables.links
      .filter((l) => (l.a === 14 && l.b === p.playerId) || (l.b === 14 && l.a === p.playerId))
      .reduce((sum, l) => sum + l.games, 0)
    assert.equal(p.gamesWithFocus, total, String(p.playerId))
  }
  // Opponent lists are most games first, then lower ID, within each focus.
  for (const focus of [16, 12]) {
    const rows = opponentsSample.tables.faced.filter((f) => f.focus === focus)
    for (let i = 1; i < rows.length; i += 1) {
      assert.ok(rows[i - 1].games > rows[i].games || (rows[i - 1].games === rows[i].games && rows[i - 1].opponent < rows[i].opponent))
    }
  }
  assert.deepEqual(opponentsSample.tables.faced.filter((f) => f.focus === 16).map((f) => f.opponent), [14, 12, 11, 15, 13])
})

test('a link or pair row with a >= b is refused', () => {
  const ego = { a: 12, b: 14, games: 2, firstSeason: 19511952, lastSeason: 19511952 }
  const league = { a: 12, b: 14, games: 2, firstSeason: 19511952 }
  const pair = { a: 15, b: 16, totalGames: 2, opposedGames: 2 }
  roundTrip(EgoLinkRow, ego)
  roundTrip(LeagueLinkRow, league)
  roundTrip(PairSummaryRow, pair)
  for (const [a, b] of [[14, 12], [14, 14]]) {
    assert.throws(() => Schema.decodeSync(EgoLinkRow)({ ...ego, a, b }))
    assert.throws(() => Schema.decodeSync(LeagueLinkRow)({ ...league, a, b }))
    assert.throws(() => Schema.decodeSync(PairSummaryRow)({ ...pair, a, b }))
  }
})

test('a finals row is all set when covered and all null when not', () => {
  const hit = { year: 1952, seasonId: 19511952, covered: 1, playerId: 14, finalGameId: 1951030111, sharedGameId: 1951020001 } as const
  const miss = { year: 1953, seasonId: 19521953, covered: 0, playerId: null, finalGameId: null, sharedGameId: null } as const
  roundTrip(FinalsRow, hit)
  roundTrip(FinalsRow, miss)
  assert.throws(() => Schema.decodeSync(FinalsRow)({ ...hit, finalGameId: null }))
  assert.throws(() => Schema.decodeSync(FinalsRow)({ ...hit, playerId: null, finalGameId: null, sharedGameId: null }))
  assert.throws(() => Schema.decodeSync(FinalsRow)({ ...miss, sharedGameId: 1951020001 }))
  assert.throws(() => Schema.decodeSync(FinalsRow)({ ...miss, covered: 1 }))
})

test('series must be the seven colours in order', () => {
  assert.throws(() => Schema.decodeSync(VizTheme)({ ...theme, series: theme.series.slice(0, 6) }))
  assert.throws(() => Schema.decodeSync(VizTheme)({ ...theme, series: [...theme.series, theme.muted] }))
  assert.throws(() => Schema.decodeSync(VizTheme)({ ...theme, series: [...theme.series.slice(2), ...theme.series.slice(0, 2)] }))
  assert.throws(() => Schema.decodeSync(VizTheme)({ ...theme, gold: '#000000' }))
})

test('each message decodes in its own direction and is refused in the other', () => {
  const host: ReadonlyArray<HostMessage> = [
    { _tag: 'Render', id: 'v1', code: 'export default () => () => {}', tables: samples.league.tables, theme },
    { _tag: 'Dispose', id: 'v1' },
  ]
  const report: ReadonlyArray<FrameReport> = [
    { _tag: 'Ready', versions: { G2: '5.4.8' } },
    { _tag: 'Rendered', id: 'v1', ms: 42.5 },
    { _tag: 'Failed', id: 'v1', message: 'boom' },
    { _tag: 'FrameRate', id: 'v1', fps: 59.9 },
  ]
  for (const message of host) {
    roundTrip(HostMessage, message)
    assert.throws(() => Schema.decodeUnknownSync(FrameReport)(Schema.encodeSync(FrameMessage)(message)), message._tag)
  }
  for (const message of report) {
    roundTrip(FrameReport, message)
    assert.throws(() => Schema.decodeUnknownSync(HostMessage)(Schema.encodeSync(FrameMessage)(message)), message._tag)
  }
})
