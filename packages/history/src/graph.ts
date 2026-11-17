// Pure teammate graph (C-graph, C-search): compact adjacency over the packed arrays and the D7 filter.
// No I/O. Player IDs cross the `link` boundary; everything else here works in indexes.
import { Result } from 'effect'
import { UnknownPlayer } from './contracts.ts'
import type { Filter, Graph, GraphArrays, LinkKind, LinkResult, LinkSpan } from './shapes.ts'

/**
 * Teammate adjacency in CSR form. Player `p`'s neighbours are `neighbours[offsets[p]..offsets[p + 1])`,
 * ascending by player index (so ascending by player ID), and `linkIds` holds the link (edge) ID of each
 * neighbour at the same position. Link `e` owns spans `spanStart[e]..spanStart[e + 1]` in the arrays.
 */
export type Adjacency = {
  readonly offsets: Uint32Array
  readonly neighbours: Uint16Array
  readonly linkIds: Uint32Array
}

/**
 * A `Graph` with its adjacency. `Graph` in `shapes.ts` stays `{ arrays, indexOf }` so the store port and
 * the fakes need no change; the search functions take this type and callers get it from `makeGraph`.
 */
export type TeammateGraph = Graph & { readonly adjacency: Adjacency }

const buildAdjacency = (arrays: GraphArrays): Adjacency => {
  const n = arrays.playerIds.length
  const m = arrays.edgeA.length
  const offsets = new Uint32Array(n + 1)
  for (let e = 0; e < m; e += 1) {
    offsets[arrays.edgeA[e] + 1] += 1
    offsets[arrays.edgeB[e] + 1] += 1
  }
  for (let p = 0; p < n; p += 1) offsets[p + 1] += offsets[p]
  const neighbours = new Uint16Array(2 * m)
  const linkIds = new Uint32Array(2 * m)
  const cursor = offsets.slice(0, n)
  // Edges are sorted by (a, b), so each player's entries land in ascending neighbour order: first the
  // edges where he is `b` (ascending `a`, all smaller), then those where he is `a` (ascending `b`).
  for (let e = 0; e < m; e += 1) {
    const a = arrays.edgeA[e]
    const b = arrays.edgeB[e]
    neighbours[cursor[a]] = b
    linkIds[cursor[a]] = e
    cursor[a] += 1
    neighbours[cursor[b]] = a
    linkIds[cursor[b]] = e
    cursor[b] += 1
  }
  return { offsets, neighbours, linkIds }
}

export const makeGraph = (arrays: GraphArrays): TeammateGraph => ({
  arrays,
  indexOf: new Map(Array.from(arrays.playerIds, (playerId, index) => [playerId, index] as const)),
  adjacency: buildAdjacency(arrays),
})

/** D7: does span index `span` (a position in the span arrays) pass the filter? */
export const spanPasses = (graph: Graph, span: number, filter: Filter): boolean => {
  const { spanKind, spanLink, spanSeason, seasonIds } = graph.arrays
  if (spanLink[span] === 1 && !filter.goaliePartners) return false
  const kind = spanKind[span]
  if (filter.competition === 'regular' && kind !== 2) return false
  if (filter.competition === 'playoff' && kind !== 3) return false
  const seasonId = seasonIds[spanSeason[span]]
  if (filter.fromSeason !== null && seasonId < filter.fromSeason) return false
  if (filter.toSeason !== null && seasonId > filter.toSeason) return false
  return true
}

/** Games over the spans of link `linkId` that pass the filter; 0 when none do. Allocation-free (D6 ordering). */
export const linkPassingGames = (graph: Graph, linkId: number, filter: Filter): number => {
  const { spanStart, spanGames } = graph.arrays
  const end = spanStart[linkId + 1]
  let games = 0
  for (let span = spanStart[linkId]; span < end; span += 1) {
    if (spanPasses(graph, span, filter)) games += spanGames[span]
  }
  return games
}

/** A link passes when at least one of its spans passes (D7). Allocation-free. */
export const linkPasses = (graph: Graph, linkId: number, filter: Filter): boolean => {
  const { spanStart } = graph.arrays
  const end = spanStart[linkId + 1]
  for (let span = spanStart[linkId]; span < end; span += 1) {
    if (spanPasses(graph, span, filter)) return true
  }
  return false
}

