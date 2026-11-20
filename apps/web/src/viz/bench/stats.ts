import { EgoTables, LeagueTables } from "@nhl-reddit-stats/viz/contracts";
import type { BenchData } from "@nhl-reddit-stats/viz/contracts";
import { Array as Arr, Order, Result, Schema } from "effect";

// The pure parts of the speed harness: the fixed script, and the frame-rate arithmetic.

/**
 * One scripted gesture, active from `fromMs` to `toMs`. Motion is a rate, so every animation frame
 * moves the camera by the time since the last frame: a pan by (dxPerSecond, dyPerSecond) pixels a second,
 * a zoom by `factorPerSecond` a second.
 */
const PanStep = Schema.TaggedStruct("pan", {
  fromMs: Schema.Finite,
  toMs: Schema.Finite,
  dxPerSecond: Schema.Finite,
  dyPerSecond: Schema.Finite,
});
const ZoomStep = Schema.TaggedStruct("zoom", {
  fromMs: Schema.Finite,
  toMs: Schema.Finite,
  factorPerSecond: Schema.Finite,
});
const BenchStepSchema = Schema.Union([PanStep, ZoomStep]);
export type BenchStep = typeof BenchStepSchema.Type;

export const scriptMs = 10_000;
const phaseMs = 1000;

/**
 * The fixed ten-second script: five one-second phases, repeated twice: pan right, zoom in,
 * pan down-left, zoom out, pan back up. The zooms pair up so the view ends at the scale it began.
 */
export function benchScript(): readonly BenchStep[] {
  const steps: BenchStep[] = [];
  for (let index = 0; index < scriptMs / phaseMs; index += 1) {
    const fromMs = index * phaseMs;
    const toMs = fromMs + phaseMs;
    switch (index % 5) {
      case 0: {
        steps.push(
          PanStep.make({ fromMs, toMs, dxPerSecond: 240, dyPerSecond: 0 })
        );
        break;
      }
      case 1: {
        steps.push(ZoomStep.make({ fromMs, toMs, factorPerSecond: 2 }));
        break;
      }
      case 2: {
        steps.push(
          PanStep.make({ fromMs, toMs, dxPerSecond: -160, dyPerSecond: 160 })
        );
        break;
      }
      case 3: {
        steps.push(ZoomStep.make({ fromMs, toMs, factorPerSecond: 0.5 }));
        break;
      }
      default: {
        steps.push(
          PanStep.make({ fromMs, toMs, dxPerSecond: -80, dyPerSecond: -160 })
        );
      }
    }
  }
  return steps;
}

/** Each step active in `[fromMs, toMs)`, with how many milliseconds of it fall in the window. */
export function overlaps(
  script: readonly BenchStep[],
  fromMs: number,
  toMs: number
): readonly { readonly step: BenchStep; readonly ms: number }[] {
  const found: { readonly step: BenchStep; readonly ms: number }[] = [];
  for (const step of script) {
    const ms = Math.min(toMs, step.toMs) - Math.max(fromMs, step.fromMs);
    if (ms > 0) found.push({ step, ms });
  }
  return found;
}

