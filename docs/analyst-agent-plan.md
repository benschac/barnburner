# RinkSide analyst agent: implementation plan

Status: ready to start, Nov 16 2026. Owner: Ben.
Source spec: [analyst-agent-spec.md](analyst-agent-spec.md). This plan makes the decisions below and splits the work into small PRs that land on their own. Where they differ, this plan wins.

## How to use this plan

- Each task card (§Task cards) is a complete prompt for one worker. §Worker preamble applies to every card.
- A task is **ready** when every ID on its **Needs** line is merged to `main`. There are no waves: the orchestrator dispatches any ready task, and each PR merges as soon as it is green and reviewed.
- §Contracts defines every shared shape. Cards point at one contract section instead of the whole spec.
- Track progress in §Ledger. Update it whenever a PR opens or merges.

## Decisions (changes from the spec)

| # | Decision | Reason |
| --- | --- | --- |
| D1 | Backfill box scores before the agent work starts (task **DATA1**). | 160 of 330 finals are archived (48%). Player and goalie cards are weak until coverage is close to complete. |
| D2 | No Vercel Sandbox, `bash`, or `read_file` in v1. The agent gets one `sql` tool against an in-process DuckDB. | The data is public and SQL is enough. Without bash, every claim stays a SQL query that can be rerun. Revisit for the public Ask box in P3. |
| D3 | Evidence queries are a single `SELECT` over the known tables. The system, not the model, fixes row order: every evidence query runs as `SELECT * FROM (<query>) ORDER BY ALL`. Percentages are rounded inside the SQL. | The verifier compares the rerun result exactly. A model-written `ORDER BY` still lets tied rows swap; ordering by every column cannot. **DEP1** confirms the wrapper works. |
| D4 | `assert` is required for comparative claims (rank, "best", "first since", streaks). | Otherwise the staleness recheck could keep a card approved after its claim stops being true. |
| D5 | Hand-written SQL detectors (**X1–X3**) come before the LLM generator. They are scored by verify pass rate (**E8**), the same score the generator gets. | They show how much the agent adds beyond choosing and wording insights, and they exercise the verifier without a model. Detectors produce cards, not answers, so the Q&A evals don't apply to them. |
| D6 | Eval cases are JSON, not YAML. Expected values come from running the ground-truth SQL at eval time. | JSON needs no parser dependency. Running the SQL at eval time keeps expected values from drifting as the data refreshes daily. |
| D7 | One derived table per SQL file (`src/views/NN-name.sql`), loaded in sorted order. One tool, detector, and check per source file. No barrel files; import by path. | Parallel tasks then add new files instead of editing the same ones. |
| D8 | Every limit in the spec (10 s timeout, 200-row cap, 25-step cap, 6 cards) is a starting guess. **G4b** measures them before any is tightened. | Ratstack: measure before setting a timeout or cap. |
| D9 | The derived "views" are loaded as tables at open. Then `openDb` sets `enable_external_access=false` and locks the configuration. | An in-memory DuckDB can still `COPY TO` a file. Lazy views over `read_json` would stop working once file access is off, so the data is read once, up front. **DEP1** confirms this; if it fails, stop and re-plan C-db. |
| D10 | Shapes land before behaviour. **K1** commits every shared type and a fake `Db`; consumers take `guard`, `verify`, and `db` as parameters. | A task can then be built and tested against the shape of a dependency that hasn't landed yet. Only small wiring tasks (**C4**, **G3**, **X4**) wait for the real pieces. |
| D11 | `gameIds` and `coverage` are derived, not written by the model. `gameIds` is the result of `evidence.gamesQuery`; `submit_card` fills `coverage` from `boxscore_coverage`. The verifier recomputes both. | Otherwise they are model-written numbers that only get an existence check, and they go stale after a refresh. |
| D12 | The Q&A agent answers with a query cell: `answer({query, row, column})`. | The same rule as cards: every number is a cell from a rerunnable query. |

## System of record (Ratstack)

| Fact | Authority | Writer | Derived copies |
| --- | --- | --- | --- |
| Games, results | `data/nhl-20262027.json` | `data:refresh` | DuckDB tables (in-memory, rebuilt every run) |
| Player and goalie game stats | `data/boxscores/20262027/*.json` | `data:refresh:all` | `skater_games`, `goalie_games` |
| Standings, club stats | `data/nhl-poster-20262027.json` | `data:refresh:poster` | `standings_daily` |
| Conference and division | `data/teams.json` | hand-edited | `standings_daily.rank_conf` |
| Insight cards | `data/insights/20262027/<TEAM>.json` | `insights:generate` (adds `pending` only), review CLI (changes status), staleness recheck (`approved` → `stale`, refreshed values) | API payload, poster Notes section |
| Agent runs | `.audit/agent-runs/<runId>.jsonl` (gitignored, workflow artifact) | `trace.ts` | `insights:report` |

Rules that shaped this plan:

- **Name the system of record:** the analyst never writes to `data/`, apart from `data/insights/`.
- **Gates guard invariants:**
  - The verifier protects one rule: every number on a card is a cell from a rerunnable query.
  - The review step protects another: no card reaches the public site without a human approving it.
- **Keep unknown distinct:** "declined (out of scope)", "no insight found", and "run crashed" are separate typed outcomes.
- **Keep execution receipts:** traces record what actually ran, not what was configured.
- **Version content artifacts:** every card carries `asOf`, `model`, and `runId`.

## Orchestration

| Role | Who | Does |
| --- | --- | --- |
| Orchestrator | The main Claude Code session | Owns §Ledger. Dispatches ready tasks, reruns each Done check itself, registers branches with Graphite, opens PRs. Never writes feature code. |
| Claude workers | Haiku and Sonnet subagents with `isolation: "worktree"` | Build one card each. |
| Codex truth writer | `codex exec` in a worktree | Writes the eval truth SQL (**E2–E4**). The answering agent is Claude, so a different model family keeps the truth from sharing its mistakes. Ben skims all truth SQL before merge. |
| Codex reviewer | `codex review` on each PR diff | Reviews every PR against its card and the contract sections it cites. Opus reviews as well for **DB1**, **C3**, **C2**, **C4**, and **G5a**. |

