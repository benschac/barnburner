import assert from 'node:assert/strict'
import { test } from 'node:test'
import { Schema } from 'effect'
import { VizTheme } from '@nhl-reddit-stats/viz'
import contract from '../design/contract.json' with { type: 'json' }
import { cssVariables, g2Theme, g6Theme, teamColor, vizTheme } from '../src/viz/theme.ts'
import { themeVariables } from '../src/viz/frame/frame.ts'

// Each VizTheme field and the contract key it reads (the chart colours of contract.json themes).
const fieldKeys = {
  background: 'background', color: 'color', muted: 'muted', gold: 'gold', win: 'win', loss: 'loss',
  pending: 'pending', rule: 'rule', surface: 'surface', highlight: 'highlight', brand: 'brand', bright: 'bright',
  chartWin: 'chart-win', chartLoss: 'chart-loss', chartPositive: 'chart-positive',
  chartNegative: 'chart-negative', chartLine: 'chart-line',
} as const

const fonts = { 'font-body': 'Body Family', 'font-score': 'Score Family' }

function valuesFor(mode: 'light' | 'dark') {
  return { ...contract.themes[mode], ...fonts }
}

for (const mode of ['light', 'dark'] as const) {
  test(`sandbox CSS preserves the ${mode} host theme values`, () => {
    const theme = vizTheme(valuesFor(mode), mode)
    const variables = Object.fromEntries(themeVariables(theme))
    for (const key of Object.values(fieldKeys)) {
      assert.equal(variables[`--viz-${key}`], contract.themes[mode][key])
    }
    theme.series.forEach((colour, index) => assert.equal(variables[`--viz-series-${index}`], colour))
    assert.equal(variables['--viz-font-body'], fonts['font-body'])
    assert.equal(variables['--viz-font-score'], fonts['font-score'])
    assert.equal(variables['color-scheme'], mode)
    assert.equal(Object.keys(variables).length, 27)
  })

  test(`every VizTheme field is filled from the ${mode} contract theme`, () => {
    const theme = vizTheme(valuesFor(mode), mode)
    assert.equal(theme.mode, mode)
    for (const [field, key] of Object.entries(fieldKeys)) {
      assert.equal(theme[field as keyof typeof fieldKeys], contract.themes[mode][key as keyof typeof contract.themes.light], field)
    }
    assert.deepEqual(theme.fonts, { body: 'Body Family', score: 'Score Family' })
    Schema.decodeUnknownSync(VizTheme)(theme)
  })
}

test('series is the fixed order of section C-viz', () => {
  const theme = vizTheme(valuesFor('light'), 'light')
  const t = contract.themes.light
  assert.deepEqual(theme.series, [t['chart-positive'], t['chart-negative'], t.gold, t.brand, t['chart-win'], t['chart-loss'], t.muted])
})

test('a missing contract value is a defect, not a silent blank', () => {
  const { gold: _gold, ...rest } = valuesFor('light') as Record<string, string>
  assert.throws(() => vizTheme(rest, 'light'), /defect: .*gold/)
})

test('a club with a palette takes team-primary; another club takes the series colour at its index', () => {
  const theme = vizTheme(valuesFor('dark'), 'dark')
  assert.equal(teamColor('BOS', theme, 0), contract.teamPalettes.BOS['team-primary'])
  assert.equal(teamColor('NJD', theme, 5), contract.teamPalettes.NJD['team-primary'])
  assert.equal(teamColor('ZZZ', theme, 2), theme.series[2])
  assert.equal(teamColor('ZZZ', theme, 9), theme.series[9 % theme.series.length])
  assert.equal(teamColor('constructor', theme, 0), theme.series[0])
})

test('G2 category10 and category20 come only from theme.series', () => {
  const theme = vizTheme(valuesFor('dark'), 'dark')
  const g2 = g2Theme(theme)
  assert.deepEqual(g2.category10, theme.series)
  assert.equal(g2.category20.length, 20)
  for (const [index, colour] of g2.category20.entries()) assert.equal(colour, theme.series[index % theme.series.length])
  assert.ok(g2.category20.every((colour) => theme.series.includes(colour)))
})

function stringsIn(value: unknown): string[] {
  if (typeof value === 'string') return [value]
  if (Array.isArray(value)) return value.flatMap(stringsIn)
  if (value && typeof value === 'object') return Object.values(value).flatMap(stringsIn)
  return []
}

function at(value: unknown, path: readonly string[]): unknown {
  return path.reduce<unknown>((node, key) => (node as Record<string, unknown> | undefined)?.[key], value)
}

