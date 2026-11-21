# Lint feedback

Use `bun run verify:tooling` for local changes limited to lint fixture runners, their dedicated configuration, and related documentation. It runs formatting, the root API/index/script guards, all workspace typechecks, and source lint. Turbo reuses successful rule-fixture results when their inputs are unchanged. Application, dependency, manifest, production configuration, and mixed changes still require the full checks in `AGENTS.md`, including the applicable web build. Run those full checks before merging.

`bun run lint:rules` runs the fixture tasks directly. Add `--force` to exercise all cases instead of using cached results. Source lint remains uncached. For a targeted workspace, use the root `bun run lint --filter=@nhl-reddit-stats/history` (substitute the workspace name). Direct package `lint` scripts contain source checks only. The History/API CI workflow enters the filtered root graph so its fixture coverage and the cache-boundary guard remain active.

## Fixture and cache boundaries

Core, union, design, actor-pattern, and XState cases are separate files in ignored package-root `.lint-fixtures-*` directories. Each invocation has a nearest TypeScript project listing only its own fixtures. Web fixtures use production lint overrides with their paths prefixed to the generated root; the real frame source is never replaced. Fixture file counts, per-file expectations, plugin crashes, and process exit status are checked.

The normal stylesheet audit skips only reserved fixture roots directly under the web package. Its negative test audits its own fixture directory explicitly. Application typechecks and builds do not include these fixture directories. Do not run source lint concurrently with a Tamagui production build: the build temporarily transforms application files before restoring them.

Rule-task hashes include their runners, workspace compiler/lint configuration, shared lint plugins and configs, tool versions through the lockfile, and the logger. Web rules also hash the design contract. Design cases read team logos and the team registry; actor-pattern cases import the season contracts and their team registry, so those files are inputs too. Add input coverage whenever a fixture starts importing another workspace or reading another file.

NHL snapshots and shared runtime helpers are inputs of build/typecheck tasks, rather than global inputs that invalidate every rule test. The cache-boundary tests use real Turbo dry-run hashes in isolated temporary repositories to check rule/config invalidation, runtime-data invalidation, and unrelated-source reuse. Run them with `bun run test:lint-tools`.

## Measurements

On 20 November 2026, with Bun 1.4.3, Node 24.18.0, Turbo 2.11.10, Oxlint 1.94.0, and `@effect/tsgo` 0.73.2:

- The first uncached run of all 12 fixture tasks passed in 5.6 seconds. It exercised 372 cases across the six workspace configurations, plus the stylesheet rejection check.
- A clean-checkout tooling verification passed in 8.7 seconds before the repeated comparison below.
- Five runs per scheduler setting were interleaved, forcing every task to run. Every run passed. Concurrency 10 had a median of 7.44 seconds, range 6.83–7.58; concurrency 2 had a median of 14.02 seconds, range 13.24–14.12. The default concurrency was retained.

These are observations on one shared machine, not fixed runtime guarantees. The earlier two-minute lint run used sequential fixture runners and is context, not a controlled baseline for the revised task graph. All formatting and lint checks still inspect ordinary files; unrelated unfinished prototype work can therefore block the whole-checkout verifier.
