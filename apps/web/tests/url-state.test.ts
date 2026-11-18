import assert from 'node:assert/strict'
import { test } from 'node:test'
import { Option } from 'effect'
import { AtomRegistry } from 'effect/reactivity'
import { fromAtom, filterAtom, makeFilter } from '../src/explorer/url-state.ts'

const none = { competition: Option.none(), fromSeason: Option.none(), toSeason: Option.none(), partners: Option.none() }

test('missing parameters give the section C-search defaults', () => {
  assert.deepEqual(makeFilter(none), { competition: 'all', fromSeason: null, toSeason: null, goaliePartners: true })
})

test('decoded parameters override the defaults', () => {
  assert.deepEqual(
    makeFilter({
      competition: Option.some('playoff'), fromSeason: Option.some(20102011), toSeason: Option.some(20232024),
      partners: Option.some('off'),
    }),
    { competition: 'playoff', fromSeason: 20102011, toSeason: 20232024, goaliePartners: false },
  )
})

test('filterAtom reads the defaults outside a browser', () => {
  const registry = AtomRegistry.make()
  assert.deepEqual(registry.get(filterAtom), makeFilter(none))
})

test('an empty or malformed parameter decodes to none', () => {
  const registry = AtomRegistry.make()
  assert.equal(Option.isNone(registry.get(fromAtom)), true)
})
