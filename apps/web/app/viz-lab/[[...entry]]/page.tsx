import { notFound } from 'next/navigation'
import { VizLabClient } from '../../../src/islands/VizLabClient'
import { isDevelopment } from '../../../src/use-environment'

// The lab exists for development only; any other build answers 404.
export default async function Page({ params }: { params: Promise<{ entry?: string[] }> }) {
  if (!isDevelopment()) notFound()
  const { entry } = await params
  if (entry && entry.length > 1) notFound()
  return <VizLabClient entry={entry?.[0]} />
}
