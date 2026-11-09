import { Fragment, useState } from 'react'
import { Image, Text, View, styled } from 'tamagui'
import { Chart } from './Charts'
import { divisions, leaders, recent, standings, upcoming } from './stats'
import type { Matchup } from './stats'
import { ThemeControls } from './ThemePreference'

const Copy = styled(Text, {
  fontFamily: 'body', fontSize: 'body', lineHeight: 'caption', fontWeight: '400',
  color: 'color', m: '0', p: '0',
})
const Heading = styled(Copy, {
  render: 'h2', fontFamily: 'heading', fontSize: 'title', lineHeight: 'title', fontWeight: '700',
})
const RuledHeading = styled(Heading, {
  fontSize: 'title', h: '10', mb: '2', borderBottomWidth: 2, borderBottomColor: 'rule',
})
const Score = styled(Copy, { fontFamily: 'score', fontWeight: '400' })
const Row = styled(View, { flexDirection: 'row', items: 'center', shrink: 0 })
const List = styled(View, { render: 'ul', m: '0', p: '0', listStyle: 'none' })
const Label = styled(Copy, {
  render: 'h3', color: 'gold', fontSize: 'caption', lineHeight: 'caption', letterSpacing: 1, fontWeight: '600',
})
const Logo = styled(Image, { w: '8', h: '8', objectFit: 'contain', shrink: 0 })
const TableCell = styled(Copy, { style: { display: 'table-cell' }, verticalAlign: 'middle', fontSize: 'label', lineHeight: 'detail' })
const ColumnHeading = styled(TableCell, {
  render: 'th', color: 'muted', fontSize: 'caption', lineHeight: 'caption', fontWeight: '500', text: 'right', pr: '1.5',
})
const BannerLayer = styled(View, {
  position: 'absolute', l: '0', t: '0', h: 'playoffChart',
  clipPath: 'polygon(0 0, 100% 0, 88% 100%, 0 100%)',
})
const outcomeColors = { win: 'win', loss: 'loss', overtime: 'gold', pending: 'pending' } as const


function Division({ name, record, teams }: { name: string; record: string; teams: Matchup[] }) {
  return (
    <View render="section" aria-label={`${name} division matchups`}>
      <Row render="h3" h="10" justify="space-between" items="baseline" borderBottomWidth={2} borderBottomColor="rule" m="0">
        <Copy fontSize="label" lineHeight="label" fontWeight="700">{name}</Copy>
        <Score color="gold" fontSize="label" lineHeight="detail">{record}</Score>
      </Row>
      <List pt="1.5">
        {teams.map(({ team, games }) => (
          <Row render="li" h="8" gap="4" key={team}>
            <Logo src={`/assets/teams/${team === 'WSH' ? 'WSH-alt' : team}.svg`} alt={team} w="8" h="icon" scale={1.18} />
            <Row gap="1">
              {games.map(({ venue, outcome }, index) => (
                <View key={index} w="icon" h="icon" bg={outcomeColors[outcome]}
                  maskRepeat="no-repeat" maskSize="contain" maskPosition="center"
                  maskImage={`url('/assets/icons/${venue === 'home' ? 'home' : 'flight'}.svg')`}
                  rotate={venue === 'away' ? '90deg' : '0deg'}
                  role="img" aria-label={`${venue}, ${outcome === 'pending' ? 'still to play' : outcome}`} />
              ))}
            </Row>
          </Row>
        ))}
      </List>
    </View>
  )
}

