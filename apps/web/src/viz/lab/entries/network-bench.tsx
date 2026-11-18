import { useRef, useState } from 'react'
import { View } from 'tamagui'
import type { TamaguiElement } from 'tamagui'
import type { ChangeEvent, ReactNode } from 'react'
import { Effect, Result, Schema } from 'effect'
import { benchDataFromTables, decodeBenchText } from '../../bench/stats.ts'
import { samples } from '@nhl-reddit-stats/viz/samples'
import type { BenchData, BenchRenderer, LabEntry } from '@nhl-reddit-stats/viz'
import { runBench } from '../../bench/harness.ts'
import type { BenchResult } from '../../bench/harness.ts'
import { useVizTheme } from '../../theme.ts'

type RendererContext = { keys(): string[]; (key: string): { default: BenchRenderer } }
type WebpackRequire = { context(directory: string, recursive: boolean, filter: RegExp): RendererContext }

// Webpack bundles every file in the folder, so adding a renderer file is enough.
declare const require: WebpackRequire
const context = require.context('../../bench/renderers', false, /\.ts$/)
const renderers = context.keys().map((key) => context(key).default)

const toPrettyJson = Schema.encodeSync(Schema.fromJsonString(Schema.Unknown, { space: 2 }))

const egoData: BenchData = benchDataFromTables(samples.ego.tables)
const leagueData: BenchData = benchDataFromTables(samples.league.tables)

type Source = 'ego' | 'league' | 'file'

function BenchPage() {
  const theme = useVizTheme()
  const root = useRef<TamaguiElement>(null)
  const [renderer, setRenderer] = useState(renderers[0]?.name ?? '')
  const [source, setSource] = useState<Source>('league')
  const [loaded, setLoaded] = useState<BenchData | undefined>(undefined)
  const [note, setNote] = useState('')
  const [running, setRunning] = useState(false)
  const [results, setResults] = useState<ReadonlyArray<BenchResult>>([])

  const selected = source === 'ego' ? egoData : source === 'league' ? leagueData : loaded

  if (renderers.length === 0) return <p>No renderers found in src/viz/bench/renderers.</p>

  const onFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    const decoded = decodeBenchText(await file.text())
    if (Result.isSuccess(decoded)) {
      setLoaded(decoded.success)
      setSource('file')
      setNote(`Loaded ${decoded.success.nodes.length} nodes and ${decoded.success.links.length} links.`)
    } else {
      setNote(`Could not read the file: ${decoded.failure.message}`)
    }
  }

  const run = async () => {
    const chosen = renderers.find((item) => item.name === renderer)
    const data = selected
    const element = root.current
    if (!chosen || !data || !(element instanceof HTMLElement)) {
      setNote('Pick a renderer and a dataset first.')
      return
    }
    setRunning(true)
    setNote(`Running ${chosen.name}`)
    const outcome = await Effect.runPromise(Effect.result(runBench(chosen, data, theme, element)))
    if (Result.isSuccess(outcome)) {
      setResults((previous) => [...previous, outcome.success])
      setNote('')
    } else {
      setNote(`${outcome.failure.renderer} failed at ${outcome.failure.stage}: ${outcome.failure.message}`)
    }
    setRunning(false)
  }

  return (
    <section>
      <p>{renderers.length} renderer{renderers.length === 1 ? '' : 's'} found: {renderers.map((item) => item.name).join(', ')}.</p>
      <label>Renderer{' '}
        <select value={renderer} onChange={(event) => setRenderer(event.target.value)}>
          {renderers.map((item) => <option key={item.name} value={item.name}>{item.name}</option>)}
        </select>
      </label>{' '}
      <label>Dataset{' '}
        <select value={source} onChange={(event) => setSource(event.target.value as Source)}>
          <option value="ego">ego sample</option>
          <option value="league">league sample</option>
          <option value="file" disabled={!loaded}>loaded file</option>
        </select>
      </label>{' '}
      <label>File{' '}
        <input type="file" accept="application/json" onChange={(event) => { void onFile(event) }} />
      </label>{' '}
      <button type="button" disabled={running} onClick={() => { void run() }}>Run (10 s)</button>
      <p>Dataset: {selected ? `${selected.nodes.length} nodes, ${selected.links.length} links` : 'none loaded'}.</p>
      <p role="status">{note}</p>
      <View ref={root} w="drawer" h="drawer" bg="background" />
      <p>Settle time is the renderer's own settle signal: the time until its mount() resolved.</p>
      <table>
        <thead>
          <tr><th>renderer</th><th>nodes</th><th>links</th><th>settle (ms)</th><th>frames</th><th>median fps</th><th>worst fps</th></tr>
        </thead>
        <tbody>
          {results.map((result, index) => (
            <tr key={index}>
              <td>{result.renderer}</td><td>{result.nodes}</td><td>{result.links}</td>
              <td>{result.settleMs.toFixed(0)}</td><td>{result.frames}</td>
              <td>{result.medianFps.toFixed(1)}</td><td>{result.worstFps.toFixed(1)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {results.length > 0 ? (
        <details>
          <summary>JSON</summary>
          <pre>{toPrettyJson(results)}</pre>
        </details>
      ) : null}
    </section>
  )
}

const entry: LabEntry<ReactNode> = {
  title: 'Network bench: renderer speed',
  render: () => <BenchPage />,
}

export default entry
