import { samples } from '@nhl-reddit-stats/viz/samples'
import type { EgoTables, LabEntry } from '@nhl-reddit-stats/viz'
import { useMemo, useState, type ReactNode } from 'react'
import { Text, View } from 'tamagui'
import { G6Graph, type G6NodeProps } from '../../G6Graph'

/** The ego tables as G6 data: a node per player, an edge per link labelled with its games. Pure. */
export function egoGraph({ players, links }: EgoTables) {
  return {
    nodes: players.map((player) => ({ id: String(player.playerId), data: { name: player.name } })),
    edges: links.map((link) => ({
      id: `${link.a}-${link.b}`,
      source: String(link.a),
      target: String(link.b),
      style: { labelText: `${link.games}` },
    })),
  }
}

const data = egoGraph(samples.ego.tables)

/** A small node component, drawn by React inside the graph. */
function TinyNode({ data: nodeData }: G6NodeProps) {
  return (
    <View bg="surface" borderColor="rule" borderWidth={1} rounded="sm" p="2" items="center" justify="center" w="100%" h="100%">
      <Text fontFamily="body" color="color">{String(nodeData.name)}</Text>
    </View>
  )
}

type ChoiceProps<T extends string> = {
  readonly label: string
  readonly options: ReadonlyArray<T>
  readonly value: T
  readonly onChange: (value: T) => void
}

function Choice<T extends string>({ label, options, value, onChange }: ChoiceProps<T>) {
  return (
    <View flexDirection="row" gap="2" items="center" role="group" aria-label={label}>
      <Text fontFamily="body" color="muted">{label}</Text>
      {options.map((option) => (
        <View render="button" key={option} aria-pressed={value === option}
          minH="badge" px="3" items="center" justify="center" rounded="sm" cursor="pointer"
          bg={value === option ? 'highlight' : 'surface'}
          borderColor={value === option ? 'gold' : 'rule'} borderWidth={2}
          onClick={() => onChange(option)}>
          <Text fontFamily="body" color="color">{option}</Text>
        </View>
      ))}
    </View>
  )
}

function Demo() {
  const [layout, setLayout] = useState<'force' | 'dagre'>('force')
  const [renderer, setRenderer] = useState<'canvas' | 'webgl'>('canvas')
  const [node, setNode] = useState<'default' | 'react'>('default')
  const [hovered, setHovered] = useState<string | null>(null)
  // The hovered edge and every edge that shares an end with it.
  const highlightedEdges = useMemo(() => {
    const edge = data.edges.find((candidate) => candidate.id === hovered)
    if (!edge) return []
    return data.edges.filter((other) => [other.source, other.target].some((end) => end === edge.source || end === edge.target)).map((other) => other.id)
  }, [hovered])
  return (
    <View gap="3">
      <Choice label="layout" options={['force', 'dagre']} value={layout} onChange={setLayout} />
      <Choice label="renderer" options={['canvas', 'webgl']} value={renderer} onChange={setRenderer} />
      <Choice label="node" options={['default', 'react']} value={node} onChange={setNode} />
      <Text fontFamily="body" color="muted" role="status">hovered edge: {hovered ?? 'none'}; highlighted: {highlightedEdges.length}</Text>
      <G6Graph onEdgeHover={setHovered} highlightedEdges={highlightedEdges} data={data} layout={layout} renderer={renderer} node={node === 'react' ? TinyNode : undefined} height="drawer" />
    </View>
  )
}

const entry: LabEntry<ReactNode> = {
  title: 'G6 host: the ego sample, with every prop',
  render: () => <Demo />,
}

export default entry
