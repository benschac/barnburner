// Proves xstate6/pure-transitions fires on impure transition and action functions and stays quiet on the pure ones.
// Each case is a fixture file under src/ (where the rule is enabled); one lint run reports all of them.
// Usage: node scripts/test-xstate-rules.mjs

import { NodeRuntime, NodeServices } from "@effect/platform-node";
import {
  Array,
  Effect,
  FileSystem,
  Option,
  Path,
  Schema,
  Stream,
} from "effect";
import { ChildProcess, ChildProcessSpawner } from "effect/process";

import { loggerLayer } from "../../../lib/logger.mjs";

class XStateRuleCaseFailed extends Schema.TaggedError()(
  "XStateRuleCaseFailed",
  {
    name: Schema.String,
    message: Schema.String,
  }
) {}

const Report = Schema.Struct({
  diagnostics: Schema.Array(
    Schema.Struct({
      message: Schema.String,
      code: Schema.String,
      severity: Schema.String,
      filename: Schema.String,
    })
  ),
});

const setup = "import { setupEffect } from '@xstate/effect'\n";

const inMachine = (config, prelude = "") =>
  setup +
  prelude +
  "export const machine = setupEffect({}).createMachine(" +
  config +
  ")\n";

const onGo = (handler, prelude = "") =>
  inMachine("{ on: { GO: " + handler + " } }", prelude);

const inState = (key, value) =>
  inMachine("{ initial: 'a', states: { a: { " + key + ": " + value + " } } }");

const MUTATED = "is mutated";

const ASSIGNED = "is assigned";

const MUTATES = "mutates";

const IMPURE = "outside world";

const ASYNC = "is async";

