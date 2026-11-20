import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { createServer } from "node:http";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, test } from "node:test";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { gzipSync } from "node:zlib";

import { Effect } from "effect";

const execFileAsync = promisify(execFile);
const script = fileURLToPath(
  new URL("../scripts/fetch-history.ts", import.meta.url)
);

const payload = Buffer.from(
  "SQLite format 3\u0000 fake serving payload for the fetch test"
);
const payloadSha = createHash("sha256").update(payload).digest("hex");
const gzipped = gzipSync(payload);

let server: Server;
let baseUrl = "";
let hits = 0;

before(async () => {
  server = createServer((request, response) => {
    hits += 1;
    if (request.url === "/not-gzip.gz") {
      response
        .writeHead(200, { "content-type": "application/gzip" })
        .end(payload);
      return;
    }
    if (request.url !== "/nhl-serve.sqlite.gz") {
      response.writeHead(404).end();
      return;
    }
    response
      .writeHead(200, { "content-type": "application/gzip" })
      .end(gzipped);
  });
  await Effect.runPromise(
    Effect.callback<void>((resume) => {
      server.listen(0, "127.0.0.1", () => {
        resume(Effect.void);
      });
    })
  );
  const { port } = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${port}`;
});

after(() => {
  server.close();
});

function workDir() {
  return mkdtempSync(join(tmpdir(), "fetch-history-"));
}

function writePointer(dir: string, overrides: Record<string, unknown> = {}) {
  const pointerPath = join(dir, "serving.json");
  const pointer = {
    snapshotId: "abcdef012345",
    url: `${baseUrl}/nhl-serve.sqlite.gz`,
    sha256: payloadSha,
    bytes: payload.length,
    ...overrides,
  };
  writeFileSync(pointerPath, `${JSON.stringify(pointer)}\n`);
  return pointerPath;
}

async function run(args: string[], env: Record<string, string> = {}) {
  try {
    const { stdout, stderr } = await execFileAsync(
      process.execPath,
      [script, ...args],
      {
        encoding: "utf-8",
        env: { ...process.env, HISTORY_KEEP_LOCAL: "", ...env },
      }
    );
    return { status: 0, stdout, stderr };
  } catch (error) {
    const failed = error as { code?: number; stdout?: string; stderr?: string };
    return {
      status: failed.code ?? 1,
      stdout: failed.stdout ?? "",
      stderr: failed.stderr ?? "",
    };
  }
}

test("writes the verified uncompressed file", async () => {
  const dir = workDir();
  try {
    const out = join(dir, "out", "nhl-serve.sqlite");
    const result = await run(["--pointer", writePointer(dir), "--out", out]);
    assert.equal(result.status, 0);
    assert.deepEqual(readFileSync(out), payload);
    assert.deepEqual(
      readdirSync(join(out, "..")).filter((name) => name.endsWith(".part")),
      []
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("a wrong hash exits 1 and leaves no file behind", async () => {
  const dir = workDir();
  try {
    const out = join(dir, "nhl-serve.sqlite");
    const pointerPath = writePointer(dir, { sha256: "0".repeat(64) });
    const result = await run(["--pointer", pointerPath, "--out", out]);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /mismatch/);
    assert.equal(existsSync(out), false);
    assert.deepEqual(
      readdirSync(join(out, "..")).filter((name) => name.endsWith(".part")),
      []
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("a missing pointer logs a skip and exits 0 without a download", async () => {
  const dir = workDir();
  try {
    const out = join(dir, "nhl-serve.sqlite");
    const before = hits;
    const result = await run([
      "--pointer",
      join(dir, "absent.json"),
      "--out",
      out,
    ]);
    assert.equal(result.status, 0);
    assert.match(result.stdout, /no history pointer; skipping/);
    assert.equal(existsSync(out), false);
    assert.equal(hits, before);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("an existing file that matches the pointer skips the download", async () => {
  const dir = workDir();
  try {
    const out = join(dir, "nhl-serve.sqlite");
    writeFileSync(out, payload);
    const before = hits;
    const result = await run(["--pointer", writePointer(dir), "--out", out]);
    assert.equal(result.status, 0);
    assert.match(result.stdout, /skipping download/);
    assert.equal(hits, before);
    assert.deepEqual(readFileSync(out), payload);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("a missing pointer removes a stale output unless --keep-existing", async () => {
  const dir = workDir();
  try {
    const out = join(dir, "nhl-serve.sqlite");
    writeFileSync(out, "stale");
    const kept = await run([
      "--pointer",
      join(dir, "absent.json"),
      "--out",
      out,
      "--keep-existing",
    ]);
    assert.equal(kept.status, 0);
    assert.equal(readFileSync(out, "utf-8"), "stale");
    const removed = await run([
      "--pointer",
      join(dir, "absent.json"),
      "--out",
      out,
    ]);
    assert.equal(removed.status, 0);
    assert.equal(existsSync(out), false);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("an invalid pointer fails before any network request", async () => {
  const dir = workDir();
  try {
    const out = join(dir, "nhl-serve.sqlite");
    const before = hits;
    for (const bad of [
      { snapshotId: "short" },
      { url: "http://example.com/x.gz" },
      { sha256: "abc" },
      { bytes: 0 },
      { bytes: 1.5 },
    ]) {
      const result = await run([
        "--pointer",
        writePointer(dir, bad),
        "--out",
        out,
      ]);
      assert.equal(result.status, 1, JSON.stringify(bad));
      assert.match(result.stderr, /invalid/);
    }
    assert.equal(hits, before);
    assert.equal(existsSync(out), false);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("concurrent fetches use their own temp files and leave a verified file", async () => {
  const dir = workDir();
  try {
    const out = join(dir, "nhl-serve.sqlite");
    const pointerPath = writePointer(dir);
    const results = await Promise.all([
      run(["--pointer", pointerPath, "--out", out]),
      run(["--pointer", pointerPath, "--out", out]),
    ]);
    for (const result of results) assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(readFileSync(out), payload);
    assert.deepEqual(
      readdirSync(dir).filter((name) => name.endsWith(".part")),
      []
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("HISTORY_KEEP_LOCAL=1 keeps a stale output like --keep-existing", async () => {
  const dir = workDir();
  try {
    const out = join(dir, "nhl-serve.sqlite");
    writeFileSync(out, "stale");
    const kept = await run(
      ["--pointer", join(dir, "absent.json"), "--out", out],
      { HISTORY_KEEP_LOCAL: "1" }
    );
    assert.equal(kept.status, 0, kept.stderr);
    assert.equal(readFileSync(out, "utf-8"), "stale");
    const removed = await run(
      ["--pointer", join(dir, "absent.json"), "--out", out],
      { HISTORY_KEEP_LOCAL: "0" }
    );
    assert.equal(removed.status, 0, removed.stderr);
    assert.equal(existsSync(out), false);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("a flag without its value is a usage error, not a path", async () => {
  const dir = workDir();
  try {
    const out = join(dir, "nhl-serve.sqlite");
    const result = await run(["--pointer", "--out", out]);
    assert.equal(result.status, 1);
    assert.match(
      result.stderr + result.stdout,
      /Missing value for flag --pointer/
    );
    assert.deepEqual(readdirSync(dir), []);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("a failed download or a body that is not gzip exits 1 and leaves no file behind", async () => {
  const dir = workDir();
  try {
    const out = join(dir, "nhl-serve.sqlite");
    for (const [path, pattern] of [
      ["/missing.gz", /download failed/],
      ["/not-gzip.gz", /gunzip failed/],
    ] as const) {
      const result = await run([
        "--pointer",
        writePointer(dir, { url: `${baseUrl}${path}` }),
        "--out",
        out,
      ]);
      assert.equal(result.status, 1, path);
      assert.match(result.stderr, pattern, path);
      assert.equal(existsSync(out), false, path);
      assert.deepEqual(
        readdirSync(dir).filter((name) => name.endsWith(".part")),
        [],
        path
      );
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
