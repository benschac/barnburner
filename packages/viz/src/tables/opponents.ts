import { Array, Effect, Order } from 'effect'
import { opponents as opponentsOf } from '@nhl-reddit-stats/history'
import type { Graph, HistoryStore, HistoryUnavailable, UnknownPlayer } from '@nhl-reddit-stats/history'
import type { FacedRow, OpponentsTables, PlayerRow } from '../contracts.ts'

const NOTES = 'players: The two players asked about and every opponent of either. '
  + 'faced: The opponents of each player, most games first, then lower player ID.'

/** `opponents`: the opponents of players `a` and `b`, with a `players` row for each player named. Equal IDs are listed once. */
export const opponents = (
  graph: Graph,
  store: HistoryStore,
  a: number,
  b: number,
): Effect.Effect<{ readonly tables: OpponentsTables; readonly notes: string }, UnknownPlayer | HistoryUnavailable> =>
  Effect.gen(function* () {
    const focuses = Array.dedupe([a, b])
    const facedByFocus = yield* Effect.forEach(focuses, (focus) =>
      Effect.map(Effect.fromResult(opponentsOf(graph, focus)), (rows) =>
        Array.map(rows, (row): FacedRow => ({ focus, opponent: row.playerId, games: row.games }))))
    const faced = Array.flatten(facedByFocus)
    const ids = Array.dedupe([...focuses, ...Array.map(faced, (row) => row.opponent)])
    const players = yield* Effect.forEach(Array.sort(ids, Order.Number), (playerId) =>
      Effect.map(store.player(playerId), ({ player }): PlayerRow => ({
        playerId: player.playerId,
        name: player.name,
        position: player.position,
        firstSeason: player.firstSeason,
        lastSeason: player.lastSeason,
        games: player.games,
      })))
    return { tables: { players, faced }, notes: NOTES }
  })
