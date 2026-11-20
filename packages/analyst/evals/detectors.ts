import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { parseArgs } from "node:util";

import { NodeRuntime } from "@effect/platform-node";
import { Array, Cause, Console, DateTime, Effect, Schema } from "effect";

import type { CardDraft } from "../src/card.ts";
import { openDb } from "../src/db.ts";
import { extraTime } from "../src/detectors/extra-time.ts";
import { goalieStarts } from "../src/detectors/goalie-starts.ts";
import { homeAway } from "../src/detectors/home-away.ts";
import { lastTen } from "../src/detectors/last-ten.ts";
import { oneGoal } from "../src/detectors/one-goal.ts";
import { pointsLeader } from "../src/detectors/points-leader.ts";
import { streak } from "../src/detectors/streak.ts";
import { guardQuery } from "../src/guard.ts";
import type { Db, Guard, Verify } from "../src/shapes.ts";
import { fillCard } from "../src/tools/submit-card.ts";
import type { CardMeta } from "../src/tools/submit-card.ts";
import { verifyCard } from "../src/verify.ts";
import { scoreCards } from "./card-pass-rate.ts";

export class EvalDetectorsError extends Schema.TaggedError<
  EvalDetectorsError,
  { readonly brand: unique symbol }
>()("EvalDetectorsError", {
  message: Schema.String,
}) {}

const TeamsFile = Schema.Array(Schema.Struct({ abbrev: Schema.String }));

export interface DetectorDef {
  readonly name: string;
  readonly run: (team: string) => CardDraft[];
}

export const DETECTORS: readonly DetectorDef[] = [
  { name: "extraTime", run: extraTime },
  { name: "goalieStarts", run: goalieStarts },
  { name: "homeAway", run: homeAway },
  { name: "lastTen", run: lastTen },
  { name: "oneGoal", run: oneGoal },
  { name: "pointsLeader", run: pointsLeader },
  { name: "streak", run: streak },
];

// Check 0 is not a verifier check. It counts drafts that fillCard refused (guard or SQL failure) before verification.
export const FILL_CHECK = 0;

export interface DetectorFailure {
  readonly team: string;
  readonly detector: string;
  readonly check: number;
  readonly detail: string;
}

export interface DetectorScore {
  readonly total: number;
  readonly passed: number;
  readonly passRate: number;
}

export interface DetectorReport {
  readonly teams: number;
  readonly total: number;
  readonly passed: number;
  readonly passRate: number;
  readonly byDetector: Readonly<Record<string, DetectorScore>>;
  // Failing cards keyed by check; FILL_CHECK for drafts that could not be filled.
  readonly failuresByCheck: Readonly<Record<number, number>>;
  readonly failures: readonly DetectorFailure[];
}

interface Tally {
  total: number;
  passed: number;
  failuresByCheck: Record<number, number>;
}

const readTeams = (dataDir: string) =>
  Effect.gen(function* () {
    const text = yield* Effect.tryPromise({
      try: () => readFile(join(dataDir, "teams.json"), "utf-8"),
      catch: (cause) =>
        new EvalDetectorsError({
          message: `cannot read teams.json: ${String(cause)}`,
        }),
    });

    const teams = yield* Schema.decodeUnknownEffect(
      Schema.fromJsonString(TeamsFile)
    )(text).pipe(
      Effect.mapError(
        (error) =>
          new EvalDetectorsError({ message: `teams.json: ${error.message}` })
      )
    );

    return teams.map((team) => team.abbrev);
  });

const addCounts = (
  target: Record<number, number>,
  counts: Readonly<Record<number, number>>
) => {
  for (const [check, count] of Object.entries(counts)) {
    const key = Number(check);
    target[key] = (target[key] ?? 0) + count;
  }
};

const rate = (passed: number, total: number) =>
  total === 0 ? 0 : passed / total;

const evaluateTeam = (
  deps: { db: Db; guard: Guard },
  detector: DetectorDef,
  team: string,
  meta: CardMeta,
  finals: ReadonlySet<number>
) =>
  Effect.gen(function* () {
    const drafts = detector.run(team);
    const outcomes = yield* Effect.forEach(drafts, (draft) =>
      Effect.result(fillCard(deps, draft, meta))
    );
    const [cards, errors] = Array.separate(outcomes);

    const failures: DetectorFailure[] = errors.map((error) => ({
      team,
      detector: detector.name,
      check: FILL_CHECK,
      detail: error.message,
    }));

    const verify: Verify = (card, finalIds) =>
      verifyCard(deps, card, finalIds).pipe(
        Effect.map((result) => {
          if (!result.ok)
            failures.push({
              team,
              detector: detector.name,
              check: result.check,
              detail: result.detail,
            });

          return result;
        })
      );

    const score = yield* scoreCards(cards, verify, finals);
    const failuresByCheck = { ...score.failuresByCheck };

    if (errors.length > 0) failuresByCheck[FILL_CHECK] = errors.length;

    return {
      total: drafts.length,
      passed: score.passed,
      failuresByCheck,
      failures,
    };
  });

