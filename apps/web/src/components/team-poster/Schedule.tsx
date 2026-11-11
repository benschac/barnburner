import { memo } from 'react'
import { View, useThemeName } from 'tamagui'
import type { TeamPosterData } from '../../stats'
import { teamHref, teamLogo } from '../../team-season.ts'
import { Copy, Score, Row, List, Logo, RuledHeading } from './primitives'

const outcomeColors = { win: 'win', loss: 'loss', overtime: 'gold', pending: 'pending' } as const


export const Schedule = memo(function Schedule({ data, onPrefetchTeam }: { data: TeamPosterData; onPrefetchTeam: (team: string) => void }) {
  const { upcoming, recent } = data
  const theme = useThemeName()
  return (
    <View>
      <View render="section" aria-labelledby="next-heading">
        <RuledHeading id="next-heading" display="flex" flexDirection="row" justify="space-between" items="baseline">
          Next 5<Copy fontSize="caption" lineHeight="caption" letterSpacing={1} color="muted" fontWeight="500">EASTERN TIME</Copy>
        </RuledHeading>
        {upcoming.length === 0 && <Copy color="muted">No remaining games.</Copy>}
        <List render="ol" gap="2">
          {upcoming.map((game) => (
            <Row render="li" key={game.id} h="card" bg="surface" rounded="md">
              <Row render={<a href={teamHref(game.team)} />} w="100%" h="card" textDecorationLine="none"
                onMouseEnter={() => onPrefetchTeam(game.team)} onFocus={() => onPrefetchTeam(game.team)}>
              <Row h="card" w="24" borderWidth={2} borderColor="gold" borderRightStyle="dashed" borderTopLeftRadius="md" borderBottomLeftRadius="md">
                <Copy fontSize="caption" lineHeight="caption" fontWeight="600" color="gold" writingMode="vertical-rl" rotate="180deg" w="icon" text="center">{game.day}</Copy>
                <Score fontSize="score" lineHeight="score" flex={1} text="center">{game.date}</Score>
              </Row>
              <Copy fontSize="detail" lineHeight="detail" color="muted" w="12" text="center">{game.venue}</Copy>
              <Logo src={teamLogo(game.team, theme)} alt={game.team} w="12" h="12" scale={1.4} />
              <Copy flex={1} text="center" fontSize="label" lineHeight="label" fontWeight="500">{game.time}</Copy>
              </Row>
            </Row>
          ))}
        </List>
      </View>
      <View render="section" mt="4" aria-labelledby="last-heading">
        <RuledHeading id="last-heading" mb="2">Last 5</RuledHeading>
        {recent.length === 0 && <Copy color="muted">No final games yet.</Copy>}
        <List render="ol">
          {recent.map((game) => (
            <Row render="li" h="12" key={game.id}>
              <Row render={<a href={teamHref(game.team)} />} w="100%" h="12" gap="3" textDecorationLine="none"
                onMouseEnter={() => onPrefetchTeam(game.team)} onFocus={() => onPrefetchTeam(game.team)}>
              <Logo src={game.team === 'WSH' ? '/assets/teams/WSH.svg' : teamLogo(game.team, theme)} alt={game.team} w="16" h="10" mr="px" scale={1.07} />
              <Copy w="10" h="10" display="flex" items="center" justify="center" rounded="sm" fontFamily="result" fontSize="title" lineHeight="label"
                bg={outcomeColors[game.outcome]} color={game.outcome === 'win' ? 'result-ink' : 'loss-ink'}>{game.outcome === 'win' ? 'W' : 'L'}</Copy>
              <Copy fontSize="title" lineHeight="title" fontWeight="500">{game.score}</Copy>
              <Copy fontSize="body" lineHeight="caption" color="gold" ml="px">{game.extra}</Copy>
              </Row>
            </Row>
          ))}
        </List>
      </View>
    </View>
  )
})
