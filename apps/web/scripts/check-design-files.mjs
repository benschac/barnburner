import { readdir } from "node:fs/promises";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

import { logError } from "../../../lib/logger.mjs";

const root = process.argv[2] ?? fileURLToPath(new URL("../", import.meta.url));
const excluded = new Set([
  "node_modules",
  "dist",
  ".tamagui",
  ".turbo",
  ".next",
  ".git",
]);
const failures = [];
async function visit(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    const fixtureRoot =
      dir === root && entry.name.startsWith(".lint-fixtures-");
    if (entry.isDirectory() && !excluded.has(entry.name) && !fixtureRoot)
      await visit(path);
    else if (
      entry.isFile() &&
      /\.(css|scss|sass|less)$/.test(entry.name) &&
      relative(root, path) !== "src/tamagui.generated.css"
    )
      failures.push(relative(root, path));
  }
}
await visit(root);
if (failures.length) {
  logError(`Handwritten stylesheets are forbidden: ${failures.join(", ")}`);
  process.exitCode = 1;
}
