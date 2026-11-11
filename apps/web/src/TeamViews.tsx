import { Image, Text, View, styled, useThemeName } from 'tamagui'
import { teamHref, teamLogo, teams } from './team-season.ts'

const Copy = styled(Text, { fontFamily: 'body', fontSize: 'body', lineHeight: 'body', color: 'color', m: '0' })
const Row = styled(View, { flexDirection: 'row', items: 'center' })
const Link = styled(View, {
  render: 'a', minH: '12', px: '3', py: '2', rounded: 'sm', bg: 'transparent hover:surface',
  borderWidth: 1, borderColor: 'transparent focus-visible:gold', cursor: 'pointer', textDecorationLine: 'none',
})
const divisions = ['Metropolitan', 'Atlantic', 'Central', 'Pacific']
export function TeamSelector({ selected, onPrefetchTeam, onPreviewTeam }: {
  selected: string
  onPrefetchTeam: (team: string) => void
  onPreviewTeam: (team: string | null) => void
}) {
  const theme = useThemeName()
  return (
    <View render="nav" aria-label="Choose a team" w="100%" maxW="poster" px="4" py="3" mb="4" gap="4" display="flex print:none"
      borderBottomWidth={1} borderBottomColor="rule">
      <Row justify="space-between" items="baseline" flexWrap="wrap" gap="3">
        <Copy fontSize="label" lineHeight="label" fontWeight="600">Choose your team</Copy>
        <Copy fontSize="caption" color="muted">{teams.length} teams · {divisions.length} divisions</Copy>
      </Row>
      <Row items="flex-start" flexWrap="wrap" onMouseLeave={() => onPreviewTeam(null)}>
        {divisions.map((division) => (
          <View key={division} render="section" aria-label={`${division} division`} w="100% sm:50% lg:25%" px="1" pb="4" gap="1">
            <Copy render="h2" fontSize="caption" lineHeight="caption" fontWeight="600" letterSpacing={1} color="gold" px="3" pb="2">{division.toUpperCase()}</Copy>
            {teams.filter((team) => team.division === division).map((team) => (
              <Link key={team.abbrev} render={<a href={teamHref(team.abbrev)} />} aria-label={`${team.name} season at a glance`}
                onMouseEnter={() => {
                  onPrefetchTeam(team.abbrev)
                  onPreviewTeam(team.abbrev)
                }}
                onClick={() => onPreviewTeam(null)}
                onFocus={() => onPrefetchTeam(team.abbrev)}
                aria-current={selected === team.abbrev ? 'page' : undefined}
                bg={selected === team.abbrev ? 'surface' : 'transparent hover:surface'}
                borderColor={selected === team.abbrev ? 'gold' : 'transparent focus-visible:gold'}
                flexDirection="row" gap="2" items="center">
                <Image src={teamLogo(team.abbrev, theme)} alt="" w="logo" h="logo" shrink={0} objectFit="contain" />
                <Copy minW="0" fontWeight={selected === team.abbrev ? '600' : '400'}>{team.name}</Copy>
                {selected === team.abbrev && <Copy ml="auto" color="gold" aria-hidden={true}>✓</Copy>}
              </Link>
            ))}
          </View>
        ))}
      </Row>
    </View>
  )
}

export function TeamLoading({ failed, retry }: { failed: boolean; retry: () => void }) {
  return (
    <View w="100%" maxW="poster" p="6" gap="4" role={failed ? 'alert' : 'status'}>
      <Copy>{failed ? 'Team data could not be loaded. Try again.' : 'Loading team poster…'}</Copy>
      {failed && <View render="button" onClick={retry} minH="badge" px="4" bg="surface hover:highlight" borderWidth={1} borderColor="rule focus-visible:gold" rounded="sm" cursor="pointer"><Copy>Try again</Copy></View>}
    </View>
  )
}
