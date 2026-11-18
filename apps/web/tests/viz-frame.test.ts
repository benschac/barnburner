import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createFrame, themeVariables } from '../src/viz/frame/frame.ts'
import type { FrameDeps, FrameErrorEvent, FrameMessageEvent, FrameRejectionEvent, FrameWindow } from '../src/viz/frame/frame.ts'
import type { FrameReport, VizTheme } from '@nhl-reddit-stats/viz'

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
const tables = { players: [{ playerId: 11, name: 'Player Eleven' }] }
const libs = { G2: 'g2', G6: 'g6', d3: 'd3', THREE: 'three' }
const render = (id: string, code = 'view') => ({ _tag: 'Render', id, code, tables, theme })

type Harness = ReturnType<typeof harness>
type Modules = Record<string, unknown>

/** A fake window and root. `modules` maps posted code to the namespace `load` resolves to; other code rejects. */
const harness = (modules: Modules = {}) => {
  const parent = { posted: [] as Array<{ message: FrameReport; targetOrigin: string }>, postMessage(message: unknown, targetOrigin: string) { this.posted.push({ message: message as FrameReport, targetOrigin }) } }
  const listeners = new Set<(event: FrameMessageEvent) => void>()
  const errorListeners = new Set<(event: FrameErrorEvent) => void>()
  const rejectionListeners = new Set<(event: FrameRejectionEvent) => void>()
  const frames = new Map<number, (time: number) => void>()
  let nextFrame = 1
  const win: FrameWindow = {
    parent,
    addEventListener: (type, listener) => {
      if (type === 'message') listeners.add(listener as (event: FrameMessageEvent) => void)
      else if (type === 'error') errorListeners.add(listener as (event: FrameErrorEvent) => void)
      else rejectionListeners.add(listener as (event: FrameRejectionEvent) => void)
    },
    removeEventListener: (type, listener) => {
      if (type === 'message') listeners.delete(listener as (event: FrameMessageEvent) => void)
      else if (type === 'error') errorListeners.delete(listener as (event: FrameErrorEvent) => void)
      else rejectionListeners.delete(listener as (event: FrameRejectionEvent) => void)
    },
    requestAnimationFrame: (callback) => { frames.set(nextFrame, callback); return nextFrame++ },
    cancelAnimationFrame: (handle) => { frames.delete(handle) },
  }
  const variables = new Map<string, string>()
  // `nodes` is what a view has drawn into the root; `replaceChildren` empties it.
  const root = {
    clientWidth: 640, clientHeight: 480, cleared: 0, nodes: 0,
    get childNodes() { return { length: this.nodes } },
    replaceChildren() { this.cleared += 1; this.nodes = 0 },
  }
  const loaded: string[] = []
  let clock = 0
  const deps: FrameDeps = {
    win,
    root: root as unknown as HTMLElement,
    variables: { setProperty: (name, value) => { variables.set(name, value) } },
    libs,
    versions: { g2: '5.4.8' },
    load: (code) => {
      loaded.push(code)
      if (!Object.hasOwn(modules, code)) return Promise.reject(new SyntaxError('Unexpected token'))
      const namespace = modules[code] as { default?: unknown }
      // A view draws a node into the root, except the one posted as 'blank', which draws nothing.
      if (code === 'blank' || typeof namespace.default !== 'function') return Promise.resolve(namespace)
      const entry = namespace.default as (ctx: unknown) => unknown
      return Promise.resolve({ default: (ctx: unknown) => { root.nodes += 1; return entry(ctx) } })
    },
    now: () => clock,
  }
  const stop = createFrame(deps).listen()
  return {
    parent, root, variables, loaded, listeners, errorListeners, rejectionListeners, stop,
    reports: () => parent.posted.map((entry) => entry.message),
    send: (data: unknown, source: unknown = parent) => { for (const listener of [...listeners]) listener({ source, data }) },
    /** Runs the next animation frame callbacks at `time`; the clock moves with it. */
    frame: (time: number) => { clock = time; const due = [...frames.entries()]; frames.clear(); due.forEach(([, callback]) => callback(time)) },
    pendingFrames: () => frames.size,
    error: (event: FrameErrorEvent) => { for (const listener of [...errorListeners]) listener(event) },
    reject: (reason: unknown) => { for (const listener of [...rejectionListeners]) listener({ reason }) },
  }
}
const settle = () => new Promise<void>((resolve) => setImmediate(resolve))
const tags = (h: Harness) => h.reports().map((report) => report._tag)

