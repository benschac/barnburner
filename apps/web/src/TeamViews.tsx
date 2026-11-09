import { Image, Text, View, styled, useThemeName } from 'tamagui'
import { teamHref, teamLogo, teams } from './team-season.ts'

const Copy = styled(Text, { fontFamily: 'body', fontSize: 'body', lineHeight: 'body', color: 'color', m: '0' })
const Row = styled(View, { flexDirection: 'row', items: 'center' })
const Link = styled(View, {
  render: 'a', minH: 'badge', p: '2', rounded: 'sm', bg: 'surface hover:highlight',
  borderWidth: 1, borderColor: 'rule focus-visible:gold', cursor: 'pointer', textDecorationLine: 'none',
})
export function TeamSelector({ selected }: { selected: string }) {
  const theme = useThemeName()
  return (
    <View render="nav" aria-label="Choose a team" w="100%" maxW="poster" px="4" pb="4" gap="2" display="flex print:none">
      <Row justify="space-between" flexWrap="wrap" gap="2">
        <Copy fontWeight="600">Season at a glance</Copy>
      </Row>
      <Row flexWrap="wrap" gap="1">
        {teams.map((team) => (
          <Link key={team.abbrev} render={<a href={teamHref(team.abbrev)} title={team.name} />} aria-label={`${team.name} season at a glance`}
            aria-current={selected === team.abbrev ? 'page' : undefined}
            bg={selected === team.abbrev ? 'highlight' : 'surface hover:highlight'}
            borderColor={selected === team.abbrev ? 'gold' : 'rule focus-visible:gold'}
            flexDirection="row" gap="1" items="center">
            <Image src={teamLogo(team.abbrev, theme)} alt="" w="logo" h="logo" objectFit="contain" />
            <Copy fontSize="caption" lineHeight="caption">{team.abbrev}</Copy>
          </Link>
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
