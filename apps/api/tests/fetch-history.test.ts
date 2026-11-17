import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { after, before, test } from 'node:test'
import { promisify } from 'node:util'
import { execFile } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { gzipSync } from 'node:zlib'

const execFileAsync = promisify(execFile)
const script = fileURLToPath(new URL('../scripts/fetch-history.mjs', import.meta.url))

const payload = Buffer.from('SQLite format 3\u0000 fake serving payload for the fetch test')
const payloadSha = createHash('sha256').update(payload).digest('hex')
const gzipped = gzipSync(payload)

let server: Server
let baseUrl = ''
let hits = 0

before(async () => {
  server = createServer((request, response) => {
    hits += 1
    if (request.url !== '/nhl-serve.sqlite.gz') {
      response.writeHead(404).end()
      return
    }
    response.writeHead(200, { 'content-type': 'application/gzip' }).end(gzipped)
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const { port } = server.address() as AddressInfo
  baseUrl = `http://127.0.0.1:${port}`
})

after(() => {
  server.close()
})

function workDir() {
  return mkdtempSync(join(tmpdir(), 'fetch-history-'))
}

function writePointer(dir: string, overrides: Record<string, unknown> = {}) {
  const pointerPath = join(dir, 'serving.json')
  const pointer = {
    snapshotId: 'test-snapshot',
    url: `${baseUrl}/nhl-serve.sqlite.gz`,
    sha256: payloadSha,
    bytes: payload.length,
    ...overrides,
  }
  writeFileSync(pointerPath, `${JSON.stringify(pointer)}\n`)
  return pointerPath
}

async function run(args: string[]) {
  try {
    const { stdout, stderr } = await execFileAsync(process.execPath, [script, ...args], { encoding: 'utf8' })
    return { status: 0, stdout, stderr }
  } catch (error) {
    const failed = error as { code?: number; stdout?: string; stderr?: string }
    return { status: failed.code ?? 1, stdout: failed.stdout ?? '', stderr: failed.stderr ?? '' }
  }
}

test('writes the verified uncompressed file', async () => {
  const dir = workDir()
  try {
    const out = join(dir, 'out', 'nhl-serve.sqlite')
    const result = await run(['--pointer', writePointer(dir), '--out', out])
    assert.equal(result.status, 0)
    assert.deepEqual(readFileSync(out), payload)
    assert.equal(existsSync(`${out}.part`), false)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('a wrong hash exits 1 and leaves no file behind', async () => {
  const dir = workDir()
  try {
    const out = join(dir, 'nhl-serve.sqlite')
    const pointerPath = writePointer(dir, { sha256: '0'.repeat(64) })
    const result = await run(['--pointer', pointerPath, '--out', out])
    assert.equal(result.status, 1)
    assert.match(result.stderr, /mismatch/)
    assert.equal(existsSync(out), false)
    assert.equal(existsSync(`${out}.part`), false)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('a missing pointer logs a skip and exits 0 without a download', async () => {
  const dir = workDir()
  try {
    const out = join(dir, 'nhl-serve.sqlite')
    const before = hits
    const result = await run(['--pointer', join(dir, 'absent.json'), '--out', out])
    assert.equal(result.status, 0)
    assert.match(result.stdout, /no history pointer; skipping/)
    assert.equal(existsSync(out), false)
    assert.equal(hits, before)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('an existing file that matches the pointer skips the download', async () => {
  const dir = workDir()
  try {
    const out = join(dir, 'nhl-serve.sqlite')
    writeFileSync(out, payload)
    const before = hits
    const result = await run(['--pointer', writePointer(dir), '--out', out])
    assert.equal(result.status, 0)
    assert.match(result.stdout, /skipping download/)
    assert.equal(hits, before)
    assert.deepEqual(readFileSync(out), payload)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