// Runs every detector for every team in data/teams.json through fillCard and verifyCard, then scores the cards.
export const runDetectorEval = (input: { readonly dataDir: string }) =>
  Effect.scoped(
    Effect.gen(function* () {
      const dataDir = resolve(input.dataDir);
      const teams = yield* readTeams(dataDir);
      const db = yield* openDb({ dataDir });
      const deps = { db, guard: guardQuery };
      const finalRows = (yield* db.query(
        "SELECT DISTINCT game_id FROM team_games WHERE is_final"
      )).rows;
      const ids = finalRows
        .map((row) => row["game_id"])
        .filter(Schema.is(Schema.Number));
      const finals = new Set(ids);
      const fetchedAt = yield* Effect.map(DateTime.now, DateTime.formatIso);

      const meta: CardMeta = {
        model: "detectors",
        runId: "detectors",
        asOf: { fetchedAt, completedGameIds: finals.size },
      };

      const byDetector: Record<string, DetectorScore> = {};
      const overall: Tally = { total: 0, passed: 0, failuresByCheck: {} };
      const failures: DetectorFailure[] = [];

      yield* Effect.forEach(
        DETECTORS,
        (detector) =>
          Effect.gen(function* () {
            const scores = yield* Effect.forEach(teams, (team) =>
              evaluateTeam(deps, detector, team, meta, finals)
            );
            let total = 0;
            let passed = 0;

            for (const score of scores) {
              total += score.total;
              passed += score.passed;
              addCounts(overall.failuresByCheck, score.failuresByCheck);
              failures.push(...score.failures);
            }

            byDetector[detector.name] = {
              total,
              passed,
              passRate: rate(passed, total),
            };
            overall.total += total;
            overall.passed += passed;
          }),
        { discard: true }
      );

      return {
        teams: teams.length,
        ...overall,
        passRate: rate(overall.passed, overall.total),
        byDetector,
        failures,
      } satisfies DetectorReport;
    })
  );

const checkLabel = (check: number): string =>
  check === FILL_CHECK ? "fill (draft could not be filled)" : `check ${check}`;

export const formatReport = (report: DetectorReport): string => {
  const pct = (rate: number) => `${(rate * 100).toFixed(1)}%`;
  const checks = Object.entries(report.failuresByCheck).map(
    ([check, count]) => `  ${checkLabel(Number(check))}: ${count}`
  );
  const cards = report.failures.map(
    (f) => `  ${f.team} ${f.detector} ${checkLabel(f.check)}: ${f.detail}`
  );

  if (checks.length === 0) checks.push("  none");

  if (cards.length === 0) cards.push("  none");

  const lines = [
    `Pass rate: ${report.passed}/${report.total} = ${pct(report.passRate)} across ${report.teams} teams`,
    "",
    "By detector:",
    ...Object.entries(report.byDetector).map(
      ([name, s]) => `  ${name}: ${s.passed}/${s.total} = ${pct(s.passRate)}`
    ),
    "",
    "Failures by check:",
    ...checks,
    "",
    "Failing cards:",
    ...cards,
  ];

  return lines.join("\n");
};

export const runCli = (
  args: readonly string[],
  out: (text: string) => void = console.log
) =>
  Effect.gen(function* () {
    const parsed = yield* Effect.try({
      try: () =>
        parseArgs({
          args: [...args],
          options: { "data-dir": { type: "string" } },
          strict: true,
        }),
      catch: (cause) => new EvalDetectorsError({ message: String(cause) }),
    });

    const dataDir =
      parsed.values["data-dir"] ??
      resolve(import.meta.dirname, "../../../data");
    const report = yield* runDetectorEval({ dataDir });
    out(formatReport(report));
  });

if (process.argv[1] && resolve(process.argv[1]) === import.meta.filename) {
  const program = runCli(process.argv.slice(2)).pipe(
    Effect.tapCause((cause) => Console.error(String(Cause.squash(cause))))
  );

  NodeRuntime.runMain(program, { disableErrorReporting: true });
}
