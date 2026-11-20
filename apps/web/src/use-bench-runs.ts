import { Effect } from 'effect'
import type { BenchData, BenchRenderer, VizTheme } from '@nhl-reddit-stats/viz/contracts'
import { loadRenderer, readBenchFile, runBench } from './viz/bench/harness.ts'

// The bench page's boundary to Effect: the page needs promises, so the runs end here.
const benchRuns = {
  readFile: (file: { readonly name: string; text(): Promise<string> }) => Effect.runPromise(Effect.result(readBenchFile(file))),
  run: (
    id: string,
    load: () => Promise<{ readonly default: BenchRenderer }>,
    data: BenchData,
    theme: VizTheme,
    element: HTMLElement,
  ) =>
    Effect.runPromise(Effect.result(
      loadRenderer(id, load).pipe(Effect.flatMap((loaded) => runBench(loaded, data, theme, element))),
    )),
}

export const useBenchRuns = () => benchRuns
