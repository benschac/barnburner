import { useCallback } from 'react'
import { Effect } from 'effect'
import type { BenchData, BenchRenderer, VizTheme } from '@nhl-reddit-stats/viz/contracts'
import { loadRenderer, readBenchFile, runBench } from './viz/bench/harness.ts'

type BenchFile = { readonly name: string; text(): Promise<string> }

/** The bench page's boundary to Effect: the page needs promises, so each run ends inside a callback of this hook. */
export function useBenchRuns() {
  const readFile = useCallback((file: BenchFile) => Effect.runPromise(Effect.result(readBenchFile(file))), [])
  const run = useCallback(
    (
      id: string,
      load: () => Promise<{ readonly default: BenchRenderer }>,
      data: BenchData,
      theme: VizTheme,
      element: HTMLElement,
    ) =>
      Effect.runPromise(Effect.result(
        loadRenderer(id, load).pipe(Effect.flatMap((loaded) => runBench(loaded, data, theme, element))),
      )),
    [],
  )
  return { readFile, run }
}