- One builder family per task, and Codex builds only **E2–E4**. This keeps the escalation notes in §Ledger readable.
- **Escalation:** if a task fails its Done check twice, rerun it one tier up and note the change in §Ledger.
- Live-model tasks (marked **live**) need **P-key** and spend money. The orchestrator runs them one at a time.

### Model tiers for builders

| Tier | Use for |
| --- | --- |
| **Haiku** | Copying an exact shape into code, fixtures, pure functions with fully specified tests, small scripts |
| **Sonnet** | Normal implementation with tests, SQL, Effect services, CLI, UI |
| **Opus** | The generator prompt and its tuning |

### Worker preamble (prepended to every card)

1. Run `bun install` first. A fresh worktree has no `node_modules`.
2. Branch from `main` as `analyst/<id>-<slug>`, unless the card says **Stack on**.
3. Write only the files on the **Write** list. If the task needs a change anywhere else, stop and report.
4. Read the card's **Read** list first. You may also read anything under `packages/analyst/` and the installed types of its dependencies. Do not explore the rest of the repo.
5. For Effect APIs, copy the style of `packages/season/src/contracts.ts` and check the `node_modules/effect` types. `.agent-sources/effect` is only a README and has no Schema or Layer topics.
6. A dependency that is not merged yet is a parameter, not an import. Use the types in `src/shapes.ts` and the fakes in `tests/fakes.ts`.
7. Commit when **Done** passes. Do not push. Report the Done output.
8. Follow AGENTS.md.

**pkg-check** means, from `packages/analyst`: `bun run typecheck && bun run lint && bun run test`.

Dispatch sketch:

```js
await tools.Agent({
  description: 'B2 template renderer',
  subagent_type: 'general-purpose',
  model: 'haiku',
  isolation: 'worktree',
  prompt: preamble + cardText + contractSections,
})
// then, from the orchestrator: rerun Done, gt track --parent main, gt submit
```

### Graphite

`gt` is installed but the repo is not initialised; **P-plan** runs `gt init` with trunk `main`.

- **One PR per task.** The PR title is the card title and the body is the card's Done output.
- **Stacks are the exception.** Only the pairs marked **Stack on** are stacked (`gt create` on the parent). Everything else branches from `main`.
- **Shared files:** `bun.lock` changes only in **A1**, **DEP1**, and **DEP2**. Every `package.json` script is registered in **A1**. No later task edits a `package.json`.
- After a worktree agent commits, register the branch with `gt track --parent <parent>`, then `gt submit`.

## Contracts

All paths are relative to `packages/analyst/` unless they start with `data/`, `apps/`, `packages/`, `scripts/refresh`, or `.github/`.

### C-data: inputs

- `data/nhl-20262027.json`: `games[]` with `id, date, homeTeam, awayTeam, state, result: {homeScore, awayScore, decision} | null`. A game is final when `result` is not null. There are 1,344 games.
- `data/boxscores/20262027/<gameId>.json`: `{id, date, decision, awayTeam|homeTeam: {abbrev, score, shotsOnGoal, players: {forwards[], defense[], goalies[]}}}`.
  - Skater fields: `playerId, name.default, position, goals, assists, points, plusMinus, pim, hits, powerPlayGoals, sog, toi "MM:SS", blockedShots, shifts, giveaways, takeaways`.
  - Goalie fields: `starter, decision, shotsAgainst, saves, savePctg, goalsAgainst, evenStrengthGoalsAgainst, powerPlayGoalsAgainst, shorthandedGoalsAgainst, toi`.
  - `name` has extra locale keys (`cs`, `fi`, …) on some players only, so read the files with `union_by_name=true`.
- `data/nhl-poster-20262027.json`: keys `schemaVersion, season, fetchedAt, completedGameIds, standings, history, clubs`. `history[]` is `{date, standings[]}`; each standing is `{team, date, divisionSequence, wildcardSequence, points, played}`. There is no conference rank in the file.
- `data/teams.json`: `[{abbrev, name, conference, division}]`.
- No period or event data exists. Claims that need it are out of scope.

### C-views: derived tables

Each file is `src/views/NN-name.sql` and holds one `CREATE TABLE <name> AS SELECT …` (D9). Paths use the `${DATA_DIR}` placeholder, which `openDb` substitutes. The names below are also exported as `VIEWS` from `src/shapes.ts`.

| File | Table | Columns | Grain |
| --- | --- | --- | --- |
| `10-team-games.sql` | `team_games` | `team, game_id, date, home (bool), opp, gf, ga, result ('W'\|'L'\|'OTL'), decision ('REG'\|'OT'\|'SO'), is_final` | 1 row per team per game |
| `20-skater-games.sql` | `skater_games` | `game_id, date, team, opp, player_id, name, pos, g, a, p, sog, toi_sec, hits, blocks, pim, ppg, plus_minus` | archived games only |
| `21-goalie-games.sql` | `goalie_games` | `game_id, date, team, opp, player_id, name, starter, decision, shots_against, saves, save_pct, ga, toi_sec` | archived games only |
| `30-standings-daily.sql` | `standings_daily` | `date, team, points, played, rank_div, rank_conf, wc_rank` | 1 row per team per date |
| `40-boxscore-coverage.sql` | `boxscore_coverage` | `team, finals, archived` | 1 row per team |

- `result` is from the team's point of view: a loss in OT or SO is `OTL`. `gf`, `ga`, `result`, and `decision` are null when `is_final` is false.
- `rank_div` is `divisionSequence` and `wc_rank` is `wildcardSequence`. `rank_conf` is computed: rank within the conference from `data/teams.json`, by `points` descending, then `played` ascending, then `team`. It is not the NHL's official tiebreak; the generator prompt must say so.

### C-db: database boundary

```ts
openDb(opts: { dataDir: string }): Effect<Db, DbError, Scope>
Db.query(sql: string, opts?: { timeoutMs?: number; rowCap?: number }): Effect<{ rows: Row[]; rowCount: number }, SqlError>
Db.queryCanonical(sql, opts?)   // runs SELECT * FROM (<sql>) ORDER BY ALL
Row = Record<string, string | number | boolean | null>
```

