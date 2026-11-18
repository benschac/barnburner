'use client'

import { Option } from 'effect'
import { useAtom, useAtomValue } from '@effect/atom-react'
import { useState } from 'react'
import type { LabEntry } from '@nhl-reddit-stats/viz'
import type { Atom } from 'effect/reactivity'
import type { ReactNode } from 'react'
import {
  competitionAtom, filterAtom, fromAtom, fromSeasonAtom, partnersAtom, relationAtom, toAtom, toSeasonAtom,
} from '../../../explorer/url-state.ts'

const whole = (text: string) => (/^\d+$/.test(text) ? Option.some(Number(text)) : Option.none())
const oneOf = <T extends string>(choices: ReadonlyArray<T>) => (text: string) =>
  Option.fromNullishOr(choices.find((choice) => choice === text))

const show = (value: Option.Option<string | number>) => Option.match(value, { onNone: () => '', onSome: String })

type FieldProps<A extends string | number> = {
  readonly name: string
  readonly atom: Atom.Writable<Option.Option<A>, Option.Option<A>>
  readonly parse: (text: string) => Option.Option<A>
}

/** Typing writes the decoded value, or none when the text does not decode; the URL follows the atom. */
function Field<A extends string | number>({ name, atom, parse }: FieldProps<A>) {
  const [value, set] = useAtom(atom)
  const [typed, setText] = useState(show(value))
  // A URL change (back button, load) refills the field when it no longer matches the typed text.
  const same = Option.makeEquivalence<A>((a, b) => a === b)(parse(typed), value)
  const text = same ? typed : show(value)
  return (
    <div>
      <label>
        {name}{' '}
        <input
          name={name}
          value={text}
          onChange={(event) => {
            setText(event.target.value)
            set(parse(event.target.value))
          }}
        />
      </label>
      {' '}decoded: <output data-field={name}>{Option.match(value, { onNone: () => 'missing', onSome: String })}</output>
    </div>
  )
}

function Panel() {
  const filter = useAtomValue(filterAtom)
  return (
    <div>
      <Field name="from" atom={fromAtom} parse={whole} />
      <Field name="to" atom={toAtom} parse={whole} />
      <Field name="relation" atom={relationAtom} parse={oneOf(['with', 'against', 'either'])} />
      <Field name="competition" atom={competitionAtom} parse={oneOf(['all', 'regular', 'playoff'])} />
      <Field name="fromSeason" atom={fromSeasonAtom} parse={whole} />
      <Field name="toSeason" atom={toSeasonAtom} parse={whole} />
      <Field name="partners" atom={partnersAtom} parse={oneOf(['on', 'off'])} />
      <p>
        filter: competition {filter.competition}, from {filter.fromSeason ?? 'none'}, to {filter.toSeason ?? 'none'},
        goalie partners {filter.goaliePartners ? 'on' : 'off'}
      </p>
    </div>
  )
}

const entry: LabEntry<ReactNode> = {
  title: 'URL state: search parameters as atoms',
  render: () => <Panel />,
}

export default entry
