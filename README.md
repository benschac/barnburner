# NHL Reddit Stats

A static, editable recreation of the New Jersey Devils “Season at a Glance” graphic, with NHL data through November 8, 2026. Built with Vite, React, TypeScript, and Tamagui in an npm workspace managed by Turborepo.

## Preview

```sh
npm ci
npm run dev -- -- --host 127.0.0.1 --port 4173
```

Open http://127.0.0.1:4173. The 1206 × 1518 poster scales proportionally to the viewport. Small screens preserve the original dense graphic rather than rearranging the sections. Browser/pinch zoom remains enabled.

## Workspace

`apps/web` owns the application, dependencies, and task scripts. The root package delegates tasks to Turbo. Add shared libraries under `packages/` when needed.

Run all commands from the repository root. To target this app, use `npm run build -- --filter=@nhl-reddit-stats/web`. Production output is in `apps/web/dist`. `npm run preview` builds and serves that output.

The task and workspace setup follows [the Turborepo migration guide](https://turborepo.dev/docs/getting-started/add-to-existing-repository).

## Content and assets

- `apps/web/src/App.tsx`: semantic page sections, standings, schedules, and leaders.
- `apps/web/src/stats.ts` contains a point-in-time snapshot from the NHL's [regular-season schedule](https://api-web.nhle.com/v1/club-schedule-season/NJD/20262027), [standings](https://api-web.nhle.com/v1/standings/2026-11-09), [club stats](https://api-web.nhle.com/v1/club-stats/NJD/20262027/2), and [team summary](https://api.nhle.com/stats/rest/en/team/summary?limit=-1&cayenneExp=seasonId%3D20262027%20and%20gameTypeId%3D2). The playoff chart compares points in the same-day standings with the first team out when the Devils hold a playoff spot, or with the last wild card when they are outside.
- `apps/web/src/Charts.tsx`: high-resolution canvas charts with accessible text descriptions.
- `apps/web/src/index.css`: poster layout, typography, and responsive scaling containment.
- `apps/web/public/assets`: local NHL logos, player portraits, Graduate and Roboto Condensed fonts, and Material venue icons. Source URLs and licenses are documented in `apps/web/public/assets/SOURCES.md`.

The reference screenshot is used for comparison only and is not embedded in the page. There are no API calls or runtime asset CDN requests.

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
