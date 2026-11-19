import assert from 'node:assert/strict'
import { test } from 'node:test'
import { Option } from 'effect'
import { AtomRegistry } from 'effect/reactivity'
import { Competition, Partners, WholeNumber, decodeParam, encodeParam, filterAtom, makeFilter } from '../src/explorer/url-state.ts'

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

test('the decoders reject malformed text and accept well-formed text', () => {
  const whole = decodeParam(WholeNumber)
  for (const bad of ['', 'abc', '-1', '1.5', '1e3', ' 7', '7 ', '0x10', '99999999999999999999999']) {
    assert.equal(Option.isNone(whole(bad)), true, `whole number should reject ${JSON.stringify(bad)}`)
  }
  assert.deepEqual(whole('8478402'), Option.some(8478402))
  assert.equal(Option.isNone(decodeParam(Competition)('hockey')), true)
  assert.equal(Option.isNone(decodeParam(Partners)('yes')), true)
  assert.deepEqual(decodeParam(Partners)('off'), Option.some('off'))
})

test('encoding returns the text the URL carries', () => {
  assert.deepEqual(Option.flatMap(decodeParam(WholeNumber)('007'), encodeParam(WholeNumber)), Option.some('7'))
})
