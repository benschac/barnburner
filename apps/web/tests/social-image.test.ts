import assert from 'node:assert/strict'
import { test } from 'node:test'
import { teams } from '@nhl-reddit-stats/season'
import { GET, generateStaticParams } from '../app/og/[image]/route.ts'
import { socialImageSize } from '../social/card.ts'

test('the image route is generated once per team and serves a PNG of the social image size', async () => {
  const params = generateStaticParams()
  assert.equal(params.length, 32)
  assert.deepEqual(params.map(({ image }) => image).sort(), teams.map(({ abbrev }) => `${abbrev}.png`).sort())
  for (const { image } of params) {
    const response = await GET(new Request(`https://hockey.example/og/${image}`), { params: Promise.resolve({ image }) })
    assert.equal(response.status, 200)
    assert.equal(response.headers.get('content-type'), 'image/png')
    const png = Buffer.from(await response.arrayBuffer())
    assert.deepEqual([...png.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10])
    assert.equal(png.readUInt32BE(16), socialImageSize.width, image)
    assert.equal(png.readUInt32BE(20), socialImageSize.height, image)
  }
})

test('an unknown team has no image', async () => {
  const response = await GET(new Request('https://hockey.example/og/XXX.png'), { params: Promise.resolve({ image: 'XXX.png' }) })
  assert.equal(response.status, 404)
})
