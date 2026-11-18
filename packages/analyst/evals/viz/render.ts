// Render harness: opens the lab's sandbox entry in Chrome, submits a view module and its tables through the
// page's own controls, waits for the frame to settle, samples the frame rate, and takes a screenshot of the frame (plan
// section C-viz, card FE1). The page lists the decoded reports of the current render in `frame-reports`.

import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Effect, Option, Schema } from 'effect'
import { chromium } from 'playwright'
import type { Page } from 'playwright'
import { FrameReport, ViewData } from '@nhl-reddit-stats/viz'
import type { Tables } from '@nhl-reddit-stats/viz'

export class RenderHarnessError extends Schema.TaggedError<RenderHarnessError, { readonly brand: unique symbol }>()(
  'RenderHarnessError',
  {
    stage: Schema.Literals(['launch', 'open', 'submit', 'wait', 'screenshot']),
    reason: Schema.String,
  },
) {
  override get message(): string {
    return `render harness failed at ${this.stage}: ${this.reason}`
  }
}

export type RenderViewInput = {
  /** Where the web app is served, on `http://localhost`: Chrome blocks a blank or 127.0.0.1 page from framing localhost. */
  readonly baseUrl: string
  /** The view module: the body of one ES module with a default export. */
  readonly code: string
  readonly tables: Tables
  /** What each table is; the page's view data holds it beside the tables. Default empty. */
  readonly notes?: string
  /** How long to sample `FrameRate` after the first paint. Default 10000. */
  readonly sampleMs?: number
  /** How long to wait for `Rendered` or `Failed` after Run. Default 20000. */
  readonly settleTimeoutMs?: number
  /** The sandbox entry's path. Default `/viz-lab/sandbox`. */
  readonly path?: string
  /** Where the screenshot goes. Default: a new file in a fresh temporary directory. */
  readonly screenshotPath?: string
}

export type RenderViewResult = {
  readonly outcome: 'Rendered' | 'Failed'
  /** The frame's own `Rendered.ms`; for a `Failed` outcome, the time from Run to the failure. */
  readonly firstPaintMs: number
  /** Median of the `FrameRate` samples; 0 when there were none. */
  readonly medianFps: number
  readonly screenshotPath: string
  /** The `message` of the frame's `Failed` report; null when the outcome is `Rendered`. */
  readonly failureMessage: string | null
}

const median = (values: ReadonlyArray<number>): number => {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 1 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2
}

const harness = (stage: RenderHarnessError['stage']) => (cause: unknown) =>
  new RenderHarnessError({ stage, reason: cause instanceof Error ? cause.message : String(cause) })

const step = <A>(stage: RenderHarnessError['stage'], run: () => Promise<A>) =>
  Effect.tryPromise({ try: run, catch: harness(stage) })

const decodeReports = Schema.decodeUnknownOption(Schema.fromJsonString(Schema.Array(FrameReport)))
const encodeViewData = Schema.encodeSync(Schema.fromJsonString(ViewData))

const readReports = (page: Page) =>
  step('wait', async () => {
    const text = await page.getByTestId('frame-reports').textContent()
    return Option.getOrElse(decodeReports(text ?? '[]'), () => [])
  })

/**
 * Opens the sandbox, submits `code` and `tables`, and reports how the view did. A view that throws is a
 * `Failed` outcome, not an error; an error means the harness itself could not do its job.
 */
export const renderView = (input: RenderViewInput): Effect.Effect<RenderViewResult, RenderHarnessError> =>
  Effect.acquireUseRelease(
    step('launch', () => chromium.launch({ channel: 'chrome', headless: true })),
    (browser) => Effect.gen(function* () {
      const settleTimeout = input.settleTimeoutMs ?? 20_000
      const sampleMs = input.sampleMs ?? 10_000
      const page = yield* step('open', async () => {
        const opened = await browser.newPage({ viewport: { width: 1280, height: 900 } })
        await opened.goto(new URL(input.path ?? '/viz-lab/sandbox', input.baseUrl).toString(), { waitUntil: 'load' })
        await opened.getByLabel('View module').waitFor({ timeout: settleTimeout })
        return opened
      })
      // The page draws its starter first. Its reports are cleared by Run, which starts a new render.
      yield* step('submit', async () => {
        await page.getByLabel('View module').fill(input.code)
        await page.getByLabel('View data').fill(encodeViewData({ tables: input.tables, notes: input.notes ?? '' }))
        await page.getByRole('button', { name: 'Run' }).click()
      })
      const clickedAt = Date.now()
      const alert = page.getByRole('alert')
      const settled = yield* Effect.gen(function* () {
        while (Date.now() - clickedAt < settleTimeout) {
          // Next.js keeps an empty route announcer with role "alert"; only one with text is the page's complaint.
          const complaint = (yield* step('wait', () => alert.allTextContents())).find((text) => text.trim() !== '')
          if (complaint !== undefined) return yield* new RenderHarnessError({ stage: 'submit', reason: complaint })
          const found = (yield* readReports(page)).find((report) => report._tag === 'Rendered' || report._tag === 'Failed')
          if (found !== undefined) return found
          yield* Effect.sleep(100)
        }
        return yield* new RenderHarnessError({ stage: 'wait', reason: `no Rendered or Failed within ${settleTimeout} ms` })
      })
      const outcome = settled._tag === 'Rendered' ? 'Rendered' : 'Failed'
      const firstPaintMs = settled._tag === 'Rendered' ? settled.ms : Date.now() - clickedAt
      let medianFps = 0
      if (settled._tag === 'Rendered') {
        yield* Effect.sleep(sampleMs)
        const reports = yield* readReports(page)
        medianFps = median(reports.flatMap((report) => report._tag === 'FrameRate' && report.id === settled.id ? [report.fps] : []))
      }
      const screenshotPath = input.screenshotPath ?? join(yield* step('screenshot', () => mkdtemp(join(tmpdir(), 'render-view-'))), 'view.png')
      yield* step('screenshot', () => page.locator('iframe[title="Visualization"]').screenshot({ path: screenshotPath }))
      const failureMessage = settled._tag === 'Failed' ? settled.message : null
      return { outcome, firstPaintMs, medianFps, screenshotPath, failureMessage } satisfies RenderViewResult
    }),
    (browser) => Effect.promise(() => browser.close()),
  )
