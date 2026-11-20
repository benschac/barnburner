import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import { Result } from "effect";

import { parseAnalystPlan } from "../plan-viewer/plan.ts";

const source = readFileSync(
  fileURLToPath(
    new URL("../../../docs/analyst-agent-plan.md", import.meta.url)
  ),
  "utf8"
);

const failure = (text: string) => {
  const parsed = parseAnalystPlan(text);
  assert.ok(Result.isFailure(parsed));
  return parsed.failure;
};

test("parseAnalystPlan parses the committed plan", () => {
  const parsed = parseAnalystPlan(source);
  assert.ok(Result.isSuccess(parsed));
  assert.ok(parsed.success.tasks.length > 0);
});

test("parseAnalystPlan names a missing section", () => {
  const error = failure(source.replace("\n## Ledger\n", "\n## Register\n"));
  assert.equal(error._tag, "PlanParseError");
  assert.equal(error.subject, "Ledger");
  assert.equal(error.message, "Missing source section: Ledger");
});

test("parseAnalystPlan names a duplicated ledger task", () => {
  const row = source.split("\n").find((line) => line.startsWith("| P-plan |"));
  assert.ok(row !== undefined);
  const error = failure(source.replace(row, `${row}\n${row}`));
  assert.equal(error.reason, "Duplicate ledger task ID");
  assert.equal(error.subject, "P-plan");
});
