import { Schema } from "effect";

import { Coverage } from "../src/shapes.ts";

export const EvalCase = Schema.Struct({
  id: Schema.String,
  team: Schema.String,
  question: Schema.String,
  truthSql: Schema.NullOr(Schema.String),
  expect: Schema.Literals(["value", "decline"]),
  tolerance: Schema.optionalKey(Schema.Finite),
  mustMentionCoverage: Schema.optionalKey(Schema.Boolean),
});
export type EvalCase = typeof EvalCase.Type;

export const EvalCases = Schema.Array(EvalCase);

// Tagged so graders branch with Match and a new answer kind fails to compile until handled.
export const EvalAnswered = Schema.TaggedStruct("Answered", {
  value: Schema.Finite,
  coverage: Schema.optionalKey(Schema.UndefinedOr(Coverage)),
});
export const EvalDeclined = Schema.TaggedStruct("Declined", {
  reason: Schema.optionalKey(Schema.UndefinedOr(Schema.String)),
});
export const EvalAnswer = Schema.Union([EvalAnswered, EvalDeclined]);
export type EvalAnswer = typeof EvalAnswer.Type;

export type Grade =
  | { readonly pass: true }
  | { readonly pass: false; readonly reason: string };