// [name, source, fragment of the expected message, or null when the source must pass]
const cases = [
  [
    "outer variable assignment",
    onGo("() => { counter = 1 }", "let counter = 0\n"),
    ASSIGNED,
  ],
  [
    "outer variable update",
    onGo("() => { counter++ }", "let counter = 0\n"),
    ASSIGNED,
  ],
  ["context mutation", onGo("({ context }) => { context.count = 1 }"), MUTATED],
  ["context increment", onGo("({ context }) => { context.count++ }"), MUTATED],
  ["event mutation", onGo("({ event }) => { event.handled = true }"), MUTATED],
  [
    "context delete",
    onGo("({ context }) => { delete context.draft }"),
    MUTATED,
  ],
  [
    "push on context",
    onGo("({ context, event }) => { context.items.push(event.item) }"),
    MUTATES,
  ],
  [
    "sort on context",
    onGo("({ context }) => ({ context: { items: context.items.sort() } })"),
    MUTATES,
  ],
  [
    "set on an alias of context",
    onGo('({ context }) => { const cache = context.cache; cache.set("a", 1) }'),
    MUTATES,
  ],
  [
    "module-level collection",
    onGo("() => { seen.add(1) }", "const seen = new Set<number>()\n"),
    MUTATES,
  ],
  ["Date.now", onGo("() => ({ context: { at: Date.now() } })"), IMPURE],
  ["new Date()", onGo("() => ({ context: { at: new Date() } })"), IMPURE],
  ["Math.random", onGo("() => ({ context: { n: Math.random() } })"), IMPURE],
  [
    "performance.now",
    onGo("() => ({ context: { n: performance.now() } })"),
    IMPURE,
  ],
  [
    "crypto.randomUUID",
    onGo("() => ({ context: { id: crypto.randomUUID() } })"),
    IMPURE,
  ],
  ["fetch", onGo('() => { fetch("/api") }'), IMPURE],
  ["window.fetch", onGo('() => { window.fetch("/api") }'), IMPURE],
  ["console.log", onGo('() => { console.log("go") }'), IMPURE],
  ["timer", onGo("() => { setTimeout(() => {}, 10) }"), IMPURE],
  ["localStorage", onGo('() => { localStorage.setItem("a", "b") }'), IMPURE],
  [
    "process.env",
    onGo("() => ({ context: { mode: process.env.MODE } })"),
    IMPURE,
  ],
  ["XMLHttpRequest", onGo("() => { new XMLHttpRequest() }"), IMPURE],
  ["document write", onGo('() => { document.title = "go" }'), MUTATED],
  [
    "Effect.runPromise",
    "import { Effect } from 'effect'\n" +
      onGo("() => { Effect.runPromise(Effect.void) }"),
    IMPURE,
  ],
  ["async transition", onGo("async () => ({ context: { n: 1 } })"), ASYNC],
  [
    "await in an async transition",
    onGo("async () => { await Promise.resolve() }"),
    ASYNC,
  ],
  [
    "always",
    inState("always", "() => ({ context: { at: Date.now() } })"),
    IMPURE,
  ],
  ["entry", inState("entry", '() => { console.log("in") }'), IMPURE],
  [
    "exit",
    inState("exit", "({ context }) => { context.left = true }"),
    MUTATED,
  ],
  [
    "after",
    inState("after", '{ 1000: () => { console.log("late") } }'),
    IMPURE,
  ],
  [
    "onDone",
    inState("onDone", "() => ({ context: { at: Date.now() } })"),
    IMPURE,
  ],
  [
    "onError",
    inState("onError", "({ context }) => { context.failed = true }"),
    MUTATED,
  ],
  [
    "invoke onDone",
    inState(
      "invoke",
      '{ src: "load", onDone: () => ({ context: { at: Date.now() } }) }'
    ),
    IMPURE,
  ],
  [
    "invoke onError",
    inState(
      "invoke",
      '{ src: "load", onError: () => { console.log("failed") } }'
    ),
    IMPURE,
  ],
  [
    "invoke input",
    inState("invoke", '{ src: "load", input: () => ({ at: Date.now() }) }'),
    IMPURE,
  ],
  [
    "createMachine from xstate",
    "import { createMachine } from 'xstate'\nexport const machine = createMachine({ on: { GO: () => { console.log('go') } } })\n",
    IMPURE,
  ],
  [
    "setup().createMachine",
    "import { setup } from 'xstate'\nexport const machine = setup({}).createMachine({ on: { GO: () => { console.log('go') } } })\n",
    IMPURE,
  ],
  [
    "setup binding",
    "import { setup } from 'xstate'\nconst builder = setup({})\nexport const machine = builder.createMachine({ on: { GO: () => { console.log('go') } } })\n",
    IMPURE,
  ],
  [
    "aliased import",
    "import { createMachine as machineOf } from 'xstate'\nexport const machine = machineOf({ on: { GO: () => { console.log('go') } } })\n",
    IMPURE,
  ],

  [
    "returned patch",
    onGo(
      '({ context, event }) => ({ target: "next", context: { count: context.count + event.step } })'
    ),
    null,
  ],
  [
    "patch only",
    onGo("({ event }) => ({ context: { team: event.team } })"),
    null,
  ],
  [
    "effect inside enq",
    onGo('(_, enq) => { enq(() => { console.log("go"); fetch("/api") }) }'),
    null,
  ],
  [
    "enq with a patch",
    onGo(
      '({ context }, enq) => { enq(() => localStorage.setItem("a", "b")); return { context: { count: context.count + 1 } } }'
    ),
    null,
  ],
  [
    "enq with a named callback",
    onGo('(_, enq) => { const track = () => console.log("go"); enq(track) }'),
    null,
  ],
  [
    "enq.spawn with inline logic",
    onGo(
      '(_, enq) => { enq.spawn(createLogic({ run: () => fetch("/api") })) }'
    ),
    null,
  ],
  [
    "enq.sendTo",
    onGo(
      '({ children }, enq) => { enq.sendTo(children.worker, { type: "PING" }) }'
    ),
    null,
  ],
  [
    "local array mutated then returned",
    onGo(
      "({ context, event }) => { const items = [...context.items]; items.push(event.item); items.sort(); return { context: { items } } }"
    ),
    null,
  ],
  [
    "local object mutated then returned",
    onGo(
      "({ context }) => { const next = { ...context }; next.count = 1; delete next.draft; return { context: next } }"
    ),
    null,
  ],
  [
    "local counter",
    onGo(
      "() => { let total = 0; total += 1; total++; return { context: { total } } }"
    ),
    null,
  ],
  [
    "local collection",
    onGo(
      "() => { const seen = new Set<number>(); seen.add(1); const index = new Map<number, number>(); index.set(1, 2); return { context: { size: seen.size + index.size } } }"
    ),
    null,
  ],
  [
    "non-mutating array methods",
    onGo(
      "({ context }) => ({ context: { items: context.items.filter(Boolean).map(String).slice().concat([]) } })"
    ),
    null,
  ],
  [
    "namespace import with a mutator name",
    "import { HashMap } from 'effect'\n" +
      onGo(
        '({ context }) => ({ context: { map: HashMap.set(context.map, "a", 1) } })'
      ),
    null,
  ],
  [
    "Date with an argument",
    onGo("({ event }) => ({ context: { at: new Date(event.at) } })"),
    null,
  ],
  [
    "reading document",
    onGo("() => ({ context: { title: document.title } })"),
    null,
  ],
  [
    "static transition object",
    onGo('{ target: "next", context: { count: 0 } }'),
    null,
  ],
  [
    "impure code outside a machine config",
    'const stamp = () => { counter.n = Date.now(); console.log(counter); fetch("/api") }\nconst counter = { n: 0 }\nexport { stamp }\n',
    null,
  ],
  [
    "impure code in a function beside the machine",
    onGo(
      '() => ({ target: "next" })',
      'export const track = async () => { await fetch("/api"); console.log(Date.now()) }\n'
    ),
    null,
  ],
  [
    "createMachine from another module",
    "import { createMachine } from './elsewhere.ts'\nexport const machine = createMachine({ on: { GO: () => { console.log('go') } } })\n",
    null,
  ],
];

