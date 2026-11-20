import type { G2Spec } from '@antv/g2'
import { useMemo } from 'react'
import { View, getTokens, getVariableValue, styled } from 'tamagui'

import { Copy } from '../components/team-poster/primitives'
import { useG2Chart } from '../use-g2-chart'
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
  const heightPx = pixels(height)
  const { host, failed } = useG2Chart(spec, g2, heightPx)

  // SAFETY: Tamagui types the ref for native views; on web the host is the HTMLElement the chart mounts into.
  return (
    <Frame ref={host as never} size={height}>
      {failed ? <Copy color="muted">This chart could not be drawn.</Copy> : null}
    </Frame>
  )
}
