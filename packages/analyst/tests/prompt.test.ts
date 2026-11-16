import assert from 'node:assert/strict'
import { test } from 'node:test'
import { buildPrompt } from '../src/prompt.ts'
import { VIEWS } from '../src/shapes.ts'

const prompt = buildPrompt({
  team: 'NJD',
  views: VIEWS,
  coverage: { finals: 14, archived: 9 },
  posterFacts: ['NJD has 20 points', 'Second in the Metropolitan'],
})

test('every table and column in VIEWS appears in the schema list', () => {
  for (const [table, columns] of Object.entries(VIEWS)) {
    const line = prompt.split('\n').find((l) => l.startsWith(`- \`${table}\`: `))
    assert.ok(line, `missing schema line for ${table}`)
    const listed = line.slice(line.indexOf(': ') + 2).split(', ')
    assert.deepEqual(listed, [...columns])
  }
})

test('fills team, coverage and poster facts with no leftover tokens', () => {
  assert.ok(!prompt.includes('{{'))
  assert.ok(prompt.includes('**NJD**'))
  assert.ok(prompt.includes('NJD has 14 completed games, and 9 of them have archived box scores.'))
  assert.ok(prompt.includes('- NJD has 20 points\n- Second in the Metropolitan'))
  assert.ok(buildPrompt({ team: 'NJD', views: VIEWS, coverage: { finals: 0, archived: 0 }, posterFacts: [] }).includes('- (none supplied)'))
})

test('states the out-of-scope list, canonical order, and the rank_conf caveat', () => {
  assert.match(prompt, /## Out of scope/)
  assert.match(prompt, /no period data and no event data/)
  assert.match(prompt, /## Canonical row order/)
  assert.match(prompt, /sorted ascending by every column/)
  assert.match(prompt, /`rank_conf` is \*\*computed by this project\*\*/)
  assert.match(prompt, /not the NHL's official tiebreak/)
  assert.match(prompt, /up to 6/)
})

test('poster facts are inserted literally', () => {
  const p = buildPrompt({ team: 'BOS', views: VIEWS, coverage: { finals: 1, archived: 1 }, posterFacts: ['{{team}} $& $1'] })
  assert.ok(p.includes('- {{team}} $& $1'))
})
