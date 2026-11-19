import { useLayoutEffect, useRef } from 'react'
import { DateTime } from 'effect'
import { Theme, View, useThemeName } from 'tamagui'
import type { TamaguiElement } from 'tamagui'
import type { GameBoxscore } from '@nhl-reddit-stats/season/rpc'
import { teamBannerThemeName } from '../../../design/themes'
import { teamLogo, teams } from '../../team-season'
import { BannerLayer, Copy, Heading, Label, List, Logo, Row, Score } from './primitives'

type Team = GameBoxscore['homeTeam']
type StatRow = { id: number; name: string; label: string; values: readonly string[] }

const savePct = new Intl.NumberFormat('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 })
const gameDate = new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' })
const plural = (count: number, unit: string) => `${count} ${unit}${count === 1 ? '' : 's'}`

// Hockey convention drops the leading zero: .906, but 1.000 for a shutout.
const formatSavePct = (value: number | null) => value === null ? '–' : savePct.format(value).replace(/^0/, '')

const skaterRows = (team: Team): StatRow[] => team.scorers.map((player) => ({
  id: player.playerId,
  name: player.name,
  label: `${player.name}: ${plural(player.goals, 'goal')}, ${plural(player.assists, 'assist')}, ${plural(player.points, 'point')}`,
  values: [String(player.goals), String(player.assists), String(player.points)],
}))

const goalieRows = (team: Team): StatRow[] => team.goalies.map((goalie) => ({
  id: goalie.playerId,
  name: goalie.name,
  label: `${goalie.name}: ${goalie.saves} saves on ${plural(goalie.shotsAgainst, 'shot')}, save percentage ${formatSavePct(goalie.savePct)}`,
  values: [String(goalie.shotsAgainst), String(goalie.saves), formatSavePct(goalie.savePct)],
}))

// One stat block: a gold section label sharing a line with its column headings,
// then hairline-ruled rows whose last column carries the emphasis.
function StatTable({ label, columns, rows, empty }: { label: string; columns: readonly string[]; rows: StatRow[]; empty: string }) {
  return (
    <View mt="4">
      <Row h="6" gap="2">
        <Label render="h4" flex={1}>{label}</Label>
        {columns.map((column) => (
          <Copy key={column} aria-hidden w="10" text="right" fontSize="caption" lineHeight="caption" fontWeight="500" color="muted">{column}</Copy>
        ))}
      </Row>
      {rows.length === 0 && (
        <Row h="8" borderTopWidth={1} borderTopColor="rule">
          <Copy color="muted">{empty}</Copy>
        </Row>
      )}
      <List>
        {rows.map((row) => (
          <Row render="li" key={row.id} minH="10" gap="2" borderTopWidth={1} borderTopColor="rule" aria-label={row.label}>
            <Copy flex={1} minW="0">{row.name}</Copy>
            {row.values.map((value, index) => (
              <Copy key={columns[index]} w="10" text="right" fontWeight={index === row.values.length - 1 ? '700' : '400'}
                color={index === row.values.length - 1 ? 'color' : 'muted'}>{value}</Copy>
            ))}
          </Row>
        ))}
      </List>
    </View>
  )
}

function TeamBoxscore({ team, theme }: { team: Team; theme: string }) {
  return <View render="section" minW="0" aria-label={`${team.abbrev} box score`}>
    <Row gap="3" py="3" borderBottomWidth={2} borderBottomColor="gold">
      <Logo src={teamLogo(team.abbrev, theme)} alt="" w="16" h="16" />
      <View minW="0"><Heading render="h3" fontSize="label" lineHeight="label">{team.abbrev}</Heading><Copy color="muted" fontSize="caption">{teams.find(entry => entry.abbrev === team.abbrev)?.name ?? team.abbrev}</Copy></View>
    </Row>
    <StatTable label="POINT SCORERS" columns={['G', 'A', 'PTS']} rows={skaterRows(team)} empty="No skater points." />
    <StatTable label="GOALTENDING" columns={['SA', 'SV', 'SV%']} rows={goalieRows(team)} empty="No goalie line recorded." />
  </View>
}

function TeamBanner({ team }: { team: Team }) {
  return <View position="relative" w="100%" maxW="bannerOutline" h="banner" overflow="hidden">
    <Theme name={teamBannerThemeName(team.abbrev)}>
      <BannerLayer w="100%" bg="team-secondary" />
      <BannerLayer w="97%" bg="background" />
      <BannerLayer w="94%" bg="team-primary" />
    </Theme>
    <Logo src={teamLogo(team.abbrev, 'dark')} alt="" position="absolute" w="24 sm:hero" h="banner" l="0 sm:4" t="0" z={1} />
  </View>
}

function Scoreboard({ boxscore }: { boxscore: GameBoxscore }) {
  const { awayTeam, homeTeam, decision } = boxscore
  return <View gap="4" py="6" borderBottomWidth={2} borderBottomColor="rule" role="status"
    aria-label={`${awayTeam.abbrev} ${awayTeam.score}, ${homeTeam.abbrev} ${homeTeam.score}, final${decision === 'REG' ? '' : ` in ${decision === 'OT' ? 'overtime' : 'a shootout'}`}. Shots on goal: ${awayTeam.abbrev} ${awayTeam.shotsOnGoal}, ${homeTeam.abbrev} ${homeTeam.shotsOnGoal}.`}>
    <Label text="center" aria-hidden>{DateTime.formatIntl(DateTime.makeUnsafe(`${boxscore.date}T12:00:00Z`), gameDate)} · {decision === 'REG' ? 'FINAL' : `FINAL/${decision}`}</Label>
    <Row justify="space-between" gap="4 sm:8" items="flex-start" aria-hidden>
      {[awayTeam, homeTeam].map((team, index) => <View key={team.abbrev} flex={1} minW="0" items="center" gap="3">
        <TeamBanner team={team} />
        <Row w="100%" maxW="bannerOutline" justify="space-between" gap="2">
          <View gap="1"><Heading render="span" fontSize="label" lineHeight="label">{team.abbrev}</Heading><Copy color="muted" fontSize="caption">{index === 0 ? 'AWAY' : 'HOME'}</Copy></View>
          <Score fontSize="hero" lineHeight="hero" color={team.score > (index === 0 ? homeTeam.score : awayTeam.score) ? 'bright' : 'muted'}>{team.score}</Score>
        </Row>
      </View>)}
    </Row>
    <Row justify="center" gap="4" aria-hidden><Score>{awayTeam.shotsOnGoal}</Score><Label color="muted">SHOTS ON GOAL</Label><Score>{homeTeam.shotsOnGoal}</Score></Row>
  </View>
}

export function BoxscoreSheet({ boxscore }: { boxscore: GameBoxscore }) {
  const theme = useThemeName()
  const ref = useRef<TamaguiElement>(null)
  useLayoutEffect(() => {
    const element = ref.current
    if (!(element instanceof HTMLElement) || matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const animation = element.animate([
      { opacity: 0, transform: 'translateY(8px)' },
      { opacity: 1, transform: 'translateY(0)' },
    ], { duration: 180, easing: 'cubic-bezier(0.23, 1, 0.32, 1)' })
    return () => animation.cancel()
  }, [])
  return <View ref={ref}>
    <Scoreboard boxscore={boxscore} />
    <View display="grid" gridTemplateColumns="minmax(0, 1fr) sm:repeat(2, minmax(0, 1fr)) print:repeat(2, minmax(0, 1fr))" gap="8" pt="4">
      <TeamBoxscore team={boxscore.awayTeam} theme={theme} /><TeamBoxscore team={boxscore.homeTeam} theme={theme} />
    </View>
    <Row justify="space-between" flexWrap="wrap" gap="2" mt="6" pt="4" borderTopWidth={1} borderTopColor="rule"><Label>OFFICIAL FINAL</Label><Copy color="muted" fontSize="caption">NHL archive · {boxscore.gameId}</Copy></Row>
  </View>
}
