// Ultracite rules this repository turns off or sets an option on. lint/oxlint.ts applies these
// after Ultracite's presets and before the house configs, so a house config that sets one of
// these rules still wins.
//
// - `conflicts`: the rule rejects code that a house rule in AGENTS.md prescribes.
// - `configured`: the rule stays on, with an option that fits how this code is written.
// - `style`: a style choice that disagrees with how this repository is written.
// - `declined`: a rule left off for good, because most of its findings are in tests and it finds
//   few bugs here.
// - `pending` (a comment on an entry): the rule has findings in existing code that need fixing by
//   hand. Fix the findings, then delete the entry.

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
  // Effect core modules: asks for `toSorted`, where core/no-native-sort asks for `Array.sort` with
  // an `Order`.
  "unicorn/no-array-sort": "off",
  // A type assertion is allowed with a `// SAFETY:` comment, which
  // anti-slop/require-safety-comment-for-type-assertion enforces; this rule rejects those too.
  "typescript/no-unsafe-type-assertion": "off",
} as const;

const configured = {
  // Object types are type aliases: an alias stays assignable to an index-signature type, such as
  // the node and edge data G6 takes, and an interface does not.
  "typescript/consistent-type-definitions": ["error", "type"],
  // A named function keeps a component's display name in `memo(function TeamPoster(...) {...})`.
  "prefer-arrow-callback": ["error", { allowNamedFunctions: true }],
  // Function declarations are hoisted, and mutually recursive ones cannot all come first.
  "no-use-before-define": ["error", { functions: false, variables: false }],
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
  // SQL text carries `${DATA_DIR}` as a literal placeholder that packages/analyst/src/db.ts fills in.
  "no-template-curly-in-string": "off",
} as const;

const declined = {
  // The `u` and `v` flags change nothing for the ASCII patterns used here; 183 of 260 findings are in tests.
  "require-unicode-regexp": "off",
  // Tests and scripts await in order on purpose (48 of 67 findings are in tests); Effect code has
  // no `await`, and effecttsgo/all-of-map-to-for-each covers the Effect form.
  "no-await-in-loop": "off",
  // Truthiness checks on strings, numbers and nullable values are the existing style.
  "typescript/strict-boolean-expressions": "off",
  // An `async` test or handler with no `await` is how node:test and route signatures are written
  // (16 of 18 findings are in tests).
  "require-await": "off",
} as const;

export const off: OxlintConfig = {
  rules: { ...conflicts, ...configured, ...style, ...declined },
  overrides: [
    {
      // Tests read fixtures and mocks as `any`; most no-unsafe findings were there. A test may also
      // check a JSON round trip or pass an async callback where the caller ignores the promise.
      files: [
        "**/*.test.{ts,tsx}",
        "**/tests/**",
        "**/test/**",
        "**/__tests__/**",
      ],
      rules: {
        "typescript/no-unsafe-argument": "off",
        "typescript/no-unsafe-assignment": "off",
        "typescript/no-unsafe-call": "off",
        "typescript/no-unsafe-member-access": "off",
        "typescript/no-unsafe-return": "off",
        "typescript/strict-void-return": "off",
        "unicorn/prefer-structured-clone": "off",
      },
    },
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
    // pending, 3 findings: effects that re-run on a value they do not read (Charts.tsx,
    // VizFrameIsland.tsx, use-boxscore.ts).
    "react/exhaustive-effect-dependencies": "off",
  },
};
