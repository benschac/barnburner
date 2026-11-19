import { View } from 'tamagui'
import type { PublishedInsight } from '@nhl-reddit-stats/season/rpc'
import { InsightSource } from './InsightSource'
import { Copy, List, Row, RuledHeading } from './primitives'

export function Notes({ insights }: { insights: readonly PublishedInsight[] }) {
  if (insights.length === 0) return null

  return (
    <View render="section" aria-labelledby="notes-heading" gridColumn="md:1 / -1 poster:auto print:auto">
      <RuledHeading id="notes-heading">Notes</RuledHeading>
      <List display="grid" gridTemplateColumns="minmax(0, 1fr) sm:repeat(2, minmax(0, 1fr)) print:repeat(2, minmax(0, 1fr))" gap="4">
        {insights.slice(0, 3).map((insight) => (
          <View render="li" key={insight.headline} gap="1.5">
            <Row justify="space-between" items="baseline" gap="2">
              <Copy render="h3" fontWeight="700">{insight.headline}</Copy>
              <InsightSource insight={insight} />
            </Row>
            <Copy render="p">{insight.body}</Copy>
          </View>
        ))}
      </List>
    </View>
  )
}