test('listen posts Ready with the versions to its parent and listens for messages', () => {
  const h = harness()
  assert.deepEqual(h.reports(), [{ _tag: 'Ready', versions: { g2: '5.4.8' } }])
  assert.equal(h.parent.posted[0]?.targetOrigin, '*')
  assert.equal(h.listeners.size, 1)
  assert.equal(h.errorListeners.size, 1)
  assert.equal(h.rejectionListeners.size, 1)
  h.stop()
  assert.equal(h.listeners.size, 0)
  assert.equal(h.errorListeners.size, 0)
  assert.equal(h.rejectionListeners.size, 0)
})

test('a message from any window but the parent is ignored', async () => {
  const h = harness({ view: { default: () => () => undefined } })
  h.send(render('a', 'view'), { postMessage: () => undefined })
  h.send(render('a', 'view'), null)
  await settle()
  assert.deepEqual(h.loaded, [])
  assert.equal(h.pendingFrames(), 0)
})

test('a message that does not decode is ignored', async () => {
  const h = harness({ view: { default: () => () => undefined } })
  for (const data of [
    undefined, null, 'Render', 42, [], {}, { _tag: 'Unknown', id: 'a' },
    { _tag: 'Render', id: 'a' },
    { ...render('a', 'view'), id: 7 },
    { ...render('a', 'view'), theme: { ...theme, series: [] } },
    { ...render('a', 'view'), tables: { players: [{ nested: [1] }] } },
    { _tag: 'Dispose' },
    { _tag: 'Rendered', id: 'a', ms: 1 },
    { _tag: 'Ready', versions: {} },
  ]) h.send(data)
  await settle()
  assert.deepEqual(h.loaded, [])
  assert.deepEqual(tags(h), ['Ready'])
})

test('Render sets the theme variables, runs the module with its context, and reports the first paint', async () => {
  const contexts: unknown[] = []
  let cleaned = 0
  const h = harness({ view: { default: (ctx: unknown) => { contexts.push(ctx); return () => { cleaned += 1 } } } })
  h.send(render('a', 'view'))
  await settle()
  assert.deepEqual(h.loaded, ['view'])
  assert.deepEqual(contexts, [{ root: h.root, tables, theme, size: { width: 640, height: 480 }, libs }])
  assert.equal(h.variables.get('--viz-background'), '#ffffff')
  assert.equal(h.variables.get('--viz-chart-win'), '#408638')
  assert.equal(h.variables.get('--viz-series-6'), '#626262')
  assert.equal(h.variables.get('--viz-font-score'), 'monospace')
  assert.equal(h.variables.get('color-scheme'), 'light')
  h.frame(100)
  assert.deepEqual(tags(h), ['Ready'])
  h.frame(116)
  assert.deepEqual(h.reports().slice(1), [{ _tag: 'Rendered', id: 'a', ms: 116 }])
  assert.equal(cleaned, 0)
})

test('FrameRate is sampled once a second from the frames drawn', async () => {
  const h = harness({ view: { default: () => () => undefined } })
  h.send(render('a', 'view'))
  await settle()
  for (let time = 0; time <= 2020; time += 20) h.frame(time)
  const rates = h.reports().filter((report) => report._tag === 'FrameRate')
  assert.deepEqual(rates, [{ _tag: 'FrameRate', id: 'a', fps: 50 }, { _tag: 'FrameRate', id: 'a', fps: 50 }])
  assert.equal(h.reports().filter((report) => report._tag === 'Rendered').length, 1)
})

test('a module that cannot load, has no default, throws, or returns no cleanup reports Failed', async () => {
  const h = harness({
    empty: {},
    notFunction: { default: 3 },
    throws: { default: () => { throw new TypeError('boom') } },
    noCleanup: { default: () => undefined },
  })
  for (const code of ['syntax', 'empty', 'notFunction', 'throws', 'noCleanup']) {
    h.send(render(code, code))
    await settle()
  }
  const failures = h.reports().filter((report) => report._tag === 'Failed')
  assert.deepEqual(failures, [
    { _tag: 'Failed', id: 'syntax', message: 'The module could not be loaded. SyntaxError: Unexpected token' },
    { _tag: 'Failed', id: 'empty', message: 'The module has no default export function.' },
    { _tag: 'Failed', id: 'notFunction', message: 'The module has no default export function.' },
    { _tag: 'Failed', id: 'throws', message: 'The view threw. TypeError: boom' },
    { _tag: 'Failed', id: 'noCleanup', message: 'The view did not return a cleanup function.' },
  ])
  assert.equal(h.pendingFrames(), 0)
  assert.equal(h.root.cleared >= 1, true)
})

