import { withTamagui } from '@tamagui/next-plugin'

const plugin = withTamagui({
  config: './tamagui.config.ts',
  components: ['tamagui'],
  appDir: true,
  disableExtraction: process.env.NODE_ENV === 'development',
})

/** @type {import('next').NextConfig} */
export default plugin({
  typescript: { tsconfigPath: 'tsconfig.next.json' },
  // Mirrors the Vite dev proxy.
  rewrites: async () => [{ source: '/api/:path*', destination: 'http://127.0.0.1:3001/api/:path*' }],
  transpilePackages: ['react-native-web', 'expo-linear-gradient', '@nhl-reddit-stats/viz', '@nhl-reddit-stats/history', '@nhl-reddit-stats/season', '@nhl-reddit-stats/api'],
})
