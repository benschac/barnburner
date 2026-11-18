import assert from 'node:assert/strict'
import { test } from 'node:test'
import { Schema } from 'effect'
import { VizTheme } from '@nhl-reddit-stats/viz'
import { finalsSample } from '@nhl-reddit-stats/viz/samples'
import type { G2Spec } from '@antv/g2'
import { finalsGrid } from '../src/viz/specs/finals-grid.ts'

// Theme values are names, not colours: the spec must take every colour from the theme.
const theme = Schema.decodeUnknownSync(VizTheme)({
  mode: 'light',
  background: 'theme-background',
  color: 'theme-color',
  muted: 'theme-muted',
  gold: 'theme-gold',
  win: 'theme-win',
  loss: 'theme-loss',
  pending: 'theme-pending',
  rule: 'theme-rule',
  surface: 'theme-surface',
  highlight: 'theme-highlight',
  brand: 'theme-brand',
  bright: 'theme-bright',
  chartWin: 'theme-chart-win',
  chartLoss: 'theme-chart-loss',
  chartPositive: 'theme-chart-positive',
  chartNegative: 'theme-chart-negative',
  chartLine: 'theme-chart-line',
  series: ['theme-chart-positive', 'theme-chart-negative', 'theme-gold', 'theme-brand', 'theme-chart-win', 'theme-chart-loss', 'theme-muted'],
  fonts: { body: 'theme-body', score: 'theme-score' },
})

test('finals grid has one cell per Final year on the sample, filled from the theme', () => {
  const spec = finalsGrid(finalsSample.tables, theme)
  const asG2: G2Spec = spec
  assert.equal(asG2.type, 'cell')
  assert.deepEqual(spec.scale?.x?.domain, ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'])
  assert.equal(spec.type, 'cell')
  assert.equal(spec.data.length, finalsSample.tables.finals.length)
  assert.deepEqual(spec.encode, { x: 'x', y: 'y', color: 'status' })
  assert.deepEqual(spec.scale.color.range, [theme.win, theme.rule])
  assert.deepEqual(spec.scale.color.domain, ['hit', 'miss'])
  const [cell] = spec.data
  assert.equal(cell?.year, 1952)
  assert.equal(cell?.status, 'hit')
  assert.equal(cell?.x, '0')
  assert.equal(cell?.y, '0')
})

test('finals grid tooltip names the matched teammate on the sample', () => {
  const spec = finalsGrid(finalsSample.tables, theme)
  const [cell] = spec.data
  assert.ok(cell)
  assert.equal(spec.tooltip.title(cell), '1952')
  assert.deepEqual(spec.tooltip.items[0]?.(cell), { name: 'Teammate', value: 'Player Fourteen' })
})

test('finals grid fills misses with the rule colour and wraps after ten cells', () => {
  const misses = Array.from({ length: 11 }, (_, index) => ({
    year: 1900 + index,
    seasonId: 19001901,
    covered: 0 as const,
    playerId: null,
    finalGameId: null,
    sharedGameId: null,
  }))
  const spec = finalsGrid({ finals: misses, players: [] }, theme)
  assert.equal(spec.data.every((cell) => cell.status === 'miss'), true)
  assert.equal(spec.data[9]?.x, '9')
  assert.equal(spec.data[9]?.y, '0')
  assert.equal(spec.data[10]?.x, '0')
  assert.equal(spec.data[10]?.y, '1')
  assert.equal(spec.data[10]?.player, 'No teammate played in this Final')
})
