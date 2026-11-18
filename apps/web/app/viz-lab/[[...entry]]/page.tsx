'use client'

import dynamic from 'next/dynamic'
import { notFound } from 'next/navigation'
import { use } from 'react'

// The island reads localStorage and loads fonts at import, so it renders in the browser only, like the poster.
const VizLabIsland = dynamic(() => import('../../../src/islands/VizLabIsland'), { ssr: false })

// The lab exists for development only; any other build answers 404.
export default function Page({ params }: { params: Promise<{ entry?: string[] }> }) {
  if (process.env.NODE_ENV !== 'development') notFound()
  const { entry } = use(params)
  if (entry && entry.length > 1) notFound()
  return <VizLabIsland entry={entry?.[0]} />
}