// Every G2 text fill this theme sets, with the opacity key that must be 1 beside it.
const g2TextFills: [path: string[], opacity: string][] = [
  [['label', 'fill'], 'fillOpacity'],
  [['text', 'text', 'fill'], 'fillOpacity'],
  [['text', 'badge', 'fill'], 'fillOpacity'],
  [['innerLabel', 'fill'], 'fillOpacity'],
  [['htmlLabel', 'color'], 'opacity'],
  [['title', 'titleFill'], 'titleFillOpacity'],
  [['title', 'subtitleFill'], 'subtitleFillOpacity'],
  [['legendCategory', 'itemLabelFill'], 'itemLabelFillOpacity'],
  [['legendCategory', 'itemValueFill'], 'itemValueFillOpacity'],
  [['legendCategory', 'titleFill'], 'titleFillOpacity'],
  [['legendCategory', 'navButtonFill'], 'navButtonFillOpacity'],
  [['legendCategory', 'navPageNumFill'], 'navPageNumFillOpacity'],
  [['legendContinuous', 'labelFill'], 'labelFillOpacity'],
  [['legendContinuous', 'handleLabelFill'], 'handleLabelFillOpacity'],
  [['legendContinuous', 'titleFill'], 'titleFillOpacity'],
]
for (const axis of ['axis', 'axisTop', 'axisBottom', 'axisLeft', 'axisRight', 'axisLinear', 'axisArc', 'axisRadar']) {
  g2TextFills.push([[axis, 'labelFill'], 'labelOpacity'], [[axis, 'titleFill'], 'titleOpacity'])
}
const g6TextFills: [path: string[], opacity: string][] = [
  [['node', 'style', 'labelFill'], 'labelFillOpacity'],
  [['edge', 'style', 'labelFill'], 'labelOpacity'],
]

for (const mode of ['light', 'dark'] as const) {
  test(`every G2 and G6 text fill is theme.color at opacity 1 in the ${mode} theme`, () => {
    const theme = vizTheme(valuesFor(mode), mode)
    const g2 = g2Theme(theme)
    const g6 = g6Theme(theme)
    const muted = [
      ...g2TextFills.filter(([path]) => at(g2, path) === theme.muted).map(([path]) => path.join('.')),
      ...g6TextFills.filter(([path]) => at(g6, path) === theme.muted).map(([path]) => path.join('.')),
    ]
    // Only the subtitle may be quiet. Its opacity is still 1.
    assert.deepEqual(muted, ['title.subtitleFill'])
    for (const [path, opacity] of g2TextFills) {
      const expected = path.join('.') === 'title.subtitleFill' ? theme.muted : theme.color
      assert.equal(at(g2, path), expected, path.join('.'))
      assert.equal(at(g2, [...path.slice(0, -1), opacity]), 1, `${path.join('.')} opacity`)
    }
    for (const [path, opacity] of g6TextFills) {
      assert.equal(at(g6, path), theme.color, path.join('.'))
      assert.equal(at(g6, [...path.slice(0, -1), opacity]), 1, `${path.join('.')} opacity`)
    }
  })
}

for (const mode of ['light', 'dark'] as const) {
  test(`G2 and G6 ${mode} themes use only VizTheme values and fonts, and G2 line and tick colours use rule`, () => {
    const theme = vizTheme(valuesFor(mode), mode)
    const allowed = new Set(stringsIn(theme))
    for (const value of stringsIn([g2Theme(theme), g6Theme(theme)])) assert.ok(allowed.has(value), value)
    const g2 = g2Theme(theme)
    assert.equal(g2.color, theme.series[0])
    assert.equal(g2.axisBottom.gridStroke, theme.rule)
    assert.equal(g2.axisLeft.tickStroke, theme.rule)
    assert.equal(g2.lineX.line.stroke, theme.rule)
  })
}

test('CSS variables, G2 and G6 themes are derived from the same values', () => {
  const theme = vizTheme(valuesFor('light'), 'light')
  const vars = cssVariables(theme)
  assert.equal(vars['--viz-chart-win'], contract.themes.light['chart-win'])
  assert.equal(vars['--viz-series-0'], theme.series[0])
  assert.equal(vars['--viz-font-score'], 'Score Family')
  const g2 = g2Theme(theme)
  assert.equal(g2.type, 'light')
  assert.equal(g2.view.viewFill, contract.themes.light.background)
  const g6 = g6Theme(theme)
  assert.equal(g6.background, contract.themes.light.background)
  assert.equal(g6.node.style.fill, contract.themes.light.surface)
})
