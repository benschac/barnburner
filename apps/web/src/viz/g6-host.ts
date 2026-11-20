import type { Graph } from '@antv/g6'
import { Schema } from 'effect'

/** A graph that could not be drawn: `stage` says where it failed. */
export class G6RenderError extends Schema.TaggedError<G6RenderError, { readonly brand: unique symbol }>()('G6RenderError', {
  stage: Schema.Literals(['webgl', 'render', 'fit']),
  message: Schema.String,
}) {}

/** The two element states the host owns. */
export const HIGHLIGHTED = 'highlighted'
export const DIMMED = 'dimmed'

/** Adds and removes only the two states the host owns; any other state of an edge is kept. */
export function applyHighlight(graph: Graph, edgeIds: ReadonlyArray<string>) {
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
