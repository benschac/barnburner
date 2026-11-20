// Ultracite rules this repository turns off. lint/oxlint.ts applies these after Ultracite's presets
// and before the house configs, so a house config that sets one of these rules still wins.
//
// - `conflicts`: the rule rejects code that a house rule in AGENTS.md prescribes.
// - `wrong`: the rule's fix breaks code that type-checks.
// - `style`: a style choice that disagrees with how this repository is written.
// - `pending`: the rule has findings in existing code that need fixing by hand. Each is a
//   follow-up: fix the findings, then delete the entry.

import type { OxlintConfig } from "oxlint";

const conflicts = {
  // Effect core modules: `Effect.gen(function* () {...})` bodies are anonymous generators.
  "func-names": "off",
  // Effect core modules: an `Effect.gen` body that returns on one path and fails or ends on another.
  "typescript/consistent-return": "off",
  // Union model: a schema and its inferred type share a name (`const X = Schema...; type X = ...`).
  "no-redeclare": "off",
  // Error model: reads the `Schema.TaggedError<...>()(...)` class factory as an Error thrown without `new`.
  "unicorn/throw-new-error": "off",
  // Effect core modules: reads data-first `Effect.forEach(xs, f)`, `Effect.map(x, f)` and
  // `Array.map(xs, f)` as passing a `thisArg`.
  "unicorn/no-array-method-this-argument": "off",
  // Effect core modules: both ask for a `for` loop, where the house rule asks for `Effect.forEach`
  // or the `Array` module.
  "unicorn/no-array-for-each": "off",
  "unicorn/no-array-reduce": "off",
  // anti-slop/max-ternary-depth allows a nesting depth of 2.
  "no-nested-ternary": "off",
  // Error model: a module defines several `Schema.TaggedError` classes (packages/season/src/contracts.ts).
  "max-classes-per-file": "off",
  // Union model: a switch over `_tag` lists every member and has no `default`, so
  // typescript/switch-exhaustiveness-check fails on a new member.
  "default-case": "off",
  // Error model: reads `Effect.tryPromise({ catch: (cause) => new TaggedError(...) })` and
  // `Effect.callback((resume) => ...)` as callback-style promises.
  "promise/prefer-await-to-callbacks": "off",
  // Effect core modules: `void` is a type argument in `Effect.callback<void>` and `Deferred.make<void>()`.
  "typescript/no-invalid-void-type": "off",
  // Error model: a foreign exception is named `cause`, the field it is kept in.
  "unicorn/catch-error-name": "off",
  // Effect core modules: `Option.match({ onNone: () => undefined })` handlers return explicitly.
  "unicorn/no-useless-undefined": "off",
  // Effect core modules: `Effect.promise(() => ...)` thunks and tests that return
  // `Effect.runPromise(...)` hand back the runtime's promise; `async` adds nothing.
  "typescript/promise-function-async": "off",
  // Effect core modules: its fix builds `new Set([...a, ...b])` for a membership test, which
  // core/no-set-dedupe rejects in Effect files.
  "unicorn/prefer-set-has": "off",
} as const;

const wrong = {
  // A type alias stays assignable to an index-signature type, such as the node and edge data G6
  // takes; an interface does not, so its fix broke apps/web/src/viz/specs/chain.ts.
  "typescript/consistent-type-definitions": "off",
  // Its fix turns `memo(function TeamPoster(...) {...})` into an arrow, which drops the component's
  // display name (react/display-name then fails).
  "prefer-arrow-callback": "off",
} as const;

const style = {
  // A single-statement `if (...) return` without braces is the existing style, in about 700 places.
  curly: "off",
  // Function declarations and `const` arrows are both used.
  "func-style": "off",
  // NHL game, season and player IDs are codes: `20262027` is the 2026-27 season, not 20_262_027.
  "unicorn/numeric-separators-style": "off",
  // React component files are PascalCase (`TeamPoster.tsx`); Next.js segments are `[[...entry]]`.
  "unicorn/filename-case": "off",
  // Named imports from Node modules (`import { join } from "node:path"`).
  "unicorn/import-style": "off",
  "prefer-destructuring": "off",
  "unicorn/no-await-expression-member": "off",
  "prefer-named-capture-group": "off",
  "no-plusplus": "off",
  "unicorn/consistent-function-scoping": "off",
  "no-inline-comments": "off",
  // SQLite result rows are records keyed by column name, read as `row["game_id"]`.
  "typescript/dot-notation": "off",
  // Integer hashing and the seeded PRNG in the history scripts use bitwise operators on purpose.
  "no-bitwise": "off",
} as const;