- Conversions: `BIGINT`, `DECIMAL`, and `DOUBLE` become `number`; `DATE` becomes a `YYYY-MM-DD` string. Rows must survive `JSON.parse(JSON.stringify(rows))` unchanged.
- The database is in-memory. `openDb` loads the tables, then disables external access and locks the configuration (D9). After open, `COPY`, `ATTACH`, and `read_json` all fail at the database, with or without the guard.

### C-guard: SQL guard

`guardQuery(db, sql)` uses DuckDB's parser (`json_serialize_sql`). It allows exactly one `SELECT` statement and only these sources: the five tables plus CTEs. Table functions are rejected. It returns:

- `{ ok: true, touchesBoxscores: boolean }`, or
- `{ ok: false, reason }`.

`touchesBoxscores` is true when the query reads `skater_games` or `goalie_games`.

### C-card: InsightCard

The schema is copied from the spec's §InsightCard schema, with these changes:

- New field `kind: 'record' | 'trend' | 'comparative' | 'player'`. `assert` is required when `kind` is `'comparative'`.
- New optional field `evidence.gamesQuery`: a guarded `SELECT` with one column, `game_id`. `evidence.gameIds` is its canonical result, or `[]` when there is no `gamesQuery` (D11).
- `evidence.result` is the canonical result of `evidence.query` (D3). `bindings` row indexes refer to that order.
- `evidence.coverage` is filled by `submit_card`, never by the model (D11).
- `asOf.completedGameIds` is the **count** of completed game IDs.
- `id = sha256(team + '\0' + query + '\0' + headline)`, first 16 hex characters.
- `CardDraft` is the card without `id, status, asOf, model, runId, review, evidence.result, evidence.gameIds, evidence.coverage`.

It is written with Effect Schema (`effect@4.1.2`), in the same style as `packages/season/src/contracts.ts`.

### C-render: templates

- `render(template, bindings, rows)` replaces `{name}` with `rows[b.row][b.column]`. An unknown placeholder or a missing cell is an error, not an empty string.
- `literalDigits(template)` returns every digit outside a `{placeholder}`. Verification fails if that list isn't empty.

### C-verify: verifier

`verifyCard(deps: { db, guard }, card, finals: Set<number>)` runs these checks in order and returns `{ ok: true }` or `{ ok: false, check, detail }`:

| # | Check | File | Needs a database |
| --- | --- | --- | --- |
| 1 | The card decodes as an InsightCard. | `verify-static.ts` | no |
| 2 | `guard` returns ok for `query`, `gamesQuery`, and `assert`. | `verify-static.ts` | no (`guard` is a parameter) |
| 3 | Every placeholder resolves against `evidence.result`. | `verify-static.ts` | no |
| 4 | `literalDigits` is empty for the headline and the body. | `verify-static.ts` | no |
| 5 | The canonical rerun of `query` deep-equals `evidence.result`. | `verify-rerun.ts` | yes |
| 6 | The canonical rerun of `gamesQuery` equals `gameIds`, and every ID is in `finals`. | `verify-rerun.ts` | yes |
| 7 | When `touchesBoxscores`: `coverage` equals the team's `boxscore_coverage` row. Otherwise `coverage` is absent. | `verify-rerun.ts` | yes |
| 8 | `assert` (when present) returns a single `true`. | `verify-rerun.ts` | yes |

`verify.ts` only composes the two files.

### C-tools: agent tools

One file per tool under `src/tools/`. Each takes its dependencies as parameters.

- `sql({query})` passes through `guard` and returns `Db.queryCanonical` results. Rows are capped at 200 and queries time out after 10 s.
- `submit_card(draft)` runs the queries, fills in `id, status: 'pending', asOf, model, runId, evidence.result, evidence.gameIds, evidence.coverage`, runs `verify`, and returns `ok` or the failed check as text.
- `answer({query, row, column})` records the Q&A answer `{ value, query, coverage? }`. `value` is the cell; `coverage` is filled when the query touches box scores (D12).
- `decline({reason})` records a typed out-of-scope outcome.
- Tool errors go back to the model as text. After 3 consecutive tool failures, the team's run ends.

### C-eval: evals

- **Q&A cases:** `evals/qa/<category>.json` holds `[{ id, team, question, truthSql | null, expect: 'value' | 'decline', tolerance?, mustMentionCoverage? }]`. `truthSql` returns exactly one row with one column named `value`.
- **Q&A grading:** the grader compares the agent's answer `{ value, coverage? } | { declined }` to the truth value. Integers match exactly; decimals use `tolerance`; a `decline` case must be declined; `mustMentionCoverage` needs a coverage value.
- **Card pass rate:** the share of cards that pass `verifyCard`, with failures grouped by check. It scores both the detectors and the generator.

### Runtime models

- **Generate:** Sonnet 5.5. **Rank:** Haiku 5.5.
- Both are starting guesses. **E7** compares them with evals before P1 closes.
- Calls go through the Vercel AI SDK with AI Gateway `"provider/model"` strings. **G1** and **G4b** confirm the exact IDs.

## Critical path

```
A1 → DEP1 → DB1 → V1, V4, C3 ─┐
A1 → K1 → C1, C2 ─────────────┼→ C4 → G3 → G4a → E6b    P0 exit: the eval runner prints a score
A1 → DEP1 → DEP2 → G1, G2a–c ─┘         └→ G5b → G5c → G8 → CI1    P1 exit: a PR with pending cards for 32 teams
                                  N1b · N2 → N3 · S1    P2 exit: approved cards live and survive a refresh
```

Everything else hangs off **A1** or **K1** and can land at any time. Once **A1** merges, nine tasks are ready at once: K1, DEP1, F1, B1, B2, T1, E1, and (needing only P-plan) DATA1 and N1a.

## Task cards

### Prerequisites (you)

- **P-plan:** commit this plan and the spec, then run `gt init` (trunk `main`). Worktree agents can't see untracked files.
- **P-deps:** approve these additions: `@duckdb/node-api` and `ai` (AI SDK 7). Blocks **DEP1** and **DEP2**.
- **P-key:** provide an AI Gateway key in the local environment, with a spend cap. Blocks every **live** task.
- **P-pr:** allow GitHub Actions to create pull requests in the repo settings, and add the gateway key as a repo secret. Blocks **CI1**.
- **P-rights:** confirm that publishing derived stat claims is acceptable under the source terms (see `docs/nhl-ingestion-framework-evaluation.md`). No card may be approved on `main` until this is settled. The web code can land before it, because it shows nothing without approved cards.

