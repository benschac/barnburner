import { defineConfig } from "oxlint";

import { web, ultracite } from "../../lint/oxlint.ts";

export default defineConfig({
  ...ultracite,
  extends: web,
  options: {
    typeAware: true,
  },
  plugins: ["react", "typescript", "oxc"],
  rules: {
    "anti-slop/no-instanceof": "off",
    "react/only-export-components": [
      "warn",
      {
        allowConstantExport: true,
      },
    ],
  },
  jsPlugins: [
    "./lint/design-plugin.mjs",
    "./lint/patterns-plugin.mjs",
    "./lint/xstate-plugin.mjs",
    "@xstate/effect/oxlint",
  ],
  overrides: [
    {
      files: ["src/viz/**/*.{ts,tsx,js,jsx,mts,cts,mjs,cjs}"],
      rules: {
        "design/viz-theme-colors": "error",
      },
    },
    {
      files: ["src/**/*.{ts,tsx,js,jsx,mts,cts,mjs,cjs}"],
      rules: {
        "no-restricted-imports": [
          "error",
          {
            patterns: [
              {
                group: [
                  "**/api/**",
                  "@nhl-reddit-stats/api",
                  "@nhl-reddit-stats/api/*",
                ],
                message:
                  "Browser code imports shared season contracts, never API implementations.",
              },
              {
                group: ["**/data/boxscores/**", "**/lib/nhl-boxscores.mjs"],
                message:
                  "Browser code reads box scores through the GetGameBoxscore RPC summary, never the raw archive.",
              },
            ],
          },
        ],
        "patterns/no-module-mutable-state": "error",
        "xstate6/pure-transitions": "error",
        "xstate-effect/no-inline-effect": "error",
        "design/semantic-colors": "error",
        "design/token-values": "error",
        "design/no-style-escape": "error",
        "design/no-css-imports": "error",
      },
    },
    {
      files: ["src/viz/frame/frame.ts"],
      rules: {
        "design/no-css-imports": "off",
        "design/no-style-escape": "off",
      },
    },
    {
      // Module augmentation merges declarations, which only an interface can do, and
      // `TamaguiCustomConfig extends AppConfig {}` adds no members of its own.
      files: ["tamagui.config.ts"],
      rules: {
        "typescript/consistent-type-definitions": "off",
        "typescript/no-empty-interface": "off",
        "typescript/no-empty-object-type": "off",
      },
    },
    {
      // Imports .content-collections/generated, which is gitignored: in a checkout that has not
      // built it the import is `any`. `bun run docs:plan` builds it, and `bun run typecheck:plan` then checks this file.
      files: ["plan-viewer/render-plan.ts"],
      rules: {
        "typescript/no-unsafe-assignment": "off",
        "typescript/no-unsafe-member-access": "off",
      },
    },
    {
      // pending: `withTamagui` is deprecated; its replacement is a move to `tamagui build`.
      files: ["next.config.js"],
      rules: {
        "typescript/no-deprecated": "off",
      },
    },
    {
      files: [
        "tamagui.build.ts",
        "next.config.js",
        "scripts/check-vercel-output.mjs",
      ],
      rules: {
        "effecttsgo/process-env": "off",
      },
    },
    {
      files: ["**/*.test.ts", "**/*.test.tsx"],
      rules: {
        "typescript/no-floating-promises": "off",
      },
    },
  ],
});
