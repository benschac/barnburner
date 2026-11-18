import type { BenchData, BenchRenderer, VizTheme } from '@nhl-reddit-stats/viz/contracts'
import { Effect, Match, Schema } from 'effect'
import { benchScript, scriptMs, stepsDue, summarize } from './stats.ts'
import type { BenchStep } from './stats.ts'

export class BenchRunError extends Schema.TaggedError<BenchRunError, { readonly brand: unique symbol }>()('BenchRunError', {
  renderer: Schema.String,
  stage: Schema.Literals(['mount', 'drive']),
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

const nextFrame = () => new Promise<number>((resolve) => requestAnimationFrame(resolve))

/** Runs the ten-second script, drawing a frame at a time; resolves the times (ms from the start) of each frame. */
async function drive(handle: { pan(dx: number, dy: number): void; zoom(factor: number): void }): Promise<ReadonlyArray<number>> {
  const script = benchScript()
  const apply = (step: BenchStep) =>
    Match.valueTags(step, {
      pan: ({ dx, dy }) => handle.pan(dx, dy),
      zoom: ({ factor }) => handle.zoom(factor),
    })
  const origin = await nextFrame()
  const times: number[] = [0]
  let last = 0
  for (;;) {
    const now = (await nextFrame()) - origin
    for (const step of stepsDue(script, last, now)) apply(step)
    last = now
    times.push(now)
    if (now >= scriptMs) return times
  }
}

/**
 * Contract: a renderer's `mount` resolves only once its layout has settled, so the time `mount`
 * takes is the settle time. The harness has no other signal; it does not poll the renderer.
 *
 * Mounts one renderer on `root` (which needs a size), times the mount, drives the fixed script,
 * and destroys the renderer. `mount` resolving is taken as "the layout has settled".
 */
export const runBench = (
  renderer: BenchRenderer,
  data: BenchData,
  theme: VizTheme,
  root: HTMLElement,
): Effect.Effect<BenchResult, BenchRunError> =>
  Effect.gen(function* () {
    const fail = (stage: 'mount' | 'drive') => (cause: unknown) =>
      new BenchRunError({ renderer: renderer.name, stage, message: messageOf(cause) })
    const started = performance.now()
    const handle = yield* Effect.tryPromise({ try: () => renderer.mount(root, data, theme), catch: fail('mount') })
    const settleMs = performance.now() - started
    const times = yield* Effect.tryPromise({ try: () => drive(handle), catch: fail('drive') }).pipe(
      Effect.ensuring(Effect.sync(() => handle.destroy())),
    )
    return { renderer: renderer.name, nodes: data.nodes.length, links: data.links.length, settleMs, ...summarize(times) }
  })
