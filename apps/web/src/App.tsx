import { useCallback, useEffect, useMemo, useState } from 'react'
import { View } from 'tamagui'
import { createTeamPosterCache } from './stats'
import { ThemeControls } from './ThemePreference'
import { TeamLoading, TeamSelector } from './TeamViews'
import { TeamPoster } from './components/team-poster/TeamPoster'
import { useTeamNavigation } from './use-team-navigation'

export default function App() {
  const { snapshot, retry } = useTeamNavigation()
  const [previewTeam, setPreviewTeam] = useState<string | null>(null)
  const selected = snapshot?.context.team ?? 'NJD'
  const displayedTeam = previewTeam ?? selected
  const source = snapshot?.matches('ready') ? snapshot.context.snapshot : null
  const posters = useMemo(() => source ? createTeamPosterCache(source) : null, [source])
  const data = posters?.(displayedTeam) ?? null
  const prefetchTeam = useCallback((team: string) => { posters?.(team) }, [posters])
  useEffect(() => {
    if (data) document.title = `${data.team.name} | Glanceboard`
  }, [data])
  return (
    <View render="main" minH="100vh" bg="background" items="center" printColorAdjust="exact">
      <ThemeControls />
      <TeamSelector selected={selected} onPrefetchTeam={prefetchTeam} onPreviewTeam={setPreviewTeam} />
      {data ? <TeamPoster data={data} onPrefetchTeam={prefetchTeam} /> : <TeamLoading failed={snapshot?.matches('error') ?? false} retry={retry} />}
    </View>
  )
}
