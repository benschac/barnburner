import { withTamagui } from '@tamagui/next-plugin'

const plugin = withTamagui({
  config: './tamagui.config.ts',
  components: ['tamagui'],
  appDir: true,
  disableExtraction: process.env.NODE_ENV === 'development',
})

// serverExternalPackages only matches packages whose resolved path contains node_modules. The API is a workspace
// package whose symlink resolves to apps/api/dist, so Next would compile web-handler.js, and copy all of its
// box-score chunks, into the route bundle. This hook externalizes the built API for the Node server compiler so the
// route does a runtime import() of the same dist files that Vercel runs, and each box-score chunk loads on demand.
const apiRequest = /^@nhl-reddit-stats\/api\//
const keepApiExternal = (config, { isServer, nextRuntime }) => {
  if (isServer && nextRuntime === 'nodejs') {
    const existing = Array.isArray(config.externals) ? config.externals : [config.externals]
    config.externals = [
      ({ request }, callback) => (request !== undefined && apiRequest.test(request) ? callback(null, `module ${request}`) : callback()),
      ...existing,
    ]
  }
  return config
}

/** @type {import('next').NextConfig} */
export default plugin({
  async headers() {
    // The viz frame runs posted code in a sandboxed opaque origin with no network. The frame is one inline script, so nothing under /viz-frame needs CORS.
    const frameCsp = [
      'sandbox allow-scripts',
      "default-src 'none'",
      // Safe here: the frame page's own <meta> policy still applies, and a document must satisfy every policy it is under. The effective rule is the one hashed inline script plus blob: modules; no script can be requested from any origin, ours included.
      "script-src 'unsafe-inline' blob:",
      "style-src 'unsafe-inline'",
      'img-src data: blob:',
      "connect-src 'none'",
      // Unenforced where unsupported (Chrome logs it as unrecognized); FS6's browser tests decide whether WebRTC is reachable from the frame.
      "webrtc 'block'",
      "base-uri 'none'",
      "form-action 'none'",
    ].join('; ')
    return [
      { source: '/viz-frame/:path*', headers: [{ key: 'Content-Security-Policy', value: frameCsp }] },
      { source: '/((?!viz-frame(?:/|$)).*)', headers: [{ key: 'Content-Security-Policy', value: "frame-src 'self'; frame-ancestors 'self'" }] },
    ]
  },
  typescript: { tsconfigPath: 'tsconfig.next.json' },
  serverExternalPackages: ['@nhl-reddit-stats/api', '@resvg/resvg-js'],
  // The history file is read from disk by the handler, so the tracer cannot see it. Ship it with /api/history only.
  outputFileTracingIncludes: { '/api/history': ['./history-data/nhl-serve.sqlite'] },
  transpilePackages: ['react-native-web', 'expo-linear-gradient', '@nhl-reddit-stats/viz', '@nhl-reddit-stats/history', '@nhl-reddit-stats/season'],
  webpack: keepApiExternal,
})
