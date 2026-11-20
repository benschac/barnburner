import assert from "node:assert/strict";
import { test } from "node:test";

import type { Tables } from "@nhl-reddit-stats/viz";
import { chainSample } from "@nhl-reddit-stats/viz/samples";
import { MockLanguageModelV4 } from "ai/test";
import { Effect, Schema } from "effect";

import { Llm } from "../src/llm.ts";
import {
  ViewCodeError,
  describeTables,
  generateChecked,
  generateView,
  repairView,
} from "../src/viz/generate.ts";

const usage = {
  inputTokens: {
    total: 10,
    noCache: 10,
    cacheRead: undefined,
    cacheWrite: undefined,
  },
  outputTokens: { total: 5, text: 5, reasoning: undefined },
};
const reply = (code: string) => JSON.stringify({ title: "T", code });
const stub = (texts: readonly string[]) => {
  let n = 0;
  return new MockLanguageModelV4({
    doGenerate: async () => ({
      content: [{ type: "text", text: texts[Math.min(n++, texts.length - 1)] }],
      finishReason: { unified: "stop", raw: undefined },
      usage,
      warnings: [],
    }),
  });
};
const run = <A, E>(e: Effect.Effect<A, E, Llm>) =>
  Effect.runPromise(e.pipe(Effect.provide(Llm.layer())));
const base = {
  prompt: "p",
  tables: chainSample.tables,
  notes: chainSample.notes,
  system: "sys",
};
const good = "export default function view() { return () => {} }";
const bad = 'import x from "y"\nexport default 1';

test("generateView returns title, code, model and usage", async () => {
  const model = stub([reply(good)]);
  const out = await run(generateView({ ...base, model }));
  assert.equal(out.title, "T");
  assert.equal(out.code, good);
  assert.equal(model.doGenerateCalls.length, 1);
});

test("generateView summarises a 1,000-row table: three rows, the count and the columns", async () => {
  const row = (i: number): Tables[string][number] => {
    const base: Record<string, string | number | null> = {
      id: i,
      team: `team-${i}`,
    };
    if (i === 3) base.late = 1;
    return base;
  };
  const rows: Tables[string] = Array.from({ length: 1000 }, (_, i) => row(i));
  const model = stub([reply(good)]);
  await run(generateView({ ...base, tables: { games: rows }, model }));
  const prompt = JSON.stringify(model.doGenerateCalls[0].prompt);
  assert.match(prompt, /1000/);
  assert.match(prompt, /team-0/);
  assert.match(prompt, /team-2\\"/);
  assert.doesNotMatch(prompt, /team-3\\"/);
  assert.doesNotMatch(prompt, /team-999/);
  assert.deepEqual(describeTables({ games: rows })[0].columns, [
    "id",
    "team",
    "late",
  ]);
});

test("repairView sends the failure text", async () => {
  const model = stub([reply(good)]);
  await run(repairView({ code: bad, failure: "boom", system: "sys", model }));
  assert.match(JSON.stringify(model.doGenerateCalls[0].prompt), /boom/);
});

test("generateChecked: clean first answer makes one call", async () => {
  const model = stub([reply(good)]);
  const out = await run(generateChecked({ ...base, model }));
  assert.equal(out.code, good);
  assert.equal(out.repairs, 0);
  assert.equal(model.doGenerateCalls.length, 1);
});

test("generateChecked: one repaired answer", async () => {
  const model = stub([reply(bad), reply(good)]);
  const out = await run(generateChecked({ ...base, model }));
  assert.equal(out.code, good);
  assert.equal(out.repairs, 1);
  assert.equal(model.doGenerateCalls.length, 2);
  assert.match(JSON.stringify(model.doGenerateCalls[1].prompt), /not allowed/);
});

test("generateChecked: three bad answers fail after two repairs", async () => {
  const model = stub([reply(bad)]);
  const error = await run(
    generateChecked({ ...base, model }).pipe(Effect.flip)
  );
  assert.ok(Schema.is(ViewCodeError)(error));
  assert.equal(error.attempts, 3);
  assert.equal(error.inputTokens, 30);
  assert.equal(error.outputTokens, 15);
  assert.equal(error.totalTokens, 45);
  assert.equal(typeof error.model, "string");
  assert.equal(model.doGenerateCalls.length, 3);
});