/** The median of a list; 0 for an empty list. */
export function median(values: readonly number[]): number {
  if (values.length === 0) return 0;
  const sorted = Arr.sort(values, Order.Number);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

/** The worst (lowest) of a list of frame rates; 0 for an empty list. */
export function worst(rates: readonly number[]): number {
  return rates.length === 0 ? 0 : Math.min(...rates);
}

/** The frame rate of each frame, from the times (ms) at which frames were drawn. Equal times are skipped. */
export function frameRates(times: readonly number[]): readonly number[] {
  const rates: number[] = [];
  for (let index = 1; index < times.length; index += 1) {
    const gap = times[index] - times[index - 1];
    if (gap > 0) rates.push(1000 / gap);
  }
  return rates;
}

export type BenchSummary = {
  readonly frames: number;
  readonly medianFps: number;
  readonly worstFps: number;
};

export function summarize(times: readonly number[]): BenchSummary {
  const rates = frameRates(times);
  return {
    frames: times.length,
    medianFps: median(rates),
    worstFps: worst(rates),
  };
}

// -- loading a dataset from a file ----------------------------------------------------------------

export class BenchFileError extends Schema.TaggedError<
  BenchFileError,
  { readonly brand: unique symbol }
>()("BenchFileError", {
  message: Schema.String,
}) {}

type Tabled = {
  readonly players: readonly {
    readonly playerId: number;
    readonly name: string;
    readonly games: number;
  }[];
  readonly links: readonly {
    readonly a: number;
    readonly b: number;
    readonly games: number;
  }[];
};

/** Rejects negative or non-finite games, repeated players, and links to a player that is not a node. */
export function validateBench(
  data: BenchData
): Result.Result<BenchData, BenchFileError> {
  const reject = (message: string) =>
    Result.fail(new BenchFileError({ message }));
  const ids = new Set<number>();
  for (const node of data.nodes) {
    if (!Number.isFinite(node.games) || node.games < 0)
      return reject(`player ${node.playerId} has games ${node.games}`);
    if (ids.has(node.playerId))
      return reject(`player ${node.playerId} appears twice`);
    ids.add(node.playerId);
  }
  for (const link of data.links) {
    if (!Number.isFinite(link.games) || link.games < 0)
      return reject(`link ${link.a}-${link.b} has games ${link.games}`);
    if (!ids.has(link.a) || !ids.has(link.b))
      return reject(
        `link ${link.a}-${link.b} names a player that is not in nodes`
      );
  }
  return Result.succeed(data);
}

/** Players become nodes and links become links. Plain loops: the league file has 478,383 links. */
export function benchDataFromTables(tables: Tabled): BenchData {
  const nodes: BenchData["nodes"][number][] = [];
  for (const player of tables.players)
    nodes.push({
      playerId: player.playerId,
      name: player.name,
      games: player.games,
    });
  const links: BenchData["links"][number][] = [];
  for (const link of tables.links)
    links.push({ a: link.a, b: link.b, games: link.games });
  return { nodes, links };
}

const ExportFile = (tables: typeof EgoTables | typeof LeagueTables) =>
  Schema.Struct({ tables });
const decodeEgoFile = Schema.decodeUnknownResult(ExportFile(EgoTables));
const decodeLeagueFile = Schema.decodeUnknownResult(ExportFile(LeagueTables));
const BenchFile = Schema.Struct({
  nodes: Schema.Array(
    Schema.Struct({
      playerId: Schema.Int,
      name: Schema.String,
      games: Schema.Finite,
    })
  ),
  links: Schema.Array(
    Schema.Struct({ a: Schema.Int, b: Schema.Int, games: Schema.Finite })
  ),
});
const decodeBenchFile = Schema.decodeUnknownResult(BenchFile);
const decodeJson = Schema.decodeUnknownResult(
  Schema.fromJsonString(Schema.Unknown)
);

/**
 * Reads file text: an exported `ego` or `league` file (`{ tables, notes }`) or `{ nodes, links }`.
 * The text is parsed once, then tried against each shape in turn.
 */
export function decodeBenchText(
  text: string
): Result.Result<BenchData, BenchFileError> {
  const parsed = decodeJson(text);
  if (Result.isFailure(parsed))
    return Result.fail(
      new BenchFileError({ message: `not JSON: ${parsed.failure.message}` })
    );
  const value = parsed.success;
  const ego = decodeEgoFile(value);
  if (Result.isSuccess(ego))
    return validateBench(benchDataFromTables(ego.success.tables));
  const league = decodeLeagueFile(value);
  if (Result.isSuccess(league))
    return validateBench(benchDataFromTables(league.success.tables));
  const plain = decodeBenchFile(value);
  if (Result.isSuccess(plain)) return validateBench(plain.success);
  return Result.fail(
    new BenchFileError({
      message: "expected an exported ego or league file, or { nodes, links }",
    })
  );
}
