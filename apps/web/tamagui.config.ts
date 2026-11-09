import { animationsCSS } from '@tamagui/config/animations-css'
import { defaultConfig } from '@tamagui/config/v6'
import { createFont, createTamagui } from 'tamagui'

import contract from './design/contract.json'
import { dark, light, teamBannerThemes } from './design/themes'

const bodyFont = createFont({
  ...defaultConfig.fonts.body,
  family: '"Roboto Condensed", sans-serif',
  size: contract.fontSize,
  lineHeight: contract.lineHeight,
})

export const config = createTamagui({
  ...defaultConfig,
  tokens: { ...defaultConfig.tokens, width: { ...defaultConfig.tokens.width, ...contract.size }, minWidth: { ...defaultConfig.tokens.minWidth, ...contract.size }, maxWidth: { ...defaultConfig.tokens.maxWidth, ...contract.size }, space: { ...defaultConfig.tokens.space, ...contract.space }, size: { ...defaultConfig.tokens.size, ...contract.size }, radius: { ...defaultConfig.tokens.radius, ...contract.radius } },
  themes: { ...defaultConfig.themes, dark, light, ...teamBannerThemes },
  // Tamagui's mediaObjectToString supports raw queries; its public config type omits them.
  media: { ...defaultConfig.media, poster: { minWidth: 1206 }, print: 'print' as unknown as Record<string, string> },
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