function PlayoffPicture() {
  return (
    <View render="section" aria-labelledby="playoff-heading">
      <RuledHeading id="playoff-heading" mb="1.5">Playoff picture</RuledHeading>
      <View render="table" style={{ display: "table" }} w="100%" borderCollapse="collapse" tableLayout="fixed">
        <View render="colgroup" style={{ display: "table-column-group" }}>
          <View render="col" style={{ display: "table-column" }} w="17%" /><View render="col" style={{ display: "table-column" }} w="53%" /><View render="col" style={{ display: "table-column" }} w="15%" /><View render="col" style={{ display: "table-column" }} w="15%" />
        </View>
        <View render="thead" style={{ display: "table-header-group" }} h="icon">
          <View render="tr" style={{ display: "table-row" }}>
            <ColumnHeading {...{ colSpan: 2, scope: 'colgroup' }} text="left" pl="1.5" letterSpacing={1}>METROPOLITAN</ColumnHeading>
            <ColumnHeading {...{ scope: 'col' }}>GP</ColumnHeading>
            <ColumnHeading {...{ scope: 'col' }}>PTS</ColumnHeading>
          </View>
        </View>
        <View render="tbody" style={{ display: "table-row-group" }}>
          {standings.map(({ seed, team, played, points }, index) => (
            <Fragment key={team}>
              {index === 3 && (
                <View render="tr" style={{ display: "table-row" }} h="icon">
                  <ColumnHeading {...{ colSpan: 4, scope: 'colgroup' }} text="left" pl="1.5" pt="1.5" letterSpacing={1}>WILD CARD</ColumnHeading>
                </View>
              )}
              <View render="tr" style={{ display: "table-row" }} h="8" bg={team === 'NJD' ? 'highlight' : 'transparent'}
                borderTopWidth={index === 5 ? 2 : 0} borderTopColor="gold" borderTopStyle="dashed">
                <TableCell render="td" pl="1.5" color="gold" fontSize="body" borderTopLeftRadius="sm" borderBottomLeftRadius="sm">{seed}</TableCell>
                <View render="th" {...{ scope: 'row' }} style={{ display: "table-cell" }} text="left" fontWeight="500">
                  <Row h="8" gap="4">
                    <Logo src={`/assets/teams/${team}.svg`} alt={team} w="8" h="8" scale={1.4} />
                    <Copy fontSize="label" lineHeight="detail" fontWeight="500">{team}</Copy>
                  </Row>
                </View>
                <TableCell render="td" text="right" pr="2" fontSize="label">{played}</TableCell>
                <TableCell render="td" fontFamily="score" fontSize="title" lineHeight="label" text="right" pr="1.5" borderTopRightRadius="sm" borderBottomRightRadius="sm">{points}</TableCell>
              </View>
            </Fragment>
          ))}
        </View>
      </View>
      <View display="grid" gridTemplateColumns="1fr 1fr" gap="3" mt="2">
        {[{ label: 'POWER PLAY', rank: '24th', value: '18.5' }, { label: 'PENALTY KILL', rank: '29th', value: '67.6' }].map(({ label, rank, value }) => (
          <View key={label} bg="surface" rounded="md" h="card" py="1.5" px="3">
            <Label>{label}</Label>
            <Copy render="p" fontSize="caption" lineHeight="caption" color="muted">· {rank} of 32</Copy>
            <Score render="p" fontSize="title" lineHeight="label">{value}<Copy fontSize="body" color="muted" ml="0.5">%</Copy></Score>
          </View>
        ))}
      </View>
      <View render="section" mt="4" aria-labelledby="leaders-heading">
        <RuledHeading id="leaders-heading">Team leaders</RuledHeading>
        <List>
          {leaders.map((leader) => (
            <Row render="li" h="card" gap="3" key={leader.label}>
              <Image w="16" h="16" rounded="full" borderWidth={2} borderColor="brand" bg="surface" objectFit="cover" shrink={0}
                src={`/assets/players/${leader.portrait}.png`} alt="" />
              <View flex={1} minW="0">
                <Label whiteSpace="nowrap">{leader.label}</Label>
                <Copy render="p" fontSize="label" lineHeight="detail" fontWeight="600">{leader.name}</Copy>
                <Copy render="p" color="muted" fontSize="body" lineHeight="body" whiteSpace="nowrap">{leader.detail}</Copy>
              </View>
              <Score render="p" fontSize="stat" lineHeight="stat" self="center">{leader.value}</Score>
            </Row>
          ))}
        </List>
      </View>
    </View>
  )
}