/** The link ID between two player indexes, or -1 when they are not teammates. Binary search over a's neighbours. */
export const linkIdBetween = (graph: TeammateGraph, a: number, b: number): number => {
  const { offsets, neighbours, linkIds } = graph.adjacency
  let low = offsets[a]
  let high = offsets[a + 1] - 1
  while (low <= high) {
    const mid = (low + high) >>> 1
    const value = neighbours[mid]
    if (value === b) return linkIds[mid]
    if (value < b) low = mid + 1
    else high = mid - 1
  }
  return -1
}

const linkKindOf = (code: number): LinkKind => (code === 1 ? 'GoaliePartners' : 'PlayedWith')

/**
 * The span that is a link's evidence under the filter: the first passing shared-game span, else the first
 * passing partner span; -1 when none passes. Allocation-free.
 */
export const evidenceSpan = (graph: Graph, linkId: number, filter: Filter): number => {
  const { spanStart, spanLink } = graph.arrays
  const end = spanStart[linkId + 1]
  let partner = -1
  for (let span = spanStart[linkId]; span < end; span += 1) {
    if (!spanPasses(graph, span, filter)) continue
    if (spanLink[span] === 0) return span
    if (partner < 0) partner = span
  }
  return partner
}

/**
 * The hop kind of a passing link: `PlayedWith` when any shared-game span passes (even if a partner span
 * passes too), `GoaliePartners` when only partner spans pass, null when nothing passes. Allocation-free.
 */
export const hopKind = (graph: Graph, linkId: number, filter: Filter): LinkKind | null => {
  const span = evidenceSpan(graph, linkId, filter)
  return span < 0 ? null : linkKindOf(graph.arrays.spanLink[span])
}

const passingSpans = (graph: Graph, linkId: number, filter: Filter, partner: 0 | 1): ReadonlyArray<LinkSpan> => {
  const { spanStart, spanLink, spanSeason, spanKind, spanTeam, spanGames, spanFirstGame, seasonIds, teamIds } = graph.arrays
  const spans: LinkSpan[] = []
  const end = spanStart[linkId + 1]
  for (let span = spanStart[linkId]; span < end; span += 1) {
    if (spanLink[span] !== partner || !spanPasses(graph, span, filter)) continue
    spans.push({
      seasonId: seasonIds[spanSeason[span]],
      gameType: spanKind[span] === 3 ? 3 : 2,
      teamId: teamIds[spanTeam[span]],
      link: linkKindOf(spanLink[span]),
      games: spanGames[span],
      firstGameId: spanFirstGame[span],
    })
  }
  return spans
}

const emptyLink: LinkResult = { spans: [], totalGames: 0, evidenceGameId: null, opposedGames: 0 }

/**
 * The teammate link between two players by ID. Spans list shared-game spans before goalie-partner spans,
 * each in array order; the evidence game is the first span's first game. A pair with no passing span
 * (including a pair never linked, or the same player twice) gets no spans, 0 games, null evidence.
 * `opposedGames` is left at 0; Q7 adds the opponent count.
 */
export const link = (
  graph: TeammateGraph, a: number, b: number, filter: Filter,
): Result.Result<LinkResult, UnknownPlayer> => {
  const ai = graph.indexOf.get(a)
  if (ai === undefined) return Result.fail(new UnknownPlayer({ playerId: a }))
  const bi = graph.indexOf.get(b)
  if (bi === undefined) return Result.fail(new UnknownPlayer({ playerId: b }))
  const linkId = linkIdBetween(graph, ai, bi)
  if (linkId < 0) return Result.succeed(emptyLink)
  const spans = [...passingSpans(graph, linkId, filter, 0), ...passingSpans(graph, linkId, filter, 1)]
  if (spans.length === 0) return Result.succeed(emptyLink)
  const totalGames = spans.reduce((sum, span) => sum + span.games, 0)
  return Result.succeed({ spans, totalGames, evidenceGameId: spans[0].firstGameId, opposedGames: 0 })
}
