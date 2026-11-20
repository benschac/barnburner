import type { BenchData, BenchRenderer, VizTheme } from '@nhl-reddit-stats/viz/contracts'
import { Effect, Match, Result, Schema } from 'effect'
import { benchScript, decodeBenchText, overlaps, scriptMs, summarize, BenchFileError } from './stats.ts'

export class BenchRunError extends Schema.TaggedError<BenchRunError, { readonly brand: unique symbol }>()('BenchRunError', {
  renderer: Schema.String,
  stage: Schema.Literals(['load', 'mount', 'drive', 'destroy']),
  message: Schema.String,
}) {}

export type BenchResult = {
  readonly renderer: string
  readonly nodes: number
  readonly links: number
  /** Milliseconds from the start of `mount` until it resolved: the layout has settled by then. */
  readonly settleMs: number
  readonly frames: number
  readonly medianFps: number
  readonly worstFps: number
}

const messageOf = (cause: unknown) => (cause instanceof globalThis.Error ? cause.message : String(cause))

type Camera = { pan(dx: number, dy: number): void; zoom(factor: number): void }

/**
 * Runs the ten-second script. Every animation frame moves the camera by the time since the previous
 * frame, so each measured frame needs a new image. A run is discarded if the tab is hidden at any point,
 * because the browser pauses animation callbacks and the gap would count as a frame.
 * Resolves the time (ms from the first frame) of each frame.
 */
function drive(handle: Camera): Effect.Effect<ReadonlyArray<number>, string> {
  const script = benchScript()
  return Effect.callback<ReadonlyArray<number>, string>((resume) => {
    const hiddenMessage = 'the tab was hidden during the run; the run is discarded'
    let done = false
    let origin: number | undefined
    let last = 0
    let frame = 0
    const times: number[] = []
    const onVisibility = () => {
      if (document.visibilityState !== 'hidden' || done) return
      done = true
      document.removeEventListener('visibilitychange', onVisibility)
      resume(Effect.fail(hiddenMessage))
    }
    const tick = (timestamp: number) => {
      if (done) return
      origin ??= timestamp
      const now = timestamp - origin
      for (const { step, ms } of overlaps(script, last, now)) {
        Match.valueTags(step, {
          pan: (pan) => handle.pan((pan.dxPerSecond * ms) / 1000, (pan.dyPerSecond * ms) / 1000),
          zoom: (zoom) => handle.zoom(zoom.factorPerSecond ** (ms / 1000)),
        })
      }
      last = now
      times.push(now)
      if (now >= scriptMs) {
        done = true
        document.removeEventListener('visibilitychange', onVisibility)
        resume(Effect.succeed(times))
      } else {
        frame = requestAnimationFrame(tick)
      }
    }
    if (document.visibilityState === 'hidden') {
      resume(Effect.fail(hiddenMessage))
      return
    }
    document.addEventListener('visibilitychange', onVisibility)
    frame = requestAnimationFrame(tick)
    return Effect.sync(() => {
      done = true
      cancelAnimationFrame(frame)
      document.removeEventListener('visibilitychange', onVisibility)
    })
  })
}

/** Imports one renderer's module. `load` is the lazy import of its file. */
export const loadRenderer = (
  id: string,
  load: () => Promise<{ readonly default: BenchRenderer }>,
): Effect.Effect<BenchRenderer, BenchRunError> =>
  Effect.tryPromise({
    try: async () => (await load()).default,
    catch: (cause) => new BenchRunError({ renderer: id, stage: 'load', message: messageOf(cause) }),
  })

/** Reads a chosen file and decodes it; a read failure names the file. */
export const readBenchFile = (file: { readonly name: string; text(): Promise<string> }): Effect.Effect<BenchData, BenchFileError> =>
  Effect.tryPromise({
    try: () => file.text(),
    catch: (cause) => new BenchFileError({ message: `could not read ${file.name}: ${messageOf(cause)}` }),
  }).pipe(
    Effect.flatMap((text) => {
      const decoded = decodeBenchText(text)
      return Result.isSuccess(decoded)
        ? Effect.succeed(decoded.success)
        : Effect.fail(new BenchFileError({ message: `${file.name}: ${decoded.failure.message}` }))
    }),
  )

/**
 * Contract: a renderer's `mount` resolves only once its layout has settled, so the time `mount`
 * takes is the settle time. The harness has no other signal; it does not poll the renderer.
 *
 * Mounts one renderer on `root` (which needs a size), times the mount, drives the fixed script,
 * and destroys the renderer. A failure in `destroy` is reported too.
 */
export const runBench = (
  renderer: BenchRenderer,
  data: BenchData,
  theme: VizTheme,
  root: HTMLElement,
): Effect.Effect<BenchResult, BenchRunError> =>
  Effect.gen(function* () {
    const fail = (stage: 'mount' | 'drive' | 'destroy') => (cause: unknown) =>
      new BenchRunError({ renderer: renderer.name, stage, message: messageOf(cause) })
    const started = performance.now()
    const handle = yield* Effect.tryPromise({ try: () => renderer.mount(root, data, theme), catch: fail('mount') })
    const settleMs = performance.now() - started
    const driven = yield* Effect.result(drive(handle).pipe(Effect.mapError(fail('drive'))))
    const cleaned = yield* Effect.result(Effect.try({ try: () => handle.destroy(), catch: fail('destroy') }))
    if (Result.isFailure(driven)) return yield* driven.failure
    if (Result.isFailure(cleaned)) return yield* cleaned.failure
    return { renderer: renderer.name, nodes: data.nodes.length, links: data.links.length, settleMs, ...summarize(driven.success) }
  })
