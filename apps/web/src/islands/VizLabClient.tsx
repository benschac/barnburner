'use client'

import dynamic from 'next/dynamic'

// The island reads localStorage and loads fonts at import, so it renders in the browser only, like the poster.
const VizLabIsland = dynamic(() => import('./VizLabIsland'), { ssr: false })

export function VizLabClient({ entry }: { entry: string | undefined }) {
  return <VizLabIsland entry={entry} />
}
