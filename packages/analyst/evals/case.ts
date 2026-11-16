import { Schema } from 'effect'

export const EvalCase = Schema.Struct({
  id: Schema.String,
  team: Schema.String,
  question: Schema.String,
  truthSql: Schema.NullOr(Schema.String),
  expect: Schema.Literals(['value', 'decline']),
  tolerance: Schema.optionalKey(Schema.Finite),
  mustMentionCoverage: Schema.optionalKey(Schema.Boolean),
})
export type EvalCase = typeof EvalCase.Type

export const EvalCases = Schema.Array(EvalCase)

export type EvalAnswer =
  | { readonly value: number; readonly coverage?: { readonly archived: number; readonly finals: number } | undefined }
  | { readonly declined: true; readonly reason?: string | undefined }

export type Grade = { readonly pass: true } | { readonly pass: false; readonly reason: string }
