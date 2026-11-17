#!/usr/bin/env node
// Fetches the history serving file named by the pointer `data/history/serving.json`:
//   { snapshotId, url, sha256, bytes }
// `url` serves the file gzipped. `sha256` and `bytes` describe the UNCOMPRESSED sqlite file, so they are
// checked after gunzip. The file is written to a `.part` sibling and renamed into place only after it verifies.
// A missing pointer is allowed (the history API then answers HistoryUnavailable) and exits 0.
// If the output already matches the pointer, the download is skipped.
import { createHash } from 'node:crypto'
import { createReadStream, createWriteStream, existsSync, mkdirSync, readFileSync, renameSync, rmSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { createGunzip } from 'node:zlib'

const repoRoot = fileURLToPath(new URL('../../../', import.meta.url))
export const defaultPointerPath = join(repoRoot, 'data/history/serving.json')
export const defaultOutPath = join(repoRoot, 'apps/web/history-data/nhl-serve.sqlite')

// Reads the file and returns its byte count and SHA-256 hex digest.
async function digestFile(path) {
  const hash = createHash('sha256')
  let bytes = 0
  for await (const chunk of createReadStream(path)) {
    hash.update(chunk)
    bytes += chunk.length
  }
  return { sha256: hash.digest('hex'), bytes }
}

function readPointer(pointerPath) {
  const pointer = JSON.parse(readFileSync(pointerPath, 'utf8'))
  if (typeof pointer.url !== 'string' || typeof pointer.sha256 !== 'string' || !Number.isSafeInteger(pointer.bytes)) {
    throw new Error(`history pointer ${pointerPath} needs url, sha256, and bytes`)
  }
  return pointer
}

// Returns 'skipped' (no pointer), 'unchanged' (output already matches), or 'downloaded'. Throws on any mismatch.
export async function fetchServingFile({
  pointerPath = defaultPointerPath,
  outPath = defaultOutPath,
  fetchImpl = fetch,
  log = console.log,
} = {}) {
  if (!existsSync(pointerPath)) {
    log('no history pointer; skipping')
    return 'skipped'
  }
  const pointer = readPointer(pointerPath)

  if (existsSync(outPath)) {
    const current = await digestFile(outPath)
    if (current.sha256 === pointer.sha256 && current.bytes === pointer.bytes) {
      log(`history serving file already matches ${pointer.snapshotId ?? 'pointer'}; skipping download`)
      return 'unchanged'
    }
  }

  const response = await fetchImpl(pointer.url)
  if (!response.ok || !response.body) {
    throw new Error(`download failed: ${response.status} ${pointer.url}`)
  }

  mkdirSync(dirname(outPath), { recursive: true })
  const partPath = `${outPath}.part`
  try {
    await pipeline(Readable.fromWeb(response.body), createGunzip(), createWriteStream(partPath))
    const actual = await digestFile(partPath)
    if (actual.bytes !== pointer.bytes || actual.sha256 !== pointer.sha256) {
      throw new Error(
        `history serving file mismatch: expected ${pointer.bytes} bytes sha256 ${pointer.sha256}, ` +
          `got ${actual.bytes} bytes sha256 ${actual.sha256}`,
      )
    }
    renameSync(partPath, outPath)
  } catch (error) {
    rmSync(partPath, { force: true })
    throw error
  }
  log(`history serving file written for ${pointer.snapshotId ?? 'pointer'} (${pointer.bytes} bytes)`)
  return 'downloaded'
}

function parseArgs(argv) {
  const options = {}
  for (let i = 0; i < argv.length; i += 2) {
    const flag = argv[i]
    if (flag !== '--pointer' && flag !== '--out') throw new Error(`unknown argument ${flag}`)
    if (argv[i + 1] === undefined) throw new Error(`${flag} needs a path`)
    options[flag === '--pointer' ? 'pointerPath' : 'outPath'] = argv[i + 1]
  }
  return options
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    await fetchServingFile(parseArgs(process.argv.slice(2)))
  } catch (error) {
    console.error(error instanceof Error ? error.message : error)
    process.exit(1)
  }
}
