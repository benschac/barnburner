import { Match } from 'effect'
import type { EvalAnswer, EvalCase, Grade } from './case.ts'

type GradedCase = Pick<EvalCase, 'expect' | 'tolerance' | 'mustMentionCoverage'>
type Answered = Extract<EvalAnswer, { readonly _tag: 'Answered' }>

const pass: Grade = { pass: true }
const fail = (reason: string): Grade => ({ pass: false, reason })

// Compares a stated value with the truth cell: integers exactly, decimals within the case tolerance.
const gradeValue = (evalCase: GradedCase, truth: number | null, answer: Answered): Grade => {
  if (truth === null) return fail('case expects a value but no truth value was supplied')
  if (!Number.isFinite(truth)) return fail('truth value is not a finite number')
  if (!Number.isFinite(answer.value)) return fail('answer value is not a finite number')

  if (Number.isInteger(truth)) {
    if (answer.value !== truth) return fail(`expected ${truth} exactly, got ${answer.value}`)
  } else {
    const tolerance = evalCase.tolerance ?? 0
    const epsilon = Number.EPSILON * 8 * Math.max(1, Math.abs(truth), Math.abs(answer.value))
    if (Math.abs(answer.value - truth) > tolerance + epsilon) {
      return fail(`expected ${truth} within ${tolerance}, got ${answer.value}`)
    }
  }

  if (evalCase.mustMentionCoverage === true && (answer.coverage === undefined || !Number.isFinite(answer.coverage.archived) || !Number.isFinite(answer.coverage.finals))) {
    return fail('answer must state its coverage')
  }
  return pass
}

// Pure grading of one Q&A case. `truth` is the single `value` cell from truthSql (null for decline cases).
export const grade = (evalCase: GradedCase, truth: number | null, answer: EvalAnswer): Grade =>
  Match.valueTags(answer, {
    Declined: () => (evalCase.expect === 'decline' ? pass : fail('agent declined a question that has an answer')),
    Answered: (answered) =>
      evalCase.expect === 'decline' ? fail('expected a decline but the agent answered') : gradeValue(evalCase, truth, answered),
  })
