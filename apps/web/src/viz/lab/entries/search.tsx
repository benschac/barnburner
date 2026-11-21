"use client";

import { useAtomValue } from "@effect/atom-react";
import type {
  FindPathResult,
  HistoryUnavailable,
  NoPath,
  UnknownPlayer,
  UnsupportedFilter,
} from "@nhl-reddit-stats/history/rpc";
import type { LabEntry } from "@nhl-reddit-stats/viz";
import { Array, Cause, Match, Option } from "effect";
import { Atom, AsyncResult } from "effect/reactivity";
import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { Text, View, styled } from "tamagui";

import { player } from "../../../explorer/history-atoms.ts";
import { pathGraph, pathPlayerIds } from "../../../explorer/path-graph.ts";
import type {
  PathGraph,
  PathNodeData,
  PlayerDetail,
} from "../../../explorer/path-graph.ts";
import { PlayerPicker } from "../../../explorer/PlayerPicker.tsx";
import {
  competitionAtom,
  fromAtom,
  fromSeasonAtom,
  partnersAtom,
  relationAtom,
  toAtom,
  toSeasonAtom,
  pathAtom,
  writeSearchParam,
} from "../../../explorer/url-state.ts";
import { G6Graph } from "../../G6Graph.tsx";
import type { G6NodeProps } from "../../G6Graph.tsx";
import { PlayerCard } from "../../PlayerCard.tsx";

type PathResult = typeof FindPathResult.Type;
type SearchError =
  | HistoryUnavailable
  | UnknownPlayer
  | NoPath
  | UnsupportedFilter;
type DetailError = HistoryUnavailable | UnknownPlayer;

// The global CSS reset strips native button chrome, so the button is drawn from tokens.
const ToggleButton = styled(View, {
  render: "button",
  self: "flex-start",
  minH: "12",
  px: "3",
  py: "2",
  rounded: "sm",
  borderWidth: 1,
  borderColor: "rule focus-visible:gold",
  bg: "surface",
  color: "color",
  fontFamily: "body",
  cursor: "pointer",
  variants: {
    pressed: {
      true: { borderColor: "gold" },
    },
  } as const,
});

const clearFilters = () => {
  writeSearchParam("competition", null);
  writeSearchParam("fromSeason", null);
  writeSearchParam("toSeason", null);
  writeSearchParam("partners", null);
};

const fallbackMessage = "Something went wrong. Try again.";

const searchError = (error: SearchError): ReactNode =>
  Match.valueTags(error, {
    NoPath: () =>
      "No chain connects these two players with the current settings.",
    UnknownPlayer: ({ playerId }) => `No player has ID ${playerId}.`,
    UnsupportedFilter: () => (
      <View gap="2">
        <Text fontFamily="body" color="color">
          Opponent and either chains ignore competition, season and
          goalie-partner filters. Clear the filters to search.
        </Text>
        <ToggleButton onPress={clearFilters}>
          <Text fontFamily="body" color="color">
            Clear filters
          </Text>
        </ToggleButton>
      </View>
    ),
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

const seasonOptions = Array.makeBy(110, (index) => {
  const start = 1917 + index;
  return {
    value: start * 10000 + start + 1,
    text: `${start}–${String((start + 1) % 100).padStart(2, "0")}`,
  };
});

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
  readonly from: number;
  readonly to: number;
  readonly search: AsyncResult.AsyncResult<PathResult, SearchError>;
};

function Outcome({ from, to, search }: OutcomeProps) {
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
            onSome: searchError,
          })}
        </Text>
      </View>
    ),
    onSuccess: ({ value }): ReactNode => (
      <Found from={from} to={to} result={value} />
    ),
  });
}

function Results() {
  const from = useAtomValue(fromAtom);
  const to = useAtomValue(toAtom);
  const search = useAtomValue(pathAtom);
  if (Option.isNone(search) || Option.isNone(from) || Option.isNone(to)) {
    return (
      <Text fontFamily="body" color="muted">
        Choose two players to see the shortest chains between them.
      </Text>
    );
  }
  return <Outcome from={from.value} to={to.value} search={search.value} />;
}

const relations = [
  { value: "with", text: "Teammates" },
  { value: "against", text: "Opponents" },
  { value: "either", text: "Either" },
] as const;

const competitions = [
  { value: "all", text: "All" },
  { value: "regular", text: "Regular season" },
  { value: "playoff", text: "Playoffs" },
] as const;

type SeasonSelectProps = {
  readonly name: "fromSeason" | "toSeason";
  readonly label: string;
  readonly disabled: boolean;
};

function SeasonSelect({ name, label, disabled }: SeasonSelectProps) {
  const season = useAtomValue(
    name === "fromSeason" ? fromSeasonAtom : toSeasonAtom
  );
  return (
    <label>
      <Text fontFamily="body" color="muted">
        {label}{" "}
      </Text>
      <select
        value={Option.match(season, { onNone: () => "", onSome: String })}
        disabled={disabled}
        onChange={(event) => {
          const next = event.target.value;
          writeSearchParam(name, next === "" ? null : next);
        }}
      >
        <option value="">Any</option>
        {seasonOptions.map((option) => (
          <option key={option.value} value={String(option.value)}>
            {option.text}
          </option>
        ))}
      </select>
    </label>
  );
}

function Controls() {
  const relation = Option.getOrElse(
    useAtomValue(relationAtom),
    () => "with" as const
  );
  const competition = Option.getOrElse(
    useAtomValue(competitionAtom),
    () => "all" as const
  );
  const partners = Option.getOrElse(
    useAtomValue(partnersAtom),
    () => "on" as const
  );
  const filtersOff = relation !== "with";
  return (
    <View gap="2">
      <label>
        <Text fontFamily="body" color="muted">
          Relation{" "}
        </Text>
        <select
          value={relation}
          onChange={(event) => {
            const next = event.target.value;
            writeSearchParam("relation", next === "with" ? null : next);
          }}
        >
          {relations.map((option) => (
            <option key={option.value} value={option.value}>
              {option.text}
            </option>
          ))}
        </select>
      </label>
      <label>
        <Text fontFamily="body" color="muted">
          Competition{" "}
        </Text>
        <select
          value={competition}
          disabled={filtersOff}
          onChange={(event) => {
            const next = event.target.value;
            writeSearchParam("competition", next === "all" ? null : next);
          }}
        >
          {competitions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.text}
            </option>
          ))}
        </select>
      </label>
      <SeasonSelect
        name="fromSeason"
        label="From season"
        disabled={filtersOff}
      />
      <SeasonSelect name="toSeason" label="To season" disabled={filtersOff} />
      <ToggleButton
        aria-pressed={partners === "on"}
        disabled={filtersOff}
        pressed={partners === "on"}
        onPress={() => {
          writeSearchParam("partners", partners === "on" ? "off" : null);
        }}
      >
        <Text fontFamily="body" color={filtersOff ? "muted" : "color"}>
          {`Count goalie partners: ${partners === "on" ? "on" : "off"}`}
        </Text>
      </ToggleButton>
      {filtersOff ? (
        <Text fontFamily="body" color="muted">
          Opponent and either chains use every game; filters apply to teammate
          chains only.
        </Text>
      ) : null}
    </View>
  );
}

function SearchView() {
  return (
    <View gap="4">
      <PlayerPicker param="from" label="From player" />
      <PlayerPicker param="to" label="To player" />
      <Controls />
      <Results />
    </View>
  );
}

const entry: LabEntry<ReactNode> = {
  title: "Player search: shortest chains between any two players",
  render: () => <SearchView />,
};

export default entry;
