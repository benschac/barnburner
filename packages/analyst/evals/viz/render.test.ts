import assert from "node:assert/strict";
import { once } from "node:events";
import { mkdtemp, rm, stat } from "node:fs/promises";
import { createServer } from "node:http";
import type { Server } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import { HostMessage, VizTheme } from "@nhl-reddit-stats/viz";
import { Clock, Effect, Result, Schema } from "effect";

import { renderView, RenderHarnessError } from "./render.ts";

// A stub of the lab's sandbox entry, with the real page's timing. It has a "View module" and a "View data" text
// area, a Run button, an alert for bad view data, and a `frame-reports` element holding the reports of the
// current render. It runs a starter view on load, and Run starts a fresh sandboxed frame whose `Ready` comes
// 300 ms late; like the real page it clears the reports only when that `Ready` arrives, so for a while the
// element still holds the starter's reports, under the same render id.
//
// The frame answers a `Render` with `Rendered` and then a `FrameRate` every 50 ms whose rate is the number of
// rows in `tables.hops`, so a test can tell which tables reached it. The code selects other behaviour:
// "throw" fails at once, "late" paints and then fails 150 ms later, "echo" fails with the `Render` it received.
const frameSource = `
  const delay = Number(new URLSearchParams(location.search).get('delay'))
  setTimeout(() => parent.postMessage({ _tag: 'Ready', versions: {} }, '*'), delay)
  addEventListener('message', (event) => {
    const m = event.data
    if (event.source !== parent || !m || m._tag !== 'Render') return
    if (m.code.includes('echo')) { parent.postMessage({ _tag: 'Failed', id: m.id, message: JSON.stringify(m) }, '*'); return }
    if (m.code.includes('throw')) { parent.postMessage({ _tag: 'Failed', id: m.id, message: 'boom' }, '*'); return }
    parent.postMessage({ _tag: 'Rendered', id: m.id, ms: 12 }, '*')
    if (m.code.includes('late')) { setTimeout(() => parent.postMessage({ _tag: 'Failed', id: m.id, message: 'late boom' }, '*'), 150); return }
    setInterval(() => parent.postMessage({ _tag: 'FrameRate', id: m.id, fps: m.tables.hops.length }, '*'), 50)
  })
`;

const framePage = `<!doctype html><script>${frameSource}</script>`;

// A theme that passes `VizTheme`: its series is the seven colours the schema names, in order.
const theme: VizTheme = {
  mode: "light",
  background: "#ffffff",
  color: "#111111",
  muted: "#777777",
  gold: "#c9a227",
  win: "#2e7d32",
  loss: "#c62828",
  pending: "#999999",
  rule: "#dddddd",
  surface: "#f4f4f4",
  highlight: "#fff3c4",
  brand: "#b71c1c",
  bright: "#ff5252",
  chartWin: "#66bb6a",
  chartLoss: "#ef5350",
  chartPositive: "#1565c0",
  chartNegative: "#ef6c00",
  chartLine: "#9e9e9e",
  series: [
    "#1565c0",
    "#ef6c00",
    "#c9a227",
    "#b71c1c",
    "#66bb6a",
    "#ef5350",
    "#777777",
  ],
  fonts: { body: "sans-serif", score: "monospace" },
};
// Encoding checks the fixture against the schema, so the stub cannot drift from the protocol.
const themeJson = Schema.encodeSync(Schema.fromJsonString(VizTheme))(theme);

const controls = `<title>stub</title>
<textarea aria-label="View module">starter</textarea>
<textarea aria-label="View data">{"tables":{"hops":[{"chain":0}]},"notes":""}</textarea>
<button type="button" aria-label="Run" id="run">Run</button>
<div id="problem"></div>
<div id="slot"></div>`;

