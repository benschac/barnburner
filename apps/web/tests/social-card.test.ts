import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { Resvg } from '@resvg/resvg-js'
import { Schema } from 'effect'
import { TeamData, teams } from '@nhl-reddit-stats/season'
import season from '../../../data/nhl-20262027.json' with { type: 'json' }
import poster from '../../../data/nhl-poster-20262027.json' with { type: 'json' }
import { renderSocialCard, socialImageSize } from '../social/card.ts'
import { teamPoster } from '../src/stats.ts'
import type { TeamPosterData } from '../src/stats.ts'

const source = Schema.decodeUnknownSync(TeamData)({ season, poster })
const logo = readFileSync(new URL('../public/assets/teams/EDM.svg', import.meta.url), 'utf8')

test('social cards render the selected team and real supplemental data into a 1200 by 630 PNG', () => {
  const data: TeamPosterData = {
    ...teamPoster(source, 'EDM'),
    specialTeams: [{ label: 'POWER PLAY', value: '24.5', rank: '7th' }],
    leaders: [{ label: 'POINTS', name: 'Example Player', value: '49', detail: '11 goals, 38 assists', portrait: '' }],
  }
  const svg = renderSocialCard(data, logo)
  assert.ok(svg.includes('Edmonton Oilers'))
  assert.ok(svg.includes(data.seasonSummary.record.split('-').map((part) => part.padStart(2, '0')).join('-')))
  assert.ok(svg.includes(`${data.seasonSummary.points} points`))
  assert.ok(svg.includes('Example Player'))
  assert.ok(svg.includes('49 PTS'))
  assert.ok(svg.includes('24.5%'))
  assert.ok(svg.includes('7th IN THE NHL'))
  assert.ok(svg.includes('data:image/svg+xml;base64,'))
  assert.ok(!svg.includes('https://'))
  const image = new Resvg(svg, { font: {
    loadSystemFonts: false,
    fontFiles: ['roboto-condensed.ttf', 'graduate.ttf'].map((name) => fileURLToPath(new URL(`../public/assets/fonts/${name}`, import.meta.url))),
  } }).render()
  assert.equal(image.width, socialImageSize.width)
  assert.equal(image.height, socialImageSize.height)
  assert.deepEqual([...image.asPng().subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10])
})

test('every team card uses its own record, points, and division', () => {
  for (const team of teams) {
    const data = teamPoster(source, team.abbrev)
    const svg = renderSocialCard(data, logo)
    assert.ok(svg.includes(team.name), team.abbrev)
    assert.ok(svg.includes(`${data.seasonSummary.points} points · ${data.seasonSummary.divisionPlace} in the ${team.division}`), team.abbrev)
  }
})

test('social card XML escapes names and shows unavailable supplemental stats honestly', () => {
  const data = teamPoster(source, 'EDM')
  const svg = renderSocialCard({
    ...data,
    team: { ...data.team, name: '<Oilers & "friends">' },
    leaders: [],
    specialTeams: [],
    seasonSummary: { ...data.seasonSummary, record: '0-0-0', points: 0, lastTen: '0-0-0', streak: 'no final games yet' },
  }, logo)
  assert.ok(svg.includes('&lt;Oilers &amp; &quot;friends&quot;&gt;'))
  assert.ok(!svg.includes('<Oilers'))
  assert.ok(svg.includes('00-00-00'))
  assert.equal(svg.match(/NOT AVAILABLE/g)?.length, 3)
  assert.ok(!svg.includes('undefined'))
  assert.ok(!svg.includes('NaN'))
})
