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
    config.externals = [
      ({ request }, callback) => (request !== undefined && apiRequest.test(request) ? callback(null, `module ${request}`) : callback()),
      ...(Array.isArray(config.externals) ? config.externals : [config.externals]),
    ]
  }
  return config
}

/** @type {import('next').NextConfig} */
export default plugin({
  typescript: { tsconfigPath: 'tsconfig.next.json' },
  serverExternalPackages: ['@nhl-reddit-stats/api', '@resvg/resvg-js'],
  transpilePackages: ['react-native-web', 'expo-linear-gradient', '@nhl-reddit-stats/viz', '@nhl-reddit-stats/history', '@nhl-reddit-stats/season'],
  webpack: keepApiExternal,
})
