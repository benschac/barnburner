import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import { Effect, Result } from "effect";

import { runReview } from "../scripts/review-insights.ts";
import type { InsightCard } from "../src/card.ts";
import { applyDecision, formatForReview } from "../src/review.ts";
import { readCards, writeCards } from "../src/store.ts";

const scripted = (lines: readonly string[]) => {
  let i = 0;
  return async () => lines[i++];
};

const NOW = "2026-11-16T12:00:00.000Z";

const makeCard = (
  team: string,
  id: string,
  overrides: Partial<InsightCard> = {}
): InsightCard => ({
  id,
  status: "pending",
  team,
  kind: "record",
  headline: "{name} leads with {goals} goals",
  body: "Scored in {games} straight games.",
  bindings: {
    name: { column: "name", row: 0 },
    goals: { column: "goals", row: 0 },
    games: { column: "games", row: 1 },
  },
  evidence: {
    query: "SELECT name, goals, games FROM t",
    result: [
      { name: "Alex", goals: 12, games: 9 },
      { name: "Sam", goals: 8, games: 5 },
    ],
    gameIds: [2026020001, 2026020002],
    coverage: { archived: 2, finals: 2 },
  },
  asOf: { fetchedAt: "2026-11-15T00:00:00Z", completedGameIds: 2 },
  model: "fake",
  runId: "run-1",
  ...overrides,
});

test("applyDecision approves, rejects and skips pending cards", () => {
  const card = makeCard("TOR", "a");
  const approved = Result.getOrThrow(
    applyDecision(card, { action: "approve" }, NOW)
  );
  assert.equal(approved.status, "approved");
  assert.deepEqual(approved.review, { by: "ben", at: NOW });
  const rejected = Result.getOrThrow(
    applyDecision(card, { action: "reject", reason: "trivial" }, NOW)
  );
  assert.equal(rejected.status, "rejected");
  assert.deepEqual(rejected.review, { by: "ben", at: NOW, reason: "trivial" });
  assert.equal(
    Result.getOrThrow(applyDecision(card, { action: "skip" }, NOW)),
    card
  );
});

test("applyDecision refuses non-pending cards", () => {
  const card = makeCard("TOR", "a", { status: "approved" });
  const result = applyDecision(card, { action: "approve" }, NOW);
  assert.ok(Result.isFailure(result));
  assert.equal(result.failure._tag, "NotPendingError");
  assert.deepEqual(
    [result.failure.cardId, result.failure.status],
    ["a", "approved"]
  );
  assert.equal(
    result.failure.message,
    "card a is approved, only pending cards can be reviewed"
  );
});

test("formatForReview shows rendered text, query, table, games and coverage", () => {
  const text = Result.getOrThrow(
    formatForReview(
      makeCard("TOR", "a", { kind: "comparative", assert: "goals > 10" })
    )
  );
  assert.match(text, /Alex leads with 12 goals/);
  assert.match(text, /Scored in 5 straight games\./);
  assert.match(text, /SELECT name, goals, games FROM t/);
  assert.match(text, /name +goals +games/);
  assert.match(text, /Alex +12 +9/);
  assert.match(text, /gameIds: 2026020001, 2026020002/);
  assert.match(text, /coverage: 2\/2/);
  assert.match(text, /assert: goals > 10/);
});

test("formatForReview fails with the render error for a broken placeholder", () => {
  const result = formatForReview(
    makeCard("TOR", "a", { body: "{nope} games." })
  );
  assert.ok(Result.isFailure(result));
  assert.equal(result.failure._tag, "UnknownPlaceholderError");
  assert.equal(result.failure.placeholder, "nope");
});

test("runReview stops with the typed error when a card cannot be shown", async () => {
  const dir = mkdtempSync(join(tmpdir(), "review-"));
  writeCards(dir, "TOR", [makeCard("TOR", "a", { body: "{nope} games." })]);
  const result = await runReview({
    dir,
    nextLine: scripted(["a"]),
    out: () => {},
    now: NOW,
  });
  assert.ok(Result.isFailure(result));
  assert.equal(result.failure._tag, "UnknownPlaceholderError");
  assert.equal(Result.getOrThrow(readCards(dir, "TOR"))[0]?.status, "pending");
});

