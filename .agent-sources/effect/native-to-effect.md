# Native pattern to Effect core module

Look up the native pattern you are about to write, use the Effect API in the second column, and read its declaration through [core-index.md](core-index.md). The third column names the lint rule that reports the native pattern. `core/*` rules come from `lint/effect-core-plugin.mjs` and `effecttsgo/*` rules from `@effect/tsgo`. A package that extends `lint/effect-core.oxlintrc.json` fails lint on every rule here except those marked *advisory*, which the shared config leaves off because they report most native calls.

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
| `xs.find(...)`, `xs.findIndex(...)` | `Array.findFirst`, `Array.findFirstIndex` (return `Option`) | `effecttsgo/prefer-effect-array` (advisory) |
| `Array.from({ length: n }, f)` | `Array.makeBy(n, f)`, `Array.range(start, end)` | |
| `Object.keys`, `Object.entries`, `Object.fromEntries` | `Record.keys`, `Record.toEntries`, `Record.fromEntries`, `Record.map` | `effecttsgo/prefer-effect-record` (advisory) |
| `x ?? fallback` for a value that may be missing | `Option.fromNullishOr(x)`, then `Option.getOrElse` | |

## Effects over many values

| Native | Effect | Rule |
| --- | --- | --- |
| `for (const x of xs) { yield* f(x) }` collecting results | `yield* Effect.forEach(xs, f)`; add `{ concurrency }` when the calls are independent | `core/no-yield-in-loop` |
| `Effect.all(xs.map(f))` | `Effect.forEach(xs, f)` | `effecttsgo/all-of-map-to-for-each` |
| A loop that threads state through effects | `Effect.reduce` | `core/no-yield-in-loop` |
| `Promise.all`, `new Promise`, `async` functions | `Effect.forEach`, `Effect.callback`, `Effect.gen` | `effecttsgo/new-promise`; `effecttsgo/async-function` (advisory) |
| `yield*` written as a call argument | Yield into a `const` first, or `Effect.map` | `effecttsgo/yield-in-call-argument` |

## Platform globals

| Native | Effect | Rule |
| --- | --- | --- |
| `JSON.parse`, `JSON.stringify` | `Schema.fromJsonString(schema)`; see the JSON boundary in AGENTS.md | `effecttsgo/global-json`, `effecttsgo/global-json-in-effect` (set in a package's `tsconfig.json`) |
| `Date.now()`, `new Date()` | `Clock.currentTimeMillis`, `DateTime.now` | `effecttsgo/global-date`, `effecttsgo/global-date-in-effect` |
| `Math.random()` | `Random.next`, `Random.nextIntBetween` | `effecttsgo/global-random`, `effecttsgo/global-random-in-effect` |
| `setTimeout`, `setInterval` | `Effect.sleep`, `Schedule.spaced` | `effecttsgo/global-timers`, `effecttsgo/global-timers-in-effect` |
| `console.log` | `Effect.log`, `Effect.logInfo` | `effecttsgo/global-console`, `effecttsgo/global-console-in-effect` |
| `process.env.NAME` | `Config.String('NAME')` | `effecttsgo/process-env`, `effecttsgo/process-env-in-effect` |
| `fetch` | `HttpClient` from `effect/http` | `effecttsgo/global-fetch`, `effecttsgo/global-fetch-in-effect` |
| `try`/`catch` inside `Effect.gen` | `Effect.try({ try, catch })` into a tagged error | `effecttsgo/try-catch-in-effect-gen` (set in a package's `tsconfig.json`) |
| `class X extends Error` | `Schema.TaggedError`; see the error model in AGENTS.md | `effecttsgo/extends-native-error` (set in a package's `tsconfig.json`) |
| `x instanceof SomeSchemaClass` | `Schema.is(SomeSchemaClass)(x)` | `effecttsgo/instance-of-schema` |
| `Schema.decodeUnknownSync` inside an effect | `Schema.decodeUnknownEffect` | `effecttsgo/schema-sync` (advisory) |

## Node scripts

A script under `scripts/` or `lib/` is an Effect program. `NodeServices.layer` from `@effect/platform-node` provides `FileSystem`, `Path`, `ChildProcessSpawner`, `Stdio`, and `Terminal`. `lint/node-scripts.oxlintrc.json` reports the native APIs in the first five rows through `bun run check:node-scripts`, part of root `bun run lint`. Scripts written before the rule open with an `oxlint-disable` comment marked `legacy`. Worked examples: `node_modules/effect/ai-docs/src/60_child-process/`, `70_cli/`, and `01_effect/06_running/`.

| Native | Effect | Rule |
| --- | --- | --- |
| Top-level `await`, `process.exit`, `process.exitCode` | `NodeRuntime.runMain(program.pipe(Effect.provide(NodeServices.layer)))`; fail with a tagged error for a non-zero exit | `no-restricted-properties` |
| `node:fs`, `node:fs/promises` | `FileSystem.FileSystem`: `readFileString`, `writeFileString`, `readDirectory`, `makeDirectory`, `exists`, `remove` | `no-restricted-imports` |
| `node:path`, `fileURLToPath` from `node:url` | `Path.Path`: `join`, `resolve`, `dirname`, `relative`, `fromFileUrl(new URL('../', import.meta.url))` | `no-restricted-imports` |
| `execFile`, `spawn`, `spawnSync` from `node:child_process` | `ChildProcess.make(command, args, { cwd })` from `effect/process`, run through `ChildProcessSpawner`: `string`, `lines`, `exitCode`, or `spawn` for a streaming handle; `ChildProcess.pipeTo` for a pipeline | `no-restricted-imports` |
| Reading `process.argv` | `Command.make` with `Flag.String`, `Flag.Boolean`, and `Argument.String` from `effect/cli`, then `Command.run` | `no-restricted-properties` |
| `JSON.parse` of a command's output | `Schema.decodeUnknownEffect(Schema.fromJsonString(schema))` | |
| `console.log` of a result, `process.stdout.write` | `Console.log`; diagnostics go through `loggerLayer` from `lib/logger.mjs` (logfmt on stderr) | `effecttsgo/global-console` |
| `setTimeout` to poll | `Effect.sleep`, `Effect.repeat` with a `Schedule` | `effecttsgo/global-timers` |

