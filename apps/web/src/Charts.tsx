import { useEffect, useEffectEvent, useMemo, useRef, useState } from 'react'
import type { KeyboardEvent, MouseEvent } from 'react'
import { getConfig, getVariableValue, Text, useTheme, View } from 'tamagui'
import contract from '../design/contract.json'
import { fontsReady } from './fonts'
import { describePlayoffComparison, gameDateTime, playoffGap } from './stats'
import type { TeamPosterData } from './stats'

const { chartPlot: plotWidth, chartAxis: axisWidth } = contract.size
const monthName = new Intl.DateTimeFormat('en-US', { month: 'short', timeZone: 'UTC' })
type ChartColors = Record<'win' | 'loss' | 'grid' | 'muted' | 'gold' | 'pending' | 'positive' | 'negative' | 'line', string>

type ChartKind = 'season' | 'playoff'

type ChartPoint = { x: number; y: number }
type ChartBar = { x: number; yStart: number; yEnd: number; opacity: number; ink: keyof ChartColors }
type ChartGeometry = { bars: ChartBar[]; line: ChartPoint[]; opacity: number }

function chartGeometry(data: TeamPosterData, kind: ChartKind): ChartGeometry {
  const step = plotWidth / Math.max(1, data.seasonGames.length)
  const margins = data.seasonGames.map(({ result }) => result ? result.goalsFor - result.goalsAgainst : null)
  const gaps = data.seasonGames.flatMap(({ result }, index) => result?.comparison ? [{ index, cushion: playoffGap(result.comparison) }] : [])
  const extent = kind === 'season' ? Math.max(6, ...margins.map(value => Math.abs(value ?? 0))) : Math.max(10, ...gaps.map(({ cushion }) => Math.abs(cushion)))
  const unit = (kind === 'season' ? 96 : 56) / extent
  return {
    bars: kind === 'season' ? data.seasonGames.map(({ result }, index) => {
      const margin = margins[index]
      return {
        x: 6 + index * step,
        yStart: margin === null ? 102 : 105 - Math.max(0, margin) * unit,
        yEnd: margin === null ? 108 : 105 - Math.min(0, margin) * unit,
        opacity: 1,
        ink: margin === null ? 'pending' : margin > 0 ? 'win' : result?.decision === 'REG' ? 'loss' : 'gold',
      }
    }) : [],
    line: kind === 'playoff' ? gaps.map(({ index, cushion }) => ({ x: 6 + index * step, y: 64 - cushion * unit })) : [],
    opacity: gaps.length ? 1 : 0,
  }
}

function interpolateGeometry(from: ChartGeometry, to: ChartGeometry, progress: number): ChartGeometry {
  const mix = (a: number, b: number) => a + (b - a) * progress
  const bars = Array.from({ length: Math.max(from.bars.length, to.bars.length) }, (_, index) => {
    const previous = from.bars[index]
    const next = to.bars[index]
    const anchor = next ?? previous
    const start = previous ?? { x: anchor.x, ink: anchor.ink, yStart: 105, yEnd: 105, opacity: 0 }
    const end = next ?? { x: anchor.x, ink: anchor.ink, yStart: 105, yEnd: 105, opacity: 0 }
    return { x: mix(start.x, end.x), yStart: mix(start.yStart, end.yStart), yEnd: mix(start.yEnd, end.yEnd), opacity: mix(start.opacity, end.opacity), ink: anchor.ink }
  })
  const line = Array.from({ length: Math.max(from.line.length, to.line.length) }, (_, index) => {
    const start = from.line[index] ?? from.line.at(-1) ?? { x: to.line[index].x, y: 64 }
    const end = to.line[index] ?? to.line.at(-1) ?? { x: start.x, y: 64 }
    return { x: mix(start.x, end.x), y: mix(start.y, end.y) }
  })
  return { bars, line, opacity: mix(from.opacity, to.opacity) }
}

function chartEase(progress: number) {
  // Invert cubic-bezier(0.77, 0, 0.175, 1) for on-screen morphing.
  let low = 0
  let high = 1
  for (let i = 0; i < 16; i++) {
    const t = (low + high) / 2
    const x = 3 * (1 - t) ** 2 * t * 0.77 + 3 * (1 - t) * t ** 2 * 0.175 + t ** 3
    if (x < progress) low = t
    else high = t
  }
  const t = (low + high) / 2
  return 3 * (1 - t) * t ** 2 + t ** 3
}

