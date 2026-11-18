// Pure planning for scripts/land-stack.mjs: order a stack of pull requests and decide whether it may land.
// A pull request here is one item of `gh pr list --json`.

export const REVIEWED_LABEL = 'reviewed'

// The open pull requests from the trunk up to `top`, bottom first, found by following base branches.
export const orderStack = (pulls, top, trunk) => {
  const byHead = new Map(pulls.filter((pull) => !pull.isCrossRepository).map((pull) => [pull.headRefName, pull]))
  const stack = []
  for (let branch = top; branch !== trunk;) {
    const pull = byHead.get(branch)
    if (!pull) {
      const reason = stack.length
        ? `#${stack[0].number} targets ${branch}, which is not ${trunk} and has no open pull request`
        : `${branch} has no open pull request`
      return { ok: false, reason }
    }
    if (stack.includes(pull)) return { ok: false, reason: `the base branches loop at #${pull.number}` }
    stack.unshift(pull)
    branch = pull.baseRefName
  }
  return { ok: true, stack }
}

const passed = new Set(['SUCCESS', 'NEUTRAL', 'SKIPPED'])

// Sorts a pull request's checks into passed, pending, and failed names. GitHub reports check runs and commit statuses in two shapes.
export const checkSummary = (pull) => {
  const summary = { passed: [], pending: [], failed: [] }
  for (const check of pull.statusCheckRollup ?? []) {
    const run = check.__typename === 'CheckRun'
    const name = run ? check.name : check.context
    const done = run ? check.status === 'COMPLETED' : check.state !== 'PENDING' && check.state !== 'EXPECTED'
    const outcome = run ? check.conclusion : check.state
    summary[!done ? 'pending' : passed.has(outcome) ? 'passed' : 'failed'].push(name)
  }
  return summary
}

// Every reason a pull request may not land; an empty list means it may.
export const blockers = (pull) => {
  const reasons = []
  if (pull.isDraft) reasons.push('is a draft')
  const reviewed = pull.reviewDecision === 'APPROVED' || (pull.labels ?? []).some((label) => label.name === REVIEWED_LABEL)
  if (!reviewed) reasons.push(`is not approved and has no "${REVIEWED_LABEL}" label`)
  // GitHub starts workflows only after it has computed the merge, so anything else can hide checks that have not started.
  if (pull.mergeable !== 'MERGEABLE') reasons.push(`mergeable state is ${pull.mergeable}`)
  const checks = checkSummary(pull)
  if (checks.failed.length) reasons.push(`failed checks: ${checks.failed.join(', ')}`)
  if (checks.pending.length) reasons.push(`pending checks: ${checks.pending.join(', ')}`)
  if (!checks.failed.length && !checks.pending.length && !checks.passed.length) reasons.push('has no checks')
  return reasons
}

// The first pull request whose head does not sit on the one below it (the trunk for the bottom), or undefined
// when the whole stack is a straight line from the trunk. `isAncestor(a, b)` answers whether commit a is reachable from b.
export const chainBreak = async (stack, trunkOid, isAncestor) => {
  let below = trunkOid
  for (const pull of stack) {
    if (pull.headRefOid === below || !(await isAncestor(below, pull.headRefOid))) return pull
    below = pull.headRefOid
  }
  return undefined
}
