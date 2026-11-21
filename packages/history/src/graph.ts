// Pure teammate graph (C-graph, C-search): compact adjacency over the packed arrays and the D7 filter.
// No I/O. Player IDs cross the `link` boundary; everything else here works in indexes.

import { Array, Order, Result } from "effect";

import { HistoryUnavailable, UnknownPlayer } from "./contracts.ts";
import type {
  Filter,
  Graph,
  GraphArrays,
  LinkKind,
  LinkResult,
  LinkSpan,
  Opponent,
  TeammateLink,
} from "./shapes.ts";

/**
 * Teammate adjacency in CSR form. Player `p`'s neighbours are `neighbours[offsets[p]..offsets[p + 1])`,
 * ascending by player index (so ascending by player ID), and `linkIds` holds the link (edge) ID of each
 * neighbour at the same position. Link `e` owns spans `spanStart[e]..spanStart[e + 1]` in the arrays.
 */
export type Adjacency = {
  readonly offsets: Uint32Array;
  readonly neighbours: Uint16Array;
  readonly linkIds: Uint32Array;
};

/**
 * A `Graph` with its adjacency. `Graph` in `shapes.ts` stays `{ arrays, indexOf }` so the store port and
 * the fakes need no change; the search functions take this type and callers get it from `makeGraph`.
 */
export type TeammateGraph = Graph & { readonly adjacency: Adjacency };

const buildAdjacency = (arrays: GraphArrays): Adjacency => {
  const n = arrays.playerIds.length;
  const m = arrays.edgeA.length;
  const offsets = new Uint32Array(n + 1);
  for (let e = 0; e < m; e += 1) {
    offsets[arrays.edgeA[e] + 1] += 1;
    offsets[arrays.edgeB[e] + 1] += 1;
  }
  for (let p = 0; p < n; p += 1) offsets[p + 1] += offsets[p];
  const neighbours = new Uint16Array(2 * m);
  const linkIds = new Uint32Array(2 * m);
  const cursor = offsets.slice(0, n);
  // Edges are sorted by (a, b), so each player's entries land in ascending neighbour order: first the
  // edges where he is `b` (ascending `a`, all smaller), then those where he is `a` (ascending `b`).
  for (let e = 0; e < m; e += 1) {
    const a = arrays.edgeA[e];
    const b = arrays.edgeB[e];
    neighbours[cursor[a]] = b;
    linkIds[cursor[a]] = e;
    cursor[a] += 1;
    neighbours[cursor[b]] = a;
    linkIds[cursor[b]] = e;
    cursor[b] += 1;
  }
  return { offsets, neighbours, linkIds };
};

export const makeGraph = (arrays: GraphArrays): TeammateGraph => ({
  arrays,
  indexOf: new Map(
    Array.fromIterable(arrays.playerIds).map(
      (playerId, index) => [playerId, index] as const
    )
  ),
  adjacency: buildAdjacency(arrays),
});

/** D7: does span index `span` (a position in the span arrays) pass the filter? */
export const spanPasses = (
  graph: Graph,
  span: number,
  filter: Filter
): boolean => {
  const { spanKind, spanLink, spanSeason, seasonIds } = graph.arrays;
  if (spanLink[span] === 1 && !filter.goaliePartners) return false;
  const kind = spanKind[span];
  if (filter.competition === "regular" && kind !== 2) return false;
  if (filter.competition === "playoff" && kind !== 3) return false;
  const seasonId = seasonIds[spanSeason[span]];
  if (filter.fromSeason !== null && seasonId < filter.fromSeason) return false;
  if (filter.toSeason !== null && seasonId > filter.toSeason) return false;
  return true;
};

/** Games over the spans of link `linkId` that pass the filter; 0 when none do. Allocation-free (D6 ordering). */
export const linkPassingGames = (
  graph: Graph,
  linkId: number,
  filter: Filter
): number => {
  const { spanStart, spanGames } = graph.arrays;
  const end = spanStart[linkId + 1];
  let games = 0;
  for (let span = spanStart[linkId]; span < end; span += 1) {
    if (spanPasses(graph, span, filter)) games += spanGames[span];
  }
  return games;
};

