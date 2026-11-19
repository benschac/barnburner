// Fail when a root Node script calls a Node built-in that the Effect platform services replace.
// Scripts run as Effect programs: NodeRuntime.runMain with NodeServices.layer, which provides
// FileSystem, Path, ChildProcessSpawner, Stdio, and Terminal. The replacements are listed under
// "Node scripts" in .agent-sources/effect/native-to-effect.md.
//
//   node scripts/check-node-scripts.mjs
//
// LEGACY names the scripts written before this rule. Port one, then delete its line: the check
// fails while a listed script no longer needs the exemption, so the list only shrinks.
import { NodeRuntime, NodeServices } from '@effect/platform-node'
import { Array, Effect, FileSystem, Layer, Order, Path, Result, Schema } from 'effect'
import { loggerLayer } from '../lib/logger.mjs'

const DIRS = ['scripts', 'lib']
const SOURCE = /\.(?:mjs|js|mts|ts)$/
const DECLARATION = /\.d\.m?ts$/
const LEGACY = new Set([
  'scripts/check-error-model.mjs',
  'scripts/index-effect-core.mjs',
  'scripts/refresh-agent-sources.mjs',
  'scripts/refresh-effect-api.mjs',
  'scripts/refresh-nhl-data.mjs',
  'scripts/refresh-nhl-games.mjs',
  'scripts/refresh-nhl-poster.mjs',
  'scripts/refresh-pattern-sources.mjs',
  'scripts/test-effect-core-rules.mjs',
  'scripts/test-union-rules.mjs',
])
const RULES = [
  { pattern: /from\s+['"]node:fs(?:\/promises)?['"]/, native: 'node:fs', fix: 'FileSystem from effect (readFileString, writeFileString, readDirectory, makeDirectory)' },
  { pattern: /from\s+['"]node:path['"]/, native: 'node:path', fix: 'Path from effect (join, resolve, dirname, relative)' },
  { pattern: /from\s+['"]node:url['"]/, native: 'node:url', fix: 'Path.fromFileUrl from effect' },
  { pattern: /from\s+['"]node:child_process['"]/, native: 'node:child_process', fix: 'ChildProcess.make with ChildProcessSpawner (string, lines, exitCode) from effect/process' },
  { pattern: /(?<!['"`])\bprocess\.argv\b/, native: 'process.argv', fix: 'Command, Flag, and Argument from effect/cli' },
  { pattern: /(?<!['"`])\bprocess\.exit(?:Code)?\b/, native: 'process.exit', fix: 'fail the program with a tagged error; NodeRuntime.runMain sets the exit code' },
]

class NativeNodeApis extends Schema.TaggedError()('NativeNodeApis', {
  problems: Schema.Array(Schema.String),
}) {}

// The problems in one file: each native API it uses, or a stale exemption.
const problemsOf = (file, text) => {
  const used = Array.filter(RULES, (rule) => rule.pattern.test(text))
  if (LEGACY.has(file)) return used.length ? [] : [`${file}: no longer uses a native Node API. Fix: delete it from LEGACY in scripts/check-node-scripts.mjs`]
  return Array.map(used, (rule) => `${file}: uses ${rule.native}. Fix: ${rule.fix}`)
}

const program = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem
  const path = yield* Path.Path
  const repo = yield* path.fromFileUrl(new URL('../', import.meta.url))
  const listed = yield* Effect.forEach(DIRS, (dir) =>
    fs.readDirectory(path.join(repo, dir)).pipe(
      Effect.map(Array.filterMap((name) => (SOURCE.test(name) && !DECLARATION.test(name) ? Result.succeed(`${dir}/${name}`) : Result.failVoid))),
    ))
  const files = Array.sort(Array.flatten(listed), Order.String)
  const missing = Array.filter(Array.fromIterable(LEGACY), (file) => !Array.contains(files, file))
  const found = yield* Effect.forEach(files, (file) => fs.readFileString(path.join(repo, file)).pipe(Effect.map((text) => problemsOf(file, text))))
  const problems = [...Array.flatten(found), ...Array.map(missing, (file) => `${file}: listed in LEGACY but missing. Fix: delete it from LEGACY`)]
  if (problems.length) {
    yield* Effect.forEach(problems, (problem) => Effect.logError(problem), { discard: true })
    return yield* new NativeNodeApis({ problems })
  }
  yield* Effect.logInfo(`${files.length} Node scripts checked: ${files.length - LEGACY.size} without native Node APIs, ${LEGACY.size} legacy`)
})

NodeRuntime.runMain(program.pipe(Effect.provide(Layer.mergeAll(NodeServices.layer, loggerLayer))), { disableErrorReporting: true })
