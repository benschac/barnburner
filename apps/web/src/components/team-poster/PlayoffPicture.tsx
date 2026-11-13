import { Fragment, memo } from 'react'
import { Image, View, useThemeName } from 'tamagui'
import type { TeamPosterData } from '../../stats'
import { teamHref, teamLogo } from '../../team-season'
import { navigateTeam } from '../../navigate-team.ts'
import { ColumnHeading, Copy, Label, List, Logo, Row, RuledHeading, Score, TableCell } from './primitives'

export const PlayoffPicture = memo(function PlayoffPicture({ data, onPrefetchTeam }: { data: TeamPosterData; onPrefetchTeam: (team: string) => void }) {
  const { standings, specialTeams, leaders } = data
  const theme = useThemeName()
  return (
    <View render="section" aria-labelledby="playoff-heading">
      <RuledHeading id="playoff-heading" mb="1.5">Playoff picture</RuledHeading>
      <View render="table" style={{ display: "table" }} w="100%" borderCollapse="collapse" tableLayout="fixed">
        <View render="colgroup" style={{ display: "table-column-group" }}>
          <View render="col" style={{ display: "table-column" }} w="17%" /><View render="col" style={{ display: "table-column" }} w="53%" /><View render="col" style={{ display: "table-column" }} w="15%" /><View render="col" style={{ display: "table-column" }} w="15%" />
        </View>
        <View render="thead" style={{ display: "table-header-group" }} h="icon">
          <View render="tr" style={{ display: "table-row" }}>
            <ColumnHeading {...{ colSpan: 2, scope: 'colgroup' }} text="left" pl="1.5" letterSpacing={1}>{data.team.division.toUpperCase()}</ColumnHeading>
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
              <View render="tr" style={{ display: "table-row" }} h="8" bg={team === data.team.abbrev ? 'highlight' : 'transparent'}
                cursor="pointer" onClick={() => navigateTeam(team)}
                onMouseEnter={() => onPrefetchTeam(team)} onFocus={() => onPrefetchTeam(team)}
                borderTopWidth={index === 5 ? 2 : 0} borderTopColor="gold" borderTopStyle="dashed">
                <TableCell render="td" pl="1.5" color="gold" fontSize="body" borderTopLeftRadius="sm" borderBottomLeftRadius="sm">{seed}</TableCell>
                <View render="th" {...{ scope: 'row' }} style={{ display: "table-cell" }} text="left" fontWeight="500">
                  <Row render={<a href={teamHref(team)} />} h="8" gap="4" textDecorationLine="none" onClick={(event) => event.stopPropagation()}>
                    <Logo src={team === 'WSH' ? '/assets/teams/WSH.svg' : teamLogo(team, theme)} alt={team} w="8" h="8" scale={1.4} />
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
      {specialTeams.length === 0 && <Copy color="muted">Special teams data is not available yet.</Copy>}
      <View display="grid" gridTemplateColumns="1fr 1fr" gap="3" mt="2">
        {specialTeams.map(({ label, rank, value }) => (
          <View key={label} bg="surface" rounded="md" h="card" py="1.5" px="3">
            <Label>{label}</Label>
            <Copy render="p" fontSize="caption" lineHeight="caption" color="muted">{rank} of 32</Copy>
            <Score render="p" fontSize="title" lineHeight="label">{value}<Copy fontSize="body" color="muted" ml="0.5">%</Copy></Score>
          </View>
        ))}
      </View>
      <View render="section" mt="4" aria-labelledby="leaders-heading">
        <RuledHeading id="leaders-heading">Team leaders</RuledHeading>
        {leaders.length === 0 && <Copy color="muted">Player leaders are not available yet.</Copy>}
        <List>
          {leaders.map((leader) => (
            <Row render="li" h="card" gap="3" key={leader.label}>
              <Image w="16" h="16" rounded="full" borderWidth={2} borderColor="brand" bg="surface" objectFit="cover" shrink={0}
                src={leader.portrait} alt="" />
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
})
