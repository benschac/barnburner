#!/usr/bin/env node
// Fetches the history serving file named by the pointer `data/history/serving.json`:
//   { snapshotId, url, sha256, bytes }
// `url` serves the file gzipped. `sha256` and `bytes` describe the UNCOMPRESSED sqlite file, so they are
// checked after gunzip. The file is written to its own `.part` sibling and renamed into place only after it
// verifies. A missing pointer is allowed (the history API then answers HistoryUnavailable) and exits 0. It
// also removes any stale output so an old snapshot is never served; `--keep-existing` or
// HISTORY_KEEP_LOCAL=1 keeps a hand-staged file. The pointer is fully validated before any network I/O. If
// the output already matches the pointer, the download is skipped.
import { createHash, randomBytes } from 'node:crypto'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createGunzip } from 'node:zlib'
import { NodeServices, NodeStream } from '@effect/platform-node'
import { Config, Console, Effect, FileSystem, Layer, Schema, Stream } from 'effect'
import { CliError, Command, Flag } from 'effect/cli'
import { FetchHttpClient, HttpClient } from 'effect/http'

const repoRoot = fileURLToPath(new URL('../../../', import.meta.url))
const defaultPointerPath = join(repoRoot, 'data/history/serving.json')
const defaultOutPath = join(repoRoot, 'apps/web/history-data/nhl-serve.sqlite')

class InvalidPointer extends Schema.TaggedError<InvalidPointer, { readonly brand: unique symbol }>()('InvalidPointer', {
  path: Schema.String,
  message: Schema.String,
}) {}

class DownloadFailed extends Schema.TaggedError<DownloadFailed, { readonly brand: unique symbol }>()('DownloadFailed', {
  url: Schema.String,
  message: Schema.String,
}) {}

class ServingFileMismatch extends Schema.TaggedError<ServingFileMismatch, { readonly brand: unique symbol }>()('ServingFileMismatch', {
  expectedBytes: Schema.Int,
  expectedSha256: Schema.String,
  actualBytes: Schema.Int,
  actualSha256: Schema.String,
}) {}

class ServingFileWriteFailed extends Schema.TaggedError<ServingFileWriteFailed, { readonly brand: unique symbol }>()('ServingFileWriteFailed', {
  path: Schema.String,
  message: Schema.String,
}) {}

const Pointer = Schema.Struct({
  snapshotId: Schema.String.check(Schema.isPattern(/^[0-9a-f]{12}$/)),
  url: Schema.String.check(Schema.isPattern(/^(https:\/\/|http:\/\/(127\.0\.0\.1|localhost)[:/])\S+$/)),
  sha256: Schema.String.check(Schema.isPattern(/^[0-9a-f]{64}$/)),
  bytes: Schema.Int.check(Schema.isGreaterThan(0)),
})
type Pointer = typeof Pointer.Type
const decodePointer = Schema.decodeUnknownEffect(Schema.fromJsonString(Pointer))

type Digest = { readonly sha256: string; readonly bytes: number }

/** Byte count and SHA-256 hex digest of everything `bytes` emits. */
const digest = <E, R>(bytes: Stream.Stream<Uint8Array, E, R>): Effect.Effect<Digest, E, R> => Effect.suspend(() => {
  const hash = createHash('sha256')
  return bytes.pipe(
    Stream.runFold(() => 0, (total, chunk) => {
      hash.update(chunk)
      return total + chunk.byteLength
    }),
    Effect.map((total) => ({ sha256: hash.digest('hex'), bytes: total })),
  )
})

const readPointer = (path: string) => Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem
  const text = yield* fs.readFileString(path).pipe(
    Effect.catchTag('PlatformError', (error) => Effect.fail(new InvalidPointer({ path, message: error.message }))),
  )
  return yield* decodePointer(text).pipe(
    Effect.catchTag('SchemaError', (error) => Effect.fail(new InvalidPointer({ path, message: error.message }))),
  )
})

/**
 * Downloads `pointer.url`, gunzips it into a `.part` file of its own, and renames it over `outPath` only when
 * its size and hash match. The `.part` file is removed on any failure or interruption.
 */
