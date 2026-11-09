import { useEffect, useMemo, useRef, useState } from 'react'
import type { KeyboardEvent, MouseEvent } from 'react'
import { getConfig, getVariableValue, Text, useTheme, View } from 'tamagui'
import { fontsReady } from './fonts'
import { margins, playoffMargins, venues } from './stats'

const plotWidth = 1058
const chartWidth = 1100
const seasonGames = 84
const step = plotWidth / seasonGames
const x = (i: number) => 6 + i * step
type ChartColors = Record<'win' | 'loss' | 'grid' | 'muted' | 'gold' | 'pending' | 'positive' | 'negative' | 'line', string>

type ChartKind = 'season' | 'playoff'

function drawChart(ctx: CanvasRenderingContext2D, kind: ChartKind, colors: ChartColors, font: string, activeGame: number | null) {
  const height = kind === 'season' ? 255 : 126
  ctx.clearRect(0, 0, chartWidth, height)
  ctx.font = `16px ${font}`
  ctx.textBaseline = 'middle'
  const zero = kind === 'season' ? 102 : 64
  const unit = kind === 'season' ? 20 : 5.6
  const ticks = kind === 'season' ? [3, 2, 1, -1, -2, -3] : [10, 5, 0, -5, -10]
  for (const tick of ticks) {
    const y = zero - tick * unit
    ctx.beginPath()
    ctx.setLineDash(tick === 0 ? [7, 6] : [2, 6])
    ctx.strokeStyle = tick === 0 ? colors.gold : colors.grid
    ctx.lineWidth = tick === 0 ? 2 : 1.5
    ctx.moveTo(0, y)
    ctx.lineTo(plotWidth, y)
    ctx.stroke()
    ctx.fillStyle = tick === 0 ? colors.gold : colors.muted
    ctx.font = `14px ${font}`
    ctx.fillText(tick > 0 ? `+${tick}` : `${tick}`.replace('-', '−'), plotWidth + 8, y)
  }
  ctx.setLineDash([])
  if (kind === 'season') {
    ctx.fillStyle = colors.grid
    ctx.fillRect(0, zero - 1, plotWidth, 2)
    for (let i = 0; i < seasonGames; i++) {
      const margin = margins[i]
      ctx.fillStyle = margin === undefined ? colors.pending : margin > 0 ? colors.win : colors.loss
      const barHeight = margin === undefined ? 6 : Math.abs(margin) * unit
      ctx.fillRect(x(i) - 4.3, margin === undefined ? zero - 3 : margin > 0 ? zero - barHeight : zero, 8.6, barHeight)
      ctx.beginPath()
      ctx.arc(x(i), 216, 3, 0, Math.PI * 2)
      ctx.fillStyle = colors.muted
      ctx.strokeStyle = colors.muted
      ctx.lineWidth = 1.3
      if (venues[i] === 'H') ctx.fill()
      else ctx.stroke()
    }
    ctx.font = `17px ${font}`
    ctx.fillStyle = colors.muted
    for (const [label, position] of [['Oct', 0], ['Nov', 178], ['Dec', 340], ['Jan', 518], ['Feb', 717], ['Mar', 830], ['Apr', 996]] as const) {
      ctx.fillText(label, position, 240)
    }
  } else {
    for (const positive of [false, true]) {
      ctx.save()
      ctx.beginPath()
      ctx.rect(0, positive ? 0 : zero, plotWidth, positive ? zero : height - zero)
      ctx.clip()
      ctx.beginPath()
      ctx.moveTo(x(0), zero)
      playoffMargins.forEach((value, i) => ctx.lineTo(x(i), zero - value * unit))
      ctx.lineTo(x(playoffMargins.length - 1), zero)
      ctx.closePath()
      ctx.fillStyle = positive ? colors.positive : colors.negative
      ctx.fill()
      ctx.restore()
    }
    ctx.beginPath()
    playoffMargins.forEach((value, i) => {
      if (i === 0) ctx.moveTo(x(i), zero - value * unit)
      else ctx.lineTo(x(i), zero - value * unit)
    })
    ctx.lineWidth = 3
    ctx.lineJoin = 'round'
    ctx.strokeStyle = colors.line
    ctx.stroke()
    ctx.beginPath()
    ctx.arc(x(16), zero - 5 * unit, 6.5, 0, Math.PI * 2)
    ctx.fillStyle = colors.line
    ctx.fill()
  }
  if (activeGame !== null) {
    const position = x(activeGame)
    ctx.beginPath()
    ctx.setLineDash([3, 4])
    ctx.strokeStyle = colors.gold
    ctx.lineWidth = 1.5
    ctx.moveTo(position, 0)
    ctx.lineTo(position, kind === 'season' ? 208 : height)
    ctx.stroke()
    ctx.setLineDash([])
    const value = playoffMargins[activeGame]
    if (kind === 'playoff' && value !== undefined) {
      ctx.beginPath()
      ctx.arc(position, zero - value * unit, 4, 0, Math.PI * 2)
      ctx.fillStyle = colors.gold
      ctx.fill()
    }
  }
}

