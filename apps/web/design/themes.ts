import { defaultConfig } from '@tamagui/config/v6'
import contract from './contract.json'

export const dark = { ...defaultConfig.themes.dark, ...contract.themes.dark }
export const light = { ...defaultConfig.themes.light, ...contract.themes.light }
