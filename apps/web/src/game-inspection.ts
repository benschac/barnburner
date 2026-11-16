/**
 * Which game the poster highlights across both charts and the division rows.
 *
 * Two owners can ask for a highlight. The pointer's request lasts while it hovers.
 * Keyboard focus or a click holds a game until blur or Escape. The newest request
 * shows; when the pointer leaves, the held game shows again.
 */
export type GameInspection = {
  readonly team: string
  readonly pointed: number | null
  readonly held: number | null
}

export type GameInspectionEvent =
  /** The pointer is over `game`, or left with `null`. */
  | { readonly type: 'point'; readonly team: string; readonly game: number | null }
  /** Focus or a click selected `game`; `null` releases it on blur or Escape. */
  | { readonly type: 'hold'; readonly team: string; readonly game: number | null }

export const idleInspection = (team: string): GameInspection => ({ team, pointed: null, held: null })

/** Game indexes belong to one team's season, so a request for another team starts from idle. */
export function inspectGame(state: GameInspection, event: GameInspectionEvent): GameInspection {
  const sameTeam = state.team === event.team
  const pointed = event.type === 'point' ? event.game : null
  const held = event.type === 'hold' ? event.game : sameTeam ? state.held : null
  // Returning the same object lets React skip a render on every repeated pointer move.
  return sameTeam && pointed === state.pointed && held === state.held ? state : { team: event.team, pointed, held }
}

/** The highlighted game index for `team`, or `null` when nothing is inspected. */
export const inspectedGame = (state: GameInspection, team: string) =>
  state.team === team ? state.pointed ?? state.held : null
