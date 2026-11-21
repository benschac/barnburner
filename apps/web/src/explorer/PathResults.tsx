"use client";

import { useAtomValue } from "@effect/atom-react";
import type {
  FindPathResult,
  HistoryUnavailable,
  NoPath,
  UnknownPlayer,
  UnsupportedFilter,
} from "@nhl-reddit-stats/history/rpc";
import { Cause, Match, Option } from "effect";
import { Atom, AsyncResult } from "effect/reactivity";
import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { Text, View } from "tamagui";

import { G6Graph } from "../viz/G6Graph.tsx";
import type { G6NodeProps } from "../viz/G6Graph.tsx";
import { PlayerCard } from "../viz/PlayerCard.tsx";
import { player } from "./history-atoms.ts";
import { pathGraph, pathPlayerIds } from "./path-graph.ts";
import type { PathGraph, PathNodeData, PlayerDetail } from "./path-graph.ts";

type PathResult = typeof FindPathResult.Type;
type SearchError =
  | HistoryUnavailable
  | UnknownPlayer
  | NoPath
  | UnsupportedFilter;
type DetailError = HistoryUnavailable | UnknownPlayer;

/** Shown for an UnsupportedFilter error unless the caller supplies its own. */
const defaultUnsupportedFilter = (
  <Text fontFamily="body" color="color">
    Opponent and either chains ignore competition, season and goalie-partner
    filters. Clear the filters to search.
  </Text>
);

const fallbackMessage = "Something went wrong. Try again.";

const searchError = (
  error: SearchError,
  unsupportedFilter: ReactNode
): ReactNode =>
  Match.valueTags(error, {
    NoPath: () =>
      "No chain connects these two players with the current settings.",
    UnknownPlayer: ({ playerId }) => `No player has ID ${playerId}.`,
    UnsupportedFilter: () => unsupportedFilter,
    HistoryUnavailable: ({ message }) => message,
  });

const detailError = (error: DetailError): string =>
  Match.valueTags(error, {
    UnknownPlayer: ({ playerId }) => `No player has ID ${playerId}.`,
    HistoryUnavailable: ({ message }) => message,
  });

/** One AsyncResult per distinct list of player IDs, so the details load once however often the page renders. */
const detailsFamily = Atom.family((ids: string) =>
  Atom.make((get) =>
    AsyncResult.all(
      ids.split(",").map((id) => get(player({ playerId: Number(id) })))
    )
  )
);

const summaryText = (result: PathResult, shown: number): string =>
  result.distance === 0
    ? "Same player"
    : `Distance ${result.distance} · ${result.pathCount}${result.pathCountCapped ? "+" : ""} chain${result.pathCount === 1 ? "" : "s"}${result.pathCount > shown ? `, showing ${shown}` : ""}`;

function SearchPlayer({ data }: G6NodeProps) {
  // SAFETY: G6 hands node data back untyped; pathGraph wrote exactly these fields.
  const node = data as PathNodeData;
  return (
    <PlayerCard
      name={node.name}
      position={node.position}
      firstSeason={node.firstSeason}
      lastSeason={node.lastSeason}
      games={node.games}
      emphasis={node.end}
    />
  );
}

type ChainsProps = {
  readonly result: PathResult;
  readonly graph: PathGraph;
};

function Chains({ result, graph }: ChainsProps) {
  const [hovered, setHovered] = useState<string | null>(null);
  // Hovering an edge highlights every edge of every chain that uses it.
  const highlightedEdges = useMemo(
    () =>
      hovered === null
        ? []
        : graph.chains
            .filter((chain) => chain.edgeIds.includes(hovered))
            .flatMap((chain) => chain.edgeIds),
    [graph, hovered]
  );
  // G6Graph rebuilds when its data changes, so the object must keep its identity between renders.
  const data = useMemo(
    () => ({ nodes: graph.nodes, edges: graph.edges }),
    [graph]
  );
  const hoveredEdge = graph.edges.find((edge) => edge.id === hovered);
  return (
    <View gap="3">
      <Text fontFamily="body" color="color">
        {summaryText(result, graph.chains.length)}
      </Text>
      <Text fontFamily="body" color="muted" role="status">
        {hoveredEdge ? `Hovering: ${hoveredEdge.data.label}` : "Hover an edge"}
      </Text>
      <G6Graph
        data={data}
        layout="dagre"
        node={SearchPlayer}
        height="drawer"
        onEdgeHover={setHovered}
        highlightedEdges={highlightedEdges}
      />
      <View gap="1">
        {graph.chains.map((chain, index) => (
          <Text key={index} fontFamily="body" color="color">
            {`Chain ${index + 1}: ${chain.names.join(" – ")}`}
          </Text>
        ))}
      </View>
    </View>
  );
}

type FoundProps = {
  readonly from: number;
  readonly to: number;
  readonly result: PathResult;
};

function Found({ from, to, result }: FoundProps) {
  const ids = pathPlayerIds(result, from, to);
  const details = useAtomValue(detailsFamily(ids.join(",")));
  const graph = useMemo(
    () =>
      AsyncResult.isSuccess(details)
        ? Option.some(
            pathGraph({
              from,
              to,
              result,
              players: new Map<number, PlayerDetail>(
                details.value.map((detail) => [detail.player.playerId, detail])
              ),
            })
          )
        : Option.none(),
    [details, from, to, result]
  );
  return AsyncResult.match(details, {
    onInitial: (): ReactNode => (
      <Text fontFamily="body" color="muted" role="status">
        Loading players…
      </Text>
    ),
    onFailure: ({ cause }): ReactNode => (
      <Text fontFamily="body" color="color" role="alert">
        {Option.match(Cause.findErrorOption(cause), {
          onNone: () => fallbackMessage,
          onSome: detailError,
        })}
      </Text>
    ),
    onSuccess: (): ReactNode =>
      Option.match(graph, {
        onNone: () => null,
        onSome: (built) => <Chains result={result} graph={built} />,
      }),
  });
}

type OutcomeProps = {
  readonly unsupportedFilter: ReactNode;
  readonly from: number;
  readonly to: number;
  readonly search: AsyncResult.AsyncResult<PathResult, SearchError>;
};

function Outcome({ from, to, search, unsupportedFilter }: OutcomeProps) {
  return AsyncResult.match(search, {
    onInitial: (): ReactNode => (
      <Text fontFamily="body" color="muted" role="status">
        Searching…
      </Text>
    ),
    onFailure: ({ cause }): ReactNode => (
      <View role="alert">
        <Text fontFamily="body" color="color">
          {Option.match(Cause.findErrorOption(cause), {
            onNone: () => fallbackMessage,
            onSome: (error) => searchError(error, unsupportedFilter),
          })}
        </Text>
      </View>
    ),
    onSuccess: ({ value }): ReactNode => (
      <Found from={from} to={to} result={value} />
    ),
  });
}

type PathResultsProps = {
  readonly from: number;
  readonly to: number;
  readonly search: AsyncResult.AsyncResult<PathResult, SearchError>;
  /** Replaces the UnsupportedFilter message, for a page that can offer a way to clear the filters. */
  readonly unsupportedFilter?: ReactNode;
};

/** The outcome of a FindPath query between two players: searching, an error, or the chain graph with its details. */
export function PathResults({
  from,
  to,
  search,
  unsupportedFilter = defaultUnsupportedFilter,
}: PathResultsProps) {
  return (
    <Outcome
      from={from}
      to={to}
      search={search}
      unsupportedFilter={unsupportedFilter}
    />
  );
}