test('Dispose calls the cleanup, clears the root, and stops reporting', async () => {
  let cleaned = 0
  const h = harness({ view: { default: () => () => { cleaned += 1 } } })
  h.send(render('a', 'view'))
  await settle()
  h.frame(0)
  h.send({ _tag: 'Dispose', id: 'other' })
  await settle()
  assert.equal(cleaned, 0)
  h.send({ _tag: 'Dispose', id: 'a' })
  await settle()
  assert.equal(cleaned, 1)
  assert.equal(h.root.cleared, 1)
  assert.equal(h.pendingFrames(), 0)
  h.frame(16)
  h.frame(32)
  assert.deepEqual(tags(h), ['Ready'])
})

test('a cleanup that throws is reported and the root is still cleared', async () => {
  const h = harness({ view: { default: () => () => { throw new RangeError('stuck') } } })
  h.send(render('a', 'view'))
  await settle()
  h.send({ _tag: 'Dispose', id: 'a' })
  await settle()
  assert.deepEqual(h.reports().slice(1), [{ _tag: 'Failed', id: 'a', message: 'The cleanup threw. RangeError: stuck' }])
  assert.equal(h.root.cleared, 1)
})

test('a new Render ends the view before it', async () => {
  const log: string[] = []
  const h = harness({
    first: { default: () => { log.push('run first'); return () => { log.push('clean first') } } },
    second: { default: () => { log.push('run second'); return () => { log.push('clean second') } } },
  })
  h.send(render('a', 'first'))
  await settle()
  h.send(render('b', 'second'))
  await settle()
  assert.deepEqual(log, ['run first', 'clean first', 'run second'])
  h.frame(0)
  h.frame(16)
  assert.deepEqual(h.reports().slice(1), [{ _tag: 'Rendered', id: 'b', ms: 16 }])
})

test('a Dispose that arrives while the module loads keeps the view from running', async () => {
  let ran = 0
  const h = harness({ view: { default: () => { ran += 1; return () => undefined } } })
  h.send(render('a', 'view'))
  h.send({ _tag: 'Dispose', id: 'a' })
  await settle()
  assert.equal(ran, 0)
  assert.equal(h.pendingFrames(), 0)
  assert.deepEqual(tags(h), ['Ready'])
})

test('stopping the frame ends the running view', async () => {
  let cleaned = 0
  const h = harness({ view: { default: () => () => { cleaned += 1 } } })
  h.send(render('a', 'view'))
  await settle()
  h.stop()
  await settle()
  assert.equal(cleaned, 1)
  assert.equal(h.pendingFrames(), 0)
})

test('a rejection before the first paint reports Failed, ends the view, and posts no Rendered', async () => {
  let cleaned = 0
  const h = harness({ view: { default: () => () => { cleaned += 1 } } })
  h.send(render('a', 'view'))
  await settle()
  h.frame(0)
  h.reject(new TypeError('chart.render rejected'))
  assert.deepEqual(h.reports().slice(1), [{ _tag: 'Failed', id: 'a', message: 'The view failed. TypeError: chart.render rejected' }])
  await settle()
  assert.equal(cleaned, 1)
  assert.equal(h.root.cleared, 1)
  assert.equal(h.pendingFrames(), 0)
  h.frame(16)
  h.frame(32)
  assert.deepEqual(tags(h), ['Ready', 'Failed'])
})

test('an error after the first paint reports Failed and stops FrameRate', async () => {
  const h = harness({ view: { default: () => () => undefined } })
  h.send(render('a', 'view'))
  await settle()
  h.frame(0)
  h.frame(16)
  assert.deepEqual(tags(h), ['Ready', 'Rendered'])
  h.error({ message: 'Uncaught RangeError: late', error: new RangeError('late') })
  await settle()
  assert.deepEqual(h.reports().slice(2), [{ _tag: 'Failed', id: 'a', message: 'The view failed. RangeError: late' }])
  assert.equal(h.root.cleared, 1)
  for (let time = 32; time <= 3000; time += 20) h.frame(time)
  assert.deepEqual(tags(h), ['Ready', 'Rendered', 'Failed'])
})