function Schedule() {
  return (
    <View>
      <View render="section" aria-labelledby="next-heading">
        <RuledHeading id="next-heading" display="flex" flexDirection="row" justify="space-between" items="baseline">
          Next 5<Copy fontSize="caption" lineHeight="caption" letterSpacing={1} color="muted" fontWeight="500">EASTERN TIME</Copy>
        </RuledHeading>
        <List render="ol" gap="2">
          {upcoming.map((game) => (
            <Row render="li" key={game.date} h="card" bg="surface" rounded="md">
              <Row h="card" w="24" borderWidth={2} borderColor="gold" borderRightStyle="dashed" borderTopLeftRadius="md" borderBottomLeftRadius="md">
                <Copy fontSize="caption" lineHeight="caption" fontWeight="600" color="gold" writingMode="vertical-rl" rotate="180deg" w="icon" text="center">{game.day}</Copy>
                <Score fontSize="score" lineHeight="score" flex={1} text="center">{game.date}</Score>
              </Row>
              <Copy fontSize="detail" lineHeight="detail" color="muted" w="12" text="center">{game.venue}</Copy>
              <Logo src={`/assets/teams/${game.team === 'WSH' ? 'WSH-alt' : game.team}.svg`} alt={game.team} w="12" h="12" scale={1.4} />
              <Copy flex={1} text="center" fontSize="label" lineHeight="label" fontWeight="500">{game.time}</Copy>
            </Row>
          ))}
        </List>
      </View>
      <View render="section" mt="4" aria-labelledby="last-heading">
        <RuledHeading id="last-heading" mb="2">Last 5</RuledHeading>
        <List render="ol">
          {recent.map((game) => (
            <Row render="li" h="12" gap="3" key={game.team}>
              <Logo src={`/assets/teams/${game.team}.svg`} alt={game.team} w="16" h="10" mr="px" scale={1.07} />
              <Copy w="10" h="10" display="flex" items="center" justify="center" rounded="sm" fontFamily="result" fontSize="title" lineHeight="label"
                bg={outcomeColors[game.outcome]} color={game.outcome === 'win' ? 'result-ink' : 'loss-ink'}>{game.outcome === 'win' ? 'W' : 'L'}</Copy>
              <Copy fontSize="title" lineHeight="title" fontWeight="500">{game.score}</Copy>
              <Copy fontSize="body" lineHeight="caption" color="gold" ml="px">{game.extra}</Copy>
            </Row>
          ))}
        </List>
      </View>
    </View>
  )
}

