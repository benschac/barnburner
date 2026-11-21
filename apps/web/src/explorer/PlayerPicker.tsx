"use client";

import { useAtomValue } from "@effect/atom-react";
import type {
  HistoryUnavailable,
  UnknownPlayer,
} from "@nhl-reddit-stats/history/rpc";
import { Cause, Match, Option } from "effect";
import { AsyncResult } from "effect/reactivity";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Input, Text, View, styled } from "tamagui";
import { createActor } from "xstate";
import type { Actor, EventFromLogic, SnapshotFrom } from "xstate";

import { Copy } from "../components/team-poster/primitives.tsx";
import { seasonSpan } from "../viz/PlayerCard.tsx";
import { player, searchPlayers } from "./history-atoms.ts";
import { minQueryLength, pickerMachine } from "./player-picker-machine.ts";
import type { PickerOption } from "./player-picker-machine.ts";
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

// The result list floats under the input, over the content below it, so opening it does not move the page.
const Overlay = styled(View, {
  position: "absolute",
  t: "100%",
  l: "0",
  r: "0",
  z: 1,
  mt: "1",
  p: "1",
  gap: "1",
  rounded: "sm",
  bg: "background",
  borderWidth: 1,
  borderColor: "rule",
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

const resultLimit = 8;
const noOptions: readonly PickerOption[] = [];

type PickerError = UnknownPlayer | HistoryUnavailable;

type Summary = {
  readonly playerId: number;
  readonly name: string;
  readonly position: string;
  readonly firstSeason: number;
  readonly lastSeason: number;
};

type PickerActor = Actor<typeof pickerMachine>;
type PickerSnapshot = SnapshotFrom<typeof pickerMachine>;
type PickerEvent = EventFromLogic<typeof pickerMachine>;

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

const optionId = (listboxId: string, index: number) =>
  `${listboxId}-option-${index}`;

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
  readonly listboxId: string;
  readonly highlighted: number | null;
  readonly send: (event: PickerEvent) => void;
};

function Results({ query, listboxId, highlighted, send }: ResultsProps) {
  const result = useAtomValue(searchPlayers({ query, limit: resultLimit }));
  const players = AsyncResult.isSuccess(result)
    ? result.value.players
    : undefined;
  // The machine moves the highlight over the options, so it hears about each set of results for its query.
  useEffect(() => {
    send({
      type: "Results",
      query,
      options:
        players?.map(({ playerId, name }) => ({ playerId, name })) ?? noOptions,
    });
  }, [players, query, send]);
  return AsyncResult.match(result, {
    onInitial: (): ReactNode => <Copy role="status">Searching…</Copy>,
    onFailure: ({ cause }): ReactNode => (
      <Copy role="alert">{failureMessage(cause)}</Copy>
    ),
    onSuccess: ({ value }): ReactNode =>
      value.players.length === 0 ? (
        <Copy role="status">{`No players match “${query}”.`}</Copy>
      ) : (
        // Tamagui's Role type has no "listbox", so the role rides on the element the View renders.
        <View render={<div role="listbox" />} id={listboxId} gap="1">
          {value.players.map((summary, index) => (
            <View
              key={summary.playerId}
              id={optionId(listboxId, index)}
              role="option"
              aria-selected={highlighted === index}
              minH="badge"
              px="3"
              justify="center"
              rounded="sm"
              borderWidth={1}
              bg={highlighted === index ? "highlight" : "surface"}
              borderColor={highlighted === index ? "gold" : "transparent"}
              cursor="pointer"
              // Keeps focus in the input, so its blur cannot close the list before the press lands.
              onMouseDown={(event) => {
                event.preventDefault();
              }}
              onMouseEnter={() => {
                send({ type: "Highlight", index });
              }}
              onPress={() => {
                send({ type: "PickOption", index });
              }}
            >
              <Text fontFamily="body" fontSize="body" color="color">
                {describe(summary)}
              </Text>
            </View>
          ))}
        </View>
      ),
  });
}

/** The machine event a key in the input stands for; other keys edit the draft. */
const keyEvent = (key: string): PickerEvent | null => {
  switch (key) {
    case "ArrowDown": {
      return { type: "HighlightNext" };
    }
    case "ArrowUp": {
      return { type: "HighlightPrevious" };
    }
    case "Enter": {
      return { type: "PickHighlighted" };
    }
    case "Escape": {
      return { type: "Escape" };
    }
    default: {
      return null;
    }
  }
};

type PlayerPickerProps = {
  readonly param: "from" | "to";
  readonly label: string;
  readonly disabled?: boolean;
};

/**
 * Picks a player into one URL parameter, as a WAI-ARIA combobox with a list of results. The text is a draft: it becomes
 * the search query after typing settles, and choosing a result is the only write (one history entry). History
 * navigation drops the draft and any queued search, so the selection shown is always the URL's. The UI state lives in
 * `pickerMachine`; this component owns the URL write and the `popstate` listener.
 */
export function PlayerPicker({
  param,
  label,
  disabled = false,
}: PlayerPickerProps) {
  const selected = useAtomValue(param === "from" ? fromAtom : toAtom);
  const listboxId = useId();
  const actorRef = useRef<PickerActor | null>(null);
  const [snapshot, setSnapshot] = useState<PickerSnapshot | null>(null);
  useEffect(() => {
    const actor = createActor(pickerMachine);
    actorRef.current = actor;
    const subscription = actor.subscribe(setSnapshot);
    const picked = actor.on("Picked", ({ playerId }) => {
      writeSearchParam(param, String(playerId));
    });
    const onHistory = () => {
      actor.send({ type: "Reset" });
    };
    window.addEventListener("popstate", onHistory);
    actor.start();
    return () => {
      window.removeEventListener("popstate", onHistory);
      picked.unsubscribe();
      subscription.unsubscribe();
      actor.stop();
      if (actorRef.current === actor) actorRef.current = null;
    };
  }, [param]);
  const send = useCallback((event: PickerEvent) => {
    actorRef.current?.send(event);
  }, []);
  const context = snapshot?.context;
  const draft = context?.draft ?? "";
  const query = context?.query ?? "";
  const highlighted = context?.highlighted ?? null;
  const open =
    !disabled &&
    context !== undefined &&
    context.open &&
    query.length >= minQueryLength;
  return (
    <View gap="1">
      {Option.isSome(selected) ? (
        <Selected key={selected.value} playerId={selected.value} />
      ) : (
        <Copy color="muted">No player chosen.</Copy>
      )}
      <View position="relative">
        <label>
          {label}{" "}
          <Field
            value={draft}
            disabled={disabled}
            autoComplete="off"
            role="combobox"
            aria-autocomplete="list"
            aria-expanded={open}
            aria-controls={listboxId}
            aria-activedescendant={
              open && highlighted !== null
                ? optionId(listboxId, highlighted)
                : undefined
            }
            onChangeText={(text) => {
              send({ type: "Type", text });
            }}
            onKeyDown={(event) => {
              const forKey = keyEvent(event.key);
              if (forKey === null) return;
              // Arrow keys would move the caret and Enter could submit a form; the picker owns these keys.
              event.preventDefault();
              send(forKey);
            }}
            onBlur={() => {
              send({ type: "Blur" });
            }}
          />
        </label>
        {open ? (
          <Overlay>
            <Results
              query={query}
              listboxId={listboxId}
              highlighted={highlighted}
              send={send}
            />
          </Overlay>
        ) : null}
      </View>
      <Action
        disabled={disabled || Option.isNone(selected)}
        onPress={() => {
          send({ type: "Reset" });
          writeSearchParam(param, null);
        }}
      >
        Clear
      </Action>
    </View>
  );
}
