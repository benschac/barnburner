import { readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Resvg } from '@resvg/resvg-js'
import { Schema } from 'effect'
import { TeamData, teams } from '@nhl-reddit-stats/season'
import season from '../../../../../data/nhl-20262027.json' with { type: 'json' }
import poster from '../../../../../data/nhl-poster-20262027.json' with { type: 'json' }
import { renderSocialCard } from '../../../social/card.ts'
import { teamPoster } from '../../../src/stats.ts'
import { teamLogo } from '../../../src/team-season.ts'

export const runtime = 'nodejs'
export const dynamic = 'force-static'
export const dynamicParams = false

// apps/web, found from this module's own location so the working directory does not matter.
const webRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')
const snapshots = Schema.decodeUnknownSync(TeamData)({ season, poster })

async function render(abbrev: string) {
  const logo = await readFile(resolve(webRoot, `public${teamLogo(abbrev, 'dark')}`), 'utf8')
  return new Resvg(renderSocialCard(teamPoster(snapshots, abbrev), logo), {
    font: {
      fontFiles: [resolve(webRoot, 'public/assets/fonts/graduate.ttf'), resolve(webRoot, 'public/assets/fonts/roboto-condensed.ttf')],
      loadSystemFonts: false,
      defaultFontFamily: 'Roboto Condensed',
    },
  }).render().asPng()
}

export function generateStaticParams() {
  return teams.map(({ abbrev }) => ({ image: `${abbrev}.png` }))
}

export async function GET(_request: Request, { params }: { params: Promise<{ image: string }> }) {
  const { image } = await params
  const team = teams.find(({ abbrev }) => `${abbrev}.png` === image)
  if (!team) return new Response('Not found', { status: 404 })
  return new Response(new Uint8Array(await render(team.abbrev)), {
    headers: { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=300, must-revalidate' },
  })
}
