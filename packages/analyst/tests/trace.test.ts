import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defaultTraceDir, openTrace, parseTraceLine, truncateText, TRACE_EVENT_TYPES } from "../src/trace.ts";

const fixturePath = fileURLToPath(new URL("./fixtures/trace.jsonl", import.meta.url));

function withTempDir(run: (dir: string) => void): void {
  const dir = mkdtempSync(join(tmpdir(), "analyst-trace-"));
  try {
    run(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test("fixture has one valid event of each type", () => {
  const lines = readFileSync(fixturePath, "utf8").trim().split("\n");
  const events = lines.map(parseTraceLine);
  assert.deepEqual(events.map((event) => event.type), [...TRACE_EVENT_TYPES]);
  for (const event of events) assert.equal(event.runId, "fixture-run");
});

test("writer appends one JSONL line per event with ts and runId", () => {
  withTempDir((dir) => {
    const trace = openTrace({ runId: "run-1", dir, now: () => new Date("2026-01-02T03:04:05.000Z") });
    trace.append({ type: "model_call", model: "m", inputTokens: 1, outputTokens: 2, latencyMs: 3 });
    trace.append({ type: "outcome", status: "cards" });
    assert.equal(trace.path, join(dir, "run-1.jsonl"));
    const lines = readFileSync(trace.path, "utf8").trim().split("\n");
    assert.equal(lines.length, 2);
    const [first, second] = lines.map(parseTraceLine);
    assert.equal(first?.ts, "2026-01-02T03:04:05.000Z");
    assert.equal(second?.runId, "run-1");
    assert.equal(second?.type, "outcome");
  });
});

test("parseTraceLine enforces typed outcome statuses", () => {
  assert.throws(() => parseTraceLine('{"ts":"x","runId":"r","type":"outcome","status":"ok"}'), /invalid status ok/);
  for (const status of ["cards", "answered", "declined", "no_insight", "crashed"]) {
    assert.equal(parseTraceLine(`{"ts":"x","runId":"r","type":"outcome","status":"${status}"}`).type, "outcome");
  }
});

test("writer reopened on the same run appends rather than overwrites", () => {
  withTempDir((dir) => {
    openTrace({ runId: "run-2", dir }).append({ type: "verify", check: 1, passed: true });
    const again = openTrace({ runId: "run-2", dir });
    again.append({ type: "verify", check: 2, passed: false, detail: "nope" });
    assert.equal(readFileSync(again.path, "utf8").trim().split("\n").length, 2);
  });
});

test("tool_call output is truncated to the configured limit", () => {
  withTempDir((dir) => {
    const trace = openTrace({ runId: "run-3", dir, maxToolOutputChars: 5 });
    const event = trace.append({ type: "tool_call", tool: "t", input: { q: 1 }, output: "abcdefgh", durationMs: 7 });
    assert.equal(event.type === "tool_call" ? event.output : "", "abcde...[+3 chars]");
  });
});

test("writer rejects run ids that are not safe file names", () => {
  withTempDir((dir) => {
    assert.throws(() => openTrace({ runId: "../escape", dir }), /invalid runId/);
    assert.throws(() => openTrace({ runId: "", dir }), /invalid runId/);
  });
});

test("parseTraceLine rejects malformed events", () => {
  assert.throws(() => parseTraceLine('{"ts":"x","runId":"r","type":"bogus"}'), /unknown trace event type/);
  assert.throws(() => parseTraceLine('{"ts":"x","runId":"r","type":"verify","check":"3","passed":true}'), /invalid field check/);
  assert.throws(() => parseTraceLine('{"ts":"x","runId":"r","type":"verify","check":3}'), /invalid field passed/);
  assert.throws(() => parseTraceLine('{"runId":"r","type":"outcome","status":"cards"}'), /missing ts/);
});

test("writer refuses events that would serialize to unreadable lines", () => {
  withTempDir((dir) => {
    const trace = openTrace({ runId: "run-4", dir });
    assert.throws(() => trace.append({ type: "tool_call", tool: "t", input: undefined, output: "", durationMs: 1 }), /invalid field input/);
    assert.throws(() => trace.append({ type: "card", cardId: "c", card: undefined }), /invalid field card/);
    assert.throws(() => trace.append({ type: "model_call", model: "m", inputTokens: NaN, outputTokens: 1, latencyMs: 1 }), /invalid field inputTokens/);
    assert.equal(existsSync(trace.path), false);
  });
});

test("parseTraceLine rejects malformed optional fields", () => {
  assert.throws(() => parseTraceLine('{"ts":"x","runId":"r","type":"verify","check":1,"passed":true,"detail":42}'), /invalid optional field detail/);
  assert.throws(() => parseTraceLine('{"ts":"x","runId":"r","type":"tool_call","tool":"t","input":null,"output":"","durationMs":1,"error":{}}'), /invalid optional field error/);
  assert.throws(() => parseTraceLine('{"ts":"x","runId":"r","type":"outcome","status":"cards","detail":false}'), /invalid optional field detail/);
  assert.equal(parseTraceLine('{"ts":"x","runId":"r","type":"verify","check":1,"passed":true,"detail":"ok"}').type, "verify");
});

test("truncateText leaves short text alone", () => {
  assert.equal(truncateText("abc", 3), "abc");
});

test("default dir is <repo root>/.audit/agent-runs", () => {
  const expected = resolve(fileURLToPath(new URL("../../..", import.meta.url)), ".audit/agent-runs");
  assert.equal(defaultTraceDir(), expected);
  assert.ok(defaultTraceDir().endsWith(join(".audit", "agent-runs")));
});
