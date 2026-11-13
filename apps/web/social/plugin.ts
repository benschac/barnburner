import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Resvg } from '@resvg/resvg-js'
import { Schema } from 'effect'
import { TeamData, teams } from '@nhl-reddit-stats/season'
import type { Plugin, ResolvedConfig } from 'vite'
import season from '../../../data/nhl-20262027.json' with { type: 'json' }
import poster from '../../../data/nhl-poster-20262027.json' with { type: 'json' }
import { teamPoster } from '../src/stats.ts'
import type { TeamPosterData } from '../src/stats.ts'
import { teamFromPath, teamHref, teamLogo } from '../src/team-season.ts'
import { renderSocialCard, socialImageSize } from './card.ts'

const webRoot = fileURLToPath(new URL('../', import.meta.url))
const snapshots = Schema.decodeUnknownSync(TeamData)({ season, poster })
const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character] ?? character)

export function siteOrigin(env: NodeJS.ProcessEnv) {
  const host = env.SITE_URL ?? (env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${env.VERCEL_PROJECT_PRODUCTION_URL}` : undefined)
    ?? (env.VERCEL_URL ? `https://${env.VERCEL_URL}` : 'http://localhost:5173')
  const url = new URL(host)
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
    throw new Error('SITE_URL must be an HTTP(S) origin, such as https://example.com')
  }
  return url.origin
}

export function socialDescription(data: TeamPosterData) {
  const summary = data.seasonSummary
  return `${summary.record} · ${summary.points} points · ${summary.divisionPlace} in the ${data.team.division} · ${summary.streak}. Last 10: ${summary.lastTen}. Through ${data.snapshotDate}.`
}

export function socialImageOrigin(env: NodeJS.ProcessEnv) {
  return env.VERCEL_ENV === 'preview' && env.VERCEL_URL
    ? siteOrigin({ VERCEL_URL: env.VERCEL_URL }) : siteOrigin(env)
}

export function socialHtml({ html, data, origin, imageOrigin = origin, path, imagePath }: {
  html: string; data: TeamPosterData; origin: string; imageOrigin?: string; path: string; imagePath: string
}) {
  const title = `${data.team.name} | ${data.seasonSummary.record} | RinkSide`
  const description = socialDescription(data)
  const image = new URL(imagePath, imageOrigin).href
  const imageAlt = `${data.team.name} season at a glance. ${description}`
  const metadata = [
    ['og:type', 'website'], ['og:site_name', 'RinkSide'], ['og:title', title], ['og:description', description],
    ['og:url', new URL(path, origin).href], ['og:image', image], ['og:image:type', 'image/png'],
    ['og:image:width', String(socialImageSize.width)], ['og:image:height', String(socialImageSize.height)], ['og:image:alt', imageAlt],
  ].map(([property, content]) => `<meta property="${property}" content="${escapeHtml(content)}" />`).join('\n    ')
  const twitter = [['twitter:card', 'summary_large_image'], ['twitter:title', title], ['twitter:description', description],
    ['twitter:image', image], ['twitter:image:alt', imageAlt]]
    .map(([name, content]) => `<meta name="${name}" content="${escapeHtml(content)}" />`).join('\n    ')
  return html.replace(/<title>[^]*?<\/title>/, `<title>${escapeHtml(title)}</title>`)
    .replace(/<meta name="description" content="[^"]*"\s*\/>/, `<meta name="description" content="${escapeHtml(description)}" />`)
    .replace('</head>', `    ${metadata}\n    ${twitter}\n    <link rel="canonical" href="${escapeHtml(new URL(path, origin).href)}" />\n  </head>`)
}

export async function createSocialPreviews() {
  return Promise.all(teams.map(async ({ abbrev }) => {
    const data = teamPoster(snapshots, abbrev)
    const logo = await readFile(resolve(webRoot, `public${teamLogo(abbrev, 'dark')}`), 'utf8')
    const png = new Resvg(renderSocialCard(data, logo), {
      font: {
        fontFiles: [resolve(webRoot, 'public/assets/fonts/graduate.ttf'), resolve(webRoot, 'public/assets/fonts/roboto-condensed.ttf')],
        loadSystemFonts: false,
        defaultFontFamily: 'Roboto Condensed',
      },
    }).render().asPng()
    const hash = createHash('sha256').update(png).digest('hex').slice(0, 16)
    return { data, png, imagePath: `/og/${abbrev}-${hash}.png` }
  }))
}

export function socialPreviews(): Plugin {
  let config: ResolvedConfig
  let previews: ReturnType<typeof createSocialPreviews> | undefined
  const load = () => previews ??= createSocialPreviews()
  return {
    name: 'rinkside-social-previews',
    configResolved(resolved) { config = resolved },
    configureServer(server) {
      server.middlewares.use('/og/', (request, response, next) => {
        if (!['GET', 'HEAD'].includes(request.method ?? '')) return next()
        void load().then((images) => {
          const image = images.find((entry) => entry.imagePath === `/og${request.url?.split('?')[0]}`)
          if (!image) { response.statusCode = 404; response.end(); return }
          response.setHeader('Content-Type', 'image/png')
          response.end(request.method === 'HEAD' ? undefined : image.png)
        }).catch(next)
      })
    },
    transformIndexHtml: {
      order: 'post',
      async handler(html, context) {
        if (!context.server) return html
        const team = teamFromPath((context.originalUrl ?? context.path).split('?')[0]) ?? 'NJD'
        const preview = (await load()).find(({ data }) => data.team.abbrev === team)
        if (!preview) throw new Error(`Missing social preview for ${team}`)
        return socialHtml({ html, ...preview, path: teamHref(team), origin: context.server.resolvedUrls?.local[0] ?? siteOrigin(process.env) })
      },
    },
    async writeBundle() {
      const directory = resolve(config.root, config.build.outDir)
      const html = await readFile(resolve(directory, 'index.html'), 'utf8')
      const origin = siteOrigin(process.env)
      const imageOrigin = socialImageOrigin(process.env)
      await mkdir(resolve(directory, 'team'), { recursive: true })
      await mkdir(resolve(directory, 'og'), { recursive: true })
      for (const preview of await load()) {
        const team = preview.data.team.abbrev
        await writeFile(resolve(directory, `.${preview.imagePath}`), preview.png)
        await writeFile(resolve(directory, `team/${team}.html`), socialHtml({ html, ...preview, origin, imageOrigin, path: teamHref(team) }))
        if (team === 'NJD') await writeFile(resolve(directory, 'index.html'), socialHtml({ html, ...preview, origin, imageOrigin, path: '/' }))
      }
    },
  }
}
