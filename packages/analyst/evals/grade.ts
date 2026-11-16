import type { EvalAnswer, EvalCase, Grade } from './case.ts'

const fail = (reason: string): Grade => ({ pass: false, reason })

// Pure grading of one Q&A case. `truth` is the single `value` cell from truthSql (null for decline cases).
export const grade = (
  evalCase: Pick<EvalCase, 'expect' | 'tolerance' | 'mustMentionCoverage'>,
  truth: number | null,
  answer: EvalAnswer,
): Grade => {
  const declined = 'declined' in answer
  if (evalCase.expect === 'decline') {
    return declined ? { pass: true } : fail('expected a decline but the agent answered')
  }
  if (declined) return fail('agent declined a question that has an answer')
  if (truth === null) return fail('case expects a value but no truth value was supplied')
  if (!Number.isFinite(answer.value)) return fail('answer value is not a finite number')

  if (Number.isInteger(truth)) {
    if (answer.value !== truth) return fail(`expected ${truth} exactly, got ${answer.value}`)
  } else {
    const tolerance = evalCase.tolerance ?? 0
    if (Math.abs(answer.value - truth) > tolerance) {
      return fail(`expected ${truth} within ${tolerance}, got ${answer.value}`)
    }
  }

  if (evalCase.mustMentionCoverage === true && (answer.coverage === undefined || !Number.isFinite(answer.coverage.archived) || !Number.isFinite(answer.coverage.finals))) {
    return fail('answer must state its coverage')
  }
  return { pass: true }
}
