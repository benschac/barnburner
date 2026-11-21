"use client";

import { useAtomValue } from "@effect/atom-react";
import type {
  HistoryUnavailable,
  UnknownPlayer,
} from "@nhl-reddit-stats/history/rpc";
import { Cause, Match, Option } from "effect";
import { AsyncResult } from "effect/reactivity";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { Input, Text, View, styled } from "tamagui";

import { Copy, List } from "../components/team-poster/primitives.tsx";
import { useDelay } from "../use-delay.ts";
import { seasonSpan } from "../viz/PlayerCard.tsx";
import { player, searchPlayers } from "./history-atoms.ts";
import { fromAtom, toAtom, writeSearchParam } from "./url-state.ts";

const Field = styled(Input, {
  minH: "badge",
  px: "3",
  rounded: "sm",
  bg: "surface",
  borderWidth: 1,
  borderColor: "rule focus-visible:gold",
  color: "color",
  fontFamily: "body",
  fontSize: "body",
});

// The global CSS reset strips native button chrome; this is the ThemeControls button recipe.
const ActionFrame = styled(View, {
  render: "button",
  self: "flex-start",
  minH: "badge",
  px: "3",
  items: "center",
  justify: "center",
  rounded: "sm",
  bg: "surface hover:highlight",
  borderWidth: 1,
  borderColor: "rule focus-visible:gold",
  cursor: "pointer",
});

type ActionProps = {
  readonly disabled: boolean;
  readonly onPress: () => void;
  readonly children: string;
};

function Action({ disabled, onPress, children }: ActionProps) {
  return (
    <ActionFrame disabled={disabled} onPress={onPress}>
      <Text
        fontFamily="body"
        fontSize="body"
        color={disabled ? "muted" : "color"}
      >
        {children}
      </Text>
    </ActionFrame>
  );
}

const searchDelayMs = 250;
const minQueryLength = 2;
const resultLimit = 8;

type PickerError = UnknownPlayer | HistoryUnavailable;

type Summary = {
  readonly playerId: number;
  readonly name: string;
  readonly position: string;
  readonly firstSeason: number;
  readonly lastSeason: number;
};

const describe = (summary: Summary) =>
  `${summary.name} · ${summary.position} · ${seasonSpan(summary.firstSeason, summary.lastSeason)}`;

const errorMessage = (error: PickerError) =>
  Match.valueTags(error, {
    UnknownPlayer: ({ playerId }) => `No player has ID ${playerId}.`,
    HistoryUnavailable: ({ message }) => message,
  });

/** The tagged error inside a failure, or a plain fallback when the cause holds only a defect or an interruption. */
const failureMessage = (cause: Cause.Cause<PickerError>) =>
  Option.match(Cause.findErrorOption(cause), {
    onNone: () => "Something went wrong. Try again.",
    onSome: errorMessage,
  });

function Selected({ playerId }: { readonly playerId: number }) {
  const result = useAtomValue(player({ playerId }));
  return (
    <Copy>
      {AsyncResult.match(result, {
        onInitial: () => `Loading player ${playerId}…`,
        onFailure: ({ cause }) => failureMessage(cause),
        onSuccess: ({ value }) => describe(value.player),
      })}
    </Copy>
  );
}

type ResultsProps = {
  readonly query: string;
  readonly disabled: boolean;
  readonly onPick: (playerId: number) => void;
};

function Results({ query, disabled, onPick }: ResultsProps) {
  const result = useAtomValue(searchPlayers({ query, limit: resultLimit }));
  return AsyncResult.match(result, {
    onInitial: (): ReactNode => <Copy role="status">Searching…</Copy>,
    onFailure: ({ cause }): ReactNode => (
      <Copy role="alert">{failureMessage(cause)}</Copy>
    ),
    onSuccess: ({ value }): ReactNode =>
      value.players.length === 0 ? (
        <Copy role="status">{`No players match “${query}”.`}</Copy>
      ) : (
        <List gap="1">
          {value.players.map((summary) => (
            <View render="li" key={summary.playerId}>
              <Action
                disabled={disabled}
                onPress={() => {
                  onPick(summary.playerId);
                }}
              >
                {describe(summary)}
              </Action>
            </View>
          ))}
        </List>
      ),
  });
}

type PlayerPickerProps = {
  readonly param: "from" | "to";
  readonly label: string;
  readonly disabled?: boolean;
};

/**
 * Picks a player into one URL parameter. The text is a draft: it becomes the search query after typing settles,
 * and choosing a result is the only write (one history entry). History navigation drops the draft and any queued
 * search, so the selection shown is always the URL's.
 */
export function PlayerPicker({
  param,
  label,
  disabled = false,
}: PlayerPickerProps) {
  const selected = useAtomValue(param === "from" ? fromAtom : toAtom);
  const [draft, setDraft] = useState("");
  const [query, setQuery] = useState("");
  const { schedule, cancel } = useDelay(searchDelayMs);
  useEffect(() => {
    const onHistory = () => {
      cancel();
      setDraft("");
      setQuery("");
    };
    window.addEventListener("popstate", onHistory);
    return () => {
      window.removeEventListener("popstate", onHistory);
    };
  }, [cancel]);
  const reset = () => {
    cancel();
    setDraft("");
    setQuery("");
  };
  return (
    <View gap="1">
      {Option.isSome(selected) ? (
        <Selected key={selected.value} playerId={selected.value} />
      ) : (
        <Copy color="muted">No player chosen.</Copy>
      )}
      <label>
        {label}{" "}
        <Field
          value={draft}
          disabled={disabled}
          autoComplete="off"
          onChangeText={(next) => {
            setDraft(next);
            schedule(() => {
              setQuery(next.trim());
            });
          }}
        />
      </label>
      <Action
        disabled={disabled || Option.isNone(selected)}
        onPress={() => {
          reset();
          writeSearchParam(param, null);
        }}
      >
        Clear
      </Action>
      {query.length >= minQueryLength ? (
        <Results
          query={query}
          disabled={disabled}
          onPick={(playerId) => {
            reset();
            writeSearchParam(param, String(playerId));
          }}
        />
      ) : null}
    </View>
  );
}
