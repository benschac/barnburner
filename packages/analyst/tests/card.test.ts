import assert from "node:assert/strict";
import { test } from "node:test";

import { Schema } from "effect";

import { cardId, CardDraft, InsightCard } from "../src/card.ts";

const base = {
  id: cardId("NJD", "SELECT 1 AS wins", "{wins} wins"),
  team: "NJD",
  status: "pending",
  kind: "record",
  headline: "{wins} wins",
  body: "Won {wins}.",
  bindings: { wins: { column: "wins", row: 0 } },
  evidence: { query: "SELECT 1 AS wins", result: [{ wins: 1 }], gameIds: [] },
  asOf: { fetchedAt: "2026-11-16T00:00:00Z", completedGameIds: 12 },
  model: "test",
  runId: "run-1",
};

test("decodes a valid card", () => {
  const card = Schema.decodeUnknownSync(InsightCard)(base);
  assert.equal(card.team, "NJD");
});

test("rejects a comparative card with no assert", () => {
  assert.throws(() =>
    Schema.decodeUnknownSync(InsightCard)({ ...base, kind: "comparative" })
  );
  assert.doesNotThrow(() =>
    Schema.decodeUnknownSync(InsightCard)({
      ...base,
      kind: "comparative",
      assert: "SELECT true",
    })
  );
});

test("rejects a result with an object cell", () => {
  const bad = {
    ...base,
    evidence: { ...base.evidence, result: [{ wins: { n: 1 } }] },
  };
  assert.throws(() => Schema.decodeUnknownSync(InsightCard)(bad));
});

test("drafts decode without system fields", () => {
  const { team, kind, headline, body, bindings } = base;
  const draft = {
    team,
    kind,
    headline,
    body,
    bindings,
    evidence: { query: "SELECT 1 AS wins" },
  };
  assert.doesNotThrow(() => Schema.decodeUnknownSync(CardDraft)(draft));
  assert.throws(() =>
    Schema.decodeUnknownSync(CardDraft)({ ...draft, kind: "comparative" })
  );
});

test("card id is stable", () => {
  assert.equal(cardId("NJD", "q", "h"), cardId("NJD", "q", "h"));
  assert.match(cardId("NJD", "q", "h"), /^[0-9a-f]{16}$/);
  assert.notEqual(cardId("NJD", "q", "h"), cardId("NYR", "q", "h"));
});
