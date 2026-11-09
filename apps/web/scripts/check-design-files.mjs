import { readdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { join, relative } from 'node:path'
const root = fileURLToPath(new URL('../', import.meta.url))
const excluded = new Set(['node_modules', 'dist', '.tamagui', '.turbo', '.git'])
const failures = []
async function visit(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name)
    if (entry.isDirectory() && !excluded.has(entry.name)) await visit(path)
    else if (entry.isFile() && /\.(css|scss|sass|less)$/.test(entry.name) && relative(root, path) !== 'src/tamagui.generated.css') failures.push(relative(root, path))
  }
}
await visit(root)
if (failures.length) {
  console.error(`Handwritten stylesheets are forbidden: ${failures.join(', ')}`)
  process.exitCode = 1
}
