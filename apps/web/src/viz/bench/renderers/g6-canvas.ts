import { Graph, GraphEvent } from '@antv/g6'
import type { BenchRenderer } from '@nhl-reddit-stats/viz/contracts'

/** A loop, not `Math.max(...rows)`: the real export has hundreds of thousands of links, past the argument limit. */
const maxOf = <T>(rows: ReadonlyArray<T>, pick: (row: T) => number) => {
  let max = 1
  for (const row of rows) {
    const value = pick(row)
    if (value > max) max = value
  }
  return max
}

const clamp = (value: number, low: number, high: number) => Math.min(high, Math.max(low, value))

const renderer: BenchRenderer = {
  name: 'g6-canvas',
  async mount(root, data, theme) {
    const maxNodeGames = maxOf(data.nodes, (node) => node.games)
    const maxLinkGames = maxOf(data.links, (link) => link.games)

    const graph = new Graph({
      container: root,
      animation: false,
      background: theme.background,
      data: {
        nodes: data.nodes.map((node) => ({
          id: String(node.playerId),
          data: { name: node.name, games: node.games },
        })),
        edges: data.links.map((link, index) => ({
          id: `link-${index}`,
          source: String(link.a),
          target: String(link.b),
          data: { games: link.games },
        })),
      },
      node: {
        style: {
          size: (datum) => 4 + 12 * Math.sqrt(Number(datum.data?.games ?? 0) / maxNodeGames),
          fill: theme.brand,
          stroke: theme.background,
          lineWidth: 0.5,
        },
      },
      edge: {
        style: {
          stroke: theme.chartLine,
          lineWidth: 1,
          strokeOpacity: (datum) => clamp(Number(datum.data?.games ?? 0) / maxLinkGames, 0.05, 1),
        },
      },
      layout: { type: 'd3-force', animation: false },
    })

    // mount resolves once the force layout has settled (G6 emits AFTER_LAYOUT), not at first paint.
    const settled = new Promise<void>((resolve) => {
      graph.once(GraphEvent.AFTER_LAYOUT, () => resolve())
    })
    try {
      await graph.render()
      await settled
    } catch (failure) {
      graph.destroy()
      throw failure
    }

    return {
      pan: (dx, dy) => {
        void graph.translateBy([dx, dy], false)
      },
      zoom: (factor) => {
        void graph.zoomBy(factor, false)
      },
      destroy: () => {
        graph.destroy()
      },
    }
  },
}

export default renderer
