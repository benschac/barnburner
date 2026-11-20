import assert from "node:assert/strict";
import test from "node:test";

import {
  blockers,
  chainBreak,
  checkSummary,
  mergeBlocker,
  orderStack,
} from "../scripts/land-stack-plan.mjs";

const pull = (number, headRefName, baseRefName, extra = {}) => ({
  number,
  headRefName,
  baseRefName,
  headRefOid: `oid-${number}`,
  isCrossRepository: false,
  isDraft: false,
  reviewDecision: "",
  labels: [{ name: "reviewed" }],
  mergeable: "MERGEABLE",
  statusCheckRollup: [
    {
      __typename: "CheckRun",
      name: "history",
      status: "COMPLETED",
      conclusion: "SUCCESS",
    },
  ],
  ...extra,
});

test("orderStack follows base branches from the top down to the trunk, bottom first", () => {
  const pulls = [
    pull(3, "c", "b"),
    pull(9, "other", "main"),
    pull(1, "a", "main"),
    pull(2, "b", "a"),
  ];
  const ordered = orderStack(pulls, "c", "main");
  assert.equal(ordered.ok, true);
  assert.deepEqual(
    ordered.stack.map((p) => p.number),
    [1, 2, 3]
  );
});

test("orderStack stops at a missing link instead of landing part of a stack", () => {
  assert.match(
    orderStack([pull(3, "c", "b")], "c", "main").reason,
    /#3 targets b/
  );
  assert.match(
    orderStack([], "c", "main").reason,
    /c has no open pull request/
  );
  assert.match(
    orderStack([pull(1, "a", "b"), pull(2, "b", "a")], "a", "main").reason,
    /loop/
  );
});

test("orderStack ignores a fork whose branch has the same name", () => {
  const ordered = orderStack(
    [pull(7, "a", "main", { isCrossRepository: true })],
    "a",
    "main"
  );
  assert.equal(ordered.ok, false);
});

test("a reviewed, mergeable pull request with passing checks has no blockers", () => {
  assert.deepEqual(blockers(pull(1, "a", "main")), []);
  assert.deepEqual(
    blockers(pull(1, "a", "main", { labels: [], reviewDecision: "APPROVED" })),
    []
  );
});

test("each unmet requirement blocks the pull request", () => {
  const blocks = (extra, pattern) =>
    assert.match(blockers(pull(1, "a", "main", extra)).join("; "), pattern);
  blocks({ isDraft: true }, /draft/);
  blocks({ labels: [] }, /not approved/);
  blocks(
    { labels: [{ name: "bug" }], reviewDecision: "CHANGES_REQUESTED" },
    /not approved/
  );
  blocks({ mergeable: "UNKNOWN" }, /mergeable state is UNKNOWN/);
  blocks({ mergeable: "CONFLICTING" }, /CONFLICTING/);
  blocks({ statusCheckRollup: [] }, /no checks/);
  blocks(
    {
      statusCheckRollup: [
        {
          __typename: "CheckRun",
          name: "history",
          status: "COMPLETED",
          conclusion: "FAILURE",
        },
      ],
    },
    /failed checks: history/
  );
  blocks(
    {
      statusCheckRollup: [
        {
          __typename: "CheckRun",
          name: "history",
          status: "IN_PROGRESS",
          conclusion: "",
        },
      ],
    },
    /pending checks: history/
  );
  blocks(
    {
      statusCheckRollup: [
        { __typename: "StatusContext", context: "Vercel", state: "ERROR" },
      ],
    },
    /failed checks: Vercel/
  );
  blocks(
    {
      statusCheckRollup: [
        { __typename: "StatusContext", context: "Vercel", state: "PENDING" },
      ],
    },
    /pending checks: Vercel/
  );
});

test("checkSummary counts skipped and neutral runs and successful statuses as passed", () => {
  const summary = checkSummary({
    statusCheckRollup: [
      {
        __typename: "CheckRun",
        name: "a",
        status: "COMPLETED",
        conclusion: "SKIPPED",
      },
      {
        __typename: "CheckRun",
        name: "b",
        status: "COMPLETED",
        conclusion: "NEUTRAL",
      },
      { __typename: "StatusContext", context: "c", state: "SUCCESS" },
    ],
  });
  assert.deepEqual(summary, {
    passed: ["a", "b", "c"],
    pending: [],
    failed: [],
  });
});

test("chainBreak names the first pull request that is not a straight line from the trunk", async () => {
  const stack = [pull(1, "a", "main"), pull(2, "b", "a"), pull(3, "c", "b")];
  const line = ["trunk", "oid-1", "oid-2", "oid-3"];
  const linear = async (a, b) =>
    line.indexOf(a) >= 0 && line.indexOf(a) < line.indexOf(b);
  assert.equal(await chainBreak(stack, "trunk", linear), undefined);
  // The trunk moved: the bottom no longer sits on it.
  assert.equal((await chainBreak(stack, "new-trunk", linear)).number, 1);
  // The middle was rebased without the top.
  const staleTop = async (a, b) =>
    a === "oid-2" && b === "oid-3" ? false : linear(a, b);
  assert.equal((await chainBreak(stack, "trunk", staleTop)).number, 3);
  // A pull request with no commits of its own has nothing to land.
  assert.equal(
    (
      await chainBreak(
        [pull(1, "a", "main", { headRefOid: "trunk" })],
        "trunk",
        linear
      )
    ).number,
    1
  );
});

test("mergeBlocker refuses a pull request whose commits include a merge, naming the first one", () => {
  assert.equal(mergeBlocker([]), undefined);
  assert.match(
    mergeBlocker(["d3bb427 Merge commit 'd181060' into HEAD"]),
    /has 1 merge commit \(d3bb427 Merge commit 'd181060' into HEAD\); rebase/
  );
  assert.match(
    mergeBlocker(["aaa Merge a", "bbb Merge b"]),
    /has 2 merge commits \(aaa Merge a, \.\.\.\)/
  );
});
