import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { rmSync } from "node:fs";
import {
  cp,
  mkdtemp,
  readdir,
  readFile,
  readlink,
  realpath,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import {
  basename,
  dirname,
  isAbsolute,
  join,
  relative,
  resolve,
  sep,
} from "node:path";

import { HistoryRpcs } from "@nhl-reddit-stats/history/rpc";
import { Deferred, Effect, Layer, Result, Schema } from "effect";
import { FetchHttpClient, HttpClient } from "effect/http";
import { RpcClient, RpcSerialization } from "effect/rpc";

import { logError, logInfo } from "../../../lib/logger.mjs";
import { SeasonSource, rpcSeasonSourceLayer } from "../src/season-source.ts";

// Usage: check-vercel-output.mjs <output-dir> [--require-history]
// <output-dir> is the Build Output API directory that `vercel build --prod --standalone` writes for the Next app (.vercel/output).
// Without --require-history, a build with no bundled snapshot passes if /api/history answers HistoryUnavailable.
//
// Layout read here (Build Output API v3, as `vercel build` writes it for a Next.js app):
//   config.json                                routes; the trailing-slash redirect for /api/rpc/ is one of them
//   functions/<pathname>.func/                 one directory per route handler, for example functions/api/rpc.func
//   functions/<pathname>.func/.vc-config.json  runtime, handler (the Next launcher), supportsCancellation
// Each function is copied outside the checkout, started in its own Node process the way Vercel starts it (the launcher
// exports a (req, res) listener), and called over real HTTP with the x-matched-path header that Vercel's router sends.

const HISTORY_FILE = "apps/web/history-data/nhl-serve.sqlite";
// The history handler looks for the file under its working directory (the launcher's directory) at either path.
const HISTORY_FILE_NEAR_LAUNCHER = [
  "apps/web/history-data/nhl-serve.sqlite",
  "history-data/nhl-serve.sqlite",
];
const WEB_ROUTES = ["rpc", "games", "poster", "teams"];
const REQUEST_TIMEOUT_MS = 60_000;

const args = process.argv.slice(2);
const requireHistory = args.includes("--require-history");
const outputArg = args.find((arg) => !arg.startsWith("--"));
assert.ok(outputArg, "Pass the standalone Vercel build output directory");
const output = resolve(outputArg);

// A packaged function is copied here and served from a separate Node process. The directory is created first so a manifest
// failure can remove it. Resolved paths come back as real paths (/var is /private/var on macOS), so keep it in that form.
const directory = await realpath(
  await mkdtemp(join(tmpdir(), "rinkside-vercel-"))
);
const cleanup = () => rm(directory, { recursive: true, force: true });
// An assertion that fails before the final cleanup still leaves no temporary files.
process.once("exit", () => {
  rmSync(directory, { recursive: true, force: true });
});

const SNAPSHOT_NAME = "nhl-serve.sqlite";
const sizeOf = (path) =>
  stat(path).then(
    (file) => (file.isFile() ? file.size : null),
    () => null
  );
const inside = (root, path) => {
  const from = relative(root, path);
  return from !== ".." && !from.startsWith(`..${sep}`) && !isAbsolute(from);
};

// The build manifests are the only JSON this script reads. A missing or malformed one is a tagged failure that names the file.
class OutputManifestError extends Schema.TaggedError()("OutputManifestError", {
  path: Schema.String,
  reason: Schema.String,
}) {
  get message() {
    return `${this.path}: ${this.reason}`;
  }
}
const RoutesManifest = Schema.Struct({
  routes: Schema.Array(
    Schema.Struct({
      src: Schema.optionalKey(Schema.String),
      status: Schema.optionalKey(Schema.Number),
    })
  ),
});
const FunctionManifest = Schema.Struct({
  runtime: Schema.String,
  handler: Schema.String,
  supportsCancellation: Schema.optionalKey(Schema.Boolean),
  filePathMap: Schema.optionalKey(Schema.Record(Schema.String, Schema.String)),
});
const readManifest = async (path, schema) => {
  const text = await readFile(path, "utf-8").then(
    (value) => Result.succeed(value),
    (cause) =>
      Result.fail(
        new OutputManifestError({
          path,
          reason: `cannot read the file: ${cause.message}`,
        })
      )
  );
  return Result.flatMap(text, (value) =>
    Result.mapError(
      Schema.decodeUnknownResult(Schema.fromJsonString(schema))(value),
      (error) =>
        new OutputManifestError({
          path,
          reason: `not the expected manifest: ${error.message}`,
        })
    )
  );
};
// The command line is the end of the tagged failure: report it by tag, remove the temporary files, and exit non-zero.
const must = async (result) => {
  if (Result.isSuccess(result)) return result.success;
  logError(`${result.failure._tag}: ${result.failure.message}`);
  await cleanup();
  process.exit(1);
};

const routesManifest = await must(
  await readManifest(join(output, "config.json"), RoutesManifest)
);
const routeMatches = (route, pathname) => {
  try {
    return route.src !== undefined && new RegExp(route.src).test(pathname);
  } catch {
    return false;
  }
};
assert.ok(
  routesManifest.routes.some(
    (route) => route.status === 308 && routeMatches(route, "/api/rpc/")
  ),
  `RPC trailing slash must preserve POST via HTTP 308: no route in config.json has status 308 and matches /api/rpc/ (${routesManifest.routes.length} routes, ${routesManifest.routes.filter((route) => route.status !== undefined).length} with a status)`
);

// Every <pathname>.func directory below functions/, following symlinks (a function may be shared by several routes).
const findFunctions = async (root, prefix = "") => {
  const found = new Map();
  for (const entry of await readdir(join(root, prefix), {
    withFileTypes: true,
  }).catch(() => [])) {
    const path = `${prefix}${entry.name}`;
    const info = await stat(join(root, path)).catch(() => null);
    if (info === null || !info.isDirectory()) continue;
    if (entry.name.endsWith(".func"))
      found.set(path.slice(0, -".func".length), join(root, path));
    else
      for (const [name, directory] of await findFunctions(root, `${path}/`))
        found.set(name, directory);
  }
  return found;
};
const functions = await findFunctions(join(output, "functions"));
const apiFunctions = [...functions].filter(([name]) => name.startsWith("api/"));
const found = `found ${functions.size} functions${apiFunctions.length > 0 ? `; api: ${apiFunctions.map(([name]) => name).join(", ")}` : ""}`;

const readConfig = async (name) => {
  const directory = functions.get(name);
  assert.ok(
    directory,
    `functions/${name}.func is missing from ${output}; ${found}`
  );
  const vc = await must(
    await readManifest(join(directory, ".vc-config.json"), FunctionManifest)
  );
  assert.match(
    vc.runtime,
    /^nodejs/,
    `functions/${name}.func runtime must be a Node runtime, found ${vc.runtime}`
  );
  assert.ok(
    vc.filePathMap === undefined || Object.keys(vc.filePathMap).length === 0,
    `functions/${name}.func lists filePathMap entries (files kept outside the function directory); build with --standalone so the function carries its own files`
  );
  return { directory, vc };
};

// Cancellation: vercel.json sets supportsCancellation for app/api/**/route.ts, so every packaged API function must carry it.
for (const [name] of apiFunctions) {
  const { vc } = await readConfig(name);
  assert.equal(
    vc.supportsCancellation,
    true,
    `functions/${name}.func must have supportsCancellation: true in .vc-config.json, found ${vc.supportsCancellation}`
  );
}
logInfo(
  `All ${apiFunctions.length} packaged API functions support cancellation`
);

// Walk a function without following symlinks. A symlink that leaves the function directory would be copied into the
// temporary directory by the dereferencing copy below and then look contained, so it is judged here, on the original.
const scans = new Map();
const scanFunction = async (source) => {
  const root = await realpath(source);
  const cached = scans.get(root);
  if (cached) return cached;
  const scan = { root, escapes: [], snapshots: [] };
  const walk = async (current) => {
    for (const entry of await readdir(current, { withFileTypes: true })) {
      const path = join(current, entry.name);
      if (entry.isSymbolicLink()) {
        const target = await realpath(path).catch(() => null);
        if (target === null || !inside(root, target))
          scan.escapes.push(
            `${relative(root, path)} -> ${await readlink(path)}`
          );
        else if (entry.name === SNAPSHOT_NAME)
          scan.snapshots.push(relative(root, path));
      } else if (entry.isDirectory()) await walk(path);
      else if (entry.name === SNAPSHOT_NAME)
        scan.snapshots.push(relative(root, path));
    }
  };
  await walk(root);
  scans.set(root, scan);
  return scan;
};

// The snapshot is traced for /api/history only: that route needs its own function, and no other function may carry the file.
const historyRoot = await realpath((await readConfig("api/history")).directory);
const owners = new Map();
for (const [name, directory] of functions) {
  const root = await realpath(directory);
  const known = owners.get(root);
  if (known === undefined) owners.set(root, [name]);
  else known.push(name);
}
for (const [root, names] of owners) {
  if (root === historyRoot) {
    const shared = names.filter((name) => !name.startsWith("api/history"));
    assert.deepEqual(
      shared,
      [],
      `functions/api/history.func must be its own function, but it is shared with ${shared.join(", ")}; give the history route its own function config so the snapshot ships with it only`
    );
    continue;
  }
  const { snapshots } = await scanFunction(root);
  assert.deepEqual(
    snapshots,
    [],
    `${names.map((name) => `functions/${name}.func`).join(", ")} must not carry ${SNAPSHOT_NAME}; the history file is traced for /api/history only. Found: ${snapshots.join(", ")}`
  );
}
logInfo(
  `${owners.size} packaged functions checked; the snapshot is in the history function only`
);

// A copy of the function outside the checkout, served from its own Node process so one Next server never shares globals with another.
const harness = `
import { createServer } from 'node:http'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
const [directory, handlerPath] = process.argv.slice(2)
process.chdir(directory)
const loaded = await import(pathToFileURL(resolve(directory, handlerPath)).href)
if (typeof loaded.default !== 'function') {
  console.error('handler ' + handlerPath + ' must export a (req, res) function, found exports: ' + Object.keys(loaded).join(', '))
  process.exit(2)
}
const server = createServer((req, res) => {
  Promise.resolve(loaded.default(req, res)).catch((error) => {
    console.error('handler threw for ' + req.method + ' ' + req.url, error)
    if (!res.headersSent) res.statusCode = 500
    res.end()
  })
})
server.listen(0, '127.0.0.1', () => console.log('LISTENING ' + server.address().port))
`;

const harnessFile = join(directory, "harness.mjs");
await writeFile(harnessFile, harness);
// HISTORY_DB would hide a missing bundled file, so no packaged function sees it.
const { HISTORY_DB: _ignoredHistoryDb, ...childEnv } = process.env;

const startFunction = async (name, vc, source) => {
  const scan = await scanFunction(source);
  assert.deepEqual(
    scan.escapes,
    [],
    `functions/${name}.func must carry its own dependencies, but these symlinks leave the function directory: ${scan.escapes.slice(0, 5).join("; ")}`
  );
  const isolated = join(directory, name.replaceAll("/", "_"));
  await cp(source, isolated, { recursive: true, dereference: true });
  const launcher = join(isolated, vc.handler);
  assert.ok(
    (await sizeOf(launcher)) !== null,
    `functions/${name}.func handler ${vc.handler} is not a file in the function directory`
  );
  const child = spawn(process.execPath, [harnessFile, isolated, vc.handler], {
    cwd: isolated,
    env: { ...childEnv, NEXT_TELEMETRY_DISABLED: "1" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let log = "";
  child.stderr.on("data", (chunk) => {
    log += chunk;
  });
  const exited = Deferred.makeUnsafe();
  child.once("exit", (code, signal) => {
    Deferred.doneUnsafe(
      exited,
      Effect.succeed(`exited with ${code ?? signal}`)
    );
  });
  const listening = Effect.callback((resume) => {
    child.stdout.on("data", (chunk) => {
      log += chunk;
      const match = /LISTENING (\d+)/.exec(log);
      if (match) resume(Effect.succeed(Number(match[1])));
    });
  });
  const exitedBeforeListening = Effect.flatMap(
    Deferred.await(exited),
    (reason) =>
      Effect.fail(
        new assert.AssertionError({
          message: `functions/${name}.func ${reason} before it listened\n${log}`,
        })
      )
  );
  const port = await Effect.runPromise(
    Effect.raceFirst(listening, exitedBeforeListening).pipe(
      Effect.timeoutOrElse({
        duration: REQUEST_TIMEOUT_MS,
        orElse: () =>
          Effect.fail(
            new assert.AssertionError({
              message: `functions/${name}.func did not listen within ${REQUEST_TIMEOUT_MS} ms\n${log}`,
            })
          ),
      })
    )
  ).catch(async (error) => {
    child.kill();
    throw error;
  });
  const pathname = `/${name}`;
  // Vercel's router tells a Next function which route it matched; the launcher's routing reads this header.
  // A redirect would let a live endpoint answer for the packaged function, so it fails the request.
  const requestInit = Layer.succeed(FetchHttpClient.RequestInit, {
    headers: { "x-matched-path": pathname },
    redirect: "error",
  });
  const send = (effect) =>
    Effect.runPromise(
      effect.pipe(
        Effect.provide(requestInit),
        Effect.timeout(REQUEST_TIMEOUT_MS)
      )
    );
  return {
    isolated,
    launcherDirectory: dirname(launcher),
    url: `http://127.0.0.1:${port}${pathname}`,
    send,
    // A failed check is more useful with whatever the function logged. The error is rethrown untouched: a fetch timeout is a DOMException whose message is read-only.
    async run(check) {
      try {
        return await check();
      } catch (error) {
        logError(`functions/${name}.func output:\n${log || "(none)"}`);
        throw error;
      }
    },
    async stop() {
      child.kill();
      await Effect.runPromise(Deferred.await(exited));
    },
  };
};

// The packaged API is the built apps/api/dist, imported at run time (it stays external to webpack). The function must carry
// its handler and every box-score chunk that handler imports as separate files, found the way the route finds them.
const chunkImports = async (handlerDirectory, entry) => {
  const referenced = new Set();
  const missing = [];
  const pending = [entry];
  for (const file of pending) {
    const text = await readFile(join(handlerDirectory, file), "utf-8").catch(
      () => null
    );
    if (text === null) {
      missing.push(file);
      continue;
    }
    for (const match of text.matchAll(/['"]\.\/(chunk-[\w-]+\.js)['"]/g)) {
      if (!referenced.has(match[1])) {
        referenced.add(match[1]);
        pending.push(match[1]);
      }
    }
  }
  return { referenced, missing };
};
const assertPackagedApi = async (name, running, handlerFile, withChunks) => {
  const specifier = `@nhl-reddit-stats/api/${basename(handlerFile, ".js")}`;
  let resolved;
  try {
    resolved = createRequire(
      join(running.launcherDirectory, "noop.cjs")
    ).resolve(specifier);
  } catch (cause) {
    assert.fail(
      `functions/${name}.func must carry ${specifier} (apps/api/dist/${handlerFile}) where the launcher can resolve it, found: ${cause.message}`
    );
  }
  assert.ok(
    inside(running.isolated, resolved),
    `functions/${name}.func resolved ${specifier} to ${resolved}, outside the function directory`
  );
  assert.equal(
    basename(resolved),
    handlerFile,
    `functions/${name}.func resolved ${specifier} to ${resolved}, expected a file named ${handlerFile}`
  );
  if (!withChunks) return;
  const { referenced, missing } = await chunkImports(
    dirname(resolved),
    handlerFile
  );
  assert.ok(
    referenced.size > 0,
    `${resolved} imports no box-score chunk-*.js; expected the archive's lazy imports, found 0`
  );
  assert.deepEqual(
    missing,
    [],
    `functions/${name}.func must carry every chunk ${handlerFile} imports (${referenced.size} referenced), missing ${missing.length}: ${missing.slice(0, 3).join(", ")}`
  );
};

try {
  for (const route of WEB_ROUTES) {
    const name = `api/${route}`;
    const { directory: source, vc } = await readConfig(name);
    const running = await startFunction(name, vc, source);
    try {
      await running.run(async () => {
        await assertPackagedApi(name, running, "web-handler.js", true);
        if (route === "rpc") {
          const data = await running.send(
            Effect.gen(function* () {
              const season = yield* SeasonSource;
              return yield* season.load;
            }).pipe(Effect.provide(rpcSeasonSourceLayer(running.url)))
          );
          assert.equal(
            data.poster.clubs.length,
            32,
            `RPC poster clubs: expected 32, found ${data.poster.clubs.length}`
          );
          assert.equal(
            data.season.games.length,
            1344,
            `RPC season games: expected 1344, found ${data.season.games.length}`
          );
        } else {
          const url = `${running.url}${route === "games" ? "?team=ANA" : ""}`;
          const { status, body } = await running.send(
            Effect.gen(function* () {
              const response = yield* HttpClient.get(url);
              return {
                status: response.status,
                body: response.status === 200 ? yield* response.json : null,
              };
            }).pipe(Effect.provide(FetchHttpClient.layer))
          );
          assert.equal(
            status,
            200,
            `GET ${name} expected status 200, found ${status}`
          );
          if (route === "games")
            assert.equal(
              body.count,
              84,
              `GET ${name}?team=ANA expected count 84, found ${body.count}`
            );
          if (route === "poster")
            assert.equal(
              body.clubs.length,
              32,
              `GET ${name} expected 32 clubs, found ${body.clubs.length}`
            );
          if (route === "teams")
            assert.equal(
              body.teams.length,
              32,
              `GET ${name} expected 32 teams, found ${body.teams.length}`
            );
        }
      });
    } finally {
      await running.stop();
    }
  }
  logInfo("Isolated Vercel RPC and all three GET functions passed");

  // The history function must carry its serving file and run on a Node that has node:sqlite.
  const { directory: historyFunction, vc: historyConfig } =
    await readConfig("api/history");
  const node = /^nodejs(\d+)/.exec(historyConfig.runtime);
  assert.ok(
    node && Number(node[1]) >= 22,
    `history runtime ${historyConfig.runtime} must be Node 22.5 or newer for node:sqlite`
  );
  assert.ok(
    process.getBuiltinModule("node:sqlite"),
    `this Node (${process.version}) has no node:sqlite, so it cannot run the packaged history function`
  );
  const launcherDirectory = dirname(
    join(historyFunction, historyConfig.handler)
  );
  const candidates = [
    join(historyFunction, HISTORY_FILE),
    ...HISTORY_FILE_NEAR_LAUNCHER.map((path) => join(launcherDirectory, path)),
  ];
  let shipped = null;
  let size = null;
  for (const candidate of candidates) {
    size = await sizeOf(candidate);
    if (size !== null) {
      shipped = candidate;
      break;
    }
  }
  if (requireHistory) {
    assert.ok(
      size !== null && size > 0,
      `${HISTORY_FILE} is missing or empty in the history function; looked at ${candidates.map((path) => relative(historyFunction, path)).join(", ")}`
    );
  }
  const running = await startFunction(
    "api/history",
    historyConfig,
    historyFunction
  );
  try {
    await running.run(async () => {
      await assertPackagedApi(
        "api/history",
        running,
        "history-handler.js",
        false
      );
      const search = Effect.scoped(
        Effect.gen(function* () {
          const client = yield* RpcClient.make(HistoryRpcs);
          return yield* client.SearchPlayers({ query: "a", limit: 3 });
        })
      ).pipe(
        Effect.provide(
          RpcClient.layerProtocolHttp({ url: running.url }).pipe(
            Layer.provide([FetchHttpClient.layer, RpcSerialization.layerJson])
          )
        )
      );
      if (size === null) {
        const failure = await running.send(Effect.flip(search));
        assert.equal(
          failure._tag,
          "HistoryUnavailable",
          `without a bundled snapshot /api/history must answer HistoryUnavailable, found ${failure._tag}`
        );
        logInfo(
          `Packaged history function (${historyConfig.runtime}) has no snapshot and answered HistoryUnavailable`
        );
      } else {
        const result = await running.send(search);
        assert.ok(
          result.snapshotId.length > 0,
          "SearchPlayers returned an empty snapshotId from the packaged file"
        );
        assert.ok(
          result.players.length > 0,
          "SearchPlayers returned no rows from the packaged file"
        );
        logInfo(
          `Packaged history function (${historyConfig.runtime}) served SearchPlayers from ${relative(historyFunction, shipped)} (${size} bytes)`
        );
      }
    });
  } finally {
    await running.stop();
  }
} finally {
  await cleanup();
}
