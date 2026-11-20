import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import { Effect, Schema } from "effect";

import {
  bakeoffReport,
  bakeoffReportFromFiles,
  ScreenshotReadError,
} from "./report.ts";
import type { BakeoffRecord } from "./report.ts";

const base = (overrides: Partial<BakeoffRecord>): BakeoffRecord => ({
  prompt: "Show how McDavid connects to Ted Lindsay.",
  dataset: "chain",
  vocabulary: "graph",
  outcome: "Rendered",
  repairs: 0,
  model: "test-model",
  tokens: 1000,
  firstPaintMs: 400,
  medianFps: 60,
  screenshotPath: "shots/graph.png",
  code: "export default {}",
  ...overrides,
});

const records: BakeoffRecord[] = [
  base({
    vocabulary: "graph",
    screenshotPath: "shots/graph-1.png",
    tokens: 1000,
    repairs: 1,
    firstPaintMs: 300,
    medianFps: 58,
  }),
  base({
    vocabulary: "timeline",
    outcome: "Failed",
    screenshotPath: "shots/timeline-1.png",
    tokens: 2000,
    repairs: 2,
    firstPaintMs: 500,
    medianFps: 30,
  }),
  base({
    prompt: "Compare who Gretzky and Ovechkin played against.",
    dataset: "opponents",
    vocabulary: "graph",
    screenshotPath: "shots/graph-2.png",
    tokens: 1500,
    repairs: 0,
    firstPaintMs: 350,
    medianFps: 60,
  }),
  base({
    prompt: "Compare who Gretzky and Ovechkin played against.",
    dataset: "opponents",
    vocabulary: "timeline",
    screenshotPath: "shots/timeline-2.png",
    tokens: 2500,
    repairs: 0,
    firstPaintMs: 450,
    medianFps: 40,
  }),
];

const images = new Map([
  ["shots/graph-1.png", "data:image/png;base64,AAAA"],
  ["shots/timeline-1.png", "data:image/png;base64,BBBB"],
  ["shots/graph-2.png", "data:image/png;base64,CCCC"],
  ["shots/timeline-2.png", "data:image/png;base64,DDDD"],
]);

// A 1x1 PNG.
const TINY_PNG =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";

test("report is one self-contained page with four screenshots and a closed key", () => {
  const html = bakeoffReport(records, { images, random: () => 0.9 });
  assert.match(html, /^<!doctype html>/);
  assert.equal((html.match(/<img /g) ?? []).length, 4);
  assert.doesNotMatch(html, /src="shots\//);
  assert.doesNotMatch(html, /<script/);
  assert.match(html, /<details class="key">/);
  assert.doesNotMatch(html, /<details class="key" open/);
});

test("the page sets no colour literals, only system colours", () => {
  const html = bakeoffReport(records, { images, random: () => 0.9 });
  assert.doesNotMatch(html, /#[0-9a-fA-F]{3,6}\b/);
  assert.match(html, /color-scheme:light dark/);
});

test("nothing outside a closed disclosure names a vocabulary", () => {
  const html = bakeoffReport(records, { images, random: () => 0.9 });
  const outside = html.replaceAll(/<details[\s\S]*?<\/details>/g, "");
  assert.doesNotMatch(outside, /graph|timeline/);
  // The disclosures do name them, and neither is open by default.
  assert.match(html, /<details class="results">/);
  assert.doesNotMatch(html, /<details[^>]* open/);
  assert.match(
    /<details class="results">[\s\S]*?<\/details>/.exec(html)?.[0] ?? "",
    /graph/
  );
});

test("the A/B order follows the random source, so the same source gives the same page", () => {
  const first = bakeoffReport(records, { images, random: () => 0.1 });
  const again = bakeoffReport(records, { images, random: () => 0.1 });
  const swapped = bakeoffReport(records, { images, random: () => 0.9 });
  assert.equal(first, again);
  assert.notEqual(first, swapped);
});

test("the table has one row per vocabulary with rendered counts and medians", () => {
  const html = bakeoffReport(records, { images, random: () => 0.9 });
  const graphRow =
    /<tr><th scope="row">graph<\/th>.*?<\/tr>/.exec(html)?.[0] ?? "";
  assert.match(graphRow, /<td>2 of 2<\/td>/);
  assert.match(graphRow, /<td>0\.50<\/td>/);
  assert.match(graphRow, /<td>1250<\/td>/);
  assert.match(graphRow, /<td>325<\/td>/);
  assert.match(graphRow, /<td>59\.0<\/td>/);
  const timelineRow =
    /<tr><th scope="row">timeline<\/th>.*?<\/tr>/.exec(html)?.[0] ?? "";
  assert.match(timelineRow, /<td>1 of 2<\/td>/);
});

test("medians use rendered results only, and a vocabulary with none rendered shows a dash", () => {
  const html = bakeoffReport(
    [
      base({
        vocabulary: "graph",
        outcome: "Rendered",
        firstPaintMs: 300,
        medianFps: 58,
      }),
      base({
        vocabulary: "graph",
        outcome: "Failed",
        firstPaintMs: 9000,
        medianFps: 1,
      }),
      base({
        vocabulary: "timeline",
        outcome: "Failed",
        firstPaintMs: 500,
        medianFps: 30,
      }),
    ],
    { random: () => 0.9 }
  );
  const graphRow =
    /<tr><th scope="row">graph<\/th>.*?<\/tr>/.exec(html)?.[0] ?? "";
  assert.match(
    graphRow,
    /<td>1 of 2<\/td>.*<td>300<\/td><td>58\.0<\/td><\/tr>/
  );
  const timelineRow =
    /<tr><th scope="row">timeline<\/th>.*?<\/tr>/.exec(html)?.[0] ?? "";
  assert.match(timelineRow, /<td>0 of 1<\/td>.*<td>—<\/td><td>—<\/td><\/tr>/);
});

test("a result with no screenshot shows a placeholder and escapes its text", () => {
  const html = bakeoffReport(
    [
      base({ prompt: "<b>bold</b>", screenshotPath: "missing.png" }),
      base({
        prompt: "<b>bold</b>",
        vocabulary: "timeline",
        screenshotPath: "other.png",
      }),
    ],
    { random: () => 0.9 }
  );
  assert.match(html, /No screenshot supplied/);
  assert.match(html, /&lt;b&gt;bold&lt;\/b&gt;/);
  assert.doesNotMatch(html, /<b>bold<\/b>/);
});

test("bakeoffReportFromFiles embeds each screenshot read from disk", async () => {
  const dir = await mkdtemp(join(tmpdir(), "bakeoff-report-"));
  try {
    const pngPath = join(dir, "graph-1.png");
    await writeFile(pngPath, Buffer.from(TINY_PNG, "base64"));
    const html = await Effect.runPromise(
      bakeoffReportFromFiles([base({ screenshotPath: pngPath })], {
        random: () => 0.9,
      })
    );
    assert.match(html, /src="data:image\/png;base64,/);
    assert.ok(html.includes(TINY_PNG));
    assert.doesNotMatch(html, /No screenshot supplied/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("bakeoffReportFromFiles fails with a tagged error naming a screenshot it cannot read", async () => {
  const dir = await mkdtemp(join(tmpdir(), "bakeoff-report-"));
  try {
    const missingPath = join(dir, "absent.png");
    const error = await Effect.runPromise(
      Effect.flip(
        bakeoffReportFromFiles([base({ screenshotPath: missingPath })])
      )
    );
    assert.ok(Schema.is(ScreenshotReadError)(error));
    assert.equal(error._tag, "ScreenshotReadError");
    assert.equal(error.path, missingPath);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