/** A link passes when at least one of its spans passes (D7). Allocation-free. */
export const linkPasses = (
  graph: Graph,
  linkId: number,
  filter: Filter
): boolean => {
  const { spanStart } = graph.arrays;
  const end = spanStart[linkId + 1];
  for (let span = spanStart[linkId]; span < end; span += 1) {
    if (spanPasses(graph, span, filter)) return true;
  }
  return false;
};

/** The link ID between two player indexes, or -1 when they are not teammates. Binary search over a's neighbours. */
export const linkIdBetween = (
  graph: TeammateGraph,
  a: number,
  b: number
): number => {
  const { offsets, neighbours, linkIds } = graph.adjacency;
  let low = offsets[a];
  let high = offsets[a + 1] - 1;
  while (low <= high) {
    const mid = (low + high) >>> 1;
    const value = neighbours[mid];
    if (value === b) return linkIds[mid];
    if (value < b) low = mid + 1;
    else high = mid - 1;
  }
  return -1;
};

const linkKindOf = (code: number): LinkKind =>
  code === 1 ? "GoaliePartners" : "PlayedWith";

/**
 * The span that is a link's evidence under the filter: the first passing shared-game span, else the first
 * passing partner span; -1 when none passes. Allocation-free.
 */
export const evidenceSpan = (
  graph: Graph,
  linkId: number,
  filter: Filter
): number => {
  const { spanStart, spanLink } = graph.arrays;
  const end = spanStart[linkId + 1];
  let partner = -1;
  for (let span = spanStart[linkId]; span < end; span += 1) {
    if (!spanPasses(graph, span, filter)) continue;
    if (spanLink[span] === 0) return span;
    if (partner < 0) partner = span;
  }
  return partner;
};

/**
 * The hop kind of a passing link: `PlayedWith` when any shared-game span passes (even if a partner span
 * passes too), `GoaliePartners` when only partner spans pass, null when nothing passes. Allocation-free.
 */
export const hopKind = (
  graph: Graph,
  linkId: number,
  filter: Filter
): LinkKind | null => {
  const span = evidenceSpan(graph, linkId, filter);
  return span < 0 ? null : linkKindOf(graph.arrays.spanLink[span]);
};

const passingSpans = (
  graph: Graph,
  linkId: number,
  filter: Filter,
  partner: 0 | 1
): readonly LinkSpan[] => {
  const {
    spanStart,
    spanLink,
    spanSeason,
    spanKind,
    spanTeam,
    spanGames,
    spanFirstGame,
    seasonIds,
    teamIds,
  } = graph.arrays;
  const spans: LinkSpan[] = [];
  const end = spanStart[linkId + 1];
  for (let span = spanStart[linkId]; span < end; span += 1) {
    if (spanLink[span] !== partner || !spanPasses(graph, span, filter))
      continue;
    spans.push({
      seasonId: seasonIds[spanSeason[span]],
      gameType: spanKind[span] === 3 ? 3 : 2,
      teamId: teamIds[spanTeam[span]],
      link: linkKindOf(spanLink[span]),
      games: spanGames[span],
      firstGameId: spanFirstGame[span],
    });
  }
  return spans;
};

/** Every passing span of link `linkId`: shared-game spans first, then goalie-partner spans, each in array order. */
const linkSpans = (
  graph: Graph,
  linkId: number,
  filter: Filter
): readonly LinkSpan[] => [
  ...passingSpans(graph, linkId, filter, 0),
  ...passingSpans(graph, linkId, filter, 1),
];

/**
 * Opponent adjacency in CSR form (D14). Player `p`'s opponents are `neighbours[offsets[p]..offsets[p + 1])`,
 * ascending by player index (so ascending by player ID), with `games` at the same position. A pair is
 * stored once in the arrays and twice here, so `neighbours` has `2 * o` entries.
 */
export type OpponentAdjacency = {
  readonly offsets: Uint32Array;
  readonly neighbours: Uint16Array;
  readonly games: Uint16Array;
};

