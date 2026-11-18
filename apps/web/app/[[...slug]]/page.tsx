'use client'

import dynamic from 'next/dynamic'

// The theme code reads localStorage and matchMedia at start, and the config sets disableSSR,
// so the poster renders in the browser only.
const Poster = dynamic(
  async () => {
    const [{ AppTheme }, { default: App }, { Analytics }] = await Promise.all([
      import('../../src/ThemePreference'),
      import('../../src/App'),
      import('@vercel/analytics/react'),
      import('../../src/fonts'),
    ])
    return function Poster() {
      return (
        <AppTheme>
          <App />
          <Analytics />
        </AppTheme>
      )
    }
  },
  { ssr: false },
)

export default function Page() {
  return <Poster />
}