const program = Effect.fn("testXStateRules")(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
  const webUrl = yield* path.fromFileUrl(new URL("../", import.meta.url));
  const root = path.resolve(webUrl);
  const effectTsgo = path.join(root, "../../node_modules/.bin/effect-tsgo");
  const dir = yield* fs.makeTempDirectoryScoped({
    directory: path.join(root, "src"),
    prefix: "xstate-rule-test-",
  });

  const files = yield* Effect.forEach(
    cases,
    Effect.fn(function* ([name, source, expected], index) {
      const file = path.join(dir, "case-" + index + ".ts");
      yield* fs.writeFileString(file, source);

      return { name, expected, file, base: path.basename(file) };
    })
  );

  const handle = yield* spawner.spawn(
    ChildProcess.make(
      effectTsgo,
      [
        "--tsrs-lint",
        "oxlint",
        "--format",
        "json",
        ...Array.map(files, ({ file }) => file),
      ],
      { cwd: root }
    )
  );

  const [stdout] = yield* Effect.all(
    [
      handle.stdout.pipe(Stream.decodeText(), Stream.mkString),
      handle.stderr.pipe(Stream.runDrain),
    ],
    { concurrency: "unbounded" }
  );

  const { diagnostics } = yield* Schema.decodeUnknownEffect(
    Schema.fromJsonString(Report)
  )(stdout);

  const crashed = Array.findFirst(diagnostics, (d) =>
    d.message.includes("Error running JS plugin")
  );

  if (Option.isSome(crashed))
    return yield* new XStateRuleCaseFailed({
      name: "plugin",
      message: crashed.value.message,
    });

  yield* Effect.forEach(
    files,
    Effect.fn(function* ({ name, expected, base }) {
      // anti-slop rules also report on the fixtures, which are new files; count only the rule under test.
      const found = Array.filter(
        diagnostics,
        (d) =>
          d.severity === "error" &&
          d.code === "xstate6(pure-transitions)" &&
          path.basename(d.filename) === base
      );

      if (expected === null && found.length > 0)
        return yield* new XStateRuleCaseFailed({
          name,
          message:
            "expected no xstate6 errors, got: " +
            found.map((d) => d.message).join(" | "),
        });

      if (expected !== null && !found.some((d) => d.message.includes(expected)))
        return yield* new XStateRuleCaseFailed({
          name,
          message:
            'expected an error containing "' +
            expected +
            '", got ' +
            found.length +
            " xstate6 errors",
        });
      // Every report names the fix.
      const unhelpful = Array.filter(found, (d) => !d.message.includes("Fix:"));

      if (unhelpful.length > 0)
        return yield* new XStateRuleCaseFailed({
          name,
          message: "message does not name a fix: " + unhelpful[0].message,
        });
    })
  );
  yield* Effect.logInfo(cases.length + " xstate6 lint cases passed");
}, Effect.scoped);

program().pipe(
  Effect.provide([NodeServices.layer, loggerLayer]),
  NodeRuntime.runMain
);
