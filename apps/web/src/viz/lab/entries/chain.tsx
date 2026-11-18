import { ChainTables, type LabEntry } from '@nhl-reddit-stats/viz'
import { samples } from '@nhl-reddit-stats/viz/samples'
import { Result, Schema } from 'effect'
import { useMemo, useState } from 'react'
import type { ChangeEvent, ReactNode } from 'react'
import { Text, View } from 'tamagui'
import { G6Graph, type G6NodeProps } from '../../G6Graph'
import { PlayerCard } from '../../PlayerCard'
import { chainGraph, type ChainGraph, type ChainNodeData } from '../../specs/chain'

// An export file is { tables, notes }, as the export command writes it.
const ChainFile = Schema.Struct({ tables: ChainTables, notes: Schema.String })
const decodeChainText = Schema.decodeUnknownResult(Schema.fromJsonString(ChainFile))

/** A file that decodes can still name a player the tables do not list; chainGraph would throw on that. */
function chainFileProblem(tables: ChainTables): string | undefined {
  if (tables.summary.length === 0) return 'the file has no summary row'
  const known = new Set(tables.players.map((player) => player.playerId))
  const summary = tables.summary[0]
  if (summary === undefined || !known.has(summary.from) || !known.has(summary.to)) return 'the summary names a player the file does not list'
  const stray = tables.hops.find((hop) => !known.has(hop.from) || !known.has(hop.to))
  return stray === undefined ? undefined : 'a hop names a player the file does not list'
}

function ChainPlayer({ data }: G6NodeProps) {
  // foreign: G6 hands node data back untyped; chainGraph wrote exactly these fields.
  const player = data as ChainNodeData
  return (
    <PlayerCard
      name={player.name}
      position={player.position}
      firstSeason={player.firstSeason}
      lastSeason={player.lastSeason}
      games={player.games}
      emphasis={player.end}
    />
  )
}

/** The player IDs along one chain, from its first edge's source through each edge's target. */
function chainIds(graph: ChainGraph, chain: ReadonlyArray<string>): string {
  const ordered = chain.flatMap((id) => graph.edges.filter((edge) => edge.id === id))
  const first = ordered[0]
  if (first === undefined) return 'no hops'
  return [first.source, ...ordered.map((edge) => edge.target)].join(' – ')
}

function ChainView() {
  const [tables, setTables] = useState<ChainTables>(samples.chain.tables)
  const [note, setNote] = useState('Sample: 11 to 14.')
  const [hovered, setHovered] = useState<string | null>(null)
  const graph = useMemo(() => chainGraph(tables), [tables])
  // Hovering an edge highlights every edge of every chain that uses it.
  const highlightedEdges = useMemo(
    () => (hovered === null ? [] : graph.chains.filter((chain) => chain.includes(hovered)).flat()),
    [graph, hovered],
  )
  // G6Graph rebuilds when its data changes, so the object must keep its identity between renders.
  const data = useMemo(() => ({ nodes: graph.nodes, edges: graph.edges }), [graph])
  const summary = tables.summary[0]
  const hoveredEdge = graph.edges.find((edge) => edge.id === hovered)

  async function onFile(event: ChangeEvent<HTMLInputElement>) {
    const picked = event.target.files?.[0]
    if (picked === undefined) return
    const decoded = decodeChainText(await picked.text())
    if (!Result.isSuccess(decoded)) {
      setNote(`${picked.name} is not a chain export.`)
      return
    }
    const problem = chainFileProblem(decoded.success.tables)
    if (problem !== undefined) {
      setNote(`${picked.name}: ${problem}.`)
      return
    }
    setTables(decoded.success.tables)
    setNote(`Loaded ${picked.name}.`)
  }

  return (
    <View gap="3">
      <Text fontFamily="body" color="muted">{note}</Text>
      <label>
        <Text fontFamily="body" color="muted">Chain export </Text>
        <input type="file" accept="application/json" onChange={(event) => { void onFile(event) }} />
      </label>
      {summary === undefined ? null : (
        <Text fontFamily="body" color="color">
          {`Distance ${summary.distance} · ${summary.pathCount}${summary.pathCountCapped === 1 ? '+' : ''} chain${summary.pathCount === 1 ? '' : 's'}${summary.pathCount > graph.chains.length ? `, showing ${graph.chains.length}` : ''}`}
        </Text>
      )}
      <Text fontFamily="body" color="muted" role="status">{hoveredEdge ? `Hovering: ${hoveredEdge.data.label}` : 'Hover an edge'}</Text>
      <G6Graph data={data} layout="dagre" node={ChainPlayer} height="drawer" onEdgeHover={setHovered} highlightedEdges={highlightedEdges} />
      <View gap="1">
        {graph.chains.map((chain, index) => (
          <Text key={index} fontFamily="body" color="color">{`Chain ${index + 1}: ${chainIds(graph, chain)}`}</Text>
        ))}
      </View>
    </View>
  )
}

const entry: LabEntry<ReactNode> = {
  title: 'Chain view: the chain sample, or an exported chain file',
  render: () => <ChainView />,
}

export default entry
