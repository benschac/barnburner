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
// commits keep the SHAs their checks ran on, and main shows them as they are, so a
// stack with merge commits is refused: rebase it instead.

import { NodeRuntime, NodeServices } from "@effect/platform-node";
import {
  Console,
  Effect,
  Match,
  Option,
  Path,
  Ref,
  Runtime,
  Schedule,
  Schema,
  Stream,
} from "effect";
import { Command, Flag } from "effect/cli";
import { ChildProcess, ChildProcessSpawner } from "effect/process";

import { loggerLayer } from "../lib/logger.mjs";
import {
  blockers,
  chainBreak,
  checkSummary,
  mergeBlocker,
  orderStack,
} from "./land-stack-plan.mjs";

const TRUNK = "main";
const REMOTE = "origin";
const LIST_LIMIT = 300;
const MERGE_WAIT = "2 minutes";
const MERGE_POLL = "5 seconds";

// Each expected failure logs its own message once through the shared logger (see `reportFailures`), so the
// runtime is told not to print it again.
export class MissingTopBranch extends Schema.TaggedError()("MissingTopBranch", {
  current: Schema.String,
}) {
  [Runtime.errorReported] = false;
  get message() {
    return `Name the top branch of the stack with --branch (current branch: ${this.current || "none"})`;
  }
}

export class TooManyPullRequests extends Schema.TaggedError()(
  "TooManyPullRequests",
  { limit: Schema.Number }
) {
  [Runtime.errorReported] = false;
  get message() {
    return `More than ${this.limit - 1} open pull requests; raise LIST_LIMIT`;
  }
}

export class StackNotFound extends Schema.TaggedError()("StackNotFound", {
  reason: Schema.String,
}) {
  [Runtime.errorReported] = false;
  get message() {
    return `Cannot find the stack: ${this.reason}`;
  }
}

export class StackBlocked extends Schema.TaggedError()("StackBlocked", {
  blocked: Schema.Number,
  total: Schema.Number,
}) {
  [Runtime.errorReported] = false;
  get message() {
    return `${this.blocked} of ${this.total} pull requests are blocked; nothing was changed`;
  }
}

export class PushRefused extends Schema.TaggedError()("PushRefused", {
  restored: Schema.Number,
  detail: Schema.String,
}) {
  [Runtime.errorReported] = false;
  get message() {
    return `Nothing landed; restored ${this.restored} base branches. ${this.detail}`;
  }
}

export class MergeNotRecorded extends Schema.TaggedError()("MergeNotRecorded", {
  numbers: Schema.Array(Schema.Number),
}) {
  [Runtime.errorReported] = false;
  get message() {
    const pulls = this.numbers.map((number) => `#${number}`).join(", ");
    return `The commits are on ${TRUNK}, but GitHub has not marked these merged: ${pulls}. Check them before closing by hand.`;
  }
}

export class CommandFailed extends Schema.TaggedError()("CommandFailed", {
  command: Schema.String,
  args: Schema.Array(Schema.String),
  exitCode: Schema.Number,
  stderr: Schema.String,
}) {
  [Runtime.errorReported] = false;
  get message() {
    const line = [this.command, ...this.args].join(" ");
    return `${line} exited with ${this.exitCode}${this.stderr ? `: ${this.stderr}` : ""}`;
  }
}

const reportFailures = Effect.tapErrorTag(
  [
    "MissingTopBranch",
    "TooManyPullRequests",
    "StackNotFound",
    "StackBlocked",
    "PushRefused",
    "MergeNotRecorded",
    "CommandFailed",
  ],
  (error) => Effect.logError(error.message)
);

// The fields of `gh pr list --json` that the plan reads. GitHub reports check runs and commit statuses in two shapes.
const CheckRun = Schema.Struct({
  __typename: Schema.Literal("CheckRun"),
  name: Schema.String,
  status: Schema.String,
  conclusion: Schema.String,
});
const StatusContext = Schema.Struct({
  __typename: Schema.Literal("StatusContext"),
  context: Schema.String,
  state: Schema.String,
});
const PullRequest = Schema.Struct({
  number: Schema.Number,
  title: Schema.String,
  headRefName: Schema.String,
  headRefOid: Schema.String,
  baseRefName: Schema.String,
  isCrossRepository: Schema.Boolean,
  isDraft: Schema.Boolean,
  reviewDecision: Schema.String,
  labels: Schema.Array(Schema.Struct({ name: Schema.String })),
  mergeable: Schema.String,
  statusCheckRollup: Schema.NullOr(
    Schema.Array(Schema.Union([CheckRun, StatusContext]))
  ),
});
const decodePullRequests = Schema.decodeUnknownEffect(
  Schema.fromJsonString(Schema.Array(PullRequest))
);
const PULL_FIELDS =
  "number,title,headRefName,headRefOid,baseRefName,isCrossRepository,isDraft,reviewDecision,labels,mergeable,statusCheckRollup";

