import { animationsCSS } from '@tamagui/config/animations-css'
import { defaultConfig } from '@tamagui/config/v6'
import { createFont, createTamagui } from 'tamagui'

const fontSizes = { ...defaultConfig.fonts.body.size, 13: 13, 14: 14, 16: 16, 17: 17, 18: 18, 19: 19, 20: 20, 21: 21, 22: 22, 23: 23, 24: 24, 25: 25, 26: 26, 27: 27, 28: 28, 29: 29, 31: 31, 32: 32, 34: 34, 36: 36, 39: 39, 40: 40, 48: 48, 62: 62, 72: 72 }
const bodyFont = createFont({
  ...defaultConfig.fonts.body,
  family: '"Roboto Condensed", sans-serif',
  size: fontSizes,
  lineHeight: fontSizes,
})

const dark = {
  ...defaultConfig.themes.dark,
  background: '#000000', color: '#d5d5d5', foreground: '#d5d5d5',
  muted: '#858585', gold: '#a08d5c',
  win: 'color(display-p3 0.316 0.625 0.258)',
  loss: 'color(display-p3 0.66 0.12 0.19)',
  pending: '#303030', rule: '#292929', surface: '#151515',
  highlight: '#4e1016', brand: 'color(display-p3 0.739 0.175 0.184)',
  bright: '#eeeeee', 'result-ink': '#070707', 'loss-ink': '#cecece',
  'chart-win': 'color(display-p3 0.374 0.737 0.306)',
  'chart-loss': 'color(display-p3 0.718 0.168 0.206)',
  'chart-positive': '#294c20', 'chart-negative': '#4e1820', 'chart-line': '#eeeeee',
}
const light = {
  ...defaultConfig.themes.light,
  background: '#ffffff', color: '#252525', foreground: '#252525',
  muted: '#626262', gold: '#756331', win: '#408638', loss: '#b32238',
  pending: '#d2d2d2', rule: '#d6d6d6', surface: '#f1f1f1',
  highlight: '#f8dce0', brand: '#b52c35', bright: '#161616',
  'result-ink': '#ffffff', 'loss-ink': '#ffffff',
  'chart-win': '#408638', 'chart-loss': '#b32238',
  'chart-positive': '#d5e8cf', 'chart-negative': '#f4d2d8', 'chart-line': '#252525',
}

export const config = createTamagui({
  ...defaultConfig,
  themes: { ...defaultConfig.themes, dark, light },
  fonts: {
    ...defaultConfig.fonts,
    body: bodyFont,
    heading: bodyFont,
    score: createFont({ ...bodyFont, family: 'Graduate, monospace' }),
    result: createFont({ ...bodyFont, family: 'Georgia, serif' }),
  },
  animations: animationsCSS,
  settings: { ...defaultConfig.settings, disableSSR: true },
})

type AppConfig = typeof config

declare module 'tamagui' {
  interface TamaguiCustomConfig extends AppConfig {}
}

export default config
