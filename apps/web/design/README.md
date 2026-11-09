# Design rules

`contract.json` is the shared source for the app's semantic palettes and approved scales. Tamagui config consumes it; the local Oxlint plugin checks UI source against it. Use semantic colors such as `surface`, `color`, and `win`, including in hover/theme conditions. Absolute palette tokens are intentionally forbidden.

Use the compact spacing scale and named typography tokens. Numeric spacing/sizing is rejected; percentages, `auto`, and full viewport height are structural values. Border widths and letter spacing have small numeric allowlists. Poster/banner/chart dimensions are named geometric tokens, not general-purpose spacing. Grid and print zoom recipes are exact allowlisted values because they describe document geometry.

The only inline-style exception is an object containing exactly a table `display` value: Tamagui 3.3's typed `display` prop excludes these modes. No additional style properties can accompany it. Canvas drawing coordinates remain numbers inside `drawChart`; JSX chart dimensions use tokens and chart colors come from `useTheme()`.

Unknown dynamic token expressions fail closed. Literal conditionals and local immutable const values can be checked. Expand prop/object spreads and keep `styled()` options inline. This intentionally favors reviewable UI recipes over arbitrary runtime styling. Rules cover source JS/TS variants; they are policy checks, not a JavaScript security sandbox. Canvas imperative drawing and direct DOM APIs still require code review.

Run `npm run lint` from the repository root. It runs Oxlint, checks for handwritten stylesheets, and exercises positive/negative cases through the real Oxlint executable. CI runs lint, strict Tamagui validation, and the production build. Visual/contrast checks remain separate.

The app also applies the cached Ratstack guidance on actor ownership and shared constants. The official `xstate-effect/no-inline-effect` rule requires declared Effect actions and actors. The local `patterns/no-module-mutable-state` rule rejects module-level `let` and `var` bindings in UI source; it does not prove deep immutability. Actor context owns navigation state, the team registry owns team metadata, and this design contract owns style constants. Positive and negative fixtures run through Oxlint with `scripts/test-pattern-rules.mjs`.

To extend the design system, change the contract and its consuming components together, add a regression case when changing enforcement, and run all checks. Do not add a token merely to preserve an arbitrary pixel measurement or suppress a rule for a whole existing component.
