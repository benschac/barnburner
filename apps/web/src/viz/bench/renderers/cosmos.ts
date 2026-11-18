import { Graph } from '@cosmos.gl/graph'
import type { BenchData, BenchHandle, BenchRenderer, VizTheme } from '@nhl-reddit-stats/viz'

const MIN_SIZE = 3
const MAX_SIZE = 18
const MIN_ALPHA = 0.08
const MAX_ALPHA = 0.9

type Rgb = readonly [number, number, number]

/** Resolve any CSS colour string to 0..1 RGB through a canvas, so the theme may use any format. */
const toRgb = (css: string): Rgb => {
  const ctx = document.createElement('canvas').getContext('2d')
  // defect: no 2D context means the theme colours cannot be resolved, and no colour of ours may stand in
  if (ctx === null) throw new Error('cosmos renderer: a 2D canvas context is required to resolve theme colours')
  ctx.fillStyle = css
  ctx.fillRect(0, 0, 1, 1)
  const [r = 0, g = 0, b = 0] = ctx.getImageData(0, 0, 1, 1).data
  return [r / 255, g / 255, b / 255]
}

const lerp = (lo: number, hi: number, t: number): number => lo + (hi - lo) * t

/** A loop, not `Math.max(...xs)`: a spread of hundreds of thousands of arguments overflows the stack. */
const maxGames = (items: ReadonlyArray<{ readonly games: number }>): number => {
  let max = 1
  for (const item of items) if (item.games > max) max = item.games
  return max
}

/** Link endpoint pairs and RGBA colours, with opacity scaled from `games`. */
const buildLinks = (data: BenchData, index: ReadonlyMap<number, number>, rgb: Rgb) => {
  const maxLink = maxGames(data.links)
  const pairs = new Float32Array(data.links.length * 2)
  const colors = new Float32Array(data.links.length * 4)
  let n = 0
  for (const link of data.links) {
    const a = index.get(link.a)
    const b = index.get(link.b)
    if (a === undefined || b === undefined) continue
    pairs[n * 2] = a
    pairs[n * 2 + 1] = b
    colors.set([rgb[0], rgb[1], rgb[2], lerp(MIN_ALPHA, MAX_ALPHA, link.games / maxLink)], n * 4)
    n += 1
  }
  return { pairs: pairs.subarray(0, n * 2), colors: colors.subarray(0, n * 4) }
}

const nextFrame = (): Promise<void> => new Promise((resolve) => requestAnimationFrame(() => resolve()))

const mount: BenchRenderer['mount'] = async (root: HTMLElement, data: BenchData, theme: VizTheme): Promise<BenchHandle> => {
  const div = document.createElement('div')
  div.style.width = '100%'
  div.style.height = '100%'
  root.appendChild(div)
  let graph: Graph | undefined
  let mounted = false
  try {
    const pointRgb = toRgb(theme.brand)
    const linkRgb = toRgb(theme.muted)

    const index = new Map<number, number>()
    data.nodes.forEach((node, i) => index.set(node.playerId, i))
    const maxNode = maxGames(data.nodes)

    const positions = new Float32Array(data.nodes.length * 2)
    const sizes = new Float32Array(data.nodes.length)
    const colors = new Float32Array(data.nodes.length * 4)
    data.nodes.forEach((node, i) => {
      const angle = i * 2.399963
      const radius = 40 * Math.sqrt(i + 1)
      positions[i * 2] = 2048 + radius * Math.cos(angle)
      positions[i * 2 + 1] = 2048 + radius * Math.sin(angle)
      sizes[i] = lerp(MIN_SIZE, MAX_SIZE, Math.sqrt(node.games / maxNode))
      colors.set([pointRgb[0], pointRgb[1], pointRgb[2], 1], i * 4)
    })
    const links = buildLinks(data, index, linkRgb)

    // Resolved by cosmos.gl's `onSimulationEnd` callback (see config.d.ts).
    let ended: () => void = () => {}
    const simulationEnded = new Promise<void>((resolve) => {
      ended = resolve
    })
    const g = new Graph(div, {
      backgroundColor: theme.background,
      enableSimulation: true,
      fitViewOnInit: false,
      scalePointsOnZoom: true,
      simulationGravity: 0.25,
      simulationRepulsion: 1,
      onSimulationEnd: () => ended(),
    })
    graph = g
    await g.ready

    // Running camera: world centre and zoom, owned here because transitions read stale state.
    let cx = 0
    let cy = 0
    let k = 1
    if (data.nodes.length > 0) {
      g.setPointPositions(positions)
      g.setPointSizes(sizes)
      g.setPointColors(colors)
      g.setLinks(links.pairs)
      g.setLinkColors(links.colors)
      g.render()
      await simulationEnded
      g.fitView(0, 0.1, false)
      await nextFrame()
      await nextFrame()
      k = g.getZoomLevel()
      ;[cx, cy] = g.screenToSpacePosition([div.clientWidth / 2, div.clientHeight / 2])
    }
    const apply = (): void => {
      if (data.nodes.length === 0) return
      g.setZoomTransformByPointPositions(new Float32Array([cx, cy]), 0, k, 0, false)
    }

    mounted = true
    return {
      pan(dx, dy) {
        // Drawing moves right/down by (dx, dy) screen px; world Y grows upward, so the view centre
        // moves left by dx and up in world (+Y) by dy.
        cx -= dx / k
        cy += dy / k
        apply()
      },
      zoom(factor) {
        k *= factor
        apply()
      },
      destroy() {
        g.destroy()
        div.remove()
      },
    }
  } finally {
    if (!mounted) {
      graph?.destroy()
      div.remove()
    }
  }
}

const renderer: BenchRenderer = { name: 'cosmos.gl', mount }
export default renderer
