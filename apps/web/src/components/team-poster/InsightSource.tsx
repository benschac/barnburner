import { Dialog, View } from 'tamagui'
import type { PublishedInsight } from '@nhl-reddit-stats/season/rpc'
import { Copy, Label, List, Row } from './primitives'
import { GameBoxscoreDialog } from './GameBoxscore'

function columnsOf(result: PublishedInsight['result']): readonly string[] {
  return result.length === 0 ? [] : Object.keys(result[0]!)
}

function ResultTable({ result }: { result: PublishedInsight['result'] }) {
  const columns = columnsOf(result)

  if (columns.length === 0) return <Copy color="muted">The query returned no rows.</Copy>

  return (
    <View overflow="auto" borderWidth={1} borderColor="rule" rounded="sm">
      <View render="table" w="100%" aria-label="Query result">
        <View render="thead">
          <View render="tr">
            {columns.map((column) => (
              <Copy key={column} render="th" text="left" p="1.5" fontSize="caption" fontWeight="600" color="muted">{column}</Copy>
            ))}
          </View>
        </View>
        <View render="tbody">
          {result.map((row, index) => (
            <View render="tr" key={index} borderTopWidth={1} borderTopColor="rule">
              {columns.map((column) => (
                <Copy key={column} render="td" p="1.5" fontSize="caption">{String(row[column] ?? '')}</Copy>
              ))}
            </View>
          ))}
        </View>
      </View>
    </View>
  )
}

export function InsightSource({ insight }: { insight: PublishedInsight }) {
  const { coverage } = insight

  return (
    <Dialog>
      <Dialog.Trigger minH="8" px="1" items="center" justify="center" bg="transparent hover:surface" rounded="sm" borderWidth={1} cursor="pointer"
        borderColor="transparent focus-visible:gold" aria-label={`Source for ${insight.headline}`}>
        <Label render="span">SOURCE</Label>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay bg="background" opacity={0.9} />
        <Dialog.Content w="100%" maxW="chart" maxH="100vh" overflow="auto" bg="background" p="4 sm:8" borderWidth={1} borderColor="gold" rounded="md" gap="4">
          <Row justify="space-between" gap="3">
            <Dialog.Title m="0" fontFamily="body" fontSize="caption" lineHeight="caption" letterSpacing={1} fontWeight="600" color="gold">THE SOURCE</Dialog.Title>
            <Dialog.Close render="button" minH="10" px="3" py="2" items="center" justify="center" bg="transparent hover:surface" rounded="sm" borderWidth={1} cursor="pointer"
              borderColor="rule focus-visible:gold" aria-label="Close source"><Copy>Close ×</Copy></Dialog.Close>
          </Row>
          <Dialog.Description render={<Copy color="muted" fontSize="caption" />}>{insight.headline} · The query, its result, and the games behind it.</Dialog.Description>
          <View gap="1.5">
            <Label>QUERY</Label>
            <View render="pre" m="0" p="3" overflow="auto" bg="surface" rounded="sm" borderWidth={1} borderColor="rule">
              <Copy render="code" fontSize="caption">{insight.query}</Copy>
            </View>
          </View>
          <View gap="1.5">
            <Label>RESULT</Label>
            <ResultTable result={insight.result} />
            {coverage && <Copy color="muted" fontSize="caption">Based on box scores for {coverage.archived} of {coverage.finals} finals.</Copy>}
          </View>
          {insight.gameIds.length > 0 && (
            <View gap="1.5">
              <Label>GAMES</Label>
              <List>
                {insight.gameIds.map((gameId) => (
                  <Row render="li" key={gameId} gap="2" borderTopWidth={1} borderTopColor="rule">
                    <Copy flex={1}>Game {gameId}</Copy>
                    <GameBoxscoreDialog gameId={gameId} opponent={`game ${gameId}`} score="final" />
                  </Row>
                ))}
              </List>
            </View>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog>
  )
}
