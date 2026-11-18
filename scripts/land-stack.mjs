// Land a reviewed stack of pull requests on main with one fast-forward push.
//
//   node scripts/land-stack.mjs [--branch <top branch>]          print the plan and what blocks it
//   node scripts/land-stack.mjs [--branch <top branch>] --push   retarget the pull requests to main, then push
//
// The stack is the chain of open pull requests from <top branch> (default: the
// current branch) down to main. It lands only when every pull request is
// approved or carries the "reviewed" label, has passing checks, and the chain
// is a straight line from the current main.
//
// GitHub marks a pull request merged when its head commits become reachable
// from its base branch, so each one is retargeted to main before the push. The
// commits keep the SHAs their checks ran on.
import { execFile } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import { logError, logInfo } from '../lib/logger.mjs'
import { blockers, chainBreak, checkSummary, orderStack, REVIEWED_LABEL } from './land-stack-plan.mjs'

const TRUNK = 'main'
const REMOTE = 'origin'
const LIST_LIMIT = 300
const MERGE_WAIT_MS = 120_000

const args = process.argv.slice(2)
const push = args.includes('--push')
const branchAt = args.indexOf('--branch')
const rest = args.filter((arg, i) => arg !== '--push' && i !== branchAt && (branchAt < 0 || i !== branchAt + 1))
if (rest.length || (branchAt >= 0 && !args[branchAt + 1])) {
  throw new Error('Usage: node scripts/land-stack.mjs [--branch <top branch>] [--push]')
}

const repo = fileURLToPath(new URL('../', import.meta.url))
const run = promisify(execFile)
const sh = async (command, commandArgs) => (await run(command, commandArgs, { cwd: repo, maxBuffer: 64 * 1024 * 1024 })).stdout.trim()
const print = (line = '') => process.stdout.write(`${line}\n`)
const isAncestor = (a, b) => run('git', ['merge-base', '--is-ancestor', a, b], { cwd: repo }).then(() => true, (failure) => {
  if (failure.code === 1) return false
  throw failure
})

const top = branchAt >= 0 ? args[branchAt + 1] : await sh('git', ['branch', '--show-current'])
if (!top || top === TRUNK) throw new Error(`Name the top branch of the stack with --branch (current branch: ${top || 'none'})`)

await sh('git', ['fetch', '--quiet', REMOTE])
const trunkOid = await sh('git', ['rev-parse', `${REMOTE}/${TRUNK}`])
const pulls = JSON.parse(await sh('gh', ['pr', 'list', '--state', 'open', '--limit', String(LIST_LIMIT), '--json',
  'number,title,headRefName,headRefOid,baseRefName,isCrossRepository,isDraft,reviewDecision,labels,mergeable,statusCheckRollup']))
if (pulls.length === LIST_LIMIT) throw new Error(`More than ${LIST_LIMIT - 1} open pull requests; raise LIST_LIMIT`)

const ordered = orderStack(pulls, top, TRUNK)
if (!ordered.ok) {
  logError(`Cannot find the stack: ${ordered.reason}`)
  process.exit(1)
}
const { stack } = ordered
const tip = stack.at(-1).headRefOid
const broken = await chainBreak(stack, trunkOid, isAncestor)

print(`Stack ending at ${top}: ${stack.length} pull requests onto ${TRUNK} (${trunkOid.slice(0, 7)})`)
let blocked = 0
for (const pull of stack) {
  const checks = checkSummary(pull)
  const reasons = blockers(pull)
  if (pull === broken) reasons.unshift(pull === stack[0] ? `does not sit on the current ${TRUNK}` : 'does not sit on the pull request below it')
  blocked += reasons.length ? 1 : 0
  print(`  #${pull.number} ${pull.headRefOid.slice(0, 7)} ${pull.headRefName}: ${pull.title}`)
  print(`      checks ${checks.passed.length} passed, ${checks.pending.length} pending, ${checks.failed.length} failed${reasons.length ? '' : '; ready'}`)
  for (const reason of reasons) print(`      blocked: ${reason}`)
}
if (blocked) {
  if (broken) print(`Rebase and resubmit first: gt sync, gt restack, gt submit --stack, then wait for the checks.`)
  logError(`${blocked} of ${stack.length} pull requests are blocked; nothing was changed`)
  process.exit(1)
}

const retarget = stack.filter((pull) => pull.baseRefName !== TRUNK)
if (!push) {
  print(`Ready. --push would retarget ${retarget.length} pull requests to ${TRUNK} and run: git push ${REMOTE} ${tip.slice(0, 7)}:refs/heads/${TRUNK}`)
  process.exit(0)
}

const setBase = (pull, base) => sh('gh', ['pr', 'edit', String(pull.number), '--base', base])
const retargeted = []
try {
  for (const pull of retarget) {
    await setBase(pull, TRUNK)
    retargeted.push(pull)
  }
  // No force: git refuses unless this is a fast-forward of the remote main.
  await sh('git', ['push', REMOTE, `${tip}:refs/heads/${TRUNK}`])
} catch (failure) {
  for (const pull of retargeted) await setBase(pull, pull.baseRefName)
  logError(`Nothing landed; restored ${retargeted.length} base branches. ${failure.stderr?.trim() || failure.message}`)
  process.exit(1)
}
logInfo(`Pushed ${tip.slice(0, 7)} to ${TRUNK}; waiting for GitHub to mark ${stack.length} pull requests merged`)

const stateOf = (pull) => sh('gh', ['pr', 'view', String(pull.number), '--json', 'state', '--jq', '.state'])
let open = stack
for (const deadline = Date.now() + MERGE_WAIT_MS; open.length && Date.now() < deadline;) {
  await new Promise((resolve) => setTimeout(resolve, 5_000))
  const states = await Promise.all(open.map(stateOf))
  open = open.filter((_, i) => states[i] !== 'MERGED')
}
if (open.length) {
  logError(`The commits are on ${TRUNK}, but GitHub has not marked these merged: ${open.map((pull) => `#${pull.number}`).join(', ')}. Check them before closing by hand.`)
  process.exit(1)
}
print(`Landed ${stack.length} pull requests. Run gt sync to clean up local branches.`)
