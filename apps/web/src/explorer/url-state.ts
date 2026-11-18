import { Option, Schema, SchemaTransformation } from 'effect'
import { Atom } from 'effect/reactivity'
import { FilterSchema, RelationSchema } from '@nhl-reddit-stats/history/rpc'
import { findPath } from './history-atoms.ts'

type Filter = typeof FilterSchema.Type

/** A non-negative whole number (empty text is rejected, which `FiniteFromString` would read as 0) written in the URL, such as a player ID or a season ID. */
const WholeNumber = Schema.String.check(Schema.isPattern(/^\d+$/)).pipe(
  Schema.decodeTo(Schema.Int, SchemaTransformation.numberFromString),
)
const Competition = Schema.Literals(['all', 'regular', 'playoff'])
const Partners = Schema.Literals(['on', 'off'])

/** Each parameter decodes synchronously; a missing or malformed value becomes `Option.none()`. */
export const fromAtom = Atom.searchParam('from', { schema: WholeNumber })
export const toAtom = Atom.searchParam('to', { schema: WholeNumber })
export const relationAtom = Atom.searchParam('relation', { schema: RelationSchema })
export const competitionAtom = Atom.searchParam('competition', { schema: Competition })
export const fromSeasonAtom = Atom.searchParam('fromSeason', { schema: WholeNumber })
export const toSeasonAtom = Atom.searchParam('toSeason', { schema: WholeNumber })
export const partnersAtom = Atom.searchParam('partners', { schema: Partners })

export type FilterParams = {
  readonly competition: Option.Option<Filter['competition']>
  readonly fromSeason: Option.Option<number>
  readonly toSeason: Option.Option<number>
  readonly partners: Option.Option<'on' | 'off'>
}

/** §C-search defaults: all competitions, no season bounds, goalie partners on. */
export const makeFilter = (params: FilterParams): Filter => ({
  competition: Option.getOrElse(params.competition, () => 'all' as const),
  fromSeason: Option.getOrNull(params.fromSeason),
  toSeason: Option.getOrNull(params.toSeason),
  goaliePartners: Option.match(params.partners, { onNone: () => true, onSome: (value) => value === 'on' }),
})

export const filterAtom = Atom.make((get) => makeFilter({
  competition: get(competitionAtom),
  fromSeason: get(fromSeasonAtom),
  toSeason: get(toSeasonAtom),
  partners: get(partnersAtom),
}))

/** The path query for the current URL, or none while `from` or `to` is missing. */
export const pathAtom = Atom.make((get) => {
  const from = get(fromAtom)
  const to = get(toAtom)
  if (Option.isNone(from) || Option.isNone(to)) return Option.none()
  return Option.some(get(findPath({
    from: from.value,
    to: to.value,
    filter: get(filterAtom),
    relation: Option.getOrElse(get(relationAtom), () => 'with' as const),
    limit: 10,
  })))
})
