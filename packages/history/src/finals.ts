// Stanley Cup Finals coverage (C-search): in which Finals did a teammate of a player play?
import { Array, Effect, Order } from 'effect'
import { HistoryUnavailable, UnknownPlayer } from './contracts.ts'
import type { TeammateGraph } from './graph.ts'
import { FinalsHit, FinalsMiss } from './shapes.ts'
import type { FinalRow, FinalsYear } from './shapes.ts'
import type { HistoryStore } from './store.ts'

type Teammate = { readonly games: number; readonly sharedGameId: number }

/** Shared-game teammates (span_link 0 only) of the player at `index`, by player ID. Goalie partners are left out. */
const sharedGameTeammates = (graph: TeammateGraph, index: number): ReadonlyMap<number, Teammate> => {
  const { offsets, neighbours, linkIds } = graph.adjacency
  const { playerIds, spanStart, spanLink, spanGames, spanFirstGame } = graph.arrays
  const teammates = new Map<number, Teammate>()
  for (let at = offsets[index]; at < offsets[index + 1]; at += 1) {
    const linkId = linkIds[at]
    let games = 0
    let sharedGameId = -1
    for (let span = spanStart[linkId]; span < spanStart[linkId + 1]; span += 1) {
      if (spanLink[span] !== 0) continue
      if (sharedGameId < 0) sharedGameId = spanFirstGame[span]
      games += spanGames[span]
    }
    if (sharedGameId >= 0) teammates.set(playerIds[neighbours[at]], { games, sharedGameId })
  }
  return teammates
}

const coverFinal = (teammates: ReadonlyMap<number, Teammate>, playerId: number, final: FinalRow): FinalsYear => {
  let best: { readonly playerId: number; readonly firstGameId: number; readonly teammate: Teammate } | null = null
  for (const participant of final.participants) {
    // The player himself never counts: only a teammate who also played makes a hit.
    if (participant.playerId === playerId) continue
    const teammate = teammates.get(participant.playerId)
    if (teammate === undefined) continue
    if (
      best === null || teammate.games > best.teammate.games ||
      (teammate.games === best.teammate.games && participant.playerId < best.playerId)
    ) {
      best = { playerId: participant.playerId, firstGameId: participant.firstGameId, teammate }
    }
  }
  if (best === null) return FinalsMiss.make({ year: final.year, seasonId: final.seasonId })
  return FinalsHit.make({
    year: final.year,
    seasonId: final.seasonId,
    playerId: best.playerId,
    finalGameId: best.firstGameId,
    sharedGameId: best.teammate.sharedGameId,
  })
}

/**
 * For each Final year in `fromYear..toYear` (inclusive, ascending), a `Hit` when a shared-game teammate of
 * the player played in that Final, else a `Miss`. The teammate link may come before or after the Final.
 * Goalie partners do not count. The player playing in a Final does not make a hit unless a teammate also
 * played in it. Among matched teammates the pick is the one with the most shared games, then the lower ID;
 * `finalGameId` is that teammate's first Final game and `sharedGameId` the first game of the first
 * shared-game span of the link.
 */
export const finalsCoverage = (
  graph: TeammateGraph, store: HistoryStore, playerId: number, fromYear: number, toYear: number,
): Effect.Effect<ReadonlyArray<FinalsYear>, UnknownPlayer | HistoryUnavailable> => {
  const index = graph.indexOf.get(playerId)
  if (index === undefined) return Effect.fail(new UnknownPlayer({ playerId }))
  const teammates = sharedGameTeammates(graph, index)
  return Effect.map(store.finals(fromYear, toYear), (finals) =>
    Array.sortWith(
      finals.filter((final) => final.year >= fromYear && final.year <= toYear),
      (final) => final.year,
      Order.Number,
    ).map((final) => coverFinal(teammates, playerId, final)))
}
