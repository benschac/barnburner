import { Fragment, useLayoutEffect, useRef, useState } from 'react'
import { Image, Text, View, styled, type TamaguiElement, type GetProps } from 'tamagui'
import { Chart } from './Charts'
import { divisions, leaders, recent, standings, upcoming } from './stats'
import type { Matchup } from './stats'

const Copy = styled(Text, {
  fontFamily: 'body', fontSize: '16', lineHeight: '19', fontWeight: '400',
  color: 'foreground', m: 0, p: 0,
})
const Heading = styled(Copy, {
  render: 'h2', fontFamily: 'heading', fontSize: '28', lineHeight: '36', fontWeight: '700',
})
const RuledHeading = styled(Heading, {
  fontSize: '26', h: 41, mb: 9, borderBottomWidth: 2, borderBottomColor: 'rule',
})
const Score = styled(Copy, { fontFamily: 'score', fontWeight: '400' })
const Row = styled(View, { flexDirection: 'row', items: 'center', shrink: 0 })
const List = styled(View, { render: 'ul', m: 0, p: 0, listStyle: 'none' })
const Label = styled(Copy, {
  render: 'h3', color: 'gold', fontSize: '14', lineHeight: '18', letterSpacing: 1, fontWeight: '600',
})
const Logo = styled(Image, { w: 34, h: 34, objectFit: 'contain', shrink: 0 })
const TableCell = styled(Copy, { style: { display: 'table-cell' }, verticalAlign: 'middle', fontSize: '22', lineHeight: '26' })
const ColumnHeading = styled(TableCell, {
  render: 'th', color: 'muted', fontSize: '14', lineHeight: '17', fontWeight: '500', text: 'right', pr: '1.5',
})
const BannerLayer = styled(View, {
  position: 'absolute', l: 0, t: 0, h: 126,
  clipPath: 'polygon(0 0, 100% 0, 88% 100%, 0 100%)',
})
const outcomeColors = { win: 'win', loss: 'loss', overtime: 'gold', pending: 'pending' } as const

function TeamLogo({ team, alternate = false, ...props }: { team: string; alternate?: boolean } & GetProps<typeof Logo>) {
  return <Logo src={`/assets/teams/${team}${alternate && team === 'WSH' ? '-alt' : ''}.svg`} alt={team} {...props} />
}

