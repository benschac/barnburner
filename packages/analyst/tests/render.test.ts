import assert from "node:assert/strict";
import { test } from "node:test";

import { Result, Schema } from "effect";

import {
  literalDigits,
  MissingCellError,
  render,
  UnknownPlaceholderError,
} from "../src/render.ts";
import type { Binding, Row } from "../src/render.ts";

const rows: Row[] = [
  { team: "Boston", goals: 4, win: true, note: null },
  { team: "Toronto", goals: 2, win: false, note: "pp2" },
];

const bindings = {
  team: { column: "team", row: 0 },
  goals: { column: "goals", row: 0 },
  opp: { column: "team", row: 1 },
  p2: { column: "goals", row: 1 },
} satisfies Record<string, Binding>;

function failure<A, E>(result: Result.Result<A, E>): E {
  assert.ok(Result.isFailure(result));
  return result.failure;
}

test("replaces placeholders with the bound cell", () => {
  assert.deepEqual(
    render("{team} scored {goals}", bindings, rows),
    Result.succeed("Boston scored 4")
  );
});

test("a repeated placeholder renders each time", () => {
  assert.deepEqual(
    render("{team}/{team}", bindings, rows),
    Result.succeed("Boston/Boston")
  );
});

test("nested braces keep the outer braces as literal text", () => {
  assert.deepEqual(
    render("{{team}}", bindings, rows),
    Result.succeed("{Boston}")
  );
  assert.deepEqual(
    render("{a{goals}}", bindings, rows),
    Result.succeed("{a4}")
  );
});

test("a lone brace that is not a placeholder is literal", () => {
  assert.deepEqual(
    render("{ 1 } } {", bindings, rows),
    Result.succeed("{ 1 } } {")
  );
});

test("boolean cells render as text", () => {
  assert.deepEqual(
    render("win={win}", { win: { column: "win", row: 0 } }, rows),
    Result.succeed("win=true")
  );
});

test("a digit inside a placeholder name is a valid name", () => {
  assert.deepEqual(render("{p2}", bindings, rows), Result.succeed("2"));
});

test("an unknown placeholder fails with UnknownPlaceholderError", () => {
  const error = failure(render("{missing}", bindings, rows));
  assert.ok(Schema.is(UnknownPlaceholderError)(error));
  assert.equal(error._tag, "UnknownPlaceholderError");
  assert.equal(error.placeholder, "missing");
  assert.equal(error.message, "Template placeholder {missing} has no binding");
});

test("a missing column fails with MissingCellError", () => {
  const bad = { gone: { column: "nope", row: 0 } };
  const error = failure(render("{gone}", bad, rows));
  assert.ok(Schema.is(MissingCellError)(error));
  assert.equal(error._tag, "MissingCellError");
  assert.deepEqual(
    [error.placeholder, error.column, error.row],
    ["gone", "nope", 0]
  );
  assert.equal(
    error.message,
    'Template placeholder {gone} needs a value at row 0, column "nope", but that cell is missing or null'
  );
});

test("a null cell counts as missing", () => {
  const bad = { note: { column: "note", row: 0 } };
  assert.equal(failure(render("{note}", bad, rows))._tag, "MissingCellError");
});

test("a row index out of range fails with MissingCellError", () => {
  const bad = { team: { column: "team", row: 5 } };
  assert.equal(failure(render("{team}", bad, rows))._tag, "MissingCellError");
});

test("the first failing placeholder is reported and nothing throws", () => {
  const error = failure(
    render(
      "{team} {missing} {gone}",
      { ...bindings, gone: { column: "nope", row: 0 } },
      rows
    )
  );
  assert.equal(error._tag, "UnknownPlaceholderError");
});

test("literalDigits ignores digits inside placeholders", () => {
  assert.deepEqual(literalDigits("{p2} and {goals1}"), []);
});

test("literalDigits returns every digit outside placeholders", () => {
  assert.deepEqual(literalDigits("Top 10 in {team} 2026"), [
    "1",
    "0",
    "2",
    "0",
    "2",
    "6",
  ]);
});

test("literalDigits counts digits in literal braces", () => {
  assert.deepEqual(literalDigits("{ 7 } {x}"), ["7"]);
});
