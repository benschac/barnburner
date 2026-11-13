import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import { createHash } from 'node:crypto'
import { createSocialPreviews, siteOrigin, socialHtml, socialImageOrigin } from '../social/plugin.ts'

const template = await readFile(new URL('../index.html', import.meta.url), 'utf8')

test('every team has crawler-visible metadata and a self-contained, fingerprinted PNG', async () => {
  const previews = await createSocialPreviews()
  assert.equal(previews.length, 32)
  for (const { data, png, imagePath } of previews) {
    const path = `/team/${data.team.abbrev}`
    const html = socialHtml({ html: template, data, origin: 'https://hockey.example', path, imagePath })
    assert.ok(html.includes(`<meta property="og:url" content="https://hockey.example${path}"`))
    assert.ok(html.includes(`<meta property="og:image" content="https://hockey.example${imagePath}"`))
    assert.ok(html.includes('<meta name="twitter:card" content="summary_large_image"'))
    assert.ok(html.includes(data.team.name))
    assert.ok(html.includes(`${data.seasonSummary.points} points`))
    assert.ok(html.includes(data.seasonSummary.record))
    assert.equal(html.match(/<title>/g)?.length, 1)
    assert.equal(html.match(/name="description"/g)?.length, 1)
    assert.ok(html.includes('src="/src/main.tsx"'), 'The application shell is retained')
    assert.equal(png.readUInt32BE(16), 1200)
    assert.equal(png.readUInt32BE(20), 630)
    assert.equal(imagePath, `/og/${data.team.abbrev}-${createHash('sha256').update(png).digest('hex').slice(0, 16)}.png`)
  }
  assert.equal(new Set(previews.map(({ imagePath }) => imagePath)).size, 32)
  const sample = previews[0]
  const hostile = { ...sample.data, team: { ...sample.data.team, name: 'Team "A" <script>&' } }
  const html = socialHtml({ html: template, data: hostile, origin: 'https://hockey.example', path: '/', imagePath: sample.imagePath })
  assert.ok(html.includes('Team &quot;A&quot; &lt;script&gt;&amp;'))
  assert.ok(!html.includes('<script>&'))
  const previewHtml = socialHtml({ html: template, ...sample, origin: 'https://production.example', imageOrigin: 'https://preview.example', path: '/team/ANA' })
  assert.ok(previewHtml.includes('property="og:url" content="https://production.example/team/ANA"'))
  assert.ok(previewHtml.includes(`property="og:image" content="https://preview.example${sample.imagePath}"`))
})

test('preview origins use explicit site configuration, then Vercel production and deployment hosts', () => {
  assert.equal(siteOrigin({ SITE_URL: 'https://hockey.example/', VERCEL_PROJECT_PRODUCTION_URL: 'production.example' }), 'https://hockey.example')
  assert.equal(siteOrigin({ VERCEL_PROJECT_PRODUCTION_URL: 'production.example', VERCEL_URL: 'preview.example' }), 'https://production.example')
  assert.equal(siteOrigin({ VERCEL_URL: 'preview.example' }), 'https://preview.example')
  assert.equal(siteOrigin({}), 'http://localhost:5173')
  assert.equal(socialImageOrigin({ SITE_URL: 'https://custom.example', VERCEL_ENV: 'preview', VERCEL_URL: 'preview.example' }), 'https://preview.example')
  assert.equal(socialImageOrigin({ VERCEL_ENV: 'production', VERCEL_PROJECT_PRODUCTION_URL: 'production.example', VERCEL_URL: 'deployment.example' }), 'https://production.example')
  for (const SITE_URL of ['javascript:alert(1)', 'https://example.com/path', 'https://user:pass@example.com', 'https://example.com/?team=EDM']) {
    assert.throws(() => siteOrigin({ SITE_URL }))
  }
})