### Foundation

#### A1 · Scaffold packages/analyst (Haiku)

- **Needs:** P-plan
- **Read:** `packages/season/package.json`, `packages/season/tsconfig.json`, `apps/api/package.json`, root `package.json`
- **Write:**
  - `packages/analyst/package.json`: name `@nhl-reddit-stats/analyst`, `effect@4.1.2`, `@types/node` as in `apps/api`, `exports: {"./*": "./src/*.ts"}`. Scripts:
    - `typecheck`: the same command as `packages/season`
    - `lint`: `oxlint src tests evals scripts`
    - `test`: `node --test "tests/*.test.ts" "evals/*.test.ts"`
    - `ask`, `insights:generate`, `insights:review`, `insights:report`, `insights:recheck`: `node scripts/<file>.ts`, with the files `ask.ts`, `generate-insights.ts`, `review-insights.ts`, `insights-report.ts`, `recheck-insights.ts`
    - `evals`: `node evals/run.ts`
  - `tsconfig.json`: copy `packages/season`, with `include: ["src", "tests", "evals", "scripts"]`.
  - `src/version.ts`, `tests/smoke.test.ts`, `evals/smoke.test.ts`, `scripts/.gitkeep`, so every glob resolves.
  - Root `package.json`: the six scripts above, each as `bun run --cwd packages/analyst <name>`.
  - `bun.lock`.
- **Done:** `bun install` succeeds, then pkg-check passes.

#### K1 · Shared shapes and fakes (Sonnet)

- **Needs:** A1
- **Read:** this plan §C-db, §C-guard, §C-verify, §C-views, §C-tools, §C-eval; `packages/season/src/contracts.ts`
- **Write:**
  - `src/shapes.ts`, types only: `Row`, `QueryResult`, `Db`, `DbError`, `SqlError`, `GuardResult`, `Guard`, `VerifyResult`, `Verify`, `Answer`, `Outcome` (`'cards' | 'declined' | 'no_insight' | 'crashed'`), and the `VIEWS` constant (table name → column names, from §C-views).
  - `tests/fakes.ts`: `fakeDb(responses)` (maps SQL text to rows or a `SqlError`), `fakeGuard(result)`, `fakeVerify(result)`.
  - `tests/shapes.test.ts`: the fakes behave, and `VIEWS` has the five tables.
- **Done:** pkg-check passes.

#### DATA1 · Box-score backfill flag (Sonnet)

- **Needs:** P-plan
- **Read:** `scripts/refresh-nhl-data.mjs`, `tests/nhl-refresh.test.mjs`, `data/README.md` §Box scores and automation
- **Write:**
  - `scripts/refresh-nhl-data.mjs`: add a `--backfill-limit N` flag. The default stays 16. Keep the one-second spacing and the backoff.
  - The test for the flag in `tests/nhl-refresh.test.mjs`.
  - The README line documenting the flag.
- **Done:** `bun run test:data` passes.
- **After merge (you):** run `bun run data:refresh:all --backfill-limit 200` and commit the data (about 170 files).

#### DEP1 · Install DuckDB and prove the lock (Sonnet)

- **Needs:** A1, P-deps
- **Read:** the installed `@duckdb/node-api` README and types; this plan D3 and D9
- **Write:**
  - `@duckdb/node-api` in `packages/analyst/package.json`, and `bun.lock`.
  - `tests/duckdb-smoke.test.ts`, which proves, on an in-memory database with a temp directory:
    1. `select 1` works.
    2. `CREATE TABLE t AS SELECT * FROM read_json(...)` works with no network (the JSON extension loads offline).
    3. After `SET enable_external_access=false` and locking the configuration: `t` is still readable; `COPY t TO`, `ATTACH`, and `read_json` fail; the setting can't be turned back on.
    4. `SELECT * FROM (<query>) ORDER BY ALL` works, including when the inner query has its own `ORDER BY` and `LIMIT`.
    5. `json_serialize_sql` runs after the lock.
- **Done:** pkg-check passes. The PR states the result of each of the five points. If point 3, 4, or 5 fails, stop and report; C-db needs re-planning.

#### DEP2 · Install the AI SDK (Haiku)

