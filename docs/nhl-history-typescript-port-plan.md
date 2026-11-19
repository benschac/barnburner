# NHL history: port the Python pipeline to TypeScript

Status: proposed, Nov 17 2026. Owner: Ben. Follows `docs/nhl-teammate-graph-plan.md`, whose stack (#58–#108) this builds on.

The teammate graph has two halves. Everything that runs at request time is TypeScript (`packages/history`, `apps/api`). Everything that builds the data is Python: about 1,550 lines of scripts and 1,600 lines of tests. That split was inherited, not chosen. The importer already existed in Python, and the first plan kept extending it. This plan moves the build half to TypeScript, one script per PR, without changing a single answer.

## Why

- **One language and one test runner.** `bun run test:history` (`unittest`) goes away. Every build step runs under `node --test`, `effect-tsgo` typecheck, and the type-aware lint like the rest of the repo.
- **The house rules apply.** AGENTS.md's error model (`Schema.TaggedError`), union model, and JSON boundary cover none of the Python. Ported code adopts all three, with the executable checks the rules require.
- **NHL payloads get schemas.** The Python reads report JSON by key and fails on a `KeyError`. Effect `Schema` decoding of the stats API and box-score payloads turns format drift into a tagged, located error.
- **One SQLite engine.** The API already reads the serving file with `node:sqlite`. Building it with the same engine (SQLite 3.53.1 in Node 24.18; Python has 3.53.0) removes a cross-engine variable.

What it does not buy: speed. The heavy work is SQL either way. The full base build takes 92 s and the serving build 85 s today, and the port must not be slower.

## Decisions

| # | Decision | Why |
| --- | --- | --- |
| P-D1 | **New package `packages/history-build`.** It holds the pipeline as modules plus thin CLIs in `scripts/`, run with `node` (type stripping) like `apps/api/scripts`. `packages/history` stays pure, with no I/O. | Keeps the search package free of fs, network, and SQLite writes. Each CLI is a few lines over a testable module. |
| P-D2 | **`node:sqlite` (`DatabaseSync`) for every database.** No new dependency. | It already ships the API. `bun:sqlite` would split engines between build and serve. |
| P-D3 | **Effect throughout.** Tagged errors per AGENTS.md. `Schema` for every external payload and archive file. HTTP through Node's `fetch`, with retry and 429 back-off in one shared client. | House style. One client replaces three copies of the curl and urllib retry logic. |
| P-D4 | **Same CLIs, same files, same tables.** Every ported script keeps its flags, output paths, table schemas, and printed report. The root `package.json` scripts and the O3 workflow switch only at cutover (**P10**). | Callers don't change until the last PR, so any PR can merge alone. |
| P-D5 | **Parity is logical, not byte-level.** A parity check compares a canonical dump of every table, sorted with each blob hashed, between the Python and TypeScript outputs on the full archive. Each engine's own output stays deterministic: two TS builds are byte-identical. | The SQLite header records the library version, so files from two engines can never be byte-identical. |
| P-D6 | **Archive files get deterministic gzip.** The TS writer sets gzip `mtime` to 0, while Python's `gzip.open` stamps the current time. The first TS refresh therefore changes every rewritten partition's hash and the snapshot ID, once. | After that, a rewrite with no changes leaves the bytes identical, as I1's no-op rule intends. |
| P-D7 | **T1 stays in Python.** `nhl_history_truth.py` and its test remain the independent reference, written by a different model in a different language. CI keeps a small Python job for it alone. | The point of T1 is that it shares no code with what it checks. Porting it would remove the independence. |
| P-D8 | **Python is deleted at cutover, not before.** Both pipelines run side by side until **P9**'s parity gate passes on the full archive twice: before and after a nightly refresh. | A rollback is a revert of P10 only. |

## Contracts kept

Unchanged from the first plan, and the port must reproduce them exactly: §C-base (now `user_version` 4), §C-dressed, §C-serve, §C-graph, §C-ops, and the §C-mini test league. The TS tests rebuild §C-mini from one shared inline fixture (**P1**) instead of each test file writing its own.

## Orchestration

Same roles, preamble, and Graphite rules as the first plan (§Orchestration, §Worker preamble, §Graphite). One linear `history/port-*` stack on top of `history/ledger`. `pkg-check` here means, from `packages/history-build`: `bun run typecheck && bun run lint && bun run test`.

```
P0 ─ P1 ─┬─ P2 ─┬─ P4 ─ P5 ─┬─ P6 ─ P7 ─┬─ P9 ─ P10
         ├─ P3 ─┘           │           │
         └─ P8 ─────────────┴───────────┘
```

- **Ready the moment P1 lands:** P2, P3, P8.
- **The critical path is P5 → P7 → P9.** P5 (base build) and P7 (graph blobs) are where a subtle mismatch hides, so each gets the Opus second review.

## Task cards

#### P0 · Scaffold `packages/history-build` (Sonnet · low)

- **Needs:** nothing
- **Read:** `packages/history/package.json`, `tsconfig.json`, `.oxlintrc.json`
- **Write:** the package (`@nhl-reddit-stats/history-build`), copying `packages/history`'s typecheck, lint (union-model plugin and error-model check), and `node --test` wiring, plus one placeholder test. `bun.lock`.
- **Done:** pkg-check passes.

#### P1 · Shared I/O and the §C-mini fixture (Sonnet · medium)

- **Needs:** P0
- **Read:** the Python `save`/`load` helpers in `scripts/import-nhl-history.py` and `scripts/import-nhl-dressed.py`; `Fetcher` in `import-nhl-dressed.py`; `tests/test_build_nhl_serving.py` (`make_base`, `DRESSED`); `packages/analyst/src/json.ts`
- **Write:** in `src/`:
  - `archive-io.ts`: atomic gzip JSON read and write, with mtime 0 (P-D6) and a unique temp file per write; `sha256` of bytes.
  - `nhl-client.ts`: an Effect HTTP client with a concurrency cap, retries with growing waits, and a shared 429 cooldown that is re-checked after each sleep. The clock and sleep are injectable; the I1 review found a test spinning in real time.
  - `sqlite.ts`: open read-only by `file:` URI; a transaction helper.
  - Tagged errors for each.

  In `tests/fixtures.ts`: §C-mini as an inline archive (season files, dressed files, totals), from which every later test builds.
- **Done:** pkg-check passes. The tests cover an atomic write that survives a crash mid-write, the cooldown re-check, and a 429 that is never surfaced as data.

#### P2 · Port the game-report importer (Sonnet · medium)

- **Needs:** P1
- **Read:** `scripts/import-nhl-history.py`, `tests/test_build_nhl_history.py` (archive layout)
- **Write:** `src/import-reports.ts` and `scripts/import-nhl-history.ts`, with the same flags (`--refresh`, `--season`), catalog checks, and two-recent-seasons rule. `Schema` decoding of the stats API `{ data, total }`, failing on the 10,000-row limit. A test with a stubbed client.
- **Done:** pkg-check passes. **Gate (Archive):** on a scratch copy of one completed season, a refetch writes a file whose decoded JSON equals the Python file's.

#### P3 · Port the dressed-goalie importer (Sonnet · medium)

- **Needs:** P1
- **Read:** `scripts/import-nhl-dressed.py`, `tests/test_import_nhl_dressed.py`
- **Write:** `src/import-dressed.ts` and `scripts/import-nhl-dressed.ts`. Same flags. Atomic save every 100 games; skip games already stored with data; a game that fails after retries is stored as `null`; a rerun with nothing to fetch writes nothing (header included). `Schema` for the box score: `playerByGameStats.{away,home}Team.goalies`, abbreviations, and `toi`. Port all eight Python tests.
- **Done:** pkg-check passes. **Gate (Archive):** `--season 20262027` fetches the current season, and the decoded games match the Python file.

#### P4 · Port the reconciliation checker (Sonnet · medium)

- **Needs:** P2
- **Read:** `scripts/check_nhl_history.py`, `tests/test_nhl_history_check.py`
- **Write:** `src/check.ts` (pure `check(db, snapshot)` and `checkWithRetry`) and `scripts/check-nhl-history.ts` (`--fetch`, `--totals`). No retry on partition-coverage errors. The report shape is unchanged.
- **Done:** pkg-check passes.

#### P5 · Port the base build (Sonnet · high)

- **Needs:** P3, P4
- **Read:** `scripts/build-nhl-history.py`, `tests/test_build_nhl_history.py`; first plan §C-base, §C-dressed
- **Write:** `src/build-base.ts` and `scripts/build-nhl-history.ts`, with the same schema and `user_version` 4. Schema creation and the version stamp commit in one transaction. The partition hash covers the report and dressed bytes. Dressed games are scoped to their partition. `--refetch-recent` is opt-in. The unlisted-goalie count is printed. Port every Python test.
- **Done:** pkg-check passes. **Gate (Archive):** a fresh TS build reconciles (218 partitions), and a second run rebuilds 0. P9's dump matches the Python base on every table. Wall time ≤ 92 s.

#### P6 · Port the serving tables and Finals step (Sonnet · medium)

- **Needs:** P5
- **Read:** `scripts/build-nhl-serving.py`, `scripts/nhl_serving_tables.py`, `scripts/nhl_serving_finals.py` and their tests; first plan §C-serve, D8, D10
- **Write:** `src/serve/steps.ts` (the step list and `run(base, out)` interface), `src/serve/tables.ts`, `src/serve/finals.ts`, and `scripts/build-nhl-serving.ts`.
  - The build holds one base read transaction, refuses `--out == --base`, and ends with VACUUM and an atomic move.
  - Points are counted once per player and game.
  - The in-progress season gets the previous season's Final-round rule, and each flagged Final must have exactly two teams.
- **Done:** pkg-check passes, and two TS builds of §C-mini are byte-identical.

#### P7 · Port the graph, partner, pack, and opponent steps (Sonnet · high)

- **Needs:** P6
- **Read:** `scripts/nhl_serving_graph.py`, `nhl_serving_partners.py`, `nhl_serving_graph_pack.py`, `nhl_serving_opponents.py` and their tests; first plan §C-graph, D2
- **Write:** `src/serve/graph.ts`, `partners.ts`, `pack.ts`, and `opponents.ts`.
  - The TEMP `spans` table keeps its CHECK and UNIQUE constraints.
  - Packing uses little-endian typed arrays (`DataView`), with the size limits checked.
  - Tests assert the exact §C-mini blob bytes, copied from the Python tests. Those bytes are the contract, and both implementations must produce them.
- **Done:** pkg-check passes. **Gate (Archive):** every `graph_arrays` blob is byte-equal to the Python build's on the full archive, and the serving build takes ≤ 85 s.

#### P8 · Port the archive manifest and fetch (Sonnet · medium)

- **Needs:** P1
- **Read:** `scripts/nhl-history-archive.py`, `tests/test_nhl_history_archive.py`; first plan §C-ops
- **Write:** `src/archive-release.ts` and `scripts/nhl-history-archive.ts` (`manifest`, `fetch`).
  - `manifest` takes its cutoff from the catalog, validated against `total`. It requires a full inventory, and fails on dressed files with `null` games or games missing from the paired report.
  - `fetch` checks each manifest path against the expected format (full match), so nothing lands outside the root, and verifies bytes and SHA-256.
  - The manifest JSON is byte-identical to Python's, so the release need not change.
- **Done:** pkg-check passes, with tests against a local HTTP server.

#### P9 · Parity gate (Sonnet · medium)

- **Needs:** P7, P8
- **Write:** `scripts/compare-history.ts --left <db> --right <db>`. It dumps every table in primary-key order, and blobs as SHA-256, then reports the first difference per table. A test runs it on two §C-mini builds, and on two that differ by one row.
- **Done:** pkg-check passes. **Gate (Archive):** the orchestrator builds the base and serving files with both pipelines from the same archive, and both comparisons are empty. T2 `--baseline` accepts the TS serving file against the Python T1 truth. The gate is repeated after one nightly refresh.

#### P10 · Cut over (Sonnet · low)

- **Needs:** P9 passed twice
- **Write:** root `package.json` (`data:*` and `test:history` point at `packages/history-build`), `.github/workflows/refresh-nhl-history.yml` (TS steps, keeping the T1 Python step), and `.github/workflows/history-checks.yml` (pkg-check for the new package, plus a Python job for T1 only). Delete the ported Python scripts and tests; keep `scripts/nhl_history_truth.py` and `tests/test_nhl_history_truth.py`.
- **Done:** every check passes. A manual dispatch of the nightly workflow publishes a snapshot, which by P-D6 has a new snapshot ID once.

## Risks

- **`node:sqlite` bulk-insert speed.** The base build writes 2.6 million appearance rows. Prepared statements inside one transaction should match Python. If P5's gate shows otherwise, batch the inserts with multi-row `VALUES`.
- **Archive hashes change once (P-D6).** The nightly sees a new snapshot ID on its first TS run and republishes. This is expected, and the P10 PR says so.
- **`ExperimentalWarning` from `node:sqlite`.** The API already runs it on Node 24 and on Vercel's Node 26 runtime. CLIs can pass `--no-warnings` if the noise matters.

## Ledger

| ID | Title | Tier | Needs | Branch | PR | Status |
| --- | --- | --- | --- | --- | --- | --- |
| P0 | Scaffold `packages/history-build` | Sonnet · low | — | | | todo |
| P1 | Shared I/O and the §C-mini fixture | Sonnet · medium | P0 | | | todo |
| P2 | Port the game-report importer | Sonnet · medium | P1 | | | todo |
| P3 | Port the dressed-goalie importer | Sonnet · medium | P1 | | | todo |
| P4 | Port the reconciliation checker | Sonnet · medium | P2 | | | todo |
| P5 | Port the base build | Sonnet · high | P3, P4 | | | todo |
| P6 | Port the serving tables and Finals step | Sonnet · medium | P5 | | | todo |
| P7 | Port the graph, partner, pack, and opponent steps | Sonnet · high | P6 | | | todo |
| P8 | Port the archive manifest and fetch | Sonnet · medium | P1 | | | todo |
| P9 | Parity gate | Sonnet · medium | P7, P8 | | | todo |
| P10 | Cut over | Sonnet · low | P9 ×2 | | | todo |
