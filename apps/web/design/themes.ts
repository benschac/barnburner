import { defaultConfig } from '@tamagui/config/v6'
import contract from './contract.json'

export const dark = { ...defaultConfig.themes.dark, ...contract.themes.dark }
export const light = { ...defaultConfig.themes.light, ...contract.themes.light }


type TeamCode = keyof typeof contract.teamPalettes
type TeamBannerTheme = typeof contract.teamPalettes[TeamCode]
export type TeamBannerThemeName = `team-${TeamCode}`
export const teamBannerThemes = Object.fromEntries(
  Object.entries(contract.teamPalettes).flatMap(([team, palette]) => [
    [`dark_team-${team}`, palette],
    [`light_team-${team}`, palette],
  ]),
) as Record<`dark_${TeamBannerThemeName}` | `light_${TeamBannerThemeName}`, TeamBannerTheme>

export function teamBannerThemeName(team: string): TeamBannerThemeName {
  if (!Object.hasOwn(contract.teamPalettes, team)) throw new Error(`Missing team palette: ${team}`)
  return `team-${team}` as TeamBannerThemeName
}
