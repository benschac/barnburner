import { Result, Schema } from 'effect'
import { EgoTables, LeagueTables } from '@nhl-reddit-stats/viz/contracts'
import type { BenchData } from '@nhl-reddit-stats/viz/contracts'

// The pure parts of the speed harness: the fixed script, and the frame-rate arithmetic.

/** One scripted gesture. A pan moves the view by (dx, dy) pixels; a zoom scales it by `factor`. */
export type BenchStep =
  | { readonly _tag: 'pan'; readonly atMs: number; readonly dx: number; readonly dy: number }
  | { readonly _tag: 'zoom'; readonly atMs: number; readonly factor: number }

export const scriptMs = 10_000
const stepEveryMs = 50

/**
 * The fixed ten-second script: a step every 50 ms. Each second is one of five phases, repeated twice:
 * pan right, zoom in, pan down-left, zoom out, pan back up. Zoom steps pair up so the view ends where it began.
 */
export function benchScript(): ReadonlyArray<BenchStep> {
  const steps: BenchStep[] = []
  const perSecond = 1000 / stepEveryMs
  for (let index = 0; index < scriptMs / stepEveryMs; index += 1) {
    const atMs = index * stepEveryMs
    const phase = Math.floor(index / perSecond) % 5
    switch (phase) {
      case 0: steps.push({ _tag: 'pan', atMs, dx: 12, dy: 0 }); break
      case 1: steps.push({ _tag: 'zoom', atMs, factor: 1.04 }); break
      case 2: steps.push({ _tag: 'pan', atMs, dx: -8, dy: 8 }); break
      case 3: steps.push({ _tag: 'zoom', atMs, factor: 1 / 1.04 }); break
      default: steps.push({ _tag: 'pan', atMs, dx: -4, dy: -8 })
    }
  }
  return steps
}

/** The steps with `fromMs <= atMs < toMs`, in order. */
export function stepsDue(script: ReadonlyArray<BenchStep>, fromMs: number, toMs: number): ReadonlyArray<BenchStep> {
  return script.filter((step) => step.atMs >= fromMs && step.atMs < toMs)
}

/** The median of a list; 0 for an empty list. */
export function median(values: ReadonlyArray<number>): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

/** The worst (lowest) of a list of frame rates; 0 for an empty list. */
export function worst(rates: ReadonlyArray<number>): number {
  return rates.length === 0 ? 0 : Math.min(...rates)
}

/** The frame rate of each frame, from the times (ms) at which frames were drawn. Equal times are skipped. */
export function frameRates(times: ReadonlyArray<number>): ReadonlyArray<number> {
  const rates: number[] = []
  for (let index = 1; index < times.length; index += 1) {
    const gap = times[index] - times[index - 1]
    if (gap > 0) rates.push(1000 / gap)
  }
  return rates
}

export type BenchSummary = {
  readonly frames: number
  readonly medianFps: number
  readonly worstFps: number
}

export function summarize(times: ReadonlyArray<number>): BenchSummary {
  const rates = frameRates(times)
  return { frames: times.length, medianFps: median(rates), worstFps: worst(rates) }
}

// -- loading a dataset from a file ----------------------------------------------------------------

export class BenchFileError extends Schema.TaggedError<BenchFileError, { readonly brand: unique symbol }>()('BenchFileError', {
  message: Schema.String,
}) {}

type Tabled = {
  readonly players: ReadonlyArray<{ readonly playerId: number; readonly name: string; readonly games: number }>
  readonly links: ReadonlyArray<{ readonly a: number; readonly b: number; readonly games: number }>
}

/** Players become nodes and links become links. Plain loops: the league file has 478,383 links. */
export function benchDataFromTables(tables: Tabled): BenchData {
  const nodes: BenchData['nodes'][number][] = []
  for (const player of tables.players) nodes.push({ playerId: player.playerId, name: player.name, games: player.games })
  const links: BenchData['links'][number][] = []
  for (const link of tables.links) links.push({ a: link.a, b: link.b, games: link.games })
  return { nodes, links }
}

const ExportFile = (tables: typeof EgoTables | typeof LeagueTables) => Schema.Struct({ tables })
const decodeEgoFile = Schema.decodeUnknownResult(ExportFile(EgoTables))
const decodeLeagueFile = Schema.decodeUnknownResult(ExportFile(LeagueTables))
const BenchFile = Schema.Struct({
  nodes: Schema.Array(Schema.Struct({ playerId: Schema.Int, name: Schema.String, games: Schema.Finite })),
  links: Schema.Array(Schema.Struct({ a: Schema.Int, b: Schema.Int, games: Schema.Finite })),
})
const decodeBenchFile = Schema.decodeUnknownResult(BenchFile)
const decodeJson = Schema.decodeUnknownResult(Schema.fromJsonString(Schema.Unknown))

/**
 * Reads file text: an exported `ego` or `league` file (`{ tables, notes }`) or `{ nodes, links }`.
 * The text is parsed once, then tried against each shape in turn.
 */
export function decodeBenchText(text: string): Result.Result<BenchData, BenchFileError> {
  const parsed = decodeJson(text)
  if (Result.isFailure(parsed)) return Result.fail(new BenchFileError({ message: `not JSON: ${parsed.failure.message}` }))
  const value = parsed.success
  const ego = decodeEgoFile(value)
  if (Result.isSuccess(ego)) return Result.succeed(benchDataFromTables(ego.success.tables))
  const league = decodeLeagueFile(value)
  if (Result.isSuccess(league)) return Result.succeed(benchDataFromTables(league.success.tables))
  const plain = decodeBenchFile(value)
  if (Result.isSuccess(plain)) return Result.succeed(plain.success)
  return Result.fail(new BenchFileError({ message: 'expected an exported ego or league file, or { nodes, links }' }))
}
