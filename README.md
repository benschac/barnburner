# NHL Reddit Stats

A shared “Season at a Glance” poster for all 32 NHL teams, using saved NHL schedules, results, standings, special teams, and player leaders. Built with Vite, React, TypeScript, and Tamagui in a Bun workspace managed by Turborepo.

## Preview

```sh
bun install --frozen-lockfile
# Terminal 1: serve the saved NHL data
bun run data:serve

# Terminal 2: serve the web app
bun run dev -- --host 127.0.0.1 --port 4173
```

Open http://127.0.0.1:4173. Select a team to load its poster in place. Links such as `#team/BOS` open a team directly; the default route and `#poster` open New Jersey. The layout rearranges sections on small screens, and charts scroll horizontally when needed. Browser zoom remains enabled.

## Workspace

`apps/web` owns the application, dependencies, and task scripts. The root package delegates tasks to Turbo. Add shared libraries under `packages/` when needed.

Run all commands from the repository root. To target this app, use `bun run build --filter=@nhl-reddit-stats/web`. Production output is in `apps/web/dist`. `bun run preview` builds and serves that output.

The task and workspace setup follows [the Turborepo migration guide](https://turborepo.dev/docs/getting-started/add-to-existing-repository).

## Content and assets

The league-wide game snapshot and read-only team API are documented in [data/README.md](data/README.md). `bun run data:serve` starts the [Effect Node server](apps/api/README.md) at `http://127.0.0.1:3001`. The app calls `GetTeamData` through `/api/rpc`, using the shared contract in `packages/season`; the GET endpoints remain available for direct consumers. Vite proxies `/api` in development and preview. Production hosting must route `/api` to the API server; the static build alone does not serve it.

- `apps/web/src/App.tsx`: semantic page sections, standings, schedules, and leaders.
- `apps/web/src/stats.ts`: selected-team poster formatting from validated backend snapshots.
- `lib/nhl-poster.mjs` and `scripts/refresh-nhl-poster.mjs`: normalization and explicit refresh of the supplemental NHL feeds. The playoff chart compares same-day points with the first team out when the selected team holds a playoff spot, or with the last wild card when it is outside.
- `apps/web/src/Charts.tsx`: high-resolution canvas charts with accessible text descriptions.
- `apps/web/public/assets`: local NHL logos, player portraits, Graduate and Roboto Condensed fonts, and Material venue icons. Source URLs and licenses are documented in `apps/web/public/assets/SOURCES.md`.

The reference screenshot is used for comparison only and is not embedded in the page. Team data comes from the local API, while player portraits use the NHL image URLs recorded in the snapshot. Refreshes are explicit; no background NHL polling or deployment is configured.

## Credits

Reference and inspiration: [the original r/devils Reddit post](https://www.reddit.com/r/devils/s/jmn4emEiez).

## Validation

```sh
bun run build
bun run lint
bun run typecheck
bun run check:tamagui
```

`typecheck` and the web build use Effect-aware TSRS via `@effect/tsgo@0.67.1`, pinned to TSRS `0.21.0-ts7.1.0-beta`, matching the personal-site toolchain. The web check covers both application and tooling configs; Turbo also checks the API and shared season package. TypeScript remains installed for tools that consume its API. Effect errors fail the check; existing Effect warnings and suggestions remain visible and do not fail it.

Use Bun 1.4.3 for installation and script orchestration. Node 24 remains required for the API, existing test suites, and Node-based tooling. `bun run test:data`, `bun run --cwd apps/api test`, and `bun run --cwd apps/web test:teams` run those suites.

`build` includes TypeScript validation. Visual comparison evidence is saved locally under `.audit/graphic/`; `design-qa.md` records the comparison passes and remaining fidelity limits.

## Tamagui configuration

The existing provider and configuration are retained. `apps/web/tamagui.config.ts` uses `@tamagui/config/v6`; `apps/web/tamagui.build.ts` owns compiler options. Vite generates `apps/web/src/tamagui.generated.css` (ignored) before resolving its import. After configuration changes, run `bun run generate:tamagui` to refresh `apps/web/tamagui-prompt.md`.
# barnburner