test("runReview applies scripted answers and writes back", async () => {
  const dir = mkdtempSync(join(tmpdir(), "review-"));
  writeCards(dir, "TOR", [
    makeCard("TOR", "a"),
    makeCard("TOR", "b"),
    makeCard("TOR", "c"),
  ]);
  writeCards(dir, "BOS", [
    makeCard("BOS", "d"),
    makeCard("BOS", "e", { status: "approved" }),
  ]);
  const output: string[] = [];
  const summary = await runReview({
    dir,
    nextLine: scripted(["a", "r", "bogus", "wrong", ""]),
    out: (text) => output.push(text),
    now: NOW,
  });
  assert.deepEqual(
    summary,
    Result.succeed({ approved: 1, rejected: 1, skipped: 1 })
  );
  // BOS is reviewed first (sorted): d approved; then TOR: a rejected(wrong), b skipped, c left (answers ran out)
  const bos = Result.getOrThrow(readCards(dir, "BOS"));
  assert.equal(bos[0]?.status, "approved");
  const tor = Result.getOrThrow(readCards(dir, "TOR"));
  assert.deepEqual(
    tor.map((card) => card.status),
    ["rejected", "pending", "pending"]
  );
  assert.equal(tor[0]?.review?.reason, "wrong");
  assert.ok(output.some((line) => line.includes('Unknown reason "bogus"')));
});

test("runReview limits to the given team", async () => {
  const dir = mkdtempSync(join(tmpdir(), "review-"));
  writeCards(dir, "TOR", [makeCard("TOR", "a")]);
  writeCards(dir, "BOS", [makeCard("BOS", "d")]);
  await runReview({
    dir,
    teams: ["TOR"],
    nextLine: scripted(["a"]),
    out: () => {},
    now: NOW,
  });
  assert.equal(Result.getOrThrow(readCards(dir, "TOR"))[0]?.status, "approved");
  assert.equal(Result.getOrThrow(readCards(dir, "BOS"))[0]?.status, "pending");
});

test("runReview shows each card before requesting an answer", async () => {
  const dir = mkdtempSync(join(tmpdir(), "review-"));
  writeCards(dir, "TOR", [makeCard("TOR", "a"), makeCard("TOR", "b")]);
  const events: string[] = [];
  const answers = ["a", "e"];
  await runReview({
    dir,
    out: (text) => events.push(`out:${text.split("\n")[0]}`),
    nextLine: async () => {
      events.push("read");
      return answers.shift();
    },
    now: NOW,
  });
  assert.deepEqual(events.slice(0, 4), [
    "out:[a] TOR (record)",
    "out:[a]pprove / [r]eject / [e] skip:",
    "read",
    "out:[b] TOR (record)",
  ]);
});

test("CLI prints the first card before stdin closes", async () => {
  const dir = mkdtempSync(join(tmpdir(), "review-"));
  writeCards(dir, "TOR", [makeCard("TOR", "a")]);
  const script = new URL("../scripts/review-insights.ts", import.meta.url)
    .pathname;
  const child = spawn(process.execPath, [script, "--dir", dir], {
    stdio: ["pipe", "pipe", "inherit"],
  });
  let output = "";
  const sawPrompt = Effect.runPromise(
    Effect.callback<void>((resume) => {
      child.stdout.on("data", (chunk: Buffer) => {
        output += chunk.toString();
        if (output.includes("skip:")) resume(Effect.void);
      });
    })
  );
  await sawPrompt; // stdin is still open here
  child.stdin.write("a\n");
  child.stdin.end();
  await Effect.runPromise(
    Effect.callback<void>((resume) => {
      child.on("close", () => resume(Effect.void));
    })
  );
  assert.match(output, /approved 1/);
  assert.equal(Result.getOrThrow(readCards(dir, "TOR"))[0]?.status, "approved");
});
