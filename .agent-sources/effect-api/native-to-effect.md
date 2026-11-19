# Native pattern to Effect core module

Look up the native pattern you are about to write, use the Effect API in the second column, and read its declaration through [core-index.md](core-index.md). The third column names the lint rule that reports the native pattern. `core/*` rules come from `lint/effect-core-plugin.mjs` and `effecttsgo/*` rules from `@effect/tsgo`; a package reports them once it adopts them in its `.oxlintrc.json`.

Check the declaration before replacing a call. Several Effect versions differ from the native one: `Array.findFirst` returns `Option`, `String.indexOf` returns `Option<number>`, and Effect callbacks take `(value, index)` only.

## Collections

| Native | Effect | Rule |
| --- | --- | --- |
| `xs.sort((a, b) => a - b)`, `xs.toSorted(...)` | `Array.sort(xs, Order.Number)`; by a key, `Array.sortWith(xs, (x) => x.id, Order.Number)`; several keys, `Array.sortBy(...orders)`; descending, `Order.flip` | `core/no-native-sort` |
| An `Order` comparing fields | `Order.mapInput(Order.Number, (x) => x.games)`, `Order.combine`, `Order.Struct` | |
| `[...new Set(xs)]`, `Array.from(new Set(xs))` | `Array.dedupe(xs)`; by a key, `Array.dedupeWith` | `core/no-set-dedupe` |
| `for` loop that pushes into an array | `Array.map`, `Array.flatMap`, `Array.filterMap`, `Array.partition` | |
| `xs.reduce((s, x) => s + x, 0)` | `Number.sumAll(xs)` | |
| Largest or smallest element | `Array.max(xs, Order.Number)`, `Array.min` | |
| Group into an object | `Array.groupBy(xs, (x) => x.key)` | |
| `xs.find(...)`, `xs.findIndex(...)` | `Array.findFirst`, `Array.findFirstIndex` (return `Option`) | `effecttsgo/prefer-effect-array` |
| `Array.from({ length: n }, f)` | `Array.makeBy(n, f)`, `Array.range(start, end)` | |
| `Object.keys`, `Object.entries`, `Object.fromEntries` | `Record.keys`, `Record.toEntries`, `Record.fromEntries`, `Record.map` | `effecttsgo/prefer-effect-record` |
| `x ?? fallback` for a value that may be missing | `Option.fromNullishOr(x)`, then `Option.getOrElse` | |

## Effects over many values

| Native | Effect | Rule |
| --- | --- | --- |
| `for (const x of xs) { yield* f(x) }` collecting results | `yield* Effect.forEach(xs, f)`; add `{ concurrency }` when the calls are independent | `core/no-yield-in-loop` |
| `Effect.all(xs.map(f))` | `Effect.forEach(xs, f)` | `effecttsgo/all-of-map-to-for-each` |
| A loop that threads state through effects | `Effect.reduce` | `core/no-yield-in-loop` |
| `Promise.all`, `new Promise`, `async` functions | `Effect.forEach`, `Effect.callback`, `Effect.gen` | `effecttsgo/new-promise`, `effecttsgo/async-function` |
| `yield*` written as a call argument | Yield into a `const` first, or `Effect.map` | `effecttsgo/yield-in-call-argument` |

## Platform globals

| Native | Effect | Rule |
| --- | --- | --- |
| `JSON.parse`, `JSON.stringify` | `Schema.fromJsonString(schema)`; see the JSON boundary in AGENTS.md | `effecttsgo/global-json`, `effecttsgo/global-json-in-effect` |
| `Date.now()`, `new Date()` | `Clock.currentTimeMillis`, `DateTime.now` | `effecttsgo/global-date`, `effecttsgo/global-date-in-effect` |
| `Math.random()` | `Random.next`, `Random.nextIntBetween` | `effecttsgo/global-random`, `effecttsgo/global-random-in-effect` |
| `setTimeout`, `setInterval` | `Effect.sleep`, `Schedule.spaced` | `effecttsgo/global-timers`, `effecttsgo/global-timers-in-effect` |
| `console.log` | `Effect.log`, `Effect.logInfo` | `effecttsgo/global-console`, `effecttsgo/global-console-in-effect` |
| `process.env.NAME` | `Config.String('NAME')` | `effecttsgo/process-env`, `effecttsgo/process-env-in-effect` |
| `fetch` | `HttpClient` from `effect/http` | `effecttsgo/global-fetch`, `effecttsgo/global-fetch-in-effect` |
| `try`/`catch` inside `Effect.gen` | `Effect.try({ try, catch })` into a tagged error | `effecttsgo/try-catch-in-effect-gen` |
| `class X extends Error` | `Schema.TaggedError`; see the error model in AGENTS.md | `effecttsgo/extends-native-error` |
| `x instanceof SomeSchemaClass` | `Schema.is(SomeSchemaClass)(x)` | `effecttsgo/instance-of-schema` |
| `Schema.decodeUnknownSync` inside an effect | `Schema.decodeUnknownEffect` | `effecttsgo/schema-sync` |
