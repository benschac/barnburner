import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import type { Server } from 'node:http'
import { mkdtemp, rm, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Effect, Result } from 'effect'
import { renderView, RenderHarnessError } from './render.ts'

// A stub of the lab's sandbox entry. Like the real page it has a "View module" and a "View data" text area,
// a Run button, an alert for bad view data, and a `frame-reports` element holding the reports of the current
// render. Run starts a fresh sandboxed frame. The frame answers `Render` with `Rendered` (or `Failed` when the
// code contains "throw") and then a `FrameRate` every 50 ms whose rate is the number of rows in
// `tables.hops`, so a test can tell which tables reached it.
const frameSource = `
  parent.postMessage({ _tag: 'Ready', versions: {} }, '*')
  addEventListener('message', (event) => {
    const m = event.data
    if (event.source !== parent || !m || m._tag !== 'Render') return
    if (m.code.includes('throw')) { parent.postMessage({ _tag: 'Failed', id: m.id, message: 'boom' }, '*'); return }
    parent.postMessage({ _tag: 'Rendered', id: m.id, ms: 12 }, '*')
    setInterval(() => parent.postMessage({ _tag: 'FrameRate', id: m.id, fps: m.tables.hops.length }, '*'), 50)
  })
`

const framePage = `<!doctype html><script>${frameSource}</script>`

const page = `<!doctype html><title>stub</title>
<textarea aria-label="View module">starter</textarea>
<textarea aria-label="View data">{"tables":{"hops":[{"chain":0}]},"notes":""}</textarea>
<button type="button" aria-label="Run" id="run">Run</button>
<div id="problem"></div>
<div id="slot"></div>
<pre data-testid="frame-reports" hidden>[]</pre>
<script>
  const slot = document.getElementById('slot')
  const problem = document.getElementById('problem')
  const out = document.querySelector('[data-testid=frame-reports]')
  const [area, data] = document.querySelectorAll('textarea')
  let reports = []
  let counter = 0
  const show = () => { out.textContent = JSON.stringify(reports) }
  const mount = (code, tables) => {
    reports = []; show()
    const frame = document.createElement('iframe')
    frame.setAttribute('sandbox', 'allow-scripts'); frame.title = 'Visualization'; frame.width = 300; frame.height = 200
    frame.src = '/frame.html'
    slot.replaceChildren(frame)
    counter += 1
    const id = 'render-' + counter
    addEventListener('message', (event) => {
      if (event.source !== frame.contentWindow) return
      if (event.data._tag === 'Ready') frame.contentWindow.postMessage({ _tag: 'Render', id, code, tables, theme: {} }, '*')
      else { reports.push(event.data); show() }
    })
  }
  document.getElementById('run').onclick = () => {
    let parsed
    try { parsed = JSON.parse(data.value) } catch { parsed = null }
    if (!parsed) { problem.setAttribute('role', 'alert'); problem.textContent = 'bad view data'; return }
    problem.removeAttribute('role'); problem.textContent = ''
    mount(area.value, parsed.tables)
  }
</script>`

const serve = (): Promise<{ readonly server: Server; readonly baseUrl: string }> =>
  new Promise((resolve) => {
    const server = createServer((request, response) => {
      response.setHeader('content-type', 'text/html')
      response.end(request.url === '/frame.html' ? framePage : page)
    })
    server.listen(0, 'localhost', () => {
      const address = server.address()
      resolve({ server, baseUrl: `http://localhost:${typeof address === 'object' && address !== null ? address.port : 0}` })
    })
  })

const tables = { hops: [{ chain: 0 }, { chain: 1 }, { chain: 2 }, { chain: 3 }] }

test('renderView reports a painted view, the median frame rate of the caller tables, and a screenshot', async () => {
  const { server, baseUrl } = await serve()
  const dir = await mkdtemp(join(tmpdir(), 'render-test-'))
  try {
    const result = await Effect.runPromise(renderView({
      baseUrl,
      code: 'export default () => () => {}',
      tables,
      sampleMs: 600,
      screenshotPath: join(dir, 'shot.png'),
    }))
    assert.equal(result.outcome, 'Rendered')
    assert.equal(result.failureMessage, null)
    assert.equal(result.firstPaintMs, 12)
    assert.equal(result.medianFps, 4)
    assert.equal(result.screenshotPath, join(dir, 'shot.png'))
    assert.ok((await stat(result.screenshotPath)).size > 0)
  } finally {
    server.close()
    await rm(dir, { recursive: true, force: true })
  }
})

test('renderView reports a failing view as a Failed outcome with no frame rate', async () => {
  const { server, baseUrl } = await serve()
  const dir = await mkdtemp(join(tmpdir(), 'render-test-'))
  try {
    const result = await Effect.runPromise(renderView({
      baseUrl,
      code: 'export default () => { throw new Error("x") }',
      tables,
      sampleMs: 200,
      screenshotPath: join(dir, 'shot.png'),
    }))
    assert.equal(result.outcome, 'Failed')
    assert.equal(result.failureMessage, 'boom')
    assert.equal(result.medianFps, 0)
    assert.ok((await stat(result.screenshotPath)).size > 0)
  } finally {
    server.close()
    await rm(dir, { recursive: true, force: true })
  }
})

test('renderView returns a tagged error when the page never settles', async () => {
  const server = createServer((_request, response) => {
    response.setHeader('content-type', 'text/html')
    response.end('<!doctype html><title>blank</title>')
  })
  await new Promise<void>((resolve) => server.listen(0, 'localhost', resolve))
  const address = server.address()
  try {
    const result = await Effect.runPromise(Effect.result(renderView({
      baseUrl: `http://localhost:${typeof address === 'object' && address !== null ? address.port : 0}`,
      code: 'x',
      tables,
      settleTimeoutMs: 500,
    })))
    assert.ok(Result.isFailure(result))
    assert.ok(result.failure instanceof RenderHarnessError)
    assert.equal(result.failure._tag, 'RenderHarnessError')
    assert.equal(result.failure.stage, 'open')
  } finally {
    server.close()
  }
})
