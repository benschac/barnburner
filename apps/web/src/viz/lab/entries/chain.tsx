"use client";

import { useAtomValue } from "@effect/atom-react";
import { DEFAULT_FILTER } from "@nhl-reddit-stats/history/shapes";
import { ChainTables } from "@nhl-reddit-stats/viz";
import type { LabEntry } from "@nhl-reddit-stats/viz";
import { Option, Schema } from "effect";
import { Atom } from "effect/reactivity";
import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { Text, View } from "tamagui";

import { findPath } from "../../../explorer/history-atoms.ts";
import { PathResults } from "../../../explorer/PathResults.tsx";
import { PlayerPicker } from "../../../explorer/PlayerPicker.tsx";
import { fromAtom, toAtom } from "../../../explorer/url-state.ts";
import { G6Graph } from "../../G6Graph";
import type { G6NodeProps } from "../../G6Graph";
import { PlayerCard } from "../../PlayerCard";
import { chainGraph } from "../../specs/chain";
import type { ChainGraph, ChainNodeData } from "../../specs/chain";
import preview from "../data/chain-8478402-8471675.json";

const previewTables = Schema.decodeUnknownSync(ChainTables)(preview.tables);
const snapshot = chainGraph(previewTables);
// G6Graph rebuilds when its data changes, so the object must keep its identity between renders.
const snapshotData = { nodes: snapshot.nodes, edges: snapshot.edges };

/** Teammate chains only: the relation and filter are fixed, so leftover search-page params change nothing. */
const chainPathAtom = Atom.make((get) => {
  const from = get(fromAtom);
  const to = get(toAtom);
  if (Option.isNone(from) || Option.isNone(to)) return Option.none();
  return Option.some({
    from: from.value,
    to: to.value,
    search: get(
      findPath({
        from: from.value,
        to: to.value,
        filter: DEFAULT_FILTER,
        relation: "with",
        limit: 10,
      })
    ),
  });
});

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

function SnapshotView() {
  const [hovered, setHovered] = useState<string | null>(null);
  // Hovering an edge highlights every edge of every chain that uses it.
  const highlightedEdges = useMemo(
    () =>
      hovered === null
        ? []
        : snapshot.chains.filter((chain) => chain.includes(hovered)).flat(),
    [hovered]
  );
  const summary = previewTables.summary[0];
  const graph = snapshot;
  const hoveredEdge = graph.edges.find((edge) => edge.id === hovered);

  return (
    <View gap="3">
      <Text fontFamily="body" color="muted">
        Example: Connor McDavid to Sidney Crosby, from the 17 November 2026
        snapshot. Choose two players to search live.
      </Text>
      {summary === undefined ? null : (
        <Text fontFamily="body" color="color">
          {`Distance ${summary.distance} · ${summary.pathCount}${summary.pathCountCapped === 1 ? "+" : ""} chain${summary.pathCount === 1 ? "" : "s"}${summary.pathCount > graph.chains.length ? `, showing ${graph.chains.length}` : ""}`}
        </Text>
      )}
      <Text fontFamily="body" color="muted" role="status">
        {hoveredEdge ? `Hovering: ${hoveredEdge.data.label}` : "Hover an edge"}
      </Text>
      <G6Graph
        data={snapshotData}
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

function LiveResults() {
  const chain = useAtomValue(chainPathAtom);
  return Option.match(chain, {
    onNone: () => <SnapshotView />,
    onSome: ({ from, to, search }) => (
      <PathResults from={from} to={to} search={search} />
    ),
  });
}

function ChainView() {
  return (
    <View gap="4">
      <PlayerPicker param="from" label="From player" />
      <PlayerPicker param="to" label="To player" />
      <LiveResults />
    </View>
  );
}

const entry: LabEntry<ReactNode> = {
  title: "Teammate chains",
  render: () => <ChainView />,
};

export default entry;