export function Chart({ kind, activeGame, onActiveGameChange }: {
  kind: ChartKind
  activeGame: number | null
  onActiveGameChange: (game: number | null) => void
}) {
  const ref = useRef<HTMLCanvasElement>(null)
  const regionRef = useRef<HTMLElement>(null)
  const [isFocused, setIsFocused] = useState(false)
  const theme = useTheme()
  const win = String(theme['chart-win'].val)
  const loss = String(theme['chart-loss'].val)
  const grid = String(theme.rule.val)
  const muted = String(theme.muted.val)
  const gold = String(theme.gold.val)
  const pending = String(theme.pending.val)
  const positive = String(theme['chart-positive'].val)
  const negative = String(theme['chart-negative'].val)
  const line = String(theme['chart-line'].val)
  const colors = useMemo(() => ({ win, loss, grid, muted, gold, pending, positive, negative, line }),
    [win, loss, grid, muted, gold, pending, positive, negative, line])
  const font = String(getVariableValue(getConfig().fonts.body.family))
  const height = kind === 'season' ? 255 : 126
  useEffect(() => {
    let cancelled = false
    let context: CanvasRenderingContext2D | null = null
    const clearHighlight = () => {
      if (context && activeGame !== null) drawChart(context, kind, colors, font, null)
    }
    const restoreHighlight = () => {
      if (context && activeGame !== null) drawChart(context, kind, colors, font, activeGame)
    }
    fontsReady.then(() => {
      if (cancelled || !ref.current) return
      const canvas = ref.current
      const ratio = Math.max(2, window.devicePixelRatio || 1)
      const width = Math.round(chartWidth * ratio)
      const pixelHeight = Math.round(height * ratio)
      if (canvas.width !== width) canvas.width = width
      if (canvas.height !== pixelHeight) canvas.height = pixelHeight
      context = canvas.getContext('2d')
      if (!context) return
      context.setTransform(width / chartWidth, 0, 0, pixelHeight / height, 0, 0)
      drawChart(context, kind, colors, font, activeGame)
    })
    window.addEventListener('beforeprint', clearHighlight)
    window.addEventListener('afterprint', restoreHighlight)
    return () => {
      cancelled = true
      window.removeEventListener('beforeprint', clearHighlight)
      window.removeEventListener('afterprint', restoreHighlight)
    }
  }, [kind, height, colors, font, activeGame])

  useEffect(() => {
    const canvas = ref.current
    const region = regionRef.current
    if (activeGame === null || !canvas || !region) return
    const position = x(activeGame) * canvas.offsetWidth / chartWidth
    if (position < region.scrollLeft || position >= region.scrollLeft + region.clientWidth) {
      region.scrollLeft = position - region.clientWidth / 2
    }
  }, [activeGame])

  function inspectGame(event: MouseEvent) {
    const bounds = ref.current?.getBoundingClientRect()
    if (!bounds?.width) return
    const position = (event.clientX - bounds.left) * chartWidth / bounds.width
    const game = Math.round((position - x(0)) / step)
    onActiveGameChange(position >= 0 && position < plotWidth && game >= 0 && game < seasonGames ? game : null)
  }

  function navigateGames(event: KeyboardEvent) {
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return
    if (event.key === 'Escape') {
      onActiveGameChange(null)
      return
    }
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
    const offset = event.key === 'ArrowRight' ? 1 : -1
    const nextGame = activeGame === null
      ? (offset > 0 ? 0 : seasonGames - 1)
      : Math.max(0, Math.min(seasonGames - 1, activeGame + offset))
    if (nextGame === activeGame) return
    event.preventDefault()
    onActiveGameChange(nextGame)
  }

  let detail = 'Hover or tap a game, or use the left and right arrow keys.'
  if (activeGame !== null) {
    if (kind === 'season') {
      const margin = margins[activeGame]
      const venue = venues[activeGame] === 'H' ? 'Home' : 'Away'
      const result = margin === undefined ? 'Still to play' : `${margin > 0 ? '+' : ''}${margin} goal margin`
      detail = `Game ${activeGame + 1} · ${venue} · ${result}`
    } else {
      const margin = playoffMargins[activeGame]
      const position = margin === undefined
        ? 'No playoff data yet'
        : margin === 0 ? 'On the playoff line' : `${Math.abs(margin)} ${Math.abs(margin) === 1 ? 'point' : 'points'} ${margin > 0 ? 'above' : 'below'} the playoff line`
      detail = `Game ${activeGame + 1} · ${position}`
    }
  }

  return (
    <View>
      <View ref={(node) => { regionRef.current = node instanceof HTMLElement ? node : null }}
        overflow="auto print:visible" w="100%" tabIndex={0} role="region"
        aria-label={kind === 'season' ? 'Season chart. Use arrow keys to inspect games.' : 'Playoff chart. Use arrow keys to inspect games.'}
        onKeyDown={navigateGames} onFocus={() => setIsFocused(true)}
        onBlur={() => {
          setIsFocused(false)
          onActiveGameChange(null)
        }}
      >
        <View render="canvas" ref={(node) => { ref.current = node instanceof HTMLCanvasElement ? node : null }}
          w="chart" h={kind === 'season' ? 'seasonChart' : 'playoffChart'} display="block" role="img"
          onMouseMove={inspectGame} onMouseLeave={() => onActiveGameChange(null)} onClick={inspectGame}
          aria-label={kind === 'season'
            ? `Season goal margins for 17 of 84 games: ${margins.join(', ')}. 12 wins and 5 losses.`
            : 'Playoff position over 17 games, ending 5 points above the playoff line.'}
        />
      </View>
      <Text display="print:none" fontFamily="body" fontSize="caption" lineHeight="caption" color="muted" aria-live={isFocused ? 'polite' : 'off'}>
        {detail}
      </Text>
    </View>
  )
}
