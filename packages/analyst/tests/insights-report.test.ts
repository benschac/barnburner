import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import { Result } from "effect";

import {
  formatSummary,
  parseTrace,
  summarize,
} from "../scripts/insights-report.ts";
import { parseTraceLine } from "../src/trace.ts";

const fixturePath = fileURLToPath(
  new URL("./fixtures/trace.jsonl", import.meta.url)
);

function fixtureEvents() {
  return Result.getOrThrow(parseTrace(readFileSync(fixturePath, "utf8")));
}

const event = (value: unknown) =>
  Result.getOrThrow(parseTraceLine(JSON.stringify(value)));

test("parseTrace fails with the first rejected line", () => {
  const result = parseTrace(
    '{"ts":"t","runId":"r","type":"outcome","status":"cards"}\n\n{"ts":"t","runId":"r","type":"bogus"}\nnot json\n'
  );
  assert.ok(Result.isFailure(result));
  assert.equal(result.failure._tag, "TraceLineError");
  assert.equal(result.failure.line, '{"ts":"t","runId":"r","type":"bogus"}');
  assert.match(result.failure.message, /^invalid trace line: /);
});

test("summarize counts the fixture trace", () => {
  const summary = summarize(fixtureEvents());
  assert.equal(summary.events, 5);
  assert.deepEqual(summary.byType, {
    model_call: 1,
    tool_call: 1,
    verify: 1,
    card: 1,
    outcome: 1,
  });
  assert.deepEqual(summary.models, {
    "claude-haiku-5-5": { calls: 1, inputTokens: 1200, outputTokens: 310 },
  });
  assert.deepEqual(summary.tokens, { input: 1200, output: 310 });
  assert.deepEqual(summary.tools, {
    calls: 1,
    errors: 0,
    byTool: { lookup_player: 1 },
  });
  assert.deepEqual(summary.verify, {
    checks: 1,
    failed: 0,
    failuresByCheck: {},
  });
  assert.equal(summary.cards, 1);
  assert.equal(summary.outcome, "cards");
});

test("summarize groups verify failures by check and counts tool errors", () => {
  const events = [
    ...fixtureEvents(),
    event({
      ts: "t",
      runId: "fixture-run",
      type: "verify",
      check: 3,
      passed: false,
      detail: "x",
    }),
    event({
      ts: "t",
      runId: "fixture-run",
      type: "verify",
      check: 7,
      passed: false,
    }),
    event({
      ts: "t",
      runId: "fixture-run",
      type: "tool_call",
      tool: "get_game",
      input: {},
      output: "",
      durationMs: 1,
      error: "boom",
    }),
    event({
      ts: "t",
      runId: "fixture-run",
      type: "outcome",
      status: "crashed",
    }),
  ];
  const summary = summarize(events);
  assert.deepEqual(summary.verify, {
    checks: 3,
    failed: 2,
    failuresByCheck: { "3": 1, "7": 1 },
  });
  assert.deepEqual(summary.tools, {
    calls: 2,
    errors: 1,
    byTool: { lookup_player: 1, get_game: 1 },
  });
  assert.equal(summary.outcome, "crashed");
});

test("summarize handles an empty trace", () => {
  const summary = summarize([]);
  assert.equal(summary.events, 0);
  assert.equal(summary.outcome, undefined);
  assert.deepEqual(summary.models, {});
});

test("formatSummary renders the fixture run", () => {
  const text = formatSummary("fixture-run", summarize(fixtureEvents()));
  assert.match(text, /^Run fixture-run/m);
  assert.match(text, /Tokens: 1200 in \/ 310 out/);
  assert.match(text, /Verify: 0 failed of 1 checks/);
});