const page = `<!doctype html>${controls}
<pre data-testid="frame-reports" hidden>[]</pre>
<script>
  const theme = ${themeJson}
  const slot = document.getElementById('slot')
  const problem = document.getElementById('problem')
  const out = document.querySelector('[data-testid=frame-reports]')
  const [area, data] = document.querySelectorAll('textarea')
  let reports = []
  const show = () => { out.textContent = JSON.stringify(reports) }
  const mount = (code, tables, delay) => {
    const frame = document.createElement('iframe')
    frame.setAttribute('sandbox', 'allow-scripts'); frame.title = 'Visualization'; frame.width = 300; frame.height = 200
    frame.src = '/frame.html?delay=' + delay
    slot.replaceChildren(frame)
    addEventListener('message', (event) => {
      if (event.source !== frame.contentWindow) return
      if (event.data._tag === 'Ready') {
        reports = []; show()
        frame.contentWindow.postMessage({ _tag: 'Render', id: 'render-1', code, tables, theme }, '*')
      } else { reports.push(event.data); show() }
    })
  }
  document.getElementById('run').onclick = () => {
    let parsed
    try { parsed = JSON.parse(data.value) } catch { parsed = null }
    if (!parsed) { problem.setAttribute('role', 'alert'); problem.textContent = 'bad view data'; return }
    problem.removeAttribute('role'); problem.textContent = ''
    mount(area.value, parsed.tables, 300)
  }
  mount(area.value, JSON.parse(data.value).tables, 0)
</script>`;

// The same controls with no `frame-reports` element.
const pageWithoutReports = `<!doctype html>${controls}`;

const serve = async (
  html: string = page
): Promise<{ readonly server: Server; readonly baseUrl: string }> => {
  const server = createServer((request, response) => {
    response.setHeader("content-type", "text/html");
    response.end(request.url?.startsWith("/frame.html") ? framePage : html);
  });
  server.listen(0, "localhost");
  await once(server, "listening");
  const address = server.address();
  return {
    server,
    baseUrl: `http://localhost:${typeof address === "object" && address !== null ? address.port : 0}`,
  };
};

const tables = {
  hops: [{ chain: 0 }, { chain: 1 }, { chain: 2 }, { chain: 3 }],
};

test("renderView reports a painted view, the median frame rate of the caller tables, and a screenshot", async () => {
  const { server, baseUrl } = await serve();
  const dir = await mkdtemp(join(tmpdir(), "render-test-"));
  try {
    const result = await Effect.runPromise(
      renderView({
        baseUrl,
        code: "export default () => () => {}",
        tables,
        sampleMs: 600,
        screenshotPath: join(dir, "shot.png"),
      })
    );
    assert.equal(result.outcome, "Rendered");
    assert.equal(result.failureMessage, null);
    assert.equal(result.firstPaintMs, 12);
    assert.equal(result.medianFps, 4);
    assert.equal(result.screenshotPath, join(dir, "shot.png"));
    assert.ok((await stat(result.screenshotPath)).size > 0);
  } finally {
    server.close();
    await rm(dir, { recursive: true, force: true });
  }
});

test("renderView reports a failing view as a Failed outcome with no frame rate", async () => {
  const { server, baseUrl } = await serve();
  const dir = await mkdtemp(join(tmpdir(), "render-test-"));
  try {
    const result = await Effect.runPromise(
      renderView({
        baseUrl,
        code: 'export default () => { throw new Error("x") }',
        tables,
        sampleMs: 200,
        screenshotPath: join(dir, "shot.png"),
      })
    );
    assert.equal(result.outcome, "Failed");
    assert.equal(result.failureMessage, "boom");
    assert.equal(result.medianFps, 0);
    assert.ok((await stat(result.screenshotPath)).size > 0);
  } finally {
    server.close();
    await rm(dir, { recursive: true, force: true });
  }
});