function drawChart(ctx: CanvasRenderingContext2D, axis: CanvasRenderingContext2D, kind: ChartKind, colors: ChartColors, font: string, activeGame: number | null, data: TeamPosterData, geometry: ChartGeometry) {
  const { seasonGames } = data
  const step = plotWidth / Math.max(1, seasonGames.length)
  const x = (i: number) => 6 + i * step
  const playoffPoints = seasonGames.flatMap(({ result }, index) => result?.comparison ? [{ index, playoffMargin: playoffGap(result.comparison) }] : [])
  const height = kind === 'season' ? contract.size.seasonChart : contract.size.playoffChart
  ctx.clearRect(0, 0, plotWidth, height)
  axis.clearRect(0, 0, axisWidth, height)
  ctx.textBaseline = 'middle'
  axis.textBaseline = 'middle'
  axis.font = `14px ${font}`
  const zero = kind === 'season' ? 105 : 64
  const extent = kind === 'season'
    ? Math.max(6, ...seasonGames.map(({ result }) => result ? Math.abs(result.goalsFor - result.goalsAgainst) : 0))
    : Math.max(10, ...playoffPoints.map(({ playoffMargin }) => Math.abs(playoffMargin)))
  const unit = (kind === 'season' ? 96 : 56) / extent
  const ticks = kind === 'season'
    ? [extent, Math.ceil(extent * 2 / 3), Math.ceil(extent / 3), -Math.ceil(extent / 3), -Math.ceil(extent * 2 / 3), -extent]
    : [extent, Math.ceil(extent / 2), 0, -Math.ceil(extent / 2), -extent]
  for (const tick of ticks) {
    const y = zero - tick * unit
    ctx.beginPath()
    ctx.setLineDash(tick === 0 ? [7, 6] : [2, 6])
    ctx.strokeStyle = tick === 0 ? colors.gold : colors.grid
    ctx.lineWidth = tick === 0 ? 2 : 1.5
    ctx.moveTo(0, y)
    ctx.lineTo(plotWidth, y)
    ctx.stroke()
    axis.fillStyle = tick === 0 ? colors.gold : colors.muted
    axis.fillText(tick > 0 ? `+${tick}` : `${tick}`.replace('-', '−'), 8, y)
  }
  ctx.setLineDash([])
  if (kind === 'season') {
    ctx.fillStyle = colors.grid
    ctx.fillRect(0, zero - 1, plotWidth, 2)
    for (const bar of geometry.bars) {
      ctx.globalAlpha = bar.opacity
      ctx.fillStyle = colors[bar.ink]
      ctx.fillRect(bar.x - 4.3, bar.yStart, 8.6, bar.yEnd - bar.yStart)
    }
    ctx.globalAlpha = 1
    for (const [i, { venue }] of seasonGames.entries()) {
      ctx.beginPath()
      ctx.arc(x(i), 216, 3, 0, Math.PI * 2)
      ctx.fillStyle = colors.muted
      ctx.strokeStyle = colors.muted
      ctx.lineWidth = 1.3
      if (venue === 'home') ctx.fill()
      else ctx.stroke()
    }
    ctx.font = `17px ${font}`
    ctx.fillStyle = colors.muted
    let labelEnd = 0
    seasonGames.forEach(({ date }, index) => {
      if (date.slice(0, 7) !== seasonGames[index - 1]?.date.slice(0, 7)) {
        const label = monthName.format(new Date(date))
        const position = Math.max(x(index) - 6, labelEnd)
        ctx.fillText(label, position, 240)
        labelEnd = position + ctx.measureText(label).width + 8
      }
    })
  } else {
    const first = geometry.line[0]
    const last = geometry.line.at(-1)
    if (first && last) {
      ctx.globalAlpha = geometry.opacity
      for (const positive of [false, true]) {
        ctx.save()
        ctx.beginPath()
        ctx.rect(0, positive ? 0 : zero, plotWidth, positive ? zero : height - zero)
        ctx.clip()
        ctx.beginPath()
        ctx.moveTo(first.x, zero)
        geometry.line.forEach(({ x, y }) => ctx.lineTo(x, y))
        ctx.lineTo(last.x, zero)
        ctx.closePath()
        ctx.fillStyle = positive ? colors.positive : colors.negative
        ctx.fill()
        ctx.restore()
      }
      ctx.beginPath()
      ctx.moveTo(first.x, first.y)
      geometry.line.slice(1).forEach(({ x, y }) => ctx.lineTo(x, y))
      ctx.lineWidth = 3
      ctx.lineJoin = 'round'
      ctx.strokeStyle = colors.line
      ctx.stroke()
      ctx.beginPath()
      ctx.arc(last.x, last.y, 6.5, 0, Math.PI * 2)
      ctx.fillStyle = colors.line
      ctx.fill()
      ctx.globalAlpha = 1
    }
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
    const comparison = seasonGames[activeGame]?.result?.comparison
    if (kind === 'playoff' && comparison) {
      ctx.beginPath()
      ctx.arc(position, zero - playoffGap(comparison) * unit, 4, 0, Math.PI * 2)
      ctx.fillStyle = colors.gold
      ctx.fill()
    }
  }
}

