import { ChainTables } from "@nhl-reddit-stats/viz";
import type { LabEntry } from "@nhl-reddit-stats/viz";
import { Result, Schema } from "effect";
import { useMemo, useRef, useState } from "react";
import type { ChangeEvent, ReactNode } from "react";
import { Text, View } from "tamagui";

import { useChainFile } from "../../../use-chain-file";
import { describeFailure } from "../../chain-file";
import { G6Graph } from "../../G6Graph";
import type { G6NodeProps } from "../../G6Graph";
import { PlayerCard } from "../../PlayerCard";
import { chainGraph } from "../../specs/chain";
import type { ChainGraph, ChainNodeData } from "../../specs/chain";
import preview from "../data/chain-8478402-8471675.json";

const previewTables = Schema.decodeUnknownSync(ChainTables)(preview.tables);

function ChainPlayer({ data }: G6NodeProps) {
  // SAFETY: G6 hands node data back untyped; chainGraph wrote exactly these fields.
  const player = data as ChainNodeData;
  return (
    <PlayerCard
      name={player.name}
      position={player.position}
      firstSeason={player.firstSeason}
      lastSeason={player.lastSeason}
      games={player.games}
      emphasis={player.end}
    />
  );
}

/** The players' names along one chain, from its first edge's source through each edge's target, in chain order. */
function chainNames(graph: ChainGraph, chain: readonly string[]): string {
  const names = new Map(graph.nodes.map((node) => [node.id, node.data.name]));
  const ordered = chain.flatMap((id) =>
    graph.edges.filter((edge) => edge.id === id)
  );
  const first = ordered[0];
  if (first === undefined) return "no hops";
  return [first.source, ...ordered.map((edge) => edge.target)]
    .map((id) => names.get(id) ?? id)
    .join(" – ");
}

function ChainView() {
  const [tables, setTables] = useState<ChainTables>(previewTables);
  const [note, setNote] = useState(
    "Historical snapshot: Connor McDavid to Sidney Crosby. Loaded with the page."
  );
  const [hovered, setHovered] = useState<string | null>(null);
  const latestPick = useRef(0);
  const readChainFile = useChainFile();
  const graph = useMemo(() => chainGraph(tables), [tables]);
  // Hovering an edge highlights every edge of every chain that uses it.
  const highlightedEdges = useMemo(
    () =>
      hovered === null
        ? []
        : graph.chains.filter((chain) => chain.includes(hovered)).flat(),
    [graph, hovered]
  );
  // G6Graph rebuilds when its data changes, so the object must keep its identity between renders.
  const data = useMemo(
    () => ({ nodes: graph.nodes, edges: graph.edges }),
    [graph]
  );
  const summary = tables.summary[0];
  const hoveredEdge = graph.edges.find((edge) => edge.id === hovered);

  async function onFile(event: ChangeEvent<HTMLInputElement>) {
    const picked = event.target.files?.[0];
    if (picked === undefined) return;
    const pick = latestPick.current + 1;
    latestPick.current = pick;
    const outcome = await readChainFile(picked);
    // Only the latest pick may update the graph or the status.
    if (pick !== latestPick.current) return;
    if (Result.isSuccess(outcome)) {
      setTables(outcome.success);
      setNote(`Loaded ${picked.name}.`);
    } else {
      setNote(describeFailure(outcome.failure));
    }
  }

  return (
    <View gap="3">
      <Text fontFamily="body" color="muted">
        {note}
      </Text>
      <label>
        <Text fontFamily="body" color="muted">
          Chain export{" "}
        </Text>
        <input
          type="file"
          accept="application/json"
          onChange={(event) => {
            void onFile(event);
          }}
        />
      </label>
      {summary === undefined ? null : (
        <Text fontFamily="body" color="color">
          {`Distance ${summary.distance} · ${summary.pathCount}${summary.pathCountCapped === 1 ? "+" : ""} chain${summary.pathCount === 1 ? "" : "s"}${summary.pathCount > graph.chains.length ? `, showing ${graph.chains.length}` : ""}`}
        </Text>
      )}
      <Text fontFamily="body" color="muted" role="status">
        {hoveredEdge ? `Hovering: ${hoveredEdge.data.label}` : "Hover an edge"}
      </Text>
      <G6Graph
        data={data}
        layout="dagre"
        node={ChainPlayer}
        height="drawer"
        onEdgeHover={setHovered}
        highlightedEdges={highlightedEdges}
      />
      <View gap="1">
        {graph.chains.map((chain, index) => (
          <Text
            key={index}
            fontFamily="body"
            color="color"
          >{`Chain ${index + 1}: ${chainNames(graph, chain)}`}</Text>
        ))}
      </View>
    </View>
  );
}

const entry: LabEntry<ReactNode> = {
  title: "Teammate chains",
  render: () => <ChainView />,
};

export default entry;