test('an error with no cause object falls back to its message, and a rejection with a plain value to its text', async () => {
  const h = harness({ view: { default: () => () => undefined } })
  h.send(render('a', 'view'))
  await settle()
  h.error({ message: 'Script error.', error: null })
  h.send(render('b', 'view'))
  await settle()
  h.reject('plain')
  assert.deepEqual(h.reports().slice(1), [
    { _tag: 'Failed', id: 'a', message: 'The view failed. Script error.' },
    { _tag: 'Failed', id: 'b', message: 'The view failed. plain' },
  ])
})

test('an error or rejection with no active view posts nothing', async () => {
  const h = harness({ view: { default: () => () => undefined } })
  h.error({ message: 'before any view', error: new Error('x') })
  h.reject(new Error('y'))
  h.send(render('a', 'view'))
  await settle()
  h.send({ _tag: 'Dispose', id: 'a' })
  await settle()
  h.error({ message: 'after dispose', error: new Error('z') })
  h.reject(new Error('w'))
  assert.deepEqual(tags(h), ['Ready'])
})

test('an error while the module is still loading fails that view and the module never runs', async () => {
  let ran = 0
  const h = harness({ view: { default: () => { ran += 1; return () => undefined } } })
  h.send(render('a', 'view'))
  h.error({ message: 'top-level throw', error: new Error('during load') })
  await settle()
  assert.equal(ran, 0)
  assert.deepEqual(h.reports().slice(1), [{ _tag: 'Failed', id: 'a', message: 'The view failed. Error: during load' }])
})

test('a cleanup that arrives after the view was retired while mounting runs at once and nothing is watched', async () => {
  const modules: Modules = {}
  const h = harness(modules)
  let cleaned = 0
  modules.view = { default: () => {
    h.error({ message: 'raised by a DOM callback', error: new Error('during mount') })
    return () => { cleaned += 1 }
  } }
  h.send(render('a', 'view'))
  await settle()
  assert.equal(cleaned, 1)
  assert.equal(h.root.nodes, 0)
  assert.equal(h.pendingFrames(), 0)
  assert.deepEqual(h.reports().slice(1), [{ _tag: 'Failed', id: 'a', message: 'The view failed. Error: during mount' }])
})

test('Rendered waits for the root to hold a node, and the frame rate waits for Rendered', async () => {
  const h = harness({ blank: { default: () => () => undefined } })
  h.send(render('a', 'blank'))
  await settle()
  for (let time = 0; time <= 2000; time += 20) h.frame(time)
  assert.deepEqual(tags(h), ['Ready'])
  assert.equal(h.pendingFrames(), 1)
  h.root.nodes = 1
  h.frame(2020)
  assert.deepEqual(h.reports().slice(1), [{ _tag: 'Rendered', id: 'a', ms: 2020 }])
  for (let time = 2040; time <= 3040; time += 20) h.frame(time)
  assert.deepEqual(h.reports().slice(2), [{ _tag: 'FrameRate', id: 'a', fps: 50 }])
})

test('a Render with the same code reuses the loaded module, and only the last module is kept', async () => {
  let ran = 0
  const h = harness({
    one: { default: () => { ran += 1; return () => undefined } },
    two: { default: () => () => undefined },
  })
  for (const code of ['one', 'one', 'two', 'one']) {
    h.send(render(code + ran, code))
    await settle()
  }
  assert.deepEqual(h.loaded, ['one', 'two', 'one'])
  assert.equal(ran, 3)
})

test('themeVariables names every colour, series entry, and font', () => {
  const entries = Object.fromEntries(themeVariables(theme))
  assert.equal(entries['--viz-chart-positive'], theme.chartPositive)
  assert.equal(entries['--viz-series-0'], theme.series[0])
  assert.equal(entries['--viz-font-body'], 'sans-serif')
  assert.equal(entries['color-scheme'], 'light')
  assert.equal(Object.keys(entries).length, 1 + 17 + 7 + 2)
})
