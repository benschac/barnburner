import { View, useThemeName } from 'tamagui'
import { gameDateTime } from '../../stats'
import type { Matchup } from '../../stats'
import { teamHref, teamLogo } from '../../team-season.ts'
import { navigateTeam } from '../../navigate-team.ts'
import { Copy, Score, Row, List, Logo } from './primitives'

const outcomeColors = { win: 'win', loss: 'loss', overtime: 'gold', pending: 'pending' } as const


export function Division({ name, record, teams, selectedTeam, activeGame, onActiveGameChange, onPrefetchTeam }: {
  name: string
  record: string
  teams: Matchup[]
  selectedTeam: string
  activeGame: number | null
  onActiveGameChange: (index: number | null) => void
  onPrefetchTeam: (team: string) => void
}) {
  const theme = useThemeName()
  const selectedGame = teams.flatMap(({ games }) => games).find(({ index }) => index === activeGame)?.game

  return (
    <View render="section" aria-label={`${name} division matchups`}>
      <Row render="h3" h="10" justify="space-between" items="baseline" borderBottomWidth={2} borderBottomColor="rule" m="0">
        <Copy fontSize="label" lineHeight="label" fontWeight="700">{name}</Copy>
        <Score color="gold" fontSize="label" lineHeight="detail">{record}</Score>
      </Row>
      <List pt="1.5">
        {teams.map(({ team, games }) => {
          return (
            <Row render="li" h="8" gap="4" key={team} cursor="pointer" onClick={() => navigateTeam(team)}
              onMouseEnter={() => onPrefetchTeam(team)} onFocus={() => onPrefetchTeam(team)}
              bg={selectedGame?.team === team ? 'highlight print:transparent' : 'transparent'}>
              <View render={<a href={teamHref(team)} />} aria-label={`View ${team} wins and losses`} onClick={(event) => event.stopPropagation()}>
                <Logo src={teamLogo(team, theme)} alt={team} w="8" h="icon" scale={1.18} />
              </View>
              <Row gap="1">
                {games.map(({ game, index, outcome }) => {
                  const { result, venue } = game
                  const label = result
                    ? `${outcome === 'overtime' ? 'OT/SO loss' : outcome}, ${selectedTeam} ${result.goalsFor}–${result.goalsAgainst} ${team}${result.decision === 'REG' ? '' : ` ${result.decision}`}`
                    : 'still to play'
                  return (
                    <View render={<a href={teamHref(team)} />} key={game.id} w="icon" h="icon" p="0" items="center" justify="center"
                      bg="transparent hover:surface" rounded="sm" borderWidth={1} cursor="pointer"
                      borderColor={index === activeGame ? 'gold print:transparent' : 'transparent focus-visible:gold'}
                      aria-label={`${venue === 'home' ? 'vs' : 'at'} ${team}, ${gameDateTime(game)}, ${label}`}
                      onMouseEnter={() => onActiveGameChange(index)}
                      onMouseLeave={(event) => {
                        if (event.currentTarget !== document.activeElement) onActiveGameChange(null)
                      }}
                      onFocus={() => onActiveGameChange(index)} onBlur={() => onActiveGameChange(null)}
                      onClick={(event) => event.stopPropagation()}
                    >
                      <View w="6" h="6" bg={outcomeColors[outcome]} maskRepeat="no-repeat" maskSize="contain" maskPosition="center"
                        maskImage={`url('/assets/icons/${venue === 'home' ? 'home' : 'flight'}.svg')`}
                        rotate={venue === 'away' ? '90deg' : '0deg'} />
                    </View>
                  )
                })}
              </Row>
            </Row>
          )
        })}
      </List>
      <View h="16" overflow="hidden" pt="1" display="print:none" position={selectedGame ? 'sticky sm:static' : 'static'} pointerEvents="none" b="0" bg="background" z={1}>
        {selectedGame && (
          <Copy fontSize="caption" lineHeight="caption" color="muted">
            {gameDateTime(selectedGame)} · {selectedGame.venue === 'home' ? 'vs' : 'at'} {selectedGame.team} · {selectedGame.result
              ? `${selectedGame.result.goalsFor}–${selectedGame.result.goalsAgainst}${selectedGame.result.decision === 'REG' ? '' : ` ${selectedGame.result.decision}`}`
              : 'Still to play'}
          </Copy>
        )}
      </View>
    </View>
  )
}