const land = Effect.fn("land")(function* ({ branch, push }) {
  const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
  const path = yield* Path.Path;
  const repo = yield* path.fromFileUrl(new URL("../", import.meta.url));

  // Runs a command in the repository and returns its trimmed stdout; a non-zero exit fails with its stderr.
  const sh = (command, args) =>
    Effect.scoped(
      Effect.gen(function* () {
        const handle = yield* spawner.spawn(
          ChildProcess.make(command, args, { cwd: repo })
        );
        const [stdout, stderr, exitCode] = yield* Effect.all(
          [
            Stream.mkString(Stream.decodeText(handle.stdout)),
            Stream.mkString(Stream.decodeText(handle.stderr)),
            handle.exitCode,
          ],
          { concurrency: "unbounded" }
        );
        if (exitCode !== 0)
          return yield* new CommandFailed({
            command,
            args,
            exitCode,
            stderr: stderr.trim(),
          });
        return stdout.trim();
      })
    );
  const isAncestor = (a, b) => {
    const args = ["merge-base", "--is-ancestor", a, b];
    return spawner.exitCode(ChildProcess.make("git", args, { cwd: repo })).pipe(
      Effect.flatMap((exitCode) =>
        exitCode === 0
          ? Effect.succeed(true)
          : exitCode === 1
            ? Effect.succeed(false)
            : Effect.fail(
                new CommandFailed({
                  command: "git",
                  args,
                  exitCode,
                  stderr: "",
                })
              )
      )
    );
  };

  const top = Option.isSome(branch)
    ? branch.value
    : yield* sh("git", ["branch", "--show-current"]);
  if (!top || top === TRUNK)
    return yield* new MissingTopBranch({ current: top });

  yield* sh("git", ["fetch", "--quiet", REMOTE]);
  const trunkOid = yield* sh("git", ["rev-parse", `${REMOTE}/${TRUNK}`]);
  const pulls = yield* sh("gh", [
    "pr",
    "list",
    "--state",
    "open",
    "--limit",
    String(LIST_LIMIT),
    "--json",
    PULL_FIELDS,
  ]).pipe(Effect.flatMap(decodePullRequests));
  if (pulls.length === LIST_LIMIT)
    return yield* new TooManyPullRequests({ limit: LIST_LIMIT });

  const ordered = orderStack(pulls, top, TRUNK);
  if (!ordered.ok) return yield* new StackNotFound({ reason: ordered.reason });
  const { stack } = ordered;
  const tipPull = stack.at(-1);
  if (tipPull === undefined) {
    // defect: orderStack returns at least one pull request for a top branch that is not the trunk
    throw new Error("orderStack returned an empty stack");
  }
  const tip = tipPull.headRefOid;

  // chainBreak asks about each pull request and the one below it; answer every pair up front from git.
  const pairs = stack.map((pull, i) => [
    i === 0 ? trunkOid : stack[i - 1].headRefOid,
    pull.headRefOid,
  ]);
  const answers = yield* Effect.forEach(pairs, ([a, b]) => isAncestor(a, b), {
    concurrency: 4,
  });
  const ancestry = new Map(
    pairs.map(([a, b], i) => [`${a}..${b}`, answers[i]])
  );
  const broken = yield* Effect.promise(() =>
    chainBreak(
      stack,
      trunkOid,
      async (a, b) => ancestry.get(`${a}..${b}`) ?? false
    )
  );
  // The merge commits each pull request adds over the one below it, as "<sha> <subject>".
  const merges = yield* Effect.forEach(
    pairs,
    ([a, b]) =>
      sh("git", ["log", "--merges", "--format=%h %s", `${a}..${b}`]).pipe(
        Effect.map((out) => (out ? out.split("\n") : []))
      ),
    { concurrency: 4 }
  );

  const rows = stack.map((pull, i) => {
    const brokenReason =
      pull === broken
        ? [
            pull === stack[0]
              ? `does not sit on the current ${TRUNK}`
              : "does not sit on the pull request below it",
          ]
        : [];
    const mergeReason = mergeBlocker(merges[i]);
    return {
      pull,
      checks: checkSummary(pull),
      reasons: [
        ...brokenReason,
        ...(mergeReason ? [mergeReason] : []),
        ...blockers(pull),
      ],
    };
  });
  const blocked = rows.filter((row) => row.reasons.length).length;

  yield* Console.log(
    `Stack ending at ${top}: ${stack.length} pull requests onto ${TRUNK} (${trunkOid.slice(0, 7)})`
  );
  yield* Effect.forEach(
    rows,
    ({ pull, checks, reasons }) =>
      Effect.forEach(
        [
          `  #${pull.number} ${pull.headRefOid.slice(0, 7)} ${pull.headRefName}: ${pull.title}`,
          `      checks ${checks.passed.length} passed, ${checks.pending.length} pending, ${checks.failed.length} failed${reasons.length ? "" : "; ready"}`,
          ...reasons.map((reason) => `      blocked: ${reason}`),
        ],
        (line) => Console.log(line),
        { discard: true }
      ),
    { discard: true }
  );
  if (blocked) {
    if (broken || merges.some((list) => list.length)) {
      yield* Console.log(
        "Rebase and resubmit first: gt sync, gt restack, gt submit --stack, then wait for the checks. Do not merge a base branch in."
      );
    }
    return yield* new StackBlocked({ blocked, total: stack.length });
  }

  const retarget = stack.filter((pull) => pull.baseRefName !== TRUNK);
  if (!push) {
    yield* Console.log(
      `Ready. --push would retarget ${retarget.length} pull requests to ${TRUNK} and run: git push ${REMOTE} ${tip.slice(0, 7)}:refs/heads/${TRUNK}`
    );
    return;
  }

  const setBase = (pull, base) =>
    sh("gh", ["pr", "edit", String(pull.number), "--base", base]);
  const retargeted = yield* Ref.make([]);
  yield* Effect.forEach(
    retarget,
    (pull) =>
      setBase(pull, TRUNK).pipe(
        Effect.andThen(Ref.update(retargeted, (done) => [...done, pull]))
      ),
    { discard: true }
  ).pipe(
    // No force: git refuses unless this is a fast-forward of the remote main.
    Effect.andThen(sh("git", ["push", REMOTE, `${tip}:refs/heads/${TRUNK}`])),
    Effect.catch((failure) =>
      Effect.gen(function* () {
        const done = yield* Ref.get(retargeted);
        yield* Effect.forEach(done, (pull) => setBase(pull, pull.baseRefName), {
          discard: true,
        });
        const detail = Match.valueTags(failure, {
          CommandFailed: (failed) => failed.stderr || failed.message,
          PlatformError: (failed) => failed.message,
        });
        return yield* new PushRefused({ restored: done.length, detail });
      })
    )
  );
  yield* Effect.logInfo(
    `Pushed ${tip.slice(0, 7)} to ${TRUNK}; waiting for GitHub to mark ${stack.length} pull requests merged`
  );

  const stateOf = (pull) =>
    sh("gh", [
      "pr",
      "view",
      String(pull.number),
      "--json",
      "state",
      "--jq",
      ".state",
    ]);
  const open = yield* Ref.make(stack);
  const poll = Effect.gen(function* () {
    yield* Effect.sleep(MERGE_POLL);
    const waiting = yield* Ref.get(open);
    const states = yield* Effect.forEach(waiting, stateOf, {
      concurrency: "unbounded",
    });
    const still = waiting.filter((_, i) => states[i] !== "MERGED");
    yield* Ref.set(open, still);
    return still;
  });
  const unmerged = yield* poll.pipe(
    Effect.repeat({
      schedule: Schedule.during(MERGE_WAIT),
      until: (still) => still.length === 0,
    })
  );
  if (unmerged.length)
    return yield* new MergeNotRecorded({
      numbers: unmerged.map((pull) => pull.number),
    });
  yield* Console.log(
    `Landed ${stack.length} pull requests. Run gt sync to clean up local branches.`
  );
});

const command = Command.make(
  "land-stack",
  {
    branch: Flag.String("branch").pipe(
      Flag.withDescription(
        "Top branch of the stack (default: the current branch)"
      ),
      Flag.optional
    ),
    push: Flag.Boolean("push").pipe(
      Flag.withDescription(
        `Retarget the pull requests to ${TRUNK}, then fast-forward ${TRUNK} to the top of the stack`
      ),
      Flag.withDefault(false)
    ),
  },
  (input) => land(input).pipe(reportFailures)
).pipe(
  Command.withDescription(
    `Land a reviewed stack of pull requests on ${TRUNK} with one fast-forward push`
  )
);

const program = Command.run(command, { version: "1.0.0" }).pipe(
  Effect.provide(loggerLayer)
);

NodeRuntime.runMain(program.pipe(Effect.provide(NodeServices.layer)));
