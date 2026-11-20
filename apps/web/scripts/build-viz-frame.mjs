import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { gzipSync } from 'node:zlib'
import { fileURLToPath } from 'node:url'
import { rolldown } from 'rolldown'
import { logError, logInfo } from '../../../lib/logger.mjs'

// The sandboxed visualization frame (plan D17) is its own bundle: it shares no code with the Next app.
// main.ts (the frame's entry, which boots frame.ts) is bundled with G2, G6, D3, and Three.js into ONE script, written inline into
// public/viz-frame/viz-frame.html. No .js file is emitted, so the frame's policy needs no 'self' for scripts:
// a meta policy allows only this script's SHA-256 and blob: modules, which stops posted view code from
// requesting any path on the app's origin (the frame cannot call our API). The response header's own
// policy still applies; a document under two policies must satisfy both.
// Bun.build is not used: its output for @antv/g2 5.4.8 fails at run time (ReferenceError: exports_src is not
// defined), with or without minify. Rolldown bundles the same entry correctly and takes no config file.
const here = (path) => fileURLToPath(new URL(path, import.meta.url))
const outdir = here('../public/viz-frame')

rmSync(outdir, { recursive: true, force: true })
mkdirSync(outdir, { recursive: true })
let code
try {
  const bundle = await rolldown({
    input: here('../src/viz/frame/main.ts'),
    platform: 'browser',
    logLevel: 'warn',
  })
  const { output } = await bundle.generate({ format: 'esm', minify: true, codeSplitting: false })
  await bundle.close()
  const chunks = output.filter((item) => item.type === 'chunk')
  if (chunks.length !== 1) throw new Error(`expected one chunk, got ${chunks.length}`)
  code = chunks[0].code
} catch (error) {
  // foreign: Rolldown reports a failed build by throwing; translate it into a log line and a failing exit.
  logError(String(error))
  process.exit(1)
}
// An inline script ends at the first closing tag or opens a comment state at '<!--'; escape both.
const script = code.replace(/<\/script/gi, '<\\/script').replace(/<!--/g, '<\\!--')
const hash = createHash('sha256').update(script).digest('base64')
const source = readFileSync(here('../src/viz/frame/viz-frame.html'), 'utf8')
const tag = '<script type="module" src="./frame.js"></script>'
if (!source.includes(tag) || !source.includes('<head>')) {
  logError('viz-frame.html no longer has the <head> and frame.js script tag the build rewrites')
  process.exit(1)
}
const policy = `<meta http-equiv="Content-Security-Policy" content="script-src 'sha256-${hash}' blob:" />`
const html = source.replace('<head>', () => `<head>\n    ${policy}`).replace(tag, () => `<script type="module">${script}</script>`)
writeFileSync(`${outdir}/viz-frame.html`, html)
const bytes = Buffer.from(html)
logInfo(`Bundled viz frame: viz-frame.html ${bytes.length} bytes, ${gzipSync(bytes).length} gzipped`)
