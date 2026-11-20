import type { ChainTables } from '@nhl-reddit-stats/viz'

// Chain spec (plan D6, section C-viz): turns the `chain` tables into G6-shaped data. Pure; no G6 import.
// The shapes are assignable to G6's NodeData and EdgeData, so the view passes them straight in.

export type ChainNodeData = {
  readonly playerId: number
  readonly name: string
  readonly position: 'C' | 'L' | 'R' | 'D' | 'G'
  readonly firstSeason: number
  readonly lastSeason: number
  readonly games: number
  /** True for the two ends of the chain. */
  readonly end: boolean
}

export type ChainNode = { readonly id: string; readonly data: ChainNodeData }

export type ChainEdgeData = {
  readonly label: string
  readonly kind: 'PlayedWith' | 'GoaliePartners'
  readonly games: number
  readonly seasonId: number
  readonly teamId: number
  readonly gameType: 2 | 3
  /** The game that proves the hop. */
  readonly evidenceGameId: number
}

export type ChainEdge = {
  readonly id: string
  readonly source: string
  readonly target: string
  readonly data: ChainEdgeData
  /** G6 draws the edge label from `style.labelText`. */
  readonly style: { readonly labelText: string }
}

export type ChainGraph = {
  nodes: ChainNode[]
  edges: ChainEdge[]
  /** Each chain's edge IDs in D6 order, first chain first, for highlighting. */
  readonly chains: ReadonlyArray<ReadonlyArray<string>>
}

/** 19501951 reads as "1950-51". */
const seasonLabel = (seasonId: number): string => {
  const start = Math.floor(seasonId / 10000)
  return `${start}–${String(seasonId % 10000).slice(2)}`
}

export const chainGraph = (tables: ChainTables): ChainGraph => {
  const summary = tables.summary[0]
  if (summary === undefined) {
    // defect: a chain answer always carries one summary row
    throw new Error('chain tables have no summary row')
  }
  const players = new Map(tables.players.map((player) => [player.playerId, player]))
  const abbrevs = new Map(tables.teams.map((team) => [team.teamId, team.abbrev]))
  const hops = tables.hops.toSorted((a, b) => a.chain - b.chain || a.step - b.step)

  const nodes = new Map<string, ChainNode>()
  const addNode = (playerId: number) => {
    const id = String(playerId)
    if (nodes.has(id)) return
    const player = players.get(playerId)
    if (player === undefined) {
      // defect: a hop names a player the tables do not list
      throw new Error(`chain tables have no players row for ${playerId}`)
    }
    nodes.set(id, {
      id,
      data: {
        playerId,
        name: player.name,
        position: player.position,
        firstSeason: player.firstSeason,
        lastSeason: player.lastSeason,
        games: player.games,
        end: playerId === summary.from || playerId === summary.to,
      },
    })
  }

  if (hops.length === 0) addNode(summary.from)

  const edges = new Map<string, ChainEdge>()
  const chains = new Map<number, string[]>()

  for (const hop of hops) {
    addNode(hop.from)
    addNode(hop.to)
    const id = `${hop.from}-${hop.to}`
    if (!edges.has(id)) {
      const team = abbrevs.get(hop.teamId) ?? String(hop.teamId)
      const count = hop.kind === 'GoaliePartners' ? `${hop.games} dressed` : `${hop.games} games`
      const label = `${team} ${seasonLabel(hop.seasonId)} · ${count}`
      edges.set(id, {
        id,
        source: String(hop.from),
        target: String(hop.to),
        style: { labelText: label },
        data: {
          label,
          kind: hop.kind,
          games: hop.games,
          seasonId: hop.seasonId,
          teamId: hop.teamId,
          gameType: hop.gameType,
          evidenceGameId: hop.gameId,
        },
      })
    }
    const chain = chains.get(hop.chain) ?? []
    chain.push(id)
    chains.set(hop.chain, chain)
  }

  return {
    nodes: [...nodes.values()],
    edges: [...edges.values()],
    chains: hops.length === 0 ? [[]] : [...chains.values()],
  }
}
