import { Renderer as WebGLRenderer } from '@antv/g-webgl'
import { EdgeEvent, type IElementEvent, ExtensionCategory, Graph, getExtension, register, type GraphData } from '@antv/g6'
import { ReactNode as G6ReactNode } from '@antv/g6-extension-react'
import { Effect, Schema } from 'effect'
import { TamaguiProvider, View, getTokens, getVariableValue, styled } from 'tamagui'
import { config } from '../../tamagui.config'
import { useEffect, useMemo, useRef, useState, type ComponentType } from 'react'
import { Copy } from '../components/team-poster/primitives'
import { g6Theme, useVizTheme } from './theme'

/** A graph that could not be drawn: `stage` says where it failed. */
export class G6RenderError extends Schema.TaggedError<G6RenderError, { readonly brand: unique symbol }>()('G6RenderError', {
  stage: Schema.Literals(['webgl', 'render', 'fit']),
  message: Schema.String,
}) {}

// The G6 host (plan D6, section C-viz): mounts a graph for `{ nodes, edges }`, applies g6Theme, redraws on
// data or theme change, resizes with its container, and destroys the graph on unmount.

/** What a custom node component receives: the node's id and its `data`. */
export type G6NodeProps = { readonly id: string; readonly data: Readonly<Record<string, unknown>> }

/** The graph heights, as size tokens of the design contract. */
export type G6GraphHeight = 'hero' | 'drawer'

// Heights are size tokens, so the design lint can check them.
const Frame = styled(View, {
  w: '100%',
  variants: {
    size: {
      hero: { h: 'hero' },
      drawer: { h: 'drawer' },
    },
  } as const,
})

const pixels = (height: G6GraphHeight): number => Number(getVariableValue(getTokens().size[height]))

