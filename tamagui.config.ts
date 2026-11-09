import { animationsCSS } from '@tamagui/config/animations-css'
import { defaultConfig } from '@tamagui/config/v6'
import { createTamagui } from 'tamagui'

export const config = createTamagui({
  ...defaultConfig,
  animations: animationsCSS,
  settings: {
    ...defaultConfig.settings,
    disableSSR: true,
  },
})

type AppConfig = typeof config

declare module 'tamagui' {
  interface TamaguiCustomConfig extends AppConfig {}
}

export default config
