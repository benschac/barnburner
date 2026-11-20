import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import type { ChildProcess } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, test } from "node:test";
import { fileURLToPath } from "node:url";

import {
  Array as Arr,
  Duration,
  Effect,
  Order,
  Schedule,
  Schema,
} from "effect";
import { FetchHttpClient, HttpClient, HttpClientRequest } from "effect/http";

import {
  BoxscoreSource,
  rpcBoxscoreSourceLayer,
} from "../src/season-source.ts";

// This test exercises the production build Next emits, not the route TypeScript. Build first:
//   bun run build
const web = fileURLToPath(new URL("..", import.meta.url));
const apiDist = fileURLToPath(new URL("../../api/dist/", import.meta.url));
const archive = fileURLToPath(
  new URL("../../../data/boxscores/20262027/", import.meta.url)
);
const next = join(web, ".next");
const missingBuild = [
  [
    join(apiDist, "web-handler.js"),
    "the built API (run `bun run --cwd ../api build`)",
  ],
  [join(next, "BUILD_ID"), "the Next production build (run `bun run build`)"],
].flatMap(([path, what]) => (existsSync(path) ? [] : [what]));
assert.deepEqual(
  missingBuild,
  [],
  `api-routes.test.ts needs a prior build; missing: ${missingBuild.join(", ")}`
);

const gameIds = Arr.sort(
  readdirSync(archive).flatMap((file) =>
    /^\d+\.json$/.test(file) ? [Number(file.slice(0, -5))] : []
  ),
  Order.Number
);
const apiChunks = readdirSync(apiDist).filter((file) =>
  /^chunk-.*\.js$/.test(file)
);

// What only the API handler or an archived box score contains. The compiled route must hold none of it.
const handlerMarkers = [
  "Unsupported query parameters",
  "api-web.nhle.com/v1/gamecenter",
  "saveShotsAgainst",
  "boxscoreArchive",
];

const filesUnder = (directory: string): string[] =>
  readdirSync(directory, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory()
      ? filesUnder(join(directory, entry.name))
      : [join(directory, entry.name)]
  );
const compiledJs = [
  ...filesUnder(join(next, "server")),
  ...filesUnder(join(next, "static")),
].filter((file) => file.endsWith(".js"));

test("the API routes were compiled with the handler left external", () => {
  // Turbopack puts each route's code in shared server chunks, so look for the runtime import there.
  const serverJs = compiledJs.filter((file) =>
    file.startsWith(join(next, "server"))
  );
  const serverText = serverJs.map((file) => readFileSync(file, "utf-8"));
  for (const handler of ["web-handler", "history-handler"])
    assert.ok(
      serverText.some((text) =>
        text.includes(`import("@nhl-reddit-stats/api/${handler}")`)
      ),
      `no route imports the built API ${handler} at runtime`
    );
});

test("no Next server output holds handler code or box-score data", () => {
  assert.ok(compiledJs.length > 0);
  for (const file of compiledJs) {
    const text = readFileSync(file, "utf-8");
    for (const marker of handlerMarkers)
      assert.ok(!text.includes(marker), `${file} contains "${marker}"`);
  }
  assert.equal(
    filesUnder(next).filter((file) => /[\\/]chunk-[0-9a-z]+\.js$/.test(file))
      .length,
    0,
    "Next must not emit its own copy of the box-score chunks"
  );
});

test("the API stays one chunk file per archived game, traced as files", () => {
  assert.equal(apiChunks.length, gameIds.length);
  const trace = Schema.decodeUnknownSync(
    Schema.fromJsonString(Schema.Struct({ files: Schema.Array(Schema.String) }))
  )(readFileSync(join(next, "server/app/api/rpc/route.js.nft.json"), "utf-8"));
  const traced = trace.files.filter((file) =>
    /api\/dist\/(chunk-[^/]*|web-handler)\.js$/.test(file)
  );
  assert.ok(traced.some((file) => file.endsWith("web-handler.js")));
  assert.equal(
    traced.filter((file) => /chunk-[^/]*\.js$/.test(file)).length,
    apiChunks.length
  );
});

// Run the built server with a loader hook that records every API chunk Node loads.
const freePort = Effect.callback<number>((resume) => {
  const server = createServer();
  server.once("error", (error) => {
    resume(Effect.die(error));
  });
  server.listen(0, "127.0.0.1", () => {
    const address = server.address();
    server.close(() => {
      resume(
        Effect.succeed(
          typeof address === "object" && address !== null ? address.port : 0
        )
      );
    });
  });
});

// Requests go through the Effect HttpClient; the response is reduced to what the assertions read.
const send = (
  url: string,
  init?: {
    readonly method: "POST";
    readonly body: string;
    readonly contentType?: string;
  }
) =>
  Effect.gen(function* () {
    const request =
      init === undefined
        ? HttpClientRequest.get(url)
        : HttpClientRequest.post(url).pipe(
            HttpClientRequest.bodyText(init.body, init.contentType)
          );
    const response = yield* HttpClient.execute(request);
    return {
      status: response.status,
      contentType: response.headers["content-type"] ?? "",
      text: yield* response.text,
    };
  }).pipe(Effect.provide(FetchHttpClient.layer));
