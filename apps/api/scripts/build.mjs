import { spawnSync } from 'node:child_process'
import { readdirSync, rmSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

// The history serving file ships inside the history function, so a failed fetch fails the build.
const fetchHistory = spawnSync(process.execPath, [fileURLToPath(new URL('./fetch-history.mjs', import.meta.url))], { stdio: 'inherit' })
if (fetchHistory.status !== 0) process.exit(1)

const archiveDirectory = fileURLToPath(new URL('../../../data/boxscores/20262027/', import.meta.url))
const outdir = fileURLToPath(new URL('../dist', import.meta.url))

// Each archived game becomes a literal dynamic import. Bun emits every one as its own chunk, and
// Vercel traces those literal imports into the function, so a request loads one file, not the archive.
const ids = readdirSync(archiveDirectory).flatMap((file) => /^\d+\.json$/.test(file) ? [file.slice(0, -5)] : []).sort()
const archive = {
  name: 'boxscore-archive',
  setup(build) {
    build.onResolve({ filter: /^virtual:boxscore-archive$/ }, () => ({ path: 'boxscore-archive', namespace: 'boxscore-archive' }))
    build.onLoad({ filter: /.*/, namespace: 'boxscore-archive' }, () => ({
      loader: 'js',
      contents: `export const boxscoreArchive = {${ids.map((id) => `${id}: () => import(${JSON.stringify(`${archiveDirectory}${id}.json`)})`).join(',')}}`,
    }))
  },
}

// Chunk names are content hashes, so clear stale chunks from earlier builds.
rmSync(outdir, { recursive: true, force: true })
const result = await Bun.build({
  entrypoints: [fileURLToPath(new URL('../src/web-handler.ts', import.meta.url))],
  outdir, target: 'node', format: 'esm', splitting: true, plugins: [archive],
})
if (!result.success) {
  for (const log of result.logs) console.error(log)
  process.exit(1)
}
console.log(`Bundled web handler with ${ids.length} lazily loaded box scores`)

// The history function is its own bundle: it reads one serving file and needs no snapshot JSON or archive.
const history = await Bun.build({
  entrypoints: [fileURLToPath(new URL('../src/history-handler.ts', import.meta.url))],
  outdir, target: 'node', format: 'esm', splitting: false,
})
if (!history.success) {
  for (const log of history.logs) console.error(log)
  process.exit(1)
}
console.log('Bundled history handler')