export default function App() {
  const [activeGame, setActiveGame] = useState<number | null>(null)

  return (
    <View render="main" minH="100vh" bg="background" items="center" printColorAdjust="exact">
      <ThemeControls />
      <View w="100%" maxW="poster" data-poster-shell="">
        <View render="article" w="100% print:poster" minH="poster:posterHeight print:posterHeight" bg="background"
          zoom="print:calc(100vw / 1206px)" aria-label="New Jersey Devils season at a glance — November 8">
          <View render="header" minH="36" pb="6 poster:0 print:0" gap="4" shrink={0} position="relative">
            <BannerLayer w="bannerOutline" bg="bright" />
            <BannerLayer w="bannerInset" bg="background" />
            <BannerLayer w="bannerFill" bg="brand" />
            <Logo src="/assets/teams/NJD.svg" alt="NJD" position="absolute" w="hero" h="hero" l="10" t="0" z={1} />
            <View position="relative poster:absolute print:absolute" pt="36 poster:0 print:0" px="4 poster:0 print:0" t="poster:4 print:4" l="poster:25% print:25%">
              <Score render="h1" fontSize="hero" lineHeight="hero" letterSpacing={1} color="bright">12-5-0</Score>
              <Copy render="p" fontSize="label" lineHeight="label" mt="0.5">
                <Copy render="strong" fontSize="label" lineHeight="label" fontWeight="700">24 points,</Copy> 2nd in the Metropolitan, won 4 straight
              </Copy>
            </View>
            <View position="relative poster:absolute print:absolute" px="4 poster:0 print:0" t="poster:6 print:6" r="poster:12 print:12">
              <Copy render="p" text="left poster:right print:right" color="muted" fontSize="detail" lineHeight="label" fontWeight="600" mb="1">Sunday, November 8</Copy>
              <Copy render="p" text="left poster:right print:right" color="muted" fontSize="detail" lineHeight="label">Home 8-2-0 · Road 4-3-0 · Last 10 8-2-0</Copy>
              <Copy render="p" text="left poster:right print:right" color="muted" fontSize="detail" lineHeight="label">Schedule left: 13th-toughest of 32</Copy>
            </View>
          </View>
          <View mx="4 sm:6 poster:12 print:12">
            <View render="section" minH="seasonChart" aria-labelledby="season-heading">
              <Row minH="12" flexWrap="wrap" gap="2" justify="space-between" items="baseline" pr="0 poster:10 print:10" pb="3">
                <Heading id="season-heading">The season, game by game</Heading>
                <Copy render="p" color="muted" fontSize="detail" lineHeight="detail">17 of 84 played, bar height = goal margin</Copy>
              </Row>
              <Chart kind="season" activeGame={activeGame} onActiveGameChange={setActiveGame} />
            </View>
            <View render="section" minH="hero" aria-labelledby="line-heading">
              <Row minH="12" flexWrap="wrap" gap="2" justify="space-between" items="baseline" pr="0 poster:10 print:10" pb="3">
                <Heading id="line-heading">Playoff line <Score fontSize="stat" lineHeight="stat" ml="3">+5</Score></Heading>
                <Copy render="p" color="muted" fontSize="detail" lineHeight="detail">5 points clear of the first team out</Copy>
              </Row>
              <Chart kind="playoff" activeGame={activeGame} onActiveGameChange={setActiveGame} />
            </View>
            <View display="grid" gridTemplateColumns="minmax(0, 1fr) md:repeat(2, minmax(0, 1fr)) poster:1.5fr 1fr 1fr print:1.5fr 1fr 1fr" gap="8 poster:6 print:6">
              <View display="grid" gridTemplateColumns="minmax(0, 1fr) sm:repeat(2, minmax(0, 1fr)) md:minmax(0, 1fr) poster:repeat(2, minmax(0, 1fr)) print:repeat(2, minmax(0, 1fr))" gap="6 poster:6 print:6">
                {divisions.map((division) => <Division name={division.name} record={division.record} teams={division.teams} key={division.name} />)}
              </View>
              <PlayoffPicture />
              <Schedule />
            </View>
          </View>
          <Row render="footer" flexWrap="wrap" mx="4 sm:6 poster:12 print:12" mt="10" mb="8" minH="6" gap="6">
            <List flexDirection="row" flexWrap="wrap" gap="6">
              {([{ label: 'Win', color: 'win' }, { label: 'Loss', color: 'loss' }, { label: 'OT/SO loss', color: 'gold' }, { label: 'Still to play', color: 'pending' }] as const).map(({ label, color }) => (
                <Row render="li" gap="1.5" key={label}>
                  <View w="3" h="3" rounded="sm" opacity={0.75} bg={color === 'win' ? 'win' : color === 'loss' ? 'loss' : color === 'gold' ? 'gold' : 'pending'} />
                  <Copy color="muted" whiteSpace="nowrap">{label}</Copy>
                </Row>
              ))}
            </List>
            <Copy render="p" color="muted">Filled dot or house = home, ring or plane = away</Copy>
            <Copy color="muted" ml="auto" letterSpacing={1} fontWeight="600">GLANCEBOARD</Copy>
          </Row>
        </View>
      </View>
    </View>
  )
}
