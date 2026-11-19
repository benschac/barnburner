// Render harness: opens the lab's sandbox entry in Chrome, submits a view module and its tables through the
// page's own controls, waits for the frame to settle, samples the frame rate, and takes a screenshot of the frame (plan
// section C-viz, card FE1). The page lists the decoded reports of the current render in `frame-reports`.

import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Effect, Exit, Match, Option, Schema } from 'effect'
import { chromium } from 'playwright'
import type { Browser, Page } from 'playwright'
import { FrameReport, ViewData } from '@nhl-reddit-stats/viz'
import type { Tables } from '@nhl-reddit-stats/viz'

export class RenderHarnessError extends Schema.TaggedError<RenderHarnessError, { readonly brand: unique symbol }>()(
  'RenderHarnessError',
  {
    stage: Schema.Literals(['launch', 'open', 'submit', 'wait', 'screenshot', 'close']),
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
  /** The browser channel. Default `chrome`; `null` uses the Chromium that `playwright install chromium` provides. */
  readonly channel?: string | null
  /** Where the screenshot goes. Default: a new file in a fresh temporary directory. */
  readonly screenshotPath?: string
}

export type RenderViewResult = {
  readonly outcome: 'Rendered' | 'Failed'
  /** The frame's own `Rendered.ms`, also for a view that painted and then failed; when it never painted, the time from Run to its `Failed`. */
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

type Settling = Extract<FrameReport, { readonly _tag: 'Rendered' | 'Failed' }>

// Each report variant says what it means to the harness, so a new variant in the protocol fails to compile here.
const settling = (report: FrameReport): Option.Option<Settling> => Match.valueTags(report, {
  Ready: () => Option.none(),
  Rendered: (rendered) => Option.some(rendered),
  Failed: (failed) => Option.some(failed),
  FrameRate: () => Option.none(),
})

const frameRates = (report: FrameReport): ReadonlyArray<{ readonly id: string; readonly fps: number }> => Match.valueTags(report, {
  Ready: () => [],
  Rendered: () => [],
  Failed: () => [],
  FrameRate: ({ id, fps }) => [{ id, fps }],
})

const failureOf = (report: FrameReport, id: string): ReadonlyArray<string> => Match.valueTags(report, {
  Ready: () => [],
  Rendered: () => [],
  Failed: (failed) => failed.id === id ? [failed.message] : [],
  FrameRate: () => [],
})

const decodeReports = Schema.decodeUnknownOption(Schema.fromJsonString(Schema.Array(FrameReport)))
const encodeViewData = Schema.encodeSync(Schema.fromJsonString(ViewData))

const EMPTY = '[]'

// The page rewrites `frame-reports` as reports arrive and clears it only once the submitted frame has said Ready,
// so right after Run it can still hold the starter's reports, under the same render id. This observer keeps every
// text the element has held, in order, so the harness can tell the clear from the stale text.
const watchReports = (page: Page) =>
  page.evaluate(() => {
    const element = document.querySelector('[data-testid="frame-reports"]')
    const seen: string[] = [element?.textContent ?? '[]']
    Object.defineProperty(window, '__reportTexts', { value: seen })
    new MutationObserver(() => { seen.push(element?.textContent ?? '[]') }).observe(element ?? document, { subtree: true, childList: true, characterData: true })
  })

const readTexts = (page: Page) =>
  step('wait', () => page.evaluate(() => {
    const texts: unknown = Object.getOwnPropertyDescriptor(window, '__reportTexts')?.value
    return Array.isArray(texts) ? texts.map(String) : []
  }))

/**
 * The reports of the submitted run: those the element holds after the page cleared it, or all of them when it was
 * already empty at Run. Empty until the run has begun.
 */
const reportsSince = (texts: ReadonlyArray<string>, before: number): ReadonlyArray<FrameReport> => {
  const stale = texts[before - 1] !== EMPTY
  const fresh = texts.slice(before)
  if (fresh.length === 0) return []
  if (stale && !fresh.includes(EMPTY)) return []
  const latest = texts.at(-1) ?? EMPTY
  return Option.getOrElse(decodeReports(latest), () => [])
}

const closeBrowser = (browser: Browser) => step('close', () => browser.close())

/**
 * Opens the sandbox, submits `code` and `tables`, and reports how the view did. A view that throws, before or
 * after its first paint, is a `Failed` outcome, not an error; an error means the harness itself could not do its job.
 */
export const renderView = (input: RenderViewInput): Effect.Effect<RenderViewResult, RenderHarnessError> =>
  Effect.acquireUseRelease(
    step('launch', () => chromium.launch({ headless: true, ...(input.channel === null ? {} : { channel: input.channel ?? 'chrome' }) })),
    (browser) => Effect.gen(function* () {
      const result = yield* Effect.exit(run(browser, input))
      const closed = yield* Effect.exit(closeBrowser(browser))
      // An earlier failure of the harness wins over a failure to close.
      const value = yield* result
      if (Exit.isFailure(closed)) return yield* Effect.failCause(closed.cause)
      return value
    }),
    (browser) => Effect.ignore(closeBrowser(browser)),
  )

const run = (browser: Browser, input: RenderViewInput) => Effect.gen(function* () {
  const settleTimeout = input.settleTimeoutMs ?? 20_000
  const sampleMs = input.sampleMs ?? 10_000
  const page = yield* step('open', async () => {
    const opened = await browser.newPage({ viewport: { width: 1280, height: 900 } })
    await opened.goto(new URL(input.path ?? '/viz-lab/sandbox', input.baseUrl).toString(), { waitUntil: 'load', timeout: settleTimeout })
    await opened.getByLabel('View module').waitFor({ timeout: settleTimeout })
    await opened.getByTestId('frame-reports').waitFor({ state: 'attached', timeout: settleTimeout })
    await watchReports(opened)
    return opened
  })
  const before = (yield* readTexts(page)).length
  yield* step('submit', async () => {
    await page.getByLabel('View module').fill(input.code, { timeout: settleTimeout })
    await page.getByLabel('View data').fill(encodeViewData({ tables: input.tables, notes: input.notes ?? '' }), { timeout: settleTimeout })
    await page.getByRole('button', { name: 'Run' }).click({ timeout: settleTimeout })
  })
  const clickedAt = Date.now()
  const alert = page.getByRole('alert')
  const settled = yield* Effect.gen(function* () {
    while (Date.now() - clickedAt < settleTimeout) {
      // Next.js keeps an empty route announcer with role "alert"; only one with text is the page's complaint.
      const complaint = (yield* step('wait', () => alert.allTextContents())).find((text) => text.trim() !== '')
      if (complaint !== undefined) return yield* new RenderHarnessError({ stage: 'submit', reason: complaint })
      const found = reportsSince(yield* readTexts(page), before).flatMap((report) => Option.toArray(settling(report)))[0]
      if (found !== undefined) return found
      yield* Effect.sleep(100)
    }
    return yield* new RenderHarnessError({ stage: 'wait', reason: `no Rendered or Failed within ${settleTimeout} ms` })
  })
  let reports: ReadonlyArray<FrameReport> = []
  if (settled._tag === 'Rendered') {
    yield* Effect.sleep(sampleMs)
    reports = reportsSince(yield* readTexts(page), before)
  }
  // A view can paint and then fail in a callback; the frame reports that as a Failed for the same render.
  const lateFailure = reports.flatMap((report) => failureOf(report, settled.id))[0]
  const failureMessage = settled._tag === 'Failed' ? settled.message : lateFailure ?? null
  const outcome = failureMessage === null ? 'Rendered' : 'Failed'
  // A view that painted and then failed keeps the paint time the frame reported.
  const firstPaintMs = settled._tag === 'Rendered' ? settled.ms : Date.now() - clickedAt
  const medianFps = outcome === 'Rendered'
    ? median(reports.flatMap((report) => frameRates(report)).filter((rate) => rate.id === settled.id).map((rate) => rate.fps))
    : 0
  const screenshotPath = input.screenshotPath ?? join(yield* step('screenshot', () => mkdtemp(join(tmpdir(), 'render-view-'))), 'view.png')
  yield* step('screenshot', () => page.locator('iframe[title="Visualization"]').screenshot({ path: screenshotPath, timeout: settleTimeout }))
  return { outcome, firstPaintMs, medianFps, screenshotPath, failureMessage } satisfies RenderViewResult
})
