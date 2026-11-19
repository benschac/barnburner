# anti-slop (vendored)

- Source: https://github.com/K-Mistele/anti-slop (fork of https://github.com/dmmulroy/anti-slop), MIT. See [LICENSE](LICENSE).
- Commit: e9191cb8eaa1dc4242a3b0ded96aaf84e8f44d26
- Copied from `src/`, tests included. `plugins/effect.ts` is removed because `oxlint-plugin-effect` needs `@oxlint/plugins` 1.94 and this repository pins `oxlint` 1.91 for `@effect/tsgo` 0.67.1.
- This is our code now: change rules here and keep them in sync with the project's standards. To take upstream changes, follow upstream `skills/install-anti-slop/references/update.md` and merge rather than overwrite.
