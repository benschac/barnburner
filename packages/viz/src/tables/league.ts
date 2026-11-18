import { Array, Effect, Order } from 'effect'
import type { Graph, HistoryStore, HistoryUnavailable, UnknownPlayer } from '@nhl-reddit-stats/history'
import type { LeagueTables } from '../contracts.ts'

const NOTES =
  'players: Every player, with the number of teammates each has. '
  + 'links: Every teammate link, with its games together and the first season.'

/**
 * The league tables: every player and every teammate link, read from the graph arrays. A link's games
 * are its spans summed; its first season is the earliest season of any span.
 */
export const league = (
  graph: Graph, store: HistoryStore,
): Effect.Effect<{ readonly tables: LeagueTables; readonly notes: string }, HistoryUnavailable | UnknownPlayer> =>
  Effect.gen(function* () {
    const { playerIds, seasonIds, edgeA, edgeB, spanStart, spanSeason, spanGames } = graph.arrays
    const teammates = new Uint32Array(playerIds.length)
    const links: LeagueTables['links'][number][] = []
    for (let i = 0; i < edgeA.length; i += 1) {
      const ai = edgeA[i]
      const bi = edgeB[i]
      let games = 0
      let first = Number.POSITIVE_INFINITY
      for (let s = spanStart[i]; s < spanStart[i + 1]; s += 1) {
        games += spanGames[s]
        first = Math.min(first, seasonIds[spanSeason[s]])
      }
      teammates[ai] += 1
      teammates[bi] += 1
      const a = playerIds[ai]
      const b = playerIds[bi]
      links.push({ a: Math.min(a, b), b: Math.max(a, b), games, firstSeason: first })
    }
    const order = Array.sortWith(playerIds.keys(), (index) => playerIds[index], Order.Number)
    const players = yield* Effect.forEach(order, (index) =>
      Effect.map(store.player(playerIds[index]), ({ player }): LeagueTables['players'][number] => ({
        playerId: player.playerId,
        name: player.name,
        position: player.position,
        firstSeason: player.firstSeason,
        lastSeason: player.lastSeason,
        games: player.games,
        teammates: teammates[index],
      })))
    return { tables: { players, links }, notes: NOTES }
  })
