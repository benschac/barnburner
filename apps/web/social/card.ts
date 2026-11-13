import { Buffer } from 'node:buffer'
import contract from '../design/contract.json' with { type: 'json' }
import type { TeamPosterData } from '../src/stats.ts'

export const socialImageSize = { width: 1200, height: 630 }

const escapeXml = (value: string | number) => String(value)
  .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;').replaceAll("'", '&apos;')

export function renderSocialCard(data: TeamPosterData, logoSvg: string): string {
  const theme = contract.themes.light
  const palette = Object.entries(contract.teamPalettes).find(([team]) => team === data.team.abbrev)?.[1] ?? theme
  const record = data.seasonSummary.record.split('-').map((part) => part.padStart(2, '0')).join('-')
  const powerPlay = data.specialTeams.find(({ label }) => label === 'POWER PLAY')
  const penaltyKill = data.specialTeams.find(({ label }) => label === 'PENALTY KILL')
  const leader = data.leaders.find(({ label }) => label === 'POINTS')
  const metrics = [
    { x: 48, label: 'LAST 10', value: data.seasonSummary.lastTen, detail: 'WINS · LOSSES · OT/SO' },
    { x: 324, label: 'POWER PLAY', value: powerPlay ? `${powerPlay.value}%` : '—', detail: powerPlay ? `${powerPlay.rank} IN THE NHL` : 'NOT AVAILABLE' },
    { x: 600, label: 'PENALTY KILL', value: penaltyKill ? `${penaltyKill.value}%` : '—', detail: penaltyKill ? `${penaltyKill.rank} IN THE NHL` : 'NOT AVAILABLE' },
    { x: 876, label: 'POINTS LEADER', value: leader ? `${leader.value} PTS` : '—', detail: leader?.name ?? 'NOT AVAILABLE' },
  ]
  const text = (x: number, y: number, value: string | number, size: number, color = theme.color, weight = 400, family = 'Roboto Condensed') =>
    `<text x="${x}" y="${y}" font-family="${family}" font-size="${size}" font-weight="${weight}" fill="${color}">${escapeXml(value)}</text>`

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${socialImageSize.width}" height="${socialImageSize.height}" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="${theme.background}"/>
  <path d="M0 0H403L320 342H0Z" fill="${palette['team-primary']}"/>
  <path d="M419 0H435L352 342H336Z" fill="${palette['team-secondary']}"/>
  <image href="data:image/svg+xml;base64,${Buffer.from(logoSvg).toString('base64')}" x="-11" y="-9" width="380" height="360" preserveAspectRatio="xMidYMid meet"/>
  ${text(464, 57, data.team.name, 36, theme.bright, 700)}
  ${text(464, 95, 'SEASON AT A GLANCE', 22, theme.muted, 500)}
  ${text(454, 220, record, 112, theme.bright, 400, 'Graduate')}
  ${text(464, 272, `${data.seasonSummary.points} points · ${data.seasonSummary.divisionPlace} in the ${data.team.division}`, 30, theme.color, 600)}
  ${text(464, 316, data.seasonSummary.streak, 28, theme.muted)}
  <rect x="0" y="364" width="1200" height="158" fill="${theme.surface}"/>
  ${metrics.map((metric) => `${text(metric.x, 398, metric.label, 20, theme.muted, 600)}
  ${text(metric.x, 448, metric.value, 42, theme.bright, 700)}
  ${text(metric.x, 485, metric.detail, metric.label === 'POINTS LEADER' ? 26 : 19, theme.muted)}`).join('\n  ')}
  ${[300, 576, 852].map((x) => `<path d="M${x} 390V494" stroke="${theme.rule}"/>`).join('\n  ')}
  ${text(48, 563, `Through ${data.snapshotDate}`, 22, theme.color, 500)}
  ${text(48, 593, `Scores updated ${data.fetchedAt} ET · Team stats ${data.posterFetchedAt} ET`, 18, theme.muted)}
  ${text(1030, 573, 'RinkSide', 32, theme.bright, 700)}
</svg>`
}
