import { Record, String as Str } from 'effect'
import type { VizTheme } from '@nhl-reddit-stats/viz'

/** The VizTheme fields that are colours. Each one reads the contract key of the same name, kebab-cased. */
export type ColourField = Exclude<keyof VizTheme, 'mode' | 'series' | 'fonts'>
const colourSet: Record<ColourField, true> = {
  background: true, color: true, muted: true, gold: true, win: true, loss: true, pending: true, rule: true,
  surface: true, highlight: true, brand: true, bright: true, chartWin: true, chartLoss: true,
  chartPositive: true, chartNegative: true, chartLine: true,
}
export const colourFields = Record.keys(colourSet)

// useVizTheme resolves Tamagui tokens in the host. The sandbox is a separate document,
// so it receives those values as VizTheme and applies this projection without loading Tamagui.
export const cssVariables = (theme: VizTheme): Record<string, string> => Object.fromEntries([
  ...colourFields.map((name) => [`--viz-${Str.kebabCase(name)}`, theme[name]] as const),
  ...theme.series.map((colour, index) => [`--viz-series-${index}`, colour] as const),
  ['--viz-font-body', theme.fonts.body],
  ['--viz-font-score', theme.fonts.score],
])
