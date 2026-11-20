# anti-slop (vendored)

- Source: https://github.com/K-Mistele/anti-slop (fork of https://github.com/dmmulroy/anti-slop), MIT. See [LICENSE](LICENSE).
- Commit: e9191cb8eaa1dc4242a3b0ded96aaf84e8f44d26
- Copied from `src/`, tests included. `plugins/effect.ts` is removed. It was dropped because `oxlint-plugin-effect` needs `@oxlint/plugins` 1.94 while the repository pinned `oxlint` 1.91 for `@effect/tsgo` 0.67.1. The repository now pins `oxlint` and `@oxlint/plugins` 1.94.0 with `@effect/tsgo` 0.73.2, so the plugin can be restored; that is not done yet.
- Local additions: `modes/with-changes.ts` (and its test) computes changed lines before the linter starts and passes them through `ANTI_SLOP_CHANGES`, which `modes/changed.ts` reads. In CI the type-aware linter could not fork git (`spawnSync git ENOMEM`), so every line was checked. `modes/changed.ts` also drops lines changed only by formatting: when the repository root has an Oxfmt config, it formats both sides of each changed file before diffing (`modes/changed-format.test.ts`), so the repository-wide format does not mark every line as changed. `modes/wrap.test.ts` no longer imports the removed `plugins/effect.ts`.
- The upstream `xstate/` rules target XState 5 and are removed. `xstate6/pure-transitions` in `apps/web/lint/xstate-plugin.mjs` replaces them for XState 6.
- `rules/no-module-mocking.ts` also reports `mock.module` from `node:test` (imported `mock` and `t.mock`), the test runner this repository uses; upstream covers only Vitest and Jest.
- `effect/rules/no-manual-tag-comparison.ts` allows a `switch` over `_tag` (the exhaustiveness lint covers it), and `effect/rules/no-manual-tagged-type.ts` allows `Extract`/`Exclude` member selection. Both match the union model in AGENTS.md.
- This is our code now: change rules here and keep them in sync with the project's standards. To take upstream changes, follow upstream `skills/install-anti-slop/references/update.md` and merge rather than overwrite.
