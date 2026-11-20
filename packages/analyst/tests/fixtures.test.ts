import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const dataDir = fileURLToPath(new URL("./fixtures/data", import.meta.url));

function jsonFiles(dir: string): string[] {
  return readdirSync(dir, { recursive: true, withFileTypes: false })
    .map(String)
    .filter((name) => name.endsWith(".json"))
    .map((name) => join(dir, name));
}

test("every fixture file parses as JSON", () => {
  const files = jsonFiles(dataDir);
  assert.equal(files.length, 5);
  for (const file of files) {
    assert.doesNotThrow(
      () => JSON.parse(readFileSync(file, "utf8")),
      relative(dataDir, file)
    );
  }
});
