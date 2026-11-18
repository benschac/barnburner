import { Renderer as WebGLRenderer } from '@antv/g-webgl'
import { EdgeEvent, type IElementEvent, ExtensionCategory, Graph, getExtension, register, type GraphData } from '@antv/g6'
import { ReactNode as G6ReactNode } from '@antv/g6-extension-react'
import contract from '../../design/contract.json' with { type: 'json' }
import { TamaguiProvider, View, type TamaguiElement } from 'tamagui'
import { config } from '../../tamagui.config'
import { useEffect, useMemo, useRef, type ComponentType } from 'react'
import { g6Theme, useVizTheme } from './theme'

// The G6 host (plan D6, section C-viz): mounts a graph for `{ nodes, edges }`, applies g6Theme, redraws on
// data or theme change, resizes with its container, and destroys the graph on unmount.

/** What a custom node component receives: the node's id and its `data`. */
export type G6NodeProps = { readonly id: string; readonly data: Readonly<Record<string, unknown>> }

export type G6GraphProps = {
  readonly data: GraphData
  readonly layout: 'dagre' | 'force'
  /** Drawn for each node in place of the default circle. */
  readonly node?: ComponentType<G6NodeProps>
  readonly renderer?: 'canvas' | 'webgl'
  /** A `size` token of design/contract.json (for example `drawer`); the design rules accept no pixel count. */
  readonly height: keyof typeof contract.size
  /** Called with the edge id when the pointer enters an edge, and with null when it leaves. */
  readonly onEdgeHover?: (edgeId: string | null) => void
  /**
   * Edge ids to draw highlighted; while the list is non-empty every other edge is dimmed. Changing it sets
   * element states on the existing graph: no rebuild, no new layout.
   */
  readonly highlightedEdges?: ReadonlyArray<string>
}

const HIGHLIGHTED = 'highlighted'
const DIMMED = 'dimmed'

function applyHighlight(graph: Graph, edgeIds: ReadonlyArray<string>) {
  const marked = new Set(edgeIds)
  const states: Record<string, string[]> = {}
  for (const edge of graph.getEdgeData()) {
    const id = String(edge.id)
    states[id] = marked.size === 0 ? [] : marked.has(id) ? [HIGHLIGHTED] : [DIMMED]
  }
  void graph.setElementState(states, false)
}

const REACT_NODE = 'react-node'
const NODE_SIZE: [number, number] = [180, 96]

function registerReactNode() {
  if (getExtension(ExtensionCategory.NODE, REACT_NODE) === undefined) register(ExtensionCategory.NODE, REACT_NODE, G6ReactNode)
}

export function G6Graph({ data, layout, node: NodeView, renderer = 'canvas', height, onEdgeHover, highlightedEdges }: G6GraphProps) {
  const vizTheme = useVizTheme()
  // useVizTheme builds a new object each render; key on the values the graph reads.
  const themeKey = [vizTheme.mode, vizTheme.background, vizTheme.surface, vizTheme.rule, vizTheme.color, vizTheme.muted, vizTheme.brand].join('|')
  // eslint-disable-next-line react-hooks/exhaustive-deps -- themeKey stands for vizTheme
  const theme = useMemo(() => vizTheme, [themeKey])
  const root = useRef<TamaguiElement>(null)
  // The latest callback and highlight list, read by the graph without rebuilding it.
  const hoverCallback = useRef(onEdgeHover)
  const highlighted = useRef<ReadonlyArray<string>>(highlightedEdges ?? [])
  const live = useRef<{ graph: Graph; drawn: Promise<unknown> } | null>(null)
  useEffect(() => {
    hoverCallback.current = onEdgeHover
  }, [onEdgeHover])
  useEffect(() => {
    highlighted.current = highlightedEdges ?? []
    const current = live.current
    if (current) void current.drawn.then(() => applyHighlight(current.graph, highlighted.current))
  }, [highlightedEdges])

  useEffect(() => {
    const container = root.current
    if (!(container instanceof HTMLElement)) return
    if (NodeView) registerReactNode()
    // G6 needs pixels; the token's value is set on the element so no style prop is needed.
    const pixels = contract.size[height]
    container.style.height = `${pixels}px`
    const colours = g6Theme(theme)
    const graph = new Graph({
      container,
      width: container.clientWidth,
      height: pixels,
      background: colours.background,
      ...(renderer === 'webgl' ? { renderer: () => new WebGLRenderer() } : {}),
      animation: false,
      padding: 24,
      data,
      node: {
        ...(NodeView
          ? {
              type: REACT_NODE,
              style: {
                size: NODE_SIZE,
                component: (datum: { id: string; data?: Record<string, unknown> }) => (
                  // G6 renders each node in its own React root, so it needs its own Tamagui provider.
                  <TamaguiProvider config={config} defaultTheme={theme.mode} disableInjectCSS>
                    <NodeView id={datum.id} data={datum.data ?? {}} />
                  </TamaguiProvider>
                ),
              },
            }
          : {
              style: {
                size: 28,
                fill: colours.node.style.fill,
                stroke: colours.node.style.stroke,
                lineWidth: 1,
                labelText: (datum) => {
                  const name = datum.data?.name
                  return typeof name === 'string' ? name : String(datum.id)
                },
                labelFill: colours.node.style.labelFill,
                labelFontFamily: theme.fonts.body,
              },
            }),
        state: {
          active: { stroke: theme.brand, lineWidth: 2 },
          inactive: { opacity: 0.35 },
        },
      },
      edge: {
        style: { ...colours.edge.style, lineWidth: 1, labelFill: theme.muted, labelFontFamily: theme.fonts.body },
        state: {
          active: { stroke: theme.brand, lineWidth: 2 },
          inactive: { opacity: 0.2 },
          [HIGHLIGHTED]: { stroke: theme.brand, lineWidth: 3 },
          [DIMMED]: { opacity: 0.2 },
        },
      },
      layout: layout === 'dagre' ? { type: 'dagre', rankdir: 'LR', nodesep: 24, ranksep: 64 } : { type: 'd3-force', animation: false, link: { distance: 140 }, collide: { radius: 48 }, manyBody: { strength: -300 } },
      behaviors: ['drag-canvas', 'zoom-canvas', { type: 'hover-activate', degree: 1 }],
    })
    graph.on(EdgeEvent.POINTER_ENTER, (event: IElementEvent) => hoverCallback.current?.(String(event.target.id)))
    graph.on(EdgeEvent.POINTER_LEAVE, () => hoverCallback.current?.(null))
    let alive = true
    // Destroying a graph mid-render logs an error, so cleanup waits for the render to settle.
    const drawn = graph
      .render()
      .then(async () => {
        if (!alive) return
        await graph.fitView({ when: 'always' }, false)
        // A small graph is fitted to the box, not blown up past its natural size.
        if (graph.getZoom() > 1) await graph.zoomTo(1, false)
        applyHighlight(graph, highlighted.current)
      })
      .catch(() => undefined)
    live.current = { graph, drawn }
    const observer = new ResizeObserver(() => {
      if (alive) graph.setSize(container.clientWidth, pixels)
    })
    observer.observe(container)
    return () => {
      alive = false
      live.current = null
      observer.disconnect()
      void drawn.then(() => graph.destroy())
    }
  }, [data, layout, NodeView, renderer, height, theme])

  return <View ref={root} w="100%" />
}
