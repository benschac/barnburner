import { ChainTables, type LabEntry } from '@nhl-reddit-stats/viz'
import { samples } from '@nhl-reddit-stats/viz/samples'
import { Effect, Match, Result, Schema } from 'effect'
import { useMemo, useRef, useState } from 'react'
import type { ChangeEvent, ReactNode } from 'react'
import { Text, View } from 'tamagui'
import { G6Graph, type G6NodeProps } from '../../G6Graph'
import { PlayerCard } from '../../PlayerCard'
import { chainGraph, type ChainGraph, type ChainNodeData } from '../../specs/chain'

// An export file is { tables, notes }, as the export command writes it.
const ChainFile = Schema.Struct({ tables: ChainTables, notes: Schema.String })
const decodeChainText = Schema.decodeUnknownResult(Schema.fromJsonString(ChainFile))

class ChainFileReadError extends Schema.TaggedError<ChainFileReadError>()('ChainFileReadError', {
  fileName: Schema.String,
  reason: Schema.String,
}) {}

class ChainFileDecodeError extends Schema.TaggedError<ChainFileDecodeError>()('ChainFileDecodeError', {
  fileName: Schema.String,
}) {}

class ChainFileNoSummary extends Schema.TaggedError<ChainFileNoSummary>()('ChainFileNoSummary', {}) {}

/** A summary or hop names a player the players table does not list; chainGraph would throw on that. */
class ChainFileMissingPlayer extends Schema.TaggedError<ChainFileMissingPlayer>()('ChainFileMissingPlayer', {
  row: Schema.Literals(['summary', 'hop']),
  playerId: Schema.Int,
}) {}

type ChainFileFailure = ChainFileReadError | ChainFileDecodeError | ChainFileNoSummary | ChainFileMissingPlayer

function chainFileProblem(tables: ChainTables): Result.Result<ChainTables, ChainFileNoSummary | ChainFileMissingPlayer> {
  const summary = tables.summary[0]
  if (summary === undefined) return Result.fail(new ChainFileNoSummary({}))
  const known = new Set(tables.players.map((player) => player.playerId))
  for (const playerId of [summary.from, summary.to]) {
    if (!known.has(playerId)) return Result.fail(new ChainFileMissingPlayer({ row: 'summary', playerId }))
  }
  for (const hop of tables.hops) {
    for (const playerId of [hop.from, hop.to]) {
      if (!known.has(playerId)) return Result.fail(new ChainFileMissingPlayer({ row: 'hop', playerId }))
    }
  }
  return Result.succeed(tables)
}

const describeFailure = (failure: ChainFileFailure): string =>
  Match.valueTags(failure, {
    ChainFileReadError: ({ fileName, reason }) => `${fileName} could not be read: ${reason}.`,
    ChainFileDecodeError: ({ fileName }) => `${fileName} is not a chain export.`,
    ChainFileNoSummary: () => 'the file has no summary row.',
    ChainFileMissingPlayer: ({ row, playerId }) => `the ${row} names player ${playerId}, which the players table does not list.`,
  })

/** Reads, decodes, and checks one picked file. Every failure is a tagged error. */
const loadChainFile = (picked: File) =>
  Effect.gen(function* () {
    // foreign: the browser's read error is translated into a tagged error here.
    const text = yield* Effect.tryPromise({
      try: () => picked.text(),
      catch: (cause) => new ChainFileReadError({ fileName: picked.name, reason: String(cause) }),
    })
    const decoded = decodeChainText(text)
    if (!Result.isSuccess(decoded)) return yield* new ChainFileDecodeError({ fileName: picked.name })
    const checked = chainFileProblem(decoded.success.tables)
    if (!Result.isSuccess(checked)) return yield* checked.failure
    return checked.success
  })

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

/** The players' names along one chain, from its first edge's source through each edge's target, in chain order. */
function chainNames(graph: ChainGraph, chain: ReadonlyArray<string>): string {
  const names = new Map(graph.nodes.map((node) => [node.id, node.data.name]))
  const ordered = chain.flatMap((id) => graph.edges.filter((edge) => edge.id === id))
  const first = ordered[0]
  if (first === undefined) return 'no hops'
  return [first.source, ...ordered.map((edge) => edge.target)].map((id) => names.get(id) ?? id).join(' – ')
}

function ChainView() {
  const [tables, setTables] = useState<ChainTables>(samples.chain.tables)
  const [note, setNote] = useState('Sample: 11 to 14.')
  const [hovered, setHovered] = useState<string | null>(null)
  const latestPick = useRef(0)
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
    const pick = latestPick.current + 1
    latestPick.current = pick
    const outcome = await Effect.runPromise(Effect.result(loadChainFile(picked)))
    // Only the latest pick may update the graph or the status.
    if (pick !== latestPick.current) return
    if (Result.isSuccess(outcome)) {
      setTables(outcome.success)
      setNote(`Loaded ${picked.name}.`)
    } else {
      setNote(describeFailure(outcome.failure))
    }
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
          <Text key={index} fontFamily="body" color="color">{`Chain ${index + 1}: ${chainNames(graph, chain)}`}</Text>
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