test("renderView returns a tagged error when the page never settles", async () => {
  const server = createServer((_request, response) => {
    response.setHeader("content-type", "text/html");
    response.end("<!doctype html><title>blank</title>");
  });
  server.listen(0, "localhost");
  await once(server, "listening");
  const address = server.address();
  try {
    const result = await Effect.runPromise(
      Effect.result(
        renderView({
          baseUrl: `http://localhost:${typeof address === "object" && address !== null ? address.port : 0}`,
          code: "x",
          tables,
          settleTimeoutMs: 500,
        })
      )
    );
    assert.ok(Result.isFailure(result));
    assert.ok(Schema.is(RenderHarnessError)(result.failure));
    assert.equal(result.failure._tag, "RenderHarnessError");
    assert.equal(result.failure.stage, "open");
  } finally {
    server.close();
  }
});

test("renderView grades the submitted view, not the starter that painted first", async () => {
  const { server, baseUrl } = await serve();
  const dir = await mkdtemp(join(tmpdir(), "render-test-"));
  try {
    // The starter paints at once under render-1; the submitted frame is 300 ms late and fails under render-1 too.
    const result = await Effect.runPromise(
      renderView({
        baseUrl,
        code: "throw",
        tables,
        sampleMs: 100,
        screenshotPath: join(dir, "shot.png"),
      })
    );
    assert.equal(result.outcome, "Failed");
    assert.equal(result.failureMessage, "boom");
  } finally {
    server.close();
    await rm(dir, { recursive: true, force: true });
  }
});

test("renderView reports a view that paints and then fails as Failed", async () => {
  const { server, baseUrl } = await serve();
  const dir = await mkdtemp(join(tmpdir(), "render-test-"));
  try {
    const result = await Effect.runPromise(
      renderView({
        baseUrl,
        code: "late",
        tables,
        sampleMs: 600,
        screenshotPath: join(dir, "shot.png"),
      })
    );
    assert.equal(result.outcome, "Failed");
    assert.equal(result.failureMessage, "late boom");
    // The stub reports a paint at 12 ms; the 600 ms sample window must not leak into it.
    assert.equal(result.firstPaintMs, 12);
    assert.equal(result.medianFps, 0);
  } finally {
    server.close();
    await rm(dir, { recursive: true, force: true });
  }
});

test("renderView submits tables and notes that make a valid Render for the frame", async () => {
  const { server, baseUrl } = await serve();
  const dir = await mkdtemp(join(tmpdir(), "render-test-"));
  try {
    const result = await Effect.runPromise(
      renderView({
        baseUrl,
        code: "echo",
        tables,
        notes: "hops: the hops.",
        sampleMs: 100,
        screenshotPath: join(dir, "shot.png"),
      })
    );
    assert.equal(result.outcome, "Failed");
    // The stub frame echoes the Render it got; the real frame decodes it as a HostMessage.
    const received = Schema.decodeUnknownSync(
      Schema.fromJsonString(HostMessage)
    )(result.failureMessage);
    assert.equal(received._tag, "Render");
    assert.deepEqual(
      received._tag === "Render" ? received.tables : null,
      tables
    );
  } finally {
    server.close();
    await rm(dir, { recursive: true, force: true });
  }
});

test("renderView returns a tagged error when frame-reports is missing, within the settle timeout", async () => {
  const { server, baseUrl } = await serve(pageWithoutReports);
  const started = await Effect.runPromise(Clock.currentTimeMillis);
  try {
    const result = await Effect.runPromise(
      Effect.result(
        renderView({ baseUrl, code: "x", tables, settleTimeoutMs: 1000 })
      )
    );
    assert.ok(Result.isFailure(result));
    assert.equal(result.failure.stage, "open");
    assert.ok(
      (await Effect.runPromise(Clock.currentTimeMillis)) - started < 15_000
    );
  } finally {
    server.close();
  }
});

test("renderView returns a tagged launch error for a browser channel that is not installed", async () => {
  const { server, baseUrl } = await serve();
  try {
    const result = await Effect.runPromise(
      Effect.result(
        renderView({ baseUrl, code: "x", tables, channel: "no-such-channel" })
      )
    );
    assert.ok(Result.isFailure(result));
    assert.equal(result.failure.stage, "launch");
  } finally {
    server.close();
  }
});
