#!/usr/bin/env node
// Proves the union-model lint rules fire on bad shapes and stay quiet on good ones.
// Usage: node scripts/test-union-rules.mjs <package dir with .oxlintrc.json>
import assert from 'node:assert/strict'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const oxlint = fileURLToPath(new URL('../node_modules/.bin/oxlint', import.meta.url))
const root = resolve(process.argv[2] ?? '.')
const dir = await mkdtemp(`${root}/union-rule-test-`)
const cases = [
  ['untagged union', 'export type A = { value: number } | { declined: true; reason?: string }', 'unions(discriminated)'],
  ['untagged inline union', 'export const f = (a: { x: number } | { y: number }) => a', 'unions(discriminated)'],
  ['tagged union', "export type A = { _tag: 'Answered'; value: number } | { _tag: 'Declined' }", null],
  ['boolean discriminant', 'export type A = { ok: true; value: number } | { ok: false; reason: string }', null],
  ['object or null', 'export type A = { value: number } | null', null],
  ['in narrowing', "export const f = (a: object) => 'declined' in a", 'unions(no-in-narrowing)'],
  ['foreign in', "// foreign: a is parsed JSON\nexport const f = (a: object) => 'declined' in a", null],
  ['bare foreign marker', "// foreign:\nexport const f = (a: object) => 'declined' in a", 'unions(no-in-narrowing)'],
  ['dynamic in', 'export const f = (a: object, key: string) => key in a', null],
]

try {
  for (const [name, source, expected] of cases) {
    const file = `${dir}/case.ts`
    await writeFile(file, source)
    const result = spawnSync(oxlint, ['--format', 'json', file], { cwd: root, encoding: 'utf8' })
    assert.equal(result.error, undefined, name)
    const { diagnostics } = JSON.parse(result.stdout)
    assert.ok(!diagnostics.some((d) => d.message.includes('Error running JS plugin')), `${name}: plugin crashed`)
    const errors = diagnostics.filter((d) => d.severity === 'error')
    if (expected) assert.ok(errors.some((d) => d.code === expected), `${name}: ${result.stdout}`)
    else assert.equal(errors.length, 0, `${name}: ${result.stdout}`)
    assert.equal(result.status, expected ? 1 : 0, name)
  }
  console.log(`${cases.length} union-model lint cases passed`)
} finally {
  await rm(dir, { recursive: true, force: true })
}