function scaleCanvas(canvas: HTMLCanvasElement, width: number, height: number, ratio: number) {
  const pixelWidth = Math.round(width * ratio)
  const pixelHeight = Math.round(height * ratio)
  if (canvas.width !== pixelWidth) canvas.width = pixelWidth
  if (canvas.height !== pixelHeight) canvas.height = pixelHeight
  const context = canvas.getContext('2d')
  context?.setTransform(pixelWidth / width, 0, 0, pixelHeight / height, 0, 0)
  return context
}

export function Chart({ data, kind, activeGame, onActiveGameChange }: {
  data: TeamPosterData
  kind: ChartKind
  activeGame: number | null
  onActiveGameChange: (game: number | null) => void
}) {
  const { seasonGames, completedGames, seasonSummary, latestPlayoffCushion } = data
  const step = plotWidth / Math.max(1, seasonGames.length)
  const x = (i: number) => 6 + i * step
  const playoffPoints = seasonGames.flatMap(({ result }, index) => result?.comparison ? [{ index, playoffMargin: playoffGap(result.comparison) }] : [])
  const ref = useRef<HTMLCanvasElement>(null)
  const axisRef = useRef<HTMLCanvasElement>(null)
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
  const heightToken = kind === 'season' ? 'seasonChart' : 'playoffChart'
  const height = contract.size[heightToken]
  const geometry = useMemo(() => chartGeometry(data, kind), [data, kind])
  const displayed = useRef<ChartGeometry | null>(null)
  const redraw = useRef<(() => void) | null>(null)
  const currentHighlight = useEffectEvent(() => activeGame)
  useEffect(() => {
    let cancelled = false
    let frame = 0
    let printing = false
    let context: CanvasRenderingContext2D | null = null
    let axis: CanvasRenderingContext2D | null = null
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
    const paint = () => {
      if (context && axis) drawChart(context, axis, kind, colors, font, printing ? null : currentHighlight(), data, displayed.current ?? geometry)
    }
    const finish = () => {
      cancelAnimationFrame(frame)
      displayed.current = geometry
      paint()
    }
    const beforePrint = () => { printing = true; finish() }
    const afterPrint = () => { printing = false; paint() }
    const motionChanged = () => { if (reducedMotion.matches) finish() }
    redraw.current = paint
    fontsReady.then(() => {
      if (cancelled || !ref.current || !axisRef.current) return
      const ratio = Math.max(2, window.devicePixelRatio || 1)
      context = scaleCanvas(ref.current, plotWidth, height, ratio)
      axis = scaleCanvas(axisRef.current, axisWidth, height, ratio)
      const from = displayed.current
      if (!from || reducedMotion.matches || printing) { finish(); return }
      const started = performance.now()
      const animate = (now: number) => {
        const progress = Math.min(1, (now - started) / 220)
        displayed.current = progress === 1 ? geometry : interpolateGeometry(from, geometry, chartEase(progress))
        paint()
        if (progress < 1) frame = requestAnimationFrame(animate)
      }
      frame = requestAnimationFrame(animate)
    })
    window.addEventListener('beforeprint', beforePrint)
    window.addEventListener('afterprint', afterPrint)
    reducedMotion.addEventListener('change', motionChanged)
    return () => {
      cancelled = true
      cancelAnimationFrame(frame)
      redraw.current = null
      window.removeEventListener('beforeprint', beforePrint)
      window.removeEventListener('afterprint', afterPrint)
      reducedMotion.removeEventListener('change', motionChanged)
    }
  }, [kind, height, colors, font, data, geometry])

  useEffect(() => { redraw.current?.() }, [activeGame])

  useEffect(() => {
    const canvas = ref.current
    const region = regionRef.current
    if (activeGame === null || !canvas || !region) return
    const position = (6 + activeGame * step) * canvas.offsetWidth / plotWidth
    if (position + step / 2 < region.scrollLeft || position - step / 2 >= region.scrollLeft + region.clientWidth) {
      region.scrollLeft = position - region.clientWidth / 2
    }
  }, [activeGame, step])

  function inspectGame(event: MouseEvent) {
    const bounds = ref.current?.getBoundingClientRect()
    if (!bounds?.width) return
    const position = (event.clientX - bounds.left) * plotWidth / bounds.width
    const game = Math.round((position - x(0)) / step)
    onActiveGameChange(position >= 0 && position < plotWidth && game >= 0 && game < seasonGames.length ? game : null)
  }

  function navigateGames(event: KeyboardEvent) {
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || seasonGames.length === 0) return
    if (event.key === 'Escape') {
      onActiveGameChange(null)
      return
    }
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
    const offset = event.key === 'ArrowRight' ? 1 : -1
    const nextGame = activeGame === null
      ? (offset > 0 ? 0 : seasonGames.length - 1)
      : Math.max(0, Math.min(seasonGames.length - 1, activeGame + offset))
    if (nextGame === activeGame) return
    event.preventDefault()
    onActiveGameChange(nextGame)
  }

  let detail: string | undefined
  const game = activeGame === null ? undefined : seasonGames[activeGame]
  if (activeGame !== null && game) {
    const time = `Game ${activeGame + 1} · ${gameDateTime(game)}`
    if (kind === 'season') {
      const result = game.result
      const margin = result ? result.goalsFor - result.goalsAgainst : undefined
      const score = result && margin !== undefined
        ? `${result.goalsFor}–${result.goalsAgainst}${result.decision === 'REG' ? '' : ` ${result.decision}`} (${margin > 0 ? '+' : ''}${margin})`
        : 'Still to play'
      detail = `${time} · ${game.venue === 'home' ? 'vs' : '@'} ${game.team} · ${score}`
    } else {
      const comparison = game.result?.comparison
      detail = `${time} · ${comparison ? describePlayoffComparison(comparison).equation : 'No playoff data yet'}`
    }
  }

  return (
    <View>
      <View flexDirection="row" items="flex-start" w="100%" maxW="chart">
        <View ref={(node) => { regionRef.current = node instanceof HTMLElement ? node : null }}
          overflow="auto print:visible" flex={1} minW="0" tabIndex={0} role="region"
          aria-label={kind === 'season' ? 'Season chart. Use arrow keys to inspect games.' : 'Playoff cushion chart. Use arrow keys to inspect games.'}
          onKeyDown={navigateGames} onFocus={() => setIsFocused(true)}
          onBlur={() => {
            setIsFocused(false)
            onActiveGameChange(null)
          }}
        >
          <View render="canvas" ref={(node) => { ref.current = node instanceof HTMLCanvasElement ? node : null }}
            w="chartPlot" h={heightToken} display="block" role="img"
            onMouseMove={inspectGame} onMouseLeave={() => { if (!isFocused) onActiveGameChange(null) }} onClick={inspectGame}
            aria-label={kind === 'season'
              ? `Season goal margins for ${completedGames.length} of ${seasonGames.length} games. Record: ${seasonSummary.record}.`
              : `Playoff cushion over ${playoffPoints.length} games. ${latestPlayoffCushion?.equation ?? 'No playoff data yet'}.`}
          />
        </View>
        <View render="canvas" ref={(node) => { axisRef.current = node instanceof HTMLCanvasElement ? node : null }}
          w="chartAxis" h={heightToken} display="block" shrink={0} aria-hidden
        />
      </View>
      <Text h="16 poster:6" overflow="hidden" display="print:none" fontFamily="body" fontSize="caption" lineHeight="caption" color="muted" aria-live={isFocused ? 'polite' : 'off'}>
        {detail ?? (
          <>
            <Text display="inline poster:none">Scroll sideways if needed. </Text>
            Select a game or use the arrow keys.
          </>
        )}
      </Text>
    </View>
  )
}