- **Needs:** P-deps. **Stack on:** DEP1 (both change `bun.lock`).
- **Read:** `node_modules/ai/docs/` (the testing topic only)
- **Write:** `ai` in `packages/analyst/package.json`, `bun.lock`, and `tests/ai-smoke.test.ts` (one `generateText` call against the SDK's mock model).
- **Done:** pkg-check passes. The PR records the installed version and the mock model's import path.

### Data layer

#### DB1 · openDb, conversions, loader, lock (Sonnet)

- **Needs:** K1, DEP1
- **Read:** this plan §C-db, `src/shapes.ts`, `tests/duckdb-smoke.test.ts`
- **Write:**
  - `src/db.ts`: `openDb`, `query`, `queryCanonical`, the conversions, the loader for `src/views/*.sql` in sorted order (an empty directory is fine), then the lock.
  - `tests/db.test.ts`: `select 1`; each conversion; the JSON round trip; `queryCanonical` order; `COPY` and `CREATE ... read_json` fail after open.
- **Done:** pkg-check passes.

#### DB2 · Query timeout and row cap (Sonnet)

- **Needs:** DB1
- **Read:** this plan §C-db, `src/db.ts`
- **Write:** `timeoutMs` and `rowCap` in `src/db.ts`, and `tests/db-limits.test.ts` (a slow query is interrupted and returns `SqlError`; the cap truncates `rows` but `rowCount` is the full count).
- **Done:** pkg-check passes.

#### F1 · Test fixtures (Haiku)

- **Needs:** A1
- **Read:** this plan §C-data, one real box-score file, the first 60 lines of each snapshot, `data/teams.json`
- **Write:** `tests/fixtures/data/`, trimmed copies of the real files with the same shape and the same relative paths:
  - 2 teams and 4 games: 3 final, 1 scheduled.
  - 2 box scores. One final game has no archived box score.
  - `tests/fixtures/README.md` with the hand-computed totals the table tests will assert.
- **Done:** every fixture file parses, and the README totals are written down.

#### V1 · team_games (Sonnet)

- **Needs:** DB1, F1
- **Read:** this plan §C-views, `tests/fixtures/README.md`
- **Write:** `src/views/10-team-games.sql` and `tests/views-team-games.test.ts` (the fixture totals, plus 2 rows per game).
- **Done:** pkg-check passes, and a query against the real `data/` returns 2,688 rows.

#### V2a · skater_games (Sonnet)

- **Needs:** DB1, F1
- **Read:** §C-views, §C-data, the fixtures README, one fixture box score
- **Write:** `src/views/20-skater-games.sql` and its test (`toi` is parsed to seconds, `opp` is filled in, forwards and defense are both present).
- **Done:** pkg-check passes, and the table loads from the real `data/`.

#### V2b · goalie_games (Sonnet)

- **Needs:** DB1, F1
- **Read:** §C-views, §C-data, the fixtures README, one fixture box score
- **Write:** `src/views/21-goalie-games.sql` and its test.
- **Done:** pkg-check passes, and the table loads from the real `data/`.

#### V3 · standings_daily (Sonnet)

- **Needs:** DB1, F1
- **Read:** §C-views (including the `rank_conf` rule), the `history` excerpt of the poster fixture, `data/teams.json`
- **Write:** `src/views/30-standings-daily.sql` and its test.
- **Done:** pkg-check passes, and the real `data/` gives 32 rows per date.

#### V4 · boxscore_coverage (Haiku)

- **Needs:** DB1, F1
- **Read:** §C-views, the fixtures README
- **Write:** `src/views/40-boxscore-coverage.sql` and its test. Compute finals from the raw season JSON, not from `team_games`, so this task doesn't depend on V1.
- **Done:** pkg-check passes.

### Card, guard, verifier

#### B1 · InsightCard schema (Sonnet)

- **Needs:** A1
- **Read:** this plan §C-card, the spec §InsightCard schema, `packages/season/src/contracts.ts`
- **Write:** `src/card.ts` (`InsightCard`, `CardDraft`, `RejectReason`, `cardId()`) and `tests/card.test.ts` (decodes a valid card, rejects a comparative card with no assert, checks that the id is stable).
- **Done:** pkg-check passes.

#### B2 · Template renderer (Haiku)

- **Needs:** A1
- **Read:** this plan §C-render
- **Write:** `src/render.ts`, plus `tests/render.test.ts` with at least 8 cases: nested braces, a repeated placeholder, a missing column, a digit in the text, and a digit inside a placeholder name.
- **Done:** pkg-check passes.

#### C3 · SQL guard (Sonnet)

- **Needs:** DB1
- **Read:** this plan §C-guard, `src/shapes.ts`, `src/db.ts`
- **Write:** `src/guard.ts` and `tests/guard.test.ts`. The tests reject multiple statements, `ATTACH`, `COPY`, `read_json`, and unknown tables. They accept CTEs and subqueries, and they check `touchesBoxscores` through a CTE.
- **Done:** pkg-check passes.

#### C1 · Static card checks (Sonnet)

- **Needs:** K1, B1, B2
- **Read:** §C-verify checks 1–4, `src/card.ts`, `src/render.ts`, `tests/fakes.ts`
- **Write:** `src/verify-static.ts` (`guard` is a parameter) and its tests, with one failing card per check.
- **Done:** pkg-check passes.

#### C2 · Rerun checks (Sonnet)

- **Needs:** K1, B1
- **Read:** §C-verify checks 5–8, `src/card.ts`, `tests/fakes.ts`
- **Write:** `src/verify-rerun.ts` (`db` and the guard result are parameters) and its tests with `fakeDb`: a drifted result, a changed game list, a non-final game, wrong coverage, coverage on a card that doesn't touch box scores, a false assert.
- **Done:** pkg-check passes.

#### C4 · verifyCard wiring (Sonnet)

- **Needs:** C1, C2, C3, V1, V4
- **Read:** §C-verify, `src/verify-static.ts`, `src/verify-rerun.ts`, `src/guard.ts`
- **Write:** `src/verify.ts` and `tests/verify.test.ts`: one passing and one failing card against the real guard and the fixture database.
- **Done:** pkg-check passes.

### Evals

#### E1 · Eval case schema and grader (Sonnet)

- **Needs:** A1
- **Read:** this plan §C-eval
- **Write:** `evals/case.ts` (schema), `evals/grade.ts` (a pure function of the truth value and the answer), `evals/grade.test.ts`.
- **Done:** pkg-check passes.

#### E6a · Eval runner with a pluggable answerer (Sonnet)

- **Needs:** E1, K1
- **Read:** `evals/case.ts`, `evals/grade.ts`, `src/shapes.ts`
- **Write:** `evals/runner.ts`: `runEvals({ cases, db, answerer })` runs each `truthSql`, calls the answerer, grades, and returns per-case results and a score. Add `evals/runner.test.ts` with `fakeDb` and a scripted answerer.
- **Done:** pkg-check passes.

#### E2–E5 · Eval cases (parallel, one PR each)

| Task | Builder | File | Count | Notes |
| --- | --- | --- | --- | --- |
| E2 | Codex | `evals/qa/easy.json` | 6 | Records and splits from `team_games` |
| E3 | Codex | `evals/qa/multistep.json` | 6 | Last-N vs first-N, streaks, one-goal games |
| E4 | Codex | `evals/qa/coverage.json` | 4 | Player and goalie questions with `mustMentionCoverage` |
| E5 | Haiku | `evals/qa/decline.json` | 4 | Period and event questions; `truthSql: null` |

- **Needs:** E1; E2 and E3 also V1; E4 also V2a, V2b, V4
- **Read:** §C-eval, §C-views, `evals/case.ts`
- **Write:** the one JSON file, plus `evals/qa-<category>.test.ts` (every case passes the schema; every `truthSql` parses and returns one `value` column on the fixture database).
- **Done:** pkg-check passes, and every `truthSql` returns one row against the real `data/`. Ben skims the SQL before merge.

#### E8 · Card pass-rate scorer (Haiku)

- **Needs:** K1, B1
- **Read:** §C-eval, `src/shapes.ts`, `src/card.ts`
- **Write:** `evals/card-pass-rate.ts`: `scoreCards(cards, verify)` returns the pass rate and the failures grouped by check. Add its test with `fakeVerify`.
- **Done:** pkg-check passes.

### Baseline detectors

#### X1–X3 · Detectors (Sonnet, parallel, one PR each)

- **Needs:** B1, B2; X1 and X2 also V1; X3 also V2a, V2b, V4
- **Read:** §C-card, §C-views, §C-render, `src/card.ts`
- **Write:** one file per detector under `src/detectors/`, each exporting `(team) => CardDraft[]`, and one test per file (the draft decodes, has no literal digits, and its queries run on the fixture database).
  - **X1, results:** `one-goal.ts`, `home-away.ts`, `extra-time.ts`.
  - **X2, form:** `last-ten.ts`, `streak.ts` (comparative, with an `assert`).
  - **X3, players:** `points-leader.ts`, `goalie-starts.ts`.
- **Done:** pkg-check passes.

#### X4 · Detector pass rate on real data (Haiku)

- **Needs:** X1, X2, X3, C4, G2b, E8
- **Read:** `src/detectors/`, `evals/card-pass-rate.ts`, `src/tools/submit-card.ts`
- **Write:** `evals/detectors.ts`: runs every detector for every team through `fillCard` and `verifyCard`, and prints the pass rate by check.
- **Done:** every NJD card passes on the real `data/`. The PR records the 32-team pass rate.

### Agent

#### T1 · Run traces (Haiku)

- **Needs:** A1
- **Read:** the spec §Observability
- **Write:** `src/trace.ts`, an append-only JSONL writer to `.audit/agent-runs/<runId>.jsonl` with the event types `model_call | tool_call | verify | card | outcome`. Also `tests/trace.test.ts` and `tests/fixtures/trace.jsonl` (one of each event).
- **Done:** pkg-check passes.

#### G1 · LLM service (Sonnet)

- **Needs:** DEP2
- **Read:** `node_modules/ai/docs/` (the generateText, tools, stopWhen, and testing topics), this plan §Runtime models, `tests/ai-smoke.test.ts`
- **Write:** `src/llm.ts`: an Effect service `Llm.run({system, prompt, tools, stopWhen, model})`. Model IDs come from config. Add `tests/llm.test.ts` using the SDK's mock model.
- **Done:** pkg-check passes. The PR lists the gateway model IDs it found in the installed docs, and says so if they still need a live check.

#### G2a · sql tool (Sonnet)

- **Needs:** K1, DEP2
- **Read:** §C-tools, `src/shapes.ts`, `tests/fakes.ts`, `node_modules/ai/docs/` (the tools topic)
- **Write:** `src/tools/sql.ts` and its test: a guard rejection and a `SqlError` both come back as text; rows are capped.
- **Done:** pkg-check passes.

#### G2b · submit_card tool (Sonnet)

- **Needs:** K1, B1, DEP2
- **Read:** §C-tools, §C-card, `src/card.ts`, `tests/fakes.ts`
- **Write:** `src/tools/submit-card.ts`: an exported `fillCard(deps, draft, meta)` plus the tool that wraps it. Tests with the fakes: the fill-in fields, a verify failure returned as text, coverage filled only when the guard says `touchesBoxscores`.
- **Done:** pkg-check passes.

#### G2c · answer and decline tools (Haiku)

- **Needs:** K1, DEP2
- **Read:** §C-tools, `src/shapes.ts`, `tests/fakes.ts`
- **Write:** `src/tools/answer.ts`, `src/tools/decline.ts`, and their tests (the answer value is the named cell; a bad row or column comes back as text).
- **Done:** pkg-check passes.

#### G3 · Toolset wiring and failure limit (Sonnet)

- **Needs:** G2a, G2b, G2c, C4, DB2
- **Read:** §C-tools, the four tool files, `src/verify.ts`, `src/guard.ts`
- **Write:** `src/toolset.ts`: builds the tools from a real `Db`, with the 10 s timeout, the 200-row cap, and a stop condition after 3 consecutive tool failures. Add `tests/toolset.test.ts` on the fixture database.
- **Done:** pkg-check passes.

#### G4a · ask function (Sonnet)

- **Needs:** G3, G1, T1
- **Read:** `src/toolset.ts`, `src/llm.ts`, `src/trace.ts`, `src/shapes.ts`
- **Write:** `src/ask.ts`: `ask({question, team})` returns an `Answer`, a decline, or a crash, and writes a trace. Add `tests/ask.test.ts` with the mock model (one answered, one declined, one that hits the failure limit).
- **Done:** pkg-check passes.

#### G4b · ask CLI and the D8 baseline (Sonnet, live)

- **Needs:** G4a, V2a, V2b, V3, P-key
- **Read:** `src/ask.ts`
- **Write:** `scripts/ask.ts`: `bun run ask "<q>" --team NJD` prints the answer, the query, and the coverage.
- **Done:** pkg-check passes, and one live question is answered with its query shown. The PR records the step count and query time for 5 questions (the D8 baseline) and the confirmed gateway model IDs.

#### E6b · Eval CLI (Sonnet, live)

- **Needs:** E6a, G4a, E2–E5, P-key
- **Read:** `evals/runner.ts`, `src/ask.ts`
- **Write:** `evals/run.ts`: loads `evals/qa/*.json`, uses `ask` as the answerer, and writes `evals/results/<date>-agent.json`.
- **Done:** `bun run evals` prints a score. **P0 exit.**

### Generation

#### G5a · Generator prompt (Opus)

- **Needs:** K1
- **Read:** §C-views, §C-tools, §C-card, the spec §Pipeline step 1, and the poster section names in `apps/web/src/components/team-poster/TeamPoster.tsx`
- **Write:** `src/prompts/generate.md` and `src/prompt.ts`: a pure `buildPrompt({ team, views, coverage, posterFacts })`. It states the out-of-scope list, the canonical row order, and that `rank_conf` is not the official tiebreak. Add a test that every table and column in `VIEWS` appears in the output.
- **Done:** pkg-check passes.

#### G5b · Generate loop (Sonnet)

- **Needs:** G5a, G3, G1, T1
- **Read:** `src/prompt.ts`, `src/toolset.ts`, `src/llm.ts`, `src/trace.ts`
- **Write:** `src/generate.ts`: reads the team's coverage row and poster facts, runs `Llm.run`, and returns the verified cards plus a typed `Outcome`. Add a mock-model test for each outcome.
- **Done:** pkg-check passes.

#### G5c · Prompt tuning on NJD (Opus, live)

- **Needs:** G5b, V2a, V2b, V3, P-key
- **Read:** `src/prompts/generate.md`, the traces from its own runs
- **Write:** `src/prompts/generate.md` only.
- **Done:** a live NJD run returns 3 or more verified cards. The PR records the pass rate by check.

#### G6 · Ranker (Sonnet)

- **Needs:** B1, G1
- **Read:** the spec §Pipeline step 3, `src/card.ts`, `src/llm.ts`
- **Write:** `src/rank.ts`: structured scores (novelty, specificity, readability), dedupe by id and by near-identical headline, keep the top 3. Add a test with the mock model.
- **Done:** pkg-check passes.

#### G7 · Card store merge (Haiku)

- **Needs:** B1
- **Read:** §C-card, the spec §Pipeline step 4
- **Write:** `src/store.ts` (`readCards(dir, team)`, `writeCards(dir, team, cards)`, `mergePending(existing, incoming)`), which never overwrites `approved`, `rejected`, or `stale` cards. Add tests for each status.
- **Done:** pkg-check passes.

#### G8 · generate-insights entry (Sonnet, live)

- **Needs:** G5b, G5c, G6, G7, T1, P-key
- **Read:** the exports of `generate.ts`, `rank.ts`, `store.ts`, and `trace.ts`
- **Write:** `scripts/generate-insights.ts`: all teams, or `--team`; runs teams concurrently with a fixed limit.
- **Done:** a live run for 2 teams writes pending cards and one trace.

#### E7 · Model comparison (Sonnet, live)

- **Needs:** E6b, G8, E8, P-key
- **Read:** `evals/run.ts`, `evals/card-pass-rate.ts`, §Runtime models
- **Write:** `evals/results/`: the Q&A score for Sonnet and Haiku as the answerer, and the card pass rate for 4 teams with each as the generator. Update §Runtime models in this plan with the measured score, tokens, and time per team.
- **Done:** the results are committed and the decision is recorded.

### Review, staleness, CI

#### R1 · Review CLI (Sonnet)

- **Needs:** G7, B2
- **Read:** `src/store.ts`, `src/render.ts`, `src/card.ts`, the spec §Pipeline step 5
- **Write:** `src/review.ts` (pure: `applyDecision(card, decision)` and `formatForReview(card)` with the query and the result table), its tests, and `scripts/review-insights.ts` (prompts a/r/e, records a `RejectReason`; reads answers from stdin so a test can script it).
- **Done:** pkg-check passes, including a scripted-stdin test over fixture cards.

#### R3 · Run report (Haiku)

- **Needs:** T1
- **Read:** `src/trace.ts`, `tests/fixtures/trace.jsonl`
- **Write:** `scripts/insights-report.ts` (counts, tokens, failures by verify check) and a test against the fixture trace.
- **Done:** pkg-check passes.

#### S1 · Staleness recheck (Sonnet)

- **Needs:** K1, G7, B2, G2b
- **Read:** §C-verify, `src/store.ts`, `src/render.ts`, `src/tools/submit-card.ts`, the spec §Pipeline step 6
- **Write:** `src/recheck.ts`: `recheck(deps, card)`, with `db`, `guard`, and `verify` as parameters. When the result changed and `assert` still holds (or there is none), it refreshes `result`, `gameIds`, `coverage`, and `asOf` and keeps the card approved. When `assert` fails or a query errors, it marks the card `stale`. Add tests with the fakes, and `scripts/recheck-insights.ts`.
- **Done:** pkg-check passes.

#### CI1 · Workflow steps (Sonnet) [needs your OK: CI change]

- **Needs:** G8, S1, P-key, P-pr
- **Read:** `.github/workflows/refresh-nhl-data.yml`
- **Write:** in that workflow, when `vars.INSIGHTS_ENABLED == 'true'`:
  - Before the publish step: run `insights:recheck`, and add `data/insights` to the `git add` list.
  - After the publish step: run `insights:generate`, upload `.audit/` as an artifact, and open a PR titled `insights: <date>`. This needs `pull-requests: write`.
- **Done:** a manual `workflow_dispatch` from `main` opens the PR. The job only runs on the default branch, so it can't be tested from a branch. **P1 exit.**

### Web

#### N1a · Insights field in the RPC contract (Sonnet)

- **Needs:** P-plan
- **Read:** `packages/season/src/contracts.ts`, `apps/api/src/snapshots.ts`, `apps/api/src/web-handler.ts`, the spec §Web
- **Write:** a `PublishedInsight` schema in `packages/season/src/contracts.ts` (rendered `headline` and `body`, `query`, `result`, `gameIds`, optional `coverage`, `asOf`), an `insights` array on the `GetTeamData` payload, and the API returning `[]`. Update the API tests.
- **Done:** `bun run test:api` and `bun run typecheck` pass.

#### N1b · API serves approved cards (Sonnet)

- **Needs:** N1a, B1, B2, G7
- **Read:** `apps/api/src/snapshots.ts`, `apps/api/src/boxscores.ts`, `src/card.ts`, `src/render.ts`, `src/store.ts`
- **Write:** the API loads `data/insights/`, keeps `approved` cards, renders them, and validates them with `PublishedInsight`. Bundle the files on Vercel the way box scores are bundled. The API must not import `src/db.ts`.
- **Done:** `bun run test:api` and `bun run typecheck` pass, with a fixture card in each status.

#### N2 · Poster Notes section (Sonnet)

- **Needs:** N1a
- **Read:** `apps/web/tamagui-prompt.md`, `apps/web/design/README.md`, `TeamPoster.tsx`
- **Write:** `components/team-poster/Notes.tsx` (at most 3 cards; renders nothing when the list is empty) and the line in `TeamPoster.tsx` that mounts it.
- **Done:** `bun run lint` and `bun run check:tamagui` pass.

#### N3 · Source drawer (Sonnet)

- **Needs:** N1a. **Stack on:** N2.
- **Read:** `BoxscoreSheet.tsx`, `use-boxscore.ts`, the design README, `Notes.tsx`
- **Write:** `components/team-poster/InsightSource.tsx` (the query, the result table, and the linked games) and the control in `Notes.tsx` that opens it. Each game opens the existing box-score drawer.
- **Done:** lint, check:tamagui, and the web tests pass. **P2 exit** after P-rights is settled, a card is approved, and one refresh confirms it survives.

## Ledger

| ID | Builder | Needs | Branch | PR | Status | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| P-plan | you | – | – | – | todo | |
| P-deps | you | – | – | – | todo | Blocks DEP1, DEP2 |
| P-key | you | – | – | – | todo | Blocks live tasks |
| P-pr | you | – | – | – | todo | Blocks CI1 |
| P-rights | you | – | – | – | todo | Blocks approving cards |
| A1 | Haiku | P-plan | analyst/a1-scaffold | | todo | |
| K1 | Sonnet | A1 | analyst/k1-shapes | | todo | |
| DATA1 | Sonnet | P-plan | analyst/data1-backfill-flag | | todo | Then you run the backfill |
| DEP1 | Sonnet | A1, P-deps | analyst/dep1-duckdb | | todo | Confirms D3, D9 |
| DEP2 | Haiku | P-deps | analyst/dep2-ai-sdk | | todo | on DEP1 |
| DB1 | Sonnet | K1, DEP1 | analyst/db1-open | | todo | |
| DB2 | Sonnet | DB1 | analyst/db2-limits | | todo | |
| F1 | Haiku | A1 | analyst/f1-fixtures | | todo | |
| V1 | Sonnet | DB1, F1 | analyst/v1-team-games | | todo | |
| V2a | Sonnet | DB1, F1 | analyst/v2a-skater-games | | todo | |
| V2b | Sonnet | DB1, F1 | analyst/v2b-goalie-games | | todo | |
| V3 | Sonnet | DB1, F1 | analyst/v3-standings | | todo | |
| V4 | Haiku | DB1, F1 | analyst/v4-coverage | | todo | |
| B1 | Sonnet | A1 | analyst/b1-card-schema | | todo | |
| B2 | Haiku | A1 | analyst/b2-render | | todo | |
| C3 | Sonnet | DB1 | analyst/c3-guard | | todo | |
| C1 | Sonnet | K1, B1, B2 | analyst/c1-verify-static | | todo | |
| C2 | Sonnet | K1, B1 | analyst/c2-verify-rerun | | todo | |
| C4 | Sonnet | C1, C2, C3, V1, V4 | analyst/c4-verify | | todo | |
| E1 | Sonnet | A1 | analyst/e1-grader | | todo | |
| E6a | Sonnet | E1, K1 | analyst/e6a-runner | | todo | |
| E2 | Codex | E1, V1 | analyst/e2-cases-easy | | todo | |
| E3 | Codex | E1, V1 | analyst/e3-cases-multistep | | todo | |
| E4 | Codex | E1, V2a, V2b, V4 | analyst/e4-cases-coverage | | todo | |
| E5 | Haiku | E1 | analyst/e5-cases-decline | | todo | |
| E8 | Haiku | K1, B1 | analyst/e8-card-pass-rate | | todo | |
| X1 | Sonnet | B1, B2, V1 | analyst/x1-results | | todo | |
| X2 | Sonnet | B1, B2, V1 | analyst/x2-form | | todo | |
| X3 | Sonnet | B1, B2, V2a, V2b, V4 | analyst/x3-players | | todo | |
| X4 | Haiku | X1, X2, X3, C4, G2b, E8 | analyst/x4-detector-score | | todo | |
| T1 | Haiku | A1 | analyst/t1-trace | | todo | |
| G1 | Sonnet | DEP2 | analyst/g1-llm | | todo | |
| G2a | Sonnet | K1, DEP2 | analyst/g2a-sql-tool | | todo | |
| G2b | Sonnet | K1, B1, DEP2 | analyst/g2b-submit-card | | todo | |
| G2c | Haiku | K1, DEP2 | analyst/g2c-answer-decline | | todo | |
| G3 | Sonnet | G2a, G2b, G2c, C4, DB2 | analyst/g3-toolset | | todo | |
| G4a | Sonnet | G3, G1, T1 | analyst/g4a-ask | | todo | |
| G4b | Sonnet | G4a, V2a, V2b, V3, P-key | analyst/g4b-ask-cli | | todo | live |
| E6b | Sonnet | E6a, G4a, E2, E3, E4, E5, P-key | analyst/e6b-eval-cli | | todo | live; P0 exit |
| G5a | Opus | K1 | analyst/g5a-prompt | | todo | |
| G5b | Sonnet | G5a, G3, G1, T1 | analyst/g5b-generate | | todo | |
| G5c | Opus | G5b, V2a, V2b, V3, P-key | analyst/g5c-tune | | todo | live |
| G6 | Sonnet | B1, G1 | analyst/g6-rank | | todo | |
| G7 | Haiku | B1 | analyst/g7-store | | todo | |
| G8 | Sonnet | G5b, G5c, G6, G7, T1, P-key | analyst/g8-entry | | todo | live |
| E7 | Sonnet | E6b, G8, E8, P-key | analyst/e7-model-compare | | todo | live |
| R1 | Sonnet | G7, B2 | analyst/r1-review-cli | | todo | |
| R3 | Haiku | T1 | analyst/r3-report | | todo | |
| S1 | Sonnet | K1, G7, B2, G2b | analyst/s1-staleness | | todo | |
| CI1 | Sonnet | G8, S1, P-key, P-pr | analyst/ci1-workflow | | todo | P1 exit |
| N1a | Sonnet | P-plan | analyst/n1a-contract | | todo | |
| N1b | Sonnet | N1a, B1, B2, G7 | analyst/n1b-api | | todo | |
| N2 | Sonnet | N1a | analyst/n2-notes | | todo | |
| N3 | Sonnet | N1a | analyst/n3-source | | todo | on N2; P2 exit |

P3 (the live Ask box) is not planned yet. Plan it after P2, once there's approval-rate data.