function Division({ name, record, teams }: { name: string; record: string; teams: Matchup[] }) {
  return (
    <View render="section" aria-label={`${name} division matchups`}>
      <Row render="h3" h={37} justify="space-between" items="baseline" borderBottomWidth={2} borderBottomColor="rule" m={0}>
        <Copy fontSize="22" lineHeight="27" fontWeight="700">{name}</Copy>
        <Score color="gold" fontSize="21" lineHeight="26">{record}</Score>
      </Row>
      <List pt={7}>
        {teams.map(({ team, games }) => (
          <Row render="li" h={36} gap={15} key={team}>
            <TeamLogo team={team} alternate w={36} h={29} scale={1.18} />
            <Row gap={5}>
              {games.map(({ venue, outcome }, index) => (
                <View key={index} w={27} h={27} bg={outcomeColors[outcome]}
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
          {[51, 163, 40, 45].map((width) => <View render="col" style={{ display: "table-column" }} w={width} key={width} />)}
        </View>
        <View render="thead" style={{ display: "table-header-group" }} h={28}>
          <View render="tr" style={{ display: "table-row" }}>
            <ColumnHeading {...{ colSpan: 2, scope: 'colgroup' }} text="left" pl="1.5" letterSpacing={1.3}>METROPOLITAN</ColumnHeading>
            <ColumnHeading {...{ scope: 'col' }}>GP</ColumnHeading>
            <ColumnHeading {...{ scope: 'col' }}>PTS</ColumnHeading>
          </View>
        </View>
        <View render="tbody" style={{ display: "table-row-group" }}>
          {standings.map(({ seed, team, played, points }, index) => (
            <Fragment key={team}>
              {index === 3 && (
                <View render="tr" style={{ display: "table-row" }} h={29}>
                  <ColumnHeading {...{ colSpan: 4, scope: 'colgroup' }} text="left" pl="1.5" pt="1.5" letterSpacing={1.3}>WILD CARD</ColumnHeading>
                </View>
              )}
              <View render="tr" style={{ display: "table-row" }} h={35} bg={team === 'NJD' ? 'highlight' : 'transparent'}
                borderTopWidth={index === 5 ? 2 : 0} borderTopColor="gold" borderTopStyle="dashed">
                <TableCell render="td" pl="1.5" color="gold" fontSize="16" borderTopLeftRadius="sm" borderBottomLeftRadius="sm">{seed}</TableCell>
                <View render="th" {...{ scope: 'row' }} style={{ display: "table-cell" }} text="left" fontWeight="500">
                  <Row h={35} gap={15}>
                    <TeamLogo team={team} w={31} h={30} scale={1.4} />
                    <Copy fontSize="22" lineHeight="26" fontWeight="500">{team}</Copy>
                  </Row>
                </View>
                <TableCell render="td" text="right" pr="2" fontSize="21">{played}</TableCell>
                <TableCell render="td" fontFamily="score" fontSize="26" lineHeight="31" text="right" pr="1.5" borderTopRightRadius="sm" borderBottomRightRadius="sm">{points}</TableCell>
              </View>
            </Fragment>
          ))}
        </View>
      </View>
      <View display="grid" gridTemplateColumns="1fr 1fr" gap={11} mt="2.5">
        {[{ label: 'POWER PLAY', rank: '24th', value: '18.5' }, { label: 'PENALTY KILL', rank: '29th', value: '67.6' }].map(({ label, rank, value }) => (
          <View key={label} bg="surface" rounded="3" h={72} py="1.5" px={11}>
            <Label>{label}</Label>
            <Copy render="p" fontSize="13" lineHeight="17" color="muted">· {rank} of 32</Copy>
            <Score render="p" fontSize="27" lineHeight="29">{value}<Copy fontSize="17" color="muted" ml="0.5">%</Copy></Score>
          </View>
        ))}
      </View>
      <View render="section" mt="4" aria-labelledby="leaders-heading">
        <RuledHeading id="leaders-heading">Team leaders</RuledHeading>
        <List>
          {leaders.map((leader) => (
            <Row render="li" h={72} gap={13} key={leader.label}>
              <Image w={60} h={60} rounded="full" borderWidth={2} borderColor="brand" bg="surface" objectFit="cover" shrink={0}
                src={`/assets/players/${leader.portrait}.png`} alt="" />
              <View flex={1} minW={0}>
                <Label whiteSpace="nowrap">{leader.label}</Label>
                <Copy render="p" fontSize="22" lineHeight="26" fontWeight="600">{leader.name}</Copy>
                <Copy render="p" color="muted" fontSize="16" lineHeight="21" whiteSpace="nowrap">{leader.detail}</Copy>
              </View>
              <Score render="p" fontSize="32" lineHeight="39" self="center">{leader.value}</Score>
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
          Next 5<Copy fontSize="14" lineHeight="17" letterSpacing={1.2} color="muted" fontWeight="500">EASTERN TIME</Copy>
        </RuledHeading>
        <List render="ol" gap={9}>
          {upcoming.map((game) => (
            <Row render="li" key={game.date} h={74} bg="surface" rounded="3">
              <Row h={74} w="24" borderWidth={2} borderColor="gold" borderRightStyle="dashed" borderTopLeftRadius="md" borderBottomLeftRadius="md">
                <Copy fontSize="14" lineHeight="17" fontWeight="600" color="gold" writingMode="vertical-rl" rotate="180deg" w={27} text="center">{game.day}</Copy>
                <Score fontSize="40" lineHeight="48" flex={1} text="center">{game.date}</Score>
              </Row>
              <Copy fontSize="20" lineHeight="24" color="muted" w={51} text="center">{game.venue}</Copy>
              <TeamLogo team={game.team} alternate w={52} h={49} scale={1.4} />
              <Copy flex={1} text="center" fontSize="24" lineHeight="29" fontWeight="500">{game.time}</Copy>
            </Row>
          ))}
        </List>
      </View>
      <View render="section" mt={17} aria-labelledby="last-heading">
        <RuledHeading id="last-heading" mb="2">Last 5</RuledHeading>
        <List render="ol">
          {recent.map((game) => (
            <Row render="li" h={52} gap={13} key={game.team}>
              <TeamLogo team={game.team} w={62} h={44} mr="px" scale={1.07} />
              <Copy w="10" h="9" display="flex" items="center" justify="center" rounded="sm" fontFamily="result" fontSize="26" lineHeight="31"
                bg={outcomeColors[game.outcome]} color={game.outcome === 'win' ? 'result-ink' : 'loss-ink'}>{game.outcome === 'win' ? 'W' : 'L'}</Copy>
              <Copy fontSize="28" lineHeight="34" fontWeight="500">{game.score}</Copy>
              <Copy fontSize="16" lineHeight="19" color="gold" ml="px">{game.extra}</Copy>
            </Row>
          ))}
        </List>
      </View>
    </View>
  )
}

export default function App() {
  const shellRef = useRef<TamaguiElement>(null)
  const [scale, setScale] = useState(1)
  useLayoutEffect(() => {
    const shell = shellRef.current
    if (!(shell instanceof HTMLElement)) return
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setScale(entry.contentRect.width / 1206)
    })
    observer.observe(shell)
    return () => observer.disconnect()
  }, [])

  return (
    <View render="main" minH="100vh" bg="background" items="center">
      <View w="100%" maxW={1206} data-poster-shell="" aspectRatio={1206 / 1518} position="relative" overflow="clip" ref={shellRef}>
        <View render="article" w={1206} h={1518} position="absolute" l={0} t={0} bg="background"
          scale={scale} transformOrigin="top left" aria-label="New Jersey Devils season at a glance — November 8">
          <View render="header" h={146} shrink={0} position="relative">
            <BannerLayer w={268} bg="bright" />
            <BannerLayer w={260} bg="background" />
            <BannerLayer w={250} bg="brand" />
            <TeamLogo team="NJD" position="absolute" w={156} h={156} l="10" t={-15} z={1} />
            <View position="absolute" t={17} l={284}>
              <Score render="h1" fontSize="62" lineHeight="72" letterSpacing={1} color="bright">12-5-0</Score>
              <Copy render="p" fontSize="22" lineHeight="27" mt="0.5" whiteSpace="nowrap">
                <Copy render="strong" fontSize="22" lineHeight="27" fontWeight="700">24 points,</Copy> 2nd in the Metropolitan, won 4 straight
              </Copy>
            </View>
            <View position="absolute" t={26} r={54}>
              <Copy render="p" text="right" color="muted" fontSize="19" lineHeight="29" fontWeight="600" mb={5}>Sunday, November 8</Copy>
              <Copy render="p" text="right" color="muted" fontSize="18" lineHeight="29">Home 8-2-0 · Road 4-3-0 · Last 10 8-2-0</Copy>
              <Copy render="p" text="right" color="muted" fontSize="18" lineHeight="29">Schedule left: 13th-toughest of 32</Copy>
            </View>
          </View>
          <View mx={53}>
            <View render="section" h={310} aria-labelledby="season-heading">
              <Row h={49} justify="space-between" items="baseline" pr="10">
                <Heading id="season-heading">The season, game by game</Heading>
                <Copy render="p" color="muted" fontSize="19" lineHeight="23">17 of 84 played, bar height = goal margin</Copy>
              </Row>
              <Chart kind="season" />
            </View>
            <View render="section" h={180} aria-labelledby="line-heading">
              <Row h="12" justify="space-between" items="baseline" pr="10">
                <Heading id="line-heading">Playoff line <Score fontSize="32" lineHeight="39" ml={11}>+5</Score></Heading>
                <Copy render="p" color="muted" fontSize="19" lineHeight="23">5 points clear of the first team out</Copy>
              </Row>
              <Chart kind="playoff" />
            </View>
            <View display="grid" gridTemplateColumns="447px 299px 299px" gap={27}>
              <View display="grid" gridTemplateColumns="213px 213px" gridTemplateRows="354px auto" columnGap={21}>
                {divisions.map((division) => <Division {...division} key={division.name} />)}
              </View>
              <PlayoffPicture />
              <Schedule />
            </View>
          </View>
          <Row render="footer" position="absolute" l={53} r={54} b={28} h={26} gap={26}>
            <List flexDirection="row" gap="6">
              {([{ label: 'Win', color: 'win' }, { label: 'Loss', color: 'loss' }, { label: 'OT/SO loss', color: 'gold' }, { label: 'Still to play', color: 'pending' }] as const).map(({ label, color }) => (
                <Row render="li" gap={7} key={label}>
                  <View w={13} h={13} rounded="xs" opacity={0.75} bg={color} />
                  <Copy color="muted" whiteSpace="nowrap">{label}</Copy>
                </Row>
              ))}
            </List>
            <Copy render="p" color="muted" whiteSpace="nowrap">Filled dot or house = home, ring or plane = away</Copy>
            <Copy color="muted" ml="auto" letterSpacing={1} fontWeight="600">GLANCEBOARD</Copy>
          </Row>
        </View>
      </View>
    </View>
  )
}
