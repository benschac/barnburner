import { useEffect, useMemo, useRef } from 'react'
import { getConfig, getVariableValue, useTheme, View } from 'tamagui'
import { margins, playoffMargins, venues } from './stats'

const plotWidth = 1058
const step = plotWidth / 84
const x = (i: number) => 6 + i * step
type ChartColors = Record<'win' | 'loss' | 'grid' | 'muted' | 'gold' | 'pending' | 'positive' | 'negative' | 'line', string>

type ChartKind = 'season' | 'playoff'

function drawChart(ctx: CanvasRenderingContext2D, kind: ChartKind, colors: ChartColors, font: string) {
  const height = kind === 'season' ? 255 : 126
  ctx.clearRect(0, 0, 1100, height)
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
    for (let i = 0; i < 84; i++) {
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
}

export function Chart({ kind }: { kind: ChartKind }) {
  const ref = useRef<HTMLCanvasElement>(null)
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
    document.fonts.ready.then(() => {
      if (cancelled || !ref.current) return
      const canvas = ref.current
      const ratio = Math.max(2, window.devicePixelRatio || 1)
      canvas.width = 1100 * ratio
      canvas.height = height * ratio
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      ctx.scale(ratio, ratio)
      drawChart(ctx, kind, colors, font)
    })
    return () => { cancelled = true }
  }, [kind, height, colors, font])
  return <View render="canvas" ref={(node) => { ref.current = node instanceof HTMLCanvasElement ? node : null }} w={1100} h={height} display="block" role="img" aria-label={kind === 'season'
    ? `Season goal margins for 17 of 84 games: ${margins.join(', ')}. 12 wins and 5 losses.`
    : 'Playoff position over 17 games, ending 5 points above the playoff line.'} />
}
