"use client";

import { useAtomValue } from "@effect/atom-react";
import { RelationSchema } from "@nhl-reddit-stats/history/rpc";
import type { LabEntry } from "@nhl-reddit-stats/viz";
import { Option } from "effect";
import type { Schema } from "effect";
import type { Atom } from "effect/reactivity";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";

import {
  Competition,
  Partners,
  WholeNumber,
  competitionAtom,
  decodeParam,
  encodeParam,
  filterAtom,
  fromAtom,
  fromSeasonAtom,
  partnersAtom,
  relationAtom,
  toAtom,
  toSeasonAtom,
  writeSearchParam,
} from "../../../explorer/url-state.ts";
import { useDelay } from "../../../use-delay.ts";

const show = (value: Option.Option<string | number>) =>
  Option.match(value, { onNone: () => "", onSome: String });
const settleMs = 500;

type FieldProps<A extends string | number> = {
  readonly name: string;
  readonly atom: Atom.Atom<Option.Option<A>>;
  readonly schema: Schema.Codec<A, string>;
};

/**
 * Typing is debounced here, not in the atom: the URL gets the encoded value once typing settles, or loses the
 * parameter when the text does not decode. History navigation drops the draft and any queued write, and the
 * field shows the atom again.
 */
function Field<A extends string | number>({
  name,
  atom,
  schema,
}: FieldProps<A>) {
  const value = useAtomValue(atom);
  const [draft, setDraft] = useState<string | null>(null);
  const { schedule, cancel } = useDelay(settleMs);
  useEffect(() => {
    const onHistory = () => {
      cancel();
      setDraft(null);
    };
    window.addEventListener("popstate", onHistory);
    return () => window.removeEventListener("popstate", onHistory);
  }, [cancel]);
  const text = draft ?? show(value);
  return (
    <div>
      <label>
        {name}{" "}
        <input
          name={name}
          value={text}
          onChange={(event) => {
            const next = event.target.value;
            setDraft(next);
            schedule(() => {
              writeSearchParam(
                name,
                Option.getOrNull(
                  Option.flatMap(decodeParam(schema)(next), encodeParam(schema))
                )
              );
            });
          }}
        />
      </label>{" "}
      decoded:{" "}
      <output data-field={name}>
        {Option.match(value, { onNone: () => "missing", onSome: String })}
      </output>
    </div>
  );
}

function Panel() {
  const filter = useAtomValue(filterAtom);
  return (
    <div>
      <Field name="from" atom={fromAtom} schema={WholeNumber} />
      <Field name="to" atom={toAtom} schema={WholeNumber} />
      <Field name="relation" atom={relationAtom} schema={RelationSchema} />
      <Field name="competition" atom={competitionAtom} schema={Competition} />
      <Field name="fromSeason" atom={fromSeasonAtom} schema={WholeNumber} />
      <Field name="toSeason" atom={toSeasonAtom} schema={WholeNumber} />
      <Field name="partners" atom={partnersAtom} schema={Partners} />
      <p>
        filter: competition {filter.competition}, from{" "}
        {filter.fromSeason ?? "none"}, to {filter.toSeason ?? "none"}, goalie
        partners {filter.goaliePartners ? "on" : "off"}
      </p>
    </div>
  );
}

const entry: LabEntry<ReactNode> = {
  title: "URL state: search parameters as atoms",
  render: () => <Panel />,
};

export default entry;
