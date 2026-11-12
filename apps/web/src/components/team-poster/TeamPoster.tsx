import { memo, useState } from 'react'
import { Theme, View } from 'tamagui'
import { teamBannerThemeName } from '../../../design/themes'
import { Chart } from '../../Charts'
import type { TeamPosterData } from '../../stats'
import { teamLogo } from '../../team-season'
import { Division } from './Division'
import { AnimatedRecord } from './AnimatedRecord'
import { PlayoffPicture } from './PlayoffPicture'
import { Schedule } from './Schedule'
import { BannerLayer, Copy, Heading, List, Logo, Row, Score } from './primitives'

export const TeamPoster = memo(function TeamPoster({ data, onPrefetchTeam }: { data: TeamPosterData; onPrefetchTeam: (team: string) => void }) {
  const [activeGame, setActiveGame] = useState<number | null>(null)
  const [activeTeam, setActiveTeam] = useState(data.team.abbrev)
  if (activeTeam !== data.team.abbrev) {
    setActiveTeam(data.team.abbrev)
    setActiveGame(null)
  }
  const { seasonGames, completedGames, divisions, seasonSummary, snapshotDate, latestPlayoffCushion } = data
  return (
      <View w="100%" maxW="poster" data-poster-shell="">
        <View render="article" w="100% print:poster" minH="poster:posterHeight print:posterHeight" bg="background"
          zoom="print:calc(100vw / 1206px)" aria-label={`${data.team.name} season at a glance through ${snapshotDate}`}>
          <View render="header" minH="36" pb="6 poster:0 print:0" gap="4" shrink={0} position="relative">
            <Theme name={teamBannerThemeName(data.team.abbrev)}>
              <BannerLayer w="bannerOutline" bg="team-secondary" />
              <BannerLayer w="bannerInset" bg="background" />
              <BannerLayer w="bannerFill" bg="team-primary" />
            </Theme>
            <Logo src={teamLogo(data.team.abbrev, 'dark')} alt={data.team.name} position="absolute" w="hero" h="banner" l="10" t="0" z={1} />
            <View position="relative poster:absolute print:absolute" pt="36 poster:0 print:0" px="4 poster:0 print:0" t="poster:4 print:4" l="poster:25% print:25%">
              <AnimatedRecord record={seasonSummary.record} />
              <Copy render="p" fontSize="detail poster:label print:label" lineHeight="detail poster:label print:label" mt="0.5">
                <Copy render="strong" fontSize="detail poster:label print:label" lineHeight="detail poster:label print:label" fontWeight="700">{seasonSummary.points} points,</Copy> {seasonSummary.divisionPlace} in the {data.team.division}, {seasonSummary.streak}
              </Copy>
            </View>
            <View position="relative poster:absolute print:absolute" px="4 poster:0 print:0" t="poster:6 print:6" r="poster:12 print:12">
              <Copy render="p" text="left poster:right print:right" color="muted" fontSize="detail" lineHeight="label" fontWeight="600" mb="1">Through {snapshotDate}</Copy>
              <Copy render="p" text="left poster:right print:right" color="muted" fontSize="detail" lineHeight="label">Home {seasonSummary.home} · Road {seasonSummary.road} · Last 10 {seasonSummary.lastTen}</Copy>
              <Copy render="p" text="left poster:right print:right" color="muted" fontSize="detail" lineHeight="label">{seasonGames.length - completedGames.length} regular-season games remaining</Copy>
            </View>
          </View>
          <View mx="4 sm:6 poster:12 print:12">
            <View render="section" minH="seasonChart" aria-labelledby="season-heading">
              <Row minH="12" flexWrap="wrap" columnGap="2" rowGap="1" justify="space-between" items="baseline" pr="0 poster:10 print:10" pb="3">
                <Heading id="season-heading">The season, game by game</Heading>
                <Copy render="p" color="muted" fontSize="detail" lineHeight="detail">{completedGames.length} of {seasonGames.length} played, bar height = goal margin</Copy>
              </Row>
              <Chart data={data} kind="season" activeGame={activeGame} onActiveGameChange={setActiveGame} />
            </View>
            <View render="section" minH="hero" aria-labelledby="line-heading">
              <Row minH="12" flexWrap="wrap" columnGap="2" rowGap="1" justify="space-between" items="baseline" pr="0 poster:10 print:10" pb="3">
                <Heading id="line-heading">Playoff cushion{latestPlayoffCushion && (
                  <Score fontSize="stat" lineHeight="stat" ml="2">{` ${latestPlayoffCushion.signedGap}`}</Score>
                )}</Heading>
                <Copy render="p" color="muted" fontSize="detail" lineHeight="detail">{latestPlayoffCushion?.equation ?? 'No playoff data yet'}</Copy>
              </Row>
              <Chart data={data} kind="playoff" activeGame={activeGame} onActiveGameChange={setActiveGame} />
            </View>
            <View display="grid" gridTemplateColumns="minmax(0, 1fr) md:repeat(2, minmax(0, 1fr)) poster:1.5fr 1fr 1fr print:1.5fr 1fr 1fr" gap="8 poster:6 print:6" mt="4 poster:0 print:0">
              <View display="grid" gridTemplateColumns="minmax(0, 1fr) sm:repeat(2, minmax(0, 1fr)) print:repeat(2, minmax(0, 1fr))"
                gridColumn="md:1 / -1 poster:auto print:auto" content="flex-start" gap="4 print:6">
                {divisions.map(({ name, record, teams }) => (
                  <Division selectedTeam={data.team.abbrev} name={name} record={record} teams={teams} key={name} onPrefetchTeam={onPrefetchTeam}
                    activeGame={activeGame} onActiveGameChange={setActiveGame} />
                ))}
              </View>
              <PlayoffPicture data={data} onPrefetchTeam={onPrefetchTeam} />
              <Schedule data={data} onPrefetchTeam={onPrefetchTeam} />
            </View>
          </View>
          <Row render="footer" flexWrap="wrap" mx="4 sm:6 poster:12 print:12" mt="10" mb="8" minH="6" gap="6">
            <List maxW="100%" flexDirection="row" flexWrap="wrap" columnGap="6" rowGap="2">
              {([{ label: 'Win', color: 'win' }, { label: 'Loss', color: 'loss' }, { label: 'OT/SO loss', color: 'gold' }, { label: 'Still to play', color: 'pending' }] as const).map(({ label, color }) => (
                <Row render="li" gap="1.5" key={label}>
                  <View w="3" h="3" rounded="sm" opacity={0.75} bg={color === 'win' ? 'win' : color === 'loss' ? 'loss' : color === 'gold' ? 'gold' : 'pending'} />
                  <Copy color="muted" whiteSpace="nowrap">{label}</Copy>
                </Row>
              ))}
            </List>
            <Copy render="p" color="muted">Filled dot or house = home, ring or plane = away</Copy>
            <Copy color="muted">Original graphic by <a href="https://www.reddit.com/user/cloverrmatt/">u/cloverrmatt</a> · <a href="https://www.reddit.com/r/devils/s/jmn4emEiez">Original post</a></Copy>
            <Copy color="muted">Scores updated {data.fetchedAt} ET · Team stats updated {data.posterFetchedAt} ET</Copy>
            <Row ml="auto" flexWrap="wrap" columnGap="2" rowGap="1" justify="flex-end" maxW="100%">
              <Copy color="muted" letterSpacing={1} fontWeight="600">RinkSide</Copy>
              <Copy color="muted">by <a href="https://x.com/benschac">benschac</a> · <a href="https://github.com/benschac/barnburner">Open source</a></Copy>
            </Row>
          </Row>
        </View>
      </View>
  )
})
