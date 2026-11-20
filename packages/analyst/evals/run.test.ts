import assert from "node:assert/strict";
import {
  mkdtemp,
  writeFile,
  rm,
  mkdir,
  readdir,
  readFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import { Effect } from "effect";

import type { AskResult } from "../src/ask.ts";
import type { Db } from "../src/shapes.ts";
import { evaluate, loadCases, runCli, snapshotImplementation } from "./run.ts";

const db: Db = {
  query: () => Effect.succeed({ rows: [{ value: 3 }], rowCount: 1 }),
  queryCanonical: () => Effect.succeed({ rows: [{ value: 3 }], rowCount: 1 }),
};
const metadata = {
  runId: "test",
  model: "mock",
  steps: 1,
  inputTokens: 10,
  outputTokens: 5,
  latencyMs: 2,
};

test("eval CLI counts crashes as failures, not successful declines, and retains measurements", async () => {
  const report = await Effect.runPromise(
    evaluate({
      db,
      cases: [
        {
          id: "decline",
          team: "NJD",
          question: "q",
          truthSql: null,
          expect: "decline",
        },
      ],
      answer: () =>
        Effect.succeed<AskResult>({
          ...metadata,
          outcome: { _tag: "Crashed", reason: "provider failed" },
        }),
    })
  );
  assert.equal(report.passed, 0);
  assert.match(report.results[0].reason ?? "", /provider failed/);
  assert.equal(report.runs[0].run.inputTokens, 10);
});

test("eval CLI identifies invalid fixtures without calling the model", async () => {
  let calls = 0;
  const report = await Effect.runPromise(
    evaluate({
      db,
      cases: [
        {
          id: "invalid",
          team: "NJD",
          question: "q",
          truthSql: null,
          expect: "value",
        },
      ],
      answer: () => {
        calls++;
        return Effect.succeed<AskResult>({
          ...metadata,
          outcome: { _tag: "Declined", reason: "no" },
        });
      },
    })
  );
  assert.equal(report.invalidFixtures, 1);
  assert.equal(calls, 0);
});

test("eval cases are schema validated and content hashed", async () => {
  const dir = await mkdtemp(join(tmpdir(), "analyst-evals-"));
  try {
    await writeFile(
      join(dir, "one.json"),
      JSON.stringify([
        {
          id: "x",
          team: "NJD",
          question: "q",
          truthSql: null,
          expect: "decline",
        },
      ])
    );
    const loaded = await Effect.runPromise(loadCases(dir));
    assert.equal(loaded.cases.length, 1);
    assert.match(loaded.files[0].sha256, /^[a-f0-9]{64}$/);
    await writeFile(join(dir, "one.json"), "{}");
    const error = await Effect.runPromise(loadCases(dir).pipe(Effect.flip));
    assert.match(error.message, /one.json/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("eval CLI help does not open a database or call a provider", async () => {
  const lines: string[] = [];
  await Effect.runPromise(runCli(["--help"], (text) => lines.push(text)));
  assert.match(lines[0], /--data-dir/);
  const error = await Effect.runPromise(runCli([]).pipe(Effect.flip));
  assert.match(error.message, /--data-dir is required/);
});

test("eval CLI persists an explicitly offline receipt with data and prompt hashes", async () => {
  const dir = await mkdtemp(join(tmpdir(), "analyst-receipt-"));
  try {
    const casesDir = join(dir, "cases");
    await mkdir(casesDir);
    await writeFile(
      join(casesDir, "cases.json"),
      JSON.stringify([
        {
          id: "x",
          team: "NJD",
          question: "q",
          truthSql: null,
          expect: "decline",
        },
      ])
    );
    await Effect.runPromise(
      runCli(
        [
          "--data-dir",
          new URL("../tests/fixtures/data", import.meta.url).pathname,
          "--cases-dir",
          casesDir,
          "--output-dir",
          dir,
        ],
        () => {},
        {
          mode: "offline",
          answer: () =>
            Effect.succeed({
              ...metadata,
              outcome: { _tag: "Declined", reason: "out of scope" },
            }),
        }
      )
    );
    const name = (await readdir(dir)).find((name) =>
      name.endsWith("-agent.json")
    );
    assert.ok(name);
    const receipt = JSON.parse(await readFile(join(dir, name), "utf8"));
    assert.equal(receipt.runtime.version, process.version);
    assert.ok(
      receipt.implementation.some(
        (file: { file: string }) => file.file === "bun.lock"
      )
    );
    assert.ok(
      receipt.implementation.some(
        (file: { file: string }) =>
          file.file === "packages/analyst/src/views/10-team-games.sql"
      )
    );
    assert.equal(receipt.mode, "offline");
    assert.equal(receipt.passed, 1);
    assert.equal(receipt.runs[0].run.inputTokens, 10);
    assert.match(receipt.systemPromptSha256, /^[a-f0-9]{64}$/);
    assert.ok(
      receipt.dataSnapshot.some(
        (file: { file: string }) => file.file === "teams.json"
      )
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("implementation fingerprint changes when SQL views or code changes", async () => {
  const root = await mkdtemp(join(tmpdir(), "analyst-code-"));
  try {
    await mkdir(join(root, "packages/analyst/src/views"), { recursive: true });
    await mkdir(join(root, "packages/analyst/evals"), { recursive: true });
    const names = [
      "bun.lock",
      "package.json",
      "packages/analyst/package.json",
      ...["run.ts", "runner.ts", "grade.ts", "case.ts"].map(
        (file) => `packages/analyst/evals/${file}`
      ),
      "packages/analyst/src/views/example.sql",
      "packages/analyst/src/guard.ts",
    ];
    for (const file of names) await writeFile(join(root, file), "original");
    const before = await Effect.runPromise(snapshotImplementation(root));
    await writeFile(
      join(root, "packages/analyst/src/views/example.sql"),
      "SELECT changed"
    );
    const changedView = await Effect.runPromise(snapshotImplementation(root));
    assert.notDeepEqual(changedView, before);
    await writeFile(
      join(root, "packages/analyst/src/guard.ts"),
      "changed guard"
    );
    const changedCode = await Effect.runPromise(snapshotImplementation(root));
    assert.notDeepEqual(changedCode, changedView);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
