import { Array, Effect, Order, Schema } from 'effect'
import {
  DEFAULT_FILTER, HistoryUnavailable, UnknownRoster, link,
} from '@nhl-reddit-stats/history'
import type {
  GameType, HistoryStore, PlayerDetail, StintRow, TeammateGraph, UnknownPlayer,
} from '@nhl-reddit-stats/history'
import type { PairSpanRow, PairSummaryRow, PairTables, PlayerRow, TeamRow } from '../contracts.ts'

// `pair` (plan section FT, FT2): the teammate and opposed games of two players under the default filter.
// Pure over the teammate graph and the store; the result matches `pairSample` in `src/samples.ts`.

const NOTES =
  'players: The two players. '
  + 'teams: The clubs they shared. '
  + 'spans: Each season, competition, and club in which they played together. '
  + 'summary: Their games together and their games on opposite sides.'

/** A player paired with himself. The pair is two different players, so this is an input error. */
export class SelfPair extends Schema.TaggedError<SelfPair, { readonly brand: unique symbol }>()('SelfPair', {
  playerId: Schema.Int,
}) {}

/** The view a pair builder returns: its tables and the one-sentence notes for each table. */
export type PairView = {
  readonly tables: PairTables
  readonly notes: string
}

const playerRow = ({ player }: PlayerDetail): PlayerRow => ({
  playerId: player.playerId,
  name: player.name,
  position: player.position,
  firstSeason: player.firstSeason,
  lastSeason: player.lastSeason,
  games: player.games,
})

const stintFor = (stints: ReadonlyArray<StintRow>, teamId: number, seasonId: number, gameType: GameType) =>
  stints.find((s) => s.teamId === teamId && s.seasonId === seasonId && s.gameType === gameType)

/**
 * The club's name. A stint of either player on that team comes first. A goalie-partner span can have
 * neither player credited for the club (D2), so the club is then named by a roster player for that
 * season and game type: the first one with a stint for that club in that stint. No name is a failure.
 */
const teamRow = (
  store: HistoryStore,
  teamId: number,
  seasonId: number,
  gameType: GameType,
  stints: ReadonlyArray<StintRow>,
): Effect.Effect<TeamRow, HistoryUnavailable | UnknownPlayer> =>
  Effect.gen(function* () {
    const own = stints.find((s) => s.teamId === teamId)
    if (own !== undefined) return { teamId, abbrev: own.teamAbbrev, name: own.teamName }
    const roster = yield* store.roster(teamId, seasonId, gameType).pipe(
      Effect.catchTag('UnknownRoster', (e: UnknownRoster) => Effect.fail(new HistoryUnavailable({
        message: `No roster on record for team ${e.teamId} in season ${e.seasonId}, which names a pair's club.`,
      }))),
    )
    // loop: stops at the first roster player with a stint for the club, so later players are never fetched
    for (const member of roster) {
      const detail = yield* store.player(member.playerId)
      const stint = stintFor(detail.stints, teamId, seasonId, gameType)
      if (stint !== undefined) return { teamId, abbrev: stint.teamAbbrev, name: stint.teamName }
    }
    return yield* new HistoryUnavailable({
      message: `No club name on record for team ${teamId} in season ${seasonId}.`,
    })
  })

/**
 * The shared and opposed games of `a` and `b`, default filter, with the lower ID first. Unknown players
 * and store failures come back as tagged errors; two players with no shared games are an empty `spans`.
 */
export const pair = (
  graph: TeammateGraph, store: HistoryStore, a: number, b: number,
): Effect.Effect<PairView, SelfPair | UnknownPlayer | HistoryUnavailable> =>
  Effect.gen(function* () {
    if (a === b) return yield* new SelfPair({ playerId: a })
    const low = Math.min(a, b)
    const high = Math.max(a, b)
    const found = yield* Effect.fromResult(link(graph, low, high, DEFAULT_FILTER))
    const details = yield* Effect.forEach([low, high], (playerId) => store.player(playerId))
    const stints = details.flatMap((detail) => detail.stints)

    // One club row per team, named from the first span for that team.
    const firstSpan = new Map<number, PairSpanRow>()
    for (const span of found.spans) if (!firstSpan.has(span.teamId)) firstSpan.set(span.teamId, span)
    const teamIds = Array.sort(firstSpan.keys(), Order.Number)
    const teams = yield* Effect.forEach(teamIds, (teamId) => {
      const span = firstSpan.get(teamId)
      if (span === undefined) {
        // defect: firstSpan has an entry for every id in teamIds
        throw new Error('pair: no span for team ' + String(teamId))
      }
      return teamRow(store, teamId, span.seasonId, span.gameType, stints)
    })

    const spans: PairSpanRow[] = found.spans.map((span) => ({
      seasonId: span.seasonId,
      gameType: span.gameType,
      teamId: span.teamId,
      link: span.link,
      games: span.games,
      firstGameId: span.firstGameId,
    }))
    const summary: PairSummaryRow[] = [{
      a: low,
      b: high,
      totalGames: found.totalGames,
      opposedGames: found.opposedGames,
    }]

    return {
      tables: { players: details.map(playerRow), teams, spans, summary },
      notes: NOTES,
    }
  })
