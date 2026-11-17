import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { join } from 'node:path'
const script = join(import.meta.dirname, '../scripts/ask.ts')
test('ask CLI help does not open a database or call a model', () => {
  const result = spawnSync(process.execPath, [script, '--help'], { encoding: 'utf8', cwd: '/tmp' })
  assert.equal(result.status, 0)
  assert.match(result.stdout, /--data-dir/)
})
for (const args of [[], ['q'], ['q', '--team'], ['q', '--team', 'NJD', '--unknown', 'x']]) {
  test(`ask CLI rejects malformed arguments ${JSON.stringify(args)}`, () => {
    const result = spawnSync(process.execPath, [script, ...args], { encoding: 'utf8', cwd: '/tmp' })
    assert.equal(result.status, 1)
    assert.match(result.stderr, /Usage:/)
  })
}
