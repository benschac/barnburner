# NHL Reddit Stats

A static, editable recreation of the New Jersey Devils “Season at a Glance — November 8” graphic. Built in the existing Vite, React, TypeScript, and Tamagui app.

## Preview

```sh
npm ci
npm run dev -- --host 127.0.0.1 --port 4173
```

Open http://127.0.0.1:4173. The 1206 × 1518 poster scales proportionally to the viewport. Small screens preserve the original dense graphic rather than rearranging the sections. Browser/pinch zoom remains enabled.

## Content and assets

- `src/App.tsx`: semantic page sections, standings, schedules, and leaders.
- `src/stats.ts`: hardcoded values transcribed from the supplied screenshot; these are not current/live NHL statistics.
- `src/Charts.tsx`: high-resolution canvas charts with accessible text descriptions.
- `src/index.css`: poster layout, typography, and responsive scaling containment.
- `public/assets`: local NHL logos, player portraits, Graduate and Roboto Condensed fonts, and Material venue icons. Source URLs and licenses are documented in `public/assets/SOURCES.md`.

The reference screenshot is used for comparison only and is not embedded in the page. There are no API calls or runtime asset CDN requests. No new dependencies were added.

## Validation

```sh
npm run build
npm run lint
npm run check:tamagui
```

`build` includes TypeScript validation. Visual comparison evidence is saved locally under `.audit/graphic/`; `design-qa.md` records the comparison passes and remaining fidelity limits.

## Tamagui configuration

The existing provider and configuration are retained. `tamagui.config.ts` uses `@tamagui/config/v6`; `tamagui.build.ts` owns compiler options. Vite generates `src/tamagui.generated.css` (ignored) before resolving its import. After configuration changes, run `npm run generate:tamagui` to refresh `tamagui-prompt.md`.
