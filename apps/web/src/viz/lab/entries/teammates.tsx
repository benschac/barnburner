"use client";

import { useAtomValue } from "@effect/atom-react";
import type {
  HistoryUnavailable,
  UnknownPlayer,
} from "@nhl-reddit-stats/history/rpc";
import { DEFAULT_FILTER } from "@nhl-reddit-stats/history/shapes";
import type { LabEntry } from "@nhl-reddit-stats/viz";
import { Cause, Match, Option } from "effect";
import { AsyncResult, Atom } from "effect/reactivity";
import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { Text, View } from "tamagui";

import { player, teammates } from "../../../explorer/history-atoms.ts";
import { PlayerPicker } from "../../../explorer/PlayerPicker.tsx";
import {
  teammateGamesLabel,
  teammateRows,
  teammatesGraph,
} from "../../../explorer/teammates.ts";
import type { PlayerDetail, Teammate } from "../../../explorer/teammates.ts";
import { fromAtom } from "../../../explorer/url-state.ts";
import { G6Graph } from "../../G6Graph.tsx";
import { seasonSpan } from "../../PlayerCard.tsx";

type TeammatesError = HistoryUnavailable | UnknownPlayer;

/** The player and every teammate with their shared spans: two requests, whatever the career length. */
const teammatesOf = Atom.family((playerId: number) =>
  Atom.make((get) =>
    AsyncResult.map(
      AsyncResult.all([
        get(player({ playerId })),
        get(teammates({ playerId, filter: DEFAULT_FILTER })),
      ]),
      ([detail, found]) => ({ detail, rows: teammateRows(detail, found) })
    )
  )
);

const errorMessage = (error: TeammatesError): string =>
  Match.valueTags(error, {
    HistoryUnavailable: ({ message }) => message,
    UnknownPlayer: ({ playerId }) => `No player has ID ${playerId}.`,
  });

type FoundProps = {
  readonly detail: PlayerDetail;
  readonly rows: readonly Teammate[];
};
const limits = [40, 100, "all"] as const;

function Found({ detail, rows }: FoundProps) {
  const [limit, setLimit] = useState<(typeof limits)[number]>(40);
  const graph = useMemo(
    () => teammatesGraph(detail, rows, limit),
    [detail, rows, limit]
  );
  if (rows.length === 0)
    return (
      <Text fontFamily="body" color="muted">
        No teammates found
      </Text>
    );
  return (
    <View gap="3">
      <Text fontFamily="body" color="color">
        {rows.length} teammates
      </Text>
      <View
        flexDirection="row"
        gap="2"
        items="center"
        role="group"
        aria-label="Teammates shown in graph"
      >
        <Text fontFamily="body" color="muted">
          Show
        </Text>
        {limits.map((choice) => (
          <View
            render="button"
            key={choice}
            aria-pressed={limit === choice}
            minH="badge"
            px="3"
            items="center"
            justify="center"
            rounded="sm"
            cursor="pointer"
            bg={limit === choice ? "highlight" : "surface"}
            borderColor={limit === choice ? "gold" : "rule"}
            borderWidth={2}
            onClick={() => {
              setLimit(choice);
            }}
          >
            <Text fontFamily="body" color="color">
              {choice}
            </Text>
          </View>
        ))}
      </View>
      <G6Graph data={graph} layout="force" height="drawer" />
      <View gap="1" role="list" aria-label="All teammates">
        {rows.map((row) => (
          <Text
            key={row.playerId}
            role="listitem"
            fontFamily="body"
            color="color"
          >
            {`${row.name} · ${row.position} · ${teammateGamesLabel(row)} · ${row.teams.join(", ")} · ${seasonSpan(row.firstSeason, row.firstSeason)} to ${seasonSpan(row.lastSeason, row.lastSeason)}`}
          </Text>
        ))}
      </View>
    </View>
  );
}

function Results({ playerId }: { readonly playerId: number }) {
  const result = useAtomValue(teammatesOf(playerId));
  return AsyncResult.match(result, {
    onInitial: (): ReactNode => (
      <Text fontFamily="body" color="muted" role="status">
        Loading teammates…
      </Text>
    ),
    onFailure: ({ cause }): ReactNode => (
      <Text fontFamily="body" color="color" role="alert">
        {Option.match(Cause.findErrorOption(cause), {
          onNone: () => "Something went wrong. Try again.",
          onSome: errorMessage,
        })}
      </Text>
    ),
    onSuccess: ({ value }): ReactNode => (
      <Found detail={value.detail} rows={value.rows} />
    ),
  });
}

function TeammatesView() {
  const selected = useAtomValue(fromAtom);
  return (
    <View gap="4">
      <PlayerPicker param="from" label="Player" />
      {Option.isSome(selected) ? (
        <Results key={selected.value} playerId={selected.value} />
      ) : (
        <Text fontFamily="body" color="muted">
          Choose a player to see their teammates.
        </Text>
      )}
    </View>
  );
}

const entry: LabEntry<ReactNode> = {
  title: "Teammates of a player",
  render: () => <TeammatesView />,
};
export default entry;