export type G6GraphProps = {
  readonly data: GraphData
  readonly layout: 'dagre' | 'force'
  /** Drawn for each node in place of the default circle. */
  readonly node?: ComponentType<G6NodeProps>
  readonly renderer?: 'canvas' | 'webgl'
  /** A `size` token of design/contract.json; the design rules accept no pixel count. */
  readonly height: G6GraphHeight
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

/** Adds and removes only the two states the host owns; any other state of an edge is kept. */
function applyHighlight(graph: Graph, edgeIds: ReadonlyArray<string>) {
  const marked = new Set(edgeIds)
  const states: Record<string, string[]> = {}
  for (const edge of graph.getEdgeData()) {
    const id = String(edge.id)
    const current = graph.getElementState(id)
    const own = marked.size === 0 ? [] : marked.has(id) ? [HIGHLIGHTED] : [DIMMED]
    const next = [...current.filter((state) => state !== HIGHLIGHTED && state !== DIMMED), ...own]
    if (next.length !== current.length || next.some((state, index) => state !== current[index])) states[id] = next
  }
  if (Object.keys(states).length > 0) void graph.setElementState(states, false)
}

function webglAvailable(): boolean {
  const probe = document.createElement('canvas')
  return probe.getContext('webgl2') !== null || probe.getContext('webgl') !== null
}

/** Longest wait for a render to settle before cleanup destroys the graph anyway (a WebGL renderer can stay pending). */
const SETTLE_MS = 1000

const REACT_NODE = 'react-node'
const REACT_NODE_SIZE: [number, number] = [180, 96]
const DEFAULT_NODE_SIZE: [number, number] = [28, 28]
/** Room kept around a node, for its label and a gap, when the force layout keeps nodes apart. */
const NODE_GAP = 24

function registerReactNode() {
  if (getExtension(ExtensionCategory.NODE, REACT_NODE) === undefined) register(ExtensionCategory.NODE, REACT_NODE, G6ReactNode)
}

export function G6Graph({ data, layout, node: NodeView, renderer = 'canvas', height, onEdgeHover, highlightedEdges }: G6GraphProps) {
  const vizTheme = useVizTheme()
  // useVizTheme builds a new object each render; key on the values the graph reads.
  const themeKey = [vizTheme.mode, vizTheme.background, vizTheme.surface, vizTheme.rule, vizTheme.color, vizTheme.muted, vizTheme.brand].join('|')
  // eslint-disable-next-line react-hooks/exhaustive-deps -- themeKey stands for vizTheme
  const theme = useMemo(() => vizTheme, [themeKey])
  const root = useRef<HTMLElement | null>(null)
  const [failure, setFailure] = useState<G6RenderError | null>(null)
  const heightPx = pixels(height)
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
    if (current) void current.drawn.then(() => { if (live.current === current) applyHighlight(current.graph, highlighted.current) })
  }, [highlightedEdges])

  useEffect(() => {
    const container = root.current
    if (!container) return
    setFailure(null)
    if (renderer === 'webgl' && !webglAvailable()) {
      setFailure(new G6RenderError({ stage: 'webgl', message: 'WebGL is not available in this browser.' }))
      return
    }
    if (NodeView) registerReactNode()
    const colours = g6Theme(theme)
    const nodeSize = NodeView ? REACT_NODE_SIZE : DEFAULT_NODE_SIZE
    // Force spacing follows the drawn node, so a card is kept clear of its neighbours as a dot is.
    const radius = Math.hypot(nodeSize[0], nodeSize[1]) / 2 + NODE_GAP
    const graph = new Graph({
      container,
      width: container.clientWidth,
      height: heightPx,
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
                size: REACT_NODE_SIZE,
                component: (datum: { id: string; data?: Record<string, unknown> }) => (
                  // G6 renders each node in its own React root, so it needs its own Tamagui provider.
                  // isSubtreeRoot keeps its theme class off <html>, which AppTheme owns.
                  <TamaguiProvider config={config} defaultTheme={theme.mode} disableInjectCSS isSubtreeRoot>
                    <NodeView id={datum.id} data={datum.data ?? {}} />
                  </TamaguiProvider>
                ),
              },
            }
          : {
              style: {
                ...colours.node.style,
                size: DEFAULT_NODE_SIZE[0],
                lineWidth: 1,
                labelText: (datum) => {
                  const name = datum.data?.name
                  return typeof name === 'string' ? name : String(datum.id)
                },
                labelFontFamily: theme.fonts.body,
              },
            }),
        state: {
          active: { stroke: theme.brand, lineWidth: 2 },
          inactive: { opacity: 0.35 },
        },
      },
      edge: {
        style: { ...colours.edge.style, lineWidth: 1, labelFontFamily: theme.fonts.body },
        state: {
          active: { stroke: theme.brand, lineWidth: 2 },
          inactive: { opacity: 0.2 },
          [HIGHLIGHTED]: { stroke: theme.brand, lineWidth: 3 },
          [DIMMED]: { opacity: 0.2 },
        },
      },
      layout: layout === 'dagre' ? { type: 'dagre', rankdir: 'LR', nodesep: 24, ranksep: 64 } : { type: 'd3-force', animation: false, link: { distance: Math.max(140, radius * 2) }, collide: { radius }, manyBody: { strength: -300 } },
      behaviors: ['drag-canvas', 'zoom-canvas', { type: 'hover-activate', degree: 1 }],
    })
    graph.on(EdgeEvent.POINTER_ENTER, (event: IElementEvent) => hoverCallback.current?.(String(event.target.id)))
    graph.on(EdgeEvent.POINTER_LEAVE, () => hoverCallback.current?.(null))
    const leave = () => hoverCallback.current?.(null)
    container.addEventListener('pointerleave', leave)
    let alive = true
    // A rejection from a graph that was disposed is expected; from a live graph it is a failure.
    const fail = (stage: 'render' | 'fit') => (cause: unknown) => {
      if (!alive) return undefined
      const error = new G6RenderError({ stage, message: cause instanceof Error ? cause.message : String(cause) })
      void Effect.runFork(Effect.logError('G6 graph failed', error))
      setFailure(error)
      return undefined
    }
    const drawn = graph
      .render()
      .then(
        async () => {
          if (!alive) return
          await graph.fitView({ when: 'always' }, false).catch(fail('fit'))
          // A small graph is fitted to the box, not blown up past its natural size.
          if (alive && graph.getZoom() > 1) await graph.zoomTo(1, false)
          if (alive) applyHighlight(graph, highlighted.current)
        },
        fail('render'),
      )
    live.current = { graph, drawn }
    const observer = new ResizeObserver(() => {
      if (alive) graph.setSize(container.clientWidth, heightPx)
    })
    observer.observe(container)
    return () => {
      alive = false
      live.current = null
      observer.disconnect()
      container.removeEventListener('pointerleave', leave)
      // Destroying mid-render logs a G6 error, so wait for the render; but never wait on one that stays pending.
      let timer = 0
      const timeout = new Promise<void>((resolve) => {
        timer = window.setTimeout(resolve, SETTLE_MS)
      })
      void Promise.race([drawn, timeout]).then(() => {
        window.clearTimeout(timer)
        graph.destroy()
      })
    }
  }, [data, layout, NodeView, renderer, heightPx, theme])

  return (
    <Frame ref={root as never} size={height}>
      {failure ? <Copy color="muted" role="alert">This graph could not be drawn: {failure.message}</Copy> : null}
    </Frame>
  )
}
