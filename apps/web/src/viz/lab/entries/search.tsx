"use client";

import { useAtomValue } from "@effect/atom-react";
import type { LabEntry } from "@nhl-reddit-stats/viz";
import { Array, Option } from "effect";
import type { ReactNode } from "react";
import { Text, View, styled } from "tamagui";

import { PathResults } from "../../../explorer/PathResults.tsx";
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

const seasonOptions = Array.makeBy(110, (index) => {
  const start = 1917 + index;
  return {
    value: start * 10000 + start + 1,
    text: `${start}–${String((start + 1) % 100).padStart(2, "0")}`,
  };
});

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
  return (
    <PathResults
      from={from.value}
      to={to.value}
      search={search.value}
      unsupportedFilter={
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
      }
    />
  );
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
