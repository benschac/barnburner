# NHL Reddit Stats

A shared “Season at a Glance” poster for all 32 NHL teams, using saved NHL schedules, results, standings, special teams, and player leaders. Built with Vite, React, TypeScript, and Tamagui in an npm workspace managed by Turborepo.

## Preview

```sh
npm ci
# Terminal 1: serve the saved NHL data
npm run data:serve

# Terminal 2: serve the web app
npm run dev -- -- --host 127.0.0.1 --port 4173
```

Open http://127.0.0.1:4173. Select a team to load its poster in place. Links such as `#team/BOS` open a team directly; the default route and `#poster` open New Jersey. The layout rearranges sections on small screens, and charts scroll horizontally when needed. Browser zoom remains enabled.

## Workspace

`apps/web` owns the application, dependencies, and task scripts. The root package delegates tasks to Turbo. Add shared libraries under `packages/` when needed.

Run all commands from the repository root. To target this app, use `npm run build -- --filter=@nhl-reddit-stats/web`. Production output is in `apps/web/dist`. `npm run preview` builds and serves that output.

The task and workspace setup follows [the Turborepo migration guide](https://turborepo.dev/docs/getting-started/add-to-existing-repository).

## Content and assets

The league-wide game snapshot and read-only team API are documented in [data/README.md](data/README.md). `npm run data:serve` serves the local snapshot at `http://127.0.0.1:3001/api/games?team=NJD`. The app loads `/api/games` and `/api/poster` through the Vite development and preview proxy. Production hosting must route those paths to the read-only API; the static build alone does not serve them.

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
npm run build
npm run lint
npm run typecheck
npm run check:tamagui
```

`build` includes TypeScript validation. Visual comparison evidence is saved locally under `.audit/graphic/`; `design-qa.md` records the comparison passes and remaining fidelity limits.

## Tamagui configuration

The existing provider and configuration are retained. `apps/web/tamagui.config.ts` uses `@tamagui/config/v6`; `apps/web/tamagui.build.ts` owns compiler options. Vite generates `apps/web/src/tamagui.generated.css` (ignored) before resolving its import. After configuration changes, run `npm run generate:tamagui` to refresh `apps/web/tamagui-prompt.md`.
# barnburner
