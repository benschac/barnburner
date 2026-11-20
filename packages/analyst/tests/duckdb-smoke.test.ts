import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import { DuckDBInstance } from "@duckdb/node-api";

import { logInfo } from "../../../lib/logger.mjs";

const errorOf = async (run: () => Promise<unknown>): Promise<string> => {
  try {
    await run();
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
  throw new Error("expected the statement to fail");
};

test("duckdb lock: load, lock, wrap, serialize", async () => {
  const dir = mkdtempSync(join(tmpdir(), "duckdb-smoke-"));
  const source = join(dir, "rows.json");
  writeFileSync(
    source,
    JSON.stringify([
      { id: 1, team: "A", n: 3 },
      { id: 2, team: "B", n: 3 },
      { id: 3, team: "A", n: 1 },
    ])
  );
  const instance = await DuckDBInstance.create(":memory:");
  const connection = await instance.connect();
  try {
    // 1
    const one = await connection.runAndReadAll("select 1 as x");
    assert.deepEqual(one.getRowObjectsJson(), [{ x: 1 }]);

    // 2
    await connection.run(
      `CREATE TABLE t AS SELECT * FROM read_json('${source}')`
    );
    const count = await connection.runAndReadAll("select count(*) as c from t");
    assert.deepEqual(count.getRowObjectsJson(), [{ c: "3" }]);

    // 3
    await connection.run("SET enable_external_access=false");
    await connection.run("SET lock_configuration=true");
    const still = await connection.runAndReadAll("select count(*) as c from t");
    assert.deepEqual(still.getRowObjectsJson(), [{ c: "3" }]);
    const failures = {
      copy: await errorOf(() =>
        connection.run(`COPY t TO '${join(dir, "out.csv")}'`)
      ),
      attach: await errorOf(() =>
        connection.run(`ATTACH '${join(dir, "other.db")}' AS other`)
      ),
      readJson: await errorOf(() =>
        connection.run(`SELECT * FROM read_json('${source}')`)
      ),
      unlock: await errorOf(() =>
        connection.run("SET enable_external_access=true")
      ),
    };
    for (const message of Object.values(failures))
      assert.ok(message.length > 0);
    logInfo(failures);

    // 4
    const wrapped = await connection.runAndReadAll(
      "SELECT * FROM (SELECT id, team, n FROM t ORDER BY n DESC LIMIT 2) ORDER BY ALL"
    );
    assert.deepEqual(wrapped.getRowObjectsJson(), [
      { id: "1", team: "A", n: "3" },
      { id: "2", team: "B", n: "3" },
    ]);

    // 5
    const serialized = await connection.runAndReadAll(
      "SELECT json_serialize_sql('SELECT id FROM t') AS j"
    );
    const serializedSql = serialized.getRowObjectsJson()[0]?.j;
    assert.ok(typeof serializedSql === "string");
    const json = JSON.parse(serializedSql);
    assert.equal(json.error, false);
  } finally {
    connection.closeSync();
    instance.closeSync();
    rmSync(dir, { recursive: true, force: true });
  }
});
