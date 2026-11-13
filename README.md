# NHL Reddit Stats

A shared “Season at a Glance” poster for all 32 NHL teams, using saved NHL schedules, results, standings, special teams, and player leaders. Built with Vite, React, TypeScript, and Tamagui in a Bun workspace managed by Turborepo.

> [!NOTE]
> I coded this for fun. It's still early and a bit messy, so expect rough edges and bugs.

## Preview

```sh
bun install --frozen-lockfile
# Terminal 1: serve the saved NHL data
bun run data:serve

# Terminal 2: serve the web app
bun run dev -- --host 127.0.0.1 --port 4173
```

Open http://127.0.0.1:4173. Select a team to load its poster in place. Shareable links such as `/team/BOS` open a team directly; legacy links such as `#team/BOS` still work. The default route and `#poster` open New Jersey. The layout rearranges sections on small screens, and charts scroll horizontally when needed. Browser zoom remains enabled.

## Workspace

`apps/web` owns the application, dependencies, and task scripts. The root package delegates tasks to Turbo. Add shared libraries under `packages/` when needed.

Run all commands from the repository root. To target this app, use `bun run build --filter=@nhl-reddit-stats/web`. Production output is in `apps/web/dist`. `bun run preview` builds and serves that output.

The task and workspace setup follows [the Turborepo migration guide](https://turborepo.dev/docs/getting-started/add-to-existing-repository).

## Content and assets

The league-wide game snapshot and read-only team API are documented in [data/README.md](data/README.md). `bun run data:serve` starts the [Effect Node server](apps/api/README.md) at `http://127.0.0.1:3001`. The app calls `GetTeamData` through `/api/rpc`, using the shared contract in `packages/season`; the GET endpoints remain available for direct consumers. Vite proxies `/api` in development and preview. The Vercel entrypoint in `apps/web/api` hosts the same router alongside the static frontend, using bundled snapshots.

- `apps/web/src/App.tsx`: semantic page sections, standings, schedules, and leaders.
- `apps/web/src/stats.ts`: selected-team poster formatting from validated backend snapshots.
- `lib/nhl-poster.mjs` and `scripts/refresh-nhl-poster.mjs`: normalization and explicit refresh of the supplemental NHL feeds. The playoff chart compares same-day points with the first team out when the selected team holds a playoff spot, or with the last wild card when it is outside.
- `apps/web/src/Charts.tsx`: high-resolution canvas charts with accessible text descriptions.
- `apps/web/public/assets`: local NHL logos, player portraits, Graduate and Roboto Condensed fonts, and Material venue icons. Source URLs and licenses are documented in `apps/web/public/assets/SOURCES.md`.

The reference screenshot is used for comparison only and is not embedded in the page. Team data comes from the API, while player portraits use the NHL image URLs recorded in the snapshot. The [data guide](data/README.md#box-scores-and-automation) covers manual and scheduled refreshes. Production snapshot updates require a new deployment.

## Social previews

Each build generates 1200×630 PNG cards and HTML metadata for all 32 `/team/{TEAM}` URLs. The default page previews New Jersey. Cards reuse `teamPoster()` and the shared design palette, with local fonts and logos rendered by the build-only `@resvg/resvg-js` dependency. No NHL requests or image-rendering service run when a crawler opens a link.

Cards include the team's record, points, division rank, streak, last ten, special teams, points leader, and snapshot timestamps. Refresh the saved data and rebuild/deploy to update them. Image URLs include a content hash to distinguish changed cards; social platforms may still cache a link's metadata.

Set `SITE_URL=https://your-domain.example` at build time for a custom canonical domain. Otherwise the build uses Vercel's `VERCEL_PROJECT_PRODUCTION_URL`, then `VERCEL_URL`, then `http://localhost:5173` for local development. Preview deployments use their own `VERCEL_URL` for image assets, so new image hashes resolve before production is updated. These variables and `VERCEL_ENV` are included in the Turbo build cache key. Other static hosts must serve `/team/BOS` from `dist/team/BOS.html`; Vercel's `cleanUrls` setting handles this here.

Run `bun run --cwd apps/web test:social` for PNG and metadata checks. `apps/web/social/card.ts` owns the SVG layout; `apps/web/social/plugin.ts` owns validation, raster generation, and crawler metadata.

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
