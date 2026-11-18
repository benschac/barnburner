import assert from 'node:assert/strict'
import { test } from 'node:test'
import { Schema } from 'effect'
import { TeamData, teams } from '@nhl-reddit-stats/season'
import season from '../../../data/nhl-20262027.json' with { type: 'json' }
import poster from '../../../data/nhl-poster-20262027.json' with { type: 'json' }
import { cardVersion, siteOrigin, socialImageOrigin, teamMetadata } from '../social/metadata.ts'
import { teamPoster } from '../src/stats.ts'

const snapshots = Schema.decodeUnknownSync(TeamData)({ season, poster })

test('every team has title, description, canonical, Open Graph and Twitter metadata', () => {
  assert.equal(teams.length, 32)
  for (const { abbrev } of teams) {
    const data = teamPoster(snapshots, abbrev)
    const path = `/team/${abbrev}`
    const version = cardVersion(data)
    const meta = teamMetadata(data, 'https://hockey.example', { path, imagePath: `/og/${abbrev}.png`, version })
    assert.equal(meta.title, `${data.team.name} | ${data.seasonSummary.record} | RinkSide`)
    assert.ok(meta.description.includes(`${data.seasonSummary.points} points`))
    assert.ok(meta.description.includes(data.seasonSummary.record))
    assert.equal(meta.alternates.canonical, `https://hockey.example${path}`)
    assert.equal(meta.openGraph.url, `https://hockey.example${path}`)
    assert.equal(meta.openGraph.images[0].url, `https://hockey.example/og/${abbrev}.png?v=${version}`)
    assert.equal(meta.openGraph.images[0].width, 1200)
    assert.equal(meta.openGraph.images[0].height, 630)
    assert.equal(meta.twitter.card, 'summary_large_image')
    assert.equal(meta.twitter.images[0].url, meta.openGraph.images[0].url)
  }
})

test('the home page keeps / as its URL, and the image version tracks the card data', () => {
  const data = teamPoster(snapshots, 'NJD')
  const home = teamMetadata(data, 'https://hockey.example', { path: '/', imagePath: '/og/NJD.png' })
  assert.equal(home.alternates.canonical, 'https://hockey.example/')
  assert.equal(home.openGraph.url, 'https://hockey.example/')
  assert.equal(home.openGraph.images[0].url, 'https://hockey.example/og/NJD.png')
  const changed = { ...data, seasonSummary: { ...data.seasonSummary, points: data.seasonSummary.points + 1 } }
  assert.notEqual(cardVersion(changed), cardVersion(data))
  assert.equal(cardVersion(data), cardVersion(teamPoster(snapshots, 'NJD')))
  const preview = teamMetadata(data, 'https://production.example', { path: '/team/ANA', imagePath: '/og/ANA.png', imageOrigin: 'https://preview.example', version: 'abc' })
  assert.equal(preview.openGraph.url, 'https://production.example/team/ANA')
  assert.equal(preview.openGraph.images[0].url, 'https://preview.example/og/ANA.png?v=abc')
})

test('origins use explicit site configuration, then Vercel production and deployment hosts', () => {
  assert.equal(siteOrigin({ SITE_URL: 'https://hockey.example/', VERCEL_PROJECT_PRODUCTION_URL: 'production.example' }), 'https://hockey.example')
  assert.equal(siteOrigin({ VERCEL_URL: 'preview.example' }), 'https://preview.example')
  assert.equal(siteOrigin({}), 'http://localhost:5173')
  assert.equal(socialImageOrigin({ SITE_URL: 'https://custom.example', VERCEL_ENV: 'preview', VERCEL_URL: 'preview.example' }), 'https://preview.example')
  assert.throws(() => siteOrigin({ SITE_URL: 'https://example.com/path' }))
})
