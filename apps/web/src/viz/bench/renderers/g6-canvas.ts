import { Graph } from '@antv/g6'
import { Array, Order } from 'effect'
import type { BenchRenderer } from '@nhl-reddit-stats/viz/contracts'

/** `Array.max`, not `Math.max(...rows)`: the real export has hundreds of thousands of links, past the argument limit. The prepended 1 is the floor that avoids dividing by zero on empty data. */
const maxOf = <T>(rows: ReadonlyArray<T>, pick: (row: T) => number) =>
  Array.max(Array.prepend(Array.map(rows, pick), 1), Order.Number)

const clampNumber = Order.clamp(Order.Number)

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
          strokeOpacity: (datum) => clampNumber(Number(datum.data?.games ?? 0) / maxLinkGames, { minimum: 0.05, maximum: 1 }),
        },
      },
      layout: { type: 'd3-force', animation: false },
    })

    // mount resolves once the force layout has settled, not at first paint: render() awaits the
    // post layout (the d3-force simulation) before it resolves.
    try {
      await graph.render()
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
