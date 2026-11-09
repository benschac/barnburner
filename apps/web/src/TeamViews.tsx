import { Image, Text, View, styled, useThemeName } from 'tamagui'
import { posterHref, teamHref, teamLogo, teams, teamSeason } from './team-season.ts'
import type { SeasonSnapshot, TeamGame } from './team-season.ts'

const Copy = styled(Text, { fontFamily: 'body', fontSize: 'body', lineHeight: 'body', color: 'color', m: '0' })
const Row = styled(View, { flexDirection: 'row', items: 'center' })
const Link = styled(View, {
  render: 'a', minH: 'badge', p: '2', rounded: 'sm', bg: 'surface hover:highlight',
  borderWidth: 1, borderColor: 'rule focus-visible:gold', cursor: 'pointer', textDecorationLine: 'none',
})
const dateFormat = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
const fetchedFormat = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York' })
const resultLabels = { win: 'W', loss: 'L', overtime: 'OTL', pending: 'Upcoming' } as const

export function TeamSelector({ selected }: { selected: string | null }) {
  const theme = useThemeName()
  return (
    <View render="nav" aria-label="Choose a team" w="100%" maxW="poster" px="4" pb="4" gap="2" display="flex print:none">
      <Row justify="space-between" flexWrap="wrap" gap="2">
        <Copy fontWeight="600">Team wins &amp; losses</Copy>
        <Link render={<a href={posterHref} />} px="3" justify="center" aria-current={!selected ? 'page' : undefined}>
          <Copy fontSize="caption" lineHeight="caption">Devils poster</Copy>
        </Link>
      </Row>
      <Row flexWrap="wrap" gap="1">
        {teams.map((team) => (
          <Link key={team.abbrev} render={<a href={teamHref(team.abbrev)} title={team.name} />} aria-label={`${team.name} wins and losses`}
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

function GameRow({ game }: { game: TeamGame }) {
  const theme = useThemeName()
  const completed = game.outcome !== 'pending'
  return (
    <View render="li">
      <Link render={<a href={teamHref(game.opponent)} />} flexDirection="row" items="center" gap="2 sm:4" py="3"
        aria-label={`${dateFormat.format(new Date(game.game.date))}, ${game.venue === 'home' ? 'vs' : 'at'} ${game.opponent}, ${completed ? `${resultLabels[game.outcome]} ${game.goalsFor} to ${game.goalsAgainst}` : 'not final'}. View ${game.opponent} wins and losses`}>
        <Copy w="16" fontSize="caption" lineHeight="caption">{dateFormat.format(new Date(game.game.date))}</Copy>
        <Copy w="6" color="muted" fontSize="caption">{game.venue === 'home' ? 'vs' : '@'}</Copy>
        <Image src={teamLogo(game.opponent, theme)} alt="" w="logo" h="logo" objectFit="contain" />
        <Copy fontWeight="600" flex={1}>{game.opponent}</Copy>
        <Copy color={game.outcome === 'win' ? 'win' : game.outcome === 'loss' ? 'loss' : game.outcome === 'overtime' ? 'gold' : 'muted'} fontWeight="700">
          {completed ? resultLabels[game.outcome] : game.game.scheduleState === 'PPD' ? 'Postponed' : 'Upcoming'}
        </Copy>
        {completed && <Copy fontFamily="score" fontSize="detail" lineHeight="detail">{game.goalsFor}–{game.goalsAgainst}</Copy>}
        {completed && game.game.result?.decision !== 'REG' && <Copy color="gold" fontSize="caption">{game.game.result?.decision}</Copy>}
      </Link>
    </View>
  )
}

export function TeamSeasonView({ team, snapshot }: { team: string; snapshot: SeasonSnapshot }) {
  const theme = useThemeName()
  const season = teamSeason(snapshot, team)
  const metadata = teams.find((item) => item.abbrev === team)
  const completed = season.games.filter((game) => game.outcome !== 'pending')
  const pending = season.games.filter((game) => game.outcome === 'pending')
  return (
    <View render="article" aria-labelledby="team-heading" w="100%" maxW="poster" p="4 sm:6" gap="6">
      <Row gap="4" flexWrap="wrap">
        <Image src={teamLogo(team, theme)} alt="" w="avatar" h="avatar" objectFit="contain" />
        <View gap="1" flex={1}>
          <Copy render="h1" id="team-heading" fontSize="title" lineHeight="title" fontWeight="700">{metadata?.name ?? team}</Copy>
          <Copy color="muted">{String(snapshot.season).slice(0, 4)}–{String(snapshot.season).slice(4)} regular season</Copy>
        </View>
        <View gap="1">
          <Copy fontFamily="score" fontSize="score" lineHeight="score">{season.wins}–{season.losses}–{season.overtime}</Copy>
          <Copy color="muted">Wins · losses · OT/SO losses</Copy>
        </View>
      </Row>
      <Copy>{season.points} points · {season.played} of {season.games.length} games final · {pending.length} remaining</Copy>
      <Copy color="muted" fontSize="caption" lineHeight="caption">Snapshot updated {fetchedFormat.format(new Date(snapshot.fetchedAt))} ET. Scores are from this saved snapshot.</Copy>
      <View display="grid" gridTemplateColumns="minmax(0, 1fr) sm:repeat(2, minmax(0, 1fr)) print:repeat(2, minmax(0, 1fr))" gap="6">
        <View render="section" aria-labelledby="results-heading" gap="3">
          <Copy render="h2" id="results-heading" fontSize="label" lineHeight="label" fontWeight="600">Wins &amp; losses</Copy>
          {completed.length === 0 && <Copy color="muted">No final games in this snapshot.</Copy>}
          <View render="ol" listStyle="none" m="0" p="0" gap="2">
            {completed.toReversed().map((game) => <GameRow key={game.game.id} game={game} />)}
          </View>
        </View>
        <View render="section" aria-labelledby="remaining-heading" gap="3">
          <Copy render="h2" id="remaining-heading" fontSize="label" lineHeight="label" fontWeight="600">Still to play</Copy>
          {pending.length === 0 && <Copy color="muted">All scheduled games are final.</Copy>}
          <View render="ol" listStyle="none" m="0" p="0" gap="2">
            {pending.map((game) => <GameRow key={game.game.id} game={game} />)}
          </View>
        </View>
      </View>
    </View>
  )
}

export function TeamLoading({ failed, retry }: { failed: boolean; retry: () => void }) {
  return (
    <View w="100%" maxW="poster" p="6" gap="4" role={failed ? 'alert' : 'status'}>
      <Copy>{failed ? 'The season snapshot could not be loaded. Try again, or return to the Devils poster.' : 'Loading team results…'}</Copy>
      {failed && <View render="button" onClick={retry} minH="badge" px="4" bg="surface hover:highlight" borderWidth={1} borderColor="rule focus-visible:gold" rounded="sm" cursor="pointer"><Copy>Try again</Copy></View>}
    </View>
  )
}
