import { useEffect, useMemo, useRef, useState } from 'react'
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

function drawChart(ctx: CanvasRenderingContext2D, axis: CanvasRenderingContext2D, kind: ChartKind, colors: ChartColors, font: string, activeGame: number | null, data: TeamPosterData) {
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
    for (const [i, { result, venue }] of seasonGames.entries()) {
      const margin = result ? result.goalsFor - result.goalsAgainst : undefined
      ctx.fillStyle = margin === undefined ? colors.pending : margin > 0 ? colors.win : result?.decision === 'REG' ? colors.loss : colors.gold
      const barHeight = margin === undefined ? 6 : Math.abs(margin) * unit
      ctx.fillRect(x(i) - 4.3, margin === undefined ? zero - 3 : margin > 0 ? zero - barHeight : zero, 8.6, barHeight)
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
    const first = playoffPoints[0]
    const last = playoffPoints.at(-1)
    if (!first || !last) return
    for (const positive of [false, true]) {
      ctx.save()
      ctx.beginPath()
      ctx.rect(0, positive ? 0 : zero, plotWidth, positive ? zero : height - zero)
      ctx.clip()
      ctx.beginPath()
      ctx.moveTo(x(first.index), zero)
      playoffPoints.forEach(({ index, playoffMargin }) => ctx.lineTo(x(index), zero - playoffMargin * unit))
      ctx.lineTo(x(last.index), zero)
      ctx.closePath()
      ctx.fillStyle = positive ? colors.positive : colors.negative
      ctx.fill()
      ctx.restore()
    }
    ctx.beginPath()
    ctx.moveTo(x(first.index), zero - first.playoffMargin * unit)
    playoffPoints.slice(1).forEach(({ index, playoffMargin }) => ctx.lineTo(x(index), zero - playoffMargin * unit))
    ctx.lineWidth = 3
    ctx.lineJoin = 'round'
    ctx.strokeStyle = colors.line
    ctx.stroke()
    ctx.beginPath()
    ctx.arc(x(last.index), zero - last.playoffMargin * unit, 6.5, 0, Math.PI * 2)
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
  useEffect(() => {
    let cancelled = false
    let context: CanvasRenderingContext2D | null = null
    let axis: CanvasRenderingContext2D | null = null
    const clearHighlight = () => {
      if (context && axis && activeGame !== null) drawChart(context, axis, kind, colors, font, null, data)
    }
    const restoreHighlight = () => {
      if (context && axis && activeGame !== null) drawChart(context, axis, kind, colors, font, activeGame, data)
    }
    fontsReady.then(() => {
      if (cancelled || !ref.current || !axisRef.current) return
      const ratio = Math.max(2, window.devicePixelRatio || 1)
      context = scaleCanvas(ref.current, plotWidth, height, ratio)
      axis = scaleCanvas(axisRef.current, axisWidth, height, ratio)
      if (context && axis) drawChart(context, axis, kind, colors, font, activeGame, data)
    })
    window.addEventListener('beforeprint', clearHighlight)
    window.addEventListener('afterprint', restoreHighlight)
    return () => {
      cancelled = true
      window.removeEventListener('beforeprint', clearHighlight)
      window.removeEventListener('afterprint', restoreHighlight)
    }
  }, [kind, height, colors, font, activeGame, data])

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
