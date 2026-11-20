import { Config, Effect } from 'effect'
import { notFound } from 'next/navigation'
import VizLab from './VizLab'

const nodeEnv = Config.String('NODE_ENV').pipe(Config.withDefault(''))

// The lab exists for development only; any other build answers 404.
export default async function Page({ params }: { params: Promise<{ entry?: string[] }> }) {
  if (Effect.runSync(nodeEnv) !== 'development') notFound()
  const { entry } = await params
  if (entry && entry.length > 1) notFound()
  return <VizLab entry={entry?.[0]} />
}