const buildOpponentAdjacency = (
  n: number,
  oppA: Uint16Array,
  oppB: Uint16Array,
  oppGames: Uint16Array
): OpponentAdjacency => {
  const o = oppA.length;
  const offsets = new Uint32Array(n + 1);
  for (let e = 0; e < o; e += 1) {
    offsets[oppA[e] + 1] += 1;
    offsets[oppB[e] + 1] += 1;
  }
  for (let p = 0; p < n; p += 1) offsets[p + 1] += offsets[p];
  const neighbours = new Uint16Array(2 * o);
  const games = new Uint16Array(2 * o);
  const cursor = offsets.slice(0, n);
  // Pairs are sorted by (a, b) with a < b, so as in `buildAdjacency` each player's entries land ascending.
  for (let e = 0; e < o; e += 1) {
    const a = oppA[e];
    const b = oppB[e];
    neighbours[cursor[a]] = b;
    games[cursor[a]] = oppGames[e];
    cursor[a] += 1;
    neighbours[cursor[b]] = a;
    games[cursor[b]] = oppGames[e];
    cursor[b] += 1;
  }
  return { offsets, neighbours, games };
};

// Built on first use (3.27M pairs on the real graph) and cached per arrays object. Only `opponents()` and the
// `against`/`either` path search build it; `link` and the teammate paths never do. Only a successful build is cached.
const opponentCache = new WeakMap<GraphArrays, OpponentAdjacency>();

/** The opponent adjacency, built and cached on first use; undefined when the opponent arrays are absent. */
export const opponentAdjacency = (
  graph: Graph
): OpponentAdjacency | undefined => {
  const { arrays } = graph;
  const cached = opponentCache.get(arrays);
  if (cached !== undefined) return cached;
  const { oppA, oppB, oppGames } = arrays;
  if (oppA === undefined || oppB === undefined || oppGames === undefined)
    return undefined;
  const built = buildOpponentAdjacency(
    arrays.playerIds.length,
    oppA,
    oppB,
    oppGames
  );
  opponentCache.set(arrays, built);
  return built;
};

/**
 * Games between player indexes as opponents: binary search over the raw pair arrays, sorted by (a, b) with
 * a < b, so it needs no adjacency. 0 when they never met, are the same player, or there are no opponent arrays.
 */
const opponentGamesBetween = (
  arrays: GraphArrays,
  x: number,
  y: number
): number => {
  const { oppA, oppB, oppGames } = arrays;
  if (
    oppA === undefined ||
    oppB === undefined ||
    oppGames === undefined ||
    x === y
  )
    return 0;
  const a = Math.min(x, y);
  const b = Math.max(x, y);
  let low = 0;
  let high = oppA.length - 1;
  while (low <= high) {
    const mid = (low + high) >>> 1;
    const midA = oppA[mid];
    const midB = oppB[mid];
    if (midA === a && midB === b) return oppGames[mid];
    if (midA < a || (midA === a && midB < b)) low = mid + 1;
    else high = mid - 1;
  }
  return 0;
};

/**
 * The players this player has faced, most games first, then lower player ID. Dressed goalies are nobody's
 * opponent because only credited appearances make pairs. A graph without opponent arrays is
 * `HistoryUnavailable`, never an empty list.
 */
export const opponents = (
  graph: Graph,
  playerId: number
): Result.Result<readonly Opponent[], UnknownPlayer | HistoryUnavailable> => {
  const index = graph.indexOf.get(playerId);
  if (index === undefined) return Result.fail(new UnknownPlayer({ playerId }));
  const adjacency = opponentAdjacency(graph);
  if (adjacency === undefined) {
    return Result.fail(
      new HistoryUnavailable({
        message: "This history file has no opponent data.",
      })
    );
  }
  const { offsets, neighbours, games } = adjacency;
  const rows: Opponent[] = [];
  for (let at = offsets[index]; at < offsets[index + 1]; at += 1) {
    rows.push({
      playerId: graph.arrays.playerIds[neighbours[at]],
      games: games[at],
    });
  }
  return Result.succeed(Array.sortBy(opponentOrder)(rows));
};

