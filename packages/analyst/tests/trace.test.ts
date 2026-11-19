import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { DateTime, Result } from "effect";
import { defaultTraceDir, openTrace, parseTraceLine, truncateText, TRACE_EVENT_TYPES, type TraceOptions } from "../src/trace.ts";

const fixturePath = fileURLToPath(new URL("./fixtures/trace.jsonl", import.meta.url));

function withTempDir(run: (dir: string) => void): void {
  const dir = mkdtempSync(join(tmpdir(), "analyst-trace-"));
  try {
    run(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

const parse = (line: string) => Result.getOrThrow(parseTraceLine(line));
const open = (options: TraceOptions) => Result.getOrThrow(openTrace(options));

function failure<A, E>(result: Result.Result<A, E>): E {
  assert.ok(Result.isFailure(result));
  return result.failure;
}

// The typed error for a rejected line: its tag, the offending line, and the message.
function rejects(line: string, message: RegExp): void {
  const error = failure(parseTraceLine(line));
  assert.equal(error._tag, "TraceLineError");
  assert.equal(error.line, line);
  assert.match(error.message, message);
}

test("fixture has one valid event of each type", () => {
  const lines = readFileSync(fixturePath, "utf8").trim().split("\n");
  const events = lines.map(parse);
  assert.deepEqual(events.map((event) => event.type), [...TRACE_EVENT_TYPES]);
  for (const event of events) assert.equal(event.runId, "fixture-run");
});

test("writer appends one JSONL line per event with ts and runId", () => {
  withTempDir((dir) => {
    const trace = open({ runId: "run-1", dir, now: () => DateTime.toDateUtc(DateTime.makeUnsafe("2026-01-02T03:04:05.000Z")) });
    trace.append({ type: "model_call", model: "m", inputTokens: 1, outputTokens: 2, latencyMs: 3 });
    trace.append({ type: "outcome", status: "cards" });
    assert.equal(trace.path, join(dir, "run-1.jsonl"));
    const lines = readFileSync(trace.path, "utf8").trim().split("\n");
    assert.equal(lines.length, 2);
    const [first, second] = lines.map(parse);
    assert.equal(first?.ts, "2026-01-02T03:04:05.000Z");
    assert.equal(second?.runId, "run-1");
    assert.equal(second?.type, "outcome");
  });
});

test("parseTraceLine enforces typed outcome statuses", () => {
  rejects('{"ts":"x","runId":"r","type":"outcome","status":"ok"}', /at \["status"\]/);
  for (const status of ["cards", "answered", "declined", "no_insight", "crashed"]) {
    assert.equal(parse(`{"ts":"x","runId":"r","type":"outcome","status":"${status}"}`).type, "outcome");
  }
});

test("writer reopened on the same run appends rather than overwrites", () => {
  withTempDir((dir) => {
    open({ runId: "run-2", dir }).append({ type: "verify", check: 1, passed: true });
    const again = open({ runId: "run-2", dir });
    again.append({ type: "verify", check: 2, passed: false, detail: "nope" });
    assert.equal(readFileSync(again.path, "utf8").trim().split("\n").length, 2);
  });
});

test("tool_call output is truncated to the configured limit", () => {
  withTempDir((dir) => {
    const trace = open({ runId: "run-3", dir, maxToolOutputChars: 5 });
    const event = Result.getOrThrow(trace.append({ type: "tool_call", tool: "t", input: { q: 1 }, output: "abcdefgh", durationMs: 7 }));
    assert.equal(event.type === "tool_call" ? event.output : "", "abcde...[+3 chars]");
  });
});

test("writer rejects run ids that are not safe file names", () => {
  withTempDir((dir) => {
    const escape = failure(openTrace({ runId: "../escape", dir }));
    assert.equal(escape._tag, "InvalidRunIdError");
    assert.equal(escape.runId, "../escape");
    assert.equal(escape.message, 'invalid runId for trace file: "../escape"');
    assert.equal(failure(openTrace({ runId: "", dir }))._tag, "InvalidRunIdError");
  });
});

test("parseTraceLine rejects malformed events", () => {
  rejects('{"ts":"x","runId":"r","type":"bogus"}', /Expected \{ readonly "type": "model_call"/);
  rejects('{"ts":"x","runId":"r","type":"verify","check":"3","passed":true}', /Expected number\n\s+at \["check"\]/);
  rejects('{"ts":"x","runId":"r","type":"verify","check":3}', /Missing key\n\s+at \["passed"\]/);
  rejects('{"runId":"r","type":"outcome","status":"cards"}', /Missing key\n\s+at \["ts"\]/);
  rejects('{"ts":"x","runId":"../r","type":"outcome","status":"cards"}', /at \["runId"\]/);
  rejects("not json", /invalid trace line: Expected a valid JSON string/);
});

test("writer refuses events that would serialize to unreadable lines", () => {
  withTempDir((dir) => {
    const trace = open({ runId: "run-4", dir });
    assert.match(failure(trace.append({ type: "tool_call", tool: "t", input: undefined, output: "", durationMs: 1 })).message, /at \["input"\]/);
    assert.match(failure(trace.append({ type: "card", cardId: "c", card: undefined })).message, /at \["card"\]/);
    assert.match(failure(trace.append({ type: "model_call", model: "m", inputTokens: NaN, outputTokens: 1, latencyMs: 1 })).message, /at \["inputTokens"\]/);
    assert.equal(existsSync(trace.path), false);
  });
});

test("parseTraceLine rejects malformed optional fields", () => {
  rejects('{"ts":"x","runId":"r","type":"verify","check":1,"passed":true,"detail":42}', /at \["detail"\]/);
  rejects('{"ts":"x","runId":"r","type":"tool_call","tool":"t","input":null,"output":"","durationMs":1,"error":{}}', /at \["error"\]/);
  rejects('{"ts":"x","runId":"r","type":"outcome","status":"cards","detail":false}', /at \["detail"\]/);
  assert.equal(parse('{"ts":"x","runId":"r","type":"verify","check":1,"passed":true,"detail":"ok"}').type, "verify");
});

test("truncateText leaves short text alone", () => {
  assert.equal(truncateText("abc", 3), "abc");
});

test("default dir is <repo root>/.audit/agent-runs", () => {
  const expected = resolve(fileURLToPath(new URL("../../..", import.meta.url)), ".audit/agent-runs");
  assert.equal(defaultTraceDir(), expected);
  assert.ok(defaultTraceDir().endsWith(join(".audit", "agent-runs")));
});
