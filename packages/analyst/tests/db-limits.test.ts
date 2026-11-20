import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import { Clock, Effect } from "effect";

import { openDb } from "../src/db.ts";
import type { Db } from "../src/shapes.ts";
import { makeGate } from "./gate.ts";

const now = () => Effect.runPromise(Clock.currentTimeMillis);
const sleep = (ms: number) => Effect.runPromise(Effect.sleep(ms));

const withDb = async (run: (db: Db) => Promise<void>): Promise<void> => {
  const dir = mkdtempSync(join(tmpdir(), "db-limits-"));
  const views = join(dir, "views");
  mkdirSync(views);
  try {
    await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const db = yield* openDb({ dataDir: dir, viewsDir: views });
          yield* Effect.promise(() => run(db));
        })
      )
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
};

test("a slow query is interrupted and fails with SqlError", async () => {
  await withDb(async (db) => {
    const started = await now();
    const error = await Effect.runPromise(
      Effect.flip(
        db.query("select count(*) from range(100000) a, range(100000) b", {
          timeoutMs: 200,
        })
      )
    );
    assert.equal(error._tag, "SqlError");
    assert.match(error.message, /timed out/);
    assert.ok((await now()) - started < 10000);
    // the connection stays usable afterwards
    assert.deepEqual(await Effect.runPromise(db.query("select 1 as x")), {
      rows: [{ x: 1 }],
      rowCount: 1,
    });
  });
});

test("rowCap truncates rows but rowCount is the full count", async () => {
  await withDb(async (db) => {
    const result = await Effect.runPromise(
      db.query("select * from range(10) t(n)", { rowCap: 3 })
    );
    assert.equal(result.rows.length, 3);
    assert.equal(result.rowCount, 10);
    const canonical = await Effect.runPromise(
      db.queryCanonical("select * from range(10) t(n)", { rowCap: 4 })
    );
    assert.equal(canonical.rows.length, 4);
    assert.equal(canonical.rowCount, 10);
  });
});

test("concurrent queries on one Db do not cancel each other", async () => {
  await withDb(async (db) => {
    const slow = Effect.runPromise(
      Effect.result(
        db.query("select count(*) as n from range(30000) a, range(30000) b", {
          timeoutMs: 20000,
        })
      )
    );
    const quick = Effect.runPromise(
      db.query("select 1 as x", { timeoutMs: 100 })
    );
    assert.deepEqual(await quick, { rows: [{ x: 1 }], rowCount: 1 });
    const outcome = await slow;
    assert.equal(outcome._tag, "Success");
  });
});

test("a result that completes after the deadline fails as timed out", async () => {
  await withDb(async (db) => {
    const error = await Effect.runPromise(
      Effect.flip(
        db.query("select * from range(2000000) t(n)", {
          timeoutMs: 1,
          rowCap: 3,
        })
      )
    );
    assert.equal(error._tag, "SqlError");
    assert.match(error.message, /timed out/);
  });
});

test("rowCap 0 returns no rows but the full count", async () => {
  await withDb(async (db) => {
    assert.deepEqual(
      await Effect.runPromise(
        db.query("select * from range(5) t(n)", { rowCap: 0 })
      ),
      { rows: [], rowCount: 5 }
    );
  });
});

test(
  "aborting native work drains it before the connection is reused",
  { timeout: 4000 },
  async () => {
    await withDb(async (db) => {
      const controller = new AbortController();
      const pending = Effect.runPromise(
        db.query("select count(*) from range(100000000) a, range(100000000) b"),
        { signal: controller.signal }
      );
      const rejected = assert.rejects(pending);
      await sleep(30);
      controller.abort();
      await rejected;
      assert.deepEqual(await Effect.runPromise(db.query("select 1 as x")), {
        rows: [{ x: 1 }],
        rowCount: 1,
      });
    });
  }
);

test(
  "a cancelled queued query never runs or interrupts the active query",
  { timeout: 4000 },
  async () => {
    await withDb(async (db) => {
      const active = Effect.runPromise(
        Effect.result(
          db.query(
            "select count(*) from range(100000000) a, range(100000000) b",
            { timeoutMs: 200 }
          )
        )
      );
      const controller = new AbortController();
      const queued = Effect.runPromise(
        db.query("select count(*) from range(100000000) a, range(100000000) b"),
        { signal: controller.signal }
      );
      const rejected = assert.rejects(queued);
      controller.abort();
      const result = await active;
      assert.equal(result._tag, "Failure");
      if (result._tag === "Failure")
        assert.match(result.failure.message, /timed out after 200ms/);
      await rejected;
      assert.deepEqual(await Effect.runPromise(db.query("select 1 as x")), {
        rows: [{ x: 1 }],
        rowCount: 1,
      });
    });
  }
);

test(
  "scope cleanup waits for an aborted native query",
  { timeout: 4000 },
  async () => {
    const dir = mkdtempSync(join(tmpdir(), "db-abort-scope-"));
    const controller = new AbortController();
    const ready = makeGate();
    try {
      const pending = Effect.runPromise(
        Effect.scoped(
          Effect.gen(function* () {
            const db = yield* openDb({ dataDir: dir, viewsDir: dir });
            ready.open();
            return yield* db.query(
              "select count(*) from range(100000000) a, range(100000000) b"
            );
          })
        ),
        { signal: controller.signal }
      );
      const rejected = assert.rejects(pending);
      await ready.opened;
      await sleep(30);
      controller.abort();
      await rejected;
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }
);