const download = (pointer: Pointer, outPath: string) => Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem
  const client = (yield* HttpClient.HttpClient).pipe(HttpClient.filterStatusOk)
  const writeFailed = (path: string) => (error: { readonly message: string }) =>
    Effect.fail(new ServingFileWriteFailed({ path, message: error.message }))
  const downloadFailed = (error: { readonly message: string }) =>
    Effect.fail(new DownloadFailed({ url: pointer.url, message: error.message }))

  const response = yield* client.get(pointer.url).pipe(Effect.catchTag('HttpClientError', downloadFailed))
  yield* fs.makeDirectory(dirname(outPath), { recursive: true }).pipe(Effect.catchTag('PlatformError', writeFailed(outPath)))
  const partPath = `${outPath}.${process.pid}.${randomBytes(6).toString('hex')}.part`

  const write = Effect.gen(function* () {
    // The digest covers the exact bytes the sink writes, so the file does not need a second read.
    const hash = createHash('sha256')
    let total = 0
    yield* response.stream.pipe(
      Stream.mapError((error) => new DownloadFailed({ url: pointer.url, message: error.message })),
      NodeStream.pipeThroughDuplex({
        evaluate: createGunzip,
        onError: (cause) => new DownloadFailed({ url: pointer.url, message: `gunzip failed: ${String(cause)}` }),
      }),
      Stream.tap((chunk) => Effect.sync(() => {
        hash.update(chunk)
        total += chunk.byteLength
      })),
      Stream.run(fs.sink(partPath)),
      Effect.catchTag('PlatformError', writeFailed(partPath)),
    )
    const actual: Digest = { sha256: hash.digest('hex'), bytes: total }
    if (actual.bytes !== pointer.bytes || actual.sha256 !== pointer.sha256) {
      return yield* new ServingFileMismatch({
        expectedBytes: pointer.bytes, expectedSha256: pointer.sha256, actualBytes: actual.bytes, actualSha256: actual.sha256,
      })
    }
    yield* fs.rename(partPath, outPath).pipe(Effect.catchTag('PlatformError', writeFailed(outPath)))
  })
  yield* write.pipe(Effect.onError(() => fs.remove(partPath, { force: true }).pipe(Effect.ignore)))
})

type Outcome = 'skipped' | 'unchanged' | 'downloaded'

const fetchServingFile = (options: { readonly pointerPath: string; readonly outPath: string; readonly keepExisting: boolean }) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const { pointerPath, outPath, keepExisting } = options
    const notWritten = (error: { readonly message: string }) =>
      Effect.fail(new ServingFileWriteFailed({ path: outPath, message: error.message }))

    if (!(yield* fs.exists(pointerPath).pipe(Effect.catchTag('PlatformError', notWritten)))) {
      if (keepExisting) {
        yield* Console.log('no history pointer; skipping (keeping any existing local file)')
      } else {
        yield* fs.remove(outPath, { force: true }).pipe(Effect.catchTag('PlatformError', notWritten))
        yield* Console.log('no history pointer; skipping (removed any stale serving file)')
      }
      return 'skipped' satisfies Outcome
    }
    const pointer = yield* readPointer(pointerPath)

    if (yield* fs.exists(outPath).pipe(Effect.catchTag('PlatformError', notWritten))) {
      const current = yield* digest(fs.stream(outPath)).pipe(Effect.catchTag('PlatformError', notWritten))
      if (current.sha256 === pointer.sha256 && current.bytes === pointer.bytes) {
        yield* Console.log(`history serving file already matches ${pointer.snapshotId}; skipping download`)
        return 'unchanged' satisfies Outcome
      }
    }

    yield* download(pointer, outPath)
    yield* Console.log(`history serving file written for ${pointer.snapshotId} (${pointer.bytes} bytes)`)
    return 'downloaded' satisfies Outcome
  })

const command = Command.make('fetch-history', {
  pointer: Flag.String('pointer').pipe(
    Flag.withDefault(defaultPointerPath),
    Flag.withDescription('The serving pointer JSON; defaults to data/history/serving.json.'),
  ),
  out: Flag.String('out').pipe(
    Flag.withDefault(defaultOutPath),
    Flag.withDescription('Where to write the serving file; defaults to apps/web/history-data/nhl-serve.sqlite.'),
  ),
  keepExisting: Flag.Boolean('keep-existing').pipe(
    Flag.withFallbackConfig(Config.Boolean('HISTORY_KEEP_LOCAL')),
    Flag.withDefault(false),
    Flag.withDescription('With no pointer, keep a hand-staged serving file instead of removing it. Also HISTORY_KEEP_LOCAL=1.'),
  ),
}, ({ pointer, out, keepExisting }) => fetchServingFile({ pointerPath: pointer, outPath: out, keepExisting })).pipe(
  Command.withDescription('Fetch and verify the history serving file named by the pointer.'),
)

const fail = (message: string) => Effect.sync(() => {
  process.stderr.write(`${message}\n`)
  process.exitCode = 1
})

const run = Command.run(command, { version: '0.0.0' }).pipe(
  Effect.catchTags({
    InvalidPointer: (e) => fail(`history pointer ${e.path} is invalid: ${e.message}`),
    DownloadFailed: (e) => fail(`download failed: ${e.url}: ${e.message}`),
    ServingFileMismatch: (e) => fail(
      `history serving file mismatch: expected ${e.expectedBytes} bytes sha256 ${e.expectedSha256}, ` +
        `got ${e.actualBytes} bytes sha256 ${e.actualSha256}`,
    ),
    ServingFileWriteFailed: (e) => fail(`could not write ${e.path}: ${e.message}`),
  }),
  // effect/cli has already printed parse errors and help; only the exit code is left.
  Effect.catchIf(CliError.isCliError, () => Effect.sync(() => { process.exitCode = 1 })),
  Effect.provide(Layer.mergeAll(NodeServices.layer, FetchHttpClient.layer)),
)

await Effect.runPromise(run)