const request = (
  url: string,
  init?: {
    readonly method: "POST";
    readonly body: string;
    readonly contentType?: string;
  }
) => Effect.runPromise(send(url, init));
const recorder = `import { registerHooks } from 'node:module'
import { appendFileSync } from 'node:fs'
registerHooks({ load(url, context, nextLoad) {
  if (/\\/api\\/dist\\/[^/]*\\.js$/.test(url)) appendFileSync(process.env.API_LOAD_LOG, url + '\\n')
  return nextLoad(url, context)
} })`;
const loaded = (log: string) =>
  (existsSync(log) ? readFileSync(log, "utf-8") : "")
    .split("\n")
    .filter((url) => url !== "");

let server: ChildProcess | undefined;
let origin = "";
let log = "";
let serverOutput = "";

before(async () => {
  const port = await Effect.runPromise(freePort);
  origin = `http://127.0.0.1:${port}`;
  log = join(mkdtempSync(join(tmpdir(), "api-routes-")), "api-loads.log");
  const nextBin = createRequire(import.meta.url).resolve("next/dist/bin/next");
  server = spawn(
    process.execPath,
    [nextBin, "start", "-p", String(port), "-H", "127.0.0.1"],
    {
      cwd: web,
      env: {
        ...process.env,
        API_LOAD_LOG: log,
        NODE_OPTIONS: `--import=data:text/javascript,${encodeURIComponent(recorder)}`,
      },
    }
  );
  server.stdout?.on("data", (chunk: Buffer) => {
    serverOutput += chunk.toString();
  });
  server.stderr?.on("data", (chunk: Buffer) => {
    serverOutput += chunk.toString();
  });
  const child = server;
  await Effect.runPromise(
    Effect.suspend(() => {
      if (child.exitCode !== null)
        assert.fail(`next start exited early:\n${serverOutput}`);
      return send(`${origin}/api/games?team=ANA`);
    }).pipe(
      Effect.retry({
        schedule: Schedule.spaced(Duration.millis(100)),
        times: 100,
      }),
      Effect.catch(() =>
        Effect.sync(() =>
          assert.fail(`next start did not answer:\n${serverOutput}`)
        )
      )
    )
  );
});

after(() => {
  server?.kill();
});

test("under next start, GET /api/games answers JSON", async () => {
  const response = await request(`${origin}/api/games?team=ANA`);
  assert.equal(response.status, 200);
  assert.match(response.contentType, /application\/json/);
  const body = Schema.decodeUnknownSync(
    Schema.fromJsonString(
      Schema.Struct({ team: Schema.String, count: Schema.Int })
    )
  )(response.text);
  assert.equal(body.team, "ANA");
  assert.ok(body.count > 0);
});

test("unknown API paths answer the API JSON error, not the poster page", async () => {
  const missing = await request(`${origin}/api/missing`);
  assert.equal(missing.status, 404);
  assert.match(missing.contentType, /application\/json/);
  assert.deepEqual(
    Schema.decodeUnknownSync(
      Schema.fromJsonString(Schema.Struct({ error: Schema.String }))
    )(missing.text),
    { error: "Not found" }
  );
  const post = await request(`${origin}/api/missing`, {
    method: "POST",
    body: "{}",
  });
  assert.equal(post.status, 405);
  assert.match(post.contentType, /application\/json/);
});

test("the rpc route rejects oversized POSTs", async () => {
  const oversized = await request(`${origin}/api/rpc`, {
    method: "POST",
    body: "x".repeat(16384),
    contentType: "application/json",
  });
  assert.equal(oversized.status, 413);
});

test("each box-score request through next start loads exactly one chunk file", async () => {
  // The handler is already loaded by the requests above, so only box-score chunks can appear from here.
  const handlerLoads = loaded(log);
  assert.ok(
    handlerLoads.some((url) => url.endsWith("/web-handler.js")),
    "the route must load the built web-handler.js"
  );
  assert.equal(
    handlerLoads.filter((url) => /\/chunk-[^/]*\.js$/.test(url)).length,
    0
  );
  const loadBox = (gameId: number) =>
    Effect.runPromise(
      Effect.gen(function* () {
        const source = yield* BoxscoreSource;
        return yield* source.load(gameId);
      }).pipe(Effect.provide(rpcBoxscoreSourceLayer(`${origin}/api/rpc`)))
    );
  for (const [index, gameId] of [gameIds[0], gameIds[1]].entries()) {
    const box = await loadBox(gameId);
    assert.equal(box.gameId, gameId);
    const chunks = loaded(log).filter((url) => /\/chunk-[^/]*\.js$/.test(url));
    assert.equal(chunks.length, index + 1);
    const chunk = readFileSync(fileURLToPath(chunks[index]), "utf-8");
    assert.ok(
      chunk.includes(`/${gameId}.json`),
      "the loaded chunk must be that game"
    );
  }
});