const pending = {
  // 260 findings
  "require-unicode-regexp": "off",
  // 76 findings
  "typescript/no-unsafe-member-access": "off",
  // 67 findings
  "no-await-in-loop": "off",
  // 42 findings
  "typescript/strict-boolean-expressions": "off",
  // 26 findings
  "typescript/no-unsafe-type-assertion": "off",
  // 20 findings
  "typescript/no-unsafe-assignment": "off",
  // 19 findings
  "typescript/method-signature-style": "off",
  // 18 findings
  "require-await": "off",
  // 17 findings
  "no-shadow": "off",
  // 12 findings
  "typescript/no-unsafe-return": "off",
  // 11 findings
  "typescript/no-unnecessary-type-conversion": "off",
  // 11 findings
  "typescript/no-explicit-any": "off",
  // 10 findings
  "unicorn/no-array-sort": "off",
  // 10 findings
  "typescript/strict-void-return": "off",
  // 10 findings
  "typescript/no-unsafe-call": "off",
  // 8 findings
  "promise/prefer-catch": "off",
  // 8 findings
  "promise/always-return": "off",
  // 6 findings
  "typescript/use-unknown-in-catch-callback-variable": "off",
  // 5 findings
  "typescript/no-deprecated": "off",
  // 4 findings
  "unicorn/prefer-code-point": "off",
  // 4 findings
  "typescript/no-unsafe-argument": "off",
  // 3 findings
  "unicorn/no-useless-spread": "off",
  // 3 findings
  "node/callback-return": "off",
  // 2 findings
  "typescript/prefer-nullish-coalescing": "off",
  // 2 findings
  "typescript/no-redundant-type-constituents": "off",
  // 2 findings
  "typescript/no-base-to-string": "off",
  // 2 findings
  "import/no-cycle": "off",
  // 2 findings
  "no-use-before-define": "off",
  // 2 findings
  "no-template-curly-in-string": "off",
  // 2 findings
  "no-sequences": "off",
  // 2 findings
  "no-empty-function": "off",
  // 1 finding
  "unicorn/prefer-structured-clone": "off",
  // 6 findings
  "unicorn/prefer-single-call": "off",
  // 1 finding
  "unicorn/prefer-native-coercion-functions": "off",
  // 1 finding
  "unicorn/prefer-export-from": "off",
  // 1 finding
  "unicorn/no-immediate-mutation": "off",
  // 1 finding
  "unicorn/no-array-reverse": "off",
  // 1 finding
  "typescript/prefer-for-of": "off",
  // 1 finding
  "typescript/no-empty-object-type": "off",
  // 1 finding
  "typescript/no-empty-interface": "off",
  // 1 finding
  "promise/no-nesting": "off",
  // 1 finding
  "oxc/no-barrel-file": "off",
  // 1 finding
  "no-param-reassign": "off",
  // 1 finding
  "logical-assignment-operators": "off",
} as const;

export const off: OxlintConfig = {
  rules: { ...conflicts, ...wrong, ...style, ...pending },
  overrides: [
    {
      // JavaScript files carry no types, so every value is `any` to the type-aware rules.
      files: ["**/*.{js,mjs,cjs}"],
      rules: {
        "typescript/no-unsafe-argument": "off",
        "typescript/no-unsafe-assignment": "off",
        "typescript/no-unsafe-call": "off",
        "typescript/no-unsafe-member-access": "off",
        "typescript/no-unsafe-return": "off",
        "typescript/strict-boolean-expressions": "off",
      },
    },
  ],
};

/** apps/web only: rules from Ultracite's React preset. */
export const webOff: OxlintConfig = {
  rules: {
    // The React Compiler cannot lower `yield`, so it reports every `Effect.gen` in a hook or component.
    "react/todo": "off",
    // Design contract: UI is built from Tamagui components (`<Copy role="status">`,
    // `<Label render="span">`, `render={<a href=... />}`), not the native tags these rules expect.
    "jsx-a11y/prefer-tag-over-role": "off",
    "jsx-a11y/label-has-associated-control": "off",
    "jsx-a11y/control-has-associated-label": "off",
    // pending: see the note at the top of this file.
    // 3 findings
    "react/exhaustive-effect-dependencies": "off",
    // 2 findings
    "react/rule-suppression": "off",
    // 1 finding
    "react/no-unstable-nested-components": "off",
    // 1 finding
    "react/no-unescaped-entities": "off",
    // 1 finding
    "react/jsx-no-constructed-context-values": "off",
  },
};