// Most shared games first; the tie-break is the lowest player ID.
const opponentOrder: Order.Order<Opponent> = Order.combine(
  Order.mapInput(Order.flip(Order.Number), (row: Opponent) => row.games),
  Order.mapInput(Order.Number, (row: Opponent) => row.playerId)
);

// A fresh object per call: `LinkResult` is not deeply readonly at runtime, so a shared one could be corrupted by a caller.
const noTeammateLink = (opposedGames: number): LinkResult => ({
  spans: [],
  totalGames: 0,
  evidenceGameId: null,
  opposedGames,
});

/**
 * The kind of tie between two players by ID under the filter, or null when no span passes (not teammates,
 * the same player, an ID the graph does not hold, or a non-integer). The ID-based form of `hopKind` for
 * callers outside the package, which must not handle player indexes.
 */
export const linkKind = (
  graph: TeammateGraph,
  a: number,
  b: number,
  filter: Filter
): LinkKind | null => {
  const ai = graph.indexOf.get(a);
  const bi = graph.indexOf.get(b);
  if (ai === undefined || bi === undefined) return null;
  const linkId = linkIdBetween(graph, ai, bi);
  return linkId < 0 ? null : hopKind(graph, linkId, filter);
};

/**
 * The link between two players by ID: their teammate spans and the games they played against each other.
 * Spans list shared-game spans before goalie-partner spans, each in array order; the evidence game is the
 * first span's first game. A pair with no passing span (including a pair never linked, or the same player
 * twice) gets no spans, 0 games, null evidence. `opposedGames` ignores the filter (opponent links carry a
 * game count only, D14) and is 0 when the pair never met. It is also 0 when the graph has no opponent
 * arrays: `link` cannot fail on that, so callers that need to tell the two apart use `opponents`.
 */
export const link = (
  graph: TeammateGraph,
  a: number,
  b: number,
  filter: Filter
): Result.Result<LinkResult, UnknownPlayer> => {
  const ai = graph.indexOf.get(a);
  if (ai === undefined) return Result.fail(new UnknownPlayer({ playerId: a }));
  const bi = graph.indexOf.get(b);
  if (bi === undefined) return Result.fail(new UnknownPlayer({ playerId: b }));
  const opposedGames = opponentGamesBetween(graph.arrays, ai, bi);
  const linkId = linkIdBetween(graph, ai, bi);
  if (linkId < 0) return Result.succeed(noTeammateLink(opposedGames));
  const spans = linkSpans(graph, linkId, filter);
  if (spans.length === 0) return Result.succeed(noTeammateLink(opposedGames));
  const totalGames = spans.reduce((sum, span) => sum + span.games, 0);
  return Result.succeed({
    spans,
    totalGames,
    evidenceGameId: spans[0].firstGameId,
    opposedGames,
  });
};

/**
 * Every teammate of a player under the filter, ascending by player ID, each with the spans `link` returns
 * for the pair. A teammate with no passing span is left out. One walk over the player's adjacency, so a
 * caller that wants the whole list never asks pair by pair.
 */
export const teammateLinks = (
  graph: TeammateGraph,
  playerId: number,
  filter: Filter
): Result.Result<readonly TeammateLink[], UnknownPlayer> => {
  const index = graph.indexOf.get(playerId);
  if (index === undefined) return Result.fail(new UnknownPlayer({ playerId }));
  const { offsets, neighbours, linkIds } = graph.adjacency;
  const start = offsets[index];
  const end = offsets[index + 1];
  return Result.succeed(
    Array.flatMapNullishOr(
      Array.zip(
        Array.fromIterable(neighbours.subarray(start, end)),
        Array.fromIterable(linkIds.subarray(start, end))
      ),
      ([neighbour, linkId]) => {
        const spans = linkSpans(graph, linkId, filter);
        return spans.length === 0
          ? null
          : { playerId: graph.arrays.playerIds[neighbour], spans };
      }
    )
  );
};
