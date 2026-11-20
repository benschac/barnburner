import { Chart } from '@antv/g2'
import type { G2Spec } from '@antv/g2'
import { Predicate } from 'effect'
import { useEffect, useMemo, useRef, useState } from 'react'
import { View, getTokens, getVariableValue, styled } from 'tamagui'

import { Copy } from '../components/team-poster/primitives'
import { logFailure } from '../use-log-failure'
import { cssVariables, g2Theme, useVizTheme } from './theme'

/** The chart heights, as size tokens of the design contract. */
export type G2ChartHeight = 'hero' | 'seasonChart' | 'playoffChart'

export type G2ChartProps = {
  spec: G2Spec
  height: G2ChartHeight
}

// Heights are size tokens, so the design lint can check them.
const Frame = styled(View, {
  w: '100%',
  variants: {
    size: {
      hero: { h: 'hero' },
      seasonChart: { h: 'seasonChart' },
      playoffChart: { h: 'playoffChart' },
    },
  } as const,
})

const pixels = (height: G2ChartHeight): number => Number(getVariableValue(getTokens().size[height]))

/** A G2 spec is a tree of plain objects, arrays, primitives and callbacks. */
type SpecValue = SpecRecord | ReadonlyArray<SpecValue> | string | number | boolean | null | undefined | ((...args: never[]) => unknown)
interface SpecRecord {
  readonly [key: string]: SpecValue
}

const isNode = (value: SpecValue): value is SpecRecord => Predicate.isObject(value) && !Array.isArray(value)
const isPlainRecord = (value: SpecValue): value is SpecRecord => isNode(value) && Object.getPrototypeOf(value) === Object.prototype

// G2 merges options into the chart and mutates nested objects, so every draw gets its own copy.
function cloneSpec(value: SpecValue): SpecValue {
  if (Array.isArray(value)) return value.map(cloneSpec)
  if (isPlainRecord(value)) return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, cloneSpec(item)]))
  return value
}

// G2 resolves `theme` per view and a child view that has none falls back to the built-in light theme, so a facet's
// axes would be light-theme text (black at 0.45 opacity) on a dark chart. Give every child the theme.
function withTheme(node: SpecValue, theme: SpecRecord): SpecValue {
  if (!isNode(node)) return node
  const children = node.children
  if (!Array.isArray(children)) return node
  const themedChildren = children.map((child: SpecValue) => {
    const themed = withTheme(child, theme)
    if (!isNode(themed) || Object.hasOwn(themed, 'theme')) return themed
    return { ...themed, theme }
  })
  return { ...node, children: themedChildren }
}

/** The spec as G2 takes it: a copy with the theme on every child view. */
function themedSpec(spec: G2Spec, theme: SpecRecord): G2Spec {
  // SAFETY: a G2Spec is built from plain objects, arrays, primitives and callbacks, which is the shape SpecValue describes; both casts only change the view of the same value.
  const tree = cloneSpec(spec as unknown as SpecValue)
  // SAFETY: withTheme returns the tree it was given with the theme added to child views, so the result is still a G2Spec.
  return withTheme(tree, theme) as unknown as G2Spec
}

/**
 * Hosts one G2 chart. Each spec or theme change builds a fresh chart, so nothing of the previous spec
 * survives. The host owns the size: the measured width and the height token are applied after the spec.
 * It follows the container's width, destroys the chart on unmount, and shows a message if a render fails.
 */
export function G2Chart({ spec, height }: G2ChartProps) {
  const theme = useVizTheme()
  // useVizTheme returns a new object every render; redraw only when a value changes.
  const themeKey = Object.values(cssVariables(theme)).join('|') + theme.mode
  // eslint-disable-next-line react-hooks/exhaustive-deps -- themeKey stands for every value of theme
  const g2 = useMemo(() => g2Theme(theme), [themeKey])
  const host = useRef<HTMLElement | null>(null)
  const [failed, setFailed] = useState(false)
  const heightPx = pixels(height)

  useEffect(() => {
    const node = host.current
    if (!node) return
    let disposed = false
    // A rejection from a chart that was disposed is expected; from a live chart it is a failure.
    const onFailure = (cause: unknown) => {
      if (disposed) return
      logFailure('G2 chart failed', cause)
      setFailed(true)
    }
    setFailed(false)
    const instance = new Chart({ container: node, width: node.clientWidth, height: heightPx })
    instance.options({ ...themedSpec(spec, g2), theme: g2, autoFit: false, width: node.clientWidth, height: heightPx })
    instance.render().catch(onFailure)
    const observer = new ResizeObserver(() => {
      if (disposed || node.clientWidth === 0) return
      instance.changeSize(node.clientWidth, heightPx).catch(onFailure)
    })
    observer.observe(node)
    return () => {
      disposed = true
      observer.disconnect()
      instance.destroy()
    }
  }, [spec, g2, heightPx])

  // SAFETY: Tamagui types the ref for native views; on web the host is the HTMLElement the chart mounts into.
  return (
    <Frame ref={host as never} size={height}>
      {failed ? <Copy color="muted">This chart could not be drawn.</Copy> : null}
    </Frame>
  )
}
