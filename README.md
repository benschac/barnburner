# NHL Reddit Stats

Vite, React, and TypeScript with Tamagui 3.3.1. The screen is a setup demo with an interactive counter.

## Run the app

Use Node.js 20.19+ or 22.12+.

```sh
npm ci
npm run dev
```

Open the local URL printed by Vite. The page shows a styled card and a button that increments the counter.

## Check the setup

```sh
npm run typecheck
npm run check:tamagui
npm run lint
npm run build
npm run preview
```

`check:tamagui` runs the strict Tamagui dependency and style checker. `build` typechecks and produces the app in `dist/`.

## Change the design system

Edit `tamagui.config.ts`. It uses `@tamagui/config/v6` and the CSS animation driver. `src/main.tsx` mounts one provider with the light theme. Components use v3 style props with bare tokens and flat conditional values, such as `p="4 md:8"`.

The v6 preset enables shorthand-only props. Use its names such as `w`, `p`, `rounded`, `items`, and `justify`. Plain components from `tamagui` use style props. Tailwind `className` authoring requires the separate `@tamagui/tailwind` frontend and its bundler integration.

`tamagui.build.ts` owns compiler options, and `vite.config.ts` loads them through `@tamagui/cli/vite`. Development keeps runtime styling; production extracts static component styles. The plugin generates `src/tamagui.generated.css` before Vite resolves its import. The provider disables duplicate config CSS injection. Generated CSS and `.tamagui/` are ignored.

After changing the config, regenerate the project vocabulary:

```sh
npm run generate:tamagui
```

This updates `tamagui-prompt.md`. Keep all direct Tamagui dependencies pinned to the same version.

## Setup references

The setup follows Tamagui's [introduction](https://tamagui.dev/docs/intro/introduction), [installation](https://tamagui.dev/docs/intro/installation), [Vite guide](https://tamagui.dev/docs/guides/vite), [style syntax](https://tamagui.dev/docs/intro/styles), [Tailwind frontend](https://tamagui.dev/docs/core/tailwind), and [compiler guide](https://tamagui.dev/docs/intro/compiler-install).

The supplied [agents guide](https://tamagui.dev/docs/intro/agents) redirects to installation. Its current setup brief is available through `npx tamagui setup`. That brief still mentions a beta dist-tag; this app uses the stable 3.3.1 release verified in npm.
