import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { logError, logInfo } from "../../../lib/logger.mjs";

// The history serving file ships inside the history function, so a failed fetch fails the build.
const fetchHistory = spawnSync(
  process.execPath,
  [fileURLToPath(new URL("fetch-history.ts", import.meta.url))],
  { stdio: "inherit" }
);
if (fetchHistory.status !== 0) process.exit(1);

const archiveDirectory = fileURLToPath(
  new URL("../../../data/boxscores/20262027/", import.meta.url)
);

const insightsDirectory = fileURLToPath(
  new URL("../../../data/insights/20262027/", import.meta.url)
);
const outdir = fileURLToPath(new URL("../dist", import.meta.url));

// Each archived game becomes a literal dynamic import. Bun emits every one as its own chunk, and
// Vercel traces those literal imports into the function, so a request loads one file, not the archive.
const ids = readdirSync(archiveDirectory)
  .flatMap((file) => (/^\d+\.json$/.test(file) ? [file.slice(0, -5)] : []))
  .sort();
const archive = {
  name: "boxscore-archive",
  setup(build) {
    build.onResolve({ filter: /^virtual:boxscore-archive$/ }, () => ({
      path: "boxscore-archive",
      namespace: "boxscore-archive",
    }));
    build.onLoad({ filter: /.*/, namespace: "boxscore-archive" }, () => ({
      loader: "js",
      contents: `export const boxscoreArchive = {${ids.map((id) => `${id}: () => import(${JSON.stringify(`${archiveDirectory}${id}.json`)})`).join(",")}}`,
    }));
  },
};

// Insight cards are bundled the same way, one literal dynamic import per team file. A missing directory means no cards.
const teams = existsSync(insightsDirectory)
  ? readdirSync(insightsDirectory)
      .flatMap((file) =>
        /^[A-Z]{3}\.json$/.test(file) ? [file.slice(0, -5)] : []
      )
      .sort()
  : [];

const insights = {
  name: "insights-archive",
  setup(build) {
    build.onResolve({ filter: /^virtual:insights-archive$/ }, () => ({
      path: "insights-archive",
      namespace: "insights-archive",
    }));
    build.onLoad({ filter: /.*/, namespace: "insights-archive" }, () => ({
      loader: "js",
      contents: `export const insightsArchive = {${teams.map((team) => `${team}: () => import(${JSON.stringify(`${insightsDirectory}${team}.json`)})`).join(",")}}`,
    }));
  },
};

// Chunk names are content hashes, so clear stale chunks from earlier builds.
rmSync(outdir, { recursive: true, force: true });
const result = await Bun.build({
  entrypoints: [
    fileURLToPath(new URL("../src/web-handler.ts", import.meta.url)),
  ],
  outdir,
  throw: false,
  target: "node",
  format: "esm",
  splitting: true,
  plugins: [archive, insights],
});
if (!result.success) {
  for (const log of result.logs) logError(Bun.inspect(log));
  process.exit(1);
}

logInfo(
  `Bundled web handler with ${ids.length} lazily loaded box scores and ${teams.length} insight files`
);

// The history function is its own bundle: it reads one serving file and needs no snapshot JSON or archive.
const history = await Bun.build({
  entrypoints: [
    fileURLToPath(new URL("../src/history-handler.ts", import.meta.url)),
  ],
  outdir,
  throw: false,
  target: "node",
  format: "esm",
  splitting: false,
});
if (!history.success) {
  for (const log of history.logs) logError(Bun.inspect(log));
  process.exit(1);
}
logInfo("Bundled history handler");
